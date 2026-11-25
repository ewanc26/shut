import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { pendingQueue } from '../../src/judge/queue.js';

const entry = (name: string, text = name) => ({
	uri: `at://${name}`,
	segments: [text],
	queuedAt: 0
});

function drain(queue: ReturnType<typeof pendingQueue>) {
	const texts: string[] = [];
	for (let next = queue.take(); next; next = queue.take()) texts.push(next.segments.join());
	return texts;
}

function filled(limit: number, ...names: string[]) {
	const queue = pendingQueue(limit);
	for (const name of names) queue.add(entry(name));
	return queue;
}

describe('pendingQueue', () => {
	it('gives records back oldest first, then nothing', () => {
		const queue = filled(5, 'a', 'b');
		assert.deepEqual(drain(queue), ['a', 'b']);
		assert.equal(queue.take(), undefined);
		assert.equal(queue.size(), 0);
	});

	it('holds one entry per record, moving an edited one to the back', () => {
		const queue = filled(5, 'a', 'b');
		assert.equal(queue.add(entry('a', 'edited')), false);
		assert.deepEqual(drain(queue), ['b', 'edited']);
	});

	it('drops the oldest when full', () => {
		const queue = filled(2, 'a', 'b');
		assert.equal(queue.add(entry('c')), true);
		assert.deepEqual(drain(queue), ['b', 'c']);
	});

	it('restores a record to the front', () => {
		const queue = filled(3, 'b', 'c');
		queue.restore(entry('a'));
		assert.deepEqual(drain(queue), ['a', 'b', 'c']);
	});

	it('does not restore over a newer version or into a full queue', () => {
		const newer = filled(3, 'a');
		newer.restore(entry('a', 'stale'));
		assert.deepEqual(drain(newer), ['a']);

		const full = filled(2, 'b', 'c');
		full.restore(entry('a'));
		assert.deepEqual(drain(full), ['b', 'c']);
	});

	it('removes a record, and ignores one it does not hold', () => {
		const queue = filled(3, 'a', 'b');
		queue.remove('at://a');
		queue.remove('at://missing');
		assert.deepEqual(drain(queue), ['b']);
	});
});
