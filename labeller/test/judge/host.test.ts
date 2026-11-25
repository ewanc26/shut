import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { openHost } from '../../src/judge/host.js';

// A stand-in for the SDK, so no host starts and nothing is sent.
const sdk = vi.hoisted(() => ({
	list: vi.fn(),
	text: vi.fn(),
	close: vi.fn()
}));
vi.mock('@opencode/sdk', () => ({
	OpenCode: {
		create: async () => ({
			model: { list: sdk.list },
			generate: { text: sdk.text },
			close: sdk.close
		})
	}
}));

const MODEL = 'deepseek-v4.1-flash-free';
const offered = { data: [{ providerID: 'opencode', id: MODEL }] };
const VARIABLES = ['XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_STATE_HOME'];

describe('openHost', () => {
	let directory = '';
	let before: (string | undefined)[] = [];

	beforeEach(() => {
		vi.resetAllMocks();
		sdk.list.mockResolvedValue(offered);
		directory = mkdtempSync(join(tmpdir(), 'shut-host-'));
		before = VARIABLES.map((name) => process.env[name]);
	});
	afterEach(() => {
		vi.useRealTimers();
		VARIABLES.forEach((name, index) => {
			const value = before[index];
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		});
		rmSync(directory, { recursive: true, force: true });
	});

	it('keeps OpenCode files under its own directory', async () => {
		await openHost(directory, MODEL);
		for (const name of VARIABLES) {
			const path = process.env[name] ?? '';
			assert.ok(path.startsWith(directory), name);
			assert.ok(existsSync(path), name);
		}
		assert.deepEqual(sdk.list.mock.calls[0], [
			{ location: { directory: join(directory, 'config', 'opencode') } }
		]);
	});

	it('waits for the model to be listed', async () => {
		vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] });
		sdk.list.mockResolvedValueOnce({ data: [] });
		const opening = openHost(directory, MODEL);
		await vi.advanceTimersByTimeAsync(1_000);
		await opening;
		assert.equal(sdk.list.mock.calls.length, 2);
	});

	it('closes and fails when the model never appears', async () => {
		vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] });
		sdk.list.mockResolvedValue({ data: [{ providerID: 'elsewhere', id: MODEL }] });
		const failed = assert.rejects(openHost(directory, MODEL), /does not offer/);
		await vi.advanceTimersByTimeAsync(32_000);
		await failed;
		assert.equal(sdk.close.mock.calls.length, 1);
	});

	it('asks the chosen free model for one generation, passing the signal on', async () => {
		sdk.text.mockResolvedValue({ text: 'unclear' });
		const host = await openHost(directory, MODEL);
		const { signal } = new AbortController();
		assert.equal(await host.generate('question', signal), 'unclear');
		assert.deepEqual(sdk.text.mock.calls[0], [
			{ prompt: 'question', model: { providerID: 'opencode', id: MODEL } },
			{ signal }
		]);
	});

	it('fails when the reply has no text', async () => {
		sdk.text.mockResolvedValue({});
		const host = await openHost(directory, MODEL);
		await assert.rejects(host.generate('question'), /no text/);
	});
});
