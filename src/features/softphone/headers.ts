import type { SoftphoneIncomingMeta } from './types';

type SipHeaderMap = Record<string, string>;

function header(map: SipHeaderMap, ...names: string[]): string {
	for (const name of names) {
		const v = map[name.toLowerCase()];
		if (v) return v;
	}
	return '';
}

/**
 * Extract screen-pop fields from SIP INVITE headers.
 * Supports pesoq-style App-* / X-* and go-dialer custom headers when present.
 */
export function extractIncomingMeta(
	session: {
		remote_identity?: {
			uri?: {
				user?: string;
			};
			display_name?: string;
		};
		_request?: unknown;
	},
	inviteRequest?: unknown,
): SoftphoneIncomingMeta {
	const request =
		inviteRequest ||
		(session &&
			((
				session as {
					_request?: unknown;
				}
			)._request ||
				(
					session as {
						request?: unknown;
					}
				).request)) ||
		null;

	const headerMap: SipHeaderMap = {};

	const req = request as {
		headers?: Record<
			string,
			Array<
				| {
						raw?: string;
				  }
				| string
			>
		>;
		data?: string;
	} | null;

	if (req?.headers && typeof req.headers === 'object') {
		for (const key of Object.keys(req.headers)) {
			const list = req.headers[key];
			const first = list && list[0];
			const raw =
				first && typeof first === 'object' && 'raw' in first
					? first.raw
					: first;
			if (raw != null && raw !== '') {
				headerMap[String(key).toLowerCase()] = String(raw).trim();
			}
		}
	}

	if (req?.data && typeof req.data === 'string') {
		const headerBlock = String(req.data).split(/\r\n\r\n/)[0] || '';
		for (const line of headerBlock.split(/\r\n/)) {
			const idx = line.indexOf(':');
			if (idx <= 0) continue;
			const name = line.slice(0, idx).trim().toLowerCase();
			const value = line.slice(idx + 1).trim();
			if (!name || !value) continue;
			if (!headerMap[name]) headerMap[name] = value;
		}
	}

	let phone =
		header(
			headerMap,
			'p-asserted-identity',
			'remote-party-id',
			'x-customer-phone',
			'x-customer-number',
			'from',
		) ||
		session?.remote_identity?.uri?.user ||
		'';

	const paiMatch = phone.match(/sip:([^@>;\s]+)/i);
	if (paiMatch) phone = paiMatch[1];
	const angleMatch = phone.match(/<([^>]+)>/);
	if (angleMatch) {
		const inner = angleMatch[1];
		const m = inner.match(/sip:([^@>;\s]+)/i);
		phone = m ? m[1] : inner;
	}

	return {
		phone,
		displayName: session?.remote_identity?.display_name || '',
		headers: headerMap,
		callUuid: header(headerMap, 'x-call-uuid', 'call-uuid', 'x-cid'),
		campaignId: header(
			headerMap,
			'x-campaign-id',
			'campaign-id',
			'app-campaign-id',
		),
		attemptId: header(headerMap, 'x-attempt-id', 'attempt-id'),
		externalRecordId: header(
			headerMap,
			'x-external-record-id',
			'external-record-id',
			'app-collection-id',
			'collection-id',
		),
		loanId: header(headerMap, 'x-loan-id', 'loan-id', 'app-loan-id'),
		mode: header(headerMap, 'x-dial-mode', 'dial-mode', 'app-mode'),
	};
}
