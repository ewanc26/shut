import { fileURLToPath } from 'node:url';
import { readBackends, type Backend } from '../judge/provider.js';
import { DEFAULT_MAX_DELAY_MINUTES, LONGEST_DELAY_MINUTES } from '../schedule/gate.js';

export interface Config {
	did: string;
	signingKey: string;
	host: string;
	port: number;
	dataDir: string;
	jetstreamUrl: string | undefined;
	/** Whether to fetch and judge the existing profile of each account seen posting. */
	profileCheck: boolean;
	/** Set to log what the experimental judge would label. It never writes labels. */
	judge: { backends: Backend[]; dailyLimit: number } | undefined;
	/** Set to pause on the monitor's advice, but never further behind than the delay. */
	schedule: { file: string; maxDelayMs: number } | undefined;
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
	const profileCheck = env.PROFILE_CHECK?.trim() || 'on';
	if (profileCheck !== 'on' && profileCheck !== 'off')
		throw new Error('PROFILE_CHECK must be on or off.');
	const judge = env.AI_JUDGE?.trim() || 'off';
	if (judge !== 'off' && judge !== 'shadow') throw new Error('AI_JUDGE must be off or shadow.');
	const dailyLimit = Number(env.AI_JUDGE_DAILY_LIMIT?.trim() || 200);
	if (!Number.isInteger(dailyLimit) || dailyLimit < 1)
		throw new Error('AI_JUDGE_DAILY_LIMIT must be a whole number above zero.');
	// Read even when the judge is off, so a mistake shows before it is turned on.
	const backends = readBackends(env);
	const delay = Number(env.SCHEDULE_MAX_DELAY_MINUTES?.trim() || DEFAULT_MAX_DELAY_MINUTES);
	if (!(delay >= 1 && delay <= LONGEST_DELAY_MINUTES))
		throw new Error(`SCHEDULE_MAX_DELAY_MINUTES must be from 1 to ${LONGEST_DELAY_MINUTES}.`);
	const file = env.SCHEDULE_FILE?.trim();

	return {
		did,
		signingKey: required('SIGNING_KEY'),
		host: env.HOST || '127.0.0.1',
		port,
		dataDir: env.DATA_DIR || fileURLToPath(new URL('../../../data', import.meta.url)),
		jetstreamUrl: env.JETSTREAM_URL || undefined,
		profileCheck: profileCheck === 'on',
		judge: judge === 'shadow' ? { backends, dailyLimit } : undefined,
		schedule: file ? { file, maxDelayMs: delay * 60_000 } : undefined
	};
}
