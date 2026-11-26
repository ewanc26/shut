// Runs against a real labeller server and reads frames back over WebSocket.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeFirst } from '@atcute/cbor';
import { LabelerServer } from '@skyware/labeler';
import { afterAll, beforeAll, describe, it, vi } from 'vitest';
import { batchedReplay } from '../../src/label/replay.js';

const dir = mkdtempSync(join(tmpdir(), 'shut-replay-'));
const BATCH = 10;
const CHANNEL = 'com.atproto.label.subscribeLabels';
let server: LabelerServer;
let base: string;
let saved = 0;

const label = () =>
	server.createLabel({ uri: `at://did:plc:a/app.bsky.feed.post/${++saved}`, val: 'x' });

beforeAll(async () => {
	server = new LabelerServer({
		did: 'did:plc:testlabeller',
		signingKey: randomBytes(32).toString('hex'),
		dbPath: join(dir, 'labels.db')
	});
	// Unpaced here; pacing is covered below and in pace.test.ts.
	batchedReplay(server, BATCH, Infinity);
	await new Promise<void>((resolve, reject) =>
		server.start({ host: '127.0.0.1', port: 0 }, (error) => (error ? reject(error) : resolve()))
	);
	const { port } = server.app.server.address() as AddressInfo;
	base = `ws://127.0.0.1:${port}/xrpc/com.atproto.label.subscribeLabels`;
	for (let i = 0; i < BATCH * 3 + 5; i++) await label();
});

afterAll(async () => {
	await new Promise<void>((resolve) => server.close(resolve));
	server.db.close();
	rmSync(dir, { recursive: true, force: true });
});

interface Frame {
	header: { op: number; t?: string };
	body: { seq: number; error?: string; labels: { uri: string; sig: unknown }[] };
}

async function subscribe(query: string, address = base) {
	const socket = new WebSocket(address + query);
	const raw: Uint8Array[] = [];
	socket.binaryType = 'arraybuffer';
	const frames: Frame[] = [];
	socket.onmessage = ({ data }) => {
		const bytes = new Uint8Array(data as ArrayBuffer);
		raw.push(bytes);
		const [header, rest] = decodeFirst(bytes);
		frames.push({ header, body: decodeFirst(rest)[0] } as Frame);
	};
	const closed = new Promise<void>((resolve) => (socket.onclose = () => resolve()));
	await new Promise((resolve) => (socket.onopen = resolve));
	return { socket, frames, raw, closed, seqs: () => frames.map(({ body }) => body.seq) };
}

const upTo = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

