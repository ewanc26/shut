// Scans Bluesky's post archive into a queue of matches. Nothing is labelled or published.
// pnpm backfill [--minutes <n>]
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Jetstream } from '@bsky/jetstream';
import { databaseBytes, limitBytes } from '../backfill/budget.js';
import { backfillQueue } from '../backfill/queue.js';
import { scan, type Tally } from '../backfill/scan.js';
import { limitedFetch } from '../http/rate_limit.js';
import { POST } from '../label/reconcile.js';
import { pauseReason } from '../schedule/advice.js';

const SERVICE = 'https://jetstream.us-east.bsky.network';
const REPORT_MS = 10_000;
const SCHEDULE_CHECK_MS = 10_000;

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
// No timeout: segments are large, and the archive client does its own retrying.
const limited = limitedFetch();
const counted: typeof fetch = async (input, init) => {
	const response = await limited(input, init);
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

/** Why the monitor says to wait, if it does. The archive waits too, so no delay limit. */
const busy = () => {
	const file = process.env.SCHEDULE_FILE?.trim();
	return file ? pauseReason(file) : undefined;
};

console.log(`Scanning from ${from} into ${path}`);
const jetstream = new Jetstream({ service: SERVICE, apiKey, fetchImpl: counted });

/** Scans until the end, a stop, or advice to pause. Answers whether it paused. */
async function pass(): Promise<boolean> {
	const pause = new AbortController();
	const watch = setInterval(() => {
		const reason = busy();
		if (reason === undefined || pause.signal.aborted) return;
		console.log(`Pausing: ${reason}`);
		pause.abort();
	}, SCHEDULE_CHECK_MS);
	const signal = AbortSignal.any([stop.signal, pause.signal]);
	const source = jetstream.snapshot({
		collections: [POST],
		kinds: ['commit', 'account'],
		afterSeq: queue.cursor(),
		signal,
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
		if (pause.signal.aborted && !stop.signal.aborted) return true;
		const ending = full()
			? 'Stopped at the disk limit'
			: stop.signal.aborted
				? 'Stopped'
				: 'Reached the end';
		console.log(`${ending}: ${describe(tally)}`);
	} catch (error) {
		if (!signal.aborted) throw error;
		if (!stop.signal.aborted) return true;
		console.log(`Stopped at ${queue.cursor()}: ${queue.size()} queued, ${bytes} bytes.`);
	} finally {
		clearInterval(watch);
	}
	return false;
}

try {
	do {
		const reason = busy();
		if (reason !== undefined) console.log(`Waiting: ${reason}`);
		while (busy() !== undefined && !stop.signal.aborted)
			await wait(SCHEDULE_CHECK_MS, undefined, { signal: stop.signal }).catch(() => {});
		if (stop.signal.aborted) break;
		if (reason !== undefined) console.log(`Resuming from ${queue.cursor()}`);
	} while (await pass());
} finally {
	queue.close();
}
