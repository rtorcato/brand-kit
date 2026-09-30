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

test('wrapText wraps greedily and ellipsises what overflows maxLines', () => {
	assert.deepEqual(wrapText('one two three', 20, 3), ['one two three'])
	assert.deepEqual(wrapText('aaa bbb ccc ddd', 7, 3), ['aaa bbb', 'ccc ddd'])
	const cut = wrapText('aaa bbb ccc ddd eee', 7, 2)
	assert.equal(cut.length, 2)
	assert.equal(cut[1], 'ccc ddd…')
})

test('upsertBanner refreshes in place, leaves a hand-written banner, else prepends', () => {
	const block = buildBannerBlock('x')
	const stale = `${BANNER_START}\nold\n${BANNER_END}`
	assert.equal(upsertBanner(`${stale}\n\n# T`, block), `${block}\n\n# T`)
	const handmade = '<img src="banner.png">\n# T'
	assert.equal(upsertBanner(handmade, block), handmade)
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
