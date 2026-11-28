// Two labels for posts and two for profiles: explicit incel language, and incel influenced
// language, which also covers a single ambiguous term, coinages on incel templates and broad
// words. Everything with an explicit label also has the matching influenced one.

/** Explicit incel language in a post. */
export const LABEL = 'incel-language';

/**
 * Incel influenced language in a post. Off until a subscriber opts in. Keeps the identifier it
 * was published under, when it was called the strict label.
 */
export const INFLUENCED_LABEL = 'incel-language-strict';

/** Explicit incel language in a profile. */
export const PROFILE_LABEL = 'incel-language-profile';

/** Incel influenced language in a profile. Off until a subscriber opts in. */
export const PROFILE_INFLUENCED_LABEL = 'incel-language-profile-strict';

/** The labels a post can have. */
export const POST_LABELS = [LABEL, INFLUENCED_LABEL] as const;

/** The labels a profile can have. */
export const PROFILE_LABELS = [PROFILE_LABEL, PROFILE_INFLUENCED_LABEL] as const;

/** Every label this labeller writes. */
export const LABELS = [...POST_LABELS, ...PROFILE_LABELS] as const;
export type Label = (typeof LABELS)[number];

const INFLUENCED_SCOPE =
	'It also covers a single ambiguous term, such as "cope" or "red pill", coinages such as "-pilled" and "-maxxing", and broad words and names, such as "toilet" or "Chad". Most of what it adds is unrelated to incels.';

function definition(
	identifier: Label,
	defaultSetting: 'hide' | 'ignore',
	name: string,
	description: string
) {
	return {
		identifier,
		severity: 'inform' as const,
		blurs: 'content' as const,
		defaultSetting,
		adultOnly: false,
		locales: [{ lang: 'en', name, description }]
	};
}

/** Published in the `app.bsky.labeler.service` record. */
export const DEFINITIONS = [
	definition(
		LABEL,
		'hide',
		'Incel language',
		'This post uses vocabulary from incel and related communities. Applied automatically by word matching, so it also covers quotes and criticism that repeat those terms. It describes the words, not the author.'
	),
	definition(
		INFLUENCED_LABEL,
		'ignore',
		'Incel influenced language',
		`This post uses language from or influenced by incel communities, off by default. ${INFLUENCED_SCOPE} Applied automatically by word matching. It describes the words, not the author.`
	),
	definition(
		PROFILE_LABEL,
		'hide',
		'Incel language in profile',
		'The display name or bio uses vocabulary from incel and related communities. Applied automatically by word matching. It covers the profile, not the posts, and describes the words, not the person.'
	),
	definition(
		PROFILE_INFLUENCED_LABEL,
		'ignore',
		'Incel influenced language in profile',
		`The display name or bio uses language from or influenced by incel communities, off by default. ${INFLUENCED_SCOPE} Applied automatically by word matching. It covers the profile, not the posts, and describes the words, not the person.`
	)
];
