// Pulls the human-written text out of records. Records come from the network and
// are not trusted to match their schema.

const MAX_DEPTH = 8;
const EMBED_TEXT_KEYS = new Set(['alt', 'title', 'description']);

type Fields = Record<string, unknown>;

const isObject = (value: unknown): value is Fields => typeof value === 'object' && value !== null;
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const strings = (...values: unknown[]): string[] =>
	values.filter((value): value is string => typeof value === 'string' && value.length > 0);

function embedText(value: unknown, depth = 0): string[] {
	if (depth > MAX_DEPTH || !isObject(value)) return [];
	return Object.entries(value).flatMap(([key, child]) =>
		EMBED_TEXT_KEYS.has(key) && typeof child === 'string'
			? strings(child)
			: embedText(child, depth + 1)
	);
}

/** Post text, hashtags, image and video alt text, and link card copy. */
export function postText(record: unknown): string[] {
	if (!isObject(record)) return [];
	const facetTags = asArray(record.facets)
		.flatMap((facet) => (isObject(facet) ? asArray(facet.features) : []))
		.map((feature) => (isObject(feature) ? feature.tag : undefined));
	const tags = strings(...asArray(record.tags), ...facetTags).map((tag) => `#${tag}`);
	return [...strings(record.text), ...tags, ...embedText(record.embed)];
}

/** Display name and bio. */
export function profileText(record: unknown): string[] {
	if (!isObject(record)) return [];
	return strings(record.displayName, record.description);
}
