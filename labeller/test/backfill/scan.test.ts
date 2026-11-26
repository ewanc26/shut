import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { jsonToLex } from '@atproto/lex';
import { afterAll, describe, it } from 'vitest';
import { databaseBytes, limitBytes } from '../../src/backfill/budget.js';
import { backfillQueue } from '../../src/backfill/queue.js';
import { type ArchiveEvent, scan } from '../../src/backfill/scan.js';
import { postText } from '../../src/detect/record.js';
import { POST } from '../../src/label/reconcile.js';

const dir = mkdtempSync(join(tmpdir(), 'shut-backfill-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let files = 0;
const fresh = () => join(dir, `${files++}.db`);

const own = 'did:plc:me';
let seq = 0;
const post = (
	operation: 'create' | 'update' | 'delete',
	rkey: string,
	text?: string,
	did = 'did:plc:a'
): ArchiveEvent => ({
	seq: ++seq,
	did,
	kind: 'commit',
	commit: {
		operation,
		collection: POST,
		rkey,
		...(text === undefined ? {} : { cid: `cid-${seq}`, record: { text } })
	}
});
async function* from(events: ArchiveEvent[], failure?: Error) {
	yield* events;
	if (failure) throw failure;
}
const keys = (queue: ReturnType<typeof backfillQueue>) =>
	queue.all().map((row) => String(row.uri).split('/').pop());

describe('scan', () => {
	it('queues only posts earning the standard label', async () => {
		const queue = backfillQueue(fresh());
		const tally = await scan(
			from([
				post('create', 'a', 'typical foid behaviour'),
				post('create', 'b', 'pure cope'),
				post('create', 'c', 'a nice garden'),
				post('create', 'd', 'incel', own)
			]),
			queue,
			{ own }
		);
		assert.deepEqual(keys(queue), ['a']);
		assert.equal(tally.matched, 1);
		assert.equal(queue.cursor(), seq);
	});

	it('drops a post that is deleted or edited out of matching', async () => {
		const queue = backfillQueue(fresh());
		await scan(
			from([
				post('create', 'a', 'incel'),
				post('create', 'b', 'incel'),
				post('create', 'c', 'incel'),
				post('delete', 'a'),
				post('update', 'b', 'never mind'),
				post('update', 'c', 'still incel')
			]),
			queue,
			{ own, batchSize: 2 }
		);
		assert.deepEqual(keys(queue), ['c']);
		assert.equal(queue.all()[0]?.cid, `cid-${seq}`);
	});

	it('forgets a deleted account, but not a deactivated one', async () => {
		const queue = backfillQueue(fresh());
		const account = (did: string, status: string): ArchiveEvent => ({
			seq: ++seq,
			did,
			kind: 'account',
			account: { active: false, status }
		});
		await scan(
			from([
				post('create', 'a', 'incel', 'did:plc:gone'),
				post('create', 'b', 'incel', 'did:plc:away'),
				account('did:plc:gone', 'deleted'),
				account('did:plc:away', 'deactivated')
			]),
			queue,
			{ own }
		);
		assert.deepEqual(keys(queue), ['b']);
	});

	it('keeps what it read when the source fails, and resumes from there', async () => {
		const path = fresh();
		const events = [post('create', 'a', 'incel'), post('create', 'b', 'incel')];
		const first = backfillQueue(path);
		await assert.rejects(scan(from(events, new Error('cut off')), first, { own }));
		first.close();
		const second = backfillQueue(path);
		assert.equal(second.cursor(), seq);
		// The same events again leave the same queue.
		await scan(from(events), second, { own });
		assert.deepEqual(keys(second), ['a', 'b']);
		second.close();
	});

	it('stops once the disk allowance is used, keeping what it wrote', async () => {
		const queue = backfillQueue(fresh());
		const events = ['a', 'b', 'c', 'd'].map((rkey) => post('create', rkey, 'incel'));
		await scan(from(events), queue, { own, batchSize: 2, full: () => true });
		assert.deepEqual(keys(queue), ['a', 'b']);
		assert.equal(queue.cursor(), events[1]?.seq);
		queue.close();
	});

	it('counts databases with their journals against a limit in GiB', () => {
		const path = fresh();
		writeFileSync(path, 'abc');
		writeFileSync(`${path}-wal`, 'de');
		assert.equal(databaseBytes([path, join(dir, 'missing.db')]), 5);
		assert.equal(limitBytes(undefined), 10 * 1024 ** 3);
		assert.equal(limitBytes('0.5'), 1024 ** 3 / 2);
		assert.throws(() => limitBytes('0'));
	});

	it('writes changes and position together, or neither', () => {
		const queue = backfillQueue(fresh());
		const save = { uri: 'at://x', did: 'did:plc:a', cid: 'c', seq: 1 };
		assert.throws(() =>
			queue.write([{ save }, { save: { ...save, uri: 'at://y', cid: null as never } }], 9)
		);
		assert.equal(queue.size(), 0);
		assert.equal(queue.cursor(), 0);
	});

	it('stores no text', () => {
		const path = fresh();
		backfillQueue(path).close();
		const columns = new DatabaseSync(path).prepare('PRAGMA table_info(matches)').all();
		assert.deepEqual(
			columns.map(({ name }) => name),
			['uri', 'did', 'cid', 'seq']
		);
	});

	it('reads the same text from the archive client’s records as from the live stream’s', () => {
		const link = { $link: 'bafkreibme22gw2h7y2h7tg2fhqotaqjucnbc24deqo72b6mkl2egezxhvy' };
		const record = {
			$type: POST,
			text: 'text',
			tags: ['one'],
			facets: [{ features: [{ $type: 'app.bsky.richtext.facet#tag', tag: 'two' }] }],
			embed: {
				$type: 'app.bsky.embed.recordWithMedia',
				media: {
					images: [{ alt: 'alt', image: { $type: 'blob', ref: link, mimeType: 'a/b', size: 1 } }]
				},
				external: { title: 'title', description: 'description' }
			}
		};
		const archived = jsonToLex(record);
		assert.deepEqual(postText(archived), postText(record));
		assert.equal(postText(archived).length, 6);
	});
});
