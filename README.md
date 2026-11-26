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

It watches new posts and profiles, and labels the ones using incel vocabulary with `incel-language`. Subscribers have that content hidden by default, and can change the setting to warn or show it. A labeller cannot mute anything for people who have not subscribed to it.

A second, stricter label, `incel-language-strict`, also covers a single ambiguous term, coinages on incel templates such as "-pilled" and "-maxxing", and broad words from published lexicons. It is off by default; subscribers who want it switch it to hide or warn. Everything with the standard label also has the strict one, so either setting can be used on its own.

> [!WARNING]
> **Disclaimer.** shut matches words, not meaning. A label does not say that an author is an incel or holds any view, and the word list is neither complete nor reliably precise. The strict label in particular includes common names, everyday words and phrases such as "Chad", "toilet", "lockdown" and "it's over", so most of what it catches is likely to be unrelated. The word list contains slurs and sexual terms. shut is provided as is, without warranty, under the [MIT licence](LICENSE).

> Independent project; see the [trademark notice](TRADEMARKS.md).

## Subscribe

Open [@shut.croft.click](https://bsky.app/profile/shut.croft.click) on Bluesky and subscribe to the labeller. Labelling started on 25 November 2026; earlier posts are not covered. The website is at [shut.croft.click](https://shut.croft.click).

## What gets labelled

Post text, hashtags, image and video alt text, link card titles and descriptions, and profile display names and bios. A label on a post covers that post only. A label on a profile covers the profile, not the account's posts.

| Hit                                       | Examples                                                                                                                                                   | `incel-language` | `incel-language-strict` |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------- |
| One distinctive term                      | "incel" itself, dehumanising names for women and men, `-cel` identities, black pill and looksmaxxing vocabulary, "mogging", glorification of incel attacks | labelled         | labelled                |
| Terms from two different ambiguous groups | "giga chad" with "cope", "hypergamy" with "normies"                                                                                                        | labelled         | labelled                |
| One ambiguous term                        | "giga chad", "cope", "red pill"                                                                                                                            | not labelled     | labelled                |
| A coinage on an incel template            | anything ending in "-pilled" or "-maxxing", such as "atprotopilled" or "protocolmaxxing"                                                                   | not labelled     | labelled                |
| A broad word or phrase                    | "Chad", "toilet", "lockdown", "sigma", "used goods"                                                                                                        | not labelled     | labelled                |

Common disguises are undone first: lookalike and styled characters, accents, invisible characters, `f.o.i.d` spacing, number substitutions and stretched letters. The full list is in [`src/detect/lexicon.ts`](labeller/src/detect/lexicon.ts).

### Limits

- **The strict label is often wrong.** "Cope", "normies" and "red pill" are everyday words, and "sleepmaxxing" or "bskypilled" are ordinary slang now, so most posts with only the strict label are not about incels at all.
- **Matching is on words, not meaning.** Quoting or criticising a term gets labelled too. That is intended: the aim is not to see the language.
- **Every mention of "incel" is labelled**, including news, research and insults. To keep those visible, remove the `incel` rule.
- **Crossover slang is included.** "Mogging", "looksmaxxing" and "jestermaxxing" are now widely used outside incel spaces. In a dry run on 25 November 2026, 190 of about 1.3 million posts matched: most for the word "incel", and 36 only for "mog" or "looksmaxxing" words. Remove the `mog` and `looksmaxx` rules if that is too much.
- **English terms only.** Text inside images and videos is not read.
- **No backfill of posts.** Only posts seen while the labeller is running are labelled. Existing profiles are checked once, for accounts seen posting (see [Running it](#running-it)).

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

   It asks for the account password and an emailed code, adds the signing key and server address to the account's identity, publishes the labels, and offers a profile if the account has none. It uses the same signing key as the server.

4. Set `LABELLER_HANDLE` in `website/src/lib/site/config.ts`, so the website links to the account.

## Running it

- An instance set up before the strict label existed needs `pnpm declare --publish` once, so the account advertises it. Until then, apps ignore it.
- `data/` holds the label database and the Jetstream position. Back it up. After a restart the labeller resumes where it stopped, as far back as Jetstream still holds events.
- When an account posts for the first time, the labeller asks Bluesky's public API (`public.api.bsky.app`) for its existing profile, in batches, and judges it. The account is then remembered in the database and not fetched again, even after the word list changes; later edits arrive on the stream. Set `PROFILE_CHECK=off` to disable this.
- Requests to the public API, and the backfill's requests to the post archive, are rate limited per server. After a 429 nothing more is sent to that server until the time it asks for, and requests slow down as an advertised quota runs low.
- If a label cannot be saved the process exits, so run it under something that restarts it.
- Editing a labelled post to remove the language, or deleting it, withdraws the label.
- To withdraw a wrong label by hand, send a negation as the labeller account through `tools.ozone.moderation.emitEvent`, for example from [Ozone-compatible tooling](https://skyware.js.org/docs/labeler). A later matching edit labels the record again.
- In-app reports and appeals are not accepted. Put a contact route in the account's bio.

## Backfill

`pnpm backfill` reads Bluesky's post archive through [Jetstream v2](https://bsky.network/docs/jetstream-replay) and queues the posts that would earn `incel-language`. **It labels and publishes nothing**, and there is not yet a tool that publishes the queue. The queue is for the standard label only: backfilled posts are not meant to get `incel-language-strict`.

1. Create a token at <https://bsky.network/account> and set it as `JETSTREAM_API_KEY` in `.env`. Downloads are metered against it.
2. Try it for a few minutes with `pnpm backfill --minutes 5`. It reports events, posts, matches, bytes downloaded and speed.

The queue is `backfill.db` in the data directory, holding post addresses, versions and account IDs, never text. Deleted posts and accounts, and posts edited so they no longer match, are removed as the archive reports them. Stop it with Ctrl-C and run it again to carry on.

The download is read in memory and not kept. As a safeguard, the scan stops once the queue and `labels.db` together reach 10 GiB; change that with `BACKFILL_MAX_GIB`.

## Experimental judge

A free [OpenCode](https://opencode.ai/docs/zen/) model can give a second opinion on posts and profiles the word list leaves unlabelled because they hit only one ambiguous group. **It cannot write labels.** It is off by default, uses no API key (whether answers arrive without signing in is untested), and runs OpenCode inside the labeller through [`@opencode/sdk`](https://opencode.ai/docs/build/sdk/). To try it, set this in `.env`:

```sh
AI_JUDGE=shadow
```

The labeller then logs the address of each record it would have labelled, and running totals every 25 calls. It asks for one plain reply, with no session, agent or tools.

Read these before turning it on:

- **The free allowance is small.** Its size is not published. On the one machine tried, the first request was refused with "Free usage limit reached" and a wait of over three hours. On a rate limit the judge waits until the time given, and queues what arrives meanwhile. Ambiguous records numbered about 1,600 a day before bare names stopped counting, far beyond `AI_JUDGE_DAILY_LIMIT` (default 200).
- **Check the terms.** [OpenCode's terms](https://opencode.ai/legal/terms-of-service) limit use to your own internal use, not on behalf of third parties, and restrict programmatic extraction of output. Whether a public labeller fits is for its operator to decide. Free models are offered for a limited time.
- **Text leaves your server.** The whole text of each such record, including alt text and link card text, goes to OpenCode and the model's provider. The author's DID and the record's address are not added to it.
- **Only two models are allowed.** `AI_JUDGE_MODEL` accepts `deepseek-v4.1-flash-free` (default) or `hy4-flash-free`, which OpenCode documents as zero retention and no training. Some other free models keep inputs or train on them.
- **It is heavy.** In a local build the Docker image grew from 625 MB to 1.24 GB, and a labeller with the judge on used about 525 MB of memory against 70 MB without. Its text generation call is marked experimental.
- **Its accuracy is unknown.** No request has been answered yet. `pnpm evaluate` runs 16 invented sentences through a model and prints where it disagrees. A good score there says little about real posts.

It never holds up labelling: one call runs at a time and gives up after 30 seconds. Records over a rate limit or the daily limit wait in a queue. The queue is held in memory only, so a restart empties it. It keeps up to 5,000 records, dropping the oldest, and gives up on any that have waited a day. A record that is deleted, or edited so it no longer needs an opinion, leaves the queue; deleting a whole account does not remove its records. OpenCode keeps its files in `data/opencode/`, apart from any OpenCode setup on the machine. If you run a public instance with it on, update the privacy note on the website first.

`pnpm learn 10` watches live posts for ten minutes and saves word counts to `data/judge-counts.json`, using the word list's own decisions as labels. It keeps only words seen in at least 20 posts, and no post text. Nothing reads the counts yet.

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

## Credits

Some word-list entries were informed by the table of incel-specific words in Jennifer Golbeck, "A dataset for the study of online radicalization through incel forum archives", _Journal of Quantitative Description: Digital Media_ (2024), [doi:10.51685/jqd.2024.004](https://doi.org/10.51685/jqd.2024.004). Further entries were informed by the lexicon in Emily Klein and Jennifer Golbeck, "A lexicon for studying radicalization in incel communities", _WebSci '24_, [doi:10.1145/3614419.3644005](https://doi.org/10.1145/3614419.3644005), whose appendix is published with the [data record](https://doi.org/10.7910/DVN/MS9ODP) under CC BY-SA 4.0. shut does not use the forum posts in that dataset.

Use of the dataset from [IYKYK: Using language models to decode extremist cryptolects](https://arxiv.org/abs/2506.05635) is planned, not guaranteed. Nothing in shut uses it yet. Credit to its authors:

```bibtex
@misc{dekock2025iykykusinglanguagemodels,
  title={IYKYK: Using language models to decode extremist cryptolects},
  author={Christine de Kock and Arij Riabi and Zeerak Talat and Michael Sejr Schlichtkrull and Pranava Madhyastha and Eduard Hovy},
  year={2025},
  eprint={2506.05635},
  archivePrefix={arXiv},
  primaryClass={cs.CL},
  url={https://arxiv.org/abs/2506.05635}
}
```

## Licence

MIT

## Support

If you find this project useful, consider supporting its development:
[![Ko-fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/ewancroft)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-30363D?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/ewanc26)
[![Liberapay](https://img.shields.io/badge/Liberapay-A60000?style=for-the-badge&logo=liberapay&logoColor=white)](https://liberapay.com/ewanc26/)
