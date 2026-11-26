import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Jetstream } from '@skyware/jetstream';
import { LabelerServer } from '@skyware/labeler';
import { postText } from '../detect/record.js';
import { handOff } from '../judge/handoff.js';
import { describeLearner, learner, loadCounts, saveCounts } from '../judge/learner.js';
import { askModel } from '../judge/model.js';
import { openBackends } from '../judge/open.js';
import { shadowJudge } from '../judge/shadow.js';
import { batchedReplay } from '../label/replay.js';
import { type Change, COLLECTIONS, POST, PROFILE, reconcile } from '../label/reconcile.js';
import { checkedProfiles, serverStore } from '../label/store.js';
import { INTERVAL_MS, profileLookup } from '../profile/lookup.js';
import { pauseReason } from '../schedule/advice.js';
import { gate } from '../schedule/gate.js';
import { loadCursor, saveCursor } from '../stream/cursor.js';
import { readConfig, type Config } from './config.js';

/** Replayed after a restart. Reprocessing is harmless, gaps are not. */
const REWIND_MICROSECONDS = 5_000_000;
const SAVE_INTERVAL_MS = 5_000;
const SCHEDULE_CHECK_MS = 10_000;
const LEARNER_SAVE_MS = 10 * 60_000;

const config = readConfig();
mkdirSync(config.dataDir, { recursive: true });
const cursorPath = join(config.dataDir, 'cursor');

const server = new LabelerServer({
	did: config.did,
	signingKey: config.signingKey,
	dbPath: join(config.dataDir, 'labels.db')
});
// Straight away: the server registers its routes just after it is created.
batchedReplay(server);
const store = await serverStore(server);

// Started beside the labeller: records arriving before it is ready go unjudged.
let judge: ReturnType<typeof shadowJudge> | undefined;
/** Whether the stream, profile lookups and judge are stopped. The server stays up. */
let paused = false;

async function startJudge({ backends, dailyLimit }: NonNullable<Config['judge']>) {
	try {
		const host = await openBackends(backends, join(config.dataDir, 'opencode'));
		judge = shadowJudge({
			ask: (segments, signal) => askModel(host.generate, segments, signal),
			dailyLimit,
			timeoutMs: host.timeoutMs
		});
		if (paused) judge.hold();
	} catch (error) {
		console.warn('The judge is off, it did not start:', (error as Error).message);
	}
}
if (config.judge) void startJudge(config.judge);

const countsPath = join(config.dataDir, 'judge-counts.json');
const student = config.learner ? learner(loadCounts(countsPath)) : undefined;

/** Keeps what was learned. A failure here must not stop labelling. */
function saveLearning() {
	if (!student) return;
	try {
		saveCounts(countsPath, student.counts);
		console.log(describeLearner(student));
	} catch (error) {
		console.warn('learner: could not save:', (error as Error).message);
	}
}
const learnerSaver = student && setInterval(saveLearning, LEARNER_SAVE_MS);

await new Promise<void>((resolve, reject) => {
	server.start({ host: config.host, port: config.port }, (error, address) => {
		if (error) return reject(error);
		console.log(`Labeller listening on ${address}`);
		resolve();
	});
});

let processed = loadCursor(cursorPath);
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
let looker: ReturnType<typeof setInterval> | undefined;
let jetstream: Jetstream | undefined;

/** Starts reading the stream from just before the last event handled. */
function connect() {
	const source = new Jetstream({
		wantedCollections: COLLECTIONS,
		...(config.jetstreamUrl ? { endpoint: config.jetstreamUrl } : {}),
		...(processed ? { cursor: processed - REWIND_MICROSECONDS } : {})
	});
	jetstream = source;
	looker = lookup && setInterval(() => void lookup.run(), INTERVAL_MS);
	follow(source);
	source.start();
}

function disconnect() {
	clearInterval(looker);
	jetstream?.close();
	jetstream = undefined;
}

function follow(source: Jetstream) {
	source.on('commit', (event) => {
		// A closed connection can still deliver; those events are read again on resuming.
		if (source !== jetstream) return;
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
			if (student && commit.collection === POST && commit.operation === 'create') {
				// Its opinion first, so a post is never judged by what it has just taught.
				if (outcome?.ambiguous && student.opinion(outcome.ambiguous))
					console.log(`learner would label ${uri}`);
				if (did !== config.did) student.learn(postText(commit.record));
			}
			if (profile) await checked.add(did);
			if (commit.collection === POST && commit.operation === 'create') lookup?.want(did);
			processed = event.time_us;
		});
	});
	source.on('open', () => console.log('Connected to Jetstream'));
	source.on('close', () => console.warn('Jetstream connection closed'));
	source.on('error', (error) => console.error('Jetstream error:', error?.message ?? error));
}

const save = () => {
	if (processed) saveCursor(cursorPath, processed);
};
const saver = setInterval(save, SAVE_INTERVAL_MS);

let stopping = false;
const shouldPause = config.schedule && gate(config.schedule.maxDelayMs);

/** Follows the monitor's advice, within the longest delay allowed. */
function schedule() {
	if (stopping || !config.schedule || !shouldPause) return;
	const reason = pauseReason(config.schedule.file);
	const lag = processed ? Date.now() - processed / 1000 : undefined;
	const next = shouldPause(reason !== undefined, lag);
	if (next === paused) return;
	paused = next;
	if (paused) {
		console.log(`Paused: ${reason}`);
		disconnect();
		judge?.hold();
		// Saved once the events already read are handled.
		void queue.then(save);
	} else {
		console.log(reason ? `Catching up despite: ${reason}` : 'Resumed');
		connect();
		judge?.resume();
	}
}

async function shutdown(code: number) {
	if (stopping) return;
	stopping = true;
	clearInterval(saver);
	clearInterval(scheduler);
	clearInterval(learnerSaver);
	judge?.close();
	disconnect();
	// Called from inside the queue on failure, so let that task finish first.
	await new Promise(setImmediate);
	await queue;
	save();
	saveLearning();
	// Open subscriber sockets would otherwise keep the server from closing.
	setTimeout(() => process.exit(code), 2_000).unref();
	server.close(() => process.exit(code));
}
process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));

connect();
// Straight away, so a restart while the machine is busy pauses at once.
schedule();
const scheduler = config.schedule && setInterval(schedule, SCHEDULE_CHECK_MS);
