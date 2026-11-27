// Dry run against the live network: prints what would be labelled and writes nothing.
// pnpm sample [seconds] [rewind seconds]
import { Jetstream } from '@skyware/jetstream';
import { detect } from '../detect/match.js';
import { postText } from '../detect/record.js';
import { POST } from '../label/reconcile.js';

const [seconds = 60, rewind = 0] = process.argv
	.slice(2)
	.filter((argument) => argument !== '--')
	.map(Number);
const jetstream = new Jetstream({
	wantedCollections: [POST],
	...(rewind ? { cursor: (Date.now() - rewind * 1000) * 1000 } : {})
});
let seen = 0;
let matched = 0;
let strict = 0;

jetstream.onCreate(POST, ({ commit }) => {
	seen++;
	const segments = postText(commit.record);
	const verdict = detect(segments);
	const { strong, weak, template } = verdict;
	if (!verdict.strict) return;
	strict++;
	if (verdict.matched) matched++;
	console.log(
		`${verdict.matched ? '' : '(influenced only) '}[${[...strong, ...weak, ...template].join(', ')}] ${JSON.stringify(segments.join(' | ').slice(0, 300))}`
	);
});
jetstream.on('error', (error) => console.error('Jetstream error:', error?.message ?? error));
jetstream.start();

setTimeout(() => {
	console.log(
		`\n${matched} of ${seen} posts would be labelled, ${strict} as incel influenced language.`
	);
	jetstream.close();
	process.exit(0);
}, seconds * 1000);
