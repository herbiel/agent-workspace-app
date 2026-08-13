<template>
	<section class="outbound-workbench">
		<header class="outbound-workbench__toolbar">
			<div>
				<h1>外呼工作台</h1>
				<p class="outbound-workbench__sub">
					比例 / 预测外呼 · 等待 dialer 桥接到来电，或手动外呼
				</p>
			</div>
			<div class="outbound-workbench__toolbar-actions">
				<button
					type="button"
					class="btn"
					:class="{ active: showSettings }"
					@click="showSettings = !showSettings"
				>
					电话设置
				</button>
				<button
					v-if="!softphone.sipRegistered"
					type="button"
					class="btn btn-success"
					@click="softphone.goOnline()"
				>
					上线接听
				</button>
				<button
					v-else
					type="button"
					class="btn"
					@click="softphone.goOffline()"
				>
					下线
				</button>
			</div>
		</header>

		<div v-if="showSettings" class="outbound-workbench__settings">
			<softphone-settings />
		</div>

		<div class="outbound-workbench__body">
			<article class="outbound-workbench__board" :class="{ live: softphone.isInCall }">
				<template v-if="softphone.isInCall">
					<div class="outbound-workbench__call-banner">
						<span class="pill">{{ callStateLabel }}</span>
						<span v-if="softphone.durationSec > 0" class="timer">
							{{ softphone.callTime }}
						</span>
					</div>
					<h2 class="outbound-workbench__phone">{{ softphone.displayPhone }}</h2>
					<p class="outbound-workbench__mode">{{ modeLabel }}</p>

					<dl v-if="screenPopRows.length" class="outbound-workbench__pop">
						<div
							v-for="row in screenPopRows"
							:key="row.label"
							class="outbound-workbench__pop-row"
						>
							<dt>{{ row.label }}</dt>
							<dd>{{ row.value }}</dd>
						</div>
					</dl>
					<p v-else class="outbound-workbench__hint">
						暂无弹屏字段（INVITE 未带业务头）。通话仍可接听。
					</p>

					<div class="outbound-workbench__controls">
						<template v-if="softphone.sessionState === 'ringing'">
							<button type="button" class="btn btn-success lg" @click="softphone.answer()">
								接听
							</button>
							<button type="button" class="btn btn-danger lg" @click="softphone.reject()">
								拒接
							</button>
						</template>
						<template v-else>
							<button type="button" class="btn lg" @click="softphone.toggleMute()">
								{{ softphone.muted ? '取消静音' : '静音' }}
							</button>
							<button type="button" class="btn btn-danger lg" @click="softphone.hangup()">
								挂断
							</button>
						</template>
					</div>
				</template>

				<template v-else>
					<div class="outbound-workbench__idle">
						<span class="outbound-workbench__idle-dot" :class="statusClass" />
						<h2>{{ idleTitle }}</h2>
						<p>{{ idleHint }}</p>
						<div class="outbound-workbench__manual">
							<input
								v-model="softphone.dialNumber"
								type="text"
								placeholder="手动拨号（可选）"
								@keyup.enter="softphone.dial()"
							/>
							<button
								type="button"
								class="btn btn-success"
								:disabled="!softphone.sipRegistered"
								@click="softphone.dial()"
							>
								拨打
							</button>
						</div>
					</div>
				</template>
			</article>

			<article class="outbound-workbench__recent">
				<h3>最近通话</h3>
				<table v-if="softphone.callHistory.length">
					<thead>
						<tr>
							<th>时间</th>
							<th>号码</th>
							<th>结果</th>
							<th>时长</th>
							<th>模式</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="row in softphone.callHistory" :key="row.id">
							<td>{{ formatTime(row.endedAt) }}</td>
							<td>{{ row.phone }}</td>
							<td>{{ statusText(row.status) }}</td>
							<td>{{ formatDur(row.durationSec) }}</td>
							<td>{{ row.meta?.mode || row.direction || '-' }}</td>
						</tr>
					</tbody>
				</table>
				<p v-else class="outbound-workbench__empty">还没有通话记录</p>
			</article>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { useSoftphoneStore } from '../../../../../features/softphone';
