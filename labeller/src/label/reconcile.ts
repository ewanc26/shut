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

export interface LabelStore {
	/** The label currently in force on a subject, if any. */
	active(uri: string): Promise<{ cid?: string } | undefined>;
	apply(uri: string, cid: string | undefined): Promise<void>;
	negate(uri: string, cid: string | undefined): Promise<void>;
}

export type Outcome =
	| { action: 'labelled'; uri: string; verdict: Verdict }
	| { action: 'negated'; uri: string }
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
	const verdict = operation === 'delete' ? undefined : detect(extract(record));

	if (verdict?.matched) {
		const current = await store.active(uri);
		if (current && current.cid === cid) return;
		await store.apply(uri, cid);
		return { action: 'labelled', uri, verdict };
	}

	// A brand new record that does not match cannot have a label to withdraw.
	if (operation === 'create') return;
	const current = await store.active(uri);
	if (!current) return;
	await store.negate(uri, current.cid);
	return { action: 'negated', uri };
}
