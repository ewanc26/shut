// Runs against a real labeller server and database, and reads labels back over HTTP and WebSocket.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { LabelerServer } from '@skyware/labeler';
import { type Change, type LabelStore, POST, reconcile } from '../../src/label/reconcile.js';
import { LABEL, STRICT_LABEL } from '../../src/label/definition.js';
import { serverStore } from '../../src/label/store.js';
import { loadCursor, saveCursor } from '../../src/stream/cursor.js';

const dir = mkdtempSync(join(tmpdir(), 'shut-'));
const did = 'did:plc:testlabeller';
let server: LabelerServer;
let store: LabelStore;
let base: string;

beforeAll(async () => {
	server = new LabelerServer({
		did,
		signingKey: randomBytes(32).toString('hex'),
		dbPath: join(dir, 'labels.db')
	});
	store = await serverStore(server);
	await new Promise<void>((resolve, reject) =>
		server.start({ host: '127.0.0.1', port: 0 }, (error) => (error ? reject(error) : resolve()))
	);
	base = `127.0.0.1:${(server.app.server.address() as AddressInfo).port}`;
});

afterAll(async () => {
	await new Promise<void>((resolve) => server.close(resolve));
	server.db.close();
	rmSync(dir, { recursive: true, force: true });
});

const change = (
	operation: Change['operation'],
	text?: string,
	cid?: string,
	rkey = 'abc'
): Change => ({
	did: 'did:plc:author',
	collection: POST,
	rkey,
	operation,
	...(cid ? { cid } : {}),
	...(text === undefined ? {} : { record: { text } })
});

const uri = (rkey: string) => `at://did:plc:author/${POST}/${rkey}`;

async function labels(): Promise<{ val: string; neg?: boolean; cid?: string; sig?: unknown }[]> {
	const response = await fetch(`http://${base}/xrpc/com.atproto.label.queryLabels?uriPatterns=*`);
	assert.equal(response.status, 200);
	return ((await response.json()) as { labels: [] }).labels;
}

describe('reconcile', () => {
	it('leaves ordinary posts alone', async () => {
		assert.equal(await reconcile(change('create', 'hello', 'cid1'), store), undefined);
		assert.equal((await labels()).length, 0);
	});

	it('applies both labels to a matching post once, even when the event is replayed', async () => {
		const outcome = await reconcile(change('create', 'foid', 'cid1'), store);
		assert.deepEqual(outcome?.applied, [LABEL, STRICT_LABEL]);
		assert.equal(await reconcile(change('create', 'foid', 'cid1'), store), undefined);
		const all = await labels();
		assert.deepEqual(all.map(({ val }) => val).sort(), [LABEL, STRICT_LABEL]);
		assert.ok(all.every(({ cid, sig }) => cid === 'cid1' && sig));
	});

	it('labels the new version after an edit that still matches', async () => {
		const outcome = await reconcile(change('update', 'foids', 'cid2'), store);
		assert.deepEqual(outcome?.applied, [LABEL, STRICT_LABEL]);
	});

	it('keeps only the strict label after an edit down to one ambiguous term', async () => {
		const outcome = await reconcile(change('update', 'pure cope', 'cid3'), store);
		assert.deepEqual(outcome?.applied, [STRICT_LABEL]);
		assert.deepEqual(outcome?.negated, [LABEL]);
		assert.equal(outcome?.ambiguous, undefined);
		assert.equal(await store.active(uri('abc'), LABEL), undefined);
		assert.deepEqual(await store.active(uri('abc'), STRICT_LABEL), { cid: 'cid3' });
	});

	it('withdraws the strict label once an edit removes the language', async () => {
		const outcome = await reconcile(change('update', 'sorry', 'cid4'), store);
		assert.deepEqual(outcome?.negated, [STRICT_LABEL]);
		assert.equal((await labels()).at(-1)?.neg, true);
		assert.equal(await reconcile(change('update', 'sorry again', 'cid5'), store), undefined);
	});

	it('withdraws both labels when a labelled post is deleted', async () => {
		await reconcile(change('create', 'foid', 'cid1', 'gone'), store);
		assert.deepEqual(
			(await reconcile(change('delete', undefined, undefined, 'gone'), store))?.negated,
			[LABEL, STRICT_LABEL]
		);
		assert.equal(
			await reconcile(change('delete', undefined, undefined, 'never'), store),
			undefined
		);
	});

	it('never labels the labeller account itself', async () => {
		const own = change('create', 'a labeller for incel language', 'c', 'own');
		assert.equal(await reconcile(own, store, own.did), undefined);
	});

	it('gives an ambiguous record only the strict label, and reports it', async () => {
		const before = (await labels()).length;
		const outcome = await reconcile(change('create', 'pure cope', 'c', 'unsure'), store);
		assert.deepEqual(outcome?.ambiguous, ['pure cope']);
		assert.deepEqual(outcome?.applied, [STRICT_LABEL]);
		const added = (await labels()).slice(before);
		assert.deepEqual(
			added.map(({ val }) => val),
			[STRICT_LABEL]
		);
	});

	it('ignores other collections', async () => {
		assert.equal(
			await reconcile(
				{ ...change('create', 'foid', 'c'), collection: 'app.bsky.feed.like' },
				store
			),
			undefined
		);
	});

	it('serves stored labels to subscribers', async () => {
		const socket = new WebSocket(`ws://${base}/xrpc/com.atproto.label.subscribeLabels?cursor=0`);
		const frame = await new Promise<MessageEvent>((resolve, reject) => {
			socket.onmessage = resolve;
			socket.onerror = () => reject(new Error('socket error'));
		});
		assert.ok(frame.data);
		socket.close();
	});

	it('refuses unauthenticated manual labelling', async () => {
		const response = await fetch(`http://${base}/xrpc/tools.ozone.moderation.emitEvent`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{}'
		});
		assert.equal(response.status, 401);
	});
});

describe('cursor', () => {
	it('round-trips and tolerates a missing or bad file', () => {
		const path = join(dir, 'cursor');
		assert.equal(loadCursor(path), undefined);
		saveCursor(path, 1_700_000_000_000_000);
		assert.equal(loadCursor(path), 1_700_000_000_000_000);
		saveCursor(path, Number.NaN);
		assert.equal(loadCursor(path), undefined);
	});
});
