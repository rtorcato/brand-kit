# CLAUDE.md

`@rtorcato/brand-kit`: a CLI that writes `brand/` SVG sources (favicon tile,
banner, mobile banner, social card) plus `render.sh`, renders them to PNG, and
adds the README banner. Split out of `@rtorcato/shared-docs` so repos without
a docs site can use it.

## Commands

- `pnpm build`: `tsc` to `dist/`. Run it before `pnpm test`; the tests run `dist/cli.js`.
- `pnpm typecheck`, `pnpm lint`

## Release

semantic-release runs on every push to `main`, but the `release` environment
has required reviewers, so each run waits for manual approval before it
publishes. `feat:` is a minor release, `fix:` a patch, and `chore:`/`docs:`/`ci:` release nothing. `version`
in `package.json` is a placeholder; npm and the git tags are the record.

## Boundaries

- Family data (tagline, accent) is read from `@rtorcato/shared-docs`'s
  `FAMILY`. Never copy it here; edit it there.
- shared-docs never imports this package. It only reads the `brand/` files by
  convention.
- Runtime dependencies: Node built-ins plus `@rtorcato/shared-docs`. Keep it
  that way; this runs via `npx`.
