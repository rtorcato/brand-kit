// End-to-end: run the built CLI against a throwaway repo.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
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
	const glyph =
		'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="9"/></svg>'
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

test('doctor --strict fails on a warning', () => {
	const dir = repo()
	run(dir)
	writeFileSync(join(dir, 'README.md'), '# no banner\n')
	assert.equal(run(dir, 'doctor').status, 0)
	const res = run(dir, 'doctor', '--strict', '--json')
	assert.equal(res.status, 1)
	assert.equal(JSON.parse(res.stdout).ok, false)
})

test('doctor warns when a source drifts from the current brand meta, but not for favicon.svg', () => {
	const dir = repo()
	run(dir, '--tagline', 'Old tagline')
	writeFileSync(join(dir, 'brand/favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
	const drift = (args = []) =>
		JSON.parse(run(dir, 'doctor', '--json', ...args).stdout).checks.filter((c) =>
			c.detail?.includes('brand-kit --update')
		)
	assert.equal(drift(['--tagline', 'Old tagline']).length, 0)
	assert.deepEqual(
		drift(['--tagline', 'New tagline']).map((c) => c.check),
		['brand/banner.svg', 'brand/banner-mobile.svg', 'brand/social-card.svg']
	)
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

test('README repoint moves only root-level banner paths', () => {
	const dir = repo()
	writeFileSync(
		join(dir, 'README.md'),
		'![a](banner.png) ![b](./banner-mobile.png) ![c](images/banner.png) my-banner.png ![d](./brand/banner.png)\n'
	)
	run(dir)
	assert.equal(
		readFileSync(join(dir, 'README.md'), 'utf8'),
		'![a](./brand/banner.png) ![b](./brand/banner-mobile.png) ![c](images/banner.png) my-banner.png ![d](./brand/banner.png)\n'
	)
})

test('--version prints the package version', () => {
	const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
	assert.equal(spawnSync('node', [cli, '--version'], { encoding: 'utf8' }).stdout.trim(), version)
})

test('a changed brand file refreshes its docs copy, and doctor warns while they differ', () => {
	const dir = repo()
	mkdirSync(join(dir, 'apps/docs'), { recursive: true })
	run(dir)
	const copy = join(dir, 'apps/docs/static/img/favicon.svg')
	writeFileSync(copy, 'stale')
	const doc = JSON.parse(run(dir, 'doctor', '--json').stdout)
	assert.ok(JSON.stringify(doc).includes('apps/docs/static/img/favicon.svg'))
	run(dir)
	assert.equal(readFileSync(copy, 'utf8'), readFileSync(join(dir, 'brand/favicon.svg'), 'utf8'))
})

test('render staleness follows content, not mtimes', { skip: spawnSync('rsvg-convert', ['--version']).error }, () => {
	const dir = repo()
	run(dir, '--tagline', 'Short tagline')
	run(dir, 'render')
	assert.ok(existsSync(join(dir, 'brand/.render.json')))
	// A fresh clone can leave PNGs older than their SVGs; nothing should re-render.
	const old = new Date(Date.now() - 86_400_000)
	utimesSync(join(dir, 'brand/banner.png'), old, old)
	assert.deepEqual(JSON.parse(run(dir, 'render', '--json').stdout).rendered ?? [], [])
	writeFileSync(join(dir, 'brand/banner.svg'), `${readFileSync(join(dir, 'brand/banner.svg'), 'utf8')}\n<!-- edit -->`)
	assert.match(run(dir, 'doctor').stdout, /banner\.png/)
	assert.ok(run(dir, 'render').stdout.includes('brand/banner.png'))
})

test('--light writes light banners and render.sh lists them; plain init does not', () => {
	assert.ok(!existsSync(join(repo(), 'brand/banner-light.svg')))
	const dir = repo()
	run(dir, '--light')
	for (const f of ['banner-light', 'banner-mobile-light']) {
		assert.match(readFileSync(join(dir, `brand/${f}.svg`), 'utf8'), /#ffffff/)
	}
	assert.match(
		readFileSync(join(dir, 'brand/render.sh'), 'utf8'),
		/^social banner-light 1280 320$/m
	)
})
