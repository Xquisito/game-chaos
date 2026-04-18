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
	const SHIELD_COUNT = 4;
	const SHIELD_COLS = 8;
	const SHIELD_ROWS = 8;
	const SHIELD_CELL_WIDTH = 8;
	const SHIELD_CELL_HEIGHT = 6;
	const SHIELD_WIDTH = SHIELD_COLS * SHIELD_CELL_WIDTH;
	const SHIELD_HEIGHT = SHIELD_ROWS * SHIELD_CELL_HEIGHT;
	const SHIELD_PLAYER_GAP = 92;
	const ALIEN_DESCENT_SPEED_BOOST = 0.2;
	const ALIEN_ENDGAME_SPEED_BOOST = 1.25;
	const ALIEN_KILL_SPEED_BOOST = 0.035;
	const BASE_ALIEN_FIRE_CHANCE = 0.08;
	const ALIEN_FIRE_DESCENT_BONUS = 0.018;
	const ALIEN_FIRE_ENDGAME_BONUS = 0.16;
	const MAX_ALIEN_FIRE_CHANCE = 0.3;
	const BASE_ALIEN_BULLET_SPEED = 3;
	const ALIEN_BULLET_SPEED_DESCENT_BONUS = 0.12;
	const ALIEN_BULLET_SPEED_ENDGAME_BONUS = 1.1;
	const MAX_ALIEN_BULLET_SPEED = 5.4;
	const PLAYER_HIT_ANIMATION_MS = 350;

	// State
	let score = $state(0);
	let lives = $state(3);
	let gameOver = $state(false);
	let gameWon = $state(false);
	let playerX = $state(GAME_WIDTH / 2 - PLAYER_WIDTH / 2);
	let playerExplosion = $state<{ x: number; y: number; id: number; expiresAt: number } | null>(
		null
	);
	let bullets = $state<{ x: number; y: number; type: 'player' | 'alien'; id: number }[]>([]);
	let nextBulletId = 0;
	let nextExplosionId = 0;
	let aliens = $state<{ x: number; y: number; alive: boolean; id: number; legFrame: number }[]>([]);
	let alienDirection = $state(1); // 1 for right, -1 for left
	let alienStep = $state(0);
	let alienSpeed = $state(1);
	let alienDescents = $state(0);
	let lastTime = 0;
	let showChaosModal = $state(false);
	let chaosMode = $state(false);
	let globalTick = $state(0);
	let shields = $state<{ x: number; y: number; pixels: boolean[][] }[]>([]);

	// Shield pixel patterns (8x8 grid, true = pixel present)
	const SHIELD_PATTERN = [
		[0, 0, 1, 1, 1, 1, 1, 1],
		[0, 1, 1, 1, 1, 1, 1, 0],
		[1, 1, 1, 1, 1, 1, 1, 1],
		[1, 1, 1, 1, 1, 1, 1, 1],
		[1, 1, 1, 1, 1, 1, 1, 1],
		[1, 1, 0, 0, 0, 0, 1, 1],
		[1, 1, 0, 1, 1, 0, 1, 1],
		[1, 1, 0, 1, 1, 0, 1, 1]
	];

	function initGame() {
		score = 0;
		lives = 3;
		gameOver = false;
		gameWon = false;
		playerX = GAME_WIDTH / 2 - PLAYER_WIDTH / 2;
		playerExplosion = null;
		bullets = [];
		aliens = [];
		alienDirection = 1;
		alienStep = 0;
		alienSpeed = 1;
		alienDescents = 0;
		chaosMode = false;
		globalTick = 0;

		for (let r = 0; r < ALIEN_ROWS; r++) {
			for (let c = 0; c < ALIEN_COLS; c++) {
				aliens.push({
					x: c * (ALIEN_WIDTH + 10) + 50,
					y: r * (ALIEN_HEIGHT + 10) + 50,
					alive: true,
					id: r * ALIEN_COLS + c,
					legFrame: 0
				});
			}
		}

		// Create 4 shields
		const shieldY = GAME_HEIGHT - PLAYER_HEIGHT - SHIELD_PLAYER_GAP;
		const spacing = GAME_WIDTH / (SHIELD_COUNT + 1);
		shields = [];
		for (let i = 0; i < SHIELD_COUNT; i++) {
			const sx = (i + 1) * spacing - SHIELD_WIDTH / 2;
			const pixels = SHIELD_PATTERN.map((row) => row.map((val) => val === 1));
			shields.push({ x: sx, y: shieldY, pixels });
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
				y: GAME_HEIGHT - PLAYER_HEIGHT - 36,
				type: 'player',
				id: nextBulletId++
			});
		}
	}

	function damageShield(shield: { pixels: boolean[][] }, px: number, py: number) {
		if (px < 0 || px >= SHIELD_COLS || py < 0 || py >= SHIELD_ROWS || !shield.pixels[py][px]) {
			return false;
		}

		shield.pixels[py][px] = false;
		const dirs = [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1],
			[-1, -1],
			[1, -1],
			[-1, 1],
			[1, 1]
		];

		dirs.forEach(([dx, dy]) => {
			const nx = px + dx;
			const ny = py + dy;
			if (nx >= 0 && nx < SHIELD_COLS && ny >= 0 && ny < SHIELD_ROWS && shield.pixels[ny][nx]) {
				shield.pixels[ny][nx] = false;
			}
		});

		return true;
	}

	function hitShield(bullet: { x: number; y: number; type: 'player' | 'alien'; id: number }) {
		const bulletTop = bullet.y;
		const bulletBottom = bullet.y + 15;
		const collisionY = bullet.type === 'player' ? bulletTop : bulletBottom;

		for (const shield of shields) {
			if (
				bullet.x < shield.x ||
				bullet.x >= shield.x + SHIELD_WIDTH ||
				collisionY < shield.y ||
				collisionY >= shield.y + SHIELD_HEIGHT
			) {
				continue;
			}

			const px = Math.floor((bullet.x - shield.x) / SHIELD_CELL_WIDTH);
			const py = Math.floor((collisionY - shield.y) / SHIELD_CELL_HEIGHT);

			if (damageShield(shield, px, py)) {
				return true;
			}
		}

		return false;
	}

	function getAlienShooter(aliveAliens: typeof aliens) {
		const columnShooters = Array.from({ length: ALIEN_COLS }, (_, col) => {
			const columnAliens = aliveAliens.filter((alien) => alien.id % ALIEN_COLS === col);
			return columnAliens.reduce<(typeof aliveAliens)[number] | undefined>((lowest, alien) => {
				if (!lowest || alien.y > lowest.y) return alien;
				return lowest;
			}, undefined);
		}).filter((alien): alien is (typeof aliveAliens)[number] => Boolean(alien));

		if (columnShooters.length === 0) return null;

		return columnShooters[Math.floor(Math.random() * columnShooters.length)];
	}

	function update(time: number) {
		if (gameOver || gameWon) return;

		if (playerExplosion && playerExplosion.expiresAt <= time) {
			playerExplosion = null;
		}

		const dt = time - lastTime;
		lastTime = time;

		const totalAliens = ALIEN_ROWS * ALIEN_COLS;
		const aliveAliensNow = aliens.filter((a) => a.alive);
		const destroyedAliens = totalAliens - aliveAliensNow.length;
		const endgameIntensity = 1 - aliveAliensNow.length / totalAliens;
		const alienBulletSpeed = Math.min(
			MAX_ALIEN_BULLET_SPEED,
			(BASE_ALIEN_BULLET_SPEED +
				alienDescents * ALIEN_BULLET_SPEED_DESCENT_BONUS +
				endgameIntensity * ALIEN_BULLET_SPEED_ENDGAME_BONUS) *
				(chaosMode ? 1.35 : 1)
		);

		// Update Bullets
		bullets = bullets
			.map((b) => ({
				...b,
				y: b.y + (b.type === 'player' ? -5 * (chaosMode ? 2 : 1) : alienBulletSpeed)
			}))
			.filter((b) => b.y > 0 && b.y < GAME_HEIGHT);

		// Alien Movement
		alienStep +=
			dt *
			0.001 *
			(alienSpeed +
				endgameIntensity * ALIEN_ENDGAME_SPEED_BOOST +
				destroyedAliens * ALIEN_KILL_SPEED_BOOST) *
			(chaosMode ? 3 : 1);
		if (alienStep > 0.5) {
			alienStep = 0;
			globalTick = (globalTick + 1) % 2;
			let hitEdge = false;
			aliens.forEach((a) => {
				if (a.alive) {
					a.legFrame = globalTick;
					a.x += 10 * alienDirection;
					if (a.x > GAME_WIDTH - ALIEN_WIDTH || a.x < 0) hitEdge = true;
				}
			});

			if (hitEdge) {
				alienDirection *= -1;
				alienDescents += 1;
				aliens.forEach((a) => {
					if (a.alive) {
						a.y += 20;
						if (a.y + ALIEN_HEIGHT > GAME_HEIGHT - PLAYER_HEIGHT - 20) {
							gameOver = true;
						}
					}
				});
				alienSpeed += ALIEN_DESCENT_SPEED_BOOST;
			}

			// Random Alien Shoot
			const aliveAliens = aliens.filter((a) => a.alive);
			const currentEndgameIntensity = 1 - aliveAliens.length / totalAliens;
			const fireRamp = Math.pow(currentEndgameIntensity, 1.35);
			const fireChance = Math.min(
				MAX_ALIEN_FIRE_CHANCE,
				(BASE_ALIEN_FIRE_CHANCE +
					alienDescents * ALIEN_FIRE_DESCENT_BONUS +
					fireRamp * ALIEN_FIRE_ENDGAME_BONUS) *
					(chaosMode ? 1.5 : 1)
			);
			if (Math.random() < fireChance && aliveAliens.length > 0) {
				const shooter = getAlienShooter(aliveAliens);
				if (shooter) {
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
		for (let bi = bullets.length - 1; bi >= 0; bi--) {
			const b = bullets[bi];

			if (hitShield(b)) {
				bullets.splice(bi, 1);
				continue;
			}

			// Check alien collision (player bullets only)
			if (b.type === 'player') {
				for (let ai = 0; ai < aliens.length; ai++) {
					const a = aliens[ai];
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
						break;
					}
				}
			}

			// Alien bullet hits player
			if (b.type === 'alien') {
				if (
					b.x > playerX &&
					b.x < playerX + PLAYER_WIDTH &&
					b.y > GAME_HEIGHT - PLAYER_HEIGHT - 20 &&
					b.y < GAME_HEIGHT - 20
				) {
					playerExplosion = {
						x: playerX,
						y: GAME_HEIGHT - PLAYER_HEIGHT - 28,
						id: nextExplosionId++,
						expiresAt: time + PLAYER_HIT_ANIMATION_MS
					};
					bullets.splice(bi, 1);

					if (lives <= 1) {
						lives = 0;
						gameOver = true;
					} else {
						lives -= 1;
						playerX = GAME_WIDTH / 2 - PLAYER_WIDTH / 2;
						bullets = bullets.filter((bullet) => bullet.type === 'player');
					}

					break;
				}
			}
		}

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
			<span class="bg-green-400 px-2 text-black">LIVES: {lives}</span>
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

		{#if playerExplosion}
			{#key playerExplosion.id}
				<div
					class="player-hit-burst absolute"
					style:left="{playerExplosion.x - 8}px"
					style:top="{playerExplosion.y - 8}px"
				>
					<div class="player-hit-core"></div>
					<div class="player-hit-ring"></div>
				</div>
			{/key}
		{/if}

		<!-- Aliens -->
		{#each aliens as alien (alien.id)}
			{#if alien.alive}
				<div
					class="absolute"
					style:left="{alien.x}px"
					style:top="{alien.y}px"
					style:width="{ALIEN_WIDTH}px"
					style:height="{ALIEN_HEIGHT}px"
				>
					{#if alien.id < ALIEN_COLS}
						<!-- Type 0: squid - top row -->
						<svg width={ALIEN_WIDTH} height={ALIEN_HEIGHT} viewBox="0 0 40 30">
							<g
								class="text-green-400"
								fill="currentColor"
								style="filter: drop-shadow(0 0 4px #4ade80);"
							>
								<!-- Body -->
								<rect x="8" y="0" width="24" height="4" />
								<rect x="4" y="4" width="32" height="4" />
								<rect x="4" y="8" width="8" height="4" />
								<rect x="12" y="8" width="16" height="4" />
								<rect x="28" y="8" width="8" height="4" />
								<rect x="4" y="12" width="4" height="4" />
								<rect x="12" y="12" width="4" height="4" />
								<rect x="24" y="12" width="4" height="4" />
								<rect x="32" y="12" width="4" height="4" />
								<!-- Eyes -->
								<rect x="12" y="16" width="4" height="4" fill="black" />
								<rect x="24" y="16" width="4" height="4" fill="black" />
								<!-- Mouth -->
								<rect x="16" y="20" width="8" height="4" />
								<!-- Legs animation -->
								{#if alien.legFrame === 0}
									<rect x="10" y="24" width="4" height="4" />
									<rect x="26" y="24" width="4" height="4" />
								{:else}
									<rect x="14" y="24" width="4" height="4" />
									<rect x="22" y="24" width="4" height="4" />
								{/if}
							</g>
						</svg>
					{:else if alien.id < ALIEN_COLS * 2}
						<!-- Type 1: crab - second/third row -->
						<svg width={ALIEN_WIDTH} height={ALIEN_HEIGHT} viewBox="0 0 40 30">
							<g
								class="text-green-400"
								fill="currentColor"
								style="filter: drop-shadow(0 0 4px #4ade80);"
							>
								<!-- Body -->
								<rect x="12" y="0" width="16" height="4" />
								<rect x="8" y="4" width="24" height="4" />
								<rect x="4" y="8" width="32" height="4" />
								<rect x="4" y="12" width="8" height="4" />
								<rect x="12" y="12" width="4" height="4" />
								<rect x="24" y="12" width="4" height="4" />
								<rect x="28" y="12" width="8" height="4" />
								<rect x="12" y="16" width="16" height="4" />
								<rect x="8" y="20" width="4" height="4" />
								<rect x="28" y="20" width="4" height="4" />
								<!-- Eyes -->
								<rect x="12" y="16" width="4" height="4" fill="black" />
								<rect x="24" y="16" width="4" height="4" fill="black" />
								<!-- Antennae -->
								<rect x="8" y="0" width="4" height="4" />
								<rect x="28" y="0" width="4" height="4" />
								<!-- Legs animation -->
								{#if alien.legFrame === 0}
									<rect x="8" y="24" width="4" height="4" />
									<rect x="28" y="24" width="4" height="4" />
								{:else}
									<rect x="12" y="24" width="4" height="4" />
									<rect x="24" y="24" width="4" height="4" />
								{/if}
							</g>
						</svg>
					{:else}
						<!-- Type 2: octopus - bottom rows -->
						<svg width={ALIEN_WIDTH} height={ALIEN_HEIGHT} viewBox="0 0 40 30">
							<g
								class="text-green-400"
								fill="currentColor"
								style="filter: drop-shadow(0 0 4px #4ade80);"
							>
								<!-- Dome -->
								<rect x="12" y="0" width="16" height="4" />
								<rect x="8" y="4" width="24" height="4" />
								<rect x="4" y="8" width="32" height="4" />
								<rect x="4" y="12" width="8" height="4" />
								<rect x="16" y="12" width="8" height="4" />
								<rect x="28" y="12" width="8" height="4" />
								<rect x="12" y="16" width="16" height="4" />
								<!-- Eyes -->
								<rect x="12" y="16" width="4" height="4" fill="black" />
								<rect x="24" y="16" width="4" height="4" fill="black" />
								<!-- Tentacles animation -->
								{#if alien.legFrame === 0}
									<rect x="8" y="20" width="4" height="4" />
									<rect x="16" y="20" width="4" height="4" />
									<rect x="24" y="20" width="4" height="4" />
									<rect x="12" y="24" width="4" height="4" />
									<rect x="24" y="24" width="4" height="4" />
								{:else}
									<rect x="4" y="20" width="4" height="4" />
									<rect x="20" y="20" width="4" height="4" />
									<rect x="28" y="20" width="4" height="4" />
									<rect x="16" y="24" width="4" height="4" />
									<rect x="20" y="24" width="4" height="4" />
								{/if}
							</g>
						</svg>
					{/if}
				</div>
			{/if}
		{/each}

		<!-- Shields -->
		{#each shields as shield (shield.x)}
			<div
				class="absolute"
				style:left="{shield.x}px"
				style:top="{shield.y}px"
				style:width="{SHIELD_WIDTH}px"
				style:height="{SHIELD_HEIGHT}px"
			>
				{#each shield.pixels as pixelRow, rowIndex}
					{#each pixelRow as pixel, colIndex}
						{#if pixel}
							<div
								class="absolute bg-green-400"
								style:left="{colIndex * SHIELD_CELL_WIDTH}px"
								style:top="{rowIndex * SHIELD_CELL_HEIGHT}px"
								style:width="{SHIELD_CELL_WIDTH}px"
								style:height="{SHIELD_CELL_HEIGHT}px"
							></div>
						{/if}
					{/each}
				{/each}
			</div>
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

	.player-hit-burst {
		width: 66px;
		height: 66px;
		pointer-events: none;
	}

	.player-hit-core,
	.player-hit-ring {
		position: absolute;
		inset: 0;
		border-radius: 9999px;
	}

	.player-hit-core {
		background: radial-gradient(
			circle,
			rgb(250 204 21 / 0.95) 0 24%,
			rgb(248 113 113 / 0.8) 25% 52%,
			transparent 53%
		);
		animation: player-hit-core 350ms ease-out forwards;
	}

	.player-hit-ring {
		border: 4px solid rgb(250 204 21 / 0.95);
		box-shadow: 0 0 20px rgb(248 113 113 / 0.7);
		animation: player-hit-ring 350ms ease-out forwards;
	}

	@keyframes player-hit-core {
		from {
			transform: scale(0.35);
			opacity: 1;
		}

		to {
			transform: scale(1.15);
			opacity: 0;
		}
	}

	@keyframes player-hit-ring {
		from {
			transform: scale(0.2);
			opacity: 0.95;
		}

		to {
			transform: scale(1.3);
			opacity: 0;
		}
	}
</style>
