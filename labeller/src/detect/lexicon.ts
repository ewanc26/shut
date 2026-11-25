// The term list. Patterns are regular expression fragments matched on whole words
// against normalised, lower-case text. A space in a pattern is a literal space;
// use `[ -]?` where a term is written both joined and apart.

export interface Rule {
	/** Short name, used in logs and tests. */
	id: string;
	pattern: string;
}

/**
 * Phrases removed before matching because they are a different word spelt the same.
 * FOID is also the Illinois Firearm Owner's Identification card.
 */
export const HOMONYMS: readonly { remove: RegExp; when?: RegExp }[] = [
	{
		remove:
			/\bfoid[ -](?:card|holder|licen[cs]e|number|act|application|law|requirement|revocation)s?\b/gi
	},
	// MOID is also an asteroid's minimum orbit intersection distance.
	{ remove: /\bMOIDs?\b/g, when: /\b(?:asteroids?|orbit(?:s|al)?|comets?|near[- ]earth)\b/i },
	// And VMware's managed object ID.
	{ remove: /\bmoids?\b/gi, when: /\b(?:vmware|vsphere|vcenter|esxi|broadcom|managed object)\b/i },
	{ remove: /\bFOID\b/g, when: /\b(?:firearms?|guns?|illinois|state police|concealed carry)\b/i }
];

/** Terms distinctive enough that one hit is sufficient. */
export const STRONG: readonly Rule[] = [
	// The movement's own name, including mentions of it.
	{
		id: 'incel',
		pattern:
			'incel(?:s|dom|ish|ism|ibacy)?|involuntary celiba(?:te|tes|cy)|инцел\\p{L}*|incel(?:tears|osphere)|deincel(?:ification|ified)'
	},
	{ id: 'moid', pattern: 'moids?' },
	{ id: 'khhv', pattern: 'khhv|kissless[ ,-]+(?:(?:hugless|handhold ?less)[ ,-]+){1,2}virgins?' },

	// Dehumanising names for women.
	{ id: 'foid', pattern: '(?:toilet[ -]?|whore[ -]?)?(?:fem|f)oid(?:s|al|ism|cel|cels)?' },
	{ id: 'roastie', pattern: 'roasties? (?:whores?|toilets?)|roastie[ -]?(?:logic|whore|toilet)s?' },
	{ id: 'noodlewhore', pattern: 'noodle[ -]?whores?' },

	// "-cel" identities. Listed one by one: a bare suffix would match "cancel" and "excel".
	{
		id: 'cel',
		pattern:
			'(?:fem|curry|rice|black|white|ethnic|height|short|manlet|wrist|skull|frame|gym|true|mental|vol|fake|near|escort|rich|poor|old|young|ugly|brain|looks|jbw|mewing|cope|ginger|virgin|auti|bird|forced|wage|ethni|nig|nigga|bald|autist|aspie|sperg|tall|chad|face|jaw|nose|arab|indian|latino|noodle|dental|giga|ultra|hope|doom|ascend|incel[ -]?)cels?|(?:femcel|truecel|volcel)(?:dom|ibacy|ism)'
	},
	{ id: 'cucktears', pattern: 'cuck[ -]?tears' },

	// Pill ideology. The spaced "black pill" is weak, since it can be a literal pill.
	{ id: 'blackpill', pattern: 'black-?pill(?:s|ed|er|ers|ing)?|black pilled|the black ?pill' },
	{
		id: 'pill',
		pattern: '(?:height|looks|race|wrist|face|water|dick|tall)[ -]?pill(?:ed|er|ers|ing)'
	},

	// Appearance ranking.
	{
		id: 'looksmaxx',
		pattern:
			'looks?[ -]?(?:maxx+(?:ed|er|ers|ing)?|max(?:er|ers|ing))|looksmax(?:ed)?|looksmin(?:ned|ner|ning)?'
	},
	{
		id: 'maxx',
		pattern:
			'(?:gym|jaw|height|money|status|surgery|rice|white|curry|jbw|nt|hard|soft|mew|rope|ascend|frame|hag|low[ -]?inhib)[ -]?maxx(?:ed|er|ers|ing)?'
	},
	{
		id: 'mog',
		pattern:
			'(?:height|frame|jaw|face|looks|wrist|skull)[ -]?mog(?:s|ged|ger|gers|ging)?|mogg(?:ed|er|ers|ing)'
	},
	{ id: 'chadlite', pattern: '(?:chad|stacy|becky)[ -]?lites?|chad[ -]?fish(?:ed|ing)?|chadlets?' },
	{ id: 'bonesmash', pattern: 'bonesmash(?:ed|er|ing)|bone[ -]?smash(?:ing)? theory' },
	{ id: 'manlet', pattern: 'manlets?' },

	// Forum shorthand and fatalism.
	{ id: 'awalt', pattern: 'n?awalt' },
	{ id: 'fuel', pattern: '(?:rope|sui|suicide|cope|cage)[ -]?fuel' },
	{ id: 'rope', pattern: 'cope[ -]?or[ -]?rope|rope[ -]?or[ -]?cope' },
	{ id: 'jbwtheory', pattern: 'just be white theory' },
	{
		id: 'carousel',
		pattern: 'cock carousel|alpha fu(?:x|cks),? beta bu(?:x|cks)|beta[ -]?bux+(?:ing)?'
	},

	// Glorification of mass violence.
	{ id: 'uprising', pattern: '(?:beta|incel) (?:uprising|rebellion)' },
	{
		id: 'saint',
		pattern: '(?:saint|st\\.?|hail) elliot(?:t)?(?: rodger)?|go(?:ing)? elliot rodger'
	},
	{ id: 'gentleman', pattern: 'supreme gentlem[ae]n' }
];

/**
 * Terms with everyday meanings. A record is labelled only when it hits at least
 * two different groups, so several words from one group never add up.
 */
export const WEAK: Readonly<Record<string, string>> = {
	archetype: '(?:giga[ -]?)?chads?|chadpreets?|stacys?|stacies|beckys?|beckies|tyrones?',
	roastie: 'roasties?',
	pill: '(?:red|blue|black|purple)[ -]pills?|(?:red|blue)[ -]?pill(?:ed|er|ers|ing)?',
	cope: 'cop(?:e|es|ing harder)',
	rot: 'ldar|lay(?:ing)? down and rot',
	rank: 'sub[ -]?[58]|psl (?:scale|rating)|[1-9]/10 (?:male|female)|mog(?:s)?|looks[ -]?match(?:ed)?',
	face: 'canthal tilt|hunter eyes|mewing',
	market: 'sexual market ?(?:value|place)|smv|hypergam(?:y|ous)',
	hierarchy: '(?:alpha|beta|sigma) males?|soy[ -]?boys?|normies?|normalfags?',
	forum: 'jfl|over for (?:you|me|us)(?:cels)?|never began|life[ -]?fuel|rage[ -]?fuel',
	rodger: 'elliot rodger|going er|oneitis',
	manosphere:
		'mgtow|amogg(?:ed|ing)|monkey[ -]?branch(?:es|ed|ing)?|beta providers?|wage[ -]?cucks?'
};
