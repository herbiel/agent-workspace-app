/** Prefer G.711 for FreeSWITCH / legacy gateways (from pesoq TelephoneN1). */
export function mungeSdpPreferG711(sdp: string): string {
	const lines = sdp.split('\r\n');
	let mLineIndex = -1;
	let audioPayloads: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		if (lines[i].startsWith('m=audio')) {
			mLineIndex = i;
			const parts = lines[i].split(' ');
			if (parts.length > 3) audioPayloads = parts.slice(3);
			break;
		}
	}

	if (mLineIndex === -1) return sdp;

	const preferred = [
		'0',
		'8',
	];
	const others = audioPayloads.filter((p) => !preferred.includes(p));
	const newPayloads = [
		...preferred,
		...others,
	];
	const parts = lines[mLineIndex].split(' ');
	lines[mLineIndex] = [
		...parts.slice(0, 3),
		...newPayloads,
	].join(' ');

	return lines.join('\r\n');
}

function isPrivateIpv4(ip: string): boolean {
	const parts = String(ip || '')
		.split('.')
		.map(Number);
	if (
		parts.length !== 4 ||
		parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)
	) {
		return false;
	}
	if (parts[0] === 10) return true;
	if (parts[0] === 192 && parts[1] === 168) return true;
	if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
	if (parts[0] === 127) return true;
	return false;
}

function readCandidateAddress(candidateLine: string): string {
	const line = String(candidateLine || '').replace(
		/^a=candidate:/,
		'candidate:',
	);
	const match = line.match(
		/candidate:\S+\s+\d+\s+\w+\s+\d+\s+(\d+\.\d+\.\d+\.\d+)\s+\d+\s+typ/,
	);
	return match ? match[1] : '';
}

function readCandidateType(candidateLine: string): string {
	const match = String(candidateLine || '').match(/\styp\s+(\w+)/);
	return match ? match[1] : '';
}

/** When using STUN, drop private host candidates so FS sees public path. */
export function stripPrivateHostsFromPublicSdp(
	sdp: string,
	srflxIp?: string,
): string {
	const lines = sdp.split('\r\n');
	const kept = lines.filter((line) => {
		if (!line.startsWith('a=candidate:')) return true;
		const typ = readCandidateType(line);
		if (typ === 'srflx' || typ === 'relay' || typ === 'prflx') return true;
		const ip = readCandidateAddress(line);
		return !isPrivateIpv4(ip);
	});
	if (srflxIp) {
		for (let i = 0; i < kept.length; i++) {
			if (!kept[i].startsWith('c=IN IP4 ')) continue;
			const connIp = kept[i].slice('c=IN IP4 '.length);
			if (isPrivateIpv4(connIp)) {
				kept[i] = `c=IN IP4 ${srflxIp}`;
			}
		}
	}
	return kept.join('\r\n');
}

export function parseStunUrls(raw: string): string[] {
	return String(raw || '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean)
		.map((url) =>
			url.startsWith('stun:') || url.startsWith('turn:') ? url : `stun:${url}`,
		);
}

export function buildPcConfig(stunServers: string): RTCConfiguration {
	const urls = parseStunUrls(stunServers);
	return {
		iceServers: urls.map((url) => ({
			urls: url,
		})),
		rtcpMuxPolicy: 'require',
		iceTransportPolicy: 'all',
	};
}

const ICE_GATHER_MAX_MS = 5000;

type IceReadyEvent = {
	candidate?: {
		protocol?: string;
		type?: string;
		address?: string;
		candidate?: string;
	} | null;
	ready: () => void;
};

/**
 * Wait for a usable UDP ICE candidate before JsSIP sends local SDP.
 * Intranet (no STUN): first UDP host is enough.
 * With STUN: wait for srflx so FS wan.auto ACL can accept a public candidate.
 */
export function bindSessionIceReady(
	session: {
		on: (event: string, cb: (data: IceReadyEvent) => void) => void;
		isEnded?: () => boolean;
		terminate?: (opts?: object) => void;
		_phoneSrflxIp?: string;
	},
	stunServers: string,
	onLog: (...args: unknown[]) => void,
): () => void {
	const stunUrls = parseStunUrls(stunServers);
	let iceSent = false;
	let hasUdpHost = false;
	let hasUdpSrflx = false;
	let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
	let pendingEvent: IceReadyEvent | null = null;
	session._phoneSrflxIp = undefined;

	const cleanup = () => {
		if (deadlineTimer) {
			clearTimeout(deadlineTimer);
			deadlineTimer = null;
		}
	};

	const canSendSdp = () => (stunUrls.length ? hasUdpSrflx : hasUdpHost);

	const sendReady = (event: IceReadyEvent, reason: string) => {
		if (iceSent) return;
		iceSent = true;
		cleanup();
		onLog('ICE ready', reason, {
			host: hasUdpHost,
			srflx: hasUdpSrflx,
			stun: stunUrls.length > 0,
		});
		event.ready();
	};

	const tryReady = (event: IceReadyEvent, reason: string) => {
		if (iceSent) return;
		if (!canSendSdp()) {
			pendingEvent = event;
			return;
		}
		sendReady(event, reason);
	};

	const armDeadline = (event: IceReadyEvent) => {
		pendingEvent = event;
		if (deadlineTimer) return;
		deadlineTimer = setTimeout(() => {
			deadlineTimer = null;
			if (iceSent || !pendingEvent) return;
			if (canSendSdp()) {
				sendReady(pendingEvent, 'deadline');
				return;
			}
			onLog('ICE deadline without usable candidate', {
				host: hasUdpHost,
				srflx: hasUdpSrflx,
				stun: stunUrls,
			});
			// Intranet: host is usually enough — send whatever we have rather than hanging.
			if (hasUdpHost) {
				sendReady(pendingEvent, 'deadline-host-fallback');
				return;
			}
			try {
				session.terminate?.({
					status_code: 488,
					reason_phrase: 'No ICE candidates',
				});
			} catch {
				/* ignore */
			}
		}, ICE_GATHER_MAX_MS);
	};

	session.on('icecandidate', (event) => {
		armDeadline(event);

		if (!event.candidate) {
			tryReady(
				event,
				stunUrls.length ? 'gathering-complete' : 'gathering-complete-intranet',
			);
			return;
		}

		const protocol = String(event.candidate.protocol || '').toLowerCase();
		const candidateType = event.candidate.type;
		if (protocol !== 'udp') return;

		if (candidateType === 'host') {
			hasUdpHost = true;
			if (!stunUrls.length) tryReady(event, 'intranet-udp-host');
			return;
		}

		if (candidateType === 'srflx' && stunUrls.length) {
			hasUdpSrflx = true;
			const srflxIp =
				event.candidate.address ||
				readCandidateAddress(String(event.candidate.candidate || ''));
			if (srflxIp) session._phoneSrflxIp = srflxIp;
			tryReady(event, 'public-udp-srflx');
		}
	});

	return cleanup;
}
