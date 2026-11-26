// Advises the labeller and backfill when to pause: pnpm monitor [--once] [--file <path>]
// Run it on the host, not in a container. With --once it takes one measurement and exits,
// for a scheduler such as launchd, cron or a systemd timer to repeat every 30 seconds.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { writeAdvice, writeJson } from '../schedule/advice.js';
import { measure } from '../schedule/metrics.js';
import { decide, DEFAULT_LIMITS, type State } from '../schedule/policy.js';

const EVERY_MS = 30_000;

const { values } = parseArgs({
	args: process.argv.slice(2).filter((argument) => argument !== '--'),
	options: { once: { type: 'boolean' }, file: { type: 'string' } }
});
const file = values.file || process.env.SCHEDULE_FILE;
if (!file) throw new Error('Name the advice file with --file or SCHEDULE_FILE.');

const percent = (name: string, fallback: number): number => {
	const setting = process.env[name]?.trim();
	if (!setting) return fallback;
	const value = Number(setting);
	if (!(value > 0 && value <= 100)) throw new Error(`${name} must be from 1 to 100.`);
	return value / 100;
};
const limits = {
	...DEFAULT_LIMITS,
	busyCpu: percent('MONITOR_BUSY_CPU', DEFAULT_LIMITS.busyCpu),
	calmCpu: percent('MONITOR_CALM_CPU', DEFAULT_LIMITS.calmCpu)
};
if (limits.calmCpu >= limits.busyCpu)
	throw new Error('MONITOR_CALM_CPU must be below MONITOR_BUSY_CPU.');

mkdirSync(dirname(file), { recursive: true });
/** Kept beside the advice so that single runs remember what came before. */
const statePath = `${file}.state`;

function previous(): State | undefined {
	try {
		return JSON.parse(readFileSync(statePath, 'utf8')) as State;
	} catch {
		return;
	}
}

let state = previous();
for (;;) {
	const sample = await measure().catch((error: Error) => {
		console.warn('Could not measure:', error.message);
		return undefined;
	});
	const was = state?.pause ?? false;
	state = decide(state, sample, Date.now(), limits);
	writeAdvice(file, { pause: state.pause, reason: state.reason, at: state.seenAt });
	writeJson(statePath, state);
	if (state.pause !== was)
		console.log(`${new Date().toISOString()} ${state.pause ? 'pause' : 'run'}: ${state.reason}`);
	if (values.once) break;
	await wait(EVERY_MS);
}
