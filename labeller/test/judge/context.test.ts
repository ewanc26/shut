import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { detect } from '../../src/detect/match.js';
import { estimate, train } from '../../src/judge/bayes.js';
import { secondOpinion } from '../../src/judge/context.js';
import { ambiguousSentences } from '../../src/judge/words.js';
import { readConfig } from '../../src/server/config.js';

const judge = (text: string) => secondOpinion([text], detect([text]));

describe('naive Bayes', () => {
	const model = train([['red', 'warm']], [['blue', 'cold']]);

	it('leans towards the class a word was seen in', () => {
		assert.ok(estimate(model, ['red']).probability > 0.5);
		assert.ok(estimate(model, ['blue']).probability < 0.5);
	});

	it('is undecided about unknown words and counts repeats once', () => {
		assert.deepEqual(estimate(model, ['green']), { probability: 0.5, known: 0 });
		assert.deepEqual(estimate(model, ['red', 'red']), estimate(model, ['red']));
	});
});

describe('secondOpinion', () => {
	it('picks out an unseen sentence arguing from the community view', () => {
		assert.equal(judge('cope harder, women only care about your jaw')?.matched, true);
	});

	for (const text of [
		'how do you cope with night shifts and small children',
		'chad is coming round to help paint the fence on saturday',
		'a long day. I cannot cope. Elsewhere, women say height and looks matter in dating.'
	]) {
		it(`has nothing to say about ${JSON.stringify(text)}`, () => {
			assert.notEqual(judge(text)?.matched, true);
		});
	}

	it('stays out of records the word list already labels', () => {
		assert.equal(judge('incel women only care about height'), undefined);
	});

	it('reads only the sentences holding an ambiguous term', () => {
		assert.deepEqual(ambiguousSentences(['One. I cannot cope! Three.']), ['I cannot cope!']);
	});
});

describe('AI_JUDGE', () => {
	const env = { LABELER_DID: 'did:plc:test', SIGNING_KEY: 'key' };

	it('is off unless set to shadow', () => {
		assert.equal(readConfig(env).shadowJudge, false);
		assert.equal(readConfig({ ...env, AI_JUDGE: 'shadow' }).shadowJudge, true);
	});

	it('refuses any other value', () => {
		assert.throws(() => readConfig({ ...env, AI_JUDGE: 'on' }), /AI_JUDGE/);
	});
});
