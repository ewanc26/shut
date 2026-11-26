// Judges from system measurements whether this is a good time to run.

export interface Sample {
	/** Share of all processor time in use, from 0 to 1. */
	cpu: number;
	/** The system reports that memory is short. */
	memoryTight: boolean;
	onBattery: boolean;
	/** The processor is being slowed to cool it. */
	throttled: boolean;
}

export interface Limits {
	/** At or above this share of the processor the machine is busy. */
	busyCpu: number;
	/** At or below this share it is calm again. Between the two, nothing changes. */
	calmCpu: number;
	/** How long a change must last before it is acted on. */
	sustainMs: number;
}

export const DEFAULT_LIMITS: Limits = { busyCpu: 0.7, calmCpu: 0.5, sustainMs: 2 * 60 * 1000 };

export interface State {
	pause: boolean;
	reason: string;
	/** Since when the measurements have argued for the other answer. */
	changingSince?: number | undefined;
	/** When the last measurement was taken. */
	seenAt: number;
}

/** After a gap this long, such as sleep, earlier measurements no longer count. */
const FORGET_MS = 3 * 60 * 1000;

function troubles({ cpu, memoryTight, onBattery, throttled }: Sample, cpuBusy: boolean) {
	return [
		cpuBusy ? `processor ${Math.round(cpu * 100)}% busy` : undefined,
		memoryTight ? 'memory short' : undefined,
		onBattery ? 'on battery' : undefined,
		throttled ? 'processor throttled' : undefined
	].filter((each) => each !== undefined);
}

/** The next state. With no sample, because measuring failed, the answer is to run. */
export function decide(
	previous: State | undefined,
	sample: Sample | undefined,
	now: number,
	{ busyCpu, calmCpu, sustainMs }: Limits = DEFAULT_LIMITS
): State {
	if (!sample) return { pause: false, reason: 'could not measure', seenAt: now };
	const recent = previous && now - previous.seenAt <= FORGET_MS ? previous : undefined;
	const pause = recent?.pause ?? false;
	// Running needs trouble to pause; pausing needs the absence of it to run.
	const found = troubles(sample, pause ? sample.cpu > calmCpu : sample.cpu >= busyCpu);
	const changing = pause ? found.length === 0 : found.length > 0;
	const reason = found.join(', ') || 'calm';
	if (!changing) return { pause, reason, seenAt: now };
	const changingSince = recent?.changingSince ?? now;
	if (now - changingSince >= sustainMs) return { pause: !pause, reason, seenAt: now };
	return { pause, reason, changingSince, seenAt: now };
}
