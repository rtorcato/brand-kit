# @rtorcato/brand-kit

Banner, mobile banner, social card and favicon for a repo, generated as SVG
sources under `brand/` and rendered to PNG, so a banner can be recoloured or
retitled instead of being a binary nobody can regenerate.

Works in any repo, with or without a docs site. No install needed:

```sh
npx @rtorcato/brand-kit                                   # init: brand/ + render + README banner
npx @rtorcato/brand-kit --tagline "Short line" --accent "#e879f9"
npx @rtorcato/brand-kit --tagline "New line" --update     # rewrite changed sources
npx @rtorcato/brand-kit render                            # re-render stale PNGs
npx @rtorcato/brand-kit doctor                            # report drift
```

Rendering needs `rsvg-convert` (`brew install librsvg`, apt:
`apt-get install librsvg2-bin`). Without it the SVG sources are still written.

## What you get

| File | Size |
|---|---|
| `brand/banner.png` | 1280×320, the README banner |
| `brand/banner-mobile.png` | 1280×786, shown under 640px |
| `brand/social-card.png` | 1280×640, the GitHub/OG card |
| `brand/favicon-512.png`, `brand/favicon.ico` | 512×512 icon, 16+32px ico |

`brand/render.sh` re-renders them without Node.

## Where the name, tagline and accent come from

- **Name:** `package.json` `name`, without the scope.
- **Tagline:** `--tagline`, else the repo's entry in the
  [`@rtorcato/shared-docs`](https://github.com/rtorcato/shared-docs) family
  list, else the `package.json` description.
- **Accent:** `--accent`, else the family entry, else the docs site's theme
  colour, else the favicon's colour, else neutral grey.

An existing `favicon.svg` (repo root or `apps/docs/static/img/`) is kept as the
logo tile. `--update` never rewrites `brand/favicon.svg`.

In a repo with a Docusaurus site at `apps/docs`, the favicon and social card
are also copied into `apps/docs/static/img/`.
