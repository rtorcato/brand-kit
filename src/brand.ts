/**
 * Brand assets: `brand/` holds the SVG sources (favicon tile, README banner,
 * mobile banner, social card) and `brand/render.sh` renders them to PNG, so a
 * banner can be recoloured, retitled or resized instead of being a committed
 * binary nobody can regenerate.
 *
 * Name comes from package.json, tagline and accent from flags, else the
 * @rtorcato family data in @rtorcato/shared-docs, else package.json / the docs
 * theme / neutral grey.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { exists, read, writeIfMissing } from './fs.js'

import { FAMILY, type FamilyMember } from '@rtorcato/shared-docs'

type Pkg = Record<string, unknown> | null

/** Grey, so an unbranded repo reads as unbranded rather than borrowing a colour. */
const NEUTRAL_ACCENT = '#8b95a7'

/** The cool counter-glow in the corner opposite the accent one. Fixed — it reads as depth, not brand. */
const COUNTER_GLOW = '#6e7bff'

const INK = '#0A0E16'
const TEXT = '#e6edf3'
const MUTED = '#9ba6b8'
// Fallback stacks: Avenir Next and Menlo are macOS-only, so Linux falls back to these.
const SANS = "'Avenir Next', Inter, 'Helvetica Neue', Arial, sans-serif"
const MONO = "Menlo, 'DejaVu Sans Mono', monospace"

export interface BrandMeta {
	/** Bare project name, e.g. `shared-docs`. */
	name: string
	tagline: string
	accent: string
	/** Package name for the `npm i` pill, or null for a repo that publishes nothing. */
	install: string | null
	/** True when `brand/background.png` exists; the canvases then draw it under a dark wash. */
	background?: boolean
}

/** `"` matters because this output also lands in double-quoted attributes (the `aria-label` below). */
function esc(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

/**
 * Greedy word wrap to a character budget. Character-budgeted rather than
 * measured because there is no text metric available here — the templates are
 * meant to be nudged by hand once rendered.
 */
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
	const lines: string[] = []
	let line = ''
	for (const word of text.split(/\s+/).filter(Boolean)) {
		const next = line ? `${line} ${word}` : word
		if (next.length > maxChars && line) {
			lines.push(line)
			line = word
			if (lines.length === maxLines) break
		} else {
			line = next
		}
	}
	if (lines.length < maxLines && line) lines.push(line)
	// Anything that didn't fit is dropped rather than overflowing the canvas.
	if (lines.length === maxLines && text.length > lines.join(' ').length) {
		lines[maxLines - 1] = `${lines[maxLines - 1]}…`
	}
	return lines
}

/** Near-black and near-white are background, not brand — skip them when sniffing a favicon. */
function isBackgroundColour(hex: string): boolean {
	const n = Number.parseInt(hex.slice(1), 16)
	const r = (n >> 16) & 0xff
	const g = (n >> 8) & 0xff
	const b = n & 0xff
	const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
	return luminance < 60 || luminance > 225
}

/**
 * The docs site's own accent, which is the most deliberate colour choice a repo
 * makes. Prefers the dark-mode value: these banners sit on a dark canvas.
 */
