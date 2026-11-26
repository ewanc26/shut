import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { handOff } from '../../src/judge/handoff.js';
import { reconcile, type Change, type LabelStore } from '../../src/label/reconcile.js';

/** A label store in memory, so each decision is the real one. */
function store(): LabelStore {
	const labels = new Map<string, { cid?: string }>();
	return {
		active: async (uri, label) => labels.get(`${uri} ${label}`),
		apply: async (uri, cid, label) => void labels.set(`${uri} ${label}`, cid ? { cid } : {}),
		negate: async (uri, _cid, label) => void labels.delete(`${uri} ${label}`)
	};
}

const URI = 'at://did:plc:someone/app.bsky.feed.post/one';

async function play(steps: [Change['operation'], string?][]) {
	const calls: string[] = [];
	const judge = {
		offer: (uri: string, segments: readonly string[]) =>
			calls.push(`offer ${uri} ${segments.join('|')}`),
		forget: (uri: string) => calls.push(`forget ${uri}`)
	};
	const labels = store();
	for (const [index, [operation, text]] of steps.entries()) {
		const outcome = await reconcile(
			{
				did: 'did:plc:someone',
				collection: 'app.bsky.feed.post',
				rkey: 'one',
				operation,
				...(text === undefined ? {} : { cid: `c${index}`, record: { text } })
			},
			labels
		);
		handOff(judge, URI, outcome);
	}
	return calls;
}

describe('handOff', () => {
	it('offers an ambiguous record and forgets it once deleted', async () => {
		assert.deepEqual(await play([['create', 'pure cope'], ['delete']]), [
			`offer ${URI} pure cope`,
			`forget ${URI}`
		]);
	});

	it('forgets a record edited so it needs no opinion', async () => {
		for (const text of ['a nice day', 'blackpill']) {
			const calls = await play([
				['create', 'pure cope'],
				['update', text]
			]);
			assert.equal(calls.at(-1), `forget ${URI}`, text);
		}
	});

	it('forgets a record whose label was just withdrawn', async () => {
		const calls = await play([
			['create', 'blackpill'],
			['update', 'pure cope']
		]);
		assert.deepEqual(calls, [`forget ${URI}`, `forget ${URI}`]);
	});
});
