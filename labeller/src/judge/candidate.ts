// Which records are worth a second opinion.
import type { Verdict } from '../detect/match.js';

/** Unlabelled only because a single ambiguous group matched. */
export function isCandidate(verdict: Verdict): boolean {
	return !verdict.matched && verdict.weak.length === 1;
}
