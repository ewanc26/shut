import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Jetstream } from '@skyware/jetstream';
import { LabelerServer } from '@skyware/labeler';
import { handOff } from '../judge/handoff.js';
import { openHost } from '../judge/host.js';
import { askModel, type Model } from '../judge/model.js';
import { shadowJudge } from '../judge/shadow.js';
import { type Change, COLLECTIONS, POST, PROFILE, reconcile } from '../label/reconcile.js';
import { checkedProfiles, serverStore } from '../label/store.js';
import { INTERVAL_MS, profileLookup } from '../profile/lookup.js';
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

// Started beside the labeller: records arriving before it is ready go unjudged.
let judge: ReturnType<typeof shadowJudge> | undefined;

async function startJudge({ model, dailyLimit }: { model: Model; dailyLimit: number }) {
	try {
		const host = await openHost(join(config.dataDir, 'opencode'), model);
		judge = shadowJudge({
			ask: (segments, signal) => askModel(host.generate, segments, signal),
			dailyLimit
		});
		console.log(`Judge ready: ${model}`);
	} catch (error) {
		console.warn('The judge is off, OpenCode did not start:', (error as Error).message);
	}
}
if (config.judge) void startJudge(config.judge);

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

// Changes are handled one at a time so the saved cursor never passes unfinished work.
let queue = Promise.resolve();
let failed = false;

function enqueue(work: () => Promise<void>) {
	queue = queue.then(async () => {
		if (failed) return;
		try {
			await work();
		} catch (error) {
			// Exit without advancing, so the supervisor restarts us at this event.
			failed = true;
			console.error('Could not process an event:', error);
			void shutdown(1);
		}
	});
}

async function apply(change: Change) {
	const outcome = await reconcile(change, store, config.did);
	if (outcome?.applied.length && outcome.verdict) {
		const { strong, weak, template } = outcome.verdict;
		console.log(
			`labelled ${outcome.uri} ${outcome.applied.join(', ')} [${[...strong, ...weak, ...template].join(', ')}]`
		);
	}
	if (outcome?.negated.length) {
		console.log(`negated ${outcome.uri} ${outcome.negated.join(', ')}`);
	}
	return outcome;
}

const checked = await checkedProfiles(server);
const lookup = config.profileCheck
	? profileLookup({
			checked,
			exempt: config.did,
			// Not sent to the judge: there are far more of these than its allowance covers.
			deliver: (did, profile) =>
				enqueue(async () => {
					if (profile) {
						await apply({
							did,
							collection: PROFILE,
							rkey: 'self',
							operation: 'update',
							record: profile
						});
					}
					await checked.add(did);
				})
		})
	: undefined;
const looker = lookup && setInterval(() => void lookup.run(), INTERVAL_MS);

jetstream.on('commit', (event) => {
	const { commit, did } = event;
	const profile = commit.collection === PROFILE && commit.rkey === 'self';
	// Before queueing, so a fetch under way cannot deliver an older version afterwards.
	if (profile) lookup?.supersede(did);
	enqueue(async () => {
		const outcome = await apply({
			did,
			collection: commit.collection,
			rkey: commit.rkey,
			operation: commit.operation,
			...(commit.operation === 'delete' ? {} : { cid: commit.cid, record: commit.record })
		});
		// Not awaited: a slow or failing model must not hold up the queue.
		const uri = `at://${did}/${commit.collection}/${commit.rkey}`;
		if (judge) handOff(judge, uri, outcome);
		if (profile) await checked.add(did);
		if (commit.collection === POST && commit.operation === 'create') lookup?.want(did);
		processed = event.time_us;
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
	clearInterval(looker);
	judge?.close();
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
