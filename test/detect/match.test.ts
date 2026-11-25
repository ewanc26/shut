import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detect } from "../../src/detect/match.js";

const labelled = [
  // Plain terms.
  "typical foid behaviour",
  "incel",
  "Incels are a public safety problem",
  "police report on inceldom published today",
  "an essay on involuntary celibacy",
  "íncel",
  "i.n.c.e.l",
  "это инцелы",
  "moids are all the same",
  "khhv at 25",
  "kissless, hugless virgin",
  "another arabcel thread",
  "Femoids will never understand",
  "currycel here, AMA",
  "as a heightcel I know",
  "volcels and truecels are different",
  "total blackpill moment",
  "I'm so blackpilled right now",
  "the black pill is brutal",
  "started looksmaxxing last week",
  "looks maxing guide",
  "foids and their gun takes",
  "he got heightmogged",
  "just gymmaxx bro",
  "AWALT, every time",
  "pure ropefuel",
  "cope or rope",
  "it's so over for us ricecels",
  "the beta uprising begins",
  "hail Saint Elliot",
  "a true supreme gentleman",
  "what a chadlite",
  "manlets can't relate",
  // Evasion.
  "f0id",
  "f.o.i.d",
  "what a f o i d",
  "fo​id logic",
  "fоid with a Cyrillic o",
  "ｆｏｉｄ",
  "𝗯𝗹𝗮𝗰𝗸𝗽𝗶𝗹𝗹",
  "fóíd",
  "fooooooid",
  "bl4ckp1ll",
  "b1ackpill",
  "black-pill",
  "#FoidLogic",
  "#blackpill",
  // Weak terms from two different groups.
  "Chad gets everything while normies cope",
  "her SMV drops and he calls it hypergamy, just LDAR",
  "negative canthal tilt, it never began",
  // Deliberate: criticism that repeats the vocabulary is muted too.
  "calling women foids is disgusting and you should stop",
];

const ignored = [
  "cancel my Excel subscription",
  "Marcel posted an excellent parcel",
  "we need to accelerate",
  "Chad from accounting is on leave",
  "Chad, Stacy and Becky are coming to dinner",
  "healthy coping mechanisms",
  "I can't cope with this weather",
  "alpha and beta releases ship this week",
  "Mog the forgetful cat",
  "sunday roasties and gravy",
  "my cat is mewing at the door",
  "going to the ER tonight",
  "the doctor gave me a little black pill",
  "took the red pill in The Matrix",
  "ran a sub 5 minute mile",
  "the LDAR survey found a methane leak",
  "asteroid MOID is 0.02 au",
  "find the MoID of the host in vCenter",
  "mine børn er hhv. 16 og 13",
  "incelebration of the launch",
  "a stem cell study",
  "pumpkin spice latte (PSL) season",
  "maximum looks, minimum effort",
  "fibermaxxing and sleepmaxxing",
  "avoid the void",
  "your FOID card was revoked",
  "Illinois State Police say his FOID had expired",
  "LifeFuel water bottle review",
  "that story is loosely based Elliot said",
  "stop dogpilling on them",
  "a bone smashing blow",
  "Max looks max level now",
  "follow @foid.bsky.social",
  "read https://example.com/blackpill",
  "flight A 1 2 B 3",
  "",
];

describe("detect", () => {
  for (const text of labelled) {
    it(`labels ${JSON.stringify(text)}`, () => assert.equal(detect([text]).matched, true));
  }
  for (const text of ignored) {
    it(`ignores ${JSON.stringify(text)}`, () => {
      const verdict = detect([text]);
      assert.equal(verdict.matched, false, JSON.stringify(verdict));
    });
  }
  it("adds up weak hits across the parts of one record", () => {
    assert.equal(detect(["normies", "pure cope"]).matched, true);
  });
  it("does not count several words from one weak group twice", () => {
    assert.deepEqual(detect(["chad stacy becky tyrone"]).weak, ["archetype"]);
  });
});
