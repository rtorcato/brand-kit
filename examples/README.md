# Examples

Each folder is a tiny repo that `brand-kit` was run against. Everything under
its `brand/` is real output, and its README opens with the banner the CLI
added.

| Example | Command | Shows |
|---|---|---|
| [basic](basic) | `npx @rtorcato/brand-kit` | Defaults from `package.json` |
| [custom](custom) | `--tagline … --accent …` | Overriding tagline and accent |
| [social](social) | `--social` | Avatar, Instagram, X, LinkedIn, YouTube, Facebook images |
| [docusaurus](docusaurus) | `npx @rtorcato/brand-kit` | Accent and logo read from a Docusaurus site |
| [ai-higgsfield](ai-higgsfield) | `--ai --ai-provider higgsfield` | Logo and background from Higgsfield |
| [ai-gemini](ai-gemini) | `--ai --ai-provider gemini` | Logo and background from Gemini |
| [ai-openai](ai-openai) | `--ai --ai-provider openai` | Logo and background from OpenAI |

Regenerate one after a template change, from the repo root:

```sh
pnpm build && node dist/cli.js render --dir examples/basic
```