async function accentFromDocsTheme(targetDir: string): Promise<string | null> {
	const file = path.join(targetDir, 'apps', 'docs', 'src', 'css', 'custom.css')
	if (!(await exists(file))) return null
	const css = await read(file)
	const dark = css.match(
		/\[data-theme=["']dark["']\][\s\S]*?--ifm-color-primary:\s*(#[0-9a-fA-F]{6})/
	)
	if (dark?.[1]) return dark[1]
	return css.match(/--ifm-color-primary:\s*(#[0-9a-fA-F]{6})/)?.[1] ?? null
}

/** Where a repo already keeps a favicon — the docs site's first. */
const EXISTING_FAVICONS = [path.join('apps', 'docs', 'static', 'img', 'favicon.svg'), 'favicon.svg']

/** Failing that, the favicon's own ink — the other place a repo commits its colour. */
async function accentFromFavicon(targetDir: string): Promise<string | null> {
	for (const rel of EXISTING_FAVICONS) {
		const file = path.join(targetDir, rel)
		if (!(await exists(file))) continue
		const svg = await read(file)
		for (const [hex] of svg.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
			if (!isBackgroundColour(hex)) return hex
		}
	}
	return null
}

/**
 * The narrowest tagline budget any canvas uses (the mobile banner). A tagline
 * that needs more than two lines of it crowds the layout and gets cut off.
 */
const TAGLINE_MAX_CHARS = 42

/** True when `tagline` fits in two lines on every canvas, without an ellipsis. */
export function taglineFits(tagline: string): boolean {
	const words = tagline.split(/\s+/).filter(Boolean).join(' ')
	return wrapText(tagline, TAGLINE_MAX_CHARS, 2).join(' ') === words
}

export interface BrandOptions {
	/** Short banner line; falls back to the family entry, then package.json's description. */
	tagline?: string
	/** Accent hex; falls back to the family entry, the docs theme, the favicon, then grey. */
	accent?: string
	/** Rewrite the generated sources that differ, e.g. after a tagline or accent change. Never favicon.svg. */
	update?: boolean
	/** Also write the {@link SOCIAL} canvases. Once written, `update` keeps them current without it. */
	social?: boolean
}

/** The @rtorcato family entry (from @rtorcato/shared-docs), matched on the package name. */
export const familyEntry = (pkgName: string | undefined): FamilyMember | undefined =>
	FAMILY.find((m) => m.name === pkgName)

export async function resolveBrandMeta(
	pkg: Pkg,
	targetDir: string,
	opts: BrandOptions = {}
): Promise<BrandMeta> {
	const pkgName = typeof pkg?.name === 'string' ? pkg.name : undefined
	const name = pkgName?.split('/').pop() ?? path.basename(path.resolve(targetDir))
	const description = typeof pkg?.description === 'string' ? pkg.description : ''
	const member = familyEntry(pkgName)
	const accent =
		opts.accent ??
		member?.accent ??
		(await accentFromDocsTheme(targetDir)) ??
		(await accentFromFavicon(targetDir)) ??
		NEUTRAL_ACCENT
	return {
		name,
		tagline:
			opts.tagline || member?.tagline || description || 'Add a short tagline with --tagline.',
		accent,
		install: pkgName && pkg?.private !== true ? pkgName : null,
		background: await exists(path.join(targetDir, 'brand', 'background.png')),
	}
}

/**
 * The logo tile: a rounded square in the accent carrying the project's
 * initial. It *is* `brand/favicon.svg`, and every canvas below draws that file
 * rather than a copy of it, so swapping in a real glyph is a one-file edit (#678).
 */
export function faviconSvg(meta: BrandMeta): string {
	const initial = esc((meta.name[0] ?? '?').toUpperCase())
	return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
	<title>${esc(meta.name)}</title>
	<rect width="32" height="32" rx="8" fill="${meta.accent}"/>
	<text x="16" y="23" text-anchor="middle" font-family="${SANS}" font-weight="800" font-size="19" fill="${INK}">${initial}</text>
</svg>
`
}

/** The logo mark: `brand/favicon.svg`, drawn `size` px square. */
function mark(x: number, y: number, size: number): string {
	return `	<!-- Logo mark: brand/favicon.svg — edit that file to change it on every canvas. -->
	<image href="favicon.svg" x="${x}" y="${y}" width="${size}" height="${size}"/>`
}

/** `shared-docs` renders as a muted `repo-` and an accented `tooling`. */
function wordmark(meta: BrandMeta): string {
	const i = meta.name.lastIndexOf('-')
	if (i <= 0) return `<tspan fill="${meta.accent}">${esc(meta.name)}</tspan>`
	return `<tspan fill="${TEXT}">${esc(meta.name.slice(0, i + 1))}</tspan><tspan fill="${meta.accent}">${esc(meta.name.slice(i + 1))}</tspan>`
}

function taglineBlock(
	meta: BrandMeta,
	opts: { x: number; y: number; step: number; size: number; centred: boolean; maxChars: number }
): string {
	// Three lines: every canvas has room for a third, and cutting a real tagline
	// short is worse than one extra line of copy.
	const lines = wrapText(meta.tagline, opts.maxChars, 3)
	// librsvg does not reset x on a y-only tspan, so every line repeats x.
	const tspans = lines
		.map((l, i) => `\t\t<tspan x="${opts.x}" y="${opts.y + i * opts.step}">${esc(l)}</tspan>`)
		.join('\n')
	const anchor = opts.centred ? ' text-anchor="middle"' : ''
	return `	<text${anchor} font-family="${SANS}" font-weight="500" font-size="${opts.size}" fill="${MUTED}">
${tspans}
	</text>`
}

/** The install pill. Omitted entirely for a repo with nothing to `npm i`. */
function installPanel(
	meta: BrandMeta,
	opts: { x: number; y: number; w: number; h: number; size: number }
): string {
	if (!meta.install) return ''
	return `
	<rect x="${opts.x}" y="${opts.y}" width="${opts.w}" height="${opts.h}" rx="14" fill="#11151d" stroke="#232936" stroke-width="1"/>
	<text xml:space="preserve" x="${opts.x + opts.w / 2}" y="${opts.y + opts.h / 2 + opts.size / 3}" text-anchor="middle" font-family="${MONO}" font-size="${opts.size}"><tspan fill="${meta.accent}">npm i </tspan><tspan fill="${TEXT}">${esc(meta.install)}</tspan></text>`
}

function canvas(meta: BrandMeta, w: number, h: number, glow: { cx: number; cy: number }): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(meta.name)} — ${esc(meta.tagline)}">
	<defs>
		<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#0d1117"/>
			<stop offset="1" stop-color="#090c13"/>
		</linearGradient>
		<radialGradient id="glow" cx="${glow.cx}" cy="${glow.cy}" r="0.55">
			<stop offset="0" stop-color="${meta.accent}" stop-opacity="0.15"/>
			<stop offset="1" stop-color="${meta.accent}" stop-opacity="0"/>
		</radialGradient>
		<radialGradient id="glow2" cx="0.92" cy="1" r="0.5">
			<stop offset="0" stop-color="${COUNTER_GLOW}" stop-opacity="0.12"/>
			<stop offset="1" stop-color="${COUNTER_GLOW}" stop-opacity="0"/>
		</radialGradient>
	</defs>

	<rect width="${w}" height="${h}" fill="url(#bg)"/>${
		meta.background
			? `
	<!-- Artwork: brand/background.png, cropped to fill, washed dark so the text stays readable. -->
	<image href="background.png" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>
	<rect width="${w}" height="${h}" fill="#0d1117" fill-opacity="0.55"/>`
			: ''
	}
	<rect width="${w}" height="${h}" fill="url(#glow)"/>
	<rect width="${w}" height="${h}" fill="url(#glow2)"/>
`
}

/** 1280×320 README banner — left-aligned lockup, install pill on the right. */
export function bannerSvg(meta: BrandMeta): string {
	return `${canvas(meta, 1280, 320, { cx: 0.16, cy: 0 })}
${mark(60, 88, 72)}

	<text x="156" y="150" font-family="${SANS}" font-weight="800" font-size="62" letter-spacing="-1.5">${wordmark(meta)}</text>

${taglineBlock(meta, { x: 62, y: 198, step: 28, size: 20, centred: false, maxChars: 44 })}
${installPanel(meta, { x: 845, y: 118, w: 378, h: 84, size: 20 })}
</svg>
`
}

/** 1280×786 mobile banner — the same content stacked so it stays legible on a phone. */
export function bannerMobileSvg(meta: BrandMeta): string {
	return `${canvas(meta, 1280, 786, { cx: 0.12, cy: 0.05 })}
${mark(565, 104, 150)}

	<text x="640" y="360" text-anchor="middle" font-family="${SANS}" font-weight="800" font-size="76" letter-spacing="-1.8">${wordmark(meta)}</text>

${taglineBlock(meta, { x: 640, y: 510, step: 44, size: 30, centred: true, maxChars: 42 })}
${installPanel(meta, { x: 427, y: 650, w: 426, h: 78, size: 24 })}
</svg>
`
}

/** The social card's centred stack — mark, wordmark, tagline, pill — laid out on 1280×640. */
function lockup(meta: BrandMeta): string {
	return `${mark(590, 120, 100)}

	<text x="640" y="300" text-anchor="middle" font-family="${SANS}" font-weight="800" font-size="76" letter-spacing="-1.8">${wordmark(meta)}</text>

${taglineBlock(meta, { x: 640, y: 372, step: 42, size: 28, centred: true, maxChars: 44 })}
${installPanel(meta, { x: 427, y: 470, w: 426, h: 78, size: 24 })}`
}

/** 1280×640 Open Graph / GitHub social card. Keep content inside an ~8% safe inset. */
export function socialCardSvg(meta: BrandMeta): string {
	return `${canvas(meta, 1280, 640, { cx: 0.1, cy: 0.05 })}
${lockup(meta)}
</svg>
`
}

type Box = { x: number; y: number; w: number; h: number }

/** Where {@link lockup} actually draws on its 1280×640 canvas. */
const LOCKUP_BOX: Box = { x: 160, y: 110, w: 960, h: 450 }

/** Any other canvas: the social card's lockup scaled to fit, centred in `safe`. */
function socialSvg(meta: BrandMeta, w: number, h: number, safe: Box): string {
	const s = Math.min(safe.w / LOCKUP_BOX.w, safe.h / LOCKUP_BOX.h)
	const tx = safe.x + safe.w / 2 - s * (LOCKUP_BOX.x + LOCKUP_BOX.w / 2)
	const ty = safe.y + safe.h / 2 - s * (LOCKUP_BOX.y + LOCKUP_BOX.h / 2)
	const r = (n: number): number => Math.round(n * 1000) / 1000
	return `${canvas(meta, w, h, { cx: 0.1, cy: 0.05 })}
	<g transform="translate(${r(tx)} ${r(ty)}) scale(${r(s)})">
${lockup(meta)}
	</g>
</svg>
`
}

/** 400×400 profile picture. The tile sits at 60% so a circular crop never clips its corners. */
export function avatarSvg(meta: BrandMeta): string {
	return `${canvas(meta, 400, 400, { cx: 0.1, cy: 0.05 })}
${mark(80, 80, 240)}
</svg>
`
}

type SocialCanvas = [stem: string, w: number, h: number, svg: (meta: BrandMeta) => string]
const social = (stem: string, w: number, h: number, safe: Box): SocialCanvas => [
	stem,
	w,
	h,
	(meta) => socialSvg(meta, w, h, safe),
]

/**
 * `brand-kit --social`: profile and posting images, each written as `brand/<stem>.svg`.
 * ponytail: safe areas are each platform's published guidance, eyeballed — nudge a box if a
 * platform's chrome covers the lockup.
 */
export const SOCIAL: SocialCanvas[] = [
	['avatar', 400, 400, avatarSvg],
	social('instagram-post', 1080, 1080, { x: 86, y: 86, w: 908, h: 908 }),
	// Instagram / TikTok / Facebook stories: the top and bottom 250px sit under app chrome.
	social('story', 1080, 1920, { x: 86, y: 250, w: 908, h: 1420 }),
	// X and LinkedIn put the profile photo over the bottom-left.
	social('x-header', 1500, 500, { x: 360, y: 40, w: 1080, h: 340 }),
	social('linkedin-banner', 1584, 396, { x: 420, y: 36, w: 1110, h: 300 }),
	// The 1546×423 middle is the only part every device shows.
	social('youtube-banner', 2560, 1440, { x: 507, y: 508, w: 1546, h: 423 }),
	// Mobile crops the sides.
	social('facebook-cover', 1640, 624, { x: 270, y: 60, w: 1100, h: 504 }),
]

/**
 * The render script. Sizes come from the #318 spec. It self-skips outputs whose
 * source or destination doesn't exist, so the same script works in a repo with
 * no docs site.
 */
export const RENDER_SH = `#!/usr/bin/env bash
# Render the committed brand PNGs from their SVG sources.
# Sizes come from the brand-asset spec: 1280x320 banner, 1280x786 mobile,
# 1280x640 social card, 512x512 PWA icon, favicon.ico.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v rsvg-convert >/dev/null 2>&1; then
	echo "brand/render.sh needs librsvg — install it with: brew install librsvg" >&2
	echo "(apt: apt-get install librsvg2-bin)" >&2
	exit 1
fi

rsvg-convert -w 1280 -h 320 brand/banner.svg        -o brand/banner.png
rsvg-convert -w 1280 -h 786 brand/banner-mobile.svg -o brand/banner-mobile.png
rsvg-convert -w 1280 -h 640 brand/social-card.svg   -o brand/social-card.png
rsvg-convert -w 512  -h 512 brand/favicon.svg       -o brand/favicon-512.png
echo "rendered: brand/banner.png brand/banner-mobile.png brand/social-card.png brand/favicon-512.png"

# favicon.ico: the 16 and 32 sizes, packed with ImageMagick when present.
if command -v magick >/dev/null 2>&1; then
	magick -background none brand/favicon.svg -define icon:auto-resize=16,32 brand/favicon.ico
	echo "rendered: brand/favicon.ico"
else
	echo "skipped brand/favicon.ico: needs ImageMagick (\`magick\`) or \`npx @rtorcato/brand-kit render\`" >&2
fi

# The docs site gets copies (never overwritten), like \`brand-kit\`'s docs sync.
img=apps/docs/static/img
if [ -d apps/docs ]; then
	mkdir -p "$img"
	for f in favicon.svg favicon.ico social-card.png; do
		if [ -f "brand/$f" ] && [ ! -e "$img/$f" ]; then
			cp "brand/$f" "$img/$f"
			echo "copied: $img/$f"
		fi
	done
fi

# The --social canvases, each rendered only when its source exists.
social() {
	if [ -f "brand/$1.svg" ]; then
		rsvg-convert -w "$2" -h "$3" "brand/$1.svg" -o "brand/$1.png"
		echo "rendered: brand/$1.png"
	fi
}
${SOCIAL.map(([stem, w, h]) => `social ${stem} ${w} ${h}`).join('\n')}
`

/**
 * Repoint a README still using the pre-amendment root-level banner paths at
 * `brand/`. Only bare or `./` root-level banner paths move — `images/banner.png`,
 * `my-banner.png` and anything else in the README is left alone.
 */
export async function repointReadmeBanners(targetDir: string): Promise<string | null> {
	const file = path.join(targetDir, 'README.md')
	if (!(await exists(file))) return null
	const readme = await read(file)
	const next = readme.replace(/(?<![\w/.-])(?:\.\/)?(banner(?:-mobile)?\.png)/g, './brand/$1')
	if (next === readme) return null
	await writeFile(file, next)
	return 'README.md'
}

/** A favicon the repo already commits beats the generated initial tile. */
async function existingFavicon(targetDir: string): Promise<string | null> {
	for (const rel of EXISTING_FAVICONS) {
		const file = path.join(targetDir, rel)
		if (await exists(file)) return read(file)
	}
	return null
}

/**
 * Scaffold `brand/`: the favicon tile, three SVG sources that draw it, and the
 * render script, then repoint a README still on the old root-level paths.
 * Every file is written only when absent, so `brand-kit` is idempotent;
 * `update` rewrites the canvases and render.sh when they differ. favicon.svg is
 * never rewritten — it may be a hand-drawn or pre-existing glyph.
 */
export async function generateBrand(
	pkg: Pkg,
	targetDir: string,
	opts: BrandOptions = {}
): Promise<string[]> {
	const meta = await resolveBrandMeta(pkg, targetDir, opts)
	const written: string[] = []
	const files: Array<[string, string, number?]> = [
		['brand/favicon.svg', (await existingFavicon(targetDir)) ?? faviconSvg(meta)],
		['brand/banner.svg', bannerSvg(meta)],
		['brand/banner-mobile.svg', bannerMobileSvg(meta)],
		['brand/social-card.svg', socialCardSvg(meta)],
		['brand/render.sh', RENDER_SH, 0o755],
	]
	for (const [stem, , , svg] of SOCIAL) {
		const rel = `brand/${stem}.svg`
		if (opts.social || (await exists(path.join(targetDir, rel)))) files.push([rel, svg(meta)])
	}
	for (const [rel, contents, mode] of files) {
		const file = path.join(targetDir, rel)
		// --social refreshes render.sh too, or an older script would skip the new canvases.
		const rewrite = opts.update || (opts.social && rel === 'brand/render.sh')
		if (rewrite && rel !== 'brand/favicon.svg' && (await exists(file))) {
			if ((await read(file)) === contents) continue
			await writeFile(file, contents, mode ? { mode } : undefined)
			written.push(rel)
			continue
		}
		const w = await writeIfMissing(targetDir, rel, contents, mode)
		if (w) written.push(w)
	}
	// stderr, not stdout: --json owns stdout.
	if (written.some((f) => f.endsWith('.svg')) && !taglineFits(meta.tagline)) {
		console.error(
			'   warning: the tagline needs more than two lines and will be cut off on the mobile banner — pass a shorter one with --tagline'
		)
	}
	const readme = await repointReadmeBanners(targetDir)
	if (readme) written.push(readme)
	return written
}

/** Printed when `rsvg-convert` is not on PATH — the sources are still written. */
export const RSVG_HINT =
	'   next: install librsvg to render the brand PNGs (`brew install librsvg`, apt: `apt-get install librsvg2-bin`), then re-run `brand-kit` or `brand/render.sh`'

/**
 * `[source, output, width, height]` under `brand/` — the same set render.sh draws.
 * A job whose source doesn't exist is skipped, so the SOCIAL ones cost nothing without --social.
 */
export const RENDERS: Array<[string, string, number, number]> = [
	['banner.svg', 'banner.png', 1280, 320],
	['banner-mobile.svg', 'banner-mobile.png', 1280, 786],
	['social-card.svg', 'social-card.png', 1280, 640],
	['favicon.svg', 'favicon-512.png', 512, 512],
	['favicon.svg', 'favicon.ico', 32, 32],
	...SOCIAL.map(([stem, w, h]): [string, string, number, number] => [
		`${stem}.svg`,
		`${stem}.png`,
		w,
		h,
	]),
]

/** Classic favicon sizes packed into favicon.ico. */
const ICO_SIZES = [16, 32]

/**
 * An ICO container holding PNG frames — every browser since IE Vista reads
 * PNG-in-ICO, so no bitmap conversion is needed.
 */
export function packIco(frames: Array<[size: number, png: Buffer]>): Buffer {
	const header = Buffer.alloc(6 + 16 * frames.length)
	header.writeUInt16LE(1, 2) // type: icon
	header.writeUInt16LE(frames.length, 4)
	let offset = header.length
	frames.forEach(([size, png], i) => {
		const e = 6 + 16 * i
		header.writeUInt8(size % 256, e) // 0 means 256
		header.writeUInt8(size % 256, e + 1)
		header.writeUInt16LE(1, e + 4) // colour planes
		header.writeUInt16LE(32, e + 6) // bits per pixel
		header.writeUInt32LE(png.length, e + 8)
		header.writeUInt32LE(offset, e + 12)
		offset += png.length
	})
	return Buffer.concat([header, ...frames.map(([, png]) => png)])
}

async function mtime(file: string): Promise<number> {
	return (await stat(file)).mtimeMs
}

/**
 * Render every `brand/` PNG (and favicon.ico) that is missing or older than its
 * source — or than favicon.svg or background.png, which every canvas draws. Returns the files
 * written, or null when `rsvg-convert` is not on PATH (after printing
 * {@link RSVG_HINT}). Nothing stale means nothing to do and no PATH lookup.
 */
export async function renderBrand(targetDir: string): Promise<string[] | null> {
	const brand = path.join(targetDir, 'brand')
	const favicon = path.join(brand, 'favicon.svg')
	const background = path.join(brand, 'background.png')
	const stale: typeof RENDERS = []
	for (const job of RENDERS) {
		const [src, out] = job
		const srcFile = path.join(brand, src)
		const outFile = path.join(brand, out)
		if (!(await exists(srcFile))) continue
		const newest = Math.max(
			await mtime(srcFile),
			(await exists(favicon)) ? await mtime(favicon) : 0,
			(await exists(background)) ? await mtime(background) : 0
		)
		if (!(await exists(outFile)) || (await mtime(outFile)) < newest) stale.push(job)
	}
	if (stale.length === 0) return []

	if (spawnSync('rsvg-convert', ['--version']).error) {
		// stderr, not stdout: --json owns stdout.
		console.error(RSVG_HINT)
		return null
	}
	// cwd = brand/ so each canvas's `href="favicon.svg"` resolves beside it.
	const rsvg = (src: string, w: number, h: number): Buffer =>
		execFileSync('rsvg-convert', ['-w', String(w), '-h', String(h), src], { cwd: brand })

	const written: string[] = []
	for (const [src, out, w, h] of stale) {
		const png = out.endsWith('.ico')
			? packIco(ICO_SIZES.map((s) => [s, rsvg(src, s, s)]))
			: rsvg(src, w, h)
		await writeFile(path.join(brand, out), png)
		written.push(`brand/${out}`)
	}
	return written
}

/** brand/ file → docs-site static/img file. The ico and card PNG exist only once rendered. */
export const DOCS_ASSETS = ['favicon.svg', 'favicon.ico', 'social-card.png']

/**
 * Copy the brand favicon and social card into the docs site's `static/img`
 * Copy-if-missing, and a no-op without `apps/docs`, so `brand` and
 * `init` reach the same tree in either order — each calls it. `replace`
 * overwrites the copies, for when the brand itself was just regenerated.
 */
export async function syncBrandToDocs(targetDir: string, replace = false): Promise<string[]> {
	if (!(await exists(path.join(targetDir, 'apps', 'docs')))) return []
	const img = path.join('apps', 'docs', 'static', 'img')
	const written: string[] = []
	for (const name of DOCS_ASSETS) {
		const src = path.join(targetDir, 'brand', name)
		const dest = path.join(targetDir, img, name)
		if (!(await exists(src)) || (!replace && (await exists(dest)))) continue
		await mkdir(path.dirname(dest), { recursive: true })
		await copyFile(src, dest)
		written.push(path.join(img, name))
	}
	return written
}

export const BANNER_START = '<!-- js-tooling:banner:start -->'
export const BANNER_END = '<!-- js-tooling:banner:end -->'

/** The README `<picture>` banner, mobile variant under 640px, as a delimited block. */
export function buildBannerBlock(name: string): string {
	return `${BANNER_START}
<picture>
  <source media="(max-width: 640px)" srcset="./brand/banner-mobile.png">
  <img src="./brand/banner.png" alt="${esc(name)} banner" width="1600">
</picture>
${BANNER_END}`
}

/**
 * Put the banner block at the top of a README. Refreshes an existing block in
 * place; leaves alone a README that already shows a banner outside one (a
 * hand-written `<picture>`); otherwise prepends. Idempotent.
 */
export function upsertBanner(readme: string, block: string): string {
	const start = readme.indexOf(BANNER_START)
	const end = readme.indexOf(BANNER_END)
	if (start !== -1 && end > start) {
		return readme.slice(0, start) + block + readme.slice(end + BANNER_END.length)
	}
	if (/banner(?:-mobile)?\.png/.test(readme)) return readme
	return `${block}\n\n${readme}`
}

/** Add the banner block to README.md once `brand/banner.png` exists to show. */
export async function addReadmeBanner(targetDir: string, name: string): Promise<string | null> {
	const file = path.join(targetDir, 'README.md')
	if (!(await exists(file))) return null
	if (!(await exists(path.join(targetDir, 'brand', 'banner.png')))) return null
	const readme = await read(file)
	const next = upsertBanner(readme, buildBannerBlock(name))
	if (next === readme) return null
	await writeFile(file, next)
	return 'README.md'
}
