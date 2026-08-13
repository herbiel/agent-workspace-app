<template>
	<header class="the-workspace-header">
		<div class="the-workspace-header__brand">
			<strong>CallFlow Agent</strong>
			<span class="the-workspace-header__sub">比例 / 预测外呼工作台</span>
		</div>
		<div class="the-workspace-header__phone">
			<span class="the-workspace-header__dot" :class="statusClass" />
			<span>{{ softphone.statusLabel }}</span>
			<span v-if="softphone.profile.account" class="the-workspace-header__ext">
				{{ softphone.profile.account }}
			</span>
			<template v-if="softphone.isInCall">
				<span class="the-workspace-header__call">{{ softphone.displayPhone }}</span>
				<span v-if="softphone.durationSec > 0">{{ softphone.callTime }}</span>
			</template>
		</div>
	</header>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { useSoftphoneStore } from '../../../features/softphone';

const softphone = useSoftphoneStore();

const statusClass = computed(() => {
	if (softphone.agentStatus === 'online' && softphone.sipRegistered)
		return 'online';
	if (softphone.agentStatus === 'busy' && softphone.sipRegistered)
		return 'busy';
	return 'offline';
});
</script>

<style scoped>
.the-workspace-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1rem;
	padding: 0.65rem 1rem;
	background: #0f2744;
	color: #fff;
}

.the-workspace-header__brand {
	display: flex;
	align-items: baseline;
	gap: 0.65rem;
}

.the-workspace-header__sub {
	font-size: 0.8rem;
	opacity: 0.75;
}

.the-workspace-header__phone {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 0.85rem;
}

.the-workspace-header__dot {
	width: 0.5rem;
	height: 0.5rem;
	border-radius: 50%;
	background: #9aa3af;
}

.the-workspace-header__dot.online {
	background: #34a853;
}

.the-workspace-header__dot.busy {
	background: #fbbc04;
}

.the-workspace-header__ext {
	opacity: 0.8;
}

.the-workspace-header__call {
	font-weight: 600;
}
</style>
