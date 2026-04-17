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
		},
		{
			name: 'Space Chaos',
			description: 'Save the galaxy from pixelated madness! 👾',
			href: '/space-invaders',
			emoji: '🛸',
			color: 'bg-purple-600'
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
		<p class="text-xl font-bold text-black italic">INSERT COIN TO PLAY</p>
	</div>

	<div class="grid w-full max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
		{#each games as game}
			<a href={game.href} class="group">
				<!-- Arcade cabinet shell -->
				<div class="relative">
					<!-- Marquee header -->
					<div
						class="flex items-center justify-center rounded-t-none border-4 border-black bg-black p-3"
					>
						<h2 class="text-center text-2xl font-black tracking-tighter text-white uppercase">
							{game.name}
						</h2>
					</div>

					<!-- Cabinet body -->
					<div
						class="{game.color} border-4 border-t-0 border-black p-6 shadow-[8px_8px_0_rgba(0,0,0,1)] transition-all"
					>
						<!-- Screen bezel -->
						<div class="mb-6 rounded-none border-4 border-black bg-black p-4">
							<div class="flex flex-col items-center justify-center rounded-sm bg-black py-10">
								<span class="mb-3 text-6xl transition-transform group-hover:scale-110">
									{game.emoji}
								</span>
								<div class="h-1 w-16 animate-pulse bg-green-400 opacity-75"></div>
							</div>
						</div>

						<!-- Coin slot & description -->
						<div class="mb-2 flex items-center gap-2">
							<div class="h-3 w-6 rounded-none border-2 border-black bg-black"></div>
							<p class="text-sm leading-tight font-bold text-black uppercase">
								{game.description}
							</p>
						</div>

						<!-- Start button -->
						<div class="flex justify-center">
							<span
								class="inline-block rounded-full border-4 border-black bg-white px-6 py-2 text-lg font-black text-black shadow-[4px_4px_0_rgba(0,0,0,1)] transition-all group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-none"
							>
								▶ INSERT COIN
							</span>
						</div>
					</div>

					<!-- Cabinet bottom trim -->
					<div class="h-4 border-4 border-t-0 border-black bg-black"></div>
				</div>
			</a>
		{/each}

		<!-- Placeholder for future games -->
		<div class="group">
			<div class="relative">
				<div
					class="flex items-center justify-center rounded-t-none border-4 border-dashed border-black bg-gray-200 p-3 opacity-50"
				>
					<h2 class="text-center text-2xl font-black tracking-tighter text-black uppercase">
						Coming Soon
					</h2>
				</div>

				<div
					class="border-4 border-t-0 border-dashed border-black bg-gray-200 p-6 opacity-50 shadow-[8px_8px_0_rgba(0,0,0,1)]"
				>
					<div class="mb-6 rounded-none border-4 border-dashed border-black bg-gray-300 p-4">
						<div class="flex flex-col items-center justify-center rounded-sm bg-gray-400 py-10">
							<span class="mb-3 text-6xl">❓</span>
							<div class="h-1 w-16 bg-gray-500"></div>
						</div>
					</div>

					<div class="flex justify-center">
						<span
							class="inline-block rounded-full border-4 border-dashed border-black bg-gray-300 px-6 py-2 text-lg font-black text-black"
						>
							🔒 LOCKED
						</span>
					</div>
				</div>

				<div class="h-4 border-4 border-t-0 border-dashed border-black bg-gray-300"></div>
			</div>
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
