export const LABEL = 'incel-language';

/** Applied on any single term, including one ambiguous word. Off until a subscriber opts in. */
export const STRICT_LABEL = 'incel-language-strict';

/** Every label this labeller writes. */
export const LABELS = [LABEL, STRICT_LABEL] as const;
export type Label = (typeof LABELS)[number];

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
	},
	{
		identifier: STRICT_LABEL,
		severity: 'inform' as const,
		blurs: 'content' as const,
		defaultSetting: 'ignore' as const,
		adultOnly: false,
		locales: [
			{
				lang: 'en',
				name: 'Incel language (strict)',
				description:
					'A stricter version of "Incel language", off by default. It also covers a single ambiguous term, such as "cope" or "red pill", and broad words and names, such as "toilet" or "Chad". Most of what it adds is unrelated to incels. Applied automatically by word matching. It describes the words, not the author.'
			}
		]
	}
];
