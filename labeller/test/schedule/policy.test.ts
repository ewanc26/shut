import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
	busyShare,
	darwinMemoryTight,
	linuxMemoryTight,
	onBatteryPower,
	speedLimited
} from '../../src/schedule/metrics.js';
import { decide, type Sample, type State } from '../../src/schedule/policy.js';

const calm: Sample = { cpu: 0.2, memoryTight: false, onBattery: false, throttled: false };
const busy: Sample = { ...calm, cpu: 0.9 };

/** Feeds one sample every 30 seconds and returns each answer. */
function run(samples: (Sample | undefined)[], start?: State) {
	let state = start;
	let now = start?.seenAt ?? 0;
	return samples.map((sample) => (state = decide(state, sample, (now += 30_000))));
}

const pauses = (states: State[]) => states.map((state) => (state.pause ? 'P' : '.')).join('');
const often = (sample: Sample, times: number) => Array<Sample>(times).fill(sample);

describe('decide', () => {
	it('pauses only after two busy minutes', () => {
		assert.equal(pauses(run(often(busy, 6))), '....PP');
	});

	it('ignores a short burst', () => {
		assert.equal(pauses(run([...often(busy, 3), calm, ...often(busy, 3)])), '.......');
	});

	it('resumes only after two calm minutes', () => {
		const [paused] = run(often(busy, 5)).slice(-1);
		assert.equal(pauses(run(often(calm, 6), paused)), 'PPPP..');
	});

	it('holds its answer between the two processor limits', () => {
		const middling = { ...calm, cpu: 0.6 };
		assert.equal(pauses(run(often(middling, 8))), '........');
		const [paused] = run(often(busy, 5)).slice(-1);
		assert.equal(pauses(run(often(middling, 8), paused)), 'PPPPPPPP');
	});

	it('counts memory, battery and heat as busy', () => {
		for (const [sample, reason] of [
			[{ ...calm, memoryTight: true }, 'memory short'],
			[{ ...calm, onBattery: true }, 'on battery'],
			[{ ...calm, throttled: true }, 'processor throttled']
		] as const) {
			const last = run(often(sample, 5)).at(-1);
			assert.equal(last?.pause, true);
			assert.equal(last.reason, reason);
		}
	});

	it('runs when it cannot measure', () => {
		const [paused] = run(often(busy, 5)).slice(-1);
		assert.equal(run([undefined], paused)[0]?.pause, false);
	});

	it('starts afresh after a long gap', () => {
		const [paused] = run(often(busy, 5)).slice(-1);
		assert.equal(decide(paused, busy, (paused?.seenAt ?? 0) + 3_600_000).pause, false);
	});
});

describe('metrics', () => {
	it('works out processor use between two readings', () => {
		assert.equal(busyShare({ idle: 100, total: 200 }, { idle: 125, total: 300 }), 0.75);
		assert.throws(() => busyShare({ idle: 1, total: 2 }, { idle: 1, total: 2 }));
	});

	it('reads macOS reports', () => {
		assert.equal(darwinMemoryTight('1\n'), false);
		assert.equal(darwinMemoryTight('2\n'), true);
		assert.equal(onBatteryPower("Now drawing from 'Battery Power'"), true);
		assert.equal(onBatteryPower("Now drawing from 'AC Power'"), false);
		assert.equal(speedLimited('Note: No thermal warning level has been recorded'), false);
		assert.equal(speedLimited('CPU_Speed_Limit \t= 100'), false);
		assert.equal(speedLimited('CPU_Speed_Limit \t= 60'), true);
	});

	it('reads Linux memory', () => {
		const info = (available: number) =>
			`MemTotal:       1000 kB\nMemFree:  1 kB\nMemAvailable:    ${available} kB\n`;
		assert.equal(linuxMemoryTight(info(500)), false);
		assert.equal(linuxMemoryTight(info(50)), true);
		assert.throws(() => linuxMemoryTight(''));
	});
});
