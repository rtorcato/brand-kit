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
| `leonardo` | `LEONARDO_API_KEY` | Phoenix 1.0 (`de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3`) |
| `recraft` | `RECRAFT_API_TOKEN` | `recraftv3` (vector logo) |

Without `--ai-provider`, brand-kit uses the first provider in that order whose
key is set. `--ai-model` overrides the model, and `--ai-prompt` adds a style
hint to both the logo and background prompts.

For Leonardo, a UUID `--ai-model` is a v1 model ID (as listed in Leonardo's
platform models), and anything else is a v2 model name such as
`gpt-image-1.5`; generations are polled on v1 either way.

Recraft draws the logo in its `vector_illustration` style, so it comes back as
real SVG, and gets the accent as a colour input as well as in the prompt. The
background uses the raster `digital_illustration` style.

Keys come from the shell or a `.env` in the target repo; the shell wins.
brand-kit warns if that `.env` is not gitignored.

## What gets saved

The art is saved as sources, so it is generated once:

- `brand/logo.png`: the generated logo.
- `brand/background.png`: the canvas background.
- `brand/favicon.svg`: a self-contained SVG that embeds the logo. With
  Recraft the logo is vector, so it *is* `favicon.svg` (scripts and event
  handlers stripped) and no `logo.png` is written.

Renders after that are deterministic and need no key. Run `--ai` again only
when you want new art.

## Your own background

Any image works as a background. Drop it in as `brand/background.png` and run:

```sh
npx @rtorcato/brand-kit --update
```
