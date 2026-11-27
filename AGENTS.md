# AGENTS.md

Guidance for AI coding agents working in **shut**.

## Project overview

A Bluesky labeller that labels incel language and incel influenced language in posts
(`incel-language`, `incel-language-strict`) and profiles (`incel-language-profile`,
`incel-language-profile-strict`), with a static website. The
public instance is `@shut.croft.click`, served from `https://shut-labeller.croft.click`.

- Language: TypeScript; Svelte 5 and SvelteKit 3 for the website
- Tooling: pnpm workspace, Node.js 22.17 or newer
- Website: `https://shut.croft.click`, deployed to Vercel with `website/` as the root directory
- Default branch: main

## Read first

1. `README.md` for shipped scope and deployment status.
2. `package.json` and `pnpm-workspace.yaml` for commands and dependency policy.
3. `labeller/src/detect/` and its tests before touching matching.
4. `website/DESIGN.md` and `website/PRODUCT.md` before changing the site.

## Repository map

- `labeller/src/detect/` judges text. It must stay free of Node-only APIs, because the website
  runs it in the browser.
- `labeller/src/account/` turns an account into the labeller.
- `labeller/src/judge/` asks an AI model (a free OpenCode one unless `AI_JUDGE_PROVIDER` says
  otherwise) about ambiguous records and only logs. Do not let it write labels without being
  asked, and never give it a session, agent or tools. It may learn from public posts if only
  pruned word counts are kept, in `data/`; never commit or paste post text, and keep
  `examples.ts` invented. `pnpm evaluate` and `AI_JUDGE=shadow` send text to the chosen provider
  and use its allowance or credit, so do not run them without being asked.
- `labeller/src/label/` decides and stores labels.
- `labeller/src/stream/` tracks the Jetstream position.
- `labeller/src/schedule/` measures the host and decides when the labeller and backfill pause.
- `labeller/src/server/` runs the service; `labeller/src/cli/` holds one-off commands.
- `website/src/lib/site/config.ts` holds the origin and the live labeller handle.
- `website/src/lib/judge/reasons.ts` describes rules so the page never prints the terms.
- `website/tools/og_cover/` renders the committed social card.

## Working rules

- Inspect the README, manifests, CI workflows, and nearby code before editing.
- Preserve existing architecture, naming, formatting, and error-handling conventions.
- Use project scripts for validation; never claim checks you did not run.
- Keep changes scoped and update tests or documentation when behavior changes.
- Use feature branches and pull requests.
- Treat generated files, credentials, deployment configuration, and release metadata as sensitive.
- Word list changes follow `CONTRIBUTING.md`.
- Treat the signing key, account password, `.env` and `data/` as sensitive.
- `pnpm activate`, `pnpm declare --publish`, `pnpm setup-account` and starting the server with real credentials
  change a public account. Do not run them without being asked.
- `pnpm-workspace.yaml` overrides Fastify to v5 because `@skyware/labeler` 0.2.0 pins a vulnerable
  v4. Keep the integration tests passing when changing either.

## Validation

`pnpm lint`, `pnpm check`, `pnpm test`, `pnpm build`, and `docker build -t shut .` for changes to
the Dockerfile, dependencies or layout.

## File naming

Source files are named `<scope>/<atom>.<ext>`. The directory is the scope: the module, feature or layer the code belongs to. The file name is one atom: one concept, named in lowercase words joined by `_`. Pair an interface with its implementation under the same atom name. Avoid catch-all names such as `utils`, `misc`, `common2` or `helpers_final`. Framework-reserved names such as `+page.svelte` and `vite.config.ts` keep their required form.

## Recent history

Restructured into a pnpm workspace and added the website.

<!-- allowed-agents -->

## Allowed agents

Only **Claude** (Anthropic) and **Mistral** (Mistral AI) may be used as coding agents in this repository. This rule supersedes any earlier agent-attribution guidance in this file.

- Agent-assisted commits must credit only one of those agents:
  - `Co-Authored-By: Claude <noreply@anthropic.com>`
  - `Co-Authored-By: Mistral Vibe <vibe@mistral.ai>`
- Allowed agent footers are `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and `🤖 Generated with [Mistral Vibe](https://mistral.ai)`.
- Do not add `Co-Authored-By:` trailers, `Generated with` footers, author names, or committer identities for any other agent or AI tool.
- Do not credit another agent in commit metadata.
