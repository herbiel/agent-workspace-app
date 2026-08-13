<template>
    <section class="the-chat-window">
        <h1>{{ thread?.subject ?? 'Chat Window' }}</h1>
        <chat-container
            :messages="chatMessages"
            :chat-actions="chatActions"
            :can-load-next-messages="hasMore"
            :is-next-messages-loading="isLoading"
            @load-next-messages="chatSession.loadMore"
            @action:sendMessage="handleSendMessage"
            @action:attachFiles="handleAttachFiles"
        />
    </section>
</template>

<script
    setup
    lang="ts"
>
import { ChatAction, ChatContainer } from '@webitel/ui-chats/ui';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { mapMessagesToChatMessages } from '../../../../../features/chats/adapters/mapMessagesToChatMessages';
import { useChatSessionStore } from '../../../../../features/chats/store/chat-session';

type ResultCallbacks = {
	onSuccess?: () => void;
	onError?: (error: Error) => void;
	onComplete?: () => void;
};

const route = useRoute();
const threadId = computed(() => route.params.threadId as string);

// Resolve reactively so the window rebinds when threadId changes; a destructured
// storeToRefs would stay pinned to the first chat's store.
const chatSession = computed(() => useChatSessionStore(threadId.value));
const thread = computed(() => chatSession.value.thread);
const messages = computed(() => chatSession.value.messages);
const hasMore = computed(() => chatSession.value.hasMore);
const isLoading = computed(() => chatSession.value.isLoading);

const chatMessages = computed(() => mapMessagesToChatMessages(messages.value));

const chatActions = [
	ChatAction.SendMessage,
	ChatAction.AttachFiles,
];

async function handleSendMessage(
	text: string,
	{ onSuccess, onError, onComplete }: ResultCallbacks = {},
) {
	try {
		await chatSession.value.sendText(text);
		onSuccess?.();
	} catch (error) {
		onError?.(error as Error);
	} finally {
		onComplete?.();
	}
}

async function handleAttachFiles(
	files: File[],
	{ onSuccess, onError, onComplete }: ResultCallbacks = {},
) {
	try {
		await chatSession.value.sendFiles(files);
		onSuccess?.();
	} catch (error) {
		onError?.(error as Error);
	} finally {
		onComplete?.();
	}
}
</script>

<style scoped>
.the-chat-window {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
}

.the-chat-container {
    flex: 1;
    min-height: 0;
}
</style>
