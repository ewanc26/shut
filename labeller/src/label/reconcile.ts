import { detect, type Verdict } from '../detect/match.js';
import { postText, profileText } from '../detect/record.js';
import { isCandidate } from '../judge/candidate.js';
import {
	INFLUENCED_LABEL,
	LABEL,
	LABELS,
	type Label,
	PROFILE_INFLUENCED_LABEL,
	PROFILE_LABEL
} from './definition.js';

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

export interface LabelStore {
	/** The given label currently in force on a subject, if any. */
	active(uri: string, label: Label): Promise<{ cid?: string } | undefined>;
	apply(uri: string, cid: string | undefined, label: Label): Promise<void>;
	negate(uri: string, cid: string | undefined, label: Label): Promise<void>;
}

/** What was written for one record. Undefined when nothing was written and nothing is unsure. */
export type Outcome =
	| {
			uri: string;
			/** Undefined for a deletion. */
			verdict?: Verdict;
			/** Labels newly applied, or applied again to a new version. */
			applied: Label[];
			/** Labels withdrawn. */
			negated: Label[];
			/**
			 * Set when the explicit label was left off on one ambiguous group, which is worth a
			 * second opinion. The influenced label may still have been applied.
			 */
			ambiguous?: string[];
	  }
	| undefined;

/**
 * Brings the labels on one record in line with its latest content. Records belonging to
 * `exempt`, the labeller's own account, are never judged: it has to name what it labels.
 */
export async function reconcile(
	change: Change,
	store: LabelStore,
	exempt?: string
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
	// Posts and profiles have labels of their own. Every label is still checked on both, so a
	// profile labelled before it had its own label loses the post labels when next seen.
	const post = collection === POST;
	const wanted: Record<Label, boolean> = {
		[LABEL]: post && (verdict?.matched ?? false),
		[INFLUENCED_LABEL]: post && (verdict?.strict ?? false),
		[PROFILE_LABEL]: !post && (verdict?.matched ?? false),
		[PROFILE_INFLUENCED_LABEL]: !post && (verdict?.strict ?? false)
	};

	const applied: Label[] = [];
	const negated: Label[] = [];
	for (const label of LABELS) {
		if (wanted[label]) {
			const current = await store.active(uri, label);
			if (current && current.cid === cid) continue;
			await store.apply(uri, cid, label);
			applied.push(label);
		} else if (operation !== 'create') {
			// A brand new record cannot have a label to withdraw.
			const current = await store.active(uri, label);
			if (!current) continue;
			await store.negate(uri, current.cid, label);
			negated.push(label);
		}
	}

	// A record whose explicit label was just withdrawn is not sent for an opinion.
	const ambiguous =
		verdict && isCandidate(verdict) && !negated.includes(post ? LABEL : PROFILE_LABEL);
	if (!applied.length && !negated.length && !ambiguous) return;
	return { uri, verdict, applied, negated, ...(ambiguous ? { ambiguous: segments } : {}) };
}
