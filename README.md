# shut

A Bluesky labeller that hides incel language.

It watches new posts and profile edits, and labels the ones using incel vocabulary with `incel-language`. People who subscribe to the labeller have that content hidden by default, and can change the setting to warn or show it.

A labeller cannot mute anything for people who have not subscribed to it.

## What gets labelled

Post text, hashtags, image and video alt text, link card titles and descriptions, and profile display names and bios. A label on a post covers that post only. A label on a profile covers the profile, not the account's posts.

| Hit | Examples | Result |
| --- | --- | --- |
| One distinctive term | "incel" itself, dehumanising names for women and men, `-cel` identities, black pill and looksmaxxing vocabulary, "mogging", glorification of incel attacks | labelled |
| Terms from two different ambiguous groups | "chad" with "cope", "hypergamy" with "normies" | labelled |
| One ambiguous term | "chad", "cope", "red pill" | not labelled |

Common disguises are undone first: lookalike and styled characters, accents, invisible characters, `f.o.i.d` spacing, number substitutions and stretched letters. The full list is in [`src/detect/lexicon.ts`](src/detect/lexicon.ts).

### Limits

- **Matching is on words, not meaning.** Quoting or criticising a term gets labelled too. That is intended: the aim is not to see the language.
- **Every mention of "incel" is labelled**, including news, research and insults. To keep those visible, remove the `incel` rule.
- **Crossover slang is included.** "Mogging" and "looksmaxxing" are now widely used outside incel spaces. In a dry run on 25 November 2026, 216 of about 1.3 million posts matched: most for the word "incel", and 37 only for "mog" or "looksmaxxing" words. Remove the `mog` and `looksmaxx` rules if that is too much.
- **English terms only.** Text inside images and videos is not read.
- **No backfill.** Only posts and profile edits seen while the labeller is running are labelled.

## Try it

Needs Node.js 22.9 or newer. None of these needs an account or publishes labels.

```sh
npm install
npm run check -- "some text"       # how one piece of text is judged
npm run sample -- 60               # matches in live posts for 60 seconds
npm test
```

## Go live

You need a **new Bluesky account** for the labeller (for example with the handle `shut`) and a public HTTPS address pointing at port 14831. WebSockets must be allowed through.

1. Turn the account into a labeller. This asks for the account password and an emailed code, then adds the signing key and server address to the account's identity:

   ```sh
   npx @skyware/labeler setup
   ```

   Enter your HTTPS address and save the signing key it prints. When it asks you to define labels, press Esc.

2. Configure:

   ```sh
   cp .env.example .env   # set LABELER_DID and SIGNING_KEY
   ```

3. Publish the label definition. Without `--publish` it only prints it:

   ```sh
   read -rs LABELER_PASSWORD && export LABELER_PASSWORD
   npm run declare -- --publish
   unset LABELER_PASSWORD
   ```

   Set `PDS_URL` if the account is not on `bsky.social`.

4. Run it, either directly or in Docker:

   ```sh
   npm start
   # or
   docker compose up -d --build
   ```

   On Linux, make `data/` writable by user ID 1000 before using Docker.

5. Open the account's profile in Bluesky and subscribe.

## Running it

- `data/` holds the label database and the Jetstream position. Back it up. After a restart the labeller resumes where it stopped, as far back as Jetstream still holds events.
- If a label cannot be saved the process exits, so run it under something that restarts it.
- Editing a labelled post to remove the language, or deleting it, withdraws the label.
- To withdraw a wrong label by hand, send a negation as the labeller account through `tools.ozone.moderation.emitEvent`, for example from [Ozone-compatible tooling](https://skyware.js.org/docs/labeler). A later matching edit labels the record again.
- In-app reports and appeals are not accepted. Put a contact route in the account's bio.

## Licence

MIT

## Support
If you find this project useful, consider supporting its development:
[![Ko-fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/ewancroft)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-30363D?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/ewanc26)
