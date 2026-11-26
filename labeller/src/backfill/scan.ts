// Reads archived posts and queues the ones that earn the standard label. It labels nothing.
import { detect } from '../detect/match.js';
import { postText } from '../detect/record.js';
import { POST } from '../label/reconcile.js';
import type { BackfillQueue, Step } from './queue.js';

/** Events read between writes. */
export const BATCH_SIZE = 5_000;

/** The parts of an archive event the scan reads. */
export interface ArchiveEvent {
	seq: number;
	did: string;
	time?: string;
	kind: string;
	commit?: {
		operation: string;
		collection: string;
		rkey: string;
		cid?: string;
		record?: unknown;
	};
	account?: { active: boolean; status?: string };
}

export interface Tally {
	events: number;
	posts: number;
	matched: number;
	/** Position and time of the last event read. */
	seq: number;
	time: string | undefined;
}

function step({ did, seq, commit, account }: ArchiveEvent, own: string): Step | undefined {
	// A deactivated account can come back, so only deletion drops its posts.
	if (account) return account.status === 'deleted' ? { forget: did } : undefined;
	if (!commit || commit.collection !== POST || did === own) return;
	const uri = `at://${did}/${POST}/${commit.rkey}`;
	if (commit.operation === 'delete') return { remove: uri };
	if (detect(postText(commit.record)).matched) {
		// Read only now: the archive client computes a version's hash when first asked.
		const { cid } = commit;
		return cid ? { save: { uri, did, cid, seq } } : undefined;
	}
	// A new post that does not match was never queued.
	return commit.operation === 'update' ? { remove: uri } : undefined;
}

/**
 * Applies events to the queue until the source ends. Whatever was read is written even if
 * the source then fails, so a rerun carries on from there.
 */
export async function scan(
	source: AsyncIterable<ArchiveEvent>,
	queue: BackfillQueue,
	{
		own,
		batchSize = BATCH_SIZE,
		report,
		full
	}: {
		own: string;
		batchSize?: number;
		report?: (tally: Tally) => void;
		/** Asked after each write. The scan ends once it answers true. */
		full?: () => boolean;
	}
): Promise<Tally> {
	const tally: Tally = { events: 0, posts: 0, matched: 0, seq: queue.cursor(), time: undefined };
	let steps: Step[] = [];
	let unwritten = 0;
	const write = () => {
		if (!unwritten) return;
		queue.write(steps, tally.seq);
		steps = [];
		unwritten = 0;
		report?.(tally);
	};

	try {
		for await (const event of source) {
			const next = step(event, own);
			if (next) steps.push(next);
			tally.events++;
			if (event.commit?.collection === POST && event.commit.operation !== 'delete') tally.posts++;
			if (next && 'save' in next) tally.matched++;
			tally.seq = event.seq;
			tally.time = event.time;
			if (++unwritten >= batchSize) {
				write();
				if (full?.()) break;
			}
		}
	} finally {
		write();
	}
	return tally;
}
