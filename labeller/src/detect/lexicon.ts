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
	{
		remove: /(?<![\p{L}\p{N}])MOIDs?(?![\p{L}\p{N}])/gu,
		when: /\b(?:asteroids?|orbit(?:s|al)?|comets?|near[- ]earth)\b/i
	},
	// And VMware's managed object ID, which also appears in names such as host_moid.
	{
		remove: /(?<![\p{L}\p{N}])moids?(?![\p{L}\p{N}])/giu,
		when: /\b(?:vmware|vsphere|vcenter|esxi|broadcom|managed object)\b/i
	},
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
	{
		id: 'foid',
		pattern:
			'(?:toilet[ -]?|whore[ -]?)?(?:fem+|f)oid(?:s|al|ism|cel|cels)?|female humanoid organisms?'
	},
	{ id: 'roastie', pattern: 'roasties? (?:whores?|toilets?)|roastie[ -]?(?:logic|whore|toilet)s?' },
	{ id: 'noodlewhore', pattern: '(?:noodle|curry)[ -]?whores?' },

	// "-cel" identities. Listed one by one: a bare suffix would match "cancel" and "excel".
	{
		id: 'cel',
		pattern:
			'(?:fem|curry|rice|black|white|ethnic|height|short|manlet|wrist|skull|frame|gym|true|mental|vol|fake|near|escort|rich|poor|old|young|ugly|brain|looks|jbw|mewing|cope|ginger|virgin|auti|bird|forced|wage|ethni|nig|nigga|bald|autist|aspie|sperg|tall|chad|face|jaw|nose|arab|indian|latino|noodle|dental|giga|ultra|hope|doom|ascend|gr[ae]y|tik[ -]?tok|burger|slave|voice|teen|bro|mayo|it|jap|slav|sand|muslim|turbo|nigger|bean|taco|sushi|kimchi|burrito|churro|chollo|cholo|spic|shawarma|schwarama|inhib(?:ition)?|incel[ -]?)cels?|(?:femcel|truecel|volcel)(?:dom|ibacy|ism)'
	},
	{ id: 'cucktears', pattern: 'cuck[ -]?tears' },

	// Pill ideology. The spaced "black pill" is weak, since it can be a literal pill.
	{ id: 'blackpill', pattern: 'black-?pill(?:s|ed|er|ers|ing)?|black pilled|the black ?pill' },
	{
		id: 'pill',
		pattern:
			'(?:height|looks|race|wrist|face|water|dick|tall|voice|age)[ -]?pill(?:ed|er|ers|ing)|' +
			// Bare nouns only where no real medicine or advert is spelt the same.
			'(?:height|race|wrist)pills?'
	},

	// Appearance ranking.
	{
		id: 'looksmaxx',
		pattern:
			'looks?[ -]?(?:maxx+(?:ed|er|ers|ing)?|max(?:er|ers|ing))|looksmax(?:ed)?|looksmin(?:ned|ner|ning)?|' +
			'(?:status|money|height)max(?:er|ers|ing)'
	},
	{
		id: 'maxx',
		pattern:
			'(?:gym|cuck|jaw|height|money|status|surgery|rice|white|curry|jbw|nt|hard|soft|mew|rope|ascend|frame|hag|jester|low[ -]?inhib)[ -]?maxx(?:ed|er|ers|ing)?'
	},
	{
		id: 'mog',
		pattern:
			'(?:height|frame|jaw|face|looks|wrist|skull|dolph|depp)[ -]?mog(?:s|ged|ger|gers|ging)?|' +
			// Not bare "hair mog": Mog is also a well-known cat.
			'hair[ -]?mog(?:ged|ger|gers|ging)|life-?mog(?:s|ged|ger|gers|ging)?|mogg(?:ed|er|ers|ing)'
	},
	{ id: 'chadlite', pattern: '(?:chad|stacy|becky)[ -]?lites?|chad[ -]?fish(?:ed|ing)?|chadlets?' },
	{ id: 'bonesmash', pattern: 'bonesmash(?:ed|er|ing)|bone[ -]?smash(?:ing)? theory' },
	{ id: 'manlet', pattern: '(?:man|lank)lets?' },

	// Forum shorthand and fatalism.
	{ id: 'awalt', pattern: 'n?awalt' },
	{ id: 'fuel', pattern: '(?:rope|sui|suicide|cope|cage)[ -]?fuel' },
	{ id: 'rope', pattern: 'cope[ -]?or[ -]?rope|rope[ -]?or[ -]?cope' },
	{ id: 'jbwtheory', pattern: 'just be (?:white|asian) theory|deathnics?' },
	{
		id: 'carousel',
		pattern: 'cock carousel|alpha fu(?:x|cks),? beta bu(?:x|cks)|beta[ -]?bux+(?:ed|er|ers|ing)?'
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
	// Only the community's own compound: bare names such as Chad, Stacy, Becky and Tyrone are
	// overwhelmingly people and products, and caused most ambiguous hits in a sample of 200.
	archetype: 'giga[ -]?(?:chads?|stac(?:y|ey|ys|eys|ies))',
	roastie: 'roasties?',
	pill:
		'(?:red|blue|black|purple)[ -]pills?|(?:red|blue)[ -]?pill(?:ed|er|ers|ing)?|' +
		// Joined only: a "white pill" is usually medicine.
		'white-?pill(?:s|ed|er|ers|ing)?',
	cope: 'cop(?:e|es|ing harder)|giga[ -]?cop(?:e|es|ed|ing)',
	rot: 'ldar|lay(?:ing)? down and rot',
	rank: 'sub[ -]?[58]|psl (?:scale|rating)|[1-9]/10 (?:male|female)|mog(?:s)?|looks[ -]?match(?:ed)?',
	face: 'canthal tilt|hunter eyes|mewing',
	market: 'sexual market ?(?:value|place)|smv|hypergam(?:y|ous)',
	hierarchy: '(?:alpha|beta|sigma|omega|gamma) males?|soy[ -]?bo(?:y|i)s?|normies?|normalfags?',
	forum:
		'jfl|over for (?:you|me|us)(?:cels)?|never began|life[ -]?fuel|rage[ -]?fuel|' +
		// Joined only: "it's over" is an ordinary sentence.
		'itsover|gtfih|sex[ -]?havers?',
	rodger: 'elliot rodger|going er|oneitis',
	manosphere:
		'mgtow|amogg(?:ed|ing)|monkey[ -]?branch(?:es|ed|ing)?|beta providers?|wage[ -]?cucks?|' +
		'beta[ -]?cucks?|high[ -]value (?:man|men|male|males)|coomers?|wahmen|wagies?',
	// Used well beyond incel spaces, so one alone never earns the standard label.
	slur: 'sheboons?|cum[ -]?skins?'
};

