// Plain descriptions of the detector's rules, so the page never has to print the terms.

/** One entry for every strong rule id in the labeller's word list. */
export const STRONG_REASONS: Readonly<Record<string, string>> = {
	incel: 'The name of the movement',
	moid: 'Dehumanising name for men',
	khhv: 'Community self-description',
	foid: 'Dehumanising name for women',
	roastie: 'Dehumanising name for women',
	noodlewhore: 'Dehumanising name for women',
	cel: 'A “-cel” identity',
	cucktears: 'Community slang',
	blackpill: 'Black pill ideology',
	pill: '“Pill” ideology',
	looksmaxx: 'Appearance ranking',
	maxx: 'Appearance ranking',
	mog: 'Appearance ranking',
	chadlite: 'Appearance ranking',
	bonesmash: 'Appearance ranking',
	manlet: 'Insult about height',
	awalt: 'Forum shorthand about women',
	fuel: 'Forum slang for despair',
	rope: 'Forum slang about self-harm',
	jbwtheory: 'Racial ranking theory',
	carousel: 'Slur about women’s sex lives',
	uprising: 'Talk of violent revolt',
	saint: 'Praise for an attacker',
	gentleman: 'Echo of an attacker’s words'
};

/** One entry for every weak group in the labeller's word list. */
export const WEAK_REASONS: Readonly<Record<string, string>> = {
	archetype: 'Stock character names',
	roastie: 'A word that is also food',
	pill: 'Coloured “pills”',
	cope: '“Cope”',
	rot: 'Fatalist shorthand',
	rank: 'Rating scales',
	face: 'Face-feature jargon',
	market: 'Dating-market jargon',
	hierarchy: 'Social-rank labels',
	forum: 'General forum shorthand',
	rodger: 'References that are often innocent',
	manosphere: 'Wider “manosphere” slang'
};
