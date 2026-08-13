<template>
	<div class="task-dock-call-lane">
		<task-dock-item-wrapper
			label="Softphone"
			:expanded="true"
			:collapsible="false"
		>
			<div class="task-dock-call-lane__status">
				<span>{{ softphone.statusLabel }}</span>
				<span v-if="softphone.profile.account">· {{ softphone.profile.account }}</span>
			</div>
		</task-dock-item-wrapper>

		<task-dock-item-wrapper
			v-if="softphone.isInCall"
			:label="softphone.displayPhone"
			:expanded="true"
			:collapsible="false"
		>
			<div class="task-dock-call-lane__call">
				<span>{{ softphone.sessionState }}</span>
				<span v-if="softphone.durationSec > 0">{{ softphone.callTime }}</span>
				<button type="button" @click="softphone.hangup()">Hang up</button>
			</div>
		</task-dock-item-wrapper>
	</div>
</template>

<script setup lang="ts">
import { useSoftphoneStore } from '../../../features/softphone';
import TaskDockItemWrapper from './task-dock-item-wrapper.vue';

const softphone = useSoftphoneStore();
</script>

<style scoped>
.task-dock-call-lane {
	display: flex;
	flex-direction: column-reverse;
	align-items: flex-start;
	gap: 0.35rem;
}

.task-dock-call-lane__status,
.task-dock-call-lane__call {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 0.8rem;
}

.task-dock-call-lane__call button {
	border: 1px solid #d93025;
	background: #d93025;
	color: #fff;
	border-radius: 4px;
	padding: 0.2rem 0.45rem;
	cursor: pointer;
}
</style>
