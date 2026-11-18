// Unit tests for the pure helpers, plus one real render (needs rsvg-convert; CI installs librsvg2-bin).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
	addReadmeBanner,
	BANNER_END,
	BANNER_START,
	bannerMobileSvg,
	bannerSvg,
	buildBannerBlock,
	faviconSvg,
	packIco,
	DOCS_ASSETS,
	RENDER_SH,
	RENDERS,
	renderBrand,
	upsertBanner,
	wrapText,
} from '../dist/brand.js'

test('the docs site copies favicon.svg and the card, never the raster favicon.ico', () => {
	assert.deepEqual(DOCS_ASSETS, ['favicon.svg', 'social-card.png'])
	assert.match(RENDER_SH, /for f in favicon\.svg social-card\.png; do/)
	assert.doesNotMatch(RENDER_SH, /favicon\.ico social-card/)
})

test('an unbranded wordmark is all text colour; grey stays on the npm i prefix and pill edge is #30363d', () => {
	const svg = bannerSvg({
		name: 'basic-lib',
		tagline: 'A tagline',
		accent: '#8b95a7',
		install: 'basic-lib',
	})
	assert.ok(svg.includes('<tspan fill="#e6edf3">basic-</tspan><tspan fill="#e6edf3">lib</tspan>'))
	assert.ok(svg.includes('<tspan fill="#8b95a7">npm i </tspan>'))
	assert.ok(svg.includes('stroke="#30363d"'))
})

test('wrapText wraps to the fewest lines and ellipsises what overflows maxLines', () => {
	assert.deepEqual(wrapText('one two three', 20, 3), ['one two three'])
	assert.deepEqual(wrapText('aaa bbb ccc ddd', 7, 3), ['aaa bbb', 'ccc ddd'])
	assert.deepEqual(wrapText('', 20, 3), [])
	const cut = wrapText('aaa bbb ccc ddd eee', 7, 2)
	assert.equal(cut.length, 2)
	assert.equal(cut[1], 'ccc ddd…')
})

test('wrapText balances lines instead of orphaning the last word', () => {
	const tagline = 'Banner, social card and favicon for any repo.'
	// Mobile banner budget: greedy would leave "repo." alone on line 2.
	assert.deepEqual(wrapText(tagline, 42, 3), ['Banner, social card and', 'favicon for any repo.'])
	// Desktop banner budget: one line.
	assert.deepEqual(wrapText(tagline, 60, 3), [tagline])
	assert.deepEqual(wrapText('aa bb cc dd ee', 11, 3), ['aa bb cc', 'dd ee'])
	// Balancing never exceeds the budget or adds a line.
	for (const line of wrapText('one two three four five six seven', 14, 3)) {
		assert.ok(line.length <= 14, line)
	}
	assert.equal(wrapText('one two three four five six seven', 14, 3).length, 3)
	// A word longer than the budget still gets a line of its own.
	assert.deepEqual(wrapText('a supercalifragilistic b', 10, 3), ['a', 'supercalifragilistic', 'b'])
})

test('the mobile banner centres its stack for 1-, 2- and 3-line taglines, with and without the pill', () => {
	const base = { name: 'demo', accent: '#e879f9', install: 'demo' }
	const taglines = [
		['Banner, social card.', 1],
		['Banner, social card and favicon for any repo.', 2],
		[
			'Banner, social card and favicon for any repo, drawn from one tiny command in your terminal today.',
			3,
		],
	]
	for (const [tagline, lines] of taglines) {
		assert.equal(wrapText(tagline, 42, 3).length, lines, tagline)
		const withPill = bannerMobileSvg({ ...base, tagline })
		// The mark's top and the pill's bottom sit the same distance from the canvas edges.
		const top = Number(withPill.match(/<image href="favicon\.svg" x="565" y="(\d+)"/)[1])
		const pill = withPill.match(/<rect x="427" y="(\d+)" width="426" height="78" rx="14"/)
		assert.ok(pill, tagline)
		assert.equal(top, 786 - (Number(pill[1]) + 78), tagline)
		const noPill = bannerMobileSvg({ ...base, tagline, install: null })
		assert.doesNotMatch(noPill, /rx="14"/)
	}
})

test('upsertBanner refreshes in place, ignores a table row naming banner.png, else prepends', () => {
	const block = buildBannerBlock('x')
	const stale = `${BANNER_START}\nold\n${BANNER_END}`
	assert.equal(upsertBanner(`${stale}\n\n# T`, block), `${block}\n\n# T`)
	const table = '| `brand/banner.png` | 1280x320 |\n# T'
	assert.equal(upsertBanner(table, block), `${block}\n\n${table}`)
	assert.equal(upsertBanner('# T', block), `${block}\n\n# T`)
})

