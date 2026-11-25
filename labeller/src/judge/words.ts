// Turns text into the context words the judge learns from.
import { WEAK } from '../detect/lexicon.js';
import { variants } from '../detect/normalise.js';

/** Words that say nothing about the subject. */
const STOPWORDS = new Set(
	(
		'a about after again all also am an and any are as at be because been before being but by can ' +
		'did do does for from get got had has have he her here him his how i if in into is it its ' +
		'just like me more most my no not of off on one only or other our out over own she so some ' +
		'such than that the their them then there these they this those to too up us very was we ' +
		'were what when where which while who why will with would you your'
	).split(' ')
);

const ambiguous = new RegExp(
	`(?<![\\p{L}\\p{N}])(?:${Object.values(WEAK).join('|')})(?![\\p{L}\\p{N}])`,
	'gu'
);

const ambiguousOnce = new RegExp(ambiguous.source, 'u');

/**
 * The sentences that hold an ambiguous term. Words scattered across a long article say
 * little about how the term is used, so the rest is ignored.
 */
export function ambiguousSentences(segments: readonly string[]): string[] {
	return segments
		.flatMap((segment) => segment.split(/(?<=[.!?…])\s+|\n+|\s\|\s/u))
		.filter((sentence) => variants(sentence).some((reading) => ambiguousOnce.test(reading)));
}

/**
 * The ambiguous terms themselves are removed, so the judge has to decide from what
 * surrounds them.
 */
export function contextWords(segments: readonly string[]): string[] {
	return segments.flatMap((segment) => {
		const [folded = ''] = variants(segment);
		const words = folded.replace(ambiguous, ' ').match(/\p{L}+(?:'\p{L}+)*/gu) ?? [];
		return words.filter((word) => word.length > 1 && !STOPWORDS.has(word));
	});
}
