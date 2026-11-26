// Starts the chosen services, in the order they are to be tried.
import { chain, type Link } from './chain.js';
import { chatHost } from './chat.js';
import { openHost, type Host } from './host.js';
import { describeBackend, type Backend, type ChatBackend } from './provider.js';
import { TIMEOUT_MS } from './shadow.js';

/** `directory` is where OpenCode keeps its files; other providers write nothing. */
export async function openBackend(backend: Backend, directory: string): Promise<Host> {
	if (backend.provider === 'opencode') {
		const { model } = backend as Extract<Backend, { provider: 'opencode' }>;
		return openHost(directory, model);
	}
	return chatHost(backend as ChatBackend);
}

export interface Judges extends Host {
	/** The longest one question can take, trying every service. */
	timeoutMs: number;
}

/** A service that does not start is left out. Fails only if none starts. */
export async function openBackends(
	backends: readonly Backend[],
	directory: string,
	open: typeof openBackend = openBackend
): Promise<Judges> {
	const hosts: Host[] = [];
	const links: Link[] = [];
	let failure: unknown;
	for (const backend of backends) {
		try {
			const host = await open(backend, directory);
			hosts.push(host);
			links.push({ name: backend.provider, generate: host.generate });
			console.log(`Judge ready: ${describeBackend(backend)}`);
		} catch (error) {
			failure = error;
			console.warn(`judge: ${backend.provider} did not start:`, (error as Error).message);
		}
	}
	const [only] = hosts;
	if (!only) throw failure ?? new Error('No model service to ask.');
	return {
		// A lone service reports its own failures, so it needs no chain.
		generate: links.length === 1 ? only.generate : chain(links),
		timeoutMs: TIMEOUT_MS * links.length,
		close: async () => {
			await Promise.all(hosts.map((host) => host.close()));
		}
	};
}