import SoftphoneSettings from '../../../../softphone/components/softphone-settings.vue';

const softphone = useSoftphoneStore();
const showSettings = ref(false);

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
			return '来电振铃';
		case 'calling':
			return '呼叫中';
		case 'connected':
			return '通话中';
		default:
			return softphone.sessionState;
	}
});

const modeLabel = computed(() => {
	const mode = softphone.activeCall?.mode || softphone.incomingMeta?.mode;
	if (mode === 'predictive' || mode === '1') return '预测外呼';
	if (mode === 'progressive' || mode === '2') return '比例外呼';
	if (mode === 'manual') return '手动外呼';
	return mode ? String(mode) : '外呼通话';
});

const screenPopRows = computed(() => {
	const meta = softphone.activeCall || softphone.incomingMeta;
	if (!meta)
		return [] as Array<{
			label: string;
			value: string;
		}>;
	const rows: Array<{
		label: string;
		value: string;
	}> = [];
	if (meta.campaignId)
		rows.push({
			label: '任务',
			value: meta.campaignId,
		});
	if (meta.loanId)
		rows.push({
			label: 'Loan',
			value: meta.loanId,
		});
	if (meta.externalRecordId)
		rows.push({
			label: '名单 ID',
			value: meta.externalRecordId,
		});
	if (meta.attemptId)
		rows.push({
			label: 'Attempt',
			value: meta.attemptId,
		});
	if (meta.callUuid)
		rows.push({
			label: 'Call UUID',
			value: meta.callUuid,
		});
	return rows;
});

const idleTitle = computed(() => {
	if (!softphone.sipRegistered) return '未上线';
	if (softphone.agentStatus === 'busy') return '忙碌中';
	return '等待来电';
});

const idleHint = computed(() => {
	if (!softphone.sipRegistered) {
		return '先点「上线接听」或打开「电话设置」配置 WSS / 分机。';
	}
	if (softphone.agentStatus === 'busy') {
		return 'Busy 状态下新来电会被拒接（486）。';
	}
	return '比例/预测外呼接通后会桥接到本分机；可自动接听。';
});

function formatTime(ts: number) {
	return new Date(ts).toLocaleTimeString();
}

function formatDur(sec: number) {
	const m = Math.floor(sec / 60);
	const s = sec % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}

function statusText(status: string) {
	const map: Record<string, string> = {
		answered: '已接',
		missed: '未接',
		cancelled: '取消',
		failed: '失败',
	};
	return map[status] || status;
}
</script>

<style scoped>
.outbound-workbench {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	padding: 1.25rem 1.5rem 6rem;
	width: 100%;
	min-height: 0;
	overflow: auto;
}

.outbound-workbench__toolbar {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 1rem;
}

.outbound-workbench__toolbar h1 {
	margin: 0;
	font-size: 1.35rem;
}

.outbound-workbench__sub {
	margin: 0.25rem 0 0;
	color: #5c6570;
	font-size: 0.85rem;
}

.outbound-workbench__toolbar-actions {
	display: flex;
	gap: 0.5rem;
	flex-shrink: 0;
}

.outbound-workbench__settings {
	border: 1px solid #e3e8ef;
	border-radius: 10px;
	background: #fafbfc;
	overflow: auto;
	max-height: 28rem;
}

.outbound-workbench__body {
	display: grid;
	grid-template-columns: minmax(0, 1.4fr) minmax(18rem, 1fr);
	gap: 1rem;
	align-items: start;
}

.outbound-workbench__board {
	background: #fff;
	border: 1px solid #e3e8ef;
	border-radius: 12px;
	padding: 1.5rem;
	min-height: 18rem;
}

