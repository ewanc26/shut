// Measures the machine this runs on. Inside a container it would see only the container's
// virtual machine, so the monitor runs on the host.
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';
import { promisify } from 'node:util';
import type { Sample } from './policy.js';

const run = promisify(execFile);
/** Linux is short of memory below this share available. */
const LOW_MEMORY = 0.1;

interface Ticks {
	idle: number;
	total: number;
}

function ticks(): Ticks {
	let idle = 0;
	let total = 0;
	for (const { times } of cpus()) {
		idle += times.idle;
		total += times.user + times.nice + times.sys + times.idle + times.irq;
	}
	return { idle, total };
}

export function busyShare(before: Ticks, after: Ticks): number {
	const total = after.total - before.total;
	if (!(total > 0)) throw new Error('The processor times did not move.');
	return 1 - (after.idle - before.idle) / total;
}

/** macOS reports 1 for normal, 2 for a warning and 4 for critical. */
export const darwinMemoryTight = (level: string) => Number(level.trim()) > 1;

export const onBatteryPower = (batt: string) => batt.includes("'Battery Power'");

export function speedLimited(therm: string): boolean {
	const limit = /CPU_Speed_Limit\s*=\s*(\d+)/.exec(therm)?.[1];
	return limit !== undefined && Number(limit) < 100;
}

export function linuxMemoryTight(meminfo: string): boolean {
	const read = (name: string) => Number(new RegExp(`^${name}:\\s+(\\d+)`, 'm').exec(meminfo)?.[1]);
	const share = read('MemAvailable') / read('MemTotal');
	if (Number.isNaN(share)) throw new Error('Could not read /proc/meminfo.');
	return share < LOW_MEMORY;
}

async function system(): Promise<Omit<Sample, 'cpu'>> {
	if (process.platform === 'darwin') {
		const output = async (command: string, ...args: string[]) =>
			(await run(command, args, { timeout: 10_000 })).stdout;
		const [level, batt, therm] = await Promise.all([
			output('/usr/sbin/sysctl', '-n', 'kern.memorystatus_vm_pressure_level'),
			output('/usr/bin/pmset', '-g', 'batt'),
			output('/usr/bin/pmset', '-g', 'therm')
		]);
		return {
			memoryTight: darwinMemoryTight(level),
			onBattery: onBatteryPower(batt),
			throttled: speedLimited(therm)
		};
	}
	if (process.platform === 'linux') {
		const meminfo = await readFile('/proc/meminfo', 'utf8');
		// Power and temperature are not measured here.
		return { memoryTight: linuxMemoryTight(meminfo), onBattery: false, throttled: false };
	}
	throw new Error(`Measuring is not supported on ${process.platform}.`);
}

/** Processor use is averaged over `spanMs`. */
export async function measure(spanMs = 5_000): Promise<Sample> {
	const before = ticks();
	await wait(spanMs);
	return { cpu: busyShare(before, ticks()), ...(await system()) };
}
