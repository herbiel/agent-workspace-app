import { describe, expect, it } from 'vitest';

import {
	buildWssUrl,
	defaultSoftphoneProfile,
	mergeSoftphoneProfile,
	resolveSipDomain,
} from '../config';

describe('softphone config', () => {
	it('builds wss from host+port', () => {
		expect(
			buildWssUrl({
				...defaultSoftphoneProfile,
				wssUrl: '',
				wssHost: '192.168.50.54',
				wssPort: '7443',
			}),
		).toBe('wss://192.168.50.54:7443');
	});

	it('prefers full wssUrl override', () => {
		expect(
			buildWssUrl({
				...defaultSoftphoneProfile,
				wssUrl: 'wss://lab.example:8443',
				wssHost: '192.168.50.54',
				wssPort: '7443',
			}),
		).toBe('wss://lab.example:8443');
	});

	it('merges API-style wss_host / sip_domain', () => {
		const next = mergeSoftphoneProfile(defaultSoftphoneProfile, {
			wss_host: 'autocall.example.com',
			wss_port: '7446',
			sip_domain: '10.10.41.236',
		});
		expect(next.wssHost).toBe('autocall.example.com');
		expect(next.wssPort).toBe('7446');
		expect(resolveSipDomain(next)).toBe('10.10.41.236');
	});
});
