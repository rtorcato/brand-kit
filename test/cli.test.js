// End-to-end: run the built CLI against a throwaway repo.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

const cli = new URL('../dist/cli.js', import.meta.url).pathname
const run = (dir, ...args) => spawnSync('node', [cli, ...args, '--dir', dir], { encoding: 'utf8' })

function repo(name = '@rtorcato/some-lib') {
	const dir = mkdtempSync(join(tmpdir(), 'brand-kit-'))
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, description: 'x' }))
	return dir
}

test('init writes the SVG sources from flags, and is idempotent', () => {
	const dir = repo()
	run(dir, '--tagline', 'Short tagline', '--accent', '#e879f9')
	const banner = readFileSync(join(dir, 'brand/banner.svg'), 'utf8')
	assert.match(banner, /#e879f9/)
	assert.match(banner, /Short tagline/)
	const again = JSON.parse(run(dir, 'init', '--json').stdout)
	assert.ok(!again.written.some((f) => f.endsWith('.svg')))
})

test('a family member gets its accent and tagline from @rtorcato/shared-docs', () => {
	const dir = repo('@rtorcato/js-common')
	run(dir)
	assert.match(readFileSync(join(dir, 'brand/banner.svg'), 'utf8'), /#f2cc60/)
})

test('--update rewrites a changed canvas but never favicon.svg', () => {
	const dir = repo()
	run(dir, '--tagline', 'Old tagline')
	const glyph = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="9"/></svg>'
	writeFileSync(join(dir, 'brand/favicon.svg'), glyph)
	const { written } = JSON.parse(run(dir, '--tagline', 'New tagline', '--update', '--json').stdout)
	assert.ok(written.includes('brand/banner.svg'))
	assert.match(readFileSync(join(dir, 'brand/banner.svg'), 'utf8'), /New tagline/)
	assert.equal(readFileSync(join(dir, 'brand/favicon.svg'), 'utf8'), glyph)
})

test('doctor fails without sources, passes after init; --json is parseable', () => {
	const dir = repo()
	assert.equal(run(dir, 'doctor').status, 1)
	run(dir)
	const res = run(dir, 'doctor', '--json')
	assert.equal(res.status, 0)
	assert.ok(JSON.parse(res.stdout).checks.every((c) => c.status !== 'fail'))
})

test('a repo with a docs site gets the favicon copied into static/img', () => {
	const dir = repo()
	mkdirSync(join(dir, 'apps/docs'), { recursive: true })
	const { written } = JSON.parse(run(dir, '--json').stdout)
	assert.ok(written.includes('apps/docs/static/img/favicon.svg'))
})

test('--social writes the social canvases and render.sh lists them; plain init does not', () => {
	const plain = repo()
	run(plain)
	assert.ok(!existsSync(join(plain, 'brand/instagram-post.svg')))
	const dir = repo()
	run(dir, '--social')
	for (const stem of ['avatar', 'instagram-post', 'story', 'x-header', 'youtube-banner']) {
		assert.ok(existsSync(join(dir, `brand/${stem}.svg`)), stem)
	}
	assert.match(readFileSync(join(dir, 'brand/render.sh'), 'utf8'), /^social story 1080 1920$/m)
})

test('a bad --accent is rejected', () => {
	assert.equal(run(repo(), '--accent', 'red').status, 1)
})
