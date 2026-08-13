import JsSIP from 'jssip';
import type { UA } from 'jssip';
import type { RTCSession } from 'jssip/lib/RTCSession';

import { buildWssUrl, resolveSipDomain } from './config';
import { extractIncomingMeta } from './headers';
import {
	bindSessionIceReady,
	buildPcConfig,
	mungeSdpPreferG711,
	parseStunUrls,
	stripPrivateHostsFromPublicSdp,
} from './media';
import type {
	SoftphoneAgentStatus,
	SoftphoneCallEndedPayload,
	SoftphoneIncomingMeta,
	SoftphoneProfile,
	SoftphoneSessionState,
} from './types';

export type SoftphoneClientCallbacks = {
	onRegistered: (registered: boolean) => void;
	onAgentStatus: (status: SoftphoneAgentStatus) => void;
	onSessionState: (state: SoftphoneSessionState) => void;
	onIncoming: (meta: SoftphoneIncomingMeta) => void;
	onCallEnded: (payload: SoftphoneCallEndedPayload) => void;
	onRemoteStream: (stream: MediaStream | null) => void;
	onDuration: (seconds: number) => void;
	onError: (message: string) => void;
	onLog: (...args: unknown[]) => void;
};

type SessionExtras = RTCSession & {
	_phoneSrflxIp?: string;
	connection?: RTCPeerConnection;
};

export class SoftphoneClient {
	private ua: UA | null = null;
	private session: SessionExtras | null = null;
	private profile: SoftphoneProfile;
	private agentStatus: SoftphoneAgentStatus = 'offline';
	private callbacks: SoftphoneClientCallbacks;
	private durationTimer: ReturnType<typeof setInterval> | null = null;
	private durationSec = 0;
	private autoAnswerTimer: ReturnType<typeof setTimeout> | null = null;
	private lastMeta: SoftphoneIncomingMeta | null = null;
	private direction: 'incoming' | 'outgoing' | null = null;

	constructor(profile: SoftphoneProfile, callbacks: SoftphoneClientCallbacks) {
		this.profile = profile;
		this.callbacks = callbacks;
	}

	get registered(): boolean {
		return !!this.ua?.isRegistered();
	}

	get currentSession(): RTCSession | null {
		return this.session;
	}

	updateProfile(profile: SoftphoneProfile) {
		this.profile = profile;
	}

	setAgentStatus(status: SoftphoneAgentStatus) {
		const prev = this.agentStatus;
		this.agentStatus = status;
		this.callbacks.onAgentStatus(status);

		if (status === 'offline') {
			this.goOffline();
			return;
		}
		if (prev === 'offline' || !this.registered) {
			this.connect();
		}
	}

	connect() {
		if (this.agentStatus === 'offline') return;

		const wss = buildWssUrl(this.profile);
		const domain = resolveSipDomain(this.profile);
		const account = String(this.profile.account || '').trim();
		const password = String(this.profile.password || '');

		if (!wss || !domain || !account || !password) {
			this.callbacks.onError(
				'Softphone config incomplete: need WSS, sipDomain, account, password',
			);
			return;
		}

		if (this.ua?.isRegistered()) {
			this.callbacks.onRegistered(true);
			return;
		}

		this.stopUa();

		if (this.profile.debug) {
			JsSIP.debug.enable('JsSIP:*');
		}

		this.callbacks.onLog('SIP connecting', {
			account,
			wss,
			sipDomain: domain,
		});

		const socket = new JsSIP.WebSocketInterface(wss);
		this.ua = new JsSIP.UA({
			uri: `sip:${account}@${domain}`,
			authorization_user: account,
			password,
			sockets: [
				socket,
			],
			register: true,
			register_expires: 3600,
			session_timers: false,
		});

		this.bindUa(this.ua);
		this.ua.start();
	}

	goOffline() {
		this.clearAutoAnswer();
		this.hangup();
		if (!this.ua) {
			this.callbacks.onRegistered(false);
			return;
		}
		const ua = this.ua;
		const finish = () => {
			try {
				ua.stop();
			} catch {
				/* ignore */
			}
			if (this.ua === ua) this.ua = null;
			this.callbacks.onRegistered(false);
		};
		try {
			ua.unregister({
				all: true,
			});
		} catch {
			finish();
			return;
		}
		setTimeout(finish, 2000);
	}

	destroy() {
		this.clearAutoAnswer();
		this.stopTimer();
		this.hangup();
		this.stopUa();
		this.callbacks.onRemoteStream(null);
	}

