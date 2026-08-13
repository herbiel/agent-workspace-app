import { defineStore } from 'pinia';
import { useChatsStore } from '../../features/chats/store/chats';
import { useWebSocketClient } from '../api/socket/composables/useWebSocketClient';
import { isAuthBypassEnabled } from '../scripts/authBypass';

export const useWorkspaceStore = defineStore('workspace', () => {
	const { connect: connectWebSocket } = useWebSocketClient();

	async function initialize() {
		// Softphone-only lab: skip Webitel engine WS / chats bootstrap.
		if (isAuthBypassEnabled()) {
			console.info('[workspace] auth bypass on — skipping Webitel WebSocket');
			return;
		}

		// Establish the single WebSocket session for the whole app here, once.
		// Every other consumer uses getClient() (sync) and the reactive slices,
		// assuming the connection has already been brought up at this point.
		await connectWebSocket();
		// Chats coordinator (task feed + chats socket) needs the app socket up first.
		useChatsStore().initialize();
	}

	return {
		initialize,
	};
});
