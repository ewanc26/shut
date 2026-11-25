import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Jetstream } from '@skyware/jetstream';
import { LabelerServer } from '@skyware/labeler';
import { COLLECTIONS, reconcile } from '../label/reconcile.js';
import { serverStore } from '../label/store.js';
import { loadCursor, saveCursor } from '../stream/cursor.js';
import { readConfig } from './config.js';

/** Replayed after a restart. Reprocessing is harmless, gaps are not. */
const REWIND_MICROSECONDS = 5_000_000;
const SAVE_INTERVAL_MS = 5_000;

const config = readConfig();
mkdirSync(config.dataDir, { recursive: true });
const cursorPath = join(config.dataDir, 'cursor');

const server = new LabelerServer({
	did: config.did,
	signingKey: config.signingKey,
	dbPath: join(config.dataDir, 'labels.db')
});
const store = await serverStore(server);

await new Promise<void>((resolve, reject) => {
	server.start({ host: config.host, port: config.port }, (error, address) => {
		if (error) return reject(error);
		console.log(`Labeller listening on ${address}`);
		resolve();
	});
});

let processed = loadCursor(cursorPath);
const jetstream = new Jetstream({
	wantedCollections: COLLECTIONS,
	...(config.jetstreamUrl ? { endpoint: config.jetstreamUrl } : {}),
	...(processed ? { cursor: processed - REWIND_MICROSECONDS } : {})
});

// Events are handled one at a time so the saved cursor never passes unfinished work.
let queue = Promise.resolve();
let failed = false;

jetstream.on('commit', (event) => {
	queue = queue.then(async () => {
		if (failed) return;
		try {
			const { commit } = event;
			const outcome = await reconcile(
				{
					did: event.did,
					collection: commit.collection,
					rkey: commit.rkey,
					operation: commit.operation,
					...(commit.operation === 'delete' ? {} : { cid: commit.cid, record: commit.record })
				},
				store,
				config.did
			);
			if (outcome?.action === 'labelled') {
				const { strong, weak } = outcome.verdict;
				console.log(`labelled ${outcome.uri} [${[...strong, ...weak].join(', ')}]`);
			} else if (outcome) {
				console.log(`negated ${outcome.uri}`);
			}
			processed = event.time_us;
		} catch (error) {
			// Exit without advancing, so the supervisor restarts us at this event.
			failed = true;
			console.error('Could not process an event:', error);
			void shutdown(1);
		}
	});
});
jetstream.on('open', () => console.log('Connected to Jetstream'));
jetstream.on('close', () => console.warn('Jetstream connection closed'));
jetstream.on('error', (error) => console.error('Jetstream error:', error?.message ?? error));

const save = () => {
	if (processed) saveCursor(cursorPath, processed);
};
const saver = setInterval(save, SAVE_INTERVAL_MS);

let stopping = false;
async function shutdown(code: number) {
	if (stopping) return;
	stopping = true;
	clearInterval(saver);
	jetstream.close();
	// Called from inside the queue on failure, so let that task finish first.
	await new Promise(setImmediate);
	await queue;
	save();
	// Open subscriber sockets would otherwise keep the server from closing.
	setTimeout(() => process.exit(code), 2_000).unref();
	server.close(() => process.exit(code));
}
process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));

jetstream.start();
