/**
 * Incoming-call ringtone. Browsers block autoplay until a user gesture —
 * call unlock() from Online / any click first.
 */

let audio: HTMLAudioElement | null = null;
let unlocked = false;
let ringing = false;
let fallbackCtx: AudioContext | null = null;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;

const base = import.meta.env.BASE_URL || '/';
const RINGTONE_URL = `${base.endsWith('/') ? base : `${base}/`}audio/ringtone.mp3`;

function ensureAudio(): HTMLAudioElement {
	if (!audio) {
		audio = new Audio(RINGTONE_URL);
		audio.loop = true;
		audio.preload = 'auto';
		audio.volume = 1;
	}
	return audio;
}

function stopFallback() {
	if (fallbackTimer) {
		clearInterval(fallbackTimer);
		fallbackTimer = null;
	}
	if (fallbackCtx) {
		try {
			fallbackCtx.close();
		} catch {
			/* ignore */
		}
		fallbackCtx = null;
	}
}

function beepOnce(ctx: AudioContext) {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.value = 440;
	gain.gain.value = 0.15;
	osc.connect(gain);
	gain.connect(ctx.destination);
	osc.start();
	gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
	osc.stop(ctx.currentTime + 0.45);
}

function startFallback() {
	stopFallback();
	const Ctx =
		window.AudioContext ||
		(
			window as unknown as {
				webkitAudioContext: typeof AudioContext;
			}
		).webkitAudioContext;
	if (!Ctx) return;
	fallbackCtx = new Ctx();
	void fallbackCtx.resume();
	beepOnce(fallbackCtx);
	fallbackTimer = setInterval(() => {
		if (fallbackCtx) beepOnce(fallbackCtx);
	}, 1200);
}

/** Warm unlock after a click (Online / Save & go Online). */
export async function unlockRingtone(): Promise<void> {
	try {
		const el = ensureAudio();
		el.muted = true;
		el.loop = false;
		await el.play();
		el.pause();
		el.currentTime = 0;
		el.muted = false;
		el.loop = true;
		unlocked = true;
	} catch {
		// Still mark unlocked so we try again on ring; gesture may have opened AudioContext.
		unlocked = true;
	}
	try {
		const Ctx =
			window.AudioContext ||
			(
				window as unknown as {
					webkitAudioContext: typeof AudioContext;
				}
			).webkitAudioContext;
		if (Ctx) {
			const ctx = new Ctx();
			await ctx.resume();
			await ctx.close();
		}
	} catch {
		/* ignore */
	}
}

export function startRingtone(): void {
	if (ringing) return;
	ringing = true;
	const el = ensureAudio();
	el.currentTime = 0;
	el.loop = true;
	el.volume = 1;
	el.muted = false;
	const play = el.play();
	if (play && typeof play.then === 'function') {
		play.catch(() => {
			if (ringing) startFallback();
		});
	}
}

export function stopRingtone(): void {
	ringing = false;
	stopFallback();
	if (!audio) return;
	try {
		audio.pause();
		audio.currentTime = 0;
	} catch {
		/* ignore */
	}
}

export function isRingtoneUnlocked(): boolean {
	return unlocked;
}
