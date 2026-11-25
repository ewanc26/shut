import { fileURLToPath } from 'node:url';

export interface Config {
	did: string;
	signingKey: string;
	host: string;
	port: number;
	dataDir: string;
	jetstreamUrl: string | undefined;
	/** Set to log what the experimental judge would label. It never writes labels. */
	judge: { apiKey: string; dailyLimit: number } | undefined;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
	const required = (name: string): string => {
		const value = env[name]?.trim();
		if (!value) throw new Error(`${name} is not set. See .env.example.`);
		return value;
	};
	const did = required('LABELER_DID');
	if (!did.startsWith('did:')) throw new Error('LABELER_DID must be a DID, not a handle.');
	const port = Number(env.PORT || 14831);
	if (!Number.isInteger(port) || port < 1 || port > 65535)
		throw new Error('PORT must be a port number.');
	const judge = env.AI_JUDGE?.trim() || 'off';
	if (judge !== 'off' && judge !== 'shadow') throw new Error('AI_JUDGE must be off or shadow.');
	const dailyLimit = Number(env.AI_JUDGE_DAILY_LIMIT?.trim() || 2000);
	if (!Number.isInteger(dailyLimit) || dailyLimit < 1)
		throw new Error('AI_JUDGE_DAILY_LIMIT must be a whole number above zero.');

	return {
		did,
		signingKey: required('SIGNING_KEY'),
		host: env.HOST || '127.0.0.1',
		port,
		dataDir: env.DATA_DIR || fileURLToPath(new URL('../../../data', import.meta.url)),
		jetstreamUrl: env.JETSTREAM_URL || undefined,
		judge: judge === 'shadow' ? { apiKey: required('ANTHROPIC_API_KEY'), dailyLimit } : undefined
	};
}
