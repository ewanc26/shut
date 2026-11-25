# shut

<p align="center">
  <a href="https://github.com/ewanc26/shut/actions/workflows/ci.yml"><img src="https://github.com/ewanc26/shut/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/ewanc26/shut?label=licence" alt="Licence"></a>
  <a href="https://github.com/sponsors/ewanc26"><img src="https://img.shields.io/github/sponsors/ewanc26?logo=githubsponsors&logoColor=white&label=sponsors" alt="Sponsor"></a>
</p>

**Shut the door on incel language.** shut is a Bluesky labeller that hides it from the people who subscribe.

It watches new posts and profile edits, and labels the ones using incel vocabulary with `incel-language`. Subscribers have that content hidden by default, and can change the setting to warn or show it. A labeller cannot mute anything for people who have not subscribed to it.

> Independent project; see the [trademark notice](TRADEMARKS.md).

## Current state

- The labeller and its website are built and tested.
- **No public instance is running.** There is no account to subscribe to yet.
- The website is intended for `https://shut.croft.click` and is not deployed.

## What gets labelled

Post text, hashtags, image and video alt text, link card titles and descriptions, and profile display names and bios. A label on a post covers that post only. A label on a profile covers the profile, not the account's posts.

| Hit                                       | Examples                                                                                                                                                   | Result       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| One distinctive term                      | "incel" itself, dehumanising names for women and men, `-cel` identities, black pill and looksmaxxing vocabulary, "mogging", glorification of incel attacks | labelled     |
| Terms from two different ambiguous groups | "chad" with "cope", "hypergamy" with "normies"                                                                                                             | labelled     |
| One ambiguous term                        | "chad", "cope", "red pill"                                                                                                                                 | not labelled |

Common disguises are undone first: lookalike and styled characters, accents, invisible characters, `f.o.i.d` spacing, number substitutions and stretched letters. The full list is in [`src/detect/lexicon.ts`](labeller/src/detect/lexicon.ts).

### Limits

- **Matching is on words, not meaning.** Quoting or criticising a term gets labelled too. That is intended: the aim is not to see the language.
- **Every mention of "incel" is labelled**, including news, research and insults. To keep those visible, remove the `incel` rule.
- **Crossover slang is included.** "Mogging" and "looksmaxxing" are now widely used outside incel spaces. In a dry run on 25 November 2026, 216 of about 1.3 million posts matched: most for the word "incel", and 37 only for "mog" or "looksmaxxing" words. Remove the `mog` and `looksmaxx` rules if that is too much.
- **English terms only.** Text inside images and videos is not read.
- **No backfill.** Only posts and profile edits seen while the labeller is running are labelled.

## Try it

Needs Node.js 22.17 or newer and pnpm. None of these needs an account or publishes labels.

```sh
pnpm install
pnpm judge "some text"   # how one piece of text is judged
pnpm sample 60           # matches in live posts for 60 seconds
pnpm dev                 # the website, with a try-it box
```

## Go live

You need a **new Bluesky account** for the labeller (for example with the handle `shut`) and a public HTTPS address pointing at port 14831. WebSockets must be allowed through.

1. Turn the account into a labeller. This asks for the account password and an emailed code, then adds the signing key and server address to the account's identity:

   ```sh
   pnpm setup-account
   ```

   Enter your HTTPS address and save the signing key it prints. When it asks you to define labels, press Esc.

2. Configure:

   ```sh
   cp .env.example .env   # set LABELER_DID and SIGNING_KEY
   ```

3. Publish the label definition. Without `--publish` it only prints it:

   ```sh
   read -rs LABELER_PASSWORD && export LABELER_PASSWORD
   pnpm declare --publish
   unset LABELER_PASSWORD
   ```

   Set `PDS_URL` if the account is not on `bsky.social`.

4. Run it, either directly or in Docker:

   ```sh
   pnpm start
   # or
   docker compose up -d --build
   ```

   On Linux, make `data/` writable by user ID 1000 before using Docker.

5. Open the account's profile in Bluesky and subscribe.

6. Set `LABELLER_HANDLE` in `website/src/lib/site/config.ts`, so the website links to it.

## Running it

- `data/` holds the label database and the Jetstream position. Back it up. After a restart the labeller resumes where it stopped, as far back as Jetstream still holds events.
- If a label cannot be saved the process exits, so run it under something that restarts it.
- Editing a labelled post to remove the language, or deleting it, withdraws the label.
- To withdraw a wrong label by hand, send a negation as the labeller account through `tools.ozone.moderation.emitEvent`, for example from [Ozone-compatible tooling](https://skyware.js.org/docs/labeler). A later matching edit labels the record again.
- In-app reports and appeals are not accepted. Put a contact route in the account's bio.

## Website

A static SvelteKit site in `website/`. The try-it box runs the labeller's own detector in the browser.

```sh
pnpm dev                          # local development
pnpm build                        # static output in website/build
pnpm --filter shut-website og     # redraw the social card (needs Chrome)
```

To deploy on Vercel, set the project's root directory to `website`; `website/vercel.json` holds the commands. Enable access to files outside the root directory, because the site imports the labeller.

## Development

```text
labeller/src/detect/    text normalisation, word list and verdicts
labeller/src/label/     deciding and storing labels
labeller/src/stream/    Jetstream position
labeller/src/server/    the running service
labeller/src/cli/       one-off commands
website/src/            the public page
```

Quality gates:

```sh
pnpm format
pnpm lint
pnpm check
pnpm test
pnpm build
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and the checks required before opening a pull request.

## Licence

MIT

## Support

If you find this project useful, consider supporting its development:
[![Ko-fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/ewancroft)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-30363D?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/ewanc26)
[![Liberapay](https://img.shields.io/badge/Liberapay-A60000?style=for-the-badge&logo=liberapay&logoColor=white)](https://liberapay.com/ewanc26/)
