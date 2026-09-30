# @rtorcato/brand-kit

Banner, mobile banner, social card and favicon for a repo, generated as SVG
sources under `brand/` and rendered to PNG, so a banner can be recoloured or
retitled instead of being a binary nobody can regenerate.

Works in any repo, with or without a docs site. No install needed:

```sh
npx @rtorcato/brand-kit                                   # init: brand/ + render + README banner
npx @rtorcato/brand-kit --tagline "Short line" --accent "#e879f9"
npx @rtorcato/brand-kit --tagline "New line" --update     # rewrite changed sources
npx @rtorcato/brand-kit --social                          # add Instagram, X, LinkedIn, … images
npx @rtorcato/brand-kit render                            # re-render stale PNGs
npx @rtorcato/brand-kit doctor                            # report drift
npx @rtorcato/brand-kit doctor --strict                   # CI: exit 1 on warnings too
```

See [`examples/`](examples) for real output from each mode.

Rendering needs `rsvg-convert` (`brew install librsvg`, apt:
`apt-get install librsvg2-bin`). Without it the SVG sources are still written.
Renders are only pixel-stable on the machine that produced them: the templates
prefer Avenir Next and Menlo (macOS) and fall back to Inter, Helvetica Neue,
Arial or DejaVu Sans Mono, whichever fontconfig finds.

## What you get

| File | Size |
|---|---|
| `brand/banner.png` | 1280×320, the README banner |
| `brand/banner-mobile.png` | 1280×786, shown under 640px |
| `brand/social-card.png` | 1280×640, the GitHub/OG card |
| `brand/favicon-512.png`, `brand/favicon.ico` | 512×512 icon, 16+32px ico |

`brand/render.sh` re-renders them without Node.

The social card is the `og:image` link preview on X, LinkedIn, Facebook, Slack
and Discord. For images you post or upload to a profile, add `--social`:

| File | Size | For |
|---|---|---|
| `brand/avatar.png` | 400×400 | Profile picture; survives a circular crop |
| `brand/instagram-post.png` | 1080×1080 | Instagram feed post |
| `brand/story.png` | 1080×1920 | Instagram, TikTok and Facebook stories |
| `brand/x-header.png` | 1500×500 | X profile header |
| `brand/linkedin-banner.png` | 1584×396 | LinkedIn background |
| `brand/youtube-banner.png` | 2560×1440 | YouTube channel art (content in the 1546×423 safe area) |
| `brand/facebook-cover.png` | 1640×624 | Facebook cover |

Once a social source exists, `render`, `render.sh`, `doctor` and `--update`
keep it current without the flag.

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
