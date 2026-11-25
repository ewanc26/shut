// Runs the invented examples through the model: pnpm evaluate [model]
// This sends them to OpenCode and uses its free allowance.
import { fileURLToPath } from 'node:url';
import { EXAMPLES } from '../judge/examples.js';
import { openHost } from '../judge/host.js';
import { askModel, MODELS } from '../judge/model.js';

const wanted = process.argv.slice(2).find((argument) => argument !== '--') ?? MODELS[0];
const model = MODELS.find((known) => known === wanted);
if (!model) {
	console.error(`Choose one of: ${MODELS.join(', ')}`);
	process.exit(2);
}
const directory = fileURLToPath(new URL('../../../data/opencode', import.meta.url));
const host = await openHost(directory, model);
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
console.log(`${model}: agreed on ${agreed} of ${asked} asked, ${EXAMPLES.length} in total`);
await host.close();
process.exit();
