# @rtorcato/brand-kit

## 1.2.0

### Minor Changes

- 75d3324: Brand art and layout changes that shipped after 1.1.3 without a release:
  
  - The background wash over `brand/background.png` is now a gradient instead of a flat 55% overlay, so `--ai` background art shows. It stays dark where the text sits and lightens toward the edges.
  - The mobile banner and social lockup now centre their stack on the canvas, with tighter spacing under the wordmark and before the install pill.
  - When the accent falls back to the neutral grey, the wordmark is drawn in the text colour so it no longer reads as disabled. The install pill border is lighter so it reads as a box on dark backgrounds.

### Patch Changes

- 3d470cb: Fix the README banner on npm for monorepo packages. Workspace package READMEs (`packages/*`, non-private) now get the banner block with absolute `raw.githubusercontent.com` URLs, as does any README whose package sets `repository.directory`, because npm resolves relative `./brand/` URLs against that directory and they 404.
