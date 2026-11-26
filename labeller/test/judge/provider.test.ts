import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
	BASE_URLS,
	describeBackend,
	isLocal,
	readBackend,
	readBackends
} from '../../src/judge/provider.js';

const remote = {
	AI_JUDGE_PROVIDER: 'openrouter',
	AI_JUDGE_MODEL: 'vendor/model',
	AI_JUDGE_API_KEY: 'secret-key'
};

describe('readBackend', () => {
	it('uses OpenCode unless told otherwise', () => {
		assert.deepEqual(readBackend({}), {
			provider: 'opencode',
			model: 'deepseek-v4.1-flash-free'
		});
	});

	it('refuses a key or address that OpenCode would ignore', () => {
		assert.throws(() => readBackend({ AI_JUDGE_API_KEY: 'k' }), /AI_JUDGE_PROVIDER/);
		assert.throws(
			() => readBackend({ AI_JUDGE_BASE_URL: 'https://example.com/v1' }),
			/AI_JUDGE_PROVIDER/
		);
	});

	it('knows the address of a named provider', () => {
		assert.deepEqual(readBackend(remote), {
			provider: 'openrouter',
			model: 'vendor/model',
			baseUrl: 'https://openrouter.ai/api/v1',
			apiKey: 'secret-key'
		});
	});

	it('only offers addresses it would accept', () => {
		for (const [provider, url] of Object.entries(BASE_URLS))
			assert.doesNotThrow(
				() => readBackend({ ...remote, AI_JUDGE_PROVIDER: provider }),
				`${provider} ${url}`
			);
	});

	it('needs no key for a server on this machine or the container host', () => {
		for (const provider of ['ollama', 'lmstudio'])
			assert.doesNotThrow(() => readBackend({ AI_JUDGE_PROVIDER: provider, AI_JUDGE_MODEL: 'm' }));
		const backend = readBackend({
			AI_JUDGE_PROVIDER: 'ollama',
			AI_JUDGE_MODEL: 'm',
			AI_JUDGE_BASE_URL: 'http://host.docker.internal:11434/v1/'
		});
		assert.ok(backend.provider !== 'opencode' && 'baseUrl' in backend);
		assert.equal(backend.baseUrl, 'http://host.docker.internal:11434/v1');
		assert.ok(isLocal(backend.baseUrl));
	});

	it('needs a model, a key and an address as each applies', () => {
		assert.throws(() => readBackend({ AI_JUDGE_PROVIDER: 'ollama' }), /AI_JUDGE_MODEL/);
		assert.throws(() => readBackend({ ...remote, AI_JUDGE_API_KEY: ' ' }), /AI_JUDGE_API_KEY/);
		assert.throws(
			() => readBackend({ ...remote, AI_JUDGE_PROVIDER: 'custom' }),
			/AI_JUDGE_BASE_URL/
		);
		assert.throws(() => readBackend({ AI_JUDGE_PROVIDER: 'nobody' }), /AI_JUDGE_PROVIDER/);
	});

	it('refuses plain http to other machines, and logins in the address', () => {
		for (const url of [
			'http://example.com/v1',
			'http://localhost.example.com/v1',
			'http://192.168.1.2/v1',
			'ftp://localhost/v1',
			'not a url',
			'https://user:hunter2@example.com/v1',
			'https://example.com/v1?key=hunter2'
		])
			assert.throws(
				() => readBackend({ ...remote, AI_JUDGE_BASE_URL: url }),
				(error: Error) =>
					/AI_JUDGE_BASE_URL/.test(error.message) && !error.message.includes('hunter2'),
				url
			);
	});

	it('never describes a backend with its key', () => {
		assert.equal(
			describeBackend(readBackend(remote)),
			'vendor/model from openrouter at openrouter.ai'
		);
	});
});

describe('readBackends', () => {
	const fallback = { AI_JUDGE_FALLBACK_PROVIDER: 'ollama', AI_JUDGE_FALLBACK_MODEL: 'small' };

	it('has one service without fallbacks', () => {
		assert.deepEqual(
			readBackends({}).map(({ provider }) => provider),
			['opencode']
		);
	});

	it('lists fallbacks in order, each with its own settings', () => {
		const backends = readBackends({
			...fallback,
			AI_JUDGE_FALLBACK_2_PROVIDER: 'groq',
			AI_JUDGE_FALLBACK_2_MODEL: 'quick',
			AI_JUDGE_FALLBACK_2_API_KEY: 'second-key'
		});
		assert.deepEqual(
			backends.map(({ provider }) => provider),
			['opencode', 'ollama', 'groq']
		);
		assert.ok('apiKey' in backends[1]! && backends[1].apiKey === undefined);
		assert.ok('apiKey' in backends[2]! && backends[2].apiKey === 'second-key');
	});

	it('does not lend a fallback the first service’s key', () => {
		assert.throws(
			() =>
				readBackends({
					...remote,
					AI_JUDGE_FALLBACK_PROVIDER: 'groq',
					AI_JUDGE_FALLBACK_MODEL: 'm'
				}),
			/AI_JUDGE_FALLBACK_API_KEY/
		);
	});

	it('names the setting at fault', () => {
		assert.throws(
			() => readBackends({ AI_JUDGE_FALLBACK_MODEL: 'm' }),
			/AI_JUDGE_FALLBACK_PROVIDER/
		);
		assert.throws(
			() => readBackends({ ...fallback, AI_JUDGE_FALLBACK_BASE_URL: 'http://example.com' }),
			/AI_JUDGE_FALLBACK_BASE_URL/
		);
	});

	it('runs OpenCode only once', () => {
		assert.throws(() => readBackends({ AI_JUDGE_FALLBACK_PROVIDER: 'opencode' }), /only one/i);
	});
});