	answer() {
		if (!this.session) return;
		this.clearAutoAnswer();
		this.callbacks.onLog('Answering call');
		this.session.answer({
			mediaConstraints: {
				audio: true,
				video: false,
			},
			pcConfig: buildPcConfig(this.profile.stunServers),
			rtcAnswerConstraints: {
				offerToReceiveAudio: true,
				offerToReceiveVideo: false,
			},
		});
	}

	reject() {
		this.clearAutoAnswer();
		if (!this.session) return;
		try {
			this.session.terminate({
				status_code: 486,
				reason_phrase: 'Busy Here',
			});
		} catch {
			this.session.terminate();
		}
	}

	hangup() {
		this.clearAutoAnswer();
		if (this.session) {
			try {
				this.session.terminate();
			} catch {
				/* ignore */
			}
		}
	}

	dial(number: string) {
		const mobile = String(number || '').trim();
		if (!mobile || mobile.length <= 2) {
			this.callbacks.onError('Enter a valid number');
			return;
		}
		if (!this.ua?.isRegistered()) {
			this.callbacks.onError('SIP not registered. Go Online first.');
			return;
		}
		if (this.session) {
			this.callbacks.onError('Call already in progress');
			return;
		}

		const domain = resolveSipDomain(this.profile);
		const targetURI = `sip:${mobile}@${domain}`;
		this.direction = 'outgoing';
		this.lastMeta = {
			phone: mobile,
			headers: {},
		};
		this.callbacks.onSessionState('calling');
		this.callbacks.onLog('Dialing', targetURI);

		this.ua.call(targetURI, {
			mediaConstraints: {
				audio: true,
				video: false,
			},
			pcConfig: buildPcConfig(this.profile.stunServers),
			rtcOfferConstraints: {
				offerToReceiveAudio: true,
				offerToReceiveVideo: false,
			},
		});
	}

	toggleMute(): boolean {
		if (!this.session) return false;
		const muted = this.session.isMuted().audio;
		if (muted)
			this.session.unmute({
				audio: true,
			});
		else
			this.session.mute({
				audio: true,
			});
		return !muted;
	}

	sendDtmf(tone: string) {
		if (!this.session) return;
		try {
			this.session.sendDTMF(tone);
		} catch (err) {
			this.callbacks.onLog('DTMF failed', err);
		}
	}

	private stopUa() {
		if (this.ua) {
			try {
				this.ua.stop();
			} catch {
				/* ignore */
			}
			this.ua = null;
		}
		this.callbacks.onRegistered(false);
	}

	private bindUa(ua: UA) {
		ua.on('connected', () => this.callbacks.onLog('SIP websocket connected'));
		ua.on('disconnected', () => {
			this.callbacks.onRegistered(false);
			this.callbacks.onLog('SIP websocket disconnected');
		});
		ua.on('registered', () => {
			this.callbacks.onRegistered(true);
			this.callbacks.onLog('SIP registered', this.profile.account);
		});
		ua.on('unregistered', () => {
			this.callbacks.onRegistered(false);
			this.callbacks.onLog('SIP unregistered');
		});
		ua.on(
			'registrationFailed',
			(e: {
				cause?: string;
				response?: {
					status_code?: number;
					reason_phrase?: string;
				};
			}) => {
				this.callbacks.onRegistered(false);
				const msg =
					`SIP registration failed: ${e?.cause || ''} ${e?.response?.status_code || ''} ${e?.response?.reason_phrase || ''}`.trim();
				this.callbacks.onError(msg);
				this.callbacks.onLog(msg, e);
			},
		);
		ua.on(
			'newRTCSession',
			(data: {
				session: RTCSession;
				request?: unknown;
				originator?: string;
			}) => {
				this.onNewSession(data.session as SessionExtras, data.request);
			},
		);
	}

