import Link from '@docusaurus/Link'
import Siblings from '@rtorcato/shared-docs/components/Siblings'
import Layout from '@theme/Layout'
import styles from './index.module.css'

const PILLARS = [
	{
		title: 'Sources, not binaries',
		body: 'SVG sources under brand/, so a banner is recoloured or retitled with one flag instead of redrawn.',
	},
	{
		title: 'Every size a repo needs',
		body: 'README banner, mobile banner, social card and favicon, plus Instagram, X, LinkedIn, YouTube and Facebook with --social.',
	},
	{
		title: 'Keeps itself honest',
		body: 'doctor reports missing sources and stale renders, and --strict makes it a CI check.',
	},
]

export default function Home() {
	return (
		<Layout
			title={'brand-kit'}
			description={
				'Banner, social card and favicon for a repo — SVG sources you can regenerate, rendered to PNG.'
			}
		>
			<header className={styles.hero}>
				<h1 className={styles.title}>{'brand-kit'}</h1>
				<p className={styles.tagline}>
					{
						'Banner, social card and favicon for a repo — SVG sources you can regenerate, rendered to PNG.'
					}
				</p>
				<pre className={styles.install}>
					<code>{'npx @rtorcato/brand-kit'}</code>
				</pre>
				<Link className="button button--primary button--lg" to="/docs">
					Get started
				</Link>
			</header>
			<main className={styles.pillars}>
				{PILLARS.map((p) => (
					<section key={p.title} className={styles.pillar}>
						<h2>{p.title}</h2>
						<p>{p.body}</p>
					</section>
				))}
			</main>
			<Siblings self="@rtorcato/brand-kit" />
		</Layout>
	)
}
