import type { SoftphoneProfile } from './types';

const STORAGE_KEY = 'callflow-softphone-profile';

/** Defaults for local lab (override via .env or Settings UI). */
export const defaultSoftphoneProfile: SoftphoneProfile = {
	wssHost: import.meta.env.VITE_SIP_WSS_HOST || '192.168.50.54',
	wssPort: import.meta.env.VITE_SIP_WSS_PORT || '7443',
	wssUrl: import.meta.env.VITE_SIP_WSS_URL || '',
	sipDomain: import.meta.env.VITE_SIP_DOMAIN || '192.168.50.54',
	account: import.meta.env.VITE_SIP_ACCOUNT || '',
	password: import.meta.env.VITE_SIP_PASSWORD || '',
	stunServers: import.meta.env.VITE_SIP_STUN || '',
	autoAnswerIncoming: import.meta.env.VITE_SIP_AUTO_ANSWER !== 'false',
	autoAnswerDelayMs: Number(import.meta.env.VITE_SIP_AUTO_ANSWER_MS || 3000),
	debug: import.meta.env.VITE_SIP_DEBUG === 'true',
};

function isIpHost(host: string): boolean {
	return /^\d{1,3}(\.\d{1,3}){3}$/.test(String(host || ''));
}

export function buildWssUrl(profile: SoftphoneProfile): string {
	const override = String(profile.wssUrl || '').trim();
	if (override) {
		if (override.startsWith('ws://') || override.startsWith('wss://')) {
			return override;
		}
		return `wss://${override}`;
	}
	const host = String(profile.wssHost || '').trim();
	const port = String(profile.wssPort || '').trim();
	if (!host) return '';
	return port ? `wss://${host}:${port}` : `wss://${host}`;
}

export function resolveSipDomain(profile: SoftphoneProfile): string {
	const domain = String(profile.sipDomain || '').trim();
	if (domain) return domain;
	const host = String(profile.wssHost || '').trim();
	return host;
}

/**
 * Merge API/runtime overrides onto base profile (same idea as pesoq extractAutoDialPhoneProfile).
 * Accepts: wss_host, wss_port, wss_url, sip_domain, sip_host, server (host:port).
 */
export function mergeSoftphoneProfile(
	base: SoftphoneProfile,
	override?: Partial<SoftphoneProfile> & Record<string, unknown>,
): SoftphoneProfile {
	if (!override)
		return {
			...base,
		};
	const next: SoftphoneProfile = {
		...base,
	};

	const asStr = (v: unknown) => (v == null ? '' : String(v).trim());

	if (asStr(override.sipDomain) || asStr(override.sip_domain)) {
		next.sipDomain = asStr(override.sipDomain) || asStr(override.sip_domain);
	}

	const server = asStr(override.server) || asStr(override.domain);
	if (server) {
		const [host, port] = server.split(':');
		if (isIpHost(host)) {
			next.sipDomain = host;
		} else if (port && Number(port) > 10000) {
			next.wssHost = host;
			next.wssPort = port;
		}
	}

	if (
		asStr(override.wssHost) ||
		asStr(override.wss_host) ||
		asStr(override.sip_host)
	) {
		next.wssHost =
			asStr(override.wssHost) ||
			asStr(override.wss_host) ||
			asStr(override.sip_host);
	}
	if (asStr(override.wssPort) || asStr(override.wss_port)) {
		next.wssPort = asStr(override.wssPort) || asStr(override.wss_port);
	} else if (asStr(override.sip_port) && Number(override.sip_port) > 10000) {
		next.wssPort = asStr(override.sip_port);
	}
	if (asStr(override.wssUrl) || asStr(override.wss_url)) {
		next.wssUrl = asStr(override.wssUrl) || asStr(override.wss_url);
	}
	if (asStr(override.account) || asStr(override.username)) {
		next.account = asStr(override.account) || asStr(override.username);
	}
	if (asStr(override.password)) {
		next.password = asStr(override.password);
	}
	if (override.stunServers != null || override.stun != null) {
		next.stunServers = asStr(override.stunServers ?? override.stun);
	}
	if (typeof override.autoAnswerIncoming === 'boolean') {
		next.autoAnswerIncoming = override.autoAnswerIncoming;
	}
	if (override.autoAnswerDelayMs != null) {
		next.autoAnswerDelayMs =
			Number(override.autoAnswerDelayMs) || next.autoAnswerDelayMs;
	}
	if (typeof override.debug === 'boolean') {
		next.debug = override.debug;
	}

	return next;
}

export function loadSoftphoneProfile(): SoftphoneProfile {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw)
			return {
				...defaultSoftphoneProfile,
			};
		const parsed = JSON.parse(raw) as Partial<SoftphoneProfile>;
		return mergeSoftphoneProfile(defaultSoftphoneProfile, parsed);
	} catch {
		return {
			...defaultSoftphoneProfile,
		};
	}
}

export function saveSoftphoneProfile(profile: SoftphoneProfile): void {
	const toStore: SoftphoneProfile = {
		...profile,
		// never persist empty password overwrite of env if user cleared by mistake? keep as-is
	};
	localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
}

export function clearSoftphoneProfileStorage(): void {
	localStorage.removeItem(STORAGE_KEY);
}
