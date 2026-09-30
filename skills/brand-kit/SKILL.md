---
name: brand-kit
description: |
  Create or refresh a repo's banner, mobile banner, social card and favicon
  with the @rtorcato/brand-kit CLI. Use when the user says "add a banner",
  "make a social card", "brand this repo", "update the tagline or accent
  colour", "generate a logo", "add social images", or invokes `/brand-kit`.
---

# brand-kit

Drives `npx @rtorcato/brand-kit`, which writes SVG sources under `brand/`
(plus `render.sh`), renders them to PNG and adds the README banner. Always
change the look through flags, never by hand-editing the generated SVGs.

## Steps

1. Check the renderer: `command -v rsvg-convert`. If missing, tell the user to
   `brew install librsvg` (apt: `apt-get install librsvg2-bin`). Without it
   the SVGs are still written but no PNGs.
2. Run non-interactively from the target repo (or pass `--dir <path>`):

   ```sh
   npx @rtorcato/brand-kit --json --yes
   ```

   Add `--tagline "Short line"` and/or `--accent "#rrggbb"` when the user
   gives them; otherwise defaults come from the shared-docs family entry, then
   `package.json`.
3. Verify: `npx @rtorcato/brand-kit doctor --json` (`--strict` exits 1 on
   warnings too, useful for CI). Report any fail/warn.

## Changing an existing kit

- Retitle or recolour: rerun with `--tagline` / `--accent` plus `--update`
  (rewrites changed sources, never `brand/favicon.svg`).
- Re-render stale PNGs only: `npx @rtorcato/brand-kit render`.
- `--light` adds light-theme banners for the README `<picture>`.

## Social images (`--social`)

`npx @rtorcato/brand-kit --social --json --yes` adds avatar, Instagram post,
story, and X, LinkedIn, YouTube and Facebook headers. After the first run,
`render`, `doctor` and `--update` keep them current without the flag.

## AI artwork (`--ai`)

Replaces the initial-on-a-tile logo with a generated logo and background.
Needs one provider key:

| Provider | Env vars |
|---|---|
| `higgsfield` | `HF_API_KEY_ID` + `HF_API_KEY_SECRET` |
| `openai` | `OPENAI_API_KEY` |
| `gemini` | `GEMINI_API_KEY` |
| `leonardo` | `LEONARDO_API_KEY` |
| `recraft` | `RECRAFT_API_TOKEN` |

- Keys go in the shell or a **gitignored** `.env` in the target repo. Never
  ask the user to paste a key into chat, never write one to a tracked file,
  and never echo it. brand-kit warns if `.env` is not gitignored; fix that
  before continuing.
- `npx @rtorcato/brand-kit --ai [--ai-provider <p>] [--ai-model <id>] [--ai-prompt "style hint"] --json --yes`
- It costs an API call per run and saves `brand/logo.png` and
  `brand/background.png`; later renders need no key. Rerun `--ai` only for
  new art.
