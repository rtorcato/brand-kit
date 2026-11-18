---
"@rtorcato/brand-kit": patch
---

Fix the README banner on npm for monorepo packages. Workspace package READMEs (`packages/*`, non-private) now get the banner block with absolute `raw.githubusercontent.com` URLs, as does any README whose package sets `repository.directory`, because npm resolves relative `./brand/` URLs against that directory and they 404.
