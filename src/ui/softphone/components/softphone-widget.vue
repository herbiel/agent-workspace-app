<template>
	<aside class="softphone-widget" :class="[`state-${softphone.sessionState}`]">
		<audio ref="remoteAudio" autoplay playsinline class="softphone-widget__audio" />

		<header class="softphone-widget__header">
			<div class="softphone-widget__identity">
				<strong>{{ softphone.profile.account || 'No account' }}</strong>
				<span class="softphone-widget__dot" :class="statusClass" />
				<select
					class="softphone-widget__status"
					:value="softphone.agentStatus"
					:disabled="statusChanging"
					@change="onStatusChange(($event.target as HTMLSelectElement).value)"
				>
					<option value="online">Online</option>
					<option value="busy">Busy</option>
					<option value="offline">Offline</option>
				</select>
			</div>
			<span class="softphone-widget__label">{{ softphone.statusLabel }}</span>
		</header>

		<p v-if="softphone.lastError" class="softphone-widget__error">{{ softphone.lastError }}</p>

		<div v-if="softphone.isInCall" class="softphone-widget__call">
			<div class="softphone-widget__call-meta">
				<span class="softphone-widget__call-state">{{ callStateLabel }}</span>
				<strong class="softphone-widget__phone">{{ softphone.displayPhone }}</strong>
				<span v-if="softphone.durationSec > 0" class="softphone-widget__timer">
					{{ softphone.callTime }}
				</span>
			</div>

			<div
				v-if="softphone.incomingMeta && hasScreenPop"
				class="softphone-widget__screenpop"
			>
				<div v-if="softphone.incomingMeta.mode">Mode: {{ softphone.incomingMeta.mode }}</div>
				<div v-if="softphone.incomingMeta.campaignId">
					Campaign: {{ softphone.incomingMeta.campaignId }}
				</div>
				<div v-if="softphone.incomingMeta.loanId">
					Loan: {{ softphone.incomingMeta.loanId }}
				</div>
				<div v-if="softphone.incomingMeta.externalRecordId">
					Record: {{ softphone.incomingMeta.externalRecordId }}
				</div>
				<div v-if="softphone.incomingMeta.callUuid">
					UUID: {{ softphone.incomingMeta.callUuid }}
				</div>
			</div>

			<div class="softphone-widget__actions">
				<template v-if="softphone.sessionState === 'ringing'">
					<button type="button" class="btn btn-success" @click="softphone.answer()">
						Answer
					</button>
					<button type="button" class="btn btn-danger" @click="softphone.reject()">
						Reject
					</button>
				</template>
				<template v-else>
					<button type="button" class="btn" @click="softphone.toggleMute()">
						{{ softphone.muted ? 'Unmute' : 'Mute' }}
					</button>
					<button type="button" class="btn btn-danger" @click="softphone.hangup()">
						Hang up
					</button>
				</template>
			</div>
		</div>

		<div v-else class="softphone-widget__idle">
			<div class="softphone-widget__dial">
				<input
					v-model="softphone.dialNumber"
					type="text"
					placeholder="Dial number"
					@keyup.enter="softphone.dial()"
				/>
				<button
					type="button"
					class="btn btn-success"
					:disabled="!softphone.sipRegistered"
					@click="softphone.dial()"
				>
					Call
				</button>
			</div>
			<p class="softphone-widget__hint">
				WSS <code>{{ softphone.wssUrl || '(configure)' }}</code>
			</p>
		</div>
	</aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useSoftphoneStore } from '../../../features/softphone';

const softphone = useSoftphoneStore();
const remoteAudio = ref<HTMLAudioElement | null>(null);
const statusChanging = ref(false);

const statusClass = computed(() => {
	if (softphone.agentStatus === 'online' && softphone.sipRegistered)
		return 'online';
	if (softphone.agentStatus === 'busy' && softphone.sipRegistered)
		return 'busy';
	return 'offline';
});

const callStateLabel = computed(() => {
	switch (softphone.sessionState) {
		case 'ringing':
			return 'Incoming';
		case 'calling':
			return 'Calling';
		case 'connected':
			return 'Connected';
		default:
			return softphone.sessionState;
	}
});

