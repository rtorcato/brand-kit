// --ai with fetch mocked: no network, no keys spent.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { generateAiArt, pickProvider } from '../dist/ai.js'
import { generateBrand, renderBrand, resolveBrandMeta } from '../dist/brand.js'

const cli = new URL('../dist/cli.js', import.meta.url).pathname
// 1×1 opaque PNG.
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
)
const b64 = PNG.toString('base64')

/** Replace fetch with `handler(url, init)` → JSON body, recording each call. */
function mockFetch(handler) {
	const calls = []
	globalThis.fetch = async (url, init = {}) => {
		calls.push({ url: String(url), init })
		const body = handler(String(url), init)
		return Buffer.isBuffer(body) ? new Response(body) : Response.json(body)
	}
	return calls
}

test('the first provider with a key is picked; a named one without its key fails', () => {
	assert.throws(() => pickProvider(undefined, undefined, {}), /OPENAI_API_KEY/)
	assert.throws(() => pickProvider('gemini', undefined, { OPENAI_API_KEY: 'k' }), /GEMINI_API_KEY/)
	assert.throws(() => pickProvider('dalle', undefined, {}), /one of/)
	assert.equal(typeof pickProvider(undefined, undefined, { GEMINI_API_KEY: 'k' }), 'function')
})

test('openai and gemini decode the base64 image', async () => {
	mockFetch(() => ({ data: [{ b64_json: b64 }] }))
	assert.deepEqual(
		await pickProvider('openai', undefined, { OPENAI_API_KEY: 'k' })('p', '1:1'),
		PNG
	)
	const calls = mockFetch(() => ({
		candidates: [{ content: { parts: [{ text: 'hi' }, { inlineData: { data: b64 } }] } }],
	}))
	assert.deepEqual(
		await pickProvider('gemini', undefined, { GEMINI_API_KEY: 'k' })('p', '16:9'),
		PNG
	)
	assert.equal(calls[0].init.headers['x-goog-api-key'], 'k')
	assert.match(calls[0].init.body, /"aspectRatio":"16:9"/)
})

test('higgsfield polls status_url until completed, then downloads the image', async () => {
	let polls = 0
	const calls = mockFetch((url) => {
		if (url.endsWith('/status'))
			return ++polls < 2
				? { status: 'in_progress', status_url: url }
				: { status: 'completed', images: [{ url: 'https://cdn.test/a.png' }] }
		if (url === 'https://cdn.test/a.png') return PNG
		return { status: 'queued', status_url: 'https://api.higgsfield.ai/requests/1/status' }
	})
	const t = globalThis.setTimeout
	globalThis.setTimeout = (fn) => t(fn, 0)
	try {
		const img = await pickProvider('higgsfield', undefined, {
			HF_API_KEY_ID: 'id',
			HF_API_KEY_SECRET: 's',
		})('p', '1:1')
		assert.deepEqual(img, PNG)
	} finally {
		globalThis.setTimeout = t
	}
	assert.equal(calls[0].init.headers.Authorization, 'Key id:s')
	assert.equal(polls, 2)
})

test('a failed request reports the status, not the key', async () => {
	mockFetch(() => ({ status: 'nsfw', status_url: 'x' }))
	await assert.rejects(
		pickProvider('higgsfield', undefined, { HF_KEY: 'secret-key' })('p', '1:1'),
		(e) => /nsfw/.test(e.message) && !/secret-key/.test(e.message)
	)
})

/** Run `fn` with setTimeout firing immediately, so poll loops don't wait. */
async function fastTimers(fn) {
	const t = globalThis.setTimeout
	globalThis.setTimeout = (cb) => t(cb, 0)
	try {
		return await fn()
	} finally {
		globalThis.setTimeout = t
	}
}

test('leonardo is picked by LEONARDO_API_KEY and polls v1 until COMPLETE', async () => {
	assert.throws(() => pickProvider(undefined, undefined, {}), /LEONARDO_API_KEY/)
	let polls = 0
	const calls = mockFetch((url) => {
		if (url.endsWith('/v1/generations/g1'))
			return ++polls < 2
				? { generations_by_pk: { status: 'PENDING' } }
				: {
						generations_by_pk: {
							status: 'COMPLETE',
							generated_images: [{ url: 'https://cdn.test/l.png' }],
						},
					}
		if (url === 'https://cdn.test/l.png') return PNG
		return { sdGenerationJob: { generationId: 'g1' } }
	})
	const gen = pickProvider(undefined, undefined, { LEONARDO_API_KEY: 'lk' })
	assert.deepEqual(await fastTimers(() => gen('p', '16:9')), PNG)
	assert.equal(calls[0].url, 'https://cloud.leonardo.ai/api/rest/v1/generations')
	assert.equal(calls[0].init.headers.Authorization, 'Bearer lk')
	assert.match(calls[0].init.body, /"width":1536,"height":864/)
	assert.equal(polls, 2)
})

test('leonardo sends a named model to v2 and reports a failed generation', async () => {
	const calls = mockFetch((url) =>
		url.includes('/v1/generations/')
			? { generations_by_pk: { status: 'FAILED' } }
			: { generate: { generationId: 'g2' } }
	)
	const gen = pickProvider('leonardo', 'gpt-image-1.5', { LEONARDO_API_KEY: 'secret-key' })
	await assert.rejects(
		fastTimers(() => gen('p', '1:1')),
		(e) => /FAILED/.test(e.message) && !/secret-key/.test(e.message)
	)
	assert.equal(calls[0].url, 'https://cloud.leonardo.ai/api/rest/v2/generations')
	assert.match(calls[0].init.body, /"model":"gpt-image-1.5"/)
	assert.equal(calls[1].url, 'https://cloud.leonardo.ai/api/rest/v1/generations/g2')
})

test('generated art becomes the favicon and every canvas background, and renders', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'brand-kit-ai-'))
	const pkg = { name: 'ai-lib', description: 'x' }
	const written = await generateAiArt(dir, await resolveBrandMeta(pkg, dir), async () => PNG)
	assert.deepEqual(written, ['brand/logo.png', 'brand/background.png', 'brand/favicon.svg'])
	assert.match(
		readFileSync(join(dir, 'brand/favicon.svg'), 'utf8'),
		/href="data:image\/png;base64,/
	)
	await generateBrand(pkg, dir, { update: true })
	assert.match(readFileSync(join(dir, 'brand/banner.svg'), 'utf8'), /href="background.png"/)
	if (!spawnSync('rsvg-convert', ['--version']).error) {
		assert.ok((await renderBrand(dir)).includes('brand/banner.png'))
	}
})

test('--ai without any key exits 1 and names the env vars', () => {
	const dir = mkdtempSync(join(tmpdir(), 'brand-kit-ai-'))
	writeFileSync(join(dir, 'package.json'), '{"name":"x"}')
	const env = { PATH: process.env.PATH }
	const res = spawnSync('node', [cli, '--ai', '--dir', dir], { encoding: 'utf8', env })
	assert.equal(res.status, 1)
	assert.match(res.stderr, /HF_API_KEY_ID/)
})
