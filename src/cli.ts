#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { addReadmeBanner, generateBrand, RENDERS, renderBrand, syncBrandToDocs } from './brand.js'
import { exists, read } from './fs.js'

const HELP = `brand-kit — banner, social card and favicon for a repo

Usage: brand-kit [init|render|doctor] [options]

Commands:
  init     (default) Write brand/ SVG sources + render.sh, render PNGs when
           rsvg-convert is installed, add the README banner
  render   Re-render stale PNGs and favicon.ico from brand/*.svg
  doctor   Report missing sources, stale PNGs and a README without the banner
           (exit 1 when a source is missing; with --strict, on any warning too)

Options:
  --dir <path>      Target repo (default: cwd)
  --tagline <text>  Banner tagline (default: family entry, else package.json description)
  --accent <hex>    Accent colour (default: family entry, docs theme, favicon, else grey)
  --update          init: rewrite generated sources that differ (never favicon.svg)
  --social          init: also write avatar, Instagram post, story, and X, LinkedIn,
                    YouTube and Facebook headers
  --strict          doctor: exit 1 on warnings (stale renders, bannerless README) too
  --json            Machine-readable output on stdout
  --yes, -y         Accepted for parity; the CLI never prompts
  -h, --help
`

const HEX = /^#[0-9a-fA-F]{6}$/
const SOURCES = ['favicon.svg', 'banner.svg', 'banner-mobile.svg', 'social-card.svg', 'render.sh']

type Check = { check: string; status: 'ok' | 'warn' | 'fail'; detail?: string }

/** Read-only. A missing source fails; a missing or stale render and a bannerless README warn. */
async function doctor(dir: string): Promise<Check[]> {
	const at = (rel: string): string => path.join(dir, 'brand', rel)
	const mtime = async (f: string): Promise<number> => (await stat(f)).mtimeMs
	const checks: Check[] = []
	for (const f of SOURCES) {
		checks.push(
			(await exists(at(f)))
				? { check: `brand/${f}`, status: 'ok' }
				: { check: `brand/${f}`, status: 'fail', detail: 'missing — run `brand-kit`' }
		)
	}
	for (const [src, out] of RENDERS) {
		if (!(await exists(at(src)))) continue
		const newest = Math.max(await mtime(at(src)), await mtime(at('favicon.svg')).catch(() => 0))
		const detail = !(await exists(at(out)))
			? 'missing'
			: (await mtime(at(out))) < newest
				? 'older than its source'
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
			strict: { type: 'boolean' },
			json: { type: 'boolean' },
			yes: { type: 'boolean', short: 'y' },
			help: { type: 'boolean', short: 'h' },
		},
	})
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
	if (values.accent && !HEX.test(values.accent)) return fail('--accent must be a #rrggbb hex colour')

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
		return [...rendered, ...(banner ? [banner] : []), ...(await syncBrandToDocs(dir))]
	}

	if (command === 'init') {
		const written = await generateBrand(pkg, dir, {
			tagline: values.tagline,
			accent: values.accent,
			update: values.update,
			social: values.social,
		})
		wrote([...written, ...(await finish())])
		return 0
	}
	if (command === 'render') {
		wrote(await finish())
		return 0
	}
	if (command === 'doctor') {
		const checks = await doctor(dir)
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
