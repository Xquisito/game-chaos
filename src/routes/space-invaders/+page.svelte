<script lang="ts">
	import { onMount } from 'svelte';

	// Game Constants
	const GAME_WIDTH = 800;
	const GAME_HEIGHT = 600;
	const PLAYER_WIDTH = 50;
	const PLAYER_HEIGHT = 20;
	const ALIEN_ROWS = 5;
	const ALIEN_COLS = 10;
	const ALIEN_WIDTH = 40;
	const ALIEN_HEIGHT = 30;

	// State
	let score = $state(0);
	let gameOver = $state(false);
	let gameWon = $state(false);
	let playerX = $state(GAME_WIDTH / 2 - PLAYER_WIDTH / 2);
	let bullets = $state<{ x: number; y: number; type: 'player' | 'alien'; id: number }[]>([]);
	let nextBulletId = 0;
	let aliens = $state<{ x: number; y: number; alive: boolean; id: number }[]>([]);
	let alienDirection = $state(1); // 1 for right, -1 for left
	let alienStep = $state(0);
	let alienSpeed = $state(1);
	let lastTime = 0;
	let showChaosModal = $state(false);
	let chaosMode = $state(false);

	function initGame() {
		score = 0;
		gameOver = false;
		gameWon = false;
		playerX = GAME_WIDTH / 2 - PLAYER_WIDTH / 2;
		bullets = [];
		aliens = [];
		alienDirection = 1;
		alienStep = 0;
		alienSpeed = 1;
		chaosMode = false;

		for (let r = 0; r < ALIEN_ROWS; r++) {
			for (let c = 0; c < ALIEN_COLS; c++) {
				aliens.push({
					x: c * (ALIEN_WIDTH + 10) + 50,
					y: r * (ALIEN_HEIGHT + 10) + 50,
					alive: true,
					id: r * ALIEN_COLS + c
				});
			}
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (gameOver || gameWon) return;

		if (e.key === 'ArrowLeft') {
			playerX = Math.max(0, playerX - 20);
		} else if (e.key === 'ArrowRight') {
			playerX = Math.min(GAME_WIDTH - PLAYER_WIDTH, playerX + 20);
		} else if (e.key === ' ' || e.key === 'ArrowUp') {
			shoot();
		}
	}

	function shoot() {
		if (bullets.filter((b) => b.type === 'player').length < 3 || chaosMode) {
			bullets.push({
				x: playerX + PLAYER_WIDTH / 2 - 2,
				y: GAME_HEIGHT - PLAYER_HEIGHT - 10,
				type: 'player',
				id: nextBulletId++
			});
		}
	}

	function update(time: number) {
		if (gameOver || gameWon) return;

		const dt = time - lastTime;
		lastTime = time;

		// Update Bullets
		bullets = bullets
			.map((b) => ({ ...b, y: b.y + (b.type === 'player' ? -5 : 3) * (chaosMode ? 2 : 1) }))
			.filter((b) => b.y > 0 && b.y < GAME_HEIGHT);

		// Alien Movement
		alienStep += dt * 0.001 * alienSpeed * (chaosMode ? 3 : 1);
		if (alienStep > 0.5) {
			alienStep = 0;
			let hitEdge = false;
			aliens.forEach((a) => {
				if (a.alive) {
					a.x += 10 * alienDirection;
					if (a.x > GAME_WIDTH - ALIEN_WIDTH || a.x < 0) hitEdge = true;
				}
			});

			if (hitEdge) {
				alienDirection *= -1;
				aliens.forEach((a) => {
					if (a.alive) {
						a.y += 20;
						if (a.y + ALIEN_HEIGHT > GAME_HEIGHT - PLAYER_HEIGHT - 20) {
							gameOver = true;
						}
					}
				});
				alienSpeed += 0.1;
			}

			// Random Alien Shoot
			if (Math.random() < 0.1 * alienSpeed) {
				const aliveAliens = aliens.filter((a) => a.alive);
				if (aliveAliens.length > 0) {
					const shooter = aliveAliens[Math.floor(Math.random() * aliveAliens.length)];
					bullets.push({
						x: shooter.x + ALIEN_WIDTH / 2,
						y: shooter.y + ALIEN_HEIGHT,
						type: 'alien',
						id: nextBulletId++
					});
				}
			}
		}

		// Collision Detection
		bullets.forEach((b, bi) => {
			if (b.type === 'player') {
				aliens.forEach((a) => {
					if (
						a.alive &&
						b.x > a.x &&
						b.x < a.x + ALIEN_WIDTH &&
						b.y > a.y &&
						b.y < a.y + ALIEN_HEIGHT
					) {
						a.alive = false;
						bullets.splice(bi, 1);
						score += 100;
					}
				});
			} else {
				if (
					b.x > playerX &&
					b.x < playerX + PLAYER_WIDTH &&
					b.y > GAME_HEIGHT - PLAYER_HEIGHT - 20 &&
					b.y < GAME_HEIGHT - 20
				) {
					gameOver = true;
				}
			}
		});

		if (aliens.every((a) => !a.alive)) {
			gameWon = true;
		}

		requestAnimationFrame(update);
	}

	function triggerChaos() {
		showChaosModal = true;
		chaosMode = true;
		alienSpeed *= 2;
	}

	onMount(() => {
		initGame();
		window.addEventListener('keydown', handleKeydown);
		requestAnimationFrame(update);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<div
	class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-purple-900 p-8 font-mono text-white"
>
	<div class="mb-8 text-center">
		<h1
			class="animate-pulse text-6xl font-black tracking-tighter text-green-400 uppercase drop-shadow-[4px_4px_0_rgba(0,0,0,1)]"
		>
			SPACE CHAOS
		</h1>
		<p class="text-xl font-bold text-pink-400 italic">Pew pew or die!</p>
	</div>

	<div
		class="relative border-8 border-black bg-black shadow-[20px_20px_0_rgba(0,0,0,1)]"
		style:width="{GAME_WIDTH}px"
		style:height="{GAME_HEIGHT}px"
	>
		<!-- Score & Stats -->
		<div class="absolute top-4 left-4 z-20 flex gap-4 text-2xl font-black">
			<span class="bg-green-400 px-2 text-black">SCORE: {score}</span>
			{#if chaosMode}
				<span class="animate-bounce bg-red-600 px-2 text-white">CHAOS ACTIVE! 🔥</span>
			{/if}
		</div>

		<!-- Player -->
		<div
			class="absolute bg-green-400 transition-all duration-75"
			style:left="{playerX}px"
			style:bottom="20px"
			style:width="{PLAYER_WIDTH}px"
			style:height="{PLAYER_HEIGHT}px"
			style:box-shadow="0 0 20px #4ade80"
		>
			<div class="absolute -top-4 left-1/2 h-4 w-4 -translate-x-1/2 bg-green-400"></div>
		</div>

		<!-- Aliens -->
		{#each aliens as alien (alien.id)}
			{#if alien.alive}
				<div
					class="absolute flex items-center justify-center bg-white text-2xl"
					style:left="{alien.x}px"
					style:top="{alien.y}px"
					style:width="{ALIEN_WIDTH}px"
					style:height="{ALIEN_HEIGHT}px"
					class:animate-bounce={chaosMode}
				>
					👾
				</div>
			{/if}
		{/each}

		<!-- Bullets -->
		{#each bullets as bullet (bullet.id)}
			<div
				class="absolute w-1"
				style:left="{bullet.x}px"
				style:top="{bullet.y}px"
				style:height="15px"
				class:bg-yellow-300={bullet.type === 'player'}
				class:bg-red-500={bullet.type === 'alien'}
				class:w-4={chaosMode && bullet.type === 'player'}
			></div>
		{/each}

		<!-- Game Over Overlays -->
		{#if gameOver}
			<div
				class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-900/80 backdrop-blur-md"
			>
				<h2 class="mb-8 text-8xl font-black text-white uppercase shadow-black drop-shadow-2xl">
					WASTED 💀
				</h2>
				<button
					onclick={initGame}
					class="border-4 border-white bg-black px-10 py-5 text-4xl font-black text-white uppercase shadow-[8px_8px_0_white] hover:scale-110 active:translate-y-1"
				>
					Restart 🔄
				</button>
			</div>
		{/if}

		{#if gameWon}
			<div
				class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-green-900/80 backdrop-blur-md"
			>
				<h2 class="mb-8 text-8xl font-black text-white uppercase shadow-black drop-shadow-2xl">
					VICTORY 🏆
				</h2>
				<button
					onclick={initGame}
					class="border-4 border-white bg-black px-10 py-5 text-4xl font-black text-white uppercase shadow-[8px_8px_0_white] hover:scale-110 active:translate-y-1"
				>
					Play Again 🔄
				</button>
			</div>
		{/if}
	</div>

	<a
		href="/"
		class="mt-10 text-2xl font-black text-white underline decoration-8 transition-colors hover:text-green-400"
	>
		← ESCAPE TO REALITY
	</a>

	<!-- Chaos Button -->
	<button
		onclick={triggerChaos}
		class="absolute right-8 bottom-8 border-8 border-black bg-pink-500 p-8 text-xl font-black text-white uppercase shadow-[10px_10px_0_rgba(0,0,0,1)] transition-transform hover:scale-110 hover:rotate-12"
	>
		DO NOT PRESS 🚫
	</button>

	<!-- Chaos Modal -->
	{#if showChaosModal}
		<div
			class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl"
		>
			<div
				class="animate-in fade-in zoom-in w-full max-w-2xl border-[12px] border-black bg-white p-12 text-center shadow-[24px_24px_0_rgba(0,0,0,1)]"
			>
				<div class="mb-6 text-9xl">🤬</div>
				<h2 class="mb-6 text-5xl font-black tracking-tighter text-black uppercase">
					WHAT HAVE YOU DONE?!
				</h2>
				<p class="mb-12 text-3xl font-bold text-black italic">
					"THE ALIENS ARE NOW ON STEROIDS AND YOUR BULLETS ARE FAT. GOOD LUCK."
				</p>
				<button
					onclick={() => (showChaosModal = false)}
					class="w-full border-8 border-black bg-black px-10 py-6 text-4xl font-black text-white uppercase hover:bg-pink-500"
				>
					I REGRET EVERYTHING 😭
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background: #2d1b4e;
	}
</style>
