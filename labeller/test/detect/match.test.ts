import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { detect } from '../../src/detect/match.js';

const labelled = [
	// Plain terms.
	'typical foid behaviour',
	'incel',
	'Incels are a public safety problem',
	'police report on inceldom published today',
	'an essay on involuntary celibacy',
	'íncel',
	'i.n.c.e.l',
	'это инцелы',
	'moids are all the same',
	'khhv at 25',
	'kissless, hugless virgin',
	'another arabcel thread',
	'Femoids will never understand',
	'currycel here, AMA',
	'as a heightcel I know',
	'volcels and truecels are different',
	'total blackpill moment',
	"I'm so blackpilled right now",
	'the black pill is brutal',
	'started looksmaxxing last week',
	'looks maxing guide',
	'foids and their gun takes',
	'he got heightmogged',
	'just gymmaxx bro',
	'AWALT, every time',
	'pure ropefuel',
	'cope or rope',
	"it's so over for us ricecels",
	'the beta uprising begins',
	'hail Saint Elliot',
	'a true supreme gentleman',
	'what a chadlite',
	"manlets can't relate",
	'an inceltears screenshot',
	'the incelosphere',
	'his deincelification arc',
	'gingercel here',
	'life as a virgincel',
	'auticel problems',
	'birdcel profile',
	'forcedcel',
	'another wagecel shift',
	'ethnicel struggles',
	'nigcel',
	'niggacel',
	'time to hagmaxx',
	'lowinhibmaxxing tonight',
	'got wristmogged',
	'skullmogged again',
	'such a chadlet',
	'the bone smash theory',
	'nawalt, apparently',
	'total suicidefuel',
	'she wants a betabux',
	'betabuxing for years',
	'mgtow forums are full of ragefuel',
	'giga chad and the beta provider',
	// Newer identities and compounds.
	'such a greycel take',
	'graycels everywhere',
	'another tiktokcel',
	'tik tokcel behaviour',
	'burgercel problems',
	'just a slavecel',
	'voicecel and proud',
	'an inhibcel at the bar',
	'an inhibitioncel',
	'jestermaxxing to get a date',
	'he got hairmogged',
	'my friend was hair mogging me',
	'no lanklets allowed',
	'she wants a high value man, pure hypergamy',
	'normies calling him a beta cuck',
	'an omega male on the black pill',
	// Evasion.
	'#Foid_Logic',
	'f_o_i_d',
	'f0id',
	'f.o.i.d',
	'what a f o i d',
	'fo​id logic',
	'fоid with a Cyrillic o',
	'ｆｏｉｄ',
	'𝗯𝗹𝗮𝗰𝗸𝗽𝗶𝗹𝗹',
	'fóíd',
	'fooooooid',
	'bl4ckp1ll',
	'b1ackpill',
	'black-pill',
	'#FoidLogic',
	'#blackpill',
	// Weak terms from two different groups.
	'Giga Chad gets everything while normies cope',
	'her SMV drops and he calls it hypergamy, just LDAR',
	'negative canthal tilt, it never began',
	// Deliberate: criticism that repeats the vocabulary is muted too.
	'calling women foids is disgusting and you should stop'
];

