#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { generateAiArt, pickProvider } from './ai.js'
import {
	addReadmeBanner,
	bannerMobileSvg,
	bannerSvg,
	generateBrand,
	RENDERS,
	renderBrand,
	resolveBrandMeta,
	DOCS_ASSETS,
	SOCIAL,
	socialCardSvg,
	staleRenders,
	syncBrandToDocs,
} from './brand.js'
import { exists, read } from './fs.js'

const HELP = `brand-kit — banner, social card and favicon for a repo

Usage: brand-kit [init|render|doctor] [options]

Commands:
  init     (default) Write brand/ SVG sources + render.sh, render PNGs when
           rsvg-convert is installed, add the README banner
  render   Re-render stale PNGs and favicon.ico from brand/*.svg
  doctor   Report missing or drifted sources, stale PNGs and a README without the banner
           (exit 1 when a source is missing; with --strict, on any warning too)

Options:
  --dir <path>      Target repo (default: cwd)
  --tagline <text>  Banner tagline (default: family entry, else package.json description)
  --accent <hex>    Accent colour (default: family entry, docs theme, favicon, else grey)
  --update          init: rewrite generated sources that differ (never favicon.svg)
  --social          init: also write avatar, Instagram post, story, and X, LinkedIn,
                    YouTube and Facebook headers
  --light           init: also write light-theme banners for the README <picture>
  --ai              init: generate a logo (brand/logo.png, drawn by favicon.svg) and a
                    canvas background (brand/background.png) with an image API,
                    replacing both. Uses the first key set: HF_API_KEY_ID +
                    HF_API_KEY_SECRET (Higgsfield), OPENAI_API_KEY, GEMINI_API_KEY,
                    LEONARDO_API_KEY,
                    from the shell or the repo's .env
  --ai-provider <p> init: higgsfield, openai, gemini or leonardo instead of the first key found
  --ai-model <id>   init: override the provider's default model
  --ai-prompt <txt> init: style hint added to both prompts, e.g. "neon line art"
  --strict          doctor: exit 1 on warnings (stale renders, bannerless README) too
  --json            Machine-readable output on stdout
  --yes, -y         Accepted for parity; the CLI never prompts
  -v, --version
  -h, --help
`

const HEX = /^#[0-9a-fA-F]{6}$/
const SOURCES = ['favicon.svg', 'banner.svg', 'banner-mobile.svg', 'social-card.svg', 'render.sh']

type Check = { check: string; status: 'ok' | 'warn' | 'fail'; detail?: string }

/** Read-only. A missing source fails; a missing or stale render, a drifted source and a bannerless README warn. */
async function doctor(
	dir: string,
	pkg: Record<string, unknown> | null,
	opts: { tagline?: string; accent?: string }
): Promise<Check[]> {
	const at = (rel: string): string => path.join(dir, 'brand', rel)
	const checks: Check[] = []
	for (const f of SOURCES) {
		checks.push(
			(await exists(at(f)))
				? { check: `brand/${f}`, status: 'ok' }
				: { check: `brand/${f}`, status: 'fail', detail: 'missing — run `brand-kit`' }
		)
	}
	// Regenerate in memory; favicon.svg is skipped because hand edits there are expected.
	const meta = await resolveBrandMeta(pkg, dir, opts)
	const canvases: Array<[string, string]> = [
		['banner.svg', bannerSvg(meta)],
		['banner-mobile.svg', bannerMobileSvg(meta)],
		['social-card.svg', socialCardSvg(meta)],
		...SOCIAL.map(([stem, , , svg]): [string, string] => [`${stem}.svg`, svg(meta)]),
	]
	for (const [f, expected] of canvases) {
		if ((await exists(at(f))) && (await read(at(f))) !== expected) {
			checks.push({
				check: `brand/${f}`,
				status: 'warn',
				detail: 'differs from the current brand meta — run `brand-kit --update`',
			})
		}
	}
	const stale = new Set((await staleRenders(path.join(dir, 'brand'))).map(([, out]) => out))
	for (const [src, out] of RENDERS) {
		if (!(await exists(at(src)))) continue
		const detail = !(await exists(at(out)))
			? 'missing'
			: stale.has(out)
				? 'out of date with its source'
				: null
		checks.push(
			detail
				? {
						check: `brand/${out}`,
						status: 'warn',
						detail: `${detail} — run \`brand-kit render\` (needs rsvg-convert)`,
					}
				: { check: `brand/${out}`, status: 'ok' }
		)
	}
	if (await exists(path.join(dir, 'apps', 'docs'))) {
		for (const f of DOCS_ASSETS) {
			const src = at(f)
			const copy = path.join(dir, 'apps', 'docs', 'static', 'img', f)
			if (!(await exists(src)) || !(await exists(copy))) continue
			if (!(await readFile(src)).equals(await readFile(copy))) {
				checks.push({
					check: `apps/docs/static/img/${f}`,
					status: 'warn',
					detail: 'differs from brand/ — run `brand-kit`',
				})
			}
		}
	}
	const readme = path.join(dir, 'README.md')
	if (await exists(readme)) {
		checks.push(
			/brand\/banner(?:-mobile)?\.png/.test(await read(readme))
				? { check: 'README shows the banner', status: 'ok' }
				: {
						check: 'README shows the banner',
						status: 'warn',
						detail: 'run `brand-kit render` once brand/banner.png exists',
					}
		)
	}
	return checks
}