.outbound-workbench__board.live {
	border-color: #1e8e3e;
	box-shadow: 0 0 0 2px rgb(30 142 62 / 12%);
}

.outbound-workbench__call-banner {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	margin-bottom: 0.75rem;
}

.pill {
	display: inline-block;
	padding: 0.2rem 0.55rem;
	border-radius: 999px;
	background: #e6f4ea;
	color: #137333;
	font-size: 0.75rem;
	font-weight: 600;
}

.timer {
	font-variant-numeric: tabular-nums;
	color: #3a4150;
}

.outbound-workbench__phone {
	margin: 0;
	font-size: 2rem;
	letter-spacing: 0.02em;
}

.outbound-workbench__mode {
	margin: 0.35rem 0 1rem;
	color: #5c6570;
}

.outbound-workbench__pop {
	display: grid;
	gap: 0.45rem;
	margin: 0 0 1.25rem;
	padding: 0.85rem 1rem;
	background: #f5f7fa;
	border-radius: 8px;
}

.outbound-workbench__pop-row {
	display: grid;
	grid-template-columns: 6.5rem 1fr;
	gap: 0.5rem;
	font-size: 0.875rem;
}

.outbound-workbench__pop-row dt {
	color: #6b7480;
}

.outbound-workbench__pop-row dd {
	margin: 0;
	word-break: break-all;
	font-weight: 500;
}

.outbound-workbench__hint {
	color: #6b7480;
	font-size: 0.875rem;
}

.outbound-workbench__controls {
	display: flex;
	gap: 0.65rem;
	flex-wrap: wrap;
}

.outbound-workbench__idle {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	gap: 0.5rem;
	min-height: 14rem;
}

.outbound-workbench__idle-dot {
	width: 0.85rem;
	height: 0.85rem;
	border-radius: 50%;
	background: #9aa3af;
}

.outbound-workbench__idle-dot.online {
	background: #1e8e3e;
	box-shadow: 0 0 0 6px rgb(30 142 62 / 15%);
}

.outbound-workbench__idle-dot.busy {
	background: #f9ab00;
}

.outbound-workbench__idle h2 {
	margin: 0.35rem 0 0;
}

.outbound-workbench__idle p {
	margin: 0;
	max-width: 26rem;
	color: #5c6570;
	font-size: 0.9rem;
}

.outbound-workbench__manual {
	display: flex;
	gap: 0.5rem;
	margin-top: 1rem;
	width: min(22rem, 100%);
}

.outbound-workbench__manual input {
	flex: 1;
	border: 1px solid #c9d0d8;
	border-radius: 6px;
	padding: 0.5rem 0.65rem;
}

.outbound-workbench__recent {
	background: #fff;
	border: 1px solid #e3e8ef;
	border-radius: 12px;
	padding: 1rem 1.1rem;
}

.outbound-workbench__recent h3 {
	margin: 0 0 0.75rem;
	font-size: 0.95rem;
}

.outbound-workbench__recent table {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.8rem;
}

.outbound-workbench__recent th,
.outbound-workbench__recent td {
	text-align: left;
	padding: 0.4rem 0.3rem;
	border-bottom: 1px solid #eef1f5;
}

.outbound-workbench__recent th {
	color: #6b7480;
	font-weight: 500;
}

.outbound-workbench__empty {
	margin: 0;
	color: #6b7480;
	font-size: 0.85rem;
}

.btn {
	border: 1px solid #c9d0d8;
	background: #fff;
	border-radius: 6px;
	padding: 0.45rem 0.85rem;
	cursor: pointer;
	font-size: 0.875rem;
}

.btn.active {
	border-color: #1a73e8;
	color: #1a73e8;
}

.btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.btn.lg {
	padding: 0.65rem 1.2rem;
	font-size: 0.95rem;
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

@media (max-width: 900px) {
	.outbound-workbench__body {
		grid-template-columns: 1fr;
	}
}
</style>
