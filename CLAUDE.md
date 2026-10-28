# CLAUDE.md

`@rtorcato/brand-kit`: a CLI that writes `brand/` SVG sources (favicon tile,
banner, mobile banner, social card) plus `render.sh`, renders them to PNG, and
adds the README banner. Split out of `@rtorcato/shared-docs` so repos without
a docs site can use it.

## Commands

- `pnpm build`: `tsc` to `dist/`. Run it before `pnpm test`; the tests run `dist/cli.js`.
- `pnpm typecheck`, `pnpm lint`

## Release

Releases use **Changesets**, batched. A PR that changes the published package
adds a changeset (`pnpm changeset`). Each push to `main` opens or updates the
"Version Packages" PR, which bumps `package.json`'s `version` and writes
`CHANGELOG.md`; merging it is the release. Its `publish` job in
`.github/workflows/release.yml` waits for one approval in the `release` GitHub
environment (required reviewers), because npm's trusted publisher is pinned to
`release.yml` + `release`: rename either and publishing fails with
`404 package not found`. A manual dispatch (`gh workflow run release.yml`)
retries a failed publish. `release.yml` dispatches `docs.yml` after a publish to
rebuild the changelog page.

`pnpm-workspace.yaml` lists `.` so Changesets sees the root package; drop it and
every changeset fails with "not in the workspace".

## Boundaries

- Family data (tagline, accent) is read from `@rtorcato/shared-docs`'s
  `FAMILY`. Never copy it here; edit it there.
- shared-docs never imports this package. It only reads the `brand/` files by
  convention.
- Runtime dependencies: Node built-ins plus `@rtorcato/shared-docs`. Keep it
  that way; this runs via `npx`.