/**
 * Rules that only earn the strict label and never count towards the standard one: coinages
 * built on incel templates, such as "<anything>pilled", and broad words from published
 * lexicons that are usually innocent.
 */
export const TEMPLATE: readonly Rule[] = [
	{
		id: 'anypill',
		// Not "spilled", fabric "anti-pilling", or a "dogpilling" pile-on.
		pattern: '(?!(?:un|re)?spill|dog-?pill|anti-?pill)\\p{L}{2,}-?pill(?:ed|ing)'
	},
	// Double x only: "climaxing" and "maxing out" are ordinary words. Not the shops TJ and TK Maxx.
	{ id: 'anymaxx', pattern: '(?!t[jk]-?maxx)\\p{L}{2,}-?maxx(?:ed|er|ers|ing)?' },

	// Broad terms. Expect most hits to have nothing to do with incels.
	{
		id: 'names',
		pattern: 'chads?|chad(?:preet|dam|rone|riguez)s?|stac(?:y|ey|ies|eys)|becky|tate'
	},
	{
		id: 'insults',
		pattern:
			'(?:e-?)?whores?|meat[ -]?holes?|toilets?|dicklets?|doof(?:i|y|us|uses)|' +
			'cuck(?:s|ed|ery|ing|old(?:s|ed|ing|ry)?|it|ita|ited)?'
	},
	{ id: 'sexual', pattern: 'loli(?:s|con|cons)?|creep[ -]?shots?|sex[ -]?dolls?' },
	{ id: 'phrases', pattern: "hit(?:s|ting)? the wall|used goods|it'?s over|it is over" },
	{
		id: 'slang',
		pattern:
			// Not the shops TJ and TK Maxx.
			'(?<!t[jk][ -])maxx(?:ed|er|ers|ing)?|sigma|lockdowns?|larpers?|ascend(?:s|ed|ing)?|ascension|' +
			'race[ -]?mix(?:es|ed|er|ers|ing)?|sexhave|female humanoids?|inkels?'
	},
	{ id: 'shorthand', pattern: 'fd|fho|jba|jbw' },
	{
		id: 'compounds',
		pattern:
			'(?:voice|age|dick)-?pills?|dog-?pill(?:s|ed)?|(?:status|money)max|(?:curry|rice|noodle|taco|mayo|jap|sand)-?skins?'
	}
];
