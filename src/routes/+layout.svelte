<script lang="ts">
	import './layout.css';
	import { arcadeStructuredData } from '$lib/cabinets';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	const structuredDataJson = JSON.stringify(arcadeStructuredData).replace(/</g, '\\u003c');
	const structuredDataScript = [
		'<script type="application/ld+json">',
		structuredDataJson,
		'</' + 'script>'
	].join('');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />

	<!-- Canonical URL -->
	<link rel="canonical" href="https://chaos-arcade.pages.dev/" />

	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html structuredDataScript}
</svelte:head>

{@render children()}
