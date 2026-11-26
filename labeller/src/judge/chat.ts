// Asks an OpenAI-compatible chat API: one message, no history and no tools.
import { retryTime } from '../http/rate_limit.js';
import type { Host } from './host.js';
import type { ChatBackend } from './provider.js';

/** A failed request, in the shape the judge reads. It never holds the response body. */
export class ChatError extends Error {
	override name = 'ChatError';
	constructor(
		readonly status: number,
		readonly retryAfterMs?: number
	) {
		super(`The model server answered HTTP ${status}.`);
	}
}

interface Completion {
	choices?: { message?: { content?: unknown } }[];
}

export function chatHost(
	{ provider, baseUrl, apiKey, model }: ChatBackend,
	request: typeof fetch = fetch
): Host {
	return {
		generate: async (prompt, signal) => {
			const response = await request(`${baseUrl}/chat/completions`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
				},
				body: JSON.stringify({
					model,
					messages: [{ role: 'user', content: prompt }],
					stream: false,
					// Models differ in which settings they accept, so only Ollama is given any:
					// a small model can otherwise think at length before its one word.
					...(provider === 'ollama' ? { reasoning_effort: 'none', temperature: 0 } : {})
				}),
				// A redirect could send the text somewhere that was not chosen.
				redirect: 'error',
				...(signal ? { signal } : {})
			});
			if (!response.ok) {
				await response.body?.cancel();
				const now = Date.now();
				const at = retryTime(response.headers.get('retry-after'), now);
				throw new ChatError(response.status, at && at - now);
			}
			const body = (await response.json()) as Completion | null;
			const content = body?.choices?.[0]?.message?.content;
			if (typeof content !== 'string') throw new Error('The model server returned no text.');
			// Some reasoning models put their thinking ahead of the answer.
			return content.replace(/^\s*<think>[\s\S]*?<\/think>/, '');
		},
		close: async () => {}
	};
}
