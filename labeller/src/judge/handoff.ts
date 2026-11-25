// Tells the judge what the labeller decided about a record.
import type { Outcome } from '../label/reconcile.js';
import type { shadowJudge } from './shadow.js';

type Judge = Pick<ReturnType<typeof shadowJudge>, 'offer' | 'forget'>;

/**
 * Only an ambiguous record is asked about. Anything else leaves the queue, so a record that
 * was deleted or settled is never sent later.
 */
export function handOff(judge: Judge, uri: string, outcome: Outcome): void {
	if (outcome?.action === 'ambiguous') judge.offer(uri, outcome.segments);
	else judge.forget(uri);
}
