// Word-presence counts for a small naive Bayes judge, learned from the stream.
//
// Privacy by construction: only counts are kept. Text is turned into words and discarded at once,
// and a word is kept only when it appears in at least MIN_POSTS distinct posts, so no stored
// entry can single out one post.

export const MIN_POSTS = 20;

export interface Tally {
	pos: number;
	neg: number;
}

export interface Counts {
	/** Posts that the word list labelled, and posts it found clean. */
	docs: Tally;
	words: Map<string, Tally>;
}

export function emptyCounts(): Counts {
	return { docs: { pos: 0, neg: 0 }, words: new Map() };
}

/** Counts one post's distinct words under one class. */
export function add(counts: Counts, label: 'pos' | 'neg', words: readonly string[]): void {
	counts.docs[label]++;
	for (const word of new Set(words)) {
		const tally = counts.words.get(word) ?? { pos: 0, neg: 0 };
		tally[label]++;
		counts.words.set(word, tally);
	}
}

/** Drops every word seen in fewer than MIN_POSTS posts. */
export function prune(counts: Counts, minPosts = MIN_POSTS): Counts {
	const words = new Map<string, Tally>();
	for (const [word, tally] of counts.words) {
		if (tally.pos + tally.neg >= minPosts) words.set(word, { ...tally });
	}
	return { docs: { ...counts.docs }, words };
}

/** Log likelihood ratio per word, with add-one smoothing, as in the judge's classifier. */
export function weights(counts: Counts): Map<string, number> {
	const { pos, neg } = counts.docs;
	const result = new Map<string, number>();
	for (const [word, tally] of counts.words) {
		const p = (tally.pos + 1) / (pos + 2);
		const n = (tally.neg + 1) / (neg + 2);
		result.set(word, Math.log(p / n));
	}
	return result;
}

/** A plain JSON form holding only pruned counts. */
export function serialise(counts: Counts): string {
	const pruned = prune(counts);
	return JSON.stringify({
		version: 1,
		minPosts: MIN_POSTS,
		docs: pruned.docs,
		words: Object.fromEntries([...pruned.words].sort(([a], [b]) => a.localeCompare(b)))
	});
}
