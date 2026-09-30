import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import { GITHUB_PROFILE, copyright, projectFamilyItems } from '@rtorcato/shared-docs'
import { themes as prismThemes } from 'prism-react-renderer'

const config: Config = {
	title: 'brand-kit',
	tagline: 'Banner, social card and favicon for a repo — SVG sources you can regenerate, rendered to PNG.',
	favicon: 'img/favicon.ico',

	url: 'https://docs.torcato.dev',
	baseUrl: '/brand-kit/',

	organizationName: 'rtorcato',
	projectName: 'brand-kit',

	onBrokenLinks: 'warn',

	markdown: {
		format: 'detect',
		hooks: {
			onBrokenMarkdownLinks: 'warn',
		},
	},

	i18n: {
		defaultLocale: 'en',
		locales: ['en'],
	},

	presets: [
		[
			'classic',
			{
				docs: {
					sidebarPath: './sidebars.ts',
					routeBasePath: '/docs',
					editUrl: 'https://github.com/rtorcato/brand-kit/edit/main/apps/docs/',
				},
				blog: false,
				theme: {
					customCss: './src/css/custom.css',
				},
			} satisfies Preset.Options,
		],
	],

	plugins: [
		[
			'@easyops-cn/docusaurus-search-local',
			{
				hashed: true,
				indexDocs: true,
				indexBlog: false,
				docsRouteBasePath: '/docs',
				highlightSearchTermsOnTargetPage: true,
				searchBarShortcutHint: false,
			},
		],
	],

	themeConfig: {
		image: 'img/social-card.png',
		colorMode: {
			defaultMode: 'dark',
			respectPrefersColorScheme: true,
		},
		navbar: {
			title: 'brand-kit',

			items: [
				{ to: '/docs', position: 'left', label: 'Docs' },
				{
					type: 'dropdown',
					label: 'Projects',
					position: 'left',
					items: [...projectFamilyItems(), { label: 'All on GitHub →', href: GITHUB_PROFILE }],
				},
				{ href: 'https://github.com/rtorcato/brand-kit', label: 'GitHub', position: 'right' },
			],
		},
		footer: {
			style: 'dark',
			links: [
				{ title: 'Docs', items: [{ label: 'Getting Started', to: '/docs' }] },
				{
					title: 'More',
					items: [
						{ label: 'GitHub', href: 'https://github.com/rtorcato/brand-kit' },
						{ label: 'Issues', href: 'https://github.com/rtorcato/brand-kit/issues' },
					],
				},
				{ title: 'Projects', items: projectFamilyItems() },
			],
			copyright: copyright(),
		},
		// `theme` is the LIGHT-mode Prism theme and `darkTheme` the dark one; the
		// shared stylesheet assumes this pairing.
		prism: {
			theme: prismThemes.vsLight,
			darkTheme: prismThemes.vsDark,
			additionalLanguages: ['bash', 'json', 'typescript'],
		},
	} satisfies Preset.ThemeConfig,
}

export default config
