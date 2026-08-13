import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';

import { SoftphoneClient } from './client';
import {
	buildWssUrl,
	defaultSoftphoneProfile,
	loadSoftphoneProfile,
	resolveSipDomain,
	saveSoftphoneProfile,
} from './config';
import { startRingtone, stopRingtone, unlockRingtone } from './ringtone';
import type {
	SoftphoneAgentStatus,
	SoftphoneCallEndedPayload,
	SoftphoneIncomingMeta,
	SoftphoneProfile,
	SoftphoneSessionState,
} from './types';

function formatDuration(sec: number): string {
	const s = String(sec % 60).padStart(2, '0');
	const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
	const h = String(Math.floor(sec / 3600)).padStart(2, '0');
	return `${h}:${m}:${s}`;
}

export const useSoftphoneStore = defineStore('softphone', () => {
	const profile = ref<SoftphoneProfile>(loadSoftphoneProfile());
	const agentStatus = ref<SoftphoneAgentStatus>('offline');
	const sipRegistered = ref(false);
	const sessionState = ref<SoftphoneSessionState>('idle');
	const durationSec = ref(0);
	const muted = ref(false);
	const lastError = ref('');
	const incomingMeta = ref<SoftphoneIncomingMeta | null>(null);
	/** Screen-pop / workbench card for the current or just-bridged call */
	const activeCall = ref<SoftphoneIncomingMeta | null>(null);
	const lastEnded = ref<SoftphoneCallEndedPayload | null>(null);
	const callHistory = ref<
		Array<
			SoftphoneCallEndedPayload & {
				id: string;
				phone: string;
				endedAt: number;
			}
		>
	>([]);
	const dialNumber = ref('');
	const logs = ref<string[]>([]);

	const remoteAudioEl = shallowRef<HTMLAudioElement | null>(null);
	const client = shallowRef<SoftphoneClient | null>(null);

	const wssUrl = computed(() => buildWssUrl(profile.value));
	const sipDomain = computed(() => resolveSipDomain(profile.value));
	const callTime = computed(() => formatDuration(durationSec.value));
	const isInCall = computed(
		() =>
			sessionState.value === 'ringing' ||
			sessionState.value === 'calling' ||
			sessionState.value === 'connected',
	);
	const displayPhone = computed(
		() => incomingMeta.value?.phone || dialNumber.value || '-',
	);
	const statusLabel = computed(() => {
		if (!sipRegistered.value && agentStatus.value !== 'offline')
			return 'Connecting';
		if (agentStatus.value === 'online' && sipRegistered.value) return 'Online';
		if (agentStatus.value === 'busy' && sipRegistered.value) return 'Busy';
		return 'Offline';
	});

	function pushLog(...args: unknown[]) {
		const line = args
			.map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
			.join(' ');
		logs.value = [
			`${new Date().toISOString().slice(11, 19)} ${line}`,
			...logs.value,
		].slice(0, 80);
		if (profile.value.debug) {
			console.log('[Softphone]', ...args);
		}
	}

	function ensureClient() {
		if (client.value) {
			client.value.updateProfile(profile.value);
			return client.value;
		}
		const c = new SoftphoneClient(profile.value, {
			onRegistered: (ok) => {
				sipRegistered.value = ok;
			},
			onAgentStatus: (s) => {
				agentStatus.value = s;
			},
			onSessionState: (s) => {
				sessionState.value = s;
				if (s === 'ringing') {
					startRingtone();
				} else {
					stopRingtone();
				}
				if (s === 'idle') {
					muted.value = false;
				}
			},
			onIncoming: (meta) => {
				incomingMeta.value = meta;
				activeCall.value = meta;
				startRingtone();
			},
			onCallEnded: (payload) => {
				stopRingtone();
				lastEnded.value = payload;
				const phone =
					payload.meta?.phone ||
					activeCall.value?.phone ||
					dialNumber.value ||
					'-';
				callHistory.value = [
					{
						...payload,
						id: `${Date.now()}-${phone}`,
						phone,
						endedAt: Date.now(),
					},
					...callHistory.value,
				].slice(0, 50);
				incomingMeta.value = null;
				activeCall.value = null;
				muted.value = false;
			},
			onRemoteStream: (stream) => {
				const el = remoteAudioEl.value;
				if (!el) return;
				el.srcObject = stream;
				if (stream) {
					el.volume = 1;
					el.muted = false;
					el.play().catch(() => {});
				}
			},
			onDuration: (sec) => {
				durationSec.value = sec;
			},
			onError: (message) => {
				lastError.value = message;
				pushLog('error', message);
			},
			onLog: (...args) => pushLog(...args),
		});
		client.value = c;
		return c;
	}

	function setRemoteAudioElement(el: HTMLAudioElement | null) {
		remoteAudioEl.value = el;
	}

	function saveProfile(next: SoftphoneProfile) {
		profile.value = {
			...next,
		};
		saveSoftphoneProfile(profile.value);
		if (client.value) {
			client.value.updateProfile(profile.value);
		}
	}

	function resetProfileToEnvDefaults() {
		profile.value = {
			...defaultSoftphoneProfile,
		};
		saveSoftphoneProfile(profile.value);
		if (client.value) client.value.updateProfile(profile.value);
	}

	function setStatus(status: SoftphoneAgentStatus) {
		lastError.value = '';
		void unlockRingtone();
		const c = ensureClient();
		c.setAgentStatus(status);
		agentStatus.value = status;
	}

	function goOnline() {
		void unlockRingtone();
		setStatus('online');
	}

	function goBusy() {
		setStatus('busy');
	}

	function goOffline() {
		setStatus('offline');
	}

	function answer() {
		stopRingtone();
		client.value?.answer();
	}

	function reject() {
		stopRingtone();
		client.value?.reject();
	}

	function hangup() {
		stopRingtone();
		client.value?.hangup();
	}

	function dial(number?: string) {
		const n = (number ?? dialNumber.value).trim();
		if (n) {
			activeCall.value = {
				phone: n,
				headers: {},
				mode: 'manual',
			};
		}
		ensureClient().dial(n);
	}

	function toggleMute() {
		const next = client.value?.toggleMute();
		if (typeof next === 'boolean') muted.value = next;
	}

	function sendDtmf(tone: string) {
		client.value?.sendDtmf(tone);
	}

	function destroy() {
		stopRingtone();
		client.value?.destroy();
		client.value = null;
		sipRegistered.value = false;
		sessionState.value = 'idle';
		agentStatus.value = 'offline';
	}

	return {
		profile,
		agentStatus,
		sipRegistered,
		sessionState,
		durationSec,
		callTime,
		muted,
		lastError,
		incomingMeta,
		activeCall,
		lastEnded,
		callHistory,
		dialNumber,
		logs,
		wssUrl,
		sipDomain,
		isInCall,
		displayPhone,
		statusLabel,
		setRemoteAudioElement,
		saveProfile,
		resetProfileToEnvDefaults,
		setStatus,
		goOnline,
		goBusy,
		goOffline,
		answer,
		reject,
		hangup,
		dial,
		toggleMute,
		sendDtmf,
		destroy,
	};
});