test('the README banner alt is the tagline, else "<name> banner", never the placeholder', async () => {
	const readmeFor = async (opts) => {
		const dir = mkdtempSync(join(tmpdir(), 'banner-alt-'))
		mkdirSync(join(dir, 'brand'))
		writeFileSync(join(dir, 'brand', 'banner.png'), '')
		writeFileSync(join(dir, 'README.md'), '# demo\n')
		writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'demo' }))
		await addReadmeBanner(dir, 'demo', opts)
		return readFileSync(join(dir, 'README.md'), 'utf8')
	}
	assert.match(await readmeFor({ tagline: 'Ship & see' }), /alt="Ship &amp; see"/)
	assert.match(await readmeFor({}), /alt="demo banner"/)
})

test('workspace package READMEs get an absolute-URL banner; root stays relative; idempotent', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'banner-ws-'))
	mkdirSync(join(dir, 'brand'))
	writeFileSync(join(dir, 'brand', 'banner.png'), '')
	writeFileSync(join(dir, 'README.md'), '# root\n')
	writeFileSync(
		join(dir, 'package.json'),
		JSON.stringify({ name: 'mono', repository: { url: 'git+https://github.com/acme/mono.git' } })
	)
	for (const [name, priv] of [
		['a', false],
		['b', true],
	]) {
		mkdirSync(join(dir, 'packages', name), { recursive: true })
		writeFileSync(join(dir, 'packages', name, 'README.md'), `# ${name}\n`)
		writeFileSync(
			join(dir, 'packages', name, 'package.json'),
			JSON.stringify({ name, private: priv })
		)
	}
	const written = await addReadmeBanner(dir, 'mono', {})
	assert.deepEqual(written, ['README.md', join('packages', 'a', 'README.md')])
	const root = readFileSync(join(dir, 'README.md'), 'utf8')
	const pkgA = readFileSync(join(dir, 'packages', 'a', 'README.md'), 'utf8')
	assert.match(root, /src="\.\/brand\/banner\.png"/)
	assert.match(
		pkgA,
		/src="https:\/\/raw\.githubusercontent\.com\/acme\/mono\/[\w.-]+\/brand\/banner\.png"/
	)
	assert.match(
		pkgA,
		/srcset="https:\/\/raw\.githubusercontent\.com\/acme\/mono\/[\w.-]+\/brand\/banner-mobile\.png"/
	)
	assert.equal(readFileSync(join(dir, 'packages', 'b', 'README.md'), 'utf8'), '# b\n')
	assert.deepEqual(await addReadmeBanner(dir, 'mono', {}), [])
})

test('a package with repository.directory gets absolute banner URLs in its own README', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'banner-dir-'))
	mkdirSync(join(dir, 'brand'))
	writeFileSync(join(dir, 'brand', 'banner.png'), '')
	writeFileSync(join(dir, 'README.md'), '# p\n')
	writeFileSync(
		join(dir, 'package.json'),
		JSON.stringify({
			name: 'p',
			repository: { url: 'https://github.com/acme/mono.git', directory: 'packages/p' },
		})
	)
	await addReadmeBanner(dir, 'p', {})
	assert.match(
		readFileSync(join(dir, 'README.md'), 'utf8'),
		/https:\/\/raw\.githubusercontent\.com\/acme\/mono\//
	)
})

test('packIco writes an ICONDIR with one entry per frame', () => {
	const a = Buffer.from('aa')
	const b = Buffer.from('bbb')
	const ico = packIco([
		[16, a],
		[32, b],
	])
	assert.equal(ico.readUInt16LE(2), 1)
	assert.equal(ico.readUInt16LE(4), 2)
	assert.equal(ico[6], 16)
	assert.equal(ico[22], 32)
	assert.equal(ico.readUInt32LE(14), 2)
	assert.equal(ico.readUInt32LE(30), 3)
	assert.equal(ico.readUInt32LE(18), 38)
	assert.equal(ico.readUInt32LE(34), 40)
	assert.equal(ico.length, 43)
})

const hasRsvg = !spawnSync('rsvg-convert', ['--version']).error
test('renderBrand writes PNGs at the RENDERS sizes and a 2-frame favicon.ico', {
	skip: !hasRsvg,
}, async () => {
	const dir = mkdtempSync(join(tmpdir(), 'brand-kit-render-'))
	mkdirSync(join(dir, 'brand'))
	writeFileSync(join(dir, 'brand/favicon.svg'), faviconSvg({ name: 'x', accent: '#e879f9' }))
	writeFileSync(
		join(dir, 'brand/banner.svg'),
		'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="320"><rect width="1280" height="320"/></svg>'
	)
	const written = await renderBrand(dir)
	assert.ok(written?.includes('brand/banner.png'))
	for (const [src, out, w, h] of RENDERS) {
		if (!['banner.svg', 'favicon.svg'].includes(src) || out.endsWith('.ico')) continue
		const png = readFileSync(join(dir, 'brand', out))
		assert.equal(png.readUInt32BE(16), w, out)
		assert.equal(png.readUInt32BE(20), h, out)
	}
	const ico = readFileSync(join(dir, 'brand/favicon.ico'))
	assert.equal(ico.readUInt16LE(0), 0)
	assert.equal(ico.readUInt16LE(2), 1)
	assert.equal(ico.readUInt16LE(4), 2)
})
