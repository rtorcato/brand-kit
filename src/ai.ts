/**
 * Optional AI artwork: a logo mark and a canvas background from an image API,
 * saved under `brand/` as sources like any other. Generated once, on `--ai`;
 * every render after that is deterministic. Plain `fetch`, no SDKs.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { BrandMeta } from './brand.js'

export type Aspect = '1:1' | '16:9'
type Env = Record<string, string | undefined>
/** `accent` is a hint for providers that take colours as input (Recraft). */
export type Generate = (prompt: string, aspect: Aspect, accent?: string) => Promise<Buffer>

/** Throws with the response body, never the request (it carries the key). */
async function json(res: Response, provider: string): Promise<Record<string, any>> {
	if (!res.ok)
		throw new Error(`${provider}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`)
	return (await res.json()) as Record<string, any>
}

/** Fetches the finished image; an error page must not be saved as art. */
async function download(url: string, provider: string): Promise<Buffer> {
	const res = await fetch(url)
	if (!res.ok) throw new Error(`${provider}: image download HTTP ${res.status}`)
	return Buffer.from(await res.arrayBuffer())
}

const higgsfieldKey = (env: Env): string | undefined =>
	env.HF_KEY ??
	(env.HF_API_KEY_ID && env.HF_API_KEY_SECRET
		? `${env.HF_API_KEY_ID}:${env.HF_API_KEY_SECRET}`
		: undefined)

interface Provider {
	/** Env vars that enable it, for the error message. */
	keys: string
	key: (env: Env) => string | undefined
	make: (key: string, model: string | undefined) => Generate
}

