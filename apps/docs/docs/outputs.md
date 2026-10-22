---
title: Outputs
sidebar_position: 1
---

# Outputs

## Default set

| File | Size | For |
|---|---|---|
| `brand/banner.png` | 1280×320 | The README banner |
| `brand/banner-mobile.png` | 1280×786 | The README banner under 640px |
| `brand/social-card.png` | 1280×640 | The GitHub social preview and `og:image` |
| `brand/favicon-512.png` | 512×512 | App icon |
| `brand/favicon.ico` | 16 + 32px | Browser tab |

Each PNG has an SVG source beside it (`banner.svg`, `banner-mobile.svg`,
`social-card.svg`, `favicon.svg`). Edit a source by hand if you like, then
re-render. `brand/render.sh` re-renders everything without Node, which is handy
in CI or on a machine without npm.

The social card is what X, LinkedIn, Facebook, Slack and Discord show as a link
preview. Upload it under the repo's **Settings → Social preview** too.

## Social images

For images you post or upload to a profile, add `--social`:

```sh
npx @rtorcato/brand-kit --social
```

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

## The README banner

brand-kit adds a `<picture>` block to the top of `README.md` that swaps to the
mobile banner under 640px:

```html
<!-- brand-kit:banner:start -->
<picture>
  <source media="(max-width: 640px)" srcset="./brand/banner-mobile.png">
  <img src="./brand/banner.png" alt="Tiny helpers for my-lib" width="1600">
</picture>
<!-- brand-kit:banner:end -->
```

The markers let later runs replace the block in place. Leave them in. A README
still carrying the older `js-tooling:banner` markers is rewritten to the
`brand-kit` ones on the next `brand-kit init`.

The `alt` text is the banner tagline: `--tagline`, else the shared-docs entry's
tagline, else the `package.json` `description`. Quotes, `&`, `<` and `>` are
escaped. With no tagline at all, it falls back to `<name> banner`, as in
`my-lib banner`.

## Docusaurus sites

In a repo with a Docusaurus site at `apps/docs`, `favicon.svg` and
`social-card.png` are also copied to `apps/docs/static/img/`. `favicon.ico` stays
in `brand/`. Existing
copies are kept, except after `--ai` generates new art. Delete a copy to
refresh it.
