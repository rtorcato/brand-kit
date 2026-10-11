// The landing page imports its images straight from brand/ (see src/pages/index.tsx).
declare module '*.png' {
	const src: string
	export default src
}
