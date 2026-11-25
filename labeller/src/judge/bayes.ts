// A very small naive Bayes text classifier over word presence, trained in memory.

export interface Model {
	/** Log likelihood ratio for each known word; above zero leans towards the first class. */
	weights: ReadonlyMap<string, number>;
}

function documentCounts(documents: readonly (readonly string[])[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const words of documents) {
		for (const word of new Set(words)) counts.set(word, (counts.get(word) ?? 0) + 1);
	}
	return counts;
}

/** Both classes are treated as equally likely, with add-one smoothing. */
export function train(
	positive: readonly (readonly string[])[],
	negative: readonly (readonly string[])[]
): Model {
	const inPositive = documentCounts(positive);
	const inNegative = documentCounts(negative);
	const weights = new Map<string, number>();
	for (const word of new Set([...inPositive.keys(), ...inNegative.keys()])) {
		const p = ((inPositive.get(word) ?? 0) + 1) / (positive.length + 2);
		const n = ((inNegative.get(word) ?? 0) + 1) / (negative.length + 2);
		weights.set(word, Math.log(p / n));
	}
	return { weights };
}

export interface Estimate {
	/** Probability of the first class, from 0 to 1. */
	probability: number;
	/** How many distinct words the model recognised. */
	known: number;
}

export function estimate(model: Model, words: readonly string[]): Estimate {
	let sum = 0;
	let known = 0;
	for (const word of new Set(words)) {
		const weight = model.weights.get(word);
		if (weight === undefined) continue;
		sum += weight;
		known++;
	}
	return { probability: 1 / (1 + Math.exp(-sum)), known };
}
