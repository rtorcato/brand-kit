---
title: Getting started
slug: /
sidebar_position: 0
---

# brand-kit

Banner, mobile banner, social card and favicon for a repo, generated as SVG
sources under `brand/` and rendered to PNG, so a banner can be recoloured or
retitled instead of being a binary nobody can regenerate.

![brand-kit banner](https://raw.githubusercontent.com/rtorcato/brand-kit/main/brand/banner.png)

It works in any repo, with or without a docs site, and needs no install:

```sh
npx @rtorcato/brand-kit
```

That one command:

1. writes the SVG sources and `render.sh` to `brand/`,
2. renders them to PNG (when `rsvg-convert` is installed),
3. adds the banner to the top of `README.md`,
4. copies the favicon and social card into `apps/docs/static/img/` if the repo
   has a Docusaurus site there.

## Requirements

- Node 22 or newer.
- `rsvg-convert` to render PNGs: `brew install librsvg` on macOS,
  `apt-get install librsvg2-bin` on Debian or Ubuntu. Without it the SVG
  sources are still written, and `brand-kit render` finishes the job later.

Renders are only pixel-stable on the machine that produced them. The templates
prefer Avenir Next and Menlo (macOS) and fall back to Inter, Helvetica Neue,
Arial or DejaVu Sans Mono, whichever fontconfig finds.

## Next

- [Outputs](./outputs.md): every file brand-kit writes, and its size.
- [Configuration](./configuration.md): where the name, tagline and accent come from.
- [AI artwork](./ai-artwork.md): a generated logo and background.
- [CLI reference](./cli.md): every command and flag.
- [Examples](./examples.md): real output from each mode.
