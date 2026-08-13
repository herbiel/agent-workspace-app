import type { ChatMessageType } from '@webitel/ui-chats/ui';

type SourceMessage = Record<string, unknown> | object | null | undefined;

/**
 * Local stand-in for the removed `@webitel/ui-chats/adapters` export.
 * Maps chat-web-sdk / store message shapes → ChatContainer message props.
 */
export function mapMessagesToChatMessages(
	messages: SourceMessage[] = [],
): ChatMessageType[] {
	return messages.filter(Boolean).map((raw, index) => {
		const msg = raw as Record<string, unknown>;
		const member = (msg.member || msg.from || msg.peer || {}) as Record<
			string,
			unknown
		>;
		const createdAt =
			Number(msg.createdAt ?? msg.date ?? msg.created_at ?? Date.now()) ||
			Date.now();

		// Preserve SDK id (string | number); ChatContainer tolerates either at runtime.
		const mapped = {
			id: (msg.id ?? index) as ChatMessageType['id'],
			text: String(msg.text ?? msg.body ?? msg.content ?? ''),
			createdAt,
			date: createdAt,
			member: {
				id: Number(member.id ?? 0) || 0,
				name: String(member.name ?? member.displayName ?? 'Unknown'),
				type: String(member.type ?? 'user'),
				self: Boolean(member.self ?? msg.outgoing ?? false),
			},
			file: (msg.file as ChatMessageType['file']) || undefined,
			channelId: msg.channelId ? String(msg.channelId) : undefined,
		};

		return mapped as ChatMessageType;
	});
}
