<script lang="ts">
	const games = [
		{
			name: 'Minesweeper',
			description: 'Avoid the boom! A classic test of nerves and math.',
			href: '/minesweeper',
			emoji: '💣',
			color: 'bg-red-500'
		}
	];
</script>

<div class="min-h-screen bg-yellow-300 flex flex-col items-center justify-center p-8 font-mono">
	<div class="text-center mb-12 animate-bounce">
		<h1 class="text-6xl font-black text-black mb-4 drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">
			🕹️ THE CHAOS ARCADE 🕹️
		</h1>
		<p class="text-xl text-black font-bold">Where code goes to play (and sometimes explode)</p>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl w-full">
		{#each games as game}
			<a
				href={game.href}
				class="{game.color} border-4 border-black p-6 rounded-none shadow-[8px_8px_0_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all group"
			>
				<div class="text-5xl mb-4 group-hover:scale-125 transition-transform inline-block">
					{game.emoji}
				</div>
				<h2 class="text-3xl font-black text-white mb-2 uppercase tracking-tighter">
					{game.name}
				</h2>
				<p class="text-white font-bold leading-tight">
					{game.description}
				</p>
			</a>
		{/each}

		<!-- Placeholder for future games -->
		<div class="border-4 border-dashed border-black p-6 rounded-none flex flex-col items-center justify-center text-center opacity-50">
			<div class="text-4xl mb-2">❓</div>
			<p class="font-bold text-black uppercase">Coming Soon...</p>
			<p class="text-xs text-black font-bold mt-2">(Or whenever I feel like it)</p>
		</div>
	</div>

	<footer class="mt-20 text-black font-bold text-sm">
		Built with ⚡ SvelteKit & pure chaos
	</footer>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}
</style>
