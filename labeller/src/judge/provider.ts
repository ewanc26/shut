// Which service answers the judge, read from the environment.
import { MODELS, type Model } from './model.js';

/**
 * Providers reached through an OpenAI-compatible chat API, with the addresses Hermes Agent
 * uses for them. "custom" takes its address from `AI_JUDGE_BASE_URL`.
 */
export const BASE_URLS = {
	ollama: 'http://localhost:11434/v1',
	lmstudio: 'http://localhost:1234/v1',
	'ai-gateway': 'https://ai-gateway.vercel.sh/v1',
	arcee: 'https://api.arcee.ai/api/v1',
	cerebras: 'https://api.cerebras.ai/v1',
	deepseek: 'https://api.deepseek.com/v1',
	fireworks: 'https://api.fireworks.ai/inference/v1',
	groq: 'https://api.groq.com/openai/v1',
	huggingface: 'https://router.huggingface.co/v1',
	kimi: 'https://api.moonshot.ai/v1',
	mistral: 'https://api.mistral.ai/v1',
	nvidia: 'https://integrate.api.nvidia.com/v1',
	'ollama-cloud': 'https://ollama.com/v1',
	openai: 'https://api.openai.com/v1',
	openrouter: 'https://openrouter.ai/api/v1',
	together: 'https://api.together.xyz/v1',
	xai: 'https://api.x.ai/v1',
	zai: 'https://api.z.ai/api/paas/v4'
} as const;

export const PROVIDERS = ['opencode', ...Object.keys(BASE_URLS), 'custom'];

/** Names for this machine, or for a container's host. Only these may be reached without TLS. */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', 'host.docker.internal'];

export interface ChatBackend {
	provider: string;
	model: string;
	/** Without a trailing slash. */
	baseUrl: string;
	apiKey: string | undefined;
}

export type Backend = { provider: 'opencode'; model: Model } | ChatBackend;

export const isLocal = (baseUrl: string) => LOCAL_HOSTS.includes(new URL(baseUrl).hostname);

function address(value: string, setting: string): string {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`${setting} must be a web address, such as https://host/v1.`);
	}
	// Neither is echoed back, as either could hold a secret.
	if (url.username || url.password || url.search || url.hash)
		throw new Error(`${setting} must not hold a login, query or fragment.`);
	if (
		url.protocol !== 'https:' &&
		!(url.protocol === 'http:' && LOCAL_HOSTS.includes(url.hostname))
	)
		throw new Error(`${setting} must use https unless the host is ${LOCAL_HOSTS.join(', ')}.`);
	return url.href.replace(/\/+$/, '');
}

/** The settings of one service start with `prefix`. */
export function readBackend(env: NodeJS.ProcessEnv, prefix = 'AI_JUDGE_'): Backend {
	const read = (name: string) => env[`${prefix}${name}`]?.trim() || undefined;
	const provider = read('PROVIDER') ?? 'opencode';
	if (!PROVIDERS.includes(provider))
		throw new Error(`${prefix}PROVIDER must be one of: ${PROVIDERS.join(', ')}.`);
	const wanted = read('MODEL');
	const given = read('BASE_URL');
	const apiKey = read('API_KEY');

	if (provider === 'opencode') {
		// Refused rather than ignored, so nobody thinks text is going elsewhere.
		if (given || apiKey)
			throw new Error(`${prefix}BASE_URL and ${prefix}API_KEY need another ${prefix}PROVIDER.`);
		const model = MODELS.find((known) => known === (wanted ?? MODELS[0]));
		if (!model) throw new Error(`${prefix}MODEL must be one of: ${MODELS.join(', ')}.`);
		return { provider, model };
	}

	if (!wanted) throw new Error(`${prefix}MODEL must name a model offered by ${provider}.`);
	const preset = (BASE_URLS as Record<string, string>)[provider];
	const base = given ?? preset;
	if (!base) throw new Error(`${prefix}BASE_URL is needed for the custom provider.`);
	const baseUrl = address(base, `${prefix}BASE_URL`);
	if (!apiKey && !isLocal(baseUrl))
		throw new Error(`${prefix}API_KEY is needed to use ${provider}.`);
	return { provider, model: wanted, baseUrl, apiKey };
}

/** Prefixes of the services to fall back to, in the order they are tried. */
const FALLBACKS = ['AI_JUDGE_FALLBACK_', 'AI_JUDGE_FALLBACK_2_', 'AI_JUDGE_FALLBACK_3_'];

/** The first service, then each fallback that is set. */
export function readBackends(env: NodeJS.ProcessEnv): Backend[] {
	const backends = [readBackend(env)];
	for (const prefix of FALLBACKS) {
		const set = ['PROVIDER', 'MODEL', 'BASE_URL', 'API_KEY'].filter((name) =>
			env[`${prefix}${name}`]?.trim()
		);
		if (!set.length) continue;
		// A fallback must say who it is: defaulting to OpenCode could surprise.
		if (!set.includes('PROVIDER')) throw new Error(`${prefix}PROVIDER is not set.`);
		backends.push(readBackend(env, prefix));
	}
	// OpenCode takes over process settings, so it can only run once.
	if (backends.filter(({ provider }) => provider === 'opencode').length > 1)
		throw new Error('Only one judge service can use opencode.');
	return backends;
}

/** Where record text goes, for logs. Never includes the key. */
export function describeBackend(backend: Backend): string {
	if (backend.provider === 'opencode') return `${backend.model} through OpenCode`;
	const { model, provider, baseUrl } = backend as ChatBackend;
	return `${model} from ${provider} at ${new URL(baseUrl).host}`;
}
