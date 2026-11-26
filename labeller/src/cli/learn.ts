// Teaches the word-count learner from the live stream, then saves its counts. Writes no text.
// pnpm learn [minutes]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Jetstream } from '@skyware/jetstream';
import { postText } from '../detect/record.js';
import { describeLearner, learner, loadCounts, saveCounts } from '../judge/learner.js';
import { POST } from '../label/reconcile.js';

const minutes = Number(process.argv.slice(2).find((argument) => argument !== '--') ?? 10);
const dataDir = process.env.DATA_DIR || join(import.meta.dirname, '../../../data');
mkdirSync(dataDir, { recursive: true });
const output = join(dataDir, 'judge-counts.json');

const student = learner(loadCounts(output));
let seen = 0;

const jetstream = new Jetstream({ wantedCollections: [POST] });
jetstream.onCreate(POST, ({ commit }) => {
	seen++;
	student.learn(postText(commit.record));
});
jetstream.on('error', (error) => console.error('Jetstream error:', error?.message ?? error));
jetstream.start();

setTimeout(() => {
	jetstream.close();
	saveCounts(output, student.counts);
	console.log(`${seen} posts in ${minutes} min. ${describeLearner(student)}.`);
	console.log(`Saved to ${output}. No post text was stored.`);
	process.exit(0);
}, minutes * 60_000);
