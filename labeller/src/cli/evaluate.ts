// Runs the invented examples through the model: pnpm evaluate [model]
// This sends them to the provider set by AI_JUDGE_PROVIDER and uses its allowance.
import { fileURLToPath } from 'node:url';
import { EXAMPLES } from '../judge/examples.js';
import { askModel } from '../judge/model.js';
import { openBackend } from '../judge/open.js';
import { describeBackend, readBackend, type Backend } from '../judge/provider.js';

const wanted = process.argv.slice(2).find((argument) => argument !== '--');
let backend: Backend;
try {
	backend = readBackend({ ...process.env, ...(wanted ? { AI_JUDGE_MODEL: wanted } : {}) });
} catch (error) {
	console.error((error as Error).message);
	process.exit(2);
}
console.log(`Asking ${describeBackend(backend)}`);
const directory = fileURLToPath(new URL('../../../data/opencode', import.meta.url));
const host = await openBackend(backend, directory);
let agreed = 0;
let asked = 0;
try {
	for (const { sense, text } of EXAMPLES) {
		const answer = await askModel(host.generate, [text], AbortSignal.timeout(60_000));
		asked += 1;
		if (answer.sense === sense) agreed += 1;
		console.log(`${answer.sense === sense ? 'ok  ' : 'MISS'} ${sense} -> ${answer.sense}: ${text}`);
	}
} catch (error) {
	console.error('Stopped:', error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
console.log(`${backend.model}: agreed on ${agreed} of ${asked} asked, ${EXAMPLES.length} in total`);
await host.close();
process.exit();
