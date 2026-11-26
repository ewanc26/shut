// Words from a post, with the word list's terms removed, so the model learns from the context
// around them rather than relearning the list.
import { STRONG, WEAK } from '../detect/lexicon.js';
import { variants } from '../detect/normalise.js';

const terms = new RegExp(
	`(?<![\\p{L}\\p{N}])(?:${[...STRONG.map(({ pattern }) => pattern), ...Object.values(WEAK)]
		.map((pattern) => `(?:${pattern})`)
		.join('|')})(?![\\p{L}\\p{N}])`,
	'gu'
);

/** Distinct context words for one post. Text is not kept; only these words are returned. */
export function features(segments: readonly string[]): string[] {
	const words = segments.flatMap((segment) => {
		const [folded = ''] = variants(segment);
		return folded.replace(terms, ' ').match(/\p{L}{2,}/gu) ?? [];
	});
	return [...new Set(words)];
}
