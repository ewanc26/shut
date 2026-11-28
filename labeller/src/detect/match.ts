import { HOMONYMS, STRONG, TEMPLATE, WEAK } from './lexicon.js';
import { variants } from './normalise.js';

/** Number of different weak groups needed when there is no strong hit. */
export const WEAK_THRESHOLD = 2;

/** Number of weak groups needed for the influenced labels when there is no strong or template hit. */
export const STRICT_WEAK_THRESHOLD = 1;

export interface Verdict {
	/** Earns the standard label. */
	matched: boolean;
	/** Earns the incel influenced language labels. Always true when `matched` is. */
	strict: boolean;
	/** Ids of the strong rules that hit. */
	strong: string[];
	/** Names of the weak groups that hit. */
	weak: string[];
	/** Ids of the template rules that hit. These count only towards `strict`. */
	template: string[];
}

const wholeWord = (source: string) =>
	new RegExp(`(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`, 'u');

const strongRules = STRONG.map(({ id, pattern }) => [id, wholeWord(pattern)] as const);
const templateRules = TEMPLATE.map(({ id, pattern }) => [id, wholeWord(pattern)] as const);
const weakRules = Object.entries(WEAK).map(
	([group, pattern]) => [group, wholeWord(pattern)] as const
);

function withoutHomonyms(segments: readonly string[]): string[] {
	// Context can sit in a different part of the record, such as a link card.
	const whole = segments.join('\n');
	const active = HOMONYMS.filter(({ when }) => !when || when.test(whole));
	return segments.map((segment) =>
		active.reduce((text, { remove }) => text.replace(remove, ' '), segment)
	);
}

/** Judges the pieces of text belonging to one record. */
export function detect(segments: readonly string[]): Verdict {
	const readings = withoutHomonyms(segments).flatMap(variants);
	const hits = (rules: typeof strongRules) =>
		rules.filter(([, regex]) => readings.some((text) => regex.test(text))).map(([name]) => name);

	const strong = hits(strongRules);
	const weak = hits(weakRules);
	const template = hits(templateRules);
	return {
		matched: strong.length > 0 || weak.length >= WEAK_THRESHOLD,
		strict: strong.length > 0 || template.length > 0 || weak.length >= STRICT_WEAK_THRESHOLD,
		strong,
		weak,
		template
	};
}
