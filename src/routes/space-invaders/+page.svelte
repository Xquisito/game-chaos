<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	// Audio
	let audioCtx: AudioContext | null = null;

	function ensureAudioCtx() {
		if (!audioCtx) {
			audioCtx = new AudioContext();
		}
		return audioCtx;
	}

	function playMarchTone(index: number) {
		const ctx = ensureAudioCtx();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'square';
		const baseFreqs = [36, 42, 48, 54];
		const freqBoost = Math.min(alienDescents * 2, 24);
		osc.frequency.value = baseFreqs[index % 4] + freqBoost;
		gain.gain.setValueAtTime(0.04, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(ctx.currentTime);
		osc.stop(ctx.currentTime + 0.06);
	}

	function playPlayerShot() {
		const ctx = ensureAudioCtx();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'square';
		osc.frequency.setValueAtTime(880, ctx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.12);
		gain.gain.setValueAtTime(0.08, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(ctx.currentTime);
		osc.stop(ctx.currentTime + 0.12);
	}

	function playAlienHit() {
		const ctx = ensureAudioCtx();
		const bufferSize = ctx.sampleRate * 0.1;
		const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < bufferSize; i++) {
			data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
		}
		const source = ctx.createBufferSource();
		source.buffer = buffer;
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.15, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
		source.connect(gain);
		gain.connect(ctx.destination);
		source.start(ctx.currentTime);
	}

	function playPlayerDeath() {
		const ctx = ensureAudioCtx();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime(440, ctx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.6);
		gain.gain.setValueAtTime(0.15, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(ctx.currentTime);
		osc.stop(ctx.currentTime + 0.6);
	}

	function playUfoHit() {
		const ctx = ensureAudioCtx();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(1200, ctx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.2);
		gain.gain.setValueAtTime(0.12, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(ctx.currentTime);
		osc.stop(ctx.currentTime + 0.2);
	}

	let ufoOsc: OscillatorNode | null = null;
	let ufoGain: GainNode | null = null;

	function startUfoHum() {
		const ctx = ensureAudioCtx();
		if (ufoOsc) return;
		ufoOsc = ctx.createOscillator();
		ufoGain = ctx.createGain();
		ufoOsc.type = 'sine';
		ufoOsc.frequency.value = 240;
		ufoGain.gain.value = 0.04;
		ufoOsc.connect(ufoGain);
		ufoGain.connect(ctx.destination);
		ufoOsc.start(ctx.currentTime);
	}

	function stopUfoHum() {
		if (ufoOsc) {
			ufoOsc.stop();
			ufoOsc.disconnect();
			ufoOsc = null;
		}
		if (ufoGain) {
			ufoGain.disconnect();
			ufoGain = null;
		}
	}

	// Game Constants
	const GAME_WIDTH = 800;
	const GAME_HEIGHT = 600;
	const PLAYER_WIDTH = 50;
	const PLAYER_HEIGHT = 20;
	const PLAYER_MOVE_SPEED = 360;
	const PLAYER_BULLET_SPEED = 6.5;
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
	const BASE_ALIEN_STEP_INTERVAL = 520;
	const ALIEN_STEP_DESCENT_REDUCTION = 22;
	const ALIEN_STEP_KILL_REDUCTION = 4;
	const ALIEN_STEP_ENDGAME_REDUCTION = 180;
	const MIN_ALIEN_STEP_INTERVAL = 80;
	const BASE_ALIEN_FIRE_INTERVAL = 900;
	const ALIEN_FIRE_DESCENT_REDUCTION = 42;
	const ALIEN_FIRE_KILL_REDUCTION = 6;
	const ALIEN_FIRE_ENDGAME_REDUCTION = 210;
	const MIN_ALIEN_FIRE_INTERVAL = 320;
	const BASE_ALIEN_BULLET_SPEED = 3;
	const ALIEN_BULLET_SPEED_DESCENT_BONUS = 0.12;
	const ALIEN_BULLET_SPEED_KILL_BONUS = 0.03;
	const ALIEN_BULLET_SPEED_ENDGAME_BONUS = 1.1;
	const MAX_ALIEN_BULLET_SPEED = 5.4;
	const PLAYER_HIT_ANIMATION_MS = 350;
	const PLAYER_RESPAWN_INVULNERABILITY_MS = 1100;
	const ALIEN_FRONTLINE_FIRE_REDUCTION = 90;
	const UFO_WIDTH = 48;
	const UFO_HEIGHT = 20;
	const UFO_Y = 30;
	const UFO_SPEED = 180;
	const UFO_FIRE_INTERVAL_MIN = 18000;
	const UFO_FIRE_INTERVAL_MAX = 32000;
	const UFO_SCORES = [50, 100, 150, 300];

	type BulletVariant = 'player' | 'alien';
	type Bullet = {
		x: number;
		y: number;
		type: 'player' | 'alien';
		id: number;
		variant: BulletVariant;
		speedX: number;
		speedY: number;
		width: number;
		height: number;
	};

	// State
	let score = $state(0);
	let highScore = $state(0);
	let lives = $state(3);
	let gameOver = $state(false);
	let gameWon = $state(false);
	let playerX = $state(GAME_WIDTH / 2 - PLAYER_WIDTH / 2);
	let moveLeft = $state(false);
	let moveRight = $state(false);
	let playerInvulnerable = $state(false);
	let playerInvulnerableUntil = $state(0);
	let playerExplosion = $state<{ x: number; y: number; id: number; expiresAt: number } | null>(
		null
	);
	let bullets = $state<Bullet[]>([]);
	let nextBulletId = 0;
	let nextExplosionId = 0;
	let aliens = $state<{ x: number; y: number; alive: boolean; id: number; legFrame: number }[]>([]);
	let alienDirection = $state(1); // 1 for right, -1 for left
	let alienStep = $state(0);
	let alienDescents = $state(0);
	let marchToneIndex = $state(0);
	let alienFireCooldown = $state(BASE_ALIEN_FIRE_INTERVAL);
	let ufo = $state<{ x: number; direction: number; score?: number; active: boolean }>({
		x: 0,
		direction: 1,
		active: false
	});
	let ufoFireTimer = $state(UFO_FIRE_INTERVAL_MIN);
	let ufoScorePopup = $state<{ x: number; y: number; score: number; expiresAt: number } | null>(
		null
	);
	let lastTime = 0;
	let showChaosModal = $state(false);
	let chaosMode = $state(false);
	let globalTick = $state(0);
	let running = $state(false);
	let paused = $state(false);
	let gameStarted = $state(false);
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
		gameStarted = false;
		running = false;
		paused = false;
		playerX = GAME_WIDTH / 2 - PLAYER_WIDTH / 2;
		moveLeft = false;
		moveRight = false;
		playerInvulnerable = false;
		playerInvulnerableUntil = 0;
		playerExplosion = null;
		bullets = [];
		aliens = [];
		alienDirection = 1;
		alienStep = 0;
		alienDescents = 0;
		marchToneIndex = 0;
		alienFireCooldown = BASE_ALIEN_FIRE_INTERVAL;
		ufo = { x: 0, direction: 1, active: false };
		ufoFireTimer = UFO_FIRE_INTERVAL_MIN;
		ufoScorePopup = null;
		chaosMode = false;
		globalTick = 0;

		const saved = localStorage.getItem('space-chaos-high-score');
		if (saved) {
			highScore = parseInt(saved, 10);
		}

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
		if (!gameStarted) {
			if (e.key === ' ' || e.key === 'Enter') {
				e.preventDefault();
				gameStarted = true;
				running = true;
				requestAnimationFrame(update);
			}
			return;
		}

		if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
			e.preventDefault();
			paused = !paused;
			if (!paused) {
				lastTime = performance.now();
				requestAnimationFrame(update);
			}
			return;
		}

		if (paused || gameOver || gameWon) return;

		if (e.key === 'ArrowLeft') {
			moveLeft = true;
		} else if (e.key === 'ArrowRight') {
			moveRight = true;
		} else if (e.key === ' ' || e.key === 'ArrowUp') {
			shoot();
		}

		if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowUp') {
			e.preventDefault();
		}
	}

	function handleKeyup(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') {
			moveLeft = false;
		} else if (e.key === 'ArrowRight') {
			moveRight = false;
		}
	}

	function clearMovement() {
		moveLeft = false;
		moveRight = false;
	}

	function shoot() {
		if (bullets.some((b) => b.type === 'player') && !chaosMode) {
			return;
		}

		playPlayerShot();

		bullets.push({
			x: playerX + PLAYER_WIDTH / 2 - 1,
			y: GAME_HEIGHT - PLAYER_HEIGHT - 36,
			type: 'player',
			variant: 'player',
			speedX: 0,
			speedY: -PLAYER_BULLET_SPEED * (chaosMode ? 1.2 : 1),
			width: chaosMode ? 4 : 2,
			height: 15,
			id: nextBulletId++
		});
	}

	function createAlienBullet(shooter: (typeof aliens)[number], bulletSpeed: number) {
		const shooterCenterX = shooter.x + ALIEN_WIDTH / 2;

		bullets.push({
			x: shooterCenterX - 1,
			y: shooter.y + ALIEN_HEIGHT,
			type: 'alien',
			variant: 'alien',
			speedX: 0,
			speedY: bulletSpeed,
			width: 2,
			height: 16,
			id: nextBulletId++
		});
	}

	function getAlienStepInterval(destroyedAliens: number, endgameIntensity: number) {
		return Math.max(
			MIN_ALIEN_STEP_INTERVAL,
			(BASE_ALIEN_STEP_INTERVAL -
				alienDescents * ALIEN_STEP_DESCENT_REDUCTION -
				destroyedAliens * ALIEN_STEP_KILL_REDUCTION -
				endgameIntensity * ALIEN_STEP_ENDGAME_REDUCTION) *
				(chaosMode ? 0.68 : 1)
		);
	}

	function getAlienFireInterval(destroyedAliens: number, endgameIntensity: number) {
		return Math.max(
			MIN_ALIEN_FIRE_INTERVAL,
			(BASE_ALIEN_FIRE_INTERVAL -
				alienDescents * ALIEN_FIRE_DESCENT_REDUCTION -
				destroyedAliens * ALIEN_FIRE_KILL_REDUCTION -
				endgameIntensity * ALIEN_FIRE_ENDGAME_REDUCTION) *
				(chaosMode ? 0.72 : 1)
		);
	}

	function getAlienBulletSpeed(destroyedAliens: number, endgameIntensity: number) {
		return Math.min(
			MAX_ALIEN_BULLET_SPEED,
			(BASE_ALIEN_BULLET_SPEED +
				alienDescents * ALIEN_BULLET_SPEED_DESCENT_BONUS +
				destroyedAliens * ALIEN_BULLET_SPEED_KILL_BONUS +
				endgameIntensity * ALIEN_BULLET_SPEED_ENDGAME_BONUS) *
				(chaosMode ? 1.25 : 1)
		);
	}

	function fireAlienShot(
		aliveAliens: typeof aliens,
		bulletSpeed: number,
		_endgameIntensity: number
	) {
		const shooter = getAlienShooter(aliveAliens);
		if (!shooter) return 0;

		createAlienBullet(shooter, bulletSpeed);

		return Math.floor(shooter.id / ALIEN_COLS) / (ALIEN_ROWS - 1);
	}

	function getAlienScore(alienId: number) {
		const row = Math.floor(alienId / ALIEN_COLS);
		if (row === 0) return 30;
		if (row < 3) return 20;
		return 10;
	}

	function getBulletCenterX(bullet: Bullet) {
		return bullet.x + bullet.width / 2;
	}

	function getBulletBottom(bullet: Bullet) {
		return bullet.y + bullet.height;
	}

	function getBulletTop(bullet: Bullet) {
		return bullet.y;
	}

	function getBulletCollisionY(bullet: Bullet) {
		return bullet.type === 'player' ? getBulletTop(bullet) : getBulletBottom(bullet);
	}

	function getBulletColor(variant: BulletVariant) {
		if (variant === 'player') return '#fde047';
		return '#ef4444';
	}

	function getBulletRotation(bullet: Bullet) {
		return 'none';
	}

	function getBulletGlow(variant: BulletVariant) {
		if (variant === 'player') return '0 0 10px rgba(253, 224, 71, 0.85)';
		return '0 0 10px rgba(239, 68, 68, 0.8)';
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

	function hitShield(bullet: Bullet) {
		const bulletCenterX = getBulletCenterX(bullet);
		const collisionY = getBulletCollisionY(bullet);

		for (const shield of shields) {
			if (
				bulletCenterX < shield.x ||
				bulletCenterX >= shield.x + SHIELD_WIDTH ||
				collisionY < shield.y ||
				collisionY >= shield.y + SHIELD_HEIGHT
			) {
				continue;
			}

			const px = Math.floor((bulletCenterX - shield.x) / SHIELD_CELL_WIDTH);
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
		if (!running || paused || gameOver || gameWon) return;

		if (playerExplosion && playerExplosion.expiresAt <= time) {
			playerExplosion = null;
		}
		playerInvulnerable = playerInvulnerableUntil > time;

		const dt = time - lastTime;
		lastTime = time;

		if (moveLeft !== moveRight) {
			const direction = moveLeft ? -1 : 1;
			playerX = Math.max(
				0,
				Math.min(GAME_WIDTH - PLAYER_WIDTH, playerX + direction * PLAYER_MOVE_SPEED * (dt / 1000))
			);
		}

		const totalAliens = ALIEN_ROWS * ALIEN_COLS;
		const aliveAliensNow = aliens.filter((a) => a.alive);
		const destroyedAliens = totalAliens - aliveAliensNow.length;
		const endgameIntensity = 1 - aliveAliensNow.length / totalAliens;
		const alienBulletSpeed = getAlienBulletSpeed(destroyedAliens, endgameIntensity);
		const alienStepInterval = getAlienStepInterval(destroyedAliens, endgameIntensity);
		const alienFireInterval = getAlienFireInterval(destroyedAliens, endgameIntensity);
		alienFireCooldown -= dt;
		ufoFireTimer -= dt;

		// Update Bullets
		bullets = bullets
			.map((b) => ({
				...b,
				x: b.x + b.speedX,
				y: b.y + b.speedY
			}))
			.filter((b) => b.y > 0 && b.y < GAME_HEIGHT);

		// Alien Movement
		alienStep += dt;
		if (alienStep >= alienStepInterval) {
			alienStep = 0;
			globalTick = (globalTick + 1) % 2;
			marchToneIndex = (marchToneIndex + 1) % 4;
			playMarchTone(marchToneIndex);
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
			}
		}

		// UFO Logic
		if (ufoFireTimer <= 0 && !ufo.active) {
			const direction = Math.random() < 0.5 ? 1 : -1;
			ufo = {
				x: direction === 1 ? -UFO_WIDTH : GAME_WIDTH,
				direction,
				active: true
			};
			ufoFireTimer =
				UFO_FIRE_INTERVAL_MIN + Math.random() * (UFO_FIRE_INTERVAL_MAX - UFO_FIRE_INTERVAL_MIN);
			startUfoHum();
		}

		if (ufo.active) {
			ufo.x += ufo.direction * UFO_SPEED * (dt / 1000);
			if (ufo.x > GAME_WIDTH + UFO_WIDTH || ufo.x < -UFO_WIDTH * 2) {
				ufo.active = false;
				stopUfoHum();
			}
		}

		if (ufoScorePopup && ufoScorePopup.expiresAt <= time) {
			ufoScorePopup = null;
		}

		if (alienFireCooldown <= 0 && aliveAliensNow.length > 0) {
			const frontlinePressure = fireAlienShot(aliveAliensNow, alienBulletSpeed, endgameIntensity);
			alienFireCooldown = Math.max(
				MIN_ALIEN_FIRE_INTERVAL,
				alienFireInterval - frontlinePressure * ALIEN_FRONTLINE_FIRE_REDUCTION
			);
		}

		// Collision Detection
		for (let bi = bullets.length - 1; bi >= 0; bi--) {
			const b = bullets[bi];
			const bulletCenterX = getBulletCenterX(b);
			const bulletTop = getBulletTop(b);
			const bulletBottom = getBulletBottom(b);

			if (hitShield(b)) {
				bullets.splice(bi, 1);
				continue;
			}

			// Check alien collision (player bullets only)
			if (b.type === 'player') {
				// Check UFO hit
				if (
					ufo.active &&
					bulletCenterX > ufo.x &&
					bulletCenterX < ufo.x + UFO_WIDTH &&
					bulletTop > UFO_Y &&
					bulletTop < UFO_Y + UFO_HEIGHT
				) {
					const ufoScore = UFO_SCORES[Math.floor(Math.random() * UFO_SCORES.length)];
					score += ufoScore;
					ufoScorePopup = {
						x: ufo.x + UFO_WIDTH / 2,
						y: UFO_Y - 10,
						score: ufoScore,
						expiresAt: time + 800
					};
					ufo.active = false;
					stopUfoHum();
					playUfoHit();
					bullets.splice(bi, 1);
					continue;
				}

				for (let ai = 0; ai < aliens.length; ai++) {
					const a = aliens[ai];
					if (
						a.alive &&
						bulletCenterX > a.x &&
						bulletCenterX < a.x + ALIEN_WIDTH &&
						bulletTop > a.y &&
						bulletTop < a.y + ALIEN_HEIGHT
					) {
						a.alive = false;
						bullets.splice(bi, 1);
						score += getAlienScore(a.id);
						playAlienHit();
						break;
					}
				}
			}

			// Alien bullet hits player
			if (b.type === 'alien' && !playerInvulnerable) {
				if (
					bulletCenterX > playerX &&
					bulletCenterX < playerX + PLAYER_WIDTH &&
					bulletBottom > GAME_HEIGHT - PLAYER_HEIGHT - 20 &&
					bulletTop < GAME_HEIGHT - 20
				) {
					playerExplosion = {
						x: playerX,
						y: GAME_HEIGHT - PLAYER_HEIGHT - 28,
						id: nextExplosionId++,
						expiresAt: time + PLAYER_HIT_ANIMATION_MS
					};
					bullets.splice(bi, 1);
					playPlayerDeath();

					if (lives <= 1) {
						lives = 0;
						if (score > highScore) {
							highScore = score;
							localStorage.setItem('space-chaos-high-score', String(highScore));
						}
						gameOver = true;
					} else {
						lives -= 1;
						playerX = GAME_WIDTH / 2 - PLAYER_WIDTH / 2;
						playerInvulnerableUntil = time + PLAYER_RESPAWN_INVULNERABILITY_MS;
						playerInvulnerable = true;
						bullets = bullets.filter((bullet) => bullet.type === 'player');
						alienFireCooldown = Math.max(alienFireCooldown, 260);
					}

					break;
				}
			}
		}

		if (aliens.every((a) => !a.alive)) {
			if (score > highScore) {
				highScore = score;
				localStorage.setItem('space-chaos-high-score', String(highScore));
			}
			gameWon = true;
		}

		requestAnimationFrame(update);
	}

	function triggerChaos() {
		showChaosModal = true;
		chaosMode = true;
		alienFireCooldown = Math.min(alienFireCooldown, 260);
	}

	onMount(() => {
		initGame();
		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('keyup', handleKeyup);
		window.addEventListener('blur', clearMovement);
		return () => {
			running = false;
			stopUfoHum();
			if (audioCtx) {
				audioCtx.close();
				audioCtx = null;
			}
			window.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('keyup', handleKeyup);
			window.removeEventListener('blur', clearMovement);
		};
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
		<div
			class="score-hud absolute top-3 right-0 left-0 z-20 flex items-center justify-between px-6"
		>
			<div class="flex items-center gap-6">
				<div class="flex flex-col items-start">
					<span class="score-label">SCORE</span>
					<span class="score-value">{score}</span>
				</div>
				<div class="flex flex-col items-start">
					<span class="score-label">HIGH SCORE</span>
					<span class="score-value">{highScore}</span>
				</div>
			</div>
			{#if chaosMode}
				<span
					class="animate-bounce rounded bg-red-600 px-3 py-1 text-sm font-black tracking-widest text-white uppercase"
					>CHAOS ACTIVE</span
				>
			{/if}
		</div>

		<!-- Player -->
		<div
			class={`absolute bg-green-400 transition-all duration-75 ${playerInvulnerable ? 'player-respawn-flicker' : ''}`}
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

		{#if ufo.active}
			<div
				class="ufo-saucer absolute"
				style:left="{ufo.x}px"
				style:top="{UFO_Y}px"
				style:width="{UFO_WIDTH}px"
				style:height="{UFO_HEIGHT}px"
			>
				<svg width={UFO_WIDTH} height={UFO_HEIGHT} viewBox="0 0 48 20">
					<ellipse cx="24" cy="14" rx="22" ry="5" fill="#f472b6" />
					<ellipse cx="24" cy="10" rx="10" ry="6" fill="#fb7185" />
					<circle cx="18" cy="10" r="2" fill="#fde047" />
					<circle cx="24" cy="8" r="2" fill="#fde047" />
					<circle cx="30" cy="10" r="2" fill="#fde047" />
				</svg>
			</div>
		{/if}

		{#if ufoScorePopup}
			{#key ufoScorePopup.score}
				<div
					class="ufo-score-popup absolute"
					style:left="{ufoScorePopup.x}px"
					style:top="{ufoScorePopup.y}px"
				>
					{ufoScorePopup.score}
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

		<!-- Lives -->
		<div class="lives-bar absolute bottom-2 left-4 z-20 flex items-center gap-3">
			{#each { length: lives } as _, i (i)}
				<svg width="24" height="16" viewBox="0 0 50 20" class="life-cannon">
					<rect x="0" y="12" width="50" height="8" fill="#4ade80" rx="2" />
					<rect x="21" y="4" width="8" height="10" fill="#4ade80" rx="1" />
				</svg>
			{/each}
		</div>

		<!-- Shields -->
		{#each shields as shield (shield.x)}
			<div
				class="absolute"
				style:left="{shield.x}px"
				style:top="{shield.y}px"
				style:width="{SHIELD_WIDTH}px"
				style:height="{SHIELD_HEIGHT}px"
			>
				{#each shield.pixels as pixelRow, rowIndex (rowIndex)}
					{#each pixelRow as pixel, colIndex (colIndex)}
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
				class="absolute rounded-full"
				style:left="{bullet.x}px"
				style:top="{bullet.y}px"
				style:width="{bullet.width}px"
				style:height="{bullet.height}px"
				style:background={getBulletColor(bullet.variant)}
				style:transform={getBulletRotation(bullet)}
				style:box-shadow={getBulletGlow(bullet.variant)}
			></div>
		{/each}

		<!-- Game Over Overlays -->
		{#if !gameStarted}
			<div
				class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md"
			>
				<div class="mb-12 flex gap-8">
					<svg
						width="40"
						height="30"
						viewBox="0 0 40 30"
						class="animate-bounce text-green-400"
						fill="currentColor"
						style="animation-delay: 0ms;"
					>
						<rect x="8" y="0" width="24" height="4" />
						<rect x="4" y="4" width="32" height="4" />
						<rect x="4" y="8" width="8" height="4" />
						<rect x="12" y="8" width="16" height="4" />
						<rect x="28" y="8" width="8" height="4" />
						<rect x="4" y="12" width="4" height="4" />
						<rect x="12" y="12" width="4" height="4" />
						<rect x="24" y="12" width="4" height="4" />
						<rect x="32" y="12" width="4" height="4" />
						<rect x="12" y="16" width="4" height="4" fill="black" />
						<rect x="24" y="16" width="4" height="4" fill="black" />
						<rect x="16" y="20" width="8" height="4" />
						<rect x="10" y="24" width="4" height="4" />
						<rect x="26" y="24" width="4" height="4" />
					</svg>
					<svg
						width="40"
						height="30"
						viewBox="0 0 40 30"
						class="animate-bounce text-green-400"
						fill="currentColor"
						style="animation-delay: 150ms;"
					>
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
						<rect x="12" y="16" width="4" height="4" fill="black" />
						<rect x="24" y="16" width="4" height="4" fill="black" />
						<rect x="8" y="0" width="4" height="4" />
						<rect x="28" y="0" width="4" height="4" />
						<rect x="8" y="24" width="4" height="4" />
						<rect x="28" y="24" width="4" height="4" />
					</svg>
					<svg
						width="40"
						height="30"
						viewBox="0 0 40 30"
						class="animate-bounce text-green-400"
						fill="currentColor"
						style="animation-delay: 300ms;"
					>
						<rect x="12" y="0" width="16" height="4" />
						<rect x="8" y="4" width="24" height="4" />
						<rect x="4" y="8" width="32" height="4" />
						<rect x="4" y="12" width="8" height="4" />
						<rect x="16" y="12" width="8" height="4" />
						<rect x="28" y="12" width="8" height="4" />
						<rect x="12" y="16" width="16" height="4" />
						<rect x="12" y="16" width="4" height="4" fill="black" />
						<rect x="24" y="16" width="4" height="4" fill="black" />
						<rect x="8" y="20" width="4" height="4" />
						<rect x="16" y="20" width="4" height="4" />
						<rect x="24" y="20" width="4" height="4" />
						<rect x="12" y="24" width="4" height="4" />
						<rect x="24" y="24" width="4" height="4" />
					</svg>
				</div>
				<h2
					class="mb-4 text-6xl font-black tracking-tighter text-green-400 uppercase drop-shadow-[3px_3px_0_rgba(0,0,0,1)]"
				>
					SPACE CHAOS
				</h2>
				<p class="mb-8 text-lg font-bold text-pink-400 italic">← → to move · SPACE to fire</p>
				<p class="animate-pulse text-2xl font-black tracking-widest text-yellow-400 uppercase">
					Press SPACE to start
				</p>
			</div>
		{/if}

		{#if paused}
			<div
				class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
			>
				<h2
					class="mb-6 text-7xl font-black tracking-tighter text-yellow-400 uppercase drop-shadow-[3px_3px_0_rgba(0,0,0,1)]"
				>
					PAUSED
				</h2>
				<p class="animate-pulse text-xl font-bold text-white">Press ESC or P to resume</p>
			</div>
		{/if}

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
		href={resolve('/')}
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

	.score-hud {
		font-family: 'Courier New', monospace;
	}

	.score-label {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 3px;
		color: #a78bfa;
		text-transform: uppercase;
	}

	.score-value {
		font-size: 22px;
		font-weight: 900;
		letter-spacing: 2px;
		color: #fde047;
		text-shadow: 0 0 10px rgba(253, 224, 71, 0.5);
	}

	.lives-bar {
		filter: drop-shadow(0 0 6px rgba(74, 222, 128, 0.6));
	}

	.life-cannon {
		opacity: 0.9;
	}

	.player-hit-burst {
		width: 66px;
		height: 66px;
		pointer-events: none;
	}

	.player-respawn-flicker {
		animation: player-respawn-flicker 120ms steps(1) infinite;
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

	@keyframes player-respawn-flicker {
		0%,
		100% {
			opacity: 1;
			filter: drop-shadow(0 0 14px #4ade80);
		}

		50% {
			opacity: 0.35;
			filter: drop-shadow(0 0 4px #4ade80);
		}
	}

	.ufo-saucer {
		filter: drop-shadow(0 0 8px #f472b6);
		animation: ufo-pulse 600ms ease-in-out infinite alternate;
	}

	@keyframes ufo-pulse {
		from {
			filter: drop-shadow(0 0 6px #f472b6);
		}

		to {
			filter: drop-shadow(0 0 16px #fb7185);
		}
	}

	.ufo-score-popup {
		font-size: 18px;
		font-weight: 900;
		color: #f472b6;
		text-shadow: 0 0 8px #f472b6;
		pointer-events: none;
		animation: ufo-score-float 800ms ease-out forwards;
	}

	@keyframes ufo-score-float {
		from {
			transform: translateY(0);
			opacity: 1;
		}

		to {
			transform: translateY(-30px);
			opacity: 0;
		}
	}
</style>
