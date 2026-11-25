// Undoes the common tricks used to slip terms past word filters.

/** Lookalike characters from other scripts, applied only to words that also contain Latin letters. */
const CONFUSABLES: Record<string, string> = {
  а: "a", в: "b", е: "e", і: "i", ј: "j", к: "k", м: "m", н: "h", о: "o", р: "p",
  с: "c", ѕ: "s", т: "t", у: "y", х: "x", ԁ: "d", α: "a", β: "b", ε: "e", ι: "i",
  κ: "k", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x", ı: "i", ɡ: "g",
};

const LEET: Record<string, string> = { "0": "o", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };

const URL_OR_DOMAIN = /\bhttps?:\/\/\S+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|social|app|co|uk|io|dev|me|xyz|gg|tv)\b(?:\/\S*)?/gi;
const MENTION = /(?<![\p{L}\p{N}])@(?:[a-z0-9-]+\.)+[a-z]{2,}/giu;

/** Runs of single letters with one consistent separator, such as "f.o.i.d" or "f o i d". */
const SPACED = /(?<![\p{L}\p{N}])\p{L}([ .\-_*])(?:\p{L}\1)+\p{L}(?![\p{L}\p{N}])/gu;

function splitHashtags(text: string): string {
  return text.replace(/#[\p{L}\p{N}_]+/gu, (tag) =>
    tag.replace(/_/g, " ").replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2"),
  );
}

function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\p{M}\p{Cf}]/gu, "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[‐-―]/g, "-")
    .replace(/[\p{L}\p{M}]+/gu, (word) =>
      /[a-z]/.test(word) ? Array.from(word, (c) => CONFUSABLES[c] ?? c).join("") : word,
    );
}

function unleet(text: string, one: "i" | "l"): string {
  return text.replace(/[a-z0-9@$]+/g, (word) =>
    // Pure numbers and words starting with a digit run ("5th", "4am") are left alone.
    /[a-z]/.test(word) && !/^\d+[a-z]{0,2}$/.test(word)
      ? Array.from(word, (c) => (c === "1" ? one : (LEET[c] ?? c))).join("")
      : word,
  );
}

/** Returns the distinct readings of a piece of text that the lexicon is matched against. */
export function variants(text: string): string[] {
  const cleaned = text.replace(MENTION, " ").replace(URL_OR_DOMAIN, " ");
  const bases = new Set([fold(cleaned), fold(splitHashtags(cleaned))]);
  const out = new Set<string>();

  for (const base of bases) {
    const joined = base.replace(SPACED, (run, separator: string) => {
      const word = run.split(separator).join("");
      // "a f o i d" also swallows the article, so keep a reading without it.
      return /^[ai]/.test(word) ? `${word} ${word.slice(1)}` : word;
    });
    for (const reading of [base, joined]) {
      for (const leet of [reading, unleet(reading, "i"), unleet(reading, "l")]) {
        out.add(leet);
        out.add(leet.replace(/(\p{L})\1{2,}/gu, "$1"));
        out.add(leet.replace(/(\p{L})\1{2,}/gu, "$1$1"));
      }
    }
  }
  return [...out];
}
