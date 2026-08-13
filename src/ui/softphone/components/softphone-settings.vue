<template>
	<section class="softphone-settings">
		<header class="softphone-settings__header">
			<h2>Softphone / WSS</h2>
			<p>
				Test lab: set WSS yourself (host+port or full URL). SIP domain is often the FS
				directory IP and may differ from the WSS hostname — same as pesoq autodial.
			</p>
		</header>

		<form class="softphone-settings__form" @submit.prevent="onSave">
			<label>
				<span>WSS URL (optional override)</span>
				<input
					v-model="draft.wssUrl"
					type="text"
					placeholder="wss://192.168.50.54:7443"
					autocomplete="off"
				/>
			</label>

			<div class="softphone-settings__row">
				<label>
					<span>WSS host</span>
					<input v-model="draft.wssHost" type="text" placeholder="192.168.50.54" />
				</label>
				<label>
					<span>WSS port</span>
					<input v-model="draft.wssPort" type="text" placeholder="7443" />
				</label>
			</div>

			<label>
				<span>SIP domain (REGISTER realm)</span>
				<input v-model="draft.sipDomain" type="text" placeholder="192.168.50.54" />
			</label>

			<div class="softphone-settings__row">
				<label>
					<span>Account (extension)</span>
					<input v-model="draft.account" type="text" placeholder="1001" />
				</label>
				<label>
					<span>Password</span>
					<input v-model="draft.password" type="password" placeholder="SIP password" />
				</label>
			</div>

			<label>
				<span>STUN（内网联调请留空；填了会导致 FS wan.auto 拒掉局域网 candidate）</span>
				<input
					v-model="draft.stunServers"
					type="text"
					placeholder="内网留空；公网才填 stun:stun.freeswitch.org:3478"
				/>
			</label>
			<p v-if="draft.stunServers?.trim()" class="softphone-settings__warn">
				当前填了 STUN。50.54 内网实验室请清空，否则易出现 INCOMPATIBLE_DESTINATION /
				no suitable candidates。
			</p>

			<div class="softphone-settings__row softphone-settings__checks">
				<label class="softphone-settings__check">
					<input v-model="draft.autoAnswerIncoming" type="checkbox" />
					<span>Auto-answer inbound (predictive / progressive)</span>
				</label>
				<label class="softphone-settings__check">
					<input v-model="draft.debug" type="checkbox" />
					<span>JsSIP debug</span>
				</label>
			</div>

			<label>
				<span>Auto-answer delay (ms)</span>
				<input v-model.number="draft.autoAnswerDelayMs" type="number" min="0" step="100" />
			</label>

			<p class="softphone-settings__preview">
				Effective WSS:
				<code>{{ previewWss }}</code>
				· SIP:
				<code>sip:{{ draft.account || '?' }}@{{ previewDomain }}</code>
			</p>

			<div class="softphone-settings__actions">
				<button type="submit" class="btn btn-primary">Save</button>
				<button type="button" class="btn" @click="onReset">Reset to env defaults</button>
				<button
					type="button"
					class="btn btn-success"
					:disabled="!canConnect"
					@click="onSaveAndOnline"
				>
					Save &amp; go Online
				</button>
			</div>
		</form>
	</section>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';

import {
	buildWssUrl,
	resolveSipDomain,
	useSoftphoneStore,
	type SoftphoneProfile,
} from '../../../features/softphone';

const softphone = useSoftphoneStore();

const draft = reactive<SoftphoneProfile>({
	...softphone.profile,
});

watch(
	() => softphone.profile,
	(p) => Object.assign(draft, p),
	{
		deep: true,
	},
);

const previewWss = computed(() => buildWssUrl(draft) || '(not set)');
const previewDomain = computed(() => resolveSipDomain(draft) || '(not set)');
const canConnect = computed(
	() =>
		!!buildWssUrl(draft) &&
		!!resolveSipDomain(draft) &&
		!!draft.account?.trim() &&
		!!draft.password,
);

function onSave() {
	softphone.saveProfile({
		...draft,
	});
}

function onReset() {
	softphone.resetProfileToEnvDefaults();
	Object.assign(draft, softphone.profile);
}

function onSaveAndOnline() {
	onSave();
	softphone.goOnline();
}
</script>

<style scoped>
.softphone-settings {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	padding: 1.25rem;
	max-width: 40rem;
}

.softphone-settings__header h2 {
	margin: 0 0 0.35rem;
	font-size: 1.25rem;
}

.softphone-settings__header p {
	margin: 0;
	color: #5c6570;
	font-size: 0.875rem;
	line-height: 1.4;
}

.softphone-settings__form {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.softphone-settings__row {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 0.75rem;
}

.softphone-settings__form label {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
	font-size: 0.8rem;
	color: #3a4150;
}

.softphone-settings__form input[type='text'],
.softphone-settings__form input[type='password'],
.softphone-settings__form input[type='number'] {
	border: 1px solid #c9d0d8;
	border-radius: 6px;
	padding: 0.5rem 0.65rem;
	font-size: 0.9rem;
}

.softphone-settings__checks {
	align-items: center;
}

.softphone-settings__check {
	flex-direction: row !important;
	align-items: center;
	gap: 0.5rem !important;
}

.softphone-settings__preview {
	margin: 0.25rem 0 0;
	font-size: 0.8rem;
	color: #5c6570;
	word-break: break-all;
}

.softphone-settings__preview code {
	font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	background: #f2f4f7;
	padding: 0.1rem 0.35rem;
	border-radius: 4px;
}

.softphone-settings__warn {
	margin: 0;
	padding: 0.5rem 0.65rem;
	border-radius: 6px;
	background: #fef7e0;
	color: #7a5c00;
	font-size: 0.8rem;
	line-height: 1.35;
}

.softphone-settings__actions {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
	margin-top: 0.25rem;
}

.btn {
	border: 1px solid #c9d0d8;
	background: #fff;
	border-radius: 6px;
	padding: 0.45rem 0.85rem;
	cursor: pointer;
	font-size: 0.875rem;
}

.btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.btn-primary {
	background: #1a73e8;
	border-color: #1a73e8;
	color: #fff;
}

.btn-success {
	background: #1e8e3e;
	border-color: #1e8e3e;
	color: #fff;
}

@media (max-width: 640px) {
	.softphone-settings__row {
		grid-template-columns: 1fr;
	}
}
</style>
