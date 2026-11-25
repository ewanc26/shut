# AGENTS.md

Guidance for AI coding agents working in **shut**.

## Project overview

A Bluesky labeller that applies `incel-language` to posts and profiles.

- Language: TypeScript, run with `tsx` on Node.js 22.9 or newer
- Default branch: main
- `src/detect/` judges text, `src/label/` decides and stores labels, `src/stream/` tracks the Jetstream position, `src/server/` runs the service, `src/cli/` holds one-off commands

## Working rules

- Inspect the README, manifests and nearby code before editing.
- Run `npm test` (type check and tests); never claim checks you did not run.
- Word list changes follow `CONTRIBUTING.md`.
- Treat the signing key, account password, `.env` and `data/` as sensitive.
- `npm run declare -- --publish`, `npx @skyware/labeler` and starting the server with real credentials change a public account. Do not run them without being asked.
- `package.json` overrides Fastify to v5 because `@skyware/labeler` 0.2.0 pins a vulnerable v4. Keep the integration tests passing when changing either.

## File naming

Source files are named `<scope>/<atom>.<ext>`. The directory is the scope: the module, feature or layer the code belongs to. The file name is one atom: one concept, named in lowercase words joined by `_`. Pair an interface with its implementation under the same atom name. Avoid catch-all names such as `utils`, `misc`, `common2` or `helpers_final`.

<!-- allowed-agents -->
## Allowed agents

Only **Claude** (Anthropic) and **Mistral** (Mistral AI) may be used as coding agents in this repository.

- Agent-assisted commits must credit only one of those agents:
  - `Co-Authored-By: Claude <noreply@anthropic.com>`
  - `Co-Authored-By: Mistral Vibe <vibe@mistral.ai>`
- Allowed agent footers are `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and `🤖 Generated with [Mistral Vibe](https://mistral.ai)`.
- Do not add `Co-Authored-By:` trailers, `Generated with` footers, author names, or committer identities for any other agent or AI tool.
- Do not credit another agent in commit metadata.
