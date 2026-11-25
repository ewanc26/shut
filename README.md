# shut

<p align="center">
  <img src="website/static/favicon.svg" alt="shut logo: a red hanging door sign" width="128" height="128">
</p>

<p align="center">
  <a href="https://github.com/ewanc26/shut/actions/workflows/ci.yml"><img src="https://github.com/ewanc26/shut/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/ewanc26/shut?label=licence" alt="Licence"></a>
  <a href="https://github.com/sponsors/ewanc26"><img src="https://img.shields.io/github/sponsors/ewanc26?logo=githubsponsors&logoColor=white&label=sponsors" alt="Sponsor"></a>
</p>

**Shut the door on incel language.** shut is a Bluesky labeller that hides it from the people who subscribe.

It watches new posts and profile edits, and labels the ones using incel vocabulary with `incel-language`. Subscribers have that content hidden by default, and can change the setting to warn or show it. A labeller cannot mute anything for people who have not subscribed to it.

> Independent project; see the [trademark notice](TRADEMARKS.md).

## Subscribe

Open [@shut.croft.click](https://bsky.app/profile/shut.croft.click) on Bluesky and subscribe to the labeller. Labelling started on 25 November 2026; earlier posts are not covered. The website is at [shut.croft.click](https://shut.croft.click).

## What gets labelled

Post text, hashtags, image and video alt text, link card titles and descriptions, and profile display names and bios. A label on a post covers that post only. A label on a profile covers the profile, not the account's posts.

| Hit                                       | Examples                                                                                                                                                   | Result       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| One distinctive term                      | "incel" itself, dehumanising names for women and men, `-cel` identities, black pill and looksmaxxing vocabulary, "mogging", glorification of incel attacks | labelled     |
| Terms from two different ambiguous groups | "giga chad" with "cope", "hypergamy" with "normies"                                                                                                        | labelled     |
| One ambiguous term                        | "giga chad", "cope", "red pill"                                                                                                                            | not labelled |

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

To run your own, you need a **new Bluesky account** for the labeller and a public HTTPS address pointing at port 14831. WebSockets must be allowed through.

1. Configure, using the new account's DID and server address, and a new signing key:

   ```sh
   cp .env.example .env          # set LABELER_DID and PDS_URL
   openssl rand -hex 32          # set the result as SIGNING_KEY, and back it up
   ```

2. Run the server, either directly or in Docker, and point your HTTPS address at it:

   ```sh
   pnpm start
   # or
   docker compose up -d --build
   ```

   On Linux, make `data/` writable by user ID 1000 before using Docker.

3. In your own terminal, turn the account into a labeller:

   ```sh
   pnpm activate https://labels.example
   ```

   It asks for the account password and an emailed code, adds the signing key and server address to the account's identity, publishes the label, and offers a profile if the account has none. It uses the same signing key as the server.

4. Set `LABELLER_HANDLE` in `website/src/lib/site/config.ts`, so the website links to the account.

## Running it

- `data/` holds the label database and the Jetstream position. Back it up. After a restart the labeller resumes where it stopped, as far back as Jetstream still holds events.
- If a label cannot be saved the process exits, so run it under something that restarts it.
- Editing a labelled post to remove the language, or deleting it, withdraws the label.
- To withdraw a wrong label by hand, send a negation as the labeller account through `tools.ozone.moderation.emitEvent`, for example from [Ozone-compatible tooling](https://skyware.js.org/docs/labeler). A later matching edit labels the record again.
- In-app reports and appeals are not accepted. Put a contact route in the account's bio.

## Experimental judge

A free [OpenCode](https://opencode.ai/docs/zen/) model can give a second opinion on posts and profiles the word list leaves unlabelled because they hit only one ambiguous group. **It cannot write labels.** It is off by default, needs no API key, and runs OpenCode inside the labeller through [`@opencode/sdk`](https://opencode.ai/docs/build/sdk/). To try it, set this in `.env`:

```sh
AI_JUDGE=shadow
```

The labeller then logs the address of each record it would have labelled, and running totals every 25 calls. It asks for one plain reply, with no session, agent or tools.

Read these before turning it on:

- **The free allowance is small.** Its size is not published. On the one machine tried, the first request was refused with "Free usage limit reached" and a wait of over three hours. On a rate limit the judge stops until the time given, and skips what arrives meanwhile. Ambiguous records numbered about 1,600 a day before bare names stopped counting, far beyond `AI_JUDGE_DAILY_LIMIT` (default 200).
- **Check the terms.** [OpenCode's terms](https://opencode.ai/legal/terms-of-service) limit use to your own internal use, not on behalf of third parties, and restrict programmatic extraction of output. Whether a public labeller fits is for its operator to decide. Free models are offered for a limited time.
- **Text leaves your server.** The whole text of each such record, including alt text and link card text, goes to OpenCode and the model's provider. The author's DID and the record's address are not added to it.
- **Only two models are allowed.** `AI_JUDGE_MODEL` accepts `deepseek-v4.1-flash-free` (default) or `hy4-flash-free`, which OpenCode documents as zero retention and no training. Some other free models keep inputs or train on them.
- **It is heavy.** In a local build the Docker image grew from 625 MB to 1.24 GB, and a labeller with the judge on used about 525 MB of memory against 70 MB without. Its text generation call is marked experimental.
- **Its accuracy is unknown.** No request has been answered yet. `pnpm evaluate` runs 16 invented sentences through a model and prints where it disagrees. A good score there says little about real posts.

It never holds up labelling: one call runs at a time, gives up after 30 seconds, and anything over the limits is skipped. OpenCode keeps its files in `data/opencode/`, apart from any OpenCode setup on the machine. If you run a public instance with it on, update the privacy note on the website first.

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
labeller/src/judge/     experimental model opinion, log only
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
