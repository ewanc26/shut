// Shows how the detector judges a piece of text: pnpm judge "some text"
import { detect } from '../detect/match.js';
import { secondOpinion } from '../judge/context.js';

const text = process.argv
	.slice(2)
	.filter((argument) => argument !== '--')
	.join(' ');
if (!text) {
	console.error('Usage: pnpm judge "text to check"');
	process.exit(2);
}
const verdict = detect([text]);
console.log(verdict);
// Experimental and advisory: it never changes the verdict above.
const opinion = secondOpinion([text], verdict);
if (opinion) console.log('judge (experimental):', opinion);