export const PROVIDERS: Record<string, Provider> = {
	// Async: submit, then poll status_url. https://docs.higgsfield.ai/docs/concepts/requests
	higgsfield: {
		keys: 'HF_API_KEY_ID + HF_API_KEY_SECRET (or HF_KEY)',
		key: higgsfieldKey,
		make:
			(key, model = 'higgsfield-ai/soul/v2/standard') =>
			async (prompt, aspect) => {
				const headers = { Authorization: `Key ${key}`, 'Content-Type': 'application/json' }
				let job = await json(
					await fetch(`https://api.higgsfield.ai/${model}`, {
						method: 'POST',
						headers: { ...headers, 'Idempotency-Key': randomUUID() },
						body: JSON.stringify({ prompt, aspect_ratio: aspect }),
					}),
					'higgsfield'
				)
				// ponytail: fixed 3s poll, 5 min cap; webhooks if this ever runs server-side.
				for (
					let i = 0;
					i < 100 && !['completed', 'failed', 'nsfw', 'canceled'].includes(job.status);
					i++
				) {
					await new Promise((r) => setTimeout(r, 3000))
					job = await json(await fetch(job.status_url, { headers }), 'higgsfield')
				}
				const url = job.images?.[0]?.url
				if (job.status !== 'completed' || !url) throw new Error(`higgsfield: request ${job.status}`)
				return download(url, 'higgsfield')
			},
	},
	openai: {
		keys: 'OPENAI_API_KEY',
		key: (env) => env.OPENAI_API_KEY,
		make:
			(key, model = 'gpt-image-1') =>
			async (prompt, aspect) => {
				const res = await json(
					await fetch('https://api.openai.com/v1/images/generations', {
						method: 'POST',
						headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
						body: JSON.stringify({
							model,
							prompt,
							n: 1,
							size: aspect === '1:1' ? '1024x1024' : '1536x1024',
						}),
					}),
					'openai'
				)
				return Buffer.from(res.data[0].b64_json, 'base64')
			},
	},
	// "Nano Banana". https://ai.google.dev/gemini-api/docs/image-generation
	gemini: {
		keys: 'GEMINI_API_KEY',
		key: (env) => env.GEMINI_API_KEY,
		make:
			(key, model = 'gemini-2.5-flash-image') =>
			async (prompt, aspect) => {
				const res = await json(
					await fetch(
						`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
						{
							method: 'POST',
							headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
							body: JSON.stringify({
								contents: [{ parts: [{ text: prompt }] }],
								generationConfig: {
									responseModalities: ['IMAGE'],
									imageConfig: { aspectRatio: aspect },
								},
							}),
						}
					),
					'gemini'
				)
				const part = res.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)
				if (!part) throw new Error('gemini: no image in the response')
				return Buffer.from(part.inlineData.data, 'base64')
			},
	},
	// Async like Higgsfield: submit, then poll the generation. A UUID model is a
	// v1 modelId (Phoenix 1.0 by default); a name like "gpt-image-1.5" goes to v2.
	// https://docs.leonardo.ai/reference/creategeneration
	leonardo: {
		keys: 'LEONARDO_API_KEY',
		key: (env) => env.LEONARDO_API_KEY,
		make:
			(key, model = 'de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3') =>
			async (prompt, aspect) => {
				const api = 'https://cloud.leonardo.ai/api/rest'
				const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
				const [width, height] = aspect === '1:1' ? [1024, 1024] : [1536, 864]
				const v1 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(model)
				const body = v1
					? { modelId: model, prompt, width, height, num_images: 1 }
					: { model, public: false, parameters: { prompt, width, height, quantity: 1 } }
				const res = await json(
					await fetch(`${api}/${v1 ? 'v1' : 'v2'}/generations`, {
						method: 'POST',
						headers,
						body: JSON.stringify(body),
					}),
					'leonardo'
				)
				const id = (res.sdGenerationJob ?? res.generate)?.generationId
				if (!id) throw new Error('leonardo: no generation id in the response')
				let gen: Record<string, any> = { status: 'PENDING' }
				// ponytail: same fixed 3s poll, 5 min cap as higgsfield.
				for (let i = 0; i < 100 && !['COMPLETE', 'FAILED'].includes(gen.status); i++) {
					await new Promise((r) => setTimeout(r, 3000))
					gen = (await json(await fetch(`${api}/v1/generations/${id}`, { headers }), 'leonardo'))
						.generations_by_pk ?? { status: 'PENDING' }
				}
				const url = gen.generated_images?.[0]?.url
				if (gen.status !== 'COMPLETE' || !url) throw new Error(`leonardo: generation ${gen.status}`)
				return download(url, 'leonardo')
			},
	},
	// Vector style returns real SVG for the logo; the background stays raster.
	// https://www.recraft.ai/docs/api-reference/endpoints
	recraft: {
		keys: 'RECRAFT_API_TOKEN',
		key: (env) => env.RECRAFT_API_TOKEN,
		make:
			(key, model = 'recraftv3') =>
			async (prompt, aspect, accent) => {
				const rgb = accent?.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
				const res = await json(
					await fetch('https://external.api.recraft.ai/v1/images/generations', {
						method: 'POST',
						headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
						body: JSON.stringify({
							prompt,
							model,
							style: aspect === '1:1' ? 'vector_illustration' : 'digital_illustration',
							size: aspect === '1:1' ? '1024x1024' : '1820x1024',
							n: 1,
							...(rgb && {
								controls: { colors: [{ rgb: rgb.slice(1).map((h) => Number.parseInt(h, 16)) }] },
							}),
						}),
					}),
					'recraft'
				)
				const url = res.data?.[0]?.url
				if (!url) throw new Error('recraft: no image in the response')
				return download(url, 'recraft')
			},
	},
}

/** The named provider, else the first whose key is set. */
export function pickProvider(
	name: string | undefined,
	model: string | undefined,
	env: Env = process.env
): Generate {
	if (name && !PROVIDERS[name]) {
		throw new Error(`--ai-provider must be one of: ${Object.keys(PROVIDERS).join(', ')}`)
	}
	for (const [id, p] of Object.entries(PROVIDERS)) {
		if (name && id !== name) continue
		const key = p.key(env)
		if (key) return p.make(key, model)
		if (name) throw new Error(`${id} needs ${p.keys}`)
	}
	const all = Object.entries(PROVIDERS).map(([id, p]) => `${id}: ${p.keys}`)
	throw new Error(`--ai needs an API key in the environment:\n  ${all.join('\n  ')}`)
}

export function prompts(meta: BrandMeta, style?: string): { logo: string; background: string } {
	const extra = style ? ` Style: ${style}.` : ''
	return {
		logo: `App icon for a software project called "${meta.name}": ${meta.tagline}. One bold, simple, geometric symbol, centred, filling most of a square with a solid near-black #0d1117 background, in accent colour ${meta.accent}. Flat vector look, high contrast, still readable at 16px. No text, no letters, no border, no mockup, no shadow around the square.${extra}`,
		background: `Abstract wide background for a software project banner. Near-black #0d1117 with subtle ${meta.accent} light, soft gradients and fine texture, mostly empty dark negative space. No text, no letters, no logos, no people, no objects.${extra}`,
	}
}

/**
 * The logo as brand/favicon.svg: a self-contained SVG (data URI, rounded like
 * the generated tile) so it works as a site favicon too. An SVG logo is
 * embedded as an <image>, never inlined: SVG loaded as an image runs no script,
 * so a hostile API response can't reach the docs origin. A PNG is shrunk to
 * 256px when rsvg-convert is around, since the raw render is a 1-2 MB PNG.
 */
function logoFavicon(meta: BrandMeta, logo: Buffer): string {
	const mime = isSvg(logo) ? 'image/svg+xml' : 'image/png'
	const svg = (
		b64: string
	): string => `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
	<title>${meta.name.replace(/[<&"]/g, '')}</title>
	<clipPath id="tile"><rect width="32" height="32" rx="8"/></clipPath>
	<image href="data:${mime};base64,${b64}" width="32" height="32" clip-path="url(#tile)" preserveAspectRatio="xMidYMid slice"/>
</svg>
`
	const full = svg(logo.toString('base64'))
	if (mime !== 'image/png' || spawnSync('rsvg-convert', ['--version']).error) return full
	const small = execFileSync('rsvg-convert', ['-w', '256', '-h', '256'], { input: full })
	return svg(small.toString('base64'))
}

const isSvg = (b: Buffer): boolean =>
	/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(b.subarray(0, 1024).toString('utf8'))

/**
 * Write brand/background.png and brand/favicon.svg, which embeds the logo. A
 * raster logo is also saved as brand/logo.png; a vector one (Recraft) is not.
 */
export async function generateAiArt(
	targetDir: string,
	meta: BrandMeta,
	generate: Generate,
	style?: string
): Promise<string[]> {
	const p = prompts(meta, style)
	const [logo, background] = await Promise.all([
		generate(p.logo, '1:1', meta.accent),
		generate(p.background, '16:9', meta.accent),
	])
	const brand = path.join(targetDir, 'brand')
	await mkdir(brand, { recursive: true })
	await writeFile(path.join(brand, 'background.png'), background)
	await writeFile(path.join(brand, 'favicon.svg'), logoFavicon(meta, logo))
	if (isSvg(logo)) return ['brand/background.png', 'brand/favicon.svg']
	await writeFile(path.join(brand, 'logo.png'), logo)
	return ['brand/logo.png', 'brand/background.png', 'brand/favicon.svg']
}
