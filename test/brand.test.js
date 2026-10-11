// Unit tests for the pure helpers, plus one real render (needs rsvg-convert; CI installs librsvg2-bin).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
	BANNER_END,
	BANNER_START,
	buildBannerBlock,
	faviconSvg,
	packIco,
	RENDERS,
	renderBrand,
	upsertBanner,
	wrapText,
} from '../dist/brand.js'

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

test('upsertBanner refreshes in place, ignores a table row naming banner.png, else prepends', () => {
	const block = buildBannerBlock('x')
	const stale = `${BANNER_START}\nold\n${BANNER_END}`
	assert.equal(upsertBanner(`${stale}\n\n# T`, block), `${block}\n\n# T`)
	const table = '| `brand/banner.png` | 1280x320 |\n# T'
	assert.equal(upsertBanner(table, block), `${block}\n\n${table}`)
	assert.equal(upsertBanner('# T', block), `${block}\n\n# T`)
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
