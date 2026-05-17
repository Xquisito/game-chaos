<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { getBooleanCabinetFlow, returnFromCabinet } from '$lib/cabinet-flow';
	import { gameCabinetById, readCabinetScore, recordCabinetHighScore } from '$lib/cabinets';
	import { KEY_SPACE, normalizeKey } from '$lib/keys';
	import {
		activateFocusedControlItem,
		focusFirstControlItem,
		handleLinearMenuKeydown,
		MENU_BUTTON_SELECTOR,
		moveLinearFocus
	} from '$lib/unified-controls';

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
	const PLAYER_Y = GAME_HEIGHT - PLAYER_HEIGHT - 20;
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
	const cabinet = gameCabinetById['space-chaos'];
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
	type Alien = { x: number; y: number; alive: boolean; id: number; legFrame: number };
	type Shield = { x: number; y: number; pixels: boolean[][] };

	// State
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let ctx: CanvasRenderingContext2D | null = null;
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
	let aliens = $state<Alien[]>([]);
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
	let shields = $state<Shield[]>([]);

	let flow = $derived(
		getBooleanCabinetFlow({
			gameStarted,
			ended: gameOver || gameWon
		})
	);
	let splashScreen = $derived(flow.splashScreen);
	let endScreen = $derived(flow.endScreen);
	let menuScreen = $derived(flow.menuScreen);
	let lifeSlots = $derived(Array.from({ length: lives }, (_, index) => index));
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
	type PixelRect = readonly [number, number, number, number];

	const SQUID_BASE_RECTS: PixelRect[] = [
		[8, 0, 24, 4],
		[4, 4, 32, 4],
		[4, 8, 8, 4],
		[12, 8, 16, 4],
		[28, 8, 8, 4],
		[4, 12, 4, 4],
		[12, 12, 4, 4],
		[24, 12, 4, 4],
		[32, 12, 4, 4],
		[16, 20, 8, 4]
	];
	const SQUID_LEG_RECTS: [PixelRect[], PixelRect[]] = [
		[
			[10, 24, 4, 4],
			[26, 24, 4, 4]
		],
		[
			[14, 24, 4, 4],
			[22, 24, 4, 4]
		]
	];
	const CRAB_BASE_RECTS: PixelRect[] = [
		[12, 0, 16, 4],
		[8, 4, 24, 4],
		[4, 8, 32, 4],
		[4, 12, 8, 4],
		[12, 12, 4, 4],
		[24, 12, 4, 4],
		[28, 12, 8, 4],
		[12, 16, 16, 4],
		[8, 20, 4, 4],
		[28, 20, 4, 4],
		[8, 0, 4, 4],
		[28, 0, 4, 4]
	];
	const CRAB_LEG_RECTS: [PixelRect[], PixelRect[]] = [
		[
			[8, 24, 4, 4],
			[28, 24, 4, 4]
		],
		[
			[12, 24, 4, 4],
			[24, 24, 4, 4]
		]
	];
	const OCTOPUS_BASE_RECTS: PixelRect[] = [
		[12, 0, 16, 4],
		[8, 4, 24, 4],
		[4, 8, 32, 4],
		[4, 12, 8, 4],
		[16, 12, 8, 4],
		[28, 12, 8, 4],
		[12, 16, 16, 4]
	];
	const OCTOPUS_TENTACLE_RECTS: [PixelRect[], PixelRect[]] = [
		[
			[8, 20, 4, 4],
			[16, 20, 4, 4],
			[24, 20, 4, 4],
			[12, 24, 4, 4],
			[24, 24, 4, 4]
		],
		[
			[4, 20, 4, 4],
			[20, 20, 4, 4],
			[28, 20, 4, 4],
			[16, 24, 4, 4],
			[20, 24, 4, 4]
		]
	];
	const ALIEN_EYE_RECTS: PixelRect[] = [
		[12, 16, 4, 4],
		[24, 16, 4, 4]
	];
	const STAR_DOTS = Array.from({ length: 64 }, (_, index) => ({
		x: (index * 113) % GAME_WIDTH,
		y: 68 + ((index * 71) % (GAME_HEIGHT - 128)),
		size: index % 7 === 0 ? 2 : 1,
		alpha: 0.2 + ((index * 17) % 45) / 100
	}));

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

		highScore = readCabinetScore(localStorage, cabinet);

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
		returnFromCabinet(flow, {
			toDashboard: backToDashboard,
			toSplash: returnToSplash
		});
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
				moveLinearFocus(-1, MENU_BUTTON_SELECTOR);
			}

			if (positivePressed && !gamepadMenuPrevPositive) {
				moveLinearFocus(1, MENU_BUTTON_SELECTOR);
			}

			if (selectPressed && !gamepadSelectWasPressed) {
				activateFocusedControlItem(MENU_BUTTON_SELECTOR);
			}
		}

		gamepadSelectWasPressed = selectPressed;
		gamepadBackWasPressed = backPressed;
		gamepadMenuPrevNegative = negativePressed;
		gamepadMenuPrevPositive = positivePressed;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (
			handleLinearMenuKeydown(e, {
				enabled: menuScreen,
				onBack: handleReturnAction,
				selector: MENU_BUTTON_SELECTOR
			})
		)
			return;

		const key = normalizeKey(e.key);

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

		if (
			key === 'a' ||
			key === 'A' ||
			key === 'd' ||
			key === 'D' ||
			e.key === KEY_SPACE ||
			key === 'w' ||
			key === 'W'
		) {
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
			y: PLAYER_Y - 16,
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

	function fireAlienShot(aliveAliens: typeof aliens, bulletSpeed: number) {
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

	function drawRectPattern(
		context: CanvasRenderingContext2D,
		originX: number,
		originY: number,
		rects: PixelRect[],
		color: string
	) {
		context.fillStyle = color;
		for (const [x, y, width, height] of rects) {
			context.fillRect(originX + x, originY + y, width, height);
		}
	}

	function drawPlayfieldBackdrop(context: CanvasRenderingContext2D, now: number) {
		context.fillStyle = '#000000';
		context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

		for (const dot of STAR_DOTS) {
			const pulse = Math.sin(now / 500 + dot.x * 0.04) * 0.08;
			context.globalAlpha = Math.max(0.12, Math.min(0.7, dot.alpha + pulse));
			context.fillStyle = '#c4b5fd';
			context.fillRect(dot.x, dot.y, dot.size, dot.size);
		}

		context.globalAlpha = 1;
		context.fillStyle = 'rgba(74, 222, 128, 0.16)';
		context.fillRect(0, PLAYER_Y + PLAYER_HEIGHT + 6, GAME_WIDTH, 2);
	}

	function drawAlien(context: CanvasRenderingContext2D, alien: Alien) {
		const frame = alien.legFrame === 0 ? 0 : 1;
		context.save();
		context.shadowColor = '#4ade80';
		context.shadowBlur = 6;

		if (alien.id < ALIEN_COLS) {
			drawRectPattern(context, alien.x, alien.y, SQUID_BASE_RECTS, '#4ade80');
			drawRectPattern(context, alien.x, alien.y, SQUID_LEG_RECTS[frame], '#4ade80');
		} else if (alien.id < ALIEN_COLS * 2) {
			drawRectPattern(context, alien.x, alien.y, CRAB_BASE_RECTS, '#4ade80');
			drawRectPattern(context, alien.x, alien.y, CRAB_LEG_RECTS[frame], '#4ade80');
		} else {
			drawRectPattern(context, alien.x, alien.y, OCTOPUS_BASE_RECTS, '#4ade80');
			drawRectPattern(context, alien.x, alien.y, OCTOPUS_TENTACLE_RECTS[frame], '#4ade80');
		}

		context.shadowBlur = 0;
		drawRectPattern(context, alien.x, alien.y, ALIEN_EYE_RECTS, '#000000');
		context.restore();
	}

	function drawAliens(context: CanvasRenderingContext2D) {
		for (const alien of aliens) {
			if (alien.alive) {
				drawAlien(context, alien);
			}
		}
	}

	function drawPlayer(context: CanvasRenderingContext2D, now: number) {
		context.save();
		if (playerInvulnerable && Math.floor(now / 120) % 2 === 1) {
			context.globalAlpha = 0.35;
		}

		context.fillStyle = '#4ade80';
		context.shadowColor = '#4ade80';
		context.shadowBlur = 18;
		context.fillRect(playerX, PLAYER_Y, PLAYER_WIDTH, PLAYER_HEIGHT);
		context.fillRect(playerX + PLAYER_WIDTH / 2 - 4, PLAYER_Y - 16, 8, 16);
		context.fillRect(playerX + PLAYER_WIDTH / 2 - 8, PLAYER_Y - 8, 16, 8);
		context.restore();
	}

	function drawShields(context: CanvasRenderingContext2D) {
		context.save();
		context.fillStyle = '#4ade80';
		context.shadowColor = '#4ade80';
		context.shadowBlur = 4;

		for (const shield of shields) {
			for (let row = 0; row < shield.pixels.length; row += 1) {
				for (let col = 0; col < shield.pixels[row].length; col += 1) {
					if (!shield.pixels[row][col]) continue;

					context.fillRect(
						shield.x + col * SHIELD_CELL_WIDTH,
						shield.y + row * SHIELD_CELL_HEIGHT,
						SHIELD_CELL_WIDTH,
						SHIELD_CELL_HEIGHT
					);
				}
			}
		}

		context.restore();
	}

	function drawBullets(context: CanvasRenderingContext2D) {
		for (const bullet of bullets) {
			context.save();
			context.fillStyle = getBulletColor(bullet.variant);
			context.shadowColor = getBulletColor(bullet.variant);
			context.shadowBlur = bullet.type === 'player' ? 10 : 8;
			context.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
			context.restore();
		}
	}

	function drawUfo(context: CanvasRenderingContext2D, now: number) {
		if (!ufo.active) return;

		const pulse = 0.75 + Math.sin(now / 140) * 0.25;
		context.save();
		context.shadowColor = '#f472b6';
		context.shadowBlur = 10 + pulse * 8;

		context.fillStyle = '#f472b6';
		context.beginPath();
		context.ellipse(ufo.x + 24, UFO_Y + 14, 22, 5, 0, 0, Math.PI * 2);
		context.fill();

		context.fillStyle = '#fb7185';
		context.beginPath();
		context.ellipse(ufo.x + 24, UFO_Y + 10, 10, 6, 0, 0, Math.PI * 2);
		context.fill();

		context.shadowBlur = 0;
		context.fillStyle = '#fde047';
		for (const [x, y] of [
			[18, 10],
			[24, 8],
			[30, 10]
		]) {
			context.beginPath();
			context.arc(ufo.x + x, UFO_Y + y, 2, 0, Math.PI * 2);
			context.fill();
		}

		context.restore();
	}

	function drawPlayerExplosion(context: CanvasRenderingContext2D, now: number) {
		if (!playerExplosion) return;

		const remaining = Math.max(0, playerExplosion.expiresAt - now);
		const progress = 1 - remaining / PLAYER_HIT_ANIMATION_MS;
		const centerX = playerExplosion.x + PLAYER_WIDTH / 2;
		const centerY = playerExplosion.y + 18;

		context.save();
		context.globalAlpha = Math.max(0, 1 - progress);
		context.fillStyle = '#facc15';
		context.shadowColor = '#f87171';
		context.shadowBlur = 20;
		context.beginPath();
		context.arc(centerX, centerY, 10 + progress * 28, 0, Math.PI * 2);
		context.fill();

		context.lineWidth = 4;
		context.strokeStyle = '#facc15';
		context.beginPath();
		context.arc(centerX, centerY, 8 + progress * 42, 0, Math.PI * 2);
		context.stroke();
		context.restore();
	}

	function drawUfoScorePopup(context: CanvasRenderingContext2D, now: number) {
		if (!ufoScorePopup) return;

		const remaining = Math.max(0, ufoScorePopup.expiresAt - now);
		const progress = 1 - remaining / 800;

		context.save();
		context.globalAlpha = Math.max(0, 1 - progress);
		context.font = '900 18px "Courier New", monospace';
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillStyle = '#f472b6';
		context.shadowColor = '#f472b6';
		context.shadowBlur = 8;
		context.fillText(String(ufoScorePopup.score), ufoScorePopup.x, ufoScorePopup.y - progress * 30);
		context.restore();
	}

	function drawSpace(now = performance.now()) {
		if (!ctx || !canvasEl) return;

		ctx.imageSmoothingEnabled = false;
		ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
		drawPlayfieldBackdrop(ctx, now);
		drawUfo(ctx, now);
		drawAliens(ctx);
		drawShields(ctx);
		drawPlayer(ctx, now);
		drawBullets(ctx);
		drawPlayerExplosion(ctx, now);
		drawUfoScorePopup(ctx, now);
	}

	function damageShield(shield: Shield, px: number, py: number) {
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
						if (a.y + ALIEN_HEIGHT > PLAYER_Y) {
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
			const frontlinePressure = fireAlienShot(aliveAliensNow, alienBulletSpeed);
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
					bulletBottom > PLAYER_Y &&
					bulletTop < PLAYER_Y + PLAYER_HEIGHT
				) {
					playerExplosion = {
						x: playerX,
						y: PLAYER_Y - 8,
						id: nextExplosionId++,
						expiresAt: time + PLAYER_HIT_ANIMATION_MS
					};
					bullets.splice(bi, 1);
					playPlayerDeath();

					if (lives <= 1) {
						lives = 0;
						if (score > highScore) {
							highScore = recordCabinetHighScore(localStorage, cabinet, score);
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
				highScore = recordCabinetHighScore(localStorage, cabinet, score);
			}
			gameWon = true;
		}

		if (gameOver || gameWon) {
			drawSpace(time);
			if (score > highScore) {
				highScore = recordCabinetHighScore(localStorage, cabinet, score);
			}
			hasActiveRun = false;
			gameStarted = false;
			running = false;
			paused = false;
			clearTransientControls();
			stopUfoHum();
			return;
		}

		drawSpace(time);
		requestAnimationFrame(update);
	}

	$effect(() => {
		const canvas = canvasEl;
		ctx = canvas?.getContext('2d') ?? null;
		if (ctx) {
			queueMicrotask(() => drawSpace(performance.now()));
		}
	});

	$effect(() => {
		if (!menuScreen) return;

		const focusFirst = () => {
			return focusFirstControlItem(MENU_BUTTON_SELECTOR, true);
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
	<meta
		name="description"
		content="Defend the galaxy in Space Chaos! A high-intensity retro space shooter. Destroy the aliens, hide behind shields, and climb the leaderboard."
	/>
	<meta property="og:title" content="Space Chaos - Galaxy Defender" />
	<meta
		property="og:description"
		content="The aliens are coming! Can you survive the onslaught in this neon-infused space arcade game?"
	/>
</svelte:head>

<svelte:window
	bind:innerWidth={viewportWidth}
	onkeydown={handleKeydown}
	onkeyup={handleKeyup}
	onblur={clearMovement}
/>

<div
	class="relative flex min-h-screen flex-col items-center justify-center gap-2 overflow-hidden bg-purple-900 px-1 py-1 font-mono text-white sm:gap-4 sm:px-6 sm:py-8"
>
	{#if splashScreen}
		<div class="flex min-h-[calc(100vh-2rem)] items-center justify-center">
			<div
				class="w-full max-w-5xl border-4 border-black bg-white p-3 text-black shadow-[4px_4px_0_rgba(0,0,0,1)] sm:p-10 sm:shadow-[14px_14px_0_rgba(0,0,0,1)]"
			>
				<div class="mb-3 text-center sm:mb-8">
					<div
						class="mb-1 text-[0.6rem] font-black tracking-[0.45em] text-black/60 uppercase sm:mb-3 sm:text-sm"
					>
						Game Chaos
					</div>
					<h1
						class="text-3xl leading-none font-black uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:text-7xl sm:drop-shadow-[4px_4px_0_rgba(0,0,0,1)]"
					>
						🛸 Space Chaos 🛸
					</h1>
					<p class="mt-1 text-sm font-bold uppercase sm:mt-4 sm:text-2xl">
						Defend the line. Shred the swarm.
					</p>
				</div>

				<div class="grid gap-3 sm:grid-cols-[1.1fr_0.9fr] sm:gap-4">
					<div
						class="border-4 border-black bg-fuchsia-200 p-2 text-[0.65rem] leading-relaxed font-bold uppercase sm:p-5 sm:text-base"
					>
						Move with arrows / WASD. Space / Up to shoot.
						<span class="mt-1 block text-black/70 sm:mt-4">
							A / Enter = select • B / Esc = return.
						</span>
					</div>

					<div class="border-4 border-black bg-black p-2 text-fuchsia-400 sm:p-5">
						<div class="flex items-center justify-between sm:block">
							<div
								class="text-[0.6rem] font-black tracking-[0.35em] text-fuchsia-400/70 uppercase sm:text-xs"
							>
								Score Board
							</div>
							<div class="flex items-baseline gap-2 sm:mt-4 sm:block">
								<div class="text-xl font-black sm:text-5xl">{highScore}</div>
								<div class="text-xs font-bold uppercase sm:mt-2 sm:text-lg">Hi-Score</div>
							</div>
						</div>
					</div>
				</div>

				<div class="mt-2 border-4 border-black bg-white p-2 sm:mt-8 sm:p-5">
					<div
						class="mb-2 text-[0.6rem] font-black tracking-[0.3em] text-black/60 uppercase sm:mb-3 sm:text-sm"
					>
						Difficulty
					</div>
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
				<h1
					class="hidden animate-pulse text-6xl font-black tracking-tighter text-green-400 uppercase drop-shadow-[4px_4px_0_rgba(0,0,0,1)] sm:block"
				>
					SPACE CHAOS
				</h1>
			</div>
		{/if}

		<div
			class="relative"
			style:width={`${scaledGameWidth}px`}
			style:height={`${scaledGameHeight}px`}
		>
			<div
				class="absolute top-0 left-0 origin-top-left overflow-hidden border-0 bg-black shadow-none sm:border-8 sm:border-black"
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

				<canvas
					bind:this={canvasEl}
					width={GAME_WIDTH}
					height={GAME_HEIGHT}
					class="absolute inset-0 z-0 h-full w-full"
					aria-hidden="true"
				></canvas>

				<!-- Lives -->
				<div class="lives-bar absolute bottom-2 left-4 z-20 flex items-center gap-3">
					{#each lifeSlots as life (life)}
						<svg width="24" height="16" viewBox="0 0 50 20" class="life-cannon">
							<rect x="0" y="12" width="50" height="8" fill="#4ade80" />
							<rect x="21" y="4" width="8" height="10" fill="#4ade80" />
						</svg>
					{/each}
				</div>

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
								class="animate-bounce text-green-400 sm:h-[30px] sm:w-[40px]"
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
								class="animate-bounce text-green-400 sm:h-[30px] sm:w-[40px]"
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
								class="animate-bounce text-green-400 sm:h-[30px] sm:w-[40px]"
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
							<span class="mt-1 block text-white/70"> A / Enter = Select • B / Esc = Return </span>
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

						<div
							class="mt-2 w-full max-w-xs border-4 border-pink-400 bg-black p-2 text-center shadow-[4px_4px_0_rgba(244,114,182,1)] sm:mt-6 sm:max-w-md sm:p-3"
						>
							<div
								class="text-[0.6rem] font-black tracking-[0.35em] text-pink-300 uppercase sm:text-xs"
							>
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
					<div class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90">
						<h2
							class="mb-4 text-5xl font-black tracking-tighter text-yellow-400 uppercase drop-shadow-[3px_3px_0_rgba(0,0,0,1)] sm:mb-6 sm:text-7xl"
						>
							PAUSED
						</h2>
						<p class="text-center text-sm font-bold text-white sm:text-xl">
							P to resume • ESC / B to splash
						</p>
					</div>
				{/if}
			</div>
		</div>

		{#if endScreen}
			<div class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-purple-900/95">
				<div
					class="w-full max-w-5xl border-4 border-black bg-white p-3 text-black shadow-[4px_4px_0_rgba(0,0,0,1)] sm:p-10 sm:shadow-[14px_14px_0_rgba(0,0,0,1)]"
				>
					<div class="mb-3 text-center sm:mb-8">
						<div
							class="mb-1 text-[0.6rem] font-black tracking-[0.45em] text-black/60 uppercase sm:mb-3 sm:text-sm"
						>
							Game Chaos
						</div>
						<h1
							class="text-3xl leading-none font-black uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:text-7xl sm:drop-shadow-[4px_4px_0_rgba(0,0,0,1)]"
						>
							🛸 Space Chaos 🛸
						</h1>
						<p class="mt-1 text-sm font-bold uppercase sm:mt-4 sm:text-2xl">
							{gameWon ? 'Galaxy secured.' : 'The swarm prevails.'}
						</p>
					</div>

					<div class="grid gap-3 sm:grid-cols-[1.1fr_0.9fr] sm:gap-4">
						<div
							class="border-4 border-black {gameWon
								? 'bg-green-200'
								: 'bg-red-200'} p-2 text-[0.65rem] leading-relaxed font-bold uppercase sm:p-5 sm:text-base"
						>
							{gameWon
								? 'All enemies destroyed. Earth is safe... for now.'
								: 'Your ship was destroyed. The invasion continues.'}<br />
							<span class="mt-1 block text-black/70 sm:mt-4">
								Difficulty: {getDifficultyLabel(difficulty)}
							</span>
						</div>

						<div
							class="border-4 border-black bg-black p-2 {gameWon
								? 'text-green-400'
								: 'text-red-400'} sm:p-5"
						>
							<div class="flex items-center justify-between sm:block">
								<div
									class="text-[0.6rem] font-black tracking-[0.35em] uppercase {gameWon
										? 'text-green-400/70'
										: 'text-red-400/70'} sm:text-xs"
								>
									Final Score
								</div>
								<div class="flex items-baseline gap-2 sm:mt-4 sm:block">
									<div class="text-xl font-black sm:text-5xl">{score}</div>
									<div class="text-xs font-bold uppercase sm:mt-2 sm:text-lg">
										{score >= highScore && score > 0 ? 'NEW HIGH SCORE' : 'Points'}
									</div>
								</div>
							</div>
						</div>
					</div>

					<div class="mt-2 flex flex-col gap-2 sm:mt-8 sm:gap-4">
						<button
							data-menu-button
							onclick={retryGame}
							class="border-4 border-black bg-black px-4 py-2 text-base font-black {gameWon
								? 'text-green-400'
								: 'text-red-400'} uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] transition-all hover:scale-110 hover:bg-white hover:shadow-none focus:scale-110 focus:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black active:translate-y-1 sm:px-8 sm:py-5 sm:text-3xl"
						>
							Retry 🔄
						</button>
						<button
							data-menu-button
							onclick={() => returnToSplash(false)}
							class="border-4 border-black bg-white px-4 py-2 text-base font-black text-black uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] transition-all hover:scale-110 hover:bg-black hover:text-white hover:shadow-none focus:scale-110 focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-{gameWon
								? 'green'
								: 'red'}-400 focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-95 sm:px-8 sm:py-4 sm:text-2xl"
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
							<div
								class="flex h-full items-center justify-between text-3xl font-black text-white/35"
							>
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
</style>
