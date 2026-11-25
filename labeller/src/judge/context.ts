// A second opinion on records the word list cannot decide: exactly one ambiguous group.
import type { Verdict } from '../detect/match.js';
import { estimate, train } from './bayes.js';
import { INCEL, ORDINARY } from './corpus.js';
import { ambiguousSentences, contextWords } from './words.js';

/** Deliberately high: a missed post costs less than a wrong label. */
export const THRESHOLD = 0.95;
/** With fewer recognised words than this the judge abstains. */
export const MINIMUM_KNOWN = 3;

/**
 * The community's subject is who is judged attractive and gets partners. A record has to
 * mention people of a sex and either looks or dating before the model is asked at all.
 */
const PEOPLE = new Set(
	'women woman girl girls female females men man guy guys male males virgin virgins girlfriend'.split(
		' '
	)
);
const SUBJECT = new Set(
	(
		'ugly looks height short tall face jaw chin frame genetics bone attractive handsome ' +
		'dating date dates girlfriend virgin swipe matches rejected rejects lonely'
	).split(' ')
);

function onSubject(words: readonly string[]): boolean {
	const people = new Set(words.filter((word) => PEOPLE.has(word)));
	const subject = new Set(words.filter((word) => SUBJECT.has(word)));
	// "girlfriend" and "virgin" are in both lists, so one of them alone is not enough.
	return people.size > 0 && subject.size > 0 && new Set([...people, ...subject]).size > 1;
}

const model = train(
	INCEL.map((line) => contextWords([line])),
	ORDINARY.map((line) => contextWords([line]))
);

export interface Opinion {
	/** True when the context reads like incel usage. */
	matched: boolean;
	probability: number;
}

/**
 * Returns undefined when the judge has no say: the word list already decided, nothing
 * ambiguous was found, or there is too little recognised context.
 */
export function secondOpinion(segments: readonly string[], verdict: Verdict): Opinion | undefined {
	if (verdict.matched || verdict.weak.length !== 1) return;
	const words = contextWords(ambiguousSentences(segments));
	if (!onSubject(words)) return;
	const { probability, known } = estimate(model, words);
	if (known < MINIMUM_KNOWN) return;
	return { matched: probability >= THRESHOLD, probability };
}