const ignored = [
	'cancel my Excel subscription',
	'Marcel posted an excellent parcel',
	'we need to accelerate',
	'Chad from accounting is on leave',
	'Chad, Stacy and Becky are coming to dinner',
	'healthy coping mechanisms',
	"I can't cope with this weather",
	'alpha and beta releases ship this week',
	'Mog the forgetful cat',
	'sunday roasties and gravy',
	'my cat is mewing at the door',
	'going to the ER tonight',
	'the doctor gave me a little black pill',
	'took the red pill in The Matrix',
	'ran a sub 5 minute mile',
	'the LDAR survey found a methane leak',
	'asteroid MOID is 0.02 au',
	'find the MoID of the host in vCenter',
	'mine børn er hhv. 16 og 13',
	'incelebration of the launch',
	'a stem cell study',
	'pumpkin spice latte (PSL) season',
	'maximum looks, minimum effort',
	'fibermaxxing and sleepmaxxing',
	'avoid the void',
	'(@mog_example) normies',
	'@chad_example says cope',
	'the psl scale of @mog_example',
	'a ginger cat and a virgin olive oil',
	'an original animation cel of a bird',
	'the minimum wage went up',
	'ethnic food festival',
	'smashing a bone china plate',
	'my theory about bone density',
	'beta build for bux holders',
	'a fuel station near the suicide prevention office',
	'the engine runs on fuel',
	'monkey bars and tree branches',
	'internet provider in beta',
	'pure ragefuel, this referee',
	'chadpreet is my cousin',
	'chadpreet and the beta provider',
	'Stacy and Becky and Tyrone on the team',
	'wage packets and cuckoo clocks',
	'a wrist mount for the mug',
	'your FOID card was revoked',
	'Illinois State Police say his FOID had expired',
	'LifeFuel water bottle review',
	'that story is loosely based Elliot said',
	'stop dogpilling on them',
	'a bone smashing blow',
	'Max looks max level now',
	'grey cells',
	'burger and my cell phone',
	'the slave cells block',
	'voice cell therapy',
	'inhibition cell culture',
	'tiktok cell phone deals',
	'a court jester at the fair',
	'her long hair, Mog the cat',
	'a lanky lad',
	'a high value manuscript',
	'high-value males in the breeding herd',
	'the beta cuckoo clock',
	'omega male lions',
	'vmware host_moid value',
	'#vmware #moid_lookup',
	'Broadcom KB _moid_',
	'asteroid_MOID for the comet',
	'follow @foid.bsky.social',
	'read https://example.com/blackpill',
	'flight A 1 2 B 3',
	''
];

describe('detect', () => {
	for (const text of labelled) {
		it(`labels ${JSON.stringify(text)}`, () => assert.equal(detect([text]).matched, true));
	}
	for (const text of ignored) {
		it(`ignores ${JSON.stringify(text)}`, () => {
			const verdict = detect([text]);
			assert.equal(verdict.matched, false, JSON.stringify(verdict));
		});
	}
	it('adds up weak hits across the parts of one record', () => {
		assert.equal(detect(['normies', 'pure cope']).matched, true);
	});
	it('gives the strict label to every standard match', () => {
		for (const text of labelled) assert.equal(detect([text]).strict, true, text);
	});
	it('gives the strict label, and only that, for one ambiguous group', () => {
		for (const text of ['pure cope', 'took the red pill in The Matrix', 'giga chad']) {
			const verdict = detect([text]);
			assert.equal(verdict.matched, false, text);
			assert.equal(verdict.strict, true, text);
		}
	});
	it('gives the strict label, and only that, for coinages on incel templates', () => {
		for (const text of [
			'so atprotopilled lately',
			'protocolmaxxing all weekend',
			'Atproto-Pilled',
			'bskypilled',
			'fibermaxxing and sleepmaxxing'
		]) {
			const verdict = detect([text]);
			assert.equal(verdict.matched, false, text);
			assert.equal(verdict.strict, true, text);
			assert.equal(verdict.template.length, 1, text);
		}
	});
	it('leaves ordinary words alone in the template rules', () => {
		for (const text of [
			'I spilled my coffee',
			'unspilled milk',
			'an anti-pilling fleece',
			'stop dogpilling on them',
			'the film was climaxing',
			'maxxing out the card',
			'the sweater pilled in the wash',
			'take your pills'
		]) {
			assert.equal(detect([text]).strict, false, text);
		}
	});
	it('gives no strict label to text without any term', () => {
		for (const text of ['cancel my Excel subscription', 'Chad from accounting is on leave', '']) {
			assert.equal(detect([text]).strict, false, text);
		}
	});
	it('does not count several words from one weak group twice', () => {
		assert.deepEqual(detect(['giga chad stacy becky tyrone']).weak, ['archetype']);
	});
});
