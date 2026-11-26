import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, it } from 'vitest';
import { features } from '../../src/judge/features.js';
import { learner, loadCounts, saveCounts } from '../../src/judge/learner.js';
import { readConfig } from '../../src/server/config.js';

// Invented sentences. "foid" is on the strong list and "cope" on the weak one.
const listed = 'foid gardening nonsense';
const clean = 'sunny picnic weather';
const weak = 'cope with the gardening';

/** A learner taught enough of each kind to have an opinion. */
function taught(rounds = 30) {
	const student = learner(undefined, 20);
	for (let i = 0; i < rounds; i++) {
		student.learn([listed]);
		student.learn([clean]);
	}
	return student;
}

describe('learner', () => {
	it('leaves out the word list’s own terms', () => {
		assert.deepEqual(features([listed]), ['gardening', 'nonsense']);
		assert.deepEqual(features([weak]), ['with', 'the', 'gardening']);
	});

	it('takes no more clean posts than labelled ones', () => {
		const student = learner();
		for (let i = 0; i < 10; i++) student.learn([clean]);
		assert.deepEqual(student.counts.docs, { pos: 0, neg: 0 });
		student.learn([listed]);
		for (let i = 0; i < 10; i++) student.learn([clean]);
		assert.deepEqual(student.counts.docs, { pos: 1, neg: 1 });
	});

	it('learns nothing from an ambiguous post or one without words', () => {
		const student = learner();
		student.learn([weak]);
		student.learn(['foid']);
		student.learn(['']);
		assert.deepEqual(student.counts.docs, { pos: 0, neg: 0 });
	});

	it('gives no opinion until it has learned enough', () => {
		assert.equal(taught(19).opinion([weak]), undefined);
	});

	it('flags context seen around labelled posts, and not other context', () => {
		const student = taught();
		assert.equal(student.opinion(['cope, gardening nonsense again']), true);
		assert.equal(student.opinion(['cope, sunny picnic weather']), false);
		assert.equal(student.opinion(['cope with something never seen']), false);
	});

	it('checks each post before learning it', () => {
		const { labelled, caught, clean: others, flagged } = taught().check();
		assert.ok(labelled > 0 && others > 0);
		assert.equal(caught, labelled);
		assert.equal(flagged, 0);
	});
});

describe('saved counts', () => {
	const directory = mkdtempSync(join(tmpdir(), 'shut-learner-'));
	const path = join(directory, 'judge-counts.json');
	afterAll(() => rmSync(directory, { recursive: true }));

	it('carries on from a saved file, which holds no sentence', () => {
		const warnings: string[] = [];
		assert.equal(loadCounts(path, (line) => warnings.push(line)).docs.pos, 0);
		saveCounts(path, taught().counts);
		assert.doesNotMatch(readFileSync(path, 'utf8'), /nonsense |foid/);
		assert.equal(learner(loadCounts(path), 20).opinion(['gardening nonsense']), true);
		assert.equal(warnings.length, 0);
		writeFileSync(path, 'broken');
		assert.equal(loadCounts(path, (line) => warnings.push(line)).docs.pos, 0);
		assert.equal(warnings.length, 1);
	});
});

describe('AI_LEARNER', () => {
	const env = { LABELER_DID: 'did:plc:test', SIGNING_KEY: 'key' };

	it('is off by default, and only logs when on', () => {
		assert.equal(readConfig(env).learner, false);
		assert.equal(readConfig({ ...env, AI_LEARNER: 'shadow' }).learner, true);
		assert.throws(() => readConfig({ ...env, AI_LEARNER: 'on' }), /AI_LEARNER/);
	});
});
