<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import { getBooleanCabinetFlow, returnFromCabinet } from '$lib/cabinet-flow';
	import { KEY_SPACE, isArrowKey, normalizeKey } from '$lib/keys';
	import {
		activateFocusedControlItem,
		focusFirstControlItem,
		handleLinearMenuKeydown,
		MENU_BUTTON_SELECTOR,
		moveLinearFocus
	} from '$lib/unified-controls';

	const HIGH_SCORE_KEY = 'breakout-chaos-high-score';
	const GAME_WIDTH = 640;
	const GAME_HEIGHT = 480;
	const PADDLE_HEIGHT = 12;
	const PADDLE_Y = GAME_HEIGHT - PADDLE_HEIGHT - 24;
	const BALL_RADIUS = 6;
	const BRICK_ROWS = 6;
	const BRICK_COLS = 10;
	const BRICK_PADDING = 4;
	const BRICK_OFFSET_TOP = 56;
	const BRICK_OFFSET_LEFT = 16;
	const MAX_LEVEL = 5;
	const STARTING_LIVES = 3;
	const GAMEPAD_DEADZONE = 0.2;
	const LEVEL_CLEAR_MS = 1200;

	const DIFFICULTY_OPTIONS = ['easy', 'normal', 'hard'] as const;
	type Difficulty = (typeof DIFFICULTY_OPTIONS)[number];

	const BRICK_PALETTE = [
		{ color: '#ef4444', points: 60 },
		{ color: '#f97316', points: 50 },
		{ color: '#eab308', points: 40 },
		{ color: '#22c55e', points: 30 },
		{ color: '#3b82f6', points: 20 },
		{ color: '#a855f7', points: 10 }
	] as const;

	type Brick = {
		row: number;
		col: number;
		alive: boolean;
		color: string;
		points: number;
	};

	type SavedRun = {
		difficulty: Difficulty;
		score: number;
		lives: number;
		level: number;
		paddleX: number;
		ballX: number;
		ballY: number;
		ballDx: number;
		ballDy: number;
		waitingToLaunch: boolean;
		bricks: Brick[];
	};

	let audioCtx: AudioContext | null = null;

	function ensureAudioCtx() {
		if (!audioCtx) audioCtx = new AudioContext();
		return audioCtx;
	}

	function playTone(
		freq: number,
		duration: number,
		type: OscillatorType = 'square',
		volume = 0.06
	) {
		const ctx = ensureAudioCtx();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = type;
		osc.frequency.value = freq;
		gain.gain.setValueAtTime(volume, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(ctx.currentTime);
		osc.stop(ctx.currentTime + duration);
	}

	function playPaddleHit() {
		playTone(220, 0.05, 'square', 0.05);
	}

	function playWallHit() {
		playTone(160, 0.04, 'square', 0.03);
	}

	function playBrickHit(points: number) {
		const freq = 280 + Math.min(points, 60) * 4;
		playTone(freq, 0.07, 'square', 0.06);
	}

	function playLaunch() {
		playTone(440, 0.08, 'square', 0.05);
	}

	function playLifeLost() {
		playTone(180, 0.25, 'sawtooth', 0.08);
		setTimeout(() => playTone(120, 0.35, 'sawtooth', 0.08), 180);
	}

	function playLevelClear() {
		playTone(520, 0.1, 'square', 0.07);
		setTimeout(() => playTone(660, 0.1, 'square', 0.07), 90);
		setTimeout(() => playTone(880, 0.18, 'square', 0.08), 180);
	}

	function playWin() {
		playTone(523, 0.12, 'square', 0.08);
		setTimeout(() => playTone(659, 0.12, 'square', 0.08), 120);
		setTimeout(() => playTone(784, 0.12, 'square', 0.08), 240);
		setTimeout(() => playTone(1047, 0.25, 'square', 0.1), 360);
	}

	function playGameOver() {
		playTone(220, 0.3, 'sawtooth', 0.1);
		setTimeout(() => playTone(165, 0.3, 'sawtooth', 0.1), 220);
		setTimeout(() => playTone(110, 0.5, 'sawtooth', 0.12), 440);
	}

	function readHighScore() {
		try {
			const stored = localStorage.getItem(HIGH_SCORE_KEY);
			const parsed = stored ? Number.parseInt(stored, 10) : 0;
			return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
		} catch {
			return 0;
		}
	}

	function recordHighScore(nextScore: number) {
		const current = readHighScore();
		if (nextScore <= current) return current;
		try {
			localStorage.setItem(HIGH_SCORE_KEY, String(Math.trunc(nextScore)));
		} catch {
			// Ignore storage failures.
		}
		return Math.trunc(nextScore);
	}

	function getDifficultyLabel(level: Difficulty) {
		if (level === 'easy') return 'Easy';
		if (level === 'normal') return 'Normal';
		return 'Hard';
	}

	function getPaddleWidth(diff: Difficulty) {
		if (diff === 'easy') return 112;
		if (diff === 'normal') return 88;
		return 68;
	}

	function getBaseBallSpeed(diff: Difficulty) {
		if (diff === 'easy') return 280;
		if (diff === 'normal') return 340;
		return 400;
	}

	function getBallSpeed(level: number, diff: Difficulty) {
		return getBaseBallSpeed(diff) + (level - 1) * 28;
	}

	function normalizeBallVelocity() {
		const target = getBallSpeed(level, difficulty);
		const current = Math.hypot(ballDx, ballDy);
		if (current < 0.001) {
			ballDx = 0;
			ballDy = -target;
			return;
		}

		const scale = target / current;
		ballDx *= scale;
		ballDy *= scale;

		const minVertical = target * 0.22;
		if (Math.abs(ballDy) < minVertical) {
			ballDy = ballDy >= 0 ? minVertical : -minVertical;
			const horizontal = Math.sqrt(Math.max(0, target * target - ballDy * ballDy));
			ballDx = (ballDx >= 0 ? 1 : -1) * horizontal;
		}
	}

	function getBrickWidth() {
		return (
			(GAME_WIDTH - BRICK_OFFSET_LEFT * 2 - BRICK_PADDING * (BRICK_COLS - 1)) / BRICK_COLS
		);
	}

	function getBrickHeight() {
		return 18;
	}

	function createBricks(): Brick[] {
		const bricks: Brick[] = [];
		for (let row = 0; row < BRICK_ROWS; row += 1) {
			for (let col = 0; col < BRICK_COLS; col += 1) {
				const palette = BRICK_PALETTE[row];
				bricks.push({
					row,
					col,
					alive: true,
					color: palette.color,
					points: palette.points
				});
			}
		}
		return bricks;
	}

	function aliveBrickCount(brickList: Brick[]) {
		return brickList.filter((brick) => brick.alive).length;
	}

	function getBrickRect(brick: Brick) {
		const width = getBrickWidth();
		const height = getBrickHeight();
		return {
			x: BRICK_OFFSET_LEFT + brick.col * (width + BRICK_PADDING),
			y: BRICK_OFFSET_TOP + brick.row * (height + BRICK_PADDING),
			width,
			height
		};
	}

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let ctx: CanvasRenderingContext2D | null = null;
	let score = $state(0);
	let highScore = $state(0);
	let lives = $state(STARTING_LIVES);
	let level = $state(1);
	let difficulty = $state<Difficulty>('normal');
	let selectedDifficulty = $state<Difficulty>('normal');
	let paddleX = $state(GAME_WIDTH / 2 - getPaddleWidth('normal') / 2);
	let ballX = $state(GAME_WIDTH / 2);
	let ballY = $state(PADDLE_Y - BALL_RADIUS - 2);
	let ballDx = $state(0);
	let ballDy = $state(0);
	let bricks = $state<Brick[]>([]);
	let waitingToLaunch = $state(true);
	let gameStarted = $state(false);
	let gameOver = $state(false);
	let gameWon = $state(false);
	let paused = $state(false);
	let hasActiveRun = $state(false);
	let helpOpen = $state(false);
	let running = $state(false);
	let showingTransition = $state(false);
	let transitionMessage = $state('');
	let touchCapable = $state(false);
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);
	let dpr = $state(1);
	let pointerActive = $state(false);
	let pointerX = $state(GAME_WIDTH / 2);
	let savedRun = $state<SavedRun | null>(null);
	let gamepadLeftWasPressed = $state(false);
	let gamepadRightWasPressed = $state(false);
	let gamepadSelectWasPressed = $state(false);
	let keysHeld = $state({ left: false, right: false });
	let lastTime = 0;
	let gameLoopFrame: number | null = null;

	let flow = $derived(
		getBooleanCabinetFlow({
			gameStarted,
			ended: gameOver || gameWon,
			transitionActive: showingTransition
		})
	);
	let splashScreen = $derived(flow.splashScreen);
	let endScreen = $derived(flow.endScreen);
	let menuScreen = $derived(flow.menuScreen);
	let paddleWidth = $derived(getPaddleWidth(difficulty));

	let displayW = $derived.by(() => {
		if (!viewportWidth || !viewportHeight) return GAME_WIDTH;
		const isDesktop = viewportWidth >= 640;
		const hPad = isDesktop ? 48 : 12;
		const vChrome = isDesktop ? 140 : 200;
		const byW = viewportWidth - hPad * 2;
		const byH = ((viewportHeight - vChrome) * GAME_WIDTH) / GAME_HEIGHT;
		return Math.floor(Math.max(280, Math.min(GAME_WIDTH, Math.min(byW, byH))));
	});
	let displayH = $derived(Math.round((displayW * GAME_HEIGHT) / GAME_WIDTH));

	function getCanvasContext() {
		if (!canvasEl) return null;
		if (ctx?.canvas !== canvasEl) {
			ctx = canvasEl.getContext('2d');
		}
		return ctx;
	}

	function clampPaddle(nextX: number) {
		return Math.max(0, Math.min(GAME_WIDTH - paddleWidth, nextX));
	}

	function resetBallOnPaddle() {
		ballX = paddleX + paddleWidth / 2;
		ballY = PADDLE_Y - BALL_RADIUS - 2;
		ballDx = 0;
		ballDy = 0;
		waitingToLaunch = true;
	}

	function launchBall() {
		if (!waitingToLaunch || showingTransition) return;
		const speed = getBallSpeed(level, difficulty);
		const angle = ((Math.random() * 0.6 + 0.2) * Math.PI) / 2;
		const direction = Math.random() > 0.5 ? 1 : -1;
		ballDx = Math.cos(angle) * speed * direction;
		ballDy = -Math.sin(angle) * speed;
		waitingToLaunch = false;
		playLaunch();
	}

	function saveCurrentRun() {
		savedRun = {
			difficulty,
			score,
			lives,
			level,
			paddleX,
			ballX,
			ballY,
			ballDx,
			ballDy,
			waitingToLaunch,
			bricks: bricks.map((brick) => ({ ...brick }))
		};
	}

	function restoreSavedRun() {
		if (!savedRun) return false;
		difficulty = savedRun.difficulty;
		selectedDifficulty = savedRun.difficulty;
		score = savedRun.score;
		lives = savedRun.lives;
		level = savedRun.level;
		paddleX = savedRun.paddleX;
		ballX = savedRun.ballX;
		ballY = savedRun.ballY;
		ballDx = savedRun.ballDx;
		ballDy = savedRun.ballDy;
		waitingToLaunch = savedRun.waitingToLaunch;
		bricks = savedRun.bricks.map((brick) => ({ ...brick }));
		return true;
	}

	function initGame() {
		score = 0;
		lives = STARTING_LIVES;
		level = 1;
		gameOver = false;
		gameWon = false;
		showingTransition = false;
		transitionMessage = '';
		hasActiveRun = false;
		gameStarted = false;
		running = false;
		paused = false;
		bricks = createBricks();
		paddleX = GAME_WIDTH / 2 - getPaddleWidth(selectedDifficulty) / 2;
		resetBallOnPaddle();
		savedRun = null;
		highScore = readHighScore();
	}

	async function beginGameplayLoop() {
		await tick();
		if (!running || !canvasEl) return;
		lastTime = performance.now();
		drawBoard();
		queueGameLoop();
	}

	function startGame(nextDifficulty: Difficulty = selectedDifficulty) {
		difficulty = nextDifficulty;
		selectedDifficulty = nextDifficulty;
		initGame();
		difficulty = nextDifficulty;
		selectedDifficulty = nextDifficulty;
		paddleX = GAME_WIDTH / 2 - getPaddleWidth(difficulty) / 2;
		resetBallOnPaddle();
		hasActiveRun = true;
		gameStarted = true;
		running = true;
		paused = false;
		if (audioCtx?.state === 'suspended') audioCtx.resume();
		void beginGameplayLoop();
	}

	function continueGame() {
		if (!hasActiveRun && !restoreSavedRun()) return;
		hasActiveRun = true;
		gameStarted = true;
		running = true;
		paused = false;
		gameOver = false;
		gameWon = false;
		showingTransition = false;
		if (audioCtx?.state === 'suspended') audioCtx.resume();
		void beginGameplayLoop();
	}

	function onGameEnd(won: boolean) {
		highScore = recordHighScore(score);
		hasActiveRun = false;
		running = false;
		paused = false;
		savedRun = null;
		showingTransition = true;
		transitionMessage = won ? '🏆 YOU WIN! 🏆' : '💀 GAME OVER 💀';
		if (won) playWin();
		else playGameOver();
		setTimeout(() => {
			showingTransition = false;
			gameStarted = false;
			gameOver = !won;
			gameWon = won;
		}, 1600);
	}

	function loseLife() {
		lives -= 1;
		playLifeLost();
		if (lives <= 0) {
			onGameEnd(false);
			return;
		}
		paddleX = GAME_WIDTH / 2 - paddleWidth / 2;
		resetBallOnPaddle();
	}

	function advanceLevel() {
		if (level >= MAX_LEVEL) {
			onGameEnd(true);
			return;
		}
		level += 1;
		bricks = createBricks();
		paddleX = GAME_WIDTH / 2 - paddleWidth / 2;
		resetBallOnPaddle();
		showingTransition = true;
		transitionMessage = `Level ${level}`;
		playLevelClear();
		setTimeout(() => {
			showingTransition = false;
		}, LEVEL_CLEAR_MS);
	}

	function backToDashboard() {
		window.location.href = resolve('/');
	}

	function returnToSplash(preserveRun = false) {
		selectedDifficulty = difficulty;
		gameStarted = false;
		paused = false;
		running = false;
		showingTransition = false;
		if (preserveRun) {
			saveCurrentRun();
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

	function selectDifficulty(next: Difficulty) {
		if (hasActiveRun) {
			selectedDifficulty = difficulty;
			return;
		}
		selectedDifficulty = next;
	}

	function movePaddleBy(delta: number) {
		paddleX = clampPaddle(paddleX + delta);
		if (waitingToLaunch) {
			ballX = paddleX + paddleWidth / 2;
		}
	}

	function setPaddleFromPointer(clientX: number, canvasRect: DOMRect) {
		const scale = GAME_WIDTH / canvasRect.width;
		const localX = (clientX - canvasRect.left) * scale;
		paddleX = clampPaddle(localX - paddleWidth / 2);
		if (waitingToLaunch) {
			ballX = paddleX + paddleWidth / 2;
		}
	}

	function circleRectCollision(
		cx: number,
		cy: number,
		radius: number,
		rect: { x: number; y: number; width: number; height: number }
	) {
		const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
		const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
		const dx = cx - closestX;
		const dy = cy - closestY;
		return dx * dx + dy * dy <= radius * radius;
	}

	function resolveWallCollisions() {
		let bounced = false;

		if (ballX - BALL_RADIUS < 0) {
			ballX = BALL_RADIUS;
			ballDx = Math.abs(ballDx);
			bounced = true;
		} else if (ballX + BALL_RADIUS > GAME_WIDTH) {
			ballX = GAME_WIDTH - BALL_RADIUS;
			ballDx = -Math.abs(ballDx);
			bounced = true;
		}

		if (ballY - BALL_RADIUS < 0) {
			ballY = BALL_RADIUS;
			ballDy = Math.abs(ballDy);
			bounced = true;
		}

		if (bounced) {
			normalizeBallVelocity();
			playWallHit();
		}

		return ballY + BALL_RADIUS >= GAME_HEIGHT;
	}

	function resolvePaddleCollision() {
		if (ballDy <= 0) return false;

		const paddleRect = {
			x: paddleX,
			y: PADDLE_Y,
			width: paddleWidth,
			height: PADDLE_HEIGHT
		};

		if (!circleRectCollision(ballX, ballY, BALL_RADIUS, paddleRect)) return false;

		ballY = PADDLE_Y - BALL_RADIUS - 1;
		const hitPos = (ballX - paddleX) / paddleWidth;
		const clampedHit = Math.max(0.05, Math.min(0.95, hitPos));
		const angle = (clampedHit - 0.5) * Math.PI * 0.85;
		const speed = getBallSpeed(level, difficulty);
		ballDx = Math.sin(angle) * speed;
		ballDy = -Math.abs(Math.cos(angle) * speed);
		normalizeBallVelocity();
		playPaddleHit();
		return true;
	}

	function resolveBrickCollision() {
		for (const brick of bricks) {
			if (!brick.alive) continue;

			const rect = getBrickRect(brick);
			const closestX = Math.max(rect.x, Math.min(ballX, rect.x + rect.width));
			const closestY = Math.max(rect.y, Math.min(ballY, rect.y + rect.height));
			const dx = ballX - closestX;
			const dy = ballY - closestY;
			const distSq = dx * dx + dy * dy;
			if (distSq > BALL_RADIUS * BALL_RADIUS) continue;

			const dist = Math.sqrt(distSq) || 0.001;
			const overlap = BALL_RADIUS - dist + 0.5;
			const nx = dx / dist;
			const ny = dy / dist;

			ballX += nx * overlap;
			ballY += ny * overlap;

			const dot = ballDx * nx + ballDy * ny;
			if (dot < 0) {
				ballDx -= 2 * dot * nx;
				ballDy -= 2 * dot * ny;
			}

			brick.alive = false;
			score += brick.points;
			playBrickHit(brick.points);
			normalizeBallVelocity();

			if (aliveBrickCount(bricks) === 0) {
				advanceLevel();
			}

			return true;
		}

		return false;
	}

	function moveBall(dtSeconds: number) {
		const speed = Math.hypot(ballDx, ballDy);
		if (speed < 0.001) return;

		const travel = speed * dtSeconds;
		const maxStep = BALL_RADIUS * 0.6;
		const steps = Math.max(1, Math.ceil(travel / maxStep));
		const stepDt = dtSeconds / steps;

		for (let step = 0; step < steps; step += 1) {
			ballX += ballDx * stepDt;
			ballY += ballDy * stepDt;

			if (resolveWallCollisions()) {
				loseLife();
				return;
			}

			if (resolvePaddleCollision()) continue;
			if (resolveBrickCollision()) continue;
		}
	}

	function updateGame(dt: number) {
		if (pointerActive && canvasEl) {
			setPaddleFromPointer(pointerX, canvasEl.getBoundingClientRect());
		}

		const paddleSpeed = 420;
		if (keysHeld.left) movePaddleBy(-paddleSpeed * (dt / 1000));
		if (keysHeld.right) movePaddleBy(paddleSpeed * (dt / 1000));

		if (waitingToLaunch || showingTransition) return;

		moveBall(dt / 1000);
	}

	function drawBoard() {
		const context = getCanvasContext();
		if (!context || context.canvas.width === 0 || context.canvas.height === 0) return;

		context.setTransform(1, 0, 0, 1, 0, 0);
		context.imageSmoothingEnabled = false;
		context.clearRect(0, 0, context.canvas.width, context.canvas.height);

		const sx = context.canvas.width / GAME_WIDTH;
		const sy = context.canvas.height / GAME_HEIGHT;
		context.setTransform(sx, 0, 0, sy, 0, 0);

		context.fillStyle = '#18181b';
		context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

		for (const brick of bricks) {
			if (!brick.alive) continue;
			const rect = getBrickRect(brick);
			context.fillStyle = brick.color;
			context.fillRect(rect.x, rect.y, rect.width, rect.height);
			context.fillStyle = 'rgba(255,255,255,0.25)';
			context.fillRect(rect.x + 2, rect.y + 2, rect.width - 4, 4);
			context.strokeStyle = 'rgba(0,0,0,0.45)';
			context.lineWidth = 1;
			context.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
		}

		context.fillStyle = '#f97316';
		context.fillRect(paddleX, PADDLE_Y, paddleWidth, PADDLE_HEIGHT);
		context.fillStyle = 'rgba(255,255,255,0.35)';
		context.fillRect(paddleX + 2, PADDLE_Y + 2, paddleWidth - 4, 3);
		context.strokeStyle = '#000';
		context.strokeRect(paddleX + 0.5, PADDLE_Y + 0.5, paddleWidth - 1, PADDLE_HEIGHT - 1);

		context.fillStyle = '#fde047';
		context.beginPath();
		context.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
		context.fill();
		context.strokeStyle = '#000';
		context.lineWidth = 1;
		context.stroke();

		if (waitingToLaunch && gameStarted && !showingTransition) {
			context.fillStyle = 'rgba(255,255,255,0.75)';
			context.font = 'bold 14px monospace';
			context.textAlign = 'center';
			context.fillText('PRESS SPACE / TAP TO LAUNCH', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40);
		}
	}

	function drawSoon() {
		requestAnimationFrame(drawBoard);
	}

	function queueGameLoop() {
		if (gameLoopFrame !== null) return;
		gameLoopFrame = requestAnimationFrame(gameLoop);
	}

	function gameLoop(time: number) {
		gameLoopFrame = null;
		if (!running) return;

		const dt = Math.min(32, time - lastTime || 16);
		lastTime = time;

		pollGamepad();

		if (!paused && !gameOver && !gameWon && gameStarted && !showingTransition) {
			updateGame(dt);
		}

		drawBoard();

		if (running) {
			queueGameLoop();
		}
	}

	function setKeyHeld(key: string, pressed: boolean) {
		const normalized = normalizeKey(key);
		const arrow = isArrowKey(key);
		if (normalized === 'a' || (arrow && normalized === 'a')) keysHeld.left = pressed;
		if (normalized === 'd' || (arrow && normalized === 'd')) keysHeld.right = pressed;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (
			handleLinearMenuKeydown(event, {
				enabled: menuScreen,
				onBack: handleReturnAction,
				selector: MENU_BUTTON_SELECTOR
			})
		) {
			return;
		}

		if (!gameStarted) return;

		if (event.key === 'p' || event.key === 'P') {
			event.preventDefault();
			paused = !paused;
			if (!paused) void beginGameplayLoop();
			return;
		}

		if (event.key === KEY_SPACE && !waitingToLaunch) {
			event.preventDefault();
			paused = !paused;
			if (!paused) void beginGameplayLoop();
			return;
		}

		if (paused || gameOver || gameWon || showingTransition) return;

		const key = normalizeKey(event.key);
		const arrow = isArrowKey(event.key);

		if (key === 'a' || key === 'A' || (arrow && key === 'a')) {
			event.preventDefault();
			keysHeld.left = true;
		} else if (key === 'd' || key === 'D' || (arrow && key === 'd')) {
			event.preventDefault();
			keysHeld.right = true;
		} else if (event.key === KEY_SPACE || event.key === 'Enter') {
			event.preventDefault();
			if (waitingToLaunch) launchBall();
		}
	}

	function handleKeyup(event: KeyboardEvent) {
		setKeyHeld(event.key, false);
	}

	function pollGamepad() {
		const gamepads = navigator.getGamepads();
		for (let index = 0; index < gamepads.length; index += 1) {
			const gamepad = gamepads[index];
			if (!gamepad) continue;

			const leftPressed = Boolean(
				gamepad.buttons[14]?.pressed || gamepad.axes[0] < -GAMEPAD_DEADZONE
			);
			const rightPressed = Boolean(
				gamepad.buttons[15]?.pressed || gamepad.axes[0] > GAMEPAD_DEADZONE
			);
			const selectPressed = Boolean(gamepad.buttons[0]?.pressed);

			if (menuScreen) {
				if (leftPressed && !gamepadLeftWasPressed) moveLinearFocus(-1, MENU_BUTTON_SELECTOR);
				if (rightPressed && !gamepadRightWasPressed) moveLinearFocus(1, MENU_BUTTON_SELECTOR);
				if (selectPressed && !gamepadSelectWasPressed) {
					activateFocusedControlItem(MENU_BUTTON_SELECTOR);
				}
			} else if (!paused && !gameOver && !gameWon && !showingTransition) {
				if (leftPressed) movePaddleBy(-14);
				if (rightPressed) movePaddleBy(14);
				if (selectPressed && !gamepadSelectWasPressed) launchBall();
			}

			gamepadLeftWasPressed = leftPressed;
			gamepadRightWasPressed = rightPressed;
			gamepadSelectWasPressed = selectPressed;
		}
	}

	function handleCanvasPointerDown(event: PointerEvent) {
		if (!gameStarted || paused || menuScreen) return;
		pointerActive = true;
		pointerX = event.clientX;
		if (canvasEl) {
			setPaddleFromPointer(event.clientX, canvasEl.getBoundingClientRect());
		}
		launchBall();
	}

	function handleCanvasPointerMove(event: PointerEvent) {
		if (!pointerActive || !canvasEl) return;
		pointerX = event.clientX;
		setPaddleFromPointer(event.clientX, canvasEl.getBoundingClientRect());
	}

	function handleCanvasPointerUp() {
		pointerActive = false;
	}

	$effect(() => {
		if (!menuScreen) return;

		const focusFirst = () => focusFirstControlItem(MENU_BUTTON_SELECTOR, true);
		if (focusFirst()) return;

		const retryTimer = setTimeout(focusFirst, 50);
		const fallbackTimer = setTimeout(focusFirst, 250);

		return () => {
			clearTimeout(retryTimer);
			clearTimeout(fallbackTimer);
		};
	});

	$effect(() => {
		displayW;
		displayH;
		dpr;
		if (!canvasEl) return;
		ctx = null;
		drawSoon();
	});

	onMount(() => {
		initGame();
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		touchCapable =
			window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

		const gamepadPoll = setInterval(pollGamepad, 16);

		return () => {
			running = false;
			if (gameLoopFrame !== null) cancelAnimationFrame(gameLoopFrame);
			gameLoopFrame = null;
			clearInterval(gamepadPoll);
			if (audioCtx) {
				audioCtx.close();
				audioCtx = null;
			}
		};
	});
</script>

<svelte:head>
	<title>Breakout Chaos | Brick Smashing Mayhem</title>
	<meta
		name="description"
		content="Smash every brick, survive the bounce, and chase the hi-score in Breakout Chaos."
	/>
	<meta property="og:title" content="Breakout Chaos - Brick Smashing Mayhem" />
	<meta property="og:description" content="Classic brick breaker chaos with retro 8-bit flair." />
</svelte:head>

<svelte:window
	bind:innerWidth={viewportWidth}
	bind:innerHeight={viewportHeight}
	onkeydown={handleKeydown}
	onkeyup={handleKeyup}
	onblur={() => {
		keysHeld.left = false;
		keysHeld.right = false;
	}}
/>

<div
	class="relative flex min-h-screen flex-col items-center justify-start gap-2 overflow-hidden bg-yellow-300 px-1 py-1 font-mono text-black sm:justify-center sm:gap-4 sm:px-6 sm:py-8"
>
	{#if splashScreen}
		<div class="flex min-h-[calc(100vh-2rem)] w-full items-center justify-center">
			<div
				class="w-full max-w-4xl border-4 border-black bg-white shadow-[4px_4px_0_rgba(0,0,0,1)] sm:shadow-[14px_14px_0_rgba(0,0,0,1)]"
			>
				<div class="border-b-4 border-black bg-black px-4 py-3 text-yellow-300 sm:px-8 sm:py-5">
					<div
						class="text-[0.55rem] font-black tracking-[0.4em] uppercase text-yellow-300/50 sm:text-xs"
					>
						Brick Sector
					</div>
					<div class="flex items-center justify-between gap-4">
						<h1
							class="text-xl font-black leading-none uppercase sm:text-5xl sm:drop-shadow-[3px_3px_0_rgba(255,221,0,0.25)]"
						>
							🧱 Breakout Chaos 🧱
						</h1>
						<div class="shrink-0 text-right">
							<div
								class="text-[0.5rem] tracking-widest uppercase text-yellow-300/50 sm:text-[0.6rem]"
							>
								Hi-Score
							</div>
							<div class="text-lg font-black leading-none sm:text-4xl">
								{highScore.toLocaleString()}
							</div>
						</div>
					</div>
					<p class="mt-1 text-[0.65rem] font-bold uppercase text-yellow-300/60 sm:mt-2 sm:text-base">
						Smash bricks. Save the ball. Chase the record.
					</p>
				</div>

				<div class="p-4 sm:p-8">
					<div class="mb-4 grid grid-cols-1 gap-2 sm:mb-6 sm:gap-4">
						<div class="border-2 border-black bg-yellow-100 p-2 sm:border-4 sm:p-4">
							<div
								class="mb-2 text-[0.55rem] font-black tracking-[0.3em] uppercase text-black/50 sm:mb-3 sm:text-xs"
							>
								Difficulty
							</div>
							<div class="grid grid-cols-3 gap-1 sm:gap-2">
								{#each DIFFICULTY_OPTIONS as option (option)}
									<button
										type="button"
										data-menu-button
										onclick={() => selectDifficulty(option)}
										aria-pressed={selectedDifficulty === option}
										class={[
											'border-2 border-black px-1.5 py-1.5 text-xs font-black uppercase transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 sm:border-4 sm:px-3 sm:py-2 sm:text-base',
											selectedDifficulty === option
												? 'bg-black text-yellow-300'
												: 'bg-white text-black hover:bg-black hover:text-white focus:bg-black focus:text-white',
											hasActiveRun && option !== difficulty && 'opacity-80'
										]}
									>
										{getDifficultyLabel(option)}
									</button>
								{/each}
							</div>
						</div>
					</div>

					<div class="mb-4 border-2 border-black sm:mb-6 sm:border-4">
						<button
							type="button"
							onclick={() => (helpOpen = !helpOpen)}
							class="flex w-full items-center justify-between bg-yellow-200 px-3 py-2 text-xs font-black uppercase transition-colors hover:bg-yellow-300 active:scale-[0.98] sm:px-4 sm:py-3 sm:text-sm"
						>
							<span>❓ How to Play</span>
							<span
								class="text-base leading-none transition-transform duration-200"
								class:rotate-180={helpOpen}>▾</span
							>
						</button>
						{#if helpOpen}
							<div
								class="border-t-2 border-black bg-yellow-50 px-3 py-2 text-xs font-bold leading-relaxed uppercase sm:border-t-4 sm:px-4 sm:py-3 sm:text-sm"
							>
								Move the paddle with A/D or arrows. Space launches the ball.<br />
								Clear all bricks to advance. You have {STARTING_LIVES} lives.<br />
								Beat level {MAX_LEVEL} to win the run.<br />
								{#if touchCapable}
									Drag on the playfield to move • Tap to launch.<br />
								{/if}
								<span class="mt-2 block text-[0.6rem] text-black/60 sm:text-xs">
									A / Enter = select • B / Esc = return.
								</span>
							</div>
						{/if}
					</div>

					{#if hasActiveRun}
						<div class="grid grid-cols-2 gap-2 sm:gap-4">
							<button
								data-menu-button
								onclick={continueGame}
								class="border-2 border-yellow-400 bg-black py-3 text-base font-black text-yellow-400 uppercase transition-all hover:bg-yellow-400 hover:text-black focus:bg-yellow-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:py-5 sm:text-2xl"
							>
								Continue
							</button>
							<button
								data-menu-button
								onclick={backToDashboard}
								class="border-2 border-black bg-white py-3 text-base font-black text-black uppercase transition-all hover:bg-black hover:text-white focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:py-5 sm:text-2xl"
							>
								Dashboard
							</button>
						</div>
						<button
							data-menu-button
							onclick={() => startGame()}
							class="mt-2 w-full border-2 border-black bg-white py-2 text-sm font-black text-black uppercase transition-all hover:bg-black hover:text-white focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:py-3 sm:text-base"
						>
							New Game
						</button>
					{:else}
						<div class="grid grid-cols-2 gap-2 sm:gap-4">
							<button
								data-menu-button
								onclick={() => startGame()}
								class="border-2 border-yellow-400 bg-black py-3 text-base font-black text-yellow-400 uppercase transition-all hover:bg-yellow-400 hover:text-black focus:bg-yellow-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:py-5 sm:text-2xl"
							>
								Press Start
							</button>
							<button
								data-menu-button
								onclick={backToDashboard}
								class="border-2 border-black bg-white py-3 text-base font-black text-black uppercase transition-all hover:bg-black hover:text-white focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:py-5 sm:text-2xl"
							>
								Dashboard
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{:else if endScreen}
		<div class="flex min-h-[calc(100vh-2rem)] items-center justify-center">
			<div
				class="w-full max-w-5xl border-4 border-black bg-white p-3 text-black shadow-[4px_4px_0_rgba(0,0,0,1)] sm:p-10 sm:shadow-[14px_14px_0_rgba(0,0,0,1)]"
			>
				<div class="mb-3 text-center sm:mb-8">
					<h1
						class="text-3xl leading-none font-black uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:text-7xl sm:drop-shadow-[4px_4px_0_rgba(0,0,0,1)]"
					>
						{gameWon ? '🏆 YOU WIN! 🏆' : '💀 GAME OVER 💀'}
					</h1>
					<p class="mt-1 text-sm font-bold uppercase sm:mt-4 sm:text-2xl">
						{gameWon ? 'Every brick is dust!' : 'The ball got away!'}
					</p>
				</div>

				<div class="grid gap-3 sm:grid-cols-2 sm:gap-4">
					<div class="border-4 border-black bg-black p-3 text-orange-400 sm:p-5">
						<div
							class="text-[0.6rem] font-black tracking-[0.35em] text-orange-400/70 uppercase sm:text-xs"
						>
							Final Score
						</div>
						<div class="text-3xl font-black sm:text-5xl">{score.toLocaleString()}</div>
						<div class="mt-2 text-xs font-bold text-orange-400/70 uppercase sm:text-sm">
							Level {level} • {lives} Lives Left
						</div>
					</div>
					<div class="border-4 border-black bg-black p-3 text-orange-400 sm:p-5">
						<div
							class="text-[0.6rem] font-black tracking-[0.35em] text-orange-400/70 uppercase sm:text-xs"
						>
							Hi-Score
						</div>
						<div class="text-3xl font-black sm:text-5xl">{highScore.toLocaleString()}</div>
						{#if score >= highScore && score > 0}
							<div
								class="mt-1 animate-pulse text-xs font-black text-yellow-400 uppercase sm:text-sm"
							>
								★ New Record! ★
							</div>
						{/if}
					</div>
				</div>

				<div class="mt-2 flex flex-col gap-2 sm:mt-8 sm:gap-4">
					<button
						data-menu-button
						onclick={() => startGame()}
						class="border-2 border-orange-400 bg-black px-4 py-2 text-base font-black text-orange-400 uppercase transition-all hover:scale-[1.02] hover:bg-orange-400 hover:text-black focus:scale-[1.02] focus:bg-orange-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-5 sm:text-3xl sm:focus-visible:ring-offset-4"
					>
						Retry
					</button>
					<button
						data-menu-button
						onclick={() => returnToSplash(false)}
						class="border-2 border-black bg-white px-4 py-2 text-base font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-4 sm:text-2xl sm:focus-visible:ring-offset-4"
					>
						Splash Screen
					</button>
					<button
						data-menu-button
						onclick={backToDashboard}
						class="border-2 border-black bg-white px-4 py-2 text-base font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-4 sm:text-2xl sm:focus-visible:ring-offset-4"
					>
						Dashboard
					</button>
				</div>
			</div>
		</div>
	{:else}
		<div class="relative mx-auto w-fit">
			{#if showingTransition}
				<div
					class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-[2px]"
				>
					<h2
						class="animate-pulse text-3xl font-black uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:text-6xl sm:drop-shadow-[4px_4px_0_rgba(0,0,0,1)]"
					>
						{transitionMessage}
					</h2>
					{#if !gameOver && !gameWon}
						<p class="mt-2 text-xs font-bold text-white/70 uppercase sm:text-lg">
							{score.toLocaleString()} pts • Level {level}
						</p>
					{/if}
				</div>
			{/if}

			{#if paused}
				<div
					class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-[2px]"
				>
					<h2
						class="text-3xl font-black uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:text-5xl sm:drop-shadow-[4px_4px_0_rgba(0,0,0,1)]"
					>
						⏸ PAUSED ⏸
					</h2>
					<p class="mt-2 text-xs font-bold text-white/70 uppercase sm:text-base">
						Press P to resume • B / Esc to return
					</p>
				</div>
			{/if}

			<div class="flex flex-col items-center gap-2 sm:gap-4">
				<div class="grid w-full grid-cols-4 gap-1 sm:gap-3">
					<div
						class="border-4 border-black bg-black px-2 py-1 text-[0.55rem] font-black tracking-[0.2em] text-orange-400 uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] sm:text-[0.65rem]"
					>
						<span class="text-orange-400/70">Score</span>
						<span class="text-orange-400">{score.toLocaleString()}</span>
					</div>
					<div
						class="border-4 border-black bg-black px-2 py-1 text-[0.55rem] font-black tracking-[0.2em] text-orange-400 uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] sm:text-[0.65rem]"
					>
						<span class="text-orange-400/70">Level</span>
						<span class="text-orange-400">{level}</span>
					</div>
					<div
						class="border-4 border-black bg-black px-2 py-1 text-[0.55rem] font-black tracking-[0.2em] text-orange-400 uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] sm:text-[0.65rem]"
					>
						<span class="text-orange-400/70">Lives</span>
						<span class="text-orange-400">{lives}</span>
					</div>
					<div
						class="border-4 border-black bg-black px-2 py-1 text-[0.55rem] font-black tracking-[0.2em] text-yellow-400 uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] sm:text-[0.65rem]"
					>
						<span class="text-yellow-400/70">Record</span>
						<span class="text-yellow-400">{highScore.toLocaleString()}</span>
					</div>
				</div>

				<div
					class="relative border-4 border-black bg-zinc-900 shadow-[8px_8px_0_rgba(0,0,0,1)]"
					style:width={`${displayW}px`}
					style:height={`${displayH}px`}
				>
					<canvas
						bind:this={canvasEl}
						width={Math.max(1, Math.round(displayW * dpr))}
						height={Math.max(1, Math.round(displayH * dpr))}
						class="block h-full w-full touch-none bg-zinc-900"
						aria-label="Breakout Chaos playfield"
						onpointerdown={handleCanvasPointerDown}
						onpointermove={handleCanvasPointerMove}
						onpointerup={handleCanvasPointerUp}
						onpointercancel={handleCanvasPointerUp}
						onpointerleave={handleCanvasPointerUp}
					></canvas>
				</div>

				<p class="text-[0.6rem] font-bold uppercase text-black/70 sm:text-xs">
					{#if touchCapable}
						Drag or hold arrows • Space to launch/pause • Esc returns to splash
					{:else}
						Hold A/D or arrows • Space to launch/pause • Esc returns to splash
					{/if}
				</p>
			</div>
		</div>
	{/if}
</div>
