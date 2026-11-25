// Runs OpenCode inside this process, kept apart from any OpenCode setup on the machine.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Generate, Model } from './model.js';

const PROVIDER = 'opencode';
const CATALOG_WAIT_MS = 30_000;

export interface Host {
	generate: Generate;
	close(): Promise<void>;
}

/**
 * Starts OpenCode with its files under `directory`. This changes the process's XDG variables,
 * so the machine's own OpenCode configuration, plugins and logins are not loaded.
 */
export async function openHost(directory: string, model: Model): Promise<Host> {
	const root = resolve(directory);
	for (const name of ['config', 'data', 'cache', 'state']) {
		const path = join(root, name);
		mkdirSync(path, { recursive: true });
		process.env[`XDG_${name.toUpperCase()}_HOME`] = path;
	}
	// Generation uses the global configuration directory as its location.
	const location = { directory: join(root, 'config', 'opencode') };
	mkdirSync(location.directory, { recursive: true });

	// Loaded only now: it is large, and reads the variables above.
	const { OpenCode } = await import('@opencode/sdk');
	const opencode = await OpenCode.create();
	try {
		// The model catalogue arrives some time after the host starts.
		const deadline = Date.now() + CATALOG_WAIT_MS;
		for (;;) {
			const { data } = await opencode.model.list({ location });
			if (
				data.some(
					(entry: { providerID: string; id: string }) =>
						entry.providerID === PROVIDER && entry.id === model
				)
			)
				break;
			if (Date.now() > deadline) throw new Error(`OpenCode does not offer ${model}.`);
			await new Promise((done) => setTimeout(done, 1_000));
		}
	} catch (error) {
		await opencode.close();
		throw error;
	}

	return {
		generate: async (prompt, signal) => {
			const { text }: { text: unknown } = await opencode.generate.text(
				{ prompt, model: { providerID: PROVIDER, id: model } },
				signal ? { signal } : {}
			);
			if (typeof text !== 'string') throw new Error('OpenCode returned no text.');
			return text;
		},
		close: () => opencode.close()
	};
}
