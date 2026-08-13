import { setConfig as setApiServicesConfig } from '@webitel/api-services';
import { setConfig as setChatsServicesConfig } from '@webitel/ui-chats';
import { eventBus } from '@webitel/ui-sdk/scripts';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import i18n from './app/locale/i18n';
import App from './app/the-app.vue';
import {
	plugin as WebitelUI,
	options as WebitelUIOptions,
} from './app/plugins/webitel/ui-sdk';
import { createUserAccessControl } from './app/composables/useUserAccessControl';
import { initRouter, router } from './app/router';
import { initializeConfig } from './features/appConfig/config';
import { useUserinfoStore } from './features/userinfo/stores/userinfoStore';
import {
	ensureDevAccessToken,
	isAuthBypassEnabled,
} from './app/scripts/authBypass';
import { setTokenFromUrl } from './app/scripts/setTokenFromUrl';
import { useWorkspaceStore } from './app/stores/workspace';

setTokenFromUrl();
ensureDevAccessToken();

setApiServicesConfig({
	eventBus,
});
setChatsServicesConfig({
	i18n,
});

const pinia = createPinia();

const initApp = async () => {
	const app = createApp(App)
		.use(i18n)
		.use(pinia)
		.use(WebitelUI, WebitelUIOptions);

	const {
		initialize: initializeUserinfo,
		routeAccessGuard,
		clearStorageNotifications,
	} = useUserinfoStore();

	const { initialize: initializeWorkspace } = useWorkspaceStore();
	try {
		await initializeConfig();
		if (!isAuthBypassEnabled()) {
			await initializeUserinfo();
		} else {
			console.info('[app] VITE_SKIP_AUTH — skipping Webitel userinfo');
		}
		await initializeWorkspace();
		if (!isAuthBypassEnabled()) {
			createUserAccessControl(useUserinfoStore);
		}
		await initRouter({
			beforeEach: isAuthBypassEnabled()
				? []
				: [
						routeAccessGuard,
					],
			onUnauthorized: clearStorageNotifications,
		});
	} catch (err) {
		console.error('Error initializing app', err);
		// Softphone lab: still mount UI even if Webitel bootstrap fails.
		if (isAuthBypassEnabled() && !router) {
			await initRouter({
				beforeEach: [],
				onUnauthorized: () => {},
			});
		}
	}

	app.use(router);

	app.mount('#app');

	return app;
};

initApp();
