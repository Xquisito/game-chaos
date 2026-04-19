<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	// Structured Data for Google (JSON-LD)
	const structuredData = {
		'@context': 'https://schema.org',
		'@type': 'GameServer',
		name: 'The Chaos Arcade',
		description: 'Uma coleção de jogos vintages e caóticos feitos com SvelteKit.',
		url: 'https://chaos-arcade.pages.dev/',
		genre: ['Arcade', 'Retro', 'Strategy'],
		gameItem: [
			{ '@type': 'VideoGame', name: 'Minesweeper Chaos' },
			{ '@type': 'VideoGame', name: 'Checkers Chaos' },
			{ '@type': 'VideoGame', name: 'Enduro 3D Chaos' }
		]
	};
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<script type="application/ld+json">
		{@html JSON.stringify(structuredData)}
	</script>
</svelte:head>

{@render children()}