async function main(): Promise<number> {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			dir: { type: 'string' },
			tagline: { type: 'string' },
			accent: { type: 'string' },
			update: { type: 'boolean' },
			social: { type: 'boolean' },
			light: { type: 'boolean' },
			ai: { type: 'boolean' },
			'ai-provider': { type: 'string' },
			'ai-model': { type: 'string' },
			'ai-prompt': { type: 'string' },
			strict: { type: 'boolean' },
			json: { type: 'boolean' },
			yes: { type: 'boolean', short: 'y' },
			help: { type: 'boolean', short: 'h' },
			version: { type: 'boolean', short: 'v' },
		},
	})
	if (values.version) {
		const own = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
		console.log(own.version)
		return 0
	}
	if (values.help) {
		console.log(HELP)
		return 0
	}
	const command = positionals[0] ?? 'init'
	const fail = (message: string): number => {
		if (values.json) console.log(JSON.stringify({ command, ok: false, error: message }))
		else console.error(`error: ${message}`)
		return 1
	}
	if (values.accent && !HEX.test(values.accent))
		return fail('--accent must be a #rrggbb hex colour')

	const dir = path.resolve(values.dir ?? '.')
	const pkgFile = path.join(dir, 'package.json')
	const pkg = (await exists(pkgFile))
		? (JSON.parse(await readFile(pkgFile, 'utf8')) as Record<string, unknown>)
		: null
	const name =
		typeof pkg?.name === 'string' ? (pkg.name.split('/').pop() ?? pkg.name) : path.basename(dir)
	const report = (data: Record<string, unknown>, text: string): void => {
		console.log(values.json ? JSON.stringify({ command, ...data }) : text)
	}
	const wrote = (all: string[]): void =>
		report(
			{ ok: true, written: all },
			all.length
				? `wrote:\n${all.map((f) => `  ${f}`).join('\n')}`
				: 'nothing to write — brand/ is up to date'
		)
	// Render, then the README banner (it needs banner.png), then the docs-site copies.
	const finish = async (): Promise<string[]> => {
		const rendered = (await renderBrand(dir)) ?? []
		const banner = await addReadmeBanner(dir, name)
		return [
			...rendered,
			...(banner ? [banner] : []),
			...(await syncBrandToDocs(dir)),
		]
	}

	if (command === 'init') {
		const opts = {
			tagline: values.tagline,
			accent: values.accent,
			social: values.social,
			light: values.light,
		}
		const art: string[] = []
		if (values.ai) {
			// Shell env wins over .env: loadEnvFile never overwrites a variable already set.
			const envFile = path.join(dir, '.env')
			if (await exists(envFile)) {
				process.loadEnvFile(envFile)
				if (spawnSync('git', ['check-ignore', '-q', '.env'], { cwd: dir }).status === 1) {
					console.error(
						'   warning: .env holds API keys but is not gitignored — add it to .gitignore'
					)
				}
			}
			const generate = pickProvider(values['ai-provider'], values['ai-model'])
			const meta = await resolveBrandMeta(pkg, dir, opts)
			if (!values.json) console.error('generating logo and background…')
			art.push(...(await generateAiArt(dir, meta, generate, values['ai-prompt'])))
		}
		// New artwork changes every canvas, so rewrite them as --update would.
		const written = await generateBrand(pkg, dir, { ...opts, update: values.update || values.ai })
		wrote([...art, ...written, ...(await finish())])
		return 0
	}
	if (command === 'render') {
		wrote(await finish())
		return 0
	}
	if (command === 'doctor') {
		const checks = await doctor(dir, pkg, { tagline: values.tagline, accent: values.accent })
		const failed = checks.filter(
			(c) => c.status === 'fail' || (values.strict && c.status === 'warn')
		).length
		report(
			{ ok: failed === 0, checks },
			checks
				.map(
					(c) =>
						`${{ ok: 'ok  ', warn: 'warn', fail: 'FAIL' }[c.status]} ${c.check}${c.detail ? ` — ${c.detail}` : ''}`
				)
				.join('\n')
		)
		return failed ? 1 : 0
	}
	return fail(`unknown command "${command}"`)
}

main().then(
	(code) => process.exit(code),
	(err: unknown) => {
		console.error(err instanceof Error ? err.message : err)
		process.exit(1)
	}
)
