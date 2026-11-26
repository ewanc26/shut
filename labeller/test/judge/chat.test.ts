import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'vitest';
import { chatHost } from '../../src/judge/chat.js';
import { askModel } from '../../src/judge/model.js';
import { shadowJudge } from '../../src/judge/shadow.js';

const backend = {
	provider: 'custom',
	model: 'some-model',
	baseUrl: 'https://models.example/v1',
	apiKey: 'secret-key'
};

const reply = (content: unknown) => Response.json({ choices: [{ message: { content } }] });

/** A stand-in for `fetch` that records each request. */
function stub(response: () => Response) {
	const sent: { url: string; init: RequestInit }[] = [];
	const request: typeof fetch = async (input, init) => {
		sent.push({ url: String(input), init: init ?? {} });
		return response();
	};
	return { sent, request };
}

describe('chatHost', () => {
	it('sends one message and nothing else about the record', async () => {
		const { sent, request } = stub(() => reply('Incel.'));
		const host = chatHost(backend, request);
		assert.deepEqual(await askModel(host.generate, ['made-up words']), { sense: 'incel' });
		const [{ url, init } = assert.fail()] = sent;
		assert.equal(url, 'https://models.example/v1/chat/completions');
		assert.equal(init.redirect, 'error');
		assert.equal(new Headers(init.headers).get('authorization'), 'Bearer secret-key');
		const body = JSON.parse(String(init.body)) as { messages: { content: string }[] };
		assert.deepEqual(Object.keys(body), ['model', 'messages', 'stream']);
		assert.equal(body.messages.length, 1);
		assert.match(body.messages[0]?.content ?? '', /made-up words/);
		assert.doesNotMatch(String(init.body), /did:|at:\/\//);
	});

	it('asks Ollama not to think before answering', async () => {
		const { sent, request } = stub(() => reply('ordinary'));
		await chatHost({ ...backend, provider: 'ollama' }, request).generate('x');
		const body = JSON.parse(String(sent[0]?.init.body)) as Record<string, unknown>;
		assert.equal(body.reasoning_effort, 'none');
		assert.equal(body.temperature, 0);
	});

	it('sends no authorisation without a key', async () => {
		const { sent, request } = stub(() => reply('ordinary'));
		await chatHost({ ...backend, apiKey: undefined }, request).generate('x');
		assert.equal(new Headers(sent[0]?.init.headers).has('authorization'), false);
	});

	it('leaves out thinking put ahead of the answer', async () => {
		const { request } = stub(() => reply('<think>incel or not?\n</think>\n\nordinary'));
		const answer = await askModel(chatHost(backend, request).generate, ['x']);
		assert.equal(answer.sense, 'ordinary');
	});

	it('reports a rate limit and its wait without the response body', async () => {
		const { request } = stub(
			() => new Response('echo of the text', { status: 429, headers: { 'retry-after': '90' } })
		);
		await assert.rejects(chatHost(backend, request).generate('x'), (error: Error) => {
			const { status, retryAfterMs } = error as Error & {
				status: number;
				retryAfterMs: number;
			};
			assert.equal(status, 429);
			assert.ok(retryAfterMs > 80_000 && retryAfterMs <= 90_000);
			assert.doesNotMatch(error.message, /echo/);
			return true;
		});
	});

	it('pauses the judge on a rate limit', async () => {
		const { request } = stub(() => new Response(null, { status: 429 }));
		const host = chatHost(backend, request);
		const lines: string[] = [];
		const judge = shadowJudge({
			ask: (segments, signal) => askModel(host.generate, segments, signal),
			dailyLimit: 5,
			log: (line) => lines.push(line)
		});
		judge.offer('at://one', ['x']);
		await judge.idle();
		assert.equal(judge.total().rateLimited, 1);
		assert.equal(judge.waiting(), 1);
		assert.match(lines[0] ?? '', /^judge paused by a rate limit/);
		judge.close();
	});

	it('fails on a reply without text', async () => {
		for (const response of [() => reply(null), () => Response.json({}), () => new Response('?')])
			await assert.rejects(chatHost(backend, stub(response).request).generate('x'));
	});

	it('does not follow a redirect with the text', async () => {
		let followed = 0;
		const server = createServer((request, response) => {
			if (request.url === '/elsewhere') followed += 1;
			response.writeHead(307, { location: '/elsewhere' }).end();
		});
		await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
		const { port } = server.address() as AddressInfo;
		try {
			const host = chatHost({ ...backend, baseUrl: `http://127.0.0.1:${port}/v1` });
			await assert.rejects(host.generate('x'));
			assert.equal(followed, 0);
		} finally {
			server.close();
		}
	});
});
