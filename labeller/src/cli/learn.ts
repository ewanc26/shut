// Learns word counts from the live stream, then saves pruned counts. Writes no text.
// pnpm learn [minutes]
//
// Labels come from the word list: a strong hit counts as incel, a post with no hit counts as
// ordinary, and a post with only an ambiguous hit is skipped. The model therefore learns the
// word list's own judgements plus the context around them. It is not a measure of accuracy.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Jetstream } from '@skyware/jetstream';
import { detect } from '../detect/match.js';
import { postText } from '../detect/record.js';
import { add, emptyCounts, prune, serialise } from '../judge/counts.js';
import { features } from '../judge/features.js';
import { POST } from '../label/reconcile.js';

const minutes = Number(process.argv.slice(2).find((argument) => argument !== '--') ?? 10);
const dataDir = join(import.meta.dirname, '../../../data');
mkdirSync(dataDir, { recursive: true });
const output = join(dataDir, 'judge-counts.json');

const counts = emptyCounts();
let seen = 0;
let skipped = 0;

const jetstream = new Jetstream({ wantedCollections: [POST] });
jetstream.onCreate(POST, ({ commit }) => {
	seen++;
	const segments = postText(commit.record);
	const verdict = detect(segments);
	if (verdict.matched) add(counts, 'pos', features(segments));
	else if (verdict.weak.length === 0) add(counts, 'neg', features(segments));
	else skipped++;
});
jetstream.on('error', (error) => console.error('Jetstream error:', error?.message ?? error));
jetstream.start();

setTimeout(() => {
	jetstream.close();
	writeFileSync(output, serialise(counts));
	const kept = prune(counts).words.size;
	console.log(
		`${seen} posts in ${minutes} min: ${counts.docs.pos} labelled, ${counts.docs.neg} clean, ${skipped} ambiguous skipped.`
	);
	console.log(`${kept} words kept after pruning. Saved to ${output}. No post text was stored.`);
	process.exit(0);
}, minutes * 60_000);
