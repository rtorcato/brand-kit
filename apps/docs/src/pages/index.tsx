import Link from '@docusaurus/Link'
import Siblings from '@rtorcato/shared-docs/components/Siblings'
import Layout from '@theme/Layout'
import styles from './index.module.css'

// Placeholder pillars — replace with what the project is actually about.
const PILLARS = [
	{ title: 'Pillar one', body: 'One sentence on the first thing that sets this project apart.' },
	{ title: 'Pillar two', body: 'One sentence on the second thing.' },
	{ title: 'Pillar three', body: 'One sentence on the third thing.' },
]

export default function Home() {
	return (
		<Layout title={'brand-kit'} description={'Banner, social card and favicon for a repo — SVG sources you can regenerate, rendered to PNG.'}>
			<header className={styles.hero}>
				<h1 className={styles.title}>{'brand-kit'}</h1>
				<p className={styles.tagline}>{'Banner, social card and favicon for a repo — SVG sources you can regenerate, rendered to PNG.'}</p>
				<pre className={styles.install}>
					<code>{'npm i @rtorcato/brand-kit'}</code>
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
