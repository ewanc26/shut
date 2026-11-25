// Words from a post, with the ambiguous terms removed, so the model learns from the context around them.
import { WEAK } from '../detect/lexicon.js';
import { variants } from '../detect/normalise.js';

const ambiguous = new RegExp(
	`(?<![\\p{L}\\p{N}])(?:${Object.values(WEAK).join('|')})(?![\\p{L}\\p{N}])`,
	'gu'
);

/** Distinct context words for one post. Text is not kept; only these words are returned. */
export function features(segments: readonly string[]): string[] {
	const words = segments.flatMap((segment) => {
		const [folded = ''] = variants(segment);
		return folded.replace(ambiguous, ' ').match(/\p{L}{2,}/gu) ?? [];
	});
	return [...new Set(words)];
}
