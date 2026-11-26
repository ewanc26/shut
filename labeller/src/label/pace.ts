// Spaces work out, so a burst of labels is not announced faster than its readers allow.

/**
 * Runs tasks in the order given, starting no two closer than `gapMs` apart. A task given
 * after a quiet spell runs at once.
 */
export function paced(gapMs: number) {
	const waiting: (() => void)[] = [];
	let free = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function next(): void {
		timer = undefined;
		const task = waiting.shift();
		if (!task) return;
		free = Date.now() + gapMs;
		// Scheduled first, so a task that throws does not stall the rest.
		if (waiting.length) schedule();
		task();
	}

	function schedule(): void {
		timer = setTimeout(next, Math.max(0, free - Date.now()));
		// Waiting must not keep the process alive.
		timer.unref();
	}

	return (task: () => void): void => {
		waiting.push(task);
		if (timer) return;
		if (Date.now() >= free) next();
		else schedule();
	};
}