describe('batchedReplay', () => {
	it('sends several batches of history in order, each label once', async () => {
		const reads = vi.spyOn(server.db, 'execute');
		const { socket, frames, seqs } = await subscribe('?cursor=0');
		await vi.waitFor(() => assert.equal(frames.length, saved));
		assert.deepEqual(seqs(), upTo(saved));
		assert.equal(frames[0]?.header.t, '#labels');
		assert.ok(frames[0]?.body.labels[0]?.sig);
		assert.ok(reads.mock.calls.length > 3);
		reads.mockRestore();
		await label();
		await vi.waitFor(() => assert.deepEqual(seqs(), upTo(saved)));
		socket.close();
	});

	it('misses and repeats nothing saved during a replay', async () => {
		const { socket, frames, seqs } = await subscribe('?cursor=0');
		for (let i = 0; i < 40; i++) await label();
		await vi.waitFor(() => assert.ok(frames.length >= saved));
		await label();
		await vi.waitFor(() => assert.deepEqual(seqs(), upTo(saved)));
		socket.close();
	});

	// Subscribers check each signature over these fields, so the frames must not drift.
	it('sends the same bytes as the library, from history and live', async () => {
		const library = new LabelerServer({
			did: server.did,
			signingKey: randomBytes(32).toString('hex'),
			dbPath: join(dir, 'labels.db')
		});
		await new Promise<void>((resolve, reject) =>
			library.start({ host: '127.0.0.1', port: 0 }, (error) => (error ? reject(error) : resolve()))
		);
		await server.createLabel({
			uri: 'at://did:plc:a/app.bsky.feed.post/full',
			cid: 'bafyreiexample',
			val: 'x',
			neg: true,
			exp: '2030-01-01T00:00:00.000Z'
		});
		saved++;
		const { port } = library.app.server.address() as AddressInfo;
		const theirs = await subscribe(
			'?cursor=0',
			`ws://127.0.0.1:${port}/xrpc/com.atproto.label.subscribeLabels`
		);
		const ours = await subscribe('?cursor=0');
		await vi.waitFor(() => {
			assert.equal(theirs.raw.length, saved);
			assert.equal(ours.raw.length, saved);
		});
		assert.deepEqual(ours.raw, theirs.raw);

		const sent: Uint8Array[] = [];
		const emit = server['emitLabel'] as (seq: number, label: unknown) => void;
		server['emitLabel'] = (seq: number, value: unknown) => {
			emit(seq, value);
			const stub = new Map([[CHANNEL, [{ send: (bytes: Uint8Array) => sent.push(bytes) }]]]);
			LabelerServer.prototype['emitLabel'].call({ connections: stub }, seq, value as never);
		};
		await label();
		server['emitLabel'] = emit;
		await vi.waitFor(() => assert.equal(ours.raw.length, saved));
		assert.deepEqual(ours.raw.at(-1), new Uint8Array(sent[0] as Uint8Array));
		ours.socket.close();
		theirs.socket.close();
		await theirs.closed;
		await new Promise<void>((resolve) => library.close(resolve));
		library.db.close();
	});

	it('sends only new labels without a cursor', async () => {
		const { socket, seqs } = await subscribe('');
		await vi.waitFor(async () => {
			await label();
			assert.ok(seqs().length > 0);
		});
		assert.ok((seqs()[0] as number) > 1);
		socket.close();
	});

	it('refuses a cursor from the future, or not a number, without replaying', async () => {
		for (const [query, error] of [
			['?cursor=999999', 'FutureCursor'],
			['?cursor=abc', 'InvalidRequest']
		]) {
			const { frames, closed } = await subscribe(query as string);
			await closed;
			assert.deepEqual(
				frames.map(({ body }) => body.error),
				[error]
			);
		}
	});

	it('paces new labels, without repeating any a replay already covered', async () => {
		// Its own server: the routes keep the handler installed before they were registered.
		const slow = new LabelerServer({
			did: server.did,
			signingKey: randomBytes(32).toString('hex'),
			dbPath: join(dir, 'slow.db')
		});
		batchedReplay(slow, BATCH, 20);
		await new Promise<void>((resolve, reject) =>
			slow.start({ host: '127.0.0.1', port: 0 }, (error) => (error ? reject(error) : resolve()))
		);
		const { port } = slow.app.server.address() as AddressInfo;
		const address = `ws://127.0.0.1:${port}/xrpc/${CHANNEL}`;
		const live = await subscribe('', address);
		await vi.waitFor(() => assert.equal(slow['connections'].get(CHANNEL)?.size, 1));
		const started = Date.now();
		for (let i = 0; i < 6; i++)
			await slow.createLabel({ uri: `at://did:plc:a/app.bsky.feed.post/${i}`, val: 'x' });
		// Joins while most are still waiting to be announced.
		const late = await subscribe('?cursor=0', address);
		await vi.waitFor(() => assert.equal(live.frames.length, 6), { timeout: 3_000 });
		// Five gaps of 50 ms separate six labels.
		assert.ok(Date.now() - started >= 240);
		assert.deepEqual(late.seqs(), upTo(6));
		assert.deepEqual(live.seqs(), upTo(6));
		live.socket.close();
		late.socket.close();
		await Promise.all([live.closed, late.closed]);
		await new Promise<void>((resolve) => slow.close(resolve));
		slow.db.close();
	});

	it('stops reading once the subscriber leaves', async () => {
		const { socket, closed } = await subscribe('?cursor=0');
		socket.close();
		await closed;
		await new Promise((resolve) => setTimeout(resolve, 100));
		const reads = vi.spyOn(server.db, 'execute');
		await new Promise((resolve) => setTimeout(resolve, 100));
		assert.equal(reads.mock.calls.length, 0);
		reads.mockRestore();
	});
});
