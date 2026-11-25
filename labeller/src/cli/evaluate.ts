// Runs the invented examples through the model: pnpm evaluate
// This calls Anthropic and costs money.
import { judgeClient } from '../judge/client.js';
import { EXAMPLES } from '../judge/examples.js';
import { askModel, MODEL } from '../judge/model.js';

const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
if (!apiKey) {
	console.error('ANTHROPIC_API_KEY is not set. See .env.example.');
	process.exit(2);
}
const client = judgeClient(apiKey);
let agreed = 0;
let inputTokens = 0;
let outputTokens = 0;
for (const { sense, text } of EXAMPLES) {
	const answer = await askModel(client, [text]);
	if (answer.sense === sense) agreed += 1;
	inputTokens += answer.inputTokens;
	outputTokens += answer.outputTokens;
	console.log(`${answer.sense === sense ? 'ok  ' : 'MISS'} ${sense} -> ${answer.sense}: ${text}`);
}
console.log(`${MODEL}: agreed on ${agreed} of ${EXAMPLES.length}`);
console.log(`tokens: ${inputTokens} in, ${outputTokens} out`);
