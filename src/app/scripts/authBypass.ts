/** Local softphone / lab mode: skip Webitel login redirect. */
export function isAuthBypassEnabled(): boolean {
	return (
		import.meta.env.VITE_SKIP_AUTH === 'true' ||
		import.meta.env.VITE_SOFTPHONE_ONLY === 'true'
	);
}

/** Plant a dummy token so legacy Webitel checks that only look for presence pass. */
export function ensureDevAccessToken(): void {
	if (!isAuthBypassEnabled()) return;
	if (!localStorage.getItem('access-token')) {
		localStorage.setItem('access-token', 'dev-softphone-bypass');
	}
}
