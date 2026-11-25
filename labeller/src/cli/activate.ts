// pnpm activate https://labels.example
// Run it in your own terminal: it asks for the account password.
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { activate } from '../account/activate.js';

const endpoint = process.argv.slice(2).find((argument) => argument !== '--');
// Lets the signing key live outside the repository.
if (process.env.SIGNING_KEY_FILE) process.loadEnvFile(process.env.SIGNING_KEY_FILE);
const { LABELER_DID: did, SIGNING_KEY: signingKey, PDS_URL: pds } = process.env;
if (!endpoint || !did || !signingKey) {
	console.error(
		'Usage: pnpm activate https://labels.example\n' +
			'Needs LABELER_DID, and SIGNING_KEY or SIGNING_KEY_FILE. See .env.example.'
	);
	process.exit(2);
}
if (!process.stdin.isTTY) {
	console.error('Run this in an interactive terminal.');
	process.exit(2);
}

let muted = false;
const output = new Writable({
	write(chunk, encoding, done) {
		if (!muted) process.stdout.write(chunk, encoding);
		done();
	}
});
const terminal = createInterface({ input: process.stdin, output, terminal: true });

try {
	await activate(
		{ did, signingKey, pds: pds || 'https://bsky.social', endpoint },
		{
			ask: (question) => terminal.question(question),
			async secret(question) {
				const answer = terminal.question(question);
				muted = true;
				try {
					return await answer;
				} finally {
					muted = false;
					process.stdout.write('\n');
				}
			},
			say: (message) => console.log(message)
		}
	);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	terminal.close();
}
