---
title: AI artwork
sidebar_position: 3
---

# AI artwork

With an image API key, `--ai` replaces the default initial-on-a-tile logo with
a generated one and adds a generated background behind every canvas:

```sh
npx @rtorcato/brand-kit --ai                                  # first key found
npx @rtorcato/brand-kit --ai --ai-provider gemini --ai-prompt "neon line art"
```

## Providers

| Provider | Env vars | Default model |
|---|---|---|
| `higgsfield` | `HF_API_KEY_ID` + `HF_API_KEY_SECRET` (or `HF_KEY=id:secret`) | `higgsfield-ai/soul/v2/standard` |
| `openai` | `OPENAI_API_KEY` | `gpt-image-1` |
| `gemini` | `GEMINI_API_KEY` | `gemini-2.5-flash-image` |

Without `--ai-provider`, brand-kit uses the first provider in that order whose
key is set. `--ai-model` overrides the model, and `--ai-prompt` adds a style
hint to both the logo and background prompts.

Keys come from the shell or a `.env` in the target repo; the shell wins.
brand-kit warns if that `.env` is not gitignored.

## What gets saved

The art is saved as sources, so it is generated once:

- `brand/logo.png`: the generated logo.
- `brand/background.png`: the canvas background.
- `brand/favicon.svg`: a self-contained SVG that embeds the logo.

Renders after that are deterministic and need no key. Run `--ai` again only
when you want new art.

## Your own background

Any image works as a background. Drop it in as `brand/background.png` and run:

```sh
npx @rtorcato/brand-kit --update
```
