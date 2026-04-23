<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { KEY_ESCAPE, KEY_ENTER, KEY_SPACE, isArrowKey, normalizeKey } from '$lib/keys';

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
	const GAMEPAD_DEADZONE = 0.2;
	const GAMEPAD_FIRE_COOLDOWN = 200;
	const UFO_WIDTH = 48;
	const UFO_HEIGHT = 20;
	const UFO_Y = 30;
	const UFO_SPEED = 180;
	const UFO_FIRE_INTERVAL_MIN = 18000;
	const UFO_FIRE_INTERVAL_MAX = 32000;
	const UFO_SCORES = [50, 100, 150, 300];
	const DIFFICULTY_OPTIONS = ['easy', 'normal', 'hard'] as const;

	type Difficulty = 'easy' | 'normal' | 'hard';
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
	let difficulty = $state<Difficulty>('easy');
	let selectedDifficulty = $state<Difficulty>('easy');
	let lives = $state(3);
	let gameOver = $state(false);
	let gameWon = $state(false);
	let playerX = $state(GAME_WIDTH / 2 - PLAYER_WIDTH / 2);
	let moveLeft = $state(false);
	let moveRight = $state(false);
	let gamepadFireCooldown = $state(0);
	let gamepadStartWasPressed = $state(false);
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
	let chaosMode = $state(false);
	let globalTick = $state(0);
	let hasActiveRun = $state(false);
	let running = $state(false);
	let paused = $state(false);
	let gameStarted = $state(false);
	let touchCapable = $state(false);
	let viewportWidth = $state(0);
	let touchSteer = $state(0);
	let touchSteeringActive = $state(false);
	let touchFirePressed = $state(false);
	let touchFireCooldown = $state(0);
	let gamepadSelectWasPressed = $state(false);
	let gamepadBackWasPressed = $state(false);
	let gamepadMenuPrevNegative = $state(false);
	let gamepadMenuPrevPositive = $state(false);
	let shields = $state<{ x: number; y: number; pixels: boolean[][] }[]>([]);

	const MENU_BUTTON_SELECTOR = '[data-menu-button]:not([disabled])';
	let splashScreen = $derived(!gameStarted && !gameOver && !gameWon);
	let endScreen = $derived(gameOver || gameWon);
	let menuScreen = $derived(splashScreen || endScreen);
	let showTouchControls = $derived(
		touchCapable && viewportWidth < 960 && gameStarted && !gameOver && !gameWon
	);
	let gameScale = $derived(
		viewportWidth > 0 ? Math.min(1, Math.max(0.34, (viewportWidth - 24) / GAME_WIDTH)) : 1
	);
	let scaledGameWidth = $derived(GAME_WIDTH * gameScale);
	let scaledGameHeight = $derived(GAME_HEIGHT * gameScale);

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

	function getDifficultyTuning(level: Difficulty) {
		if (level === 'easy') {
			return { step: 1.3, fire: 1.4, bullet: 0.8, aggression: 0.75 };
		}

		if (level === 'normal') {
			return { step: 1.15, fire: 1.2, bullet: 0.9, aggression: 0.9 };
		}

		return { step: 1, fire: 1, bullet: 1, aggression: 1 };
	}

	function getDifficultyLabel(level: Difficulty) {
		if (level === 'easy') return 'Easy';
		if (level === 'normal') return 'Normal';
		return 'Hard';
	}

	function selectDifficulty(level: Difficulty) {
		if (hasActiveRun) {
			selectedDifficulty = difficulty;
			return;
		}

		selectedDifficulty = level;
	}

	function initGame() {
		score = 0;
		lives = 3;
		gameOver = false;
		gameWon = false;
		hasActiveRun = false;
		gameStarted = false;
		running = false;
		paused = false;
		playerX = GAME_WIDTH / 2 - PLAYER_WIDTH / 2;
		moveLeft = false;
		moveRight = false;
		gamepadFireCooldown = 0;
		gamepadStartWasPressed = false;
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
		touchSteer = 0;
		touchSteeringActive = false;
		touchFirePressed = false;
		touchFireCooldown = 0;

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

	function getMenuButtons() {
		return Array.from(document.querySelectorAll(MENU_BUTTON_SELECTOR)) as HTMLElement[];
	}

	function moveFocus(direction: number) {
		const buttons = getMenuButtons();
		if (buttons.length === 0) return;

		let index = buttons.indexOf(document.activeElement as HTMLElement);
		if (index === -1) {
			buttons[0].focus();
			return;
		}

		index = (index + direction + buttons.length) % buttons.length;
		buttons[index].focus();
	}

	function activateFocusedMenuItem() {
		const buttons = getMenuButtons();
		if (buttons.length === 0) return;

		const active = document.activeElement as HTMLElement | null;
		if (active && buttons.includes(active)) {
			active.click();
			return;
		}

		buttons[0].focus();
	}

	function clearTransientControls() {
		moveLeft = false;
		moveRight = false;
		gamepadFireCooldown = 0;
		touchSteer = 0;
		touchSteeringActive = false;
		touchFirePressed = false;
		touchFireCooldown = 0;
	}

	function backToDashboard() {
		window.location.href = resolve('/');
	}

	function continueGame() {
		if (!hasActiveRun) return;
		selectedDifficulty = difficulty;
		gameStarted = true;
		running = true;
		paused = false;
		lastTime = performance.now();
		clearTransientControls();
		if (audioCtx?.state === 'suspended') {
			audioCtx.resume();
		}
		if (ufo.active) {
			startUfoHum();
		}
		requestAnimationFrame(update);
	}

	function retryGame() {
		startGame(difficulty);
	}

	function startGame(nextDifficulty: Difficulty = selectedDifficulty) {
		difficulty = nextDifficulty;
		selectedDifficulty = nextDifficulty;
		initGame();
		hasActiveRun = true;
		gameStarted = true;
		running = true;
		paused = false;
		lastTime = performance.now();
		if (audioCtx?.state === 'suspended') {
			audioCtx.resume();
		}
		requestAnimationFrame(update);
	}

	function returnToSplash(preserveRun = false) {
		selectedDifficulty = difficulty;
		gameStarted = false;
		paused = false;
		running = false;
		clearTransientControls();
		stopUfoHum();

		if (preserveRun) {
			hasActiveRun = true;
			return;
		}

		initGame();
	}

	function handleReturnAction() {
		if (gameOver || gameWon) {
			returnToSplash(false);
			return;
		}

		if (gameStarted) {
			returnToSplash(true);
			return;
		}

		backToDashboard();
	}

	function updateTouchSteer(clientX: number, element: HTMLElement) {
		const rect = element.getBoundingClientRect();
		const ratio = ((clientX - rect.left) / rect.width) * 2 - 1;
		touchSteer = Math.max(-1, Math.min(1, ratio));
	}

	function handleSteerPointerDown(event: PointerEvent) {
		const element = event.currentTarget;
		if (!(element instanceof HTMLElement)) return;

		touchSteeringActive = true;
		element.setPointerCapture(event.pointerId);
		updateTouchSteer(event.clientX, element);
	}

	function handleSteerPointerMove(event: PointerEvent) {
		if (!touchSteeringActive) return;

		const element = event.currentTarget;
		if (!(element instanceof HTMLElement)) return;

		updateTouchSteer(event.clientX, element);
	}

	function clearTouchSteer(event?: PointerEvent) {
		const element = event?.currentTarget;
		if (event && element instanceof HTMLElement && element.hasPointerCapture(event.pointerId)) {
			element.releasePointerCapture(event.pointerId);
		}

		touchSteeringActive = false;
		touchSteer = 0;
	}

	function pollGamepadMenuInput() {
		const gamepads = navigator.getGamepads();
		let selectPressed = false;
		let backPressed = false;
		let negativePressed = false;
		let positivePressed = false;

		for (let gi = 0; gi < gamepads.length; gi++) {
			const gp = gamepads[gi];
			if (!gp) continue;

			selectPressed ||= Boolean(gp.buttons[0]?.pressed);
			backPressed ||= Boolean(gp.buttons[1]?.pressed || gp.buttons[8]?.pressed);
			negativePressed ||= Boolean(
				gp.buttons[12]?.pressed || gp.buttons[14]?.pressed || gp.axes[0] < -GAMEPAD_DEADZONE
			);
			positivePressed ||= Boolean(
				gp.buttons[13]?.pressed || gp.buttons[15]?.pressed || gp.axes[0] > GAMEPAD_DEADZONE
			);
		}

		if (backPressed && !gamepadBackWasPressed) {
			handleReturnAction();
		}

		if (menuScreen) {
			if (negativePressed && !gamepadMenuPrevNegative) {
				moveFocus(-1);
			}

			if (positivePressed && !gamepadMenuPrevPositive) {
				moveFocus(1);
			}

			if (selectPressed && !gamepadSelectWasPressed) {
				activateFocusedMenuItem();
			}
		}

		gamepadSelectWasPressed = selectPressed;
		gamepadBackWasPressed = backPressed;
		gamepadMenuPrevNegative = negativePressed;
		gamepadMenuPrevPositive = positivePressed;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === KEY_ESCAPE || e.key === 'b' || e.key === 'B') {
			e.preventDefault();
			handleReturnAction();
			return;
		}

		const key = normalizeKey(e.key);
		const arrow = isArrowKey(e.key);

		if (menuScreen && (key === 'w' || key === 'W' || (arrow && key === 'a'))) {
			e.preventDefault();
			moveFocus(-1);
			return;
		}

		if (menuScreen && (key === 's' || key === 'S' || (arrow && key === 'd'))) {
			e.preventDefault();
			moveFocus(1);
			return;
		}

		if (menuScreen && (e.key === KEY_ENTER || e.key === KEY_SPACE || e.key === 'a' || e.key === 'A')) {
			e.preventDefault();
			activateFocusedMenuItem();
			return;
		}

		if (!gameStarted) {
			return;
		}

		if (e.key === 'p' || e.key === 'P') {
			e.preventDefault();
			paused = !paused;
			if (!paused) {
				lastTime = performance.now();
				requestAnimationFrame(update);
			}
			return;
		}

		if (paused || gameOver || gameWon) return;

		if (key === 'a' || key === 'A') {
			moveLeft = true;
		} else if (key === 'd' || key === 'D') {
			moveRight = true;
		} else if (e.key === KEY_SPACE || key === 'w' || key === 'W') {
			shoot();
		}

		if (key === 'a' || key === 'A' || key === 'd' || key === 'D' || e.key === KEY_SPACE || key === 'w' || key === 'W') {
			e.preventDefault();
		}
	}

	function handleKeyup(e: KeyboardEvent) {
		const key = normalizeKey(e.key);
		if (key === 'a' || key === 'A') {
			moveLeft = false;
		} else if (key === 'd' || key === 'D') {
			moveRight = false;
		}
	}

	function clearMovement() {
		clearTransientControls();
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
		const tuning = getDifficultyTuning(difficulty);
		const scaledEndgameIntensity = endgameIntensity * tuning.aggression;

		return Math.max(
			MIN_ALIEN_STEP_INTERVAL,
			(BASE_ALIEN_STEP_INTERVAL -
				alienDescents * ALIEN_STEP_DESCENT_REDUCTION -
				destroyedAliens * ALIEN_STEP_KILL_REDUCTION -
				scaledEndgameIntensity * ALIEN_STEP_ENDGAME_REDUCTION) *
				(chaosMode ? 0.68 : 1) *
				tuning.step
		);
	}

	function getAlienFireInterval(destroyedAliens: number, endgameIntensity: number) {
		const tuning = getDifficultyTuning(difficulty);
		const scaledEndgameIntensity = endgameIntensity * tuning.aggression;

		return Math.max(
			MIN_ALIEN_FIRE_INTERVAL,
			(BASE_ALIEN_FIRE_INTERVAL -
				alienDescents * ALIEN_FIRE_DESCENT_REDUCTION -
				destroyedAliens * ALIEN_FIRE_KILL_REDUCTION -
				scaledEndgameIntensity * ALIEN_FIRE_ENDGAME_REDUCTION) *
				(chaosMode ? 0.72 : 1) *
				tuning.fire
		);
	}

	function getAlienBulletSpeed(destroyedAliens: number, endgameIntensity: number) {
		const tuning = getDifficultyTuning(difficulty);
		const scaledEndgameIntensity = endgameIntensity * tuning.aggression;

		return Math.min(
			MAX_ALIEN_BULLET_SPEED,
			(BASE_ALIEN_BULLET_SPEED +
				alienDescents * ALIEN_BULLET_SPEED_DESCENT_BONUS +
				destroyedAliens * ALIEN_BULLET_SPEED_KILL_BONUS +
				scaledEndgameIntensity * ALIEN_BULLET_SPEED_ENDGAME_BONUS) *
				(chaosMode ? 1.25 : 1) *
				tuning.bullet
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

		if (Math.abs(touchSteer) > 0.025) {
			playerX = Math.max(
				0,
				Math.min(GAME_WIDTH - PLAYER_WIDTH, playerX + touchSteer * PLAYER_MOVE_SPEED * (dt / 1000))
			);
		}

		touchFireCooldown -= dt;
		if (touchFirePressed && touchFireCooldown <= 0) {
			shoot();
			touchFireCooldown = GAMEPAD_FIRE_COOLDOWN;
		}

		// Gamepad input
		const gamepads = navigator.getGamepads();
		for (let gi = 0; gi < gamepads.length; gi++) {
			const gp = gamepads[gi];
			if (!gp) continue;

			// Left stick / D-pad horizontal
			const axisX = gp.axes[0];
			if (Math.abs(axisX) > GAMEPAD_DEADZONE) {
				playerX = Math.max(
					0,
					Math.min(GAME_WIDTH - PLAYER_WIDTH, playerX + axisX * PLAYER_MOVE_SPEED * (dt / 1000))
				);
			}

			// D-pad horizontal (buttons 14=left, 15=right)
			if (gp.buttons[14]?.pressed) {
				playerX = Math.max(0, playerX - PLAYER_MOVE_SPEED * (dt / 1000));
			}
			if (gp.buttons[15]?.pressed) {
				playerX = Math.min(GAME_WIDTH - PLAYER_WIDTH, playerX + PLAYER_MOVE_SPEED * (dt / 1000));
			}

			// A button (0) or Right trigger (7) to shoot
			gamepadFireCooldown -= dt;
			if (gamepadFireCooldown <= 0 && (gp.buttons[0]?.pressed || gp.buttons[7]?.pressed)) {
				if (!gameStarted) {
					gameStarted = true;
					running = true;
					requestAnimationFrame(update);
				} else if (!paused && !gameOver && !gameWon) {
					shoot();
				}
				gamepadFireCooldown = GAMEPAD_FIRE_COOLDOWN;
			}

			// Start button (9) to pause
			if (gp.buttons[9]?.pressed && !gamepadStartWasPressed) {
				paused = !paused;
				if (!paused) {
					lastTime = performance.now();
					requestAnimationFrame(update);
				}
				gamepadStartWasPressed = true;
			} else if (!gp.buttons[9]?.pressed) {
				gamepadStartWasPressed = false;
			}
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

		if (gameOver || gameWon) {
			if (score > highScore) {
				highScore = score;
				localStorage.setItem('space-chaos-high-score', String(highScore));
			}
			hasActiveRun = false;
			gameStarted = false;
			running = false;
			paused = false;
			clearTransientControls();
			stopUfoHum();
			return;
		}

		requestAnimationFrame(update);
	}

	$effect(() => {
		if (!menuScreen) return;

		const focusFirst = () => {
			const firstButton = document.querySelector(MENU_BUTTON_SELECTOR) as HTMLElement | null;
			if (!firstButton) return false;
			firstButton.focus();
			return true;
		};

		if (focusFirst()) return;

		const retryTimer = setTimeout(focusFirst, 50);
		const fallbackTimer = setTimeout(focusFirst, 250);

		return () => {
			clearTimeout(retryTimer);
			clearTimeout(fallbackTimer);
		};
	});

	onMount(() => {
		initGame();
		touchCapable = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

		const gamepadPoll = setInterval(() => {
			pollGamepadMenuInput();
		}, 100);

		return () => {
			running = false;
			clearTransientControls();
			clearInterval(gamepadPoll);
			stopUfoHum();
			if (audioCtx) {
				audioCtx.close();
				audioCtx = null;
			}
		};
	});
</script>

<svelte:head>
	<title>Space Chaos | Infinite Arcade Shooter</title>
	<meta name="description" content="Defend the galaxy in Space Chaos! A high-intensity retro space shooter. Destroy the aliens, hide behind shields, and climb the leaderboard." />
	<meta property="og:title" content="Space Chaos - Galaxy Defender" />
	<meta property="og:description" content="The aliens are coming! Can you survive the onslaught in this neon-infused space arcade game?" />
</svelte:head>

<svelte:window
	bind:innerWidth={viewportWidth}
	onkeydown={handleKeydown}
	onkeyup={handleKeyup}
	onblur={clearMovement}
/>

<div class="relative flex min-h-screen flex-col items-center justify-center gap-2 overflow-hidden bg-purple-900 px-1 py-1 font-mono text-white sm:gap-4 sm:px-6 sm:py-8">
	{#if splashScreen}
		<div class="flex min-h-[calc(100vh-2rem)] items-center justify-center">
			<div class="w-full max-w-5xl border-4 border-black bg-white p-3 text-black shadow-[4px_4px_0_rgba(0,0,0,1)] sm:p-10 sm:shadow-[14px_14px_0_rgba(0,0,0,1)]">
				<div class="mb-3 text-center sm:mb-8">
					<div class="mb-1 text-[0.6rem] font-black tracking-[0.45em] uppercase text-black/60 sm:mb-3 sm:text-sm">Game Chaos</div>
					<h1 class="text-3xl leading-none font-black uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:text-7xl sm:drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">
						🛸 Space Chaos 🛸
					</h1>
					<p class="mt-1 text-sm font-bold uppercase sm:mt-4 sm:text-2xl">Defend the line. Shred the swarm.</p>
				</div>

				<div class="grid gap-3 sm:gap-4 sm:grid-cols-[1.1fr_0.9fr]">
					<div class="border-4 border-black bg-fuchsia-200 p-2 text-[0.65rem] font-bold leading-relaxed uppercase sm:p-5 sm:text-base">
						Move with arrows / WASD. Space / Up to shoot.
						<span class="mt-1 block text-black/70 sm:mt-4">
							A / Enter = select • B / Esc = return.
						</span>
					</div>

					<div class="border-4 border-black bg-black p-2 text-fuchsia-400 sm:p-5">
						<div class="flex items-center justify-between sm:block">
							<div class="text-[0.6rem] font-black tracking-[0.35em] uppercase text-fuchsia-400/70 sm:text-xs">Score Board</div>
							<div class="flex items-baseline gap-2 sm:mt-4 sm:block">
								<div class="text-xl font-black sm:text-5xl">{highScore}</div>
								<div class="text-xs font-bold uppercase sm:mt-2 sm:text-lg">Hi-Score</div>
							</div>
						</div>
					</div>
				</div>

				<div class="mt-2 border-4 border-black bg-white p-2 sm:mt-8 sm:p-5">
					<div class="mb-2 text-[0.6rem] font-black tracking-[0.3em] uppercase text-black/60 sm:mb-3 sm:text-sm">Difficulty</div>
					<div class="grid grid-cols-3 gap-2 sm:gap-3">
						{#each DIFFICULTY_OPTIONS as level (level)}
							<button
								type="button"
								data-menu-button
								onclick={() => selectDifficulty(level)}
								aria-pressed={selectedDifficulty === level}
								class={[
									'border-4 px-2 py-1 text-[0.65rem] font-black uppercase transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-95 sm:px-3 sm:py-2 sm:text-base',
									selectedDifficulty === level
										? 'scale-105 border-fuchsia-500 bg-fuchsia-400 text-black'
										: 'border-black bg-white text-black hover:scale-105 hover:border-fuchsia-300 hover:text-fuchsia-600 focus:scale-105 focus:border-fuchsia-300 focus:text-fuchsia-600',
									hasActiveRun && level !== difficulty && 'opacity-80'
								]}
							>
								{getDifficultyLabel(level)}
							</button>
						{/each}
					</div>
				</div>

				<div class="mt-2 flex flex-col gap-2 sm:mt-8 sm:gap-4">
					{#if hasActiveRun}
						<button
							data-menu-button
							onclick={continueGame}
							class="border-2 border-fuchsia-400 bg-black px-4 py-2 text-base font-black text-fuchsia-400 uppercase transition-all hover:scale-[1.02] hover:bg-fuchsia-400 hover:text-black focus:scale-[1.02] focus:bg-fuchsia-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-5 sm:text-3xl sm:focus-visible:ring-offset-4"
						>
							Continue
						</button>
						<button
							data-menu-button
							onclick={() => startGame()}
							class="border-2 border-black bg-white px-4 py-2 text-base font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-4 sm:text-2xl sm:focus-visible:ring-offset-4"
						>
							New Game
						</button>
					{:else}
						<button
							data-menu-button
							onclick={() => startGame()}
							class="border-2 border-fuchsia-400 bg-black px-4 py-2 text-base font-black text-fuchsia-400 uppercase transition-all hover:scale-[1.02] hover:bg-fuchsia-400 hover:text-black focus:scale-[1.02] focus:bg-fuchsia-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-5 sm:text-3xl sm:focus-visible:ring-offset-4"
						>
							Press Start
						</button>
					{/if}
					<button
						data-menu-button
						onclick={backToDashboard}
						class="border-2 border-black bg-white px-4 py-2 text-base font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-4 sm:text-2xl sm:focus-visible:ring-offset-4"
					>
						Dashboard
					</button>
				</div>
			</div>
		</div>
	{:else}
		{#if !menuScreen}
				<div class="mb-4 text-center sm:mb-8">
					<h1 class="hidden animate-pulse text-6xl font-black tracking-tighter text-green-400 uppercase drop-shadow-[4px_4px_0_rgba(0,0,0,1)] sm:block">
						SPACE CHAOS
					</h1>
				</div>
			{/if}

	<div class="relative" style:width={`${scaledGameWidth}px`} style:height={`${scaledGameHeight}px`}>
		<div
			class="absolute top-0 left-0 origin-top-left overflow-hidden border-0 bg-black shadow-none sm:border-8 sm:border-black sm:shadow-[20px_20px_0_rgba(0,0,0,1)]"
			style:width={`${GAME_WIDTH}px`}
			style:height={`${GAME_HEIGHT}px`}
			style:transform={`scale(${gameScale})`}
		>
			<!-- Score & Stats -->
			<div
				class="score-hud absolute top-3 right-0 left-0 z-20 flex items-center justify-between px-6"
			>
				<div class="flex items-center gap-8">
					<div class="flex items-center gap-2">
						<span class="score-label">SCORE:</span>
						<span class="score-value">{score}</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="score-label">HIGH SCORE:</span>
						<span class="score-value">{highScore}</span>
					</div>
				</div>
				{#if chaosMode}
					<span
						class="animate-bounce border-2 border-red-500 bg-red-600 px-3 py-1 text-sm font-black tracking-widest text-white uppercase"
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
						<rect x="0" y="12" width="50" height="8" fill="#4ade80" />
						<rect x="21" y="4" width="8" height="10" fill="#4ade80" />
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
					class="absolute"
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
			{#if splashScreen}
				<div
					class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 px-2 sm:px-4"
				>
					<div class="mb-2 flex gap-3 sm:mb-6 sm:gap-8">
						<svg
							width="24"
							height="18"
							viewBox="0 0 40 30"
							class="animate-bounce text-green-400 sm:w-[40px] sm:h-[30px]"
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
							width="24"
							height="18"
							viewBox="0 0 40 30"
							class="animate-bounce text-green-400 sm:w-[40px] sm:h-[30px]"
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
							width="24"
							height="18"
							viewBox="0 0 40 30"
							class="animate-bounce text-green-400 sm:w-[40px] sm:h-[30px]"
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
						class="mb-1 text-2xl font-black tracking-tighter text-green-400 uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:mb-2 sm:text-6xl sm:drop-shadow-[3px_3px_0_rgba(0,0,0,1)]"
					>
						SPACE CHAOS
					</h2>
					<div
						class="mb-2 max-w-xl border-4 border-green-400 bg-black p-2 text-center text-[0.65rem] leading-relaxed text-white shadow-[4px_4px_0_rgba(74,222,128,1)] sm:mb-6 sm:p-3 sm:text-base"
					>
						DEFEND THE LINE. SHRED THE SWARM.<br />
						<span class="mt-1 block text-white/70">
							A / Enter = Select • B / Esc = Return
						</span>
					</div>

					<div class="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
						<button
							data-menu-button
							onclick={continueGame}
							disabled={!hasActiveRun}
							class={[
								'border-4 px-4 py-1.5 text-base font-black uppercase transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-95 sm:px-8 sm:py-2 sm:text-2xl',
								hasActiveRun
									? 'border-yellow-400 bg-black text-yellow-400 hover:scale-110 hover:bg-yellow-400 hover:text-black focus:scale-110 focus:bg-yellow-400 focus:text-black'
									: 'cursor-not-allowed border-gray-600 bg-gray-900 text-gray-600 opacity-50'
							]}
						>
							CONTINUE
						</button>

						<button
							data-menu-button
							onclick={() => startGame()}
							class="border-4 border-white bg-black px-4 py-1.5 text-base font-black text-white uppercase transition-all hover:scale-110 hover:bg-white hover:text-black focus:scale-110 focus:bg-white focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-95 sm:px-8 sm:py-2 sm:text-2xl"
						>
							NEW GAME
						</button>

						<button
							data-menu-button
							onclick={backToDashboard}
							class="border-4 border-white bg-black px-4 py-1.5 text-base font-black text-white uppercase transition-all hover:scale-110 hover:bg-white hover:text-black focus:scale-110 focus:bg-white focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-95 sm:px-8 sm:py-2 sm:text-2xl"
						>
							DASHBOARD
						</button>
					</div>

					<div class="mt-2 w-full max-w-xs border-4 border-pink-400 bg-black p-2 text-center shadow-[4px_4px_0_rgba(244,114,182,1)] sm:mt-6 sm:p-3 sm:max-w-md">
						<div class="text-[0.6rem] font-black tracking-[0.35em] text-pink-300 uppercase sm:text-xs">
							Difficulty
						</div>
						<div class="mt-1 grid grid-cols-3 gap-2 sm:mt-3 sm:gap-3">
							{#each DIFFICULTY_OPTIONS as level (level)}
								<button
									type="button"
									data-menu-button
									onclick={() => selectDifficulty(level)}
									aria-pressed={selectedDifficulty === level}
									class={[
										'border-4 px-2 py-1 text-[0.65rem] font-black uppercase transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-95 sm:px-3 sm:py-2 sm:text-base',
										selectedDifficulty === level
											? 'scale-105 border-pink-400 bg-pink-400 text-black'
											: 'border-white bg-black text-white hover:scale-105 hover:border-pink-300 hover:text-pink-200 focus:scale-105 focus:border-pink-300 focus:text-pink-200',
										hasActiveRun && level !== difficulty && 'opacity-80'
									]}
								>
									{getDifficultyLabel(level)}
								</button>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			{#if paused}
				<div
					class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90"
				>
					<h2
						class="mb-4 text-5xl font-black tracking-tighter text-yellow-400 uppercase drop-shadow-[3px_3px_0_rgba(0,0,0,1)] sm:mb-6 sm:text-7xl"
					>
						PAUSED
					</h2>
					<p class="text-center text-sm font-bold text-white sm:text-xl">P to resume • ESC / B to splash</p>
				</div>
			{/if}

		</div>
	</div>

	{#if endScreen}
		<div class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-purple-900/95">
			<div class="w-full max-w-5xl border-4 border-black bg-white p-3 text-black shadow-[4px_4px_0_rgba(0,0,0,1)] sm:p-10 sm:shadow-[14px_14px_0_rgba(0,0,0,1)]">
				<div class="mb-3 text-center sm:mb-8">
					<div class="mb-1 text-[0.6rem] font-black tracking-[0.45em] uppercase text-black/60 sm:mb-3 sm:text-sm">Game Chaos</div>
					<h1 class="text-3xl leading-none font-black uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:text-7xl sm:drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">
						🛸 Space Chaos 🛸
					</h1>
					<p class="mt-1 text-sm font-bold uppercase sm:mt-4 sm:text-2xl">
						{gameWon ? 'Galaxy secured.' : 'The swarm prevails.'}
					</p>
				</div>

				<div class="grid gap-3 sm:gap-4 sm:grid-cols-[1.1fr_0.9fr]">
					<div class="border-4 border-black {gameWon ? 'bg-green-200' : 'bg-red-200'} p-2 text-[0.65rem] font-bold leading-relaxed uppercase sm:p-5 sm:text-base">
						{gameWon ? 'All enemies destroyed. Earth is safe... for now.' : 'Your ship was destroyed. The invasion continues.'}<br />
						<span class="mt-1 block text-black/70 sm:mt-4">
							Difficulty: {getDifficultyLabel(difficulty)}
						</span>
					</div>

					<div class="border-4 border-black bg-black p-2 {gameWon ? 'text-green-400' : 'text-red-400'} sm:p-5">
						<div class="flex items-center justify-between sm:block">
							<div class="text-[0.6rem] font-black tracking-[0.35em] uppercase {gameWon ? 'text-green-400/70' : 'text-red-400/70'} sm:text-xs">Final Score</div>
							<div class="flex items-baseline gap-2 sm:mt-4 sm:block">
								<div class="text-xl font-black sm:text-5xl">{score}</div>
								<div class="text-xs font-bold uppercase sm:mt-2 sm:text-lg">{score >= highScore && score > 0 ? 'NEW HIGH SCORE' : 'Points'}</div>
							</div>
						</div>
					</div>
				</div>

				<div class="mt-2 flex flex-col gap-2 sm:mt-8 sm:gap-4">
					<button
						data-menu-button
						onclick={retryGame}
						class="border-4 border-black bg-black px-4 py-2 text-base font-black {gameWon ? 'text-green-400' : 'text-red-400'} uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] transition-all hover:scale-110 hover:bg-white hover:shadow-none focus:scale-110 focus:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black active:translate-y-1 sm:px-8 sm:py-5 sm:text-3xl"
					>
						Retry 🔄
					</button>
					<button
						data-menu-button
						onclick={() => returnToSplash(false)}
						class="border-4 border-black bg-white px-4 py-2 text-base font-black text-black uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] transition-all hover:scale-110 hover:bg-black hover:text-white hover:shadow-none focus:scale-110 focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-{gameWon ? 'green' : 'red'}-400 focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-95 sm:px-8 sm:py-4 sm:text-2xl"
					>
						Back to Splash
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if showTouchControls}
		<div class="w-full max-w-xl px-2 text-white">
			<div class="mb-2 text-xs font-black tracking-[0.35em] text-white/60">TOUCH CONTROLS</div>
			<div class="flex items-end gap-3">
				<div class="flex-1">
					<div
						class="relative h-24 touch-none border-4 border-white bg-black/75 px-4 py-3 select-none"
						role="slider"
						tabindex="0"
						aria-label="Touch steering"
						aria-valuemin={-100}
						aria-valuemax={100}
						aria-valuenow={Math.round(touchSteer * 100)}
						onpointerdown={handleSteerPointerDown}
						onpointermove={handleSteerPointerMove}
						onpointerup={clearTouchSteer}
						onpointercancel={clearTouchSteer}
						onpointerleave={clearTouchSteer}
					>
						<div class="flex h-full items-center justify-between text-3xl font-black text-white/35">
							<span>←</span>
							<span>→</span>
						</div>
						<div class="absolute top-1/2 right-4 left-4 h-1 -translate-y-1/2 bg-white/20"></div>
						<div
							class="absolute top-1/2 h-10 w-10 -translate-y-1/2 border-4 border-yellow-400 bg-black"
							style:left={`calc(50% + ${touchSteer * 42}px)`}
							style:transform="translate(-50%, -50%)"
						></div>
					</div>
				</div>

				<div class="flex shrink-0 flex-col gap-3">
					<button
						class={[
							'min-w-28 touch-none border-4 px-5 py-4 text-lg font-black text-white transition-all select-none',
							touchFirePressed
								? 'scale-95 border-yellow-400 bg-yellow-400 text-black'
								: 'border-white bg-black/75'
						]}
						onpointerdown={() => {
							touchFirePressed = true;
							shoot();
							touchFireCooldown = GAMEPAD_FIRE_COOLDOWN;
						}}
						onpointerup={() => (touchFirePressed = false)}
						onpointercancel={() => (touchFirePressed = false)}
						onpointerleave={() => (touchFirePressed = false)}
					>
						FIRE
					</button>
					<button
						class="min-w-28 touch-none border-4 border-white bg-black/75 px-5 py-4 text-lg font-black text-white transition-all select-none active:scale-95"
						onclick={handleReturnAction}
					>
						RETURN
					</button>
				</div>
			</div>
		</div>
	{/if}
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
