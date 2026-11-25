# Contributing to shut

A Bluesky labeller that hides incel language.

## Changing the word list

- Terms live in `src/detect/lexicon.ts`. Use `STRONG` only when one hit is clear on its own; otherwise add to a `WEAK` group.
- Add a matching case and a near-miss that must not match to `test/detect/match.test.ts`.
- List `-cel` words one by one. Never match the suffix alone.
- Run `npm run sample -- 150 86400` to see what the change catches in real posts. It writes nothing. Don't commit its output, which quotes real people.

## Before submitting changes

- Run `npm test`.
- Keep commits focused and explain compatibility or operational impact.
- Open changes through a pull request with verification results.
