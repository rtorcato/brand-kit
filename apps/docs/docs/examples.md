---
title: Examples
sidebar_position: 5
---

# Examples

Each folder in
[`examples/`](https://github.com/rtorcato/brand-kit/tree/main/examples) is a
tiny repo that brand-kit was run against. Everything below is real output.

## Defaults

`npx @rtorcato/brand-kit` in a repo with only a `package.json`. The tagline is
the `description`; the accent falls back to grey.

![basic banner](https://raw.githubusercontent.com/rtorcato/brand-kit/main/examples/basic/brand/banner.png)

## Custom tagline and accent

```sh
npx @rtorcato/brand-kit --tagline "Brand assets you can regenerate" --accent "#e879f9"
```

![custom banner](https://raw.githubusercontent.com/rtorcato/brand-kit/main/examples/custom/brand/banner.png)

![custom social card](https://raw.githubusercontent.com/rtorcato/brand-kit/main/examples/custom/brand/social-card.png)

## Social images

```sh
npx @rtorcato/brand-kit --social
```

![X header](https://raw.githubusercontent.com/rtorcato/brand-kit/main/examples/social/brand/x-header.png)

![LinkedIn banner](https://raw.githubusercontent.com/rtorcato/brand-kit/main/examples/social/brand/linkedin-banner.png)

See the
[social example](https://github.com/rtorcato/brand-kit/tree/main/examples/social/brand)
for the avatar, Instagram post, story, YouTube and Facebook images.

## A Docusaurus site

In a repo with `apps/docs`, the accent and logo are read from the site's theme
colour and favicon.

![docusaurus banner](https://raw.githubusercontent.com/rtorcato/brand-kit/main/examples/docusaurus/brand/banner.png)
