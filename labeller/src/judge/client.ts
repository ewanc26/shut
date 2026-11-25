import Anthropic from '@anthropic-ai/sdk';

/** A slow answer is worth nothing to a log, so give up early. */
export function judgeClient(apiKey: string): Anthropic {
	return new Anthropic({ apiKey, timeout: 15_000, maxRetries: 1 });
}
