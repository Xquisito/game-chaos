<script lang="ts">
	const games = [
		{
			name: 'Minesweeper',
			description: 'Avoid the boom! A classic test of nerves and math.',
			href: '/minesweeper',
			emoji: '💣',
			color: 'bg-red-500'
		},
		{
			name: 'Checkers Chaos',
			description: 'A battle of strategy amidst the digital madness! 🏁',
			href: '/checkers',
			emoji: '🎲',
			color: 'bg-orange-400'
		},
		{
			name: 'Enduro Chaos',
			description: 'Pilot or die through blizzards and total darkness! 🏎️',
			href: '/enduro',
			emoji: '🏎️',
			color: 'bg-green-500'
		}
	];

	// @ts-ignore
	const appVersion = __APP_VERSION__;
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-yellow-300 p-8 font-mono">
	<div class="mb-12 animate-bounce text-center">
		<h1 class="mb-4 text-6xl font-black text-black drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">
			🕹️ THE CHAOS ARCADE 🕹️
		</h1>
		<p class="text-xl font-bold text-black italic">Where code goes to play (and sometimes explode)</p>
	</div>

	<div class="grid w-full max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
		{#each games as game}
			<a
				href={game.href}
				class="{game.color} group rounded-none border-4 border-black p-6 shadow-[8px_8px_0_rgba(0,0,0,1)] transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
			>
				<div class="mb-4 inline-block text-5xl transition-transform group-hover:scale-125">
					{game.emoji}
				</div>
				<h2 class="mb-2 text-3xl font-black tracking-tighter text-white uppercase">
					{game.name}
				</h2>
				<p class="leading-tight font-bold text-white">
					{game.description}
				</p>
			</a>
		{/each}

		<!-- Placeholder for future games -->
		<div
			class="flex flex-col items-center justify-center rounded-none border-4 border-dashed border-black p-6 text-center opacity-50"
		>
			<div class="mb-2 text-4xl">❓</div>
			<p class="font-bold text-black uppercase">Coming Soon...</p>
			<p class="mt-2 text-xs font-bold text-black">(Or whenever I feel like it)</p>
		</div>
	</div>

	<footer class="mt-20 flex flex-col items-center gap-2 text-sm font-bold text-black">
		<div class="bg-black px-4 py-1 text-yellow-300 shadow-[4px_4px_0_rgba(0,0,0,1)]">
			v{appVersion}
		</div>
		<div>Built with ⚡ SvelteKit & pure chaos</div>
	</footer>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}
</style>
