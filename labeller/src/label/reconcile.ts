import { detect, type Verdict } from '../detect/match.js';
import { postText, profileText } from '../detect/record.js';
import { LABEL } from './definition.js';

export const POST = 'app.bsky.feed.post';
export const PROFILE = 'app.bsky.actor.profile';
export const COLLECTIONS = [POST, PROFILE];

export interface Change {
	did: string;
	collection: string;
	rkey: string;
	operation: 'create' | 'update' | 'delete';
	cid?: string;
	record?: unknown;
}

/** A second opinion on records the word list leaves unlabelled. */
export type Judge = (
	segments: readonly string[],
	verdict: Verdict
) => { matched: boolean; probability: number } | undefined;

export interface LabelStore {
	/** The label currently in force on a subject, if any. */
	active(uri: string): Promise<{ cid?: string } | undefined>;
	apply(uri: string, cid: string | undefined): Promise<void>;
	negate(uri: string, cid: string | undefined): Promise<void>;
}

export type Outcome =
	| { action: 'labelled'; uri: string; verdict: Verdict }
	| { action: 'negated'; uri: string }
	/** The judge would have labelled this. Nothing was written. */
	| { action: 'suggested'; uri: string; probability: number }
	| undefined;

/**
 * Brings the labels on one record in line with its latest content. Records belonging to
 * `exempt`, the labeller's own account, are never judged: it has to name what it labels.
 */
export async function reconcile(
	change: Change,
	store: LabelStore,
	exempt?: string,
	judge?: Judge
): Promise<Outcome> {
	const { did, collection, rkey, operation, cid, record } = change;
	const extract =
		collection === POST
			? postText
			: collection === PROFILE && rkey === 'self'
				? profileText
				: undefined;
	if (!extract || did === exempt) return;

	const uri = `at://${did}/${collection}/${rkey}`;
	const segments = operation === 'delete' ? [] : extract(record);
	const verdict = operation === 'delete' ? undefined : detect(segments);

	if (verdict?.matched) {
		const current = await store.active(uri);
		if (current && current.cid === cid) return;
		await store.apply(uri, cid);
		return { action: 'labelled', uri, verdict };
	}

	// A brand new record that does not match cannot have a label to withdraw.
	if (operation !== 'create') {
		const current = await store.active(uri);
		if (current) {
			await store.negate(uri, current.cid);
			return { action: 'negated', uri };
		}
	}
	return verdict && judge ? suggest(judge, uri, segments, verdict) : undefined;
}

/** The judge is advisory, so its failure must never stop the labeller. */
function suggest(
	judge: Judge,
	uri: string,
	segments: readonly string[],
	verdict: Verdict
): Outcome {
	try {
		const opinion = judge(segments, verdict);
		if (opinion?.matched) return { action: 'suggested', uri, probability: opinion.probability };
	} catch (error) {
		console.warn('The judge failed:', error);
	}
	return;
}
