export type SoftphoneAgentStatus = 'online' | 'busy' | 'offline';

export type SoftphoneCallDirection = 'incoming' | 'outgoing';

export type SoftphoneSessionState =
	| 'idle'
	| 'connecting'
	| 'ringing'
	| 'calling'
	| 'connected'
	| 'ended';

/**
 * SIP/WSS profile for browser softphone.
 * Pattern follows pesoq-admin autodialTelephone:
 * - wssHost:wssPort → browser WebSocket endpoint
 * - sipDomain → REGISTER URI domain (often FS directory IP, may differ from WSS hostname)
 */
export type SoftphoneProfile = {
	/** WSS hostname or IP (e.g. 192.168.50.54 or autocall.example.com) */
	wssHost: string;
	/** WSS port (FS sofia wss-binding, e.g. 7443) */
	wssPort: string;
	/**
	 * Full WSS URL override. When set, wins over wssHost/wssPort.
	 * Example: wss://192.168.50.54:7443
	 */
	wssUrl: string;
	/** FreeSWITCH directory / SIP realm (often LAN IP) */
	sipDomain: string;
	/** Extension / SIP user (e.g. 1001) */
	account: string;
	/** SIP password (FS default_password or per-user) */
	password: string;
	/** Comma-separated stun: URLs; empty = no STUN (lab/LAN) */
	stunServers: string;
	/** Auto-answer inbound (predictive / progressive bridge) */
	autoAnswerIncoming: boolean;
	autoAnswerDelayMs: number;
	debug: boolean;
};

export type SoftphoneIncomingMeta = {
	phone: string;
	displayName?: string;
	headers: Record<string, string>;
	callUuid?: string;
	campaignId?: string;
	attemptId?: string;
	externalRecordId?: string;
	loanId?: string;
	mode?: string;
};

export type SoftphoneCallEndedPayload = {
	meta: SoftphoneIncomingMeta | null;
	direction: SoftphoneCallDirection | null;
	durationSec: number;
	status: 'answered' | 'missed' | 'cancelled' | 'failed';
};
