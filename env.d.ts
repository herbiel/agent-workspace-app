/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_STAGING_ENV: string;
	readonly VITE_CHAT_WEB_SOCKET_URL: string;
	readonly VITE_SIP_WSS_HOST?: string;
	readonly VITE_SIP_WSS_PORT?: string;
	readonly VITE_SIP_WSS_URL?: string;
	readonly VITE_SIP_DOMAIN?: string;
	readonly VITE_SIP_ACCOUNT?: string;
	readonly VITE_SIP_PASSWORD?: string;
	readonly VITE_SIP_STUN?: string;
	readonly VITE_SIP_AUTO_ANSWER?: string;
	readonly VITE_SIP_AUTO_ANSWER_MS?: string;
	readonly VITE_SIP_DEBUG?: string;
	readonly VITE_SKIP_AUTH?: string;
	readonly VITE_SOFTPHONE_ONLY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
