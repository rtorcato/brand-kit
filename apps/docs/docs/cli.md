---
title: CLI reference
sidebar_position: 4
---

# CLI reference

```sh
npx @rtorcato/brand-kit [init|render|doctor] [options]
```

## Commands

| Command | Does |
|---|---|
| `init` (default) | Writes the `brand/` SVG sources and `render.sh`, renders PNGs when `rsvg-convert` is installed, adds the README banner, and copies assets into a Docusaurus site. |
| `render` | Re-renders stale PNGs and `favicon.ico` from `brand/*.svg`. |
| `doctor` | Reports missing sources, stale PNGs and a README without the banner. Exits 1 when a source is missing, and with `--strict` on any warning too. |

## Options

| Option | Applies to | Does |
|---|---|---|
| `--dir <path>` | all | Target repo. Default: the current directory. |
| `--tagline <text>` | `init` | Banner tagline. See [Configuration](./configuration.md#tagline). |
| `--accent <hex>` | `init` | Accent colour as `#rrggbb`. See [Configuration](./configuration.md#accent). |
| `--update` | `init` | Rewrite generated sources that differ. Never touches `favicon.svg`. |
| `--social` | `init` | Also write the [social images](./outputs.md#social-images). |
| `--ai` | `init` | Generate a logo and background. See [AI artwork](./ai-artwork.md). |
| `--ai-provider <p>` | `init` | `higgsfield`, `openai` or `gemini` instead of the first key found. |
| `--ai-model <id>` | `init` | Override the provider's default model. |
| `--ai-prompt <text>` | `init` | Style hint added to both prompts, e.g. `"neon line art"`. |
| `--strict` | `doctor` | Exit 1 on warnings (stale renders, a bannerless README) too. |
| `--json` | all | Machine-readable output on stdout. |
| `--yes`, `-y` | all | Accepted for parity; the CLI never prompts. |
| `-v`, `--version` | | Print the version. |
| `-h`, `--help` | | Print help. |

## Examples

```sh
npx @rtorcato/brand-kit                                   # init
npx @rtorcato/brand-kit --tagline "Short line" --accent "#e879f9"
npx @rtorcato/brand-kit --tagline "New line" --update     # rewrite changed sources
npx @rtorcato/brand-kit --social                          # add the social images
npx @rtorcato/brand-kit render                            # re-render stale PNGs
npx @rtorcato/brand-kit doctor --strict                   # CI check
npx @rtorcato/brand-kit --dir ../other-repo               # run against another repo
```
