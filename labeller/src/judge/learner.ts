// A small naive Bayes judge that learns from the stream as it goes. The word list teaches it:
// a post the list labels is `pos`, a post with no hit at all is `neg`. It therefore learns what
// the list's choices look like apart from the terms themselves, and is no wiser than the list.
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { detect } from '../detect/match.js';
import {
	add,
	emptyCounts,
	MIN_POSTS,
	parse,
	serialise,
	trim,
	weight,
	type Counts
} from './counts.js';
import { features } from './features.js';

/** Posts needed of each kind before it gives an opinion. */
export const MIN_DOCS = 500;
/** The score at which it says a post reads like incel language: odds of nine to one. */
export const SURE = Math.log(9);
/** The most words held in memory. */
export const MAX_WORDS = 100_000;

/** How the opinion given before learning each post compared with the word list. */
export interface Check {
	/** Posts the list labelled, and how many of them the learner flagged too. */
	labelled: number;
	caught: number;
	/** Posts with no hit, and how many of them the learner flagged anyway. */
	clean: number;
	flagged: number;
}

export function learner(counts: Counts = emptyCounts(), minDocs = MIN_DOCS) {
	const check: Check = { labelled: 0, caught: 0, clean: 0, flagged: 0 };
	const ready = () => counts.docs.pos >= minDocs && counts.docs.neg >= minDocs;

	function score(words: readonly string[]): number {
		let total = 0;
		for (const word of words) {
			const tally = counts.words.get(word);
			// Rarer words are not saved, so they are not relied on either.
			if (tally && tally.pos + tally.neg >= MIN_POSTS) total += weight(counts, tally);
		}
		return total;
	}

	return {
		counts,
		ready,
		check: (): Readonly<Check> => check,
		/** Takes in one new post. */
		learn(segments: readonly string[]): void {
			const { matched, strict } = detect(segments);
			// A hit too weak for the standard label teaches neither.
			if (!matched && strict) return;
			// As many of one kind as the other, so the common kind does not drown the rare one.
			if (!matched && counts.docs.neg >= counts.docs.pos) return;
			const words = features(segments);
			if (!words.length) return;
			if (ready()) {
				const flagged = score(words) >= SURE ? 1 : 0;
				if (matched) {
					check.labelled++;
					check.caught += flagged;
				} else {
					check.clean++;
					check.flagged += flagged;
				}
			}
			add(counts, matched ? 'pos' : 'neg', words);
			trim(counts, MAX_WORDS);
		},
		/** Whether a post reads like incel language, or nothing before it has learned enough. */
		opinion(segments: readonly string[]): boolean | undefined {
			return ready() ? score(features(segments)) >= SURE : undefined;
		}
	};
}

/** Counts from an earlier run. Starts afresh if there are none or they cannot be read. */
export function loadCounts(path: string, warn: (line: string) => void = console.warn): Counts {
	try {
		return parse(readFileSync(path, 'utf8'));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
			warn('learner: the saved counts cannot be read, so it starts afresh.');
		return emptyCounts();
	}
}

/** Saves pruned counts through a temporary file. */
export function saveCounts(path: string, counts: Counts): void {
	writeFileSync(`${path}.tmp`, serialise(counts));
	renameSync(`${path}.tmp`, path);
}

export function describeLearner({ counts, ready, check }: ReturnType<typeof learner>): string {
	const { pos, neg } = counts.docs;
	const { labelled, caught, clean, flagged } = check();
	return (
		`learner: learned from ${pos} labelled and ${neg} clean posts` +
		(ready() ? '' : `, needs ${MIN_DOCS} of each`) +
		(labelled + clean
			? `; flagged ${caught} of ${labelled} labelled and ${flagged} of ${clean} clean posts before learning them`
			: '')
	);
}
