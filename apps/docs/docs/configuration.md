---
title: Configuration
sidebar_position: 2
---

# Configuration

There is no config file. brand-kit reads what the repo already has, and flags
override it.

## Name

The `package.json` `name`, without the scope: `@acme/my-lib` becomes `my-lib`.

## Tagline

The first of:

1. `--tagline "…"`
2. the repo's entry in the
   [`@rtorcato/shared-docs`](https://github.com/rtorcato/shared-docs) family list
3. the `package.json` `description`

Keep it to two lines on the mobile banner. brand-kit warns when it will be cut
off.

## Accent

The first of:

1. `--accent "#rrggbb"`
2. the family entry's accent
3. the docs site's theme colour
4. the colour of an existing favicon
5. neutral grey

## Logo

The default logo is the project's initial on an accent tile. An existing
`favicon.svg`, at the repo root or in `apps/docs/static/img/`, is kept as the
logo instead. [`--ai`](./ai-artwork.md) replaces it with a generated one.

## Changing things later

Rerun with the new values and `--update`. It rewrites the sources that differ
and re-renders:

```sh
npx @rtorcato/brand-kit --tagline "New line" --accent "#e879f9" --update
```

`--update` never rewrites `brand/favicon.svg`, so a hand-drawn or generated
logo survives. Delete it first if you want the default tile back.

## Keeping it current in CI

`doctor` reports missing sources, stale renders and a README without the
banner. With `--strict`, warnings fail too:

```yaml
- run: npx @rtorcato/brand-kit doctor --strict
```
