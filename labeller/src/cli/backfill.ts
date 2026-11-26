// Scans Bluesky's post archive into a queue of matches. Nothing is labelled or published.
// pnpm backfill [--minutes <n>]
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Jetstream } from '@bsky/jetstream';
import { databaseBytes, limitBytes } from '../backfill/budget.js';
import { backfillQueue } from '../backfill/queue.js';
import { scan, type Tally } from '../backfill/scan.js';
import { POST } from '../label/reconcile.js';

const SERVICE = 'https://jetstream.us-east.bsky.network';
const REPORT_MS = 10_000;

const { values } = parseArgs({
	args: process.argv.slice(2).filter((argument) => argument !== '--'),
	options: { minutes: { type: 'string' } }
});
const minutes = values.minutes === undefined ? undefined : Number(values.minutes);
if (minutes !== undefined && !(minutes > 0)) throw new Error('--minutes must be above zero.');

const required = (name: string): string => {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is not set. See .env.example.`);
	return value;
};
const apiKey = required('JETSTREAM_API_KEY');
const own = required('LABELER_DID');
const dataDir = process.env.DATA_DIR || fileURLToPath(new URL('../../../data', import.meta.url));
const path = process.env.BACKFILL_DB || join(dataDir, 'backfill.db');
mkdirSync(dirname(path), { recursive: true });
// The label database counts too, since publishing the queue is what will grow it.
const limit = limitBytes(process.env.BACKFILL_MAX_GIB);
const used = () => databaseBytes([path, join(dataDir, 'labels.db')]);
const full = () => used() >= limit;
if (full()) throw new Error('The databases already fill BACKFILL_MAX_GIB. Nothing was scanned.');

let bytes = 0;
/** Records the archive client could not read. */
let skipped = 0;
const counted: typeof fetch = async (input, init) => {
	const response = await fetch(input, init);
	if (!response.body) return response;
	const meter = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			bytes += chunk.byteLength;
			controller.enqueue(chunk);
		}
	});
	return new Response(response.body.pipeThrough(meter), response);
};

const stop = new AbortController();
process.once('SIGINT', () => stop.abort());
process.once('SIGTERM', () => stop.abort());
if (minutes) setTimeout(() => stop.abort(), minutes * 60_000).unref();

const queue = backfillQueue(path);
const from = queue.cursor();
const started = Date.now();
let reported = 0;
const describe = ({ events, posts, matched, seq, time }: Tally) =>
	`${events} events, ${posts} posts, ${matched} matches, ${queue.size()} queued, ${skipped} skipped, ` +
	`${(bytes / 1e6).toFixed(1)} MB, ${Math.round(posts / ((Date.now() - started) / 1000))} posts/s, ` +
	`${(used() / 1024 ** 2).toFixed(1)} MiB on disk, at ${seq}${time ? ` (${time})` : ''}`;

console.log(`Scanning from ${from} into ${path}`);
const jetstream = new Jetstream({ service: SERVICE, apiKey, fetchImpl: counted });
const source = jetstream.snapshot({
	collections: [POST],
	kinds: ['commit', 'account'],
	afterSeq: from,
	signal: stop.signal,
	// Other messages can quote a record, and post text stays out of logs.
	onError: (error) => {
		if (error.name === 'DownloadError') console.warn(error.name, error.message);
		else skipped++;
	}
});

try {
	const tally = await scan(source, queue, {
		own,
		full,
		report: (progress) => {
			if (Date.now() - reported < REPORT_MS) return;
			reported = Date.now();
			console.log(describe(progress));
		}
	});
	const ending = full()
		? 'Stopped at the disk limit'
		: stop.signal.aborted
			? 'Stopped'
			: 'Reached the end';
	console.log(`${ending}: ${describe(tally)}`);
} catch (error) {
	if (!stop.signal.aborted) throw error;
	console.log(`Stopped at ${queue.cursor()}: ${queue.size()} queued, ${bytes} bytes.`);
} finally {
	queue.close();
}
