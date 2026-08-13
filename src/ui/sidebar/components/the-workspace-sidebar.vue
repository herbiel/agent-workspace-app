<template>
	<aside class="workspace-sidebar">
		<header class="workspace-sidebar__head">
			<strong>通话上下文</strong>
		</header>

		<div v-if="softphone.isInCall || softphone.activeCall" class="workspace-sidebar__body">
			<div class="workspace-sidebar__phone">{{ softphone.displayPhone }}</div>
			<div class="workspace-sidebar__meta">
				<div>状态：{{ softphone.sessionState }}</div>
				<div v-if="softphone.durationSec">时长：{{ softphone.callTime }}</div>
				<div v-if="meta?.mode">模式：{{ meta.mode }}</div>
				<div v-if="meta?.campaignId">任务：{{ meta.campaignId }}</div>
				<div v-if="meta?.loanId">Loan：{{ meta.loanId }}</div>
				<div v-if="meta?.externalRecordId">名单：{{ meta.externalRecordId }}</div>
			</div>
		</div>

		<div v-else class="workspace-sidebar__idle">
			<p>空闲。上线后等待比例/预测外呼桥接。</p>
			<p class="workspace-sidebar__ext">
				分机 {{ softphone.profile.account || '—' }} · {{ softphone.statusLabel }}
			</p>
		</div>
	</aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { useSoftphoneStore } from '../../../features/softphone';

const softphone = useSoftphoneStore();
const meta = computed(() => softphone.activeCall || softphone.incomingMeta);
</script>

<style scoped>
.workspace-sidebar {
	width: 280px;
	background-color: var(--white);
	border-left: 1px solid #e3e8ef;
	display: flex;
	flex-direction: column;
	padding: 1rem;
	gap: 0.75rem;
}

.workspace-sidebar__head {
	font-size: 0.85rem;
	color: #3a4150;
}

.workspace-sidebar__phone {
	font-size: 1.35rem;
	font-weight: 600;
	margin-bottom: 0.5rem;
}

.workspace-sidebar__meta {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
	font-size: 0.8rem;
	color: #3a4150;
	word-break: break-all;
}

.workspace-sidebar__idle {
	color: #6b7480;
	font-size: 0.85rem;
	line-height: 1.4;
}

.workspace-sidebar__idle p {
	margin: 0 0 0.5rem;
}

.workspace-sidebar__ext {
	font-size: 0.75rem;
}
</style>
