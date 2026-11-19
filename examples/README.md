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
| [ai-cloudflare](ai-cloudflare) | `--ai --ai-provider cloudflare` | Logo and background from Cloudflare Workers AI (FLUX) |

Regenerate one after a template change, from the repo root:

```sh
pnpm build && node dist/cli.js render --dir examples/basic
```

CI runs `scripts/check-examples.sh` (`doctor --strict` on the root and every
example) and fails when they drift. To fix it, regenerate with the flags in the
example's README plus `--update`, for example:

```sh
node dist/cli.js --dir examples/basic --update
```

An example generated with flags (like `custom`) also needs them listed in
`scripts/check-examples.sh`.
