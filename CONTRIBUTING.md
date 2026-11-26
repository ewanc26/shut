# Contributing to shut

**Shut the door on incel language.** shut is a Bluesky labeller with a small website. Thanks for wanting to help!

## Getting started

Use Node.js 22.17 or newer and pnpm:

```sh
pnpm install
pnpm dev
```

Quality gates, from the README:

```sh
pnpm format
pnpm lint
pnpm check
pnpm test
pnpm build
```

## Notes for this project

- Terms live in `labeller/src/detect/lexicon.ts`. Use `STRONG` only when one hit is clear on its own; otherwise add to a `WEAK` group. `TEMPLATE` is for open-ended patterns that only earn the strict label.
- Add a matching case and a near-miss that must not match to `labeller/test/detect/match.test.ts`.
- A new rule or group also needs a plain description in `website/src/lib/judge/reasons.ts`. The tests enforce this.
- List `-cel` words one by one. Never match the suffix alone.
- Run `pnpm sample 150 86400` to see what a change catches in real posts. It writes nothing. Never commit or paste its output, which quotes real people.
- The website must not claim the labeller is live until it is, and must not display real labelled posts.

## Before opening a PR

- All five quality gates pass.
- Conventional commits; focused PRs; describe how you verified.
- AI-assisted PRs welcome; stand behind every line and run the gates yourself.

## Licence

See [LICENSE](LICENSE). Contributions accepted under the same terms.
