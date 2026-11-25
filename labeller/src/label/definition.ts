export const LABEL = 'incel-language';

/** Published in the `app.bsky.labeler.service` record. */
export const DEFINITIONS = [
	{
		identifier: LABEL,
		severity: 'inform' as const,
		blurs: 'content' as const,
		defaultSetting: 'hide' as const,
		adultOnly: false,
		locales: [
			{
				lang: 'en',
				name: 'Incel language',
				description:
					'Uses vocabulary from incel and related communities. Applied automatically by word matching, so it also covers quotes and criticism that repeat those terms. It describes the words, not the author.'
			}
		]
	}
];
