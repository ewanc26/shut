import { fileURLToPath } from 'node:url';

export interface Config {
	did: string;
	signingKey: string;
	host: string;
	port: number;
	dataDir: string;
	jetstreamUrl: string | undefined;
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

	return {
		did,
		signingKey: required('SIGNING_KEY'),
		host: env.HOST || '127.0.0.1',
		port,
		dataDir: env.DATA_DIR || fileURLToPath(new URL('../../../data', import.meta.url)),
		jetstreamUrl: env.JETSTREAM_URL || undefined
	};
}
