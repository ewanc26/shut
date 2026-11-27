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

It watches new posts and profiles, and labels the ones using incel vocabulary: posts with `incel-language`, profiles with `incel-language-profile`. Subscribers have that content hidden by default, and can change the setting to warn or show it. A labeller cannot mute anything for people who have not subscribed to it.

Each also has a broader label for **incel influenced language**: `incel-language-strict` for posts and `incel-language-profile-strict` for profiles. It also covers a single ambiguous term, coinages on incel templates such as "-pilled" and "-maxxing", and broad words from published lexicons. It is off by default; subscribers who want it switch it to hide or warn. Everything with an incel language label also has the matching influenced one, so either setting can be used on its own. (The post label keeps the identifier it was published under, from when it was called the strict label.)

> [!WARNING]
> **Disclaimer.** shut matches words, not meaning. A label does not say that an author is an incel or holds any view, and the word list is neither complete nor reliably precise. The incel influenced language labels in particular include common names, everyday words and phrases such as "Chad", "toilet", "lockdown" and "it's over", so most of what it catches is likely to be unrelated. The word list contains slurs and sexual terms. shut is provided as is, without warranty, under the [MIT licence](LICENSE).

> Independent project; see the [trademark notice](TRADEMARKS.md).

## Subscribe

Open [@shut.croft.click](https://bsky.app/profile/shut.croft.click) on Bluesky and subscribe to the labeller. Labelling started on 25 November 2026; earlier posts are not covered. The website is at [shut.croft.click](https://shut.croft.click).

## What gets labelled

Post text, hashtags, image and video alt text, link card titles and descriptions, and profile display names and bios. A label on a post covers that post only. A profile label covers the profile, not the account's posts.

| Hit                                       | Examples                                                                                                                                                   | Incel language | Incel influenced language |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------- |
| One distinctive term                      | "incel" itself, dehumanising names for women and men, `-cel` identities, black pill and looksmaxxing vocabulary, "mogging", glorification of incel attacks | labelled       | labelled                  |
| Terms from two different ambiguous groups | "giga chad" with "cope", "hypergamy" with "normies"                                                                                                        | labelled       | labelled                  |
| One ambiguous term                        | "giga chad", "cope", "red pill"                                                                                                                            | not labelled   | labelled                  |
| A coinage on an incel template            | anything ending in "-pilled" or "-maxxing", such as "atprotopilled" or "protocolmaxxing"                                                                   | not labelled   | labelled                  |
| A broad word or phrase                    | "Chad", "toilet", "lockdown", "sigma", "used goods"                                                                                                        | not labelled   | labelled                  |

Common disguises are undone first: lookalike and styled characters, accents, invisible characters, `f.o.i.d` spacing, number substitutions and stretched letters. The full list is in [`src/detect/lexicon.ts`](labeller/src/detect/lexicon.ts).

### Limits

- **The incel influenced language labels are often wrong.** "Cope", "normies" and "red pill" are everyday words, and "sleepmaxxing" or "bskypilled" are ordinary slang now, so most posts with only the influenced label are not about incels at all.
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

- An instance set up before the profile labels existed, or before the strict label was renamed, needs `pnpm declare --publish` once, so the account advertises the current labels. Until then, apps ignore the new ones.
- On starting, the labeller moves profiles that were given `incel-language` or `incel-language-strict` before profiles had their own labels: it withdraws those and applies `incel-language-profile` and `incel-language-profile-strict` in their place. After that it finds nothing to move.
- `data/` holds the label database and the Jetstream position. Back it up. After a restart the labeller resumes where it stopped, as far back as Jetstream still holds events.
- When an account posts for the first time, the labeller asks Bluesky's public API (`public.api.bsky.app`) for its existing profile, in batches, and judges it. The account is then remembered in the database and not fetched again, even after the word list changes; later edits arrive on the stream. Set `PROFILE_CHECK=off` to disable this.
- Requests to the public API, and the backfill's requests to the post archive, are rate limited per server. After a 429 nothing more is sent to that server until the time it asks for, and requests slow down as an advertised quota runs low.
- If a label cannot be saved the process exits, so run it under something that restarts it.
- Editing a labelled post to remove the language, or deleting it, withdraws the label.
- To withdraw a wrong label by hand, send a negation as the labeller account through `tools.ozone.moderation.emitEvent`, for example from [Ozone-compatible tooling](https://skyware.js.org/docs/labeler). A later matching edit labels the record again.
- In-app reports and appeals are not accepted. Put a contact route in the account's bio.

## Backfill

`pnpm backfill` reads Bluesky's post archive through [Jetstream v2](https://bsky.network/docs/jetstream-replay) and queues the posts that would earn `incel-language`. **It labels and publishes nothing**, and there is not yet a tool that publishes the queue. The queue is for the incel language label only: backfilled posts are not meant to get the influenced label, `incel-language-strict`.

1. Create a token at <https://bsky.network/account> and set it as `JETSTREAM_API_KEY` in `.env`. Downloads are metered against it.
2. Try it for a few minutes with `pnpm backfill --minutes 5`. It reports events, posts, matches, bytes downloaded and speed.

The queue is `backfill.db` in the data directory, holding post addresses, versions and account IDs, never text. Deleted posts and accounts, and posts edited so they no longer match, are removed as the archive reports them. Stop it with Ctrl-C and run it again to carry on.

The download is read in memory and not kept. As a safeguard, the scan stops once the queue and `labels.db` together reach 10 GiB; change that with `BACKFILL_MAX_GIB`.

## Running only when the machine can spare it

By default the labeller runs all the time. It can instead pause while its machine is busy. A monitor measures the machine and writes its advice to a file, and the labeller and backfill follow it:

```sh
SCHEDULE_FILE=/absolute/path/schedule.json pnpm monitor
```

Run the monitor on the host, since a container only sees its own virtual machine, and give the labeller and backfill the same `SCHEDULE_FILE`, shared with their containers if they run in them. `pnpm monitor --once` takes one measurement and exits, for launchd, cron or a systemd timer to repeat every 30 seconds, so nothing stays running between checks.

It calls the machine busy when any of these lasts two minutes:

- processor use at or above 70% (`MONITOR_BUSY_CPU`)
- memory pressure on macOS, or less than 10% of memory available on Linux
- on macOS, running on battery or with the processor slowed to cool it

It advises running again after two calm minutes, with processor use at or below 50% (`MONITOR_CALM_CPU`).

While paused, the labeller stops reading the stream, fetching profiles and asking the judge. Its server stays up, so labels already made are still served, and it carries on from where it stopped. **Labels arrive late while it is paused.** Once it is `SCHEDULE_MAX_DELAY_MINUTES` behind (default 60), it runs until it has caught up, however busy the machine is. New labels are announced at no more than four a second, within the five Bluesky documents, so a catch-up cannot flood it. Public Jetstream servers replayed about 36 hours when tried in November 2026, so longer gaps lose posts; the delay cannot be set above 24 hours. The backfill has no deadline and waits as long as advised, downloading some of the archive again after each pause.

If the advice is more than three minutes old, or cannot be read, both carry on running. Pausing frees processor time and network use, but not all of the process's memory.

## Experimental judge

An AI model can give a second opinion on posts and profiles that hit only one ambiguous group, which the standard label leaves alone. **It cannot write labels.** It is off by default. To try it, set this in `.env`:

```sh
AI_JUDGE=shadow
```

The labeller then logs the address of each record it would have labelled, and running totals every 25 calls. It asks for one plain reply, with no session, agent or tools.

### Choosing a provider

`AI_JUDGE_PROVIDER` says who answers:

| Provider                                                                                                                                                                         | Needs                                                         | Where the text goes                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `opencode` (default)                                                                                                                                                             | Nothing                                                       | A free [OpenCode](https://opencode.ai/docs/zen/) model, run through [`@opencode/sdk`](https://opencode.ai/docs/build/sdk/) |
| `ollama`, `lmstudio`                                                                                                                                                             | `AI_JUDGE_MODEL`                                              | A model server on your own machine, on its usual port                                                                      |
| `ai-gateway`, `arcee`, `cerebras`, `deepseek`, `fireworks`, `groq`, `huggingface`, `kimi`, `mistral`, `nvidia`, `ollama-cloud`, `openai`, `openrouter`, `together`, `xai`, `zai` | `AI_JUDGE_MODEL`, `AI_JUDGE_API_KEY`                          | That service                                                                                                               |
| `custom`                                                                                                                                                                         | `AI_JUDGE_MODEL`, `AI_JUDGE_BASE_URL`, and a key unless local | Any other OpenAI-compatible server                                                                                         |

All but `opencode` use the OpenAI-compatible chat API at the address [Hermes Agent](https://hermes-agent.nousresearch.com/docs/integrations/providers) uses for the same provider. `AI_JUDGE_BASE_URL` replaces that address. It must use `https`, except for `localhost`, `127.0.0.1`, `[::1]` and `host.docker.internal`. Redirects are refused. Hermes's subscription logins, AWS Bedrock, Google Vertex AI and Azure are not supported.

For example, with [Ollama](https://ollama.com/) and a model you have already pulled:

```sh
AI_JUDGE=shadow
AI_JUDGE_PROVIDER=ollama
AI_JUDGE_MODEL=name-of-your-model
```

Inside Docker, `localhost` is the container itself, so also set `AI_JUDGE_BASE_URL=http://host.docker.internal:11434/v1`, and check that the container can reach the server. Ollama is asked not to think before answering, which a small model can otherwise do at length.

### Fallbacks

Up to three more services can stand behind the first, each with the same four settings under `AI_JUDGE_FALLBACK_`, `AI_JUDGE_FALLBACK_2_` and `AI_JUDGE_FALLBACK_3_`:

```sh
AI_JUDGE_FALLBACK_PROVIDER=ollama
AI_JUDGE_FALLBACK_MODEL=qwen3.5:0.8b
```

For each record the services are tried in order, with 30 seconds each. One that is rate limited is skipped until its wait is over; one that fails in any other way is tried again with the next record. If none answers and one is rate limited, the record stays queued. A service that does not start is left out until the labeller restarts. Text can reach every service in the list, so each one counts for the terms and privacy points below. Only one service can be `opencode`, and `pnpm evaluate` tests only the first.

Read these before turning it on:

- **OpenCode's free allowance is small.** Its size is not published. In both trials so far it was soon rate limited, with waits of over three hours. With any provider, on a rate limit the judge waits until the time given (an hour if none is given), and queues what arrives meanwhile. Ambiguous records numbered about 1,600 a day before bare names stopped counting, far beyond `AI_JUDGE_DAILY_LIMIT` (default 200). Raise that limit with care on a paid provider.
- **Check the terms** of your provider. [OpenCode's](https://opencode.ai/legal/terms-of-service) limit use to your own internal use, not on behalf of third parties, and restrict programmatic extraction of output. Whether a public labeller fits is for its operator to decide. Free models are offered for a limited time.
- **Text goes to the provider.** The whole text of each such record, including alt text and link card text, is sent to it. The author's DID and the record's address are not added. Only with a model server on your own machine does the text stay there, and only if that server runs the model itself rather than passing it on, as Ollama does for its cloud models.
- **Privacy depends on your choice.** With `opencode`, `AI_JUDGE_MODEL` accepts only `deepseek-v4.1-flash-free` (default) or `hy4-flash-free`, which OpenCode documents as zero retention and no training. For every other provider any model is accepted and nothing is checked: some keep inputs or train on them.
- **OpenCode is heavy.** In a local build the Docker image grew from 625 MB to 1.24 GB, and a labeller using it took about 525 MB of memory against 70 MB without. Its text generation call is marked experimental. Other providers do not start it.
- **Its accuracy is unknown.** `pnpm evaluate` sends 16 invented sentences to the chosen provider and prints where it disagrees. A good score there says little about real posts.

It never holds up labelling: one record is asked about at a time, and each service is given 30 seconds. Records over a rate limit or the daily limit wait in a queue. The queue is held in memory only, so a restart empties it. It keeps up to 5,000 records, dropping the oldest, and gives up on any that have waited a day. A record that is deleted, or edited so it no longer needs an opinion, leaves the queue; deleting a whole account does not remove its records. OpenCode keeps its files in `data/opencode/`, apart from any OpenCode setup on the machine. If you run a public instance with it on, update the privacy note on the website first, and again if you change provider.

### Word-count learner

A second, much smaller judge learns by itself. Set `AI_LEARNER=shadow` and the labeller counts the words in new posts, taught by the word list: a post the list labels is one kind, a post with no hit the other, and it takes as many of the second as of the first. The list's own terms are removed first, so it learns the words around them. **It cannot write labels.** Once it has 500 posts of each kind it logs `learner would label` for new posts hitting one ambiguous group, and every ten minutes how often it flagged posts the list did and did not label, checked on each post before learning it.

It is taught only by the list, so at best it copies the list's judgement, mistakes included. Those figures measure agreement with the list, not whether either is right. Only counts of words seen in at least 20 posts are saved, to `judge-counts.json` in the data directory, and never post text; rarer words are held in memory until a restart. Nothing is sent anywhere. `pnpm learn 10` teaches it from the live stream for ten minutes without running the labeller. If you run a public instance with it on, say so in your privacy note first.

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