	private onNewSession(session: SessionExtras, inviteRequest?: unknown) {
		if (session.direction === 'incoming') {
			if (this.session) {
				this.rejectIncoming(session, 486, 'Busy Here');
				return;
			}
			if (this.agentStatus === 'busy') {
				this.rejectIncoming(session, 486, 'Busy Here');
				return;
			}
			if (this.agentStatus === 'offline' || !this.registered) {
				this.rejectIncoming(session, 480, 'Temporarily Unavailable');
				return;
			}
		}

		this.session = session;
		this.direction = session.direction as 'incoming' | 'outgoing';
		this.stopTimer();
		this.durationSec = 0;

		const stunUrls = parseStunUrls(this.profile.stunServers);
		if (session.connection) {
			session.connection.setConfiguration(
				buildPcConfig(this.profile.stunServers),
			);
		}

		const clearIceGathering = bindSessionIceReady(
			session,
			this.profile.stunServers,
			(...args) => this.callbacks.onLog(...args),
		);

		session.on(
			'sdp',
			(data: { originator: string; type: string; sdp: string }) => {
				if (data.originator !== 'local') return;
				// Prefer G.711 on both offer and answer for FS.
				data.sdp = mungeSdpPreferG711(data.sdp);
				// Only strip private hosts when STUN is enabled (public path).
				if (stunUrls.length > 0 && data.type === 'offer') {
					data.sdp = stripPrivateHostsFromPublicSdp(
						data.sdp,
						session._phoneSrflxIp,
					);
				}
			},
		);

		const setupPc = (pc: RTCPeerConnection) => {
			pc.addEventListener('track', (ev) => {
				if (!ev.track || ev.track.kind !== 'audio') return;
				const stream =
					ev.streams?.[0] ||
					new MediaStream([
						ev.track,
					]);
				this.callbacks.onRemoteStream(stream);
			});
		};

		if (session.connection) setupPc(session.connection);
		session.on('peerconnection', (e: { peerconnection: RTCPeerConnection }) => {
			setupPc(e.peerconnection);
		});

		if (session.direction === 'incoming') {
			this.lastMeta = extractIncomingMeta(session, inviteRequest);
			this.callbacks.onIncoming(this.lastMeta);
			this.callbacks.onSessionState('ringing');
			this.scheduleAutoAnswer(session);
		} else {
			this.callbacks.onSessionState('calling');
		}

		let answeredOk = false;
		session.on('accepted', () => {
			answeredOk = true;
			this.callbacks.onSessionState('connected');
			this.startTimer();
		});
		session.on('confirmed', () => {
			answeredOk = true;
			this.callbacks.onSessionState('connected');
			if (!this.durationTimer) this.startTimer();
		});
		session.on('failed', (e: { cause?: string }) => {
			clearIceGathering();
			this.finishCall(
				session,
				e?.cause === 'Canceled' ? 'cancelled' : 'failed',
			);
		});
		session.on(
			'ended',
			(e?: {
				cause?: string;
				message?: {
					getHeader?: (n: string) => string;
				};
			}) => {
				clearIceGathering();
				const reason = e?.message?.getHeader?.('Reason') || '';
				if (
					/INCOMPATIBLE_DESTINATION/i.test(reason) ||
					/cause=88/i.test(reason)
				) {
					this.callbacks.onError(
						'媒体失败 INCOMPATIBLE_DESTINATION：FS 拒绝了内网 ICE candidate。内网请清空 STUN，并在 FS sofia 设置 apply-candidate-acl=localnet.auto',
					);
				}
				const status =
					this.durationSec > 0
						? 'answered'
						: answeredOk
							? 'failed'
							: session.direction === 'incoming'
								? 'missed'
								: 'cancelled';
				this.finishCall(session, status);
			},
		);
	}

	private scheduleAutoAnswer(session: RTCSession) {
		this.clearAutoAnswer();
		if (!this.profile.autoAnswerIncoming) return;
		const delay = this.profile.autoAnswerDelayMs || 1000;
		this.autoAnswerTimer = setTimeout(() => {
			if (this.session === session && this.direction === 'incoming') {
				this.answer();
			}
		}, delay);
	}

	private clearAutoAnswer() {
		if (this.autoAnswerTimer) {
			clearTimeout(this.autoAnswerTimer);
			this.autoAnswerTimer = null;
		}
	}

	private finishCall(
		session: RTCSession,
		status: SoftphoneCallEndedPayload['status'],
	) {
		this.clearAutoAnswer();
		const direction = this.direction;
		const meta = this.lastMeta;
		const durationSec = this.durationSec;
		this.stopTimer();
		this.session = null;
		this.direction = null;
		this.lastMeta = null;
		this.callbacks.onRemoteStream(null);
		this.callbacks.onSessionState('idle');
		this.callbacks.onCallEnded({
			meta,
			direction,
			durationSec,
			status,
		});
		void session;
	}

	private rejectIncoming(
		session: RTCSession,
		statusCode: number,
		reasonPhrase: string,
	) {
		try {
			session.terminate({
				status_code: statusCode,
				reason_phrase: reasonPhrase,
			});
		} catch {
			session.terminate();
		}
	}

	private startTimer() {
		this.stopTimer();
		this.durationSec = 0;
		this.callbacks.onDuration(0);
		this.durationTimer = setInterval(() => {
			this.durationSec += 1;
			this.callbacks.onDuration(this.durationSec);
		}, 1000);
	}

	private stopTimer() {
		if (this.durationTimer) {
			clearInterval(this.durationTimer);
			this.durationTimer = null;
		}
		this.durationSec = 0;
		this.callbacks.onDuration(0);
	}
}