const hasScreenPop = computed(() => {
	const m = softphone.incomingMeta;
	if (!m) return false;
	return !!(
		m.mode ||
		m.campaignId ||
		m.loanId ||
		m.externalRecordId ||
		m.callUuid
	);
});

function onStatusChange(value: string) {
	if (
		![
			'online',
			'busy',
			'offline',
		].includes(value)
	)
		return;
	statusChanging.value = true;
	try {
		softphone.setStatus(value as 'online' | 'busy' | 'offline');
	} finally {
		statusChanging.value = false;
	}
}

onMounted(() => {
	softphone.setRemoteAudioElement(remoteAudio.value);
});

watch(remoteAudio, (el) => {
	softphone.setRemoteAudioElement(el);
});

onBeforeUnmount(() => {
	softphone.setRemoteAudioElement(null);
});
</script>

<style scoped>
.softphone-widget {
	width: min(22rem, 100%);
	background: #fff;
	border: 1px solid #d8dee6;
	border-radius: 10px;
	box-shadow: 0 4px 16px rgb(20 30 50 / 8%);
	padding: 0.85rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.softphone-widget__audio {
	position: absolute;
	width: 0;
	height: 0;
	opacity: 0;
	pointer-events: none;
}

.softphone-widget__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
}

.softphone-widget__identity {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	min-width: 0;
}

.softphone-widget__identity strong {
	font-size: 0.95rem;
}

.softphone-widget__dot {
	width: 0.55rem;
	height: 0.55rem;
	border-radius: 50%;
	background: #9aa3af;
	flex-shrink: 0;
}

.softphone-widget__dot.online {
	background: #1e8e3e;
}

.softphone-widget__dot.busy {
	background: #f9ab00;
}

.softphone-widget__dot.offline {
	background: #9aa3af;
}

.softphone-widget__status {
	border: none;
	background: transparent;
	font-size: 0.8rem;
	color: #3a4150;
	cursor: pointer;
}

.softphone-widget__label {
	font-size: 0.75rem;
	color: #6b7480;
}

.softphone-widget__error {
	margin: 0;
	padding: 0.45rem 0.55rem;
	border-radius: 6px;
	background: #fce8e6;
	color: #c5221f;
	font-size: 0.8rem;
}

.softphone-widget__call,
.softphone-widget__idle {
	display: flex;
	flex-direction: column;
	gap: 0.65rem;
}

.softphone-widget__call-meta {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.2rem;
	text-align: center;
}

.softphone-widget__call-state {
	font-size: 0.75rem;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: #6b7480;
}

.softphone-widget__phone {
	font-size: 1.25rem;
}

.softphone-widget__timer {
	font-variant-numeric: tabular-nums;
	font-size: 0.85rem;
	color: #3a4150;
}

.softphone-widget__screenpop {
	font-size: 0.75rem;
	color: #3a4150;
	background: #f5f7fa;
	border-radius: 6px;
	padding: 0.5rem 0.65rem;
	display: flex;
	flex-direction: column;
	gap: 0.2rem;
	word-break: break-all;
}

.softphone-widget__actions,
.softphone-widget__dial {
	display: flex;
	gap: 0.5rem;
}

.softphone-widget__dial input {
	flex: 1;
	border: 1px solid #c9d0d8;
	border-radius: 6px;
	padding: 0.45rem 0.6rem;
}

.softphone-widget__hint {
	margin: 0;
	font-size: 0.7rem;
	color: #6b7480;
	word-break: break-all;
}

.softphone-widget__hint code {
	font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.btn {
	border: 1px solid #c9d0d8;
	background: #fff;
	border-radius: 6px;
	padding: 0.45rem 0.75rem;
	cursor: pointer;
	font-size: 0.85rem;
}

.btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.btn-success {
	background: #1e8e3e;
	border-color: #1e8e3e;
	color: #fff;
}

.btn-danger {
	background: #d93025;
	border-color: #d93025;
	color: #fff;
}

.state-ringing {
	border-color: #1e8e3e;
	box-shadow: 0 0 0 2px rgb(30 142 62 / 20%);
}
</style>
