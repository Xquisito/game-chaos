<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { KEY_ESCAPE, KEY_ENTER, KEY_SPACE, isArrowKey, normalizeKey } from '$lib/keys';

	// Audio
	let audioCtx: AudioContext | null = null;

	function ensureAudioCtx() {
		if (!audioCtx) audioCtx = new AudioContext();
		return audioCtx;
	}

	function playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.06) {
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

	function playMoveSound() {
		playTone(180, 0.04);
	}

	function playRotateSound() {
		playTone(300, 0.06);
	}

	function playDropSound() {
		playTone(120, 0.08, 'square', 0.08);
	}

	function playLineClearSound(lines: number) {
		if (lines === 4) {
			playTone(600, 0.15, 'square', 0.1);
			setTimeout(() => playTone(800, 0.15, 'square', 0.1), 80);
			setTimeout(() => playTone(1000, 0.2, 'square', 0.1), 160);
		} else {
			playTone(400 + lines * 100, 0.12, 'square', 0.08);
		}
	}

	function playHardDropSound() {
		playTone(80, 0.12, 'sawtooth', 0.1);
	}

	function playGameOverSound() {
		playTone(200, 0.3, 'sawtooth', 0.1);
		setTimeout(() => playTone(150, 0.3, 'sawtooth', 0.1), 200);
		setTimeout(() => playTone(100, 0.5, 'sawtooth', 0.12), 400);
	}

	function playLockSound() {
		playTone(220, 0.06, 'square', 0.04);
	}

	// Game Constants
	const COLS = 10;
	const ROWS = 20;
	const CELL_SIZE = 28;
	const GAME_WIDTH = COLS * CELL_SIZE;
	const GAME_HEIGHT = ROWS * CELL_SIZE;
	const GAMEPAD_DEADZONE = 0.2;
	const GAMEPAD_ACTION_COOLDOWN = 100;
	const LOCK_DELAY_MS = 500;
	const MAX_LOCK_RESETS = 15;

	const DIFFICULTY_OPTIONS = ['easy', 'normal', 'hard'] as const;
	type Difficulty = 'easy' | 'normal' | 'hard';

	type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

	const PIECE_SHAPES: Record<PieceType, boolean[][][]> = {
		I: [
			[
				[false, false, false, false],
				[true, true, true, true],
				[false, false, false, false],
				[false, false, false, false]
			],
			[
				[false, false, true, false],
				[false, false, true, false],
				[false, false, true, false],
				[false, false, true, false]
			],
			[
				[false, false, false, false],
				[false, false, false, false],
				[true, true, true, true],
				[false, false, false, false]
			],
			[
				[false, true, false, false],
				[false, true, false, false],
				[false, true, false, false],
				[false, true, false, false]
			]
		],
		O: [
			[
				[true, true],
				[true, true]
			],
			[
				[true, true],
				[true, true]
			],
			[
				[true, true],
				[true, true]
			],
			[
				[true, true],
				[true, true]
			]
		],
		T: [
			[
				[false, true, false],
				[true, true, true],
				[false, false, false]
			],
			[
				[false, true, false],
				[false, true, true],
				[false, true, false]
			],
			[
				[false, false, false],
				[true, true, true],
				[false, true, false]
			],
			[
				[false, true, false],
				[true, true, false],
				[false, true, false]
			]
		],
		S: [
			[
				[false, true, true],
				[true, true, false],
				[false, false, false]
			],
			[
				[false, true, false],
				[false, true, true],
				[false, false, true]
			],
			[
				[false, false, false],
				[false, true, true],
				[true, true, false]
			],
			[
				[true, false, false],
				[true, true, false],
				[false, true, false]
			]
		],
		Z: [
			[
				[true, true, false],
				[false, true, true],
				[false, false, false]
			],
			[
				[false, false, true],
				[false, true, true],
				[false, true, false]
			],
			[
				[false, false, false],
				[true, true, false],
				[false, true, true]
			],
			[
				[false, true, false],
				[true, true, false],
				[true, false, false]
			]
		],
		J: [
			[
				[true, false, false],
				[true, true, true],
				[false, false, false]
			],
			[
				[false, true, true],
				[false, true, false],
				[false, true, false]
			],
			[
				[false, false, false],
				[true, true, true],
				[false, false, true]
			],
			[
				[false, true, false],
				[false, true, false],
				[true, true, false]
			]
		],
		L: [
			[
				[false, false, true],
				[true, true, true],
				[false, false, false]
			],
			[
				[false, true, false],
				[false, true, false],
				[false, true, true]
			],
			[
				[false, false, false],
				[true, true, true],
				[true, false, false]
			],
			[
				[true, true, false],
				[false, true, false],
				[false, true, false]
			]
		]
	};

	const PIECE_COLORS: Record<PieceType, string> = {
		I: '#06b6d4',
		O: '#facc15',
		T: '#a855f7',
		S: '#22c55e',
		Z: '#ef4444',
		J: '#3b82f6',
		L: '#f97316'
	};

	const PIECE_COLORS_CLASS: Record<PieceType, string> = {
		I: 'bg-cyan-500',
		O: 'bg-yellow-400',
		T: 'bg-purple-500',
		S: 'bg-green-500',
		Z: 'bg-red-500',
		J: 'bg-blue-500',
		L: 'bg-orange-500'
	};

	type Piece = {
		type: PieceType;
		x: number;
		y: number;
		rotation: number;
	};

	// Difficulty tuning
	function getDropInterval(level: number, diff: Difficulty): number {
		const frames = Math.max(1, 48 - level * 5);
		const baseMs = frames * (1000 / 60);
		if (diff === 'easy') return baseMs * 1.6;
		if (diff === 'normal') return baseMs * 1.2;
		return baseMs;
	}

	function getLevelFromLines(lines: number): number {
		return Math.floor(lines / 10);
	}

	function getScoreForLines(lines: number, level: number): number {
		const multiplier = level + 1;
		if (lines === 1) return 40 * multiplier;
		if (lines === 2) return 100 * multiplier;
		if (lines === 3) return 300 * multiplier;
		if (lines === 4) return 1200 * multiplier;
		return 0;
	}

	function getDifficultyLabel(level: Difficulty) {
		if (level === 'easy') return 'Easy';
		if (level === 'normal') return 'Normal';
		return 'Hard';
	}

	// 7-bag randomizer
	let bag: PieceType[] = [];

	function shuffleArray<T>(arr: T[]): T[] {
		const result = [...arr];
		for (let i = result.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[result[i], result[j]] = [result[j], result[i]];
		}
		return result;
	}

	function nextPieceFromBag(): PieceType {
		if (bag.length === 0) {
			bag = shuffleArray(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);
		}
		return bag.pop()!;
	}

	// State
	let board = $state<(PieceType | null)[][]>([]);
	let currentPiece = $state<Piece | null>(null);
	let nextPieceType = $state<PieceType>('T');
	let holdPieceType = $state<PieceType | null>(null);
	let canHold = $state(true);
	let score = $state(0);
	let level = $state(0);
	let lines = $state(0);
	let highScore = $state(0);
	let difficulty = $state<Difficulty>('easy');
	let selectedDifficulty = $state<Difficulty>('easy');
	let gameOver = $state(false);
	let gameStarted = $state(false);
	let paused = $state(false);
	let hasActiveRun = $state(false);
	let running = $state(false);
	let gameWon = $state(false);
	let showingGameOver = $state(false);
	let lastDropTime = $state(0);
	let lastTime = 0;
	let clearingRows = $state<number[]>([]);
	let clearingTimer = $state(0);
	let touchCapable = $state(false);
	let viewportWidth = $state(0);
	let gamepadLeftWasPressed = $state(false);
	let gamepadRightWasPressed = $state(false);
	let gamepadDownWasPressed = $state(false);
	let gamepadRotateCWWasPressed = $state(false);
	let gamepadRotateCCWWasPressed = $state(false);
	let gamepadDropWasPressed = $state(false);
	let gamepadHoldWasPressed = $state(false);
	let lockResetCount = $state(0);
	let lockTimer = $state(0);
	let isLocking = $state(false);

	const MENU_BUTTON_SELECTOR = '[data-menu-button]:not([disabled])';
	let splashScreen = $derived(!gameStarted && !gameOver && !gameWon && !showingGameOver);
	let endScreen = $derived((gameOver || gameWon) && !showingGameOver);
	let menuScreen = $derived(splashScreen || endScreen);
	let playingScreen = $derived(!splashScreen && !endScreen && !showingGameOver);
	let gameAreaWidth = $derived(GAME_WIDTH + 184);
	let gameScale = $derived(
		viewportWidth > 0 ? Math.min(1, Math.max(0.45, (viewportWidth - 24) / gameAreaWidth)) : 1
	);

	function createEmptyBoard(): (PieceType | null)[][] {
		return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
	}

	function getPaddedShape(type: PieceType, rotation: number): boolean[][] {
		return PIECE_SHAPES[type][rotation % PIECE_SHAPES[type].length];
	}

	function getShapeCells(type: PieceType, rotation: number): { row: number; col: number }[] {
		const shape = getPaddedShape(type, rotation);
		const cells: { row: number; col: number }[] = [];
		for (let r = 0; r < shape.length; r++) {
			for (let c = 0; c < shape[r].length; c++) {
				if (shape[r][c]) {
					cells.push({ row: r, col: c });
				}
			}
		}
		return cells;
	}

	function isValidPosition(piece: Piece, boardState?: (PieceType | null)[][]): boolean {
		const b = boardState ?? board;
		const cells = getShapeCells(piece.type, piece.rotation);
		for (const cell of cells) {
			const r = piece.y + cell.row;
			const c = piece.x + cell.col;
			if (c < 0 || c >= COLS || r >= ROWS) return false;
			if (r >= 0 && b[r][c] !== null) return false;
		}
		return true;
	}

	function spawnPiece(type: PieceType): Piece {
		const shape = getPaddedShape(type, 0);
		const cols = shape[0].length;
		return {
			type,
			x: Math.floor((COLS - cols) / 2),
			y: -1,
			rotation: 0
		};
	}

	function lockPiece(piece: Piece) {
		playLockSound();
		const cells = getShapeCells(piece.type, piece.rotation);
		for (const cell of cells) {
			const r = piece.y + cell.row;
			const c = piece.x + cell.col;
			if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
				board[r][c] = piece.type;
			}
		}
	}

	function getGhostY(piece: Piece): number {
		let ghostY = piece.y;
		while (true) {
			const test = { ...piece, y: ghostY + 1 };
			if (isValidPosition(test)) {
				ghostY++;
			} else {
				break;
			}
		}
		return ghostY;
	}

	function checkLines(): number[] {
		const completed: number[] = [];
		for (let r = 0; r < ROWS; r++) {
			if (board[r].every((cell) => cell !== null)) {
				completed.push(r);
			}
		}
		return completed;
	}

	function clearLines(lineRows: number[]) {
		if (lineRows.length === 0) return;
		const newBoard = board.filter((_, i) => !lineRows.includes(i));
		while (newBoard.length < ROWS) {
			newBoard.unshift(Array(COLS).fill(null));
		}
		board = newBoard;
	}

	function tryRotate(piece: Piece, direction: 1 | -1): Piece | null {
		const newRotation = ((piece.rotation + direction) % 4 + 4) % 4;
		const kicks = [
			{ dx: 0, dy: 0 },
			{ dx: -1, dy: 0 },
			{ dx: 1, dy: 0 },
			{ dx: 0, dy: -1 },
			{ dx: -1, dy: -1 },
			{ dx: 1, dy: -1 },
			{ dx: -2, dy: 0 },
			{ dx: 2, dy: 0 }
		];
		for (const kick of kicks) {
			const test: Piece = {
				...piece,
				rotation: newRotation,
				x: piece.x + kick.dx,
				y: piece.y - kick.dy
			};
			if (isValidPosition(test)) {
				return test;
			}
		}
		return null;
	}

	function holdCurrentPiece() {
		if (!canHold || !currentPiece) return;
		canHold = false;
		const type = currentPiece.type;
		if (holdPieceType !== null) {
			currentPiece = spawnPiece(holdPieceType);
			holdPieceType = type;
		} else {
			holdPieceType = type;
			currentPiece = spawnPiece(nextPieceType);
			nextPieceType = nextPieceFromBag();
		}
		if (!isValidPosition(currentPiece)) {
			gameOver = true;
			onGameEnd();
		}
		resetLock();
	}

	function resetLock() {
		lockResetCount = 0;
		lockTimer = 0;
		isLocking = false;
	}

	function initGame() {
		board = createEmptyBoard();
		score = 0;
		level = 0;
		lines = 0;
		gameOver = false;
		gameWon = false;
		showingGameOver = false;
		hasActiveRun = false;
		gameStarted = false;
		running = false;
		paused = false;
		currentPiece = null;
		bag = [];
		nextPieceType = nextPieceFromBag();
		holdPieceType = null;
		canHold = true;
		clearingRows = [];
		clearingTimer = 0;
		lockResetCount = 0;
		lockTimer = 0;
		isLocking = false;
		const saved = localStorage.getItem('tetris-chaos-high-score');
		if (saved) highScore = parseInt(saved, 10);
	}

	function startGame(nextDifficulty: Difficulty = selectedDifficulty) {
		difficulty = nextDifficulty;
		selectedDifficulty = nextDifficulty;
		bag = [];
		initGame();
		nextPieceType = nextPieceFromBag();
		spawnNext();
		hasActiveRun = true;
		gameStarted = true;
		running = true;
		paused = false;
		lastTime = performance.now();
		lastDropTime = lastTime;
		if (audioCtx?.state === 'suspended') audioCtx.resume();
		requestAnimationFrame(gameLoop);
	}

	function spawnNext() {
		currentPiece = spawnPiece(nextPieceType);
		nextPieceType = nextPieceFromBag();
		canHold = true;
		resetLock();
		if (!isValidPosition(currentPiece)) {
			gameOver = true;
			onGameEnd();
		}
	}

	function onGameEnd() {
		if (score > highScore) {
			highScore = score;
			localStorage.setItem('tetris-chaos-high-score', String(highScore));
		}
		hasActiveRun = false;
		running = false;
		paused = false;
		showingGameOver = true;
		playGameOverSound();
		setTimeout(() => {
			showingGameOver = false;
			gameStarted = false;
		}, 1800);
	}

	function continueGame() {
		if (!hasActiveRun) return;
		selectedDifficulty = difficulty;
		gameStarted = true;
		running = true;
		paused = false;
		lastTime = performance.now();
		lastDropTime = lastTime;
		if (audioCtx?.state === 'suspended') audioCtx.resume();
		requestAnimationFrame(gameLoop);
	}

	function backToDashboard() {
		window.location.href = resolve('/');
	}

	function returnToSplash(preserveRun = false) {
		selectedDifficulty = difficulty;
		gameStarted = false;
		paused = false;
		running = false;
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

	function selectDifficulty(level: Difficulty) {
		if (hasActiveRun) {
			selectedDifficulty = difficulty;
			return;
		}
		selectedDifficulty = level;
	}

	function moveLeft() {
		if (!currentPiece || paused || gameOver) return;
		const test = { ...currentPiece, x: currentPiece.x - 1 };
		if (isValidPosition(test)) {
			currentPiece = test;
			playMoveSound();
			if (isLocking) {
				lockResetCount++;
				lockTimer = 0;
				if (lockResetCount >= MAX_LOCK_RESETS) {
					performLock();
				}
			}
		}
	}

	function moveRight() {
		if (!currentPiece || paused || gameOver) return;
		const test = { ...currentPiece, x: currentPiece.x + 1 };
		if (isValidPosition(test)) {
			currentPiece = test;
			playMoveSound();
			if (isLocking) {
				lockResetCount++;
				lockTimer = 0;
				if (lockResetCount >= MAX_LOCK_RESETS) {
					performLock();
				}
			}
		}
	}

	function rotateCW() {
		if (!currentPiece || paused || gameOver) return;
		const result = tryRotate(currentPiece, 1);
		if (result) {
			currentPiece = result;
			playRotateSound();
			if (isLocking) {
				lockResetCount++;
				lockTimer = 0;
				if (lockResetCount >= MAX_LOCK_RESETS) {
					performLock();
				}
			}
		}
	}

	function rotateCCW() {
		if (!currentPiece || paused || gameOver) return;
		const result = tryRotate(currentPiece, -1);
		if (result) {
			currentPiece = result;
			playRotateSound();
			if (isLocking) {
				lockResetCount++;
				lockTimer = 0;
				if (lockResetCount >= MAX_LOCK_RESETS) {
					performLock();
				}
			}
		}
	}

	function softDrop() {
		if (!currentPiece || paused || gameOver) return;
		const test = { ...currentPiece, y: currentPiece.y + 1 };
		if (isValidPosition(test)) {
			currentPiece = test;
			score += 1;
			lastDropTime = performance.now();
		}
	}

	function hardDrop() {
		if (!currentPiece || paused || gameOver) return;
		const ghostY = getGhostY(currentPiece!);
		const dropDistance = ghostY - currentPiece!.y;
		currentPiece = { ...currentPiece!, y: ghostY };
		score += dropDistance * 2;
		playHardDropSound();
		performLock();
	}

	function performLock() {
		if (!currentPiece) return;
		lockPiece(currentPiece);
		const completed = checkLines();
		if (completed.length > 0) {
			playLineClearSound(completed.length);
			clearingRows = completed;
			clearingTimer = performance.now() + 250;
			const lineScore = getScoreForLines(completed.length, level);
			score += lineScore;
			lines += completed.length;
			level = getLevelFromLines(lines);
		}
		currentPiece = null;
		isLocking = false;
		lockTimer = 0;
		lockResetCount = 0;
		if (clearingRows.length === 0) {
			spawnNext();
		}
	}

	// Touch controls
	let touchAction: 'left' | 'right' | 'down' | 'rotateCW' | 'rotateCCW' | 'drop' | 'hold' | null = null;
	let touchRepeatTimer: ReturnType<typeof setInterval> | null = null;
	let softDropping = $state(false);

	function handleTouchAction(action: string) {
		if (menuScreen) return;
		if (action === 'left') moveLeft();
		else if (action === 'right') moveRight();
		else if (action === 'down') softDrop();
		else if (action === 'rotateCW') rotateCW();
		else if (action === 'rotateCCW') rotateCCW();
		else if (action === 'drop') hardDrop();
		else if (action === 'hold') holdCurrentPiece();
	}

	function startTouchRepeat(action: 'left' | 'right' | 'down') {
		stopTouchRepeat();
		handleTouchAction(action);
		touchRepeatTimer = setInterval(() => handleTouchAction(action), 80);
	}

	function stopTouchRepeat() {
		if (touchRepeatTimer) {
			clearInterval(touchRepeatTimer);
			touchRepeatTimer = null;
		}
		touchAction = null;
	}

	// Keyboard
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === KEY_ESCAPE || e.key === 'b' || e.key === 'B') {
			e.preventDefault();
			handleReturnAction();
			return;
		}

		const key = normalizeKey(e.key);
		const arrow = isArrowKey(e.key);

		if (menuScreen) {
			if (key === 'w' || key === 'W' || (arrow && key === 'a')) {
				e.preventDefault();
				moveFocus(-1);
				return;
			}
			if (key === 's' || key === 'S' || (arrow && key === 'd')) {
				e.preventDefault();
				moveFocus(1);
				return;
			}
			if (e.key === KEY_ENTER || e.key === KEY_SPACE || key === 'a' || key === 'A') {
				e.preventDefault();
				activateFocusedMenuItem();
				return;
			}
		}

		if (!gameStarted) return;

		if (e.key === 'p' || e.key === 'P') {
			e.preventDefault();
			paused = !paused;
			if (!paused) {
				lastTime = performance.now();
				lastDropTime = lastTime;
				requestAnimationFrame(gameLoop);
			}
			return;
		}

		if (paused || gameOver) return;

		if (key === 'a' || key === 'A' || (arrow && key === 'a')) {
			e.preventDefault();
			moveLeft();
		} else if (key === 'd' || key === 'D' || (arrow && key === 'd')) {
			e.preventDefault();
			moveRight();
		} else if (key === 'w' || key === 'W' || e.key === 'ArrowUp') {
			e.preventDefault();
			rotateCW();
		} else if (key === 's' || key === 'S' || e.key === 'ArrowDown') {
			e.preventDefault();
			softDrop();
		} else if (e.key === KEY_SPACE) {
			e.preventDefault();
			hardDrop();
		} else if (e.key === 'c' || e.key === 'C' || e.key === 'Shift') {
			e.preventDefault();
			holdCurrentPiece();
		} else if (e.key === 'z' || e.key === 'Z' || e.key === 'Control') {
			e.preventDefault();
			rotateCCW();
		}
	}

	function handleKeyup(_e: KeyboardEvent) {}

	// Gamepad
	function pollGamepad() {
		const gamepads = navigator.getGamepads();
		for (let gi = 0; gi < gamepads.length; gi++) {
			const gp = gamepads[gi];
			if (!gp) continue;

			const leftPressed = Boolean(gp.buttons[14]?.pressed || gp.axes[0] < -GAMEPAD_DEADZONE);
			const rightPressed = Boolean(gp.buttons[15]?.pressed || gp.axes[0] > GAMEPAD_DEADZONE);
			const downPressed = Boolean(gp.buttons[13]?.pressed || gp.axes[1] > GAMEPAD_DEADZONE);
			const rotateCWPressed = Boolean(gp.buttons[3]?.pressed || gp.buttons[2]?.pressed);
			const rotateCCWPressed = Boolean(gp.buttons[2]?.pressed);
			const dropPressed = Boolean(gp.buttons[0]?.pressed || gp.buttons[7]?.pressed);
			const holdPressed = Boolean(gp.buttons[1]?.pressed || gp.buttons[4]?.pressed);

			if (menuScreen) {
				if (leftPressed && !gamepadLeftWasPressed) moveFocus(-1);
				if (rightPressed && !gamepadRightWasPressed) moveFocus(1);
				if (downPressed && !gamepadDownWasPressed) moveFocus(1);
				if (rotateCWPressed && !gamepadRotateCWWasPressed) activateFocusedMenuItem();
				if (dropPressed && !gamepadDropWasPressed) activateFocusedMenuItem();
			} else if (!paused && !gameOver) {
				if (leftPressed && !gamepadLeftWasPressed) moveLeft();
				if (rightPressed && !gamepadRightWasPressed) moveRight();
				if (downPressed && !gamepadDownWasPressed) softDrop();
				if (rotateCWPressed && !gamepadRotateCWWasPressed) rotateCW();
				if (rotateCCWPressed && !gamepadRotateCCWWasPressed) rotateCCW();
				if (dropPressed && !gamepadDropWasPressed) hardDrop();
				if (holdPressed && !gamepadHoldWasPressed) holdCurrentPiece();
			}

			gamepadLeftWasPressed = leftPressed;
			gamepadRightWasPressed = rightPressed;
			gamepadDownWasPressed = downPressed;
			gamepadRotateCWWasPressed = rotateCWPressed;
			gamepadRotateCCWWasPressed = rotateCCWPressed;
			gamepadDropWasPressed = dropPressed;
			gamepadHoldWasPressed = holdPressed;
		}
	}

	// Menu focus
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

	// Game loop
	function gameLoop(time: number) {
		if (!running || paused || gameOver || gameWon) return;

		const dt = time - lastTime;
		lastTime = time;

		pollGamepad();

		// Handle line clearing animation
		if (clearingRows.length > 0) {
			if (time >= clearingTimer) {
				clearLines(clearingRows);
				clearingRows = [];
				if (currentPiece === null) {
					spawnNext();
				}
			}
			requestAnimationFrame(gameLoop);
			return;
		}

		if (!currentPiece) {
			requestAnimationFrame(gameLoop);
			return;
		}

		// Lock delay logic
		const ghostY = getGhostY(currentPiece);
		const isOnGround = currentPiece.y >= ghostY;

		if (isOnGround) {
			if (!isLocking) {
				isLocking = true;
				lockTimer = 0;
			}
			lockTimer += dt;
			if (lockTimer >= LOCK_DELAY_MS) {
				performLock();
				if (gameOver) return;
				requestAnimationFrame(gameLoop);
				return;
			}
		} else {
			if (isLocking) {
				isLocking = false;
				lockTimer = 0;
			}
		}

		// Gravity
		const dropInterval = getDropInterval(level, difficulty);
		if (time - lastDropTime >= dropInterval) {
			lastDropTime = time;
			const test = { ...currentPiece, y: currentPiece.y + 1 };
			if (isValidPosition(test)) {
				currentPiece = test;
			}
		}

		requestAnimationFrame(gameLoop);
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

		const gamepadPoll = setInterval(pollGamepad, 16);

		return () => {
			running = false;
			stopTouchRepeat();
			clearInterval(gamepadPoll);
			if (audioCtx) {
				audioCtx.close();
				audioCtx = null;
			}
		};
	});

	function getPreviewCells(type: PieceType): boolean[][] {
		const shape = getPaddedShape(type, 0);
		return shape;
	}

	function getCellColor(cell: PieceType | null, isGhost: boolean = false): string {
		if (cell === null) return 'transparent';
		if (isGhost) return PIECE_COLORS[cell] + '40';
		return PIECE_COLORS[cell];
	}
</script>

<svelte:head>
	<title>Tetris Chaos | Block Stacking Mayhem</title>
	<meta name="description" content="Stack, clear, and survive! A chaotic twist on the classic block puzzle." />
	<meta property="og:title" content="Tetris Chaos - Block Stacking Mayhem" />
	<meta property="og:description" content="The blocks are falling! Can you survive the chaos?" />
</svelte:head>

<svelte:window
	bind:innerWidth={viewportWidth}
	onkeydown={handleKeydown}
	onkeyup={handleKeyup}
	onblur={stopTouchRepeat}
/>

<div class="relative flex min-h-screen flex-col items-center justify-center gap-2 overflow-hidden bg-cyan-900 px-1 py-1 font-mono text-white sm:gap-4 sm:px-6 sm:py-8">
	{#if splashScreen}
		<div class="flex min-h-[calc(100vh-2rem)] items-center justify-center">
			<div class="w-full max-w-5xl border-4 border-black bg-white p-3 text-black shadow-[4px_4px_0_rgba(0,0,0,1)] sm:p-10 sm:shadow-[14px_14px_0_rgba(0,0,0,1)]">
				<div class="mb-3 text-center sm:mb-8">
					<div class="mb-1 text-[0.6rem] font-black tracking-[0.45em] uppercase text-black/60 sm:mb-3 sm:text-sm">Game Chaos</div>
					<h1 class="text-3xl leading-none font-black uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:text-7xl sm:drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">
						🧱 Tetris Chaos 🧱
					</h1>
					<p class="mt-1 text-sm font-bold uppercase sm:mt-4 sm:text-2xl">Stack the blocks. Survive the chaos.</p>
				</div>

				<div class="grid gap-3 sm:gap-4 sm:grid-cols-[1.1fr_0.9fr]">
					<div class="border-4 border-black bg-cyan-200 p-2 text-[0.65rem] font-bold leading-relaxed uppercase sm:p-5 sm:text-base">
						Arrow keys / WASD to move. Up / W to rotate. Space to hard drop.
						C to hold piece. Z for counter-clockwise.
						<span class="mt-1 block text-black/70 sm:mt-4">
							A / Enter = select • B / Esc = return
						</span>
						{#if touchCapable}
							<span class="mt-1 block text-black/70 sm:mt-2">
								Touch controls available during gameplay.
							</span>
						{/if}
					</div>

					<div class="border-4 border-black bg-black p-2 text-cyan-400 sm:p-5">
						<div class="flex items-center justify-between sm:block">
							<div class="text-[0.6rem] font-black tracking-[0.35em] uppercase text-cyan-400/70 sm:text-xs">Score Board</div>
							<div class="flex items-baseline gap-2 sm:mt-4 sm:block">
								<div class="text-xl font-black sm:text-5xl">{highScore.toLocaleString()}</div>
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
										? 'scale-105 border-cyan-500 bg-cyan-400 text-black'
										: 'border-black bg-white text-black hover:scale-105 hover:border-cyan-300 hover:text-cyan-600 focus:scale-105 focus:border-cyan-300 focus:text-cyan-600',
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
							class="border-2 border-cyan-400 bg-black px-4 py-2 text-base font-black text-cyan-400 uppercase transition-all hover:scale-[1.02] hover:bg-cyan-400 hover:text-black focus:scale-[1.02] focus:bg-cyan-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-5 sm:text-3xl sm:focus-visible:ring-offset-4"
						>
							Continue
						</button>
						<button
							data-menu-button
							onclick={() => startGame()}
							class="border-2 border-black bg-white px-4 py-2 text-base font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-4 sm:text-2xl sm:focus-visible:ring-offset-4"
						>
							New Game
						</button>
					{:else}
						<button
							data-menu-button
							onclick={() => startGame()}
							class="border-2 border-cyan-400 bg-black px-4 py-2 text-base font-black text-cyan-400 uppercase transition-all hover:scale-[1.02] hover:bg-cyan-400 hover:text-black focus:scale-[1.02] focus:bg-cyan-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-5 sm:text-3xl sm:focus-visible:ring-offset-4"
						>
							Press Start
						</button>
					{/if}
					<button
						data-menu-button
						onclick={backToDashboard}
						class="border-2 border-black bg-white px-4 py-2 text-base font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-4 sm:text-2xl sm:focus-visible:ring-offset-4"
					>
						Dashboard
					</button>
				</div>
			</div>
		</div>
	{:else if endScreen}
		<div class="flex min-h-[calc(100vh-2rem)] items-center justify-center">
			<div class="w-full max-w-5xl border-4 border-black bg-white p-3 text-black shadow-[4px_4px_0_rgba(0,0,0,1)] sm:p-10 sm:shadow-[14px_14px_0_rgba(0,0,0,1)]">
				<div class="mb-3 text-center sm:mb-8">
					<h1 class="text-3xl leading-none font-black uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:text-7xl sm:drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">
						{gameOver ? '💀 GAME OVER 💀' : '🏆 YOU WIN! 🏆'}
					</h1>
					<p class="mt-1 text-sm font-bold uppercase sm:mt-4 sm:text-2xl">
						{gameOver ? 'The blocks got you!' : 'Incredible run!'}
					</p>
				</div>

				<div class="grid gap-3 sm:gap-4 sm:grid-cols-2">
					<div class="border-4 border-black bg-black p-3 text-cyan-400 sm:p-5">
						<div class="text-[0.6rem] font-black tracking-[0.35em] uppercase text-cyan-400/70 sm:text-xs">Final Score</div>
						<div class="text-3xl font-black sm:text-5xl">{score.toLocaleString()}</div>
						<div class="mt-2 text-xs font-bold uppercase text-cyan-400/70 sm:text-sm">Level {level} • {lines} Lines</div>
					</div>
					<div class="border-4 border-black bg-black p-3 text-cyan-400 sm:p-5">
						<div class="text-[0.6rem] font-black tracking-[0.35em] uppercase text-cyan-400/70 sm:text-xs">Hi-Score</div>
						<div class="text-3xl font-black sm:text-5xl">{highScore.toLocaleString()}</div>
						{#if score >= highScore && score > 0}
							<div class="mt-1 animate-pulse text-xs font-black uppercase text-yellow-400 sm:text-sm">★ New Record! ★</div>
						{/if}
					</div>
				</div>

				<div class="mt-2 flex flex-col gap-2 sm:mt-8 sm:gap-4">
					<button
						data-menu-button
						onclick={() => startGame()}
						class="border-2 border-cyan-400 bg-black px-4 py-2 text-base font-black text-cyan-400 uppercase transition-all hover:scale-[1.02] hover:bg-cyan-400 hover:text-black focus:scale-[1.02] focus:bg-cyan-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-5 sm:text-3xl sm:focus-visible:ring-offset-4"
					>
						Retry
					</button>
					<button
						data-menu-button
						onclick={() => returnToSplash(false)}
						class="border-2 border-black bg-white px-4 py-2 text-base font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-4 sm:text-2xl sm:focus-visible:ring-offset-4"
					>
						Splash Screen
					</button>
					<button
						data-menu-button
						onclick={backToDashboard}
						class="border-2 border-black bg-white px-4 py-2 text-base font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-4 sm:text-2xl sm:focus-visible:ring-offset-4"
					>
						Dashboard
					</button>
				</div>
			</div>
		</div>
	{:else}
		<!-- Game Screen -->
		<div class="relative mx-auto w-fit">
			<!-- Game Over Transition Overlay -->
			{#if showingGameOver}
				<div class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-[2px]">
					<h2 class="animate-pulse text-3xl font-black uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:text-6xl sm:drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">
						💀 GAME OVER 💀
					</h2>
					<p class="mt-2 text-xs font-bold uppercase text-white/70 sm:text-lg">
						{score.toLocaleString()} pts • Level {level}
					</p>
				</div>
			{/if}
			<!-- Pause Overlay -->
			{#if paused}
				<div class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-[2px]">
					<h2 class="text-3xl font-black uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:text-5xl sm:drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">
						⏸ PAUSED ⏸
					</h2>
					<p class="mt-2 text-xs font-bold uppercase text-white/70 sm:text-base">
						Press P to resume • B / Esc to return
					</p>
				</div>
			{/if}

			<div class="flex flex-col items-center gap-2 sm:gap-4" style:transform={`scale(${gameScale})`} style:transform-origin="top center">
				<div class="grid w-full gap-2 sm:gap-3 sm:grid-cols-4">
					<div class="border-4 border-black bg-black px-2 py-1 text-[0.55rem] font-black uppercase tracking-[0.2em] text-cyan-400 shadow-[4px_4px_0_rgba(0,0,0,1)] sm:text-[0.65rem]">
						<span class="text-cyan-400/70">Score</span> <span class="text-cyan-400">{score.toLocaleString()}</span>
					</div>
					<div class="border-4 border-black bg-black px-2 py-1 text-[0.55rem] font-black uppercase tracking-[0.2em] text-cyan-400 shadow-[4px_4px_0_rgba(0,0,0,1)] sm:text-[0.65rem]">
						<span class="text-cyan-400/70">Lines</span> <span class="text-cyan-400">{lines}</span>
					</div>
					<div class="border-4 border-black bg-black px-2 py-1 text-[0.55rem] font-black uppercase tracking-[0.2em] text-cyan-400 shadow-[4px_4px_0_rgba(0,0,0,1)] sm:text-[0.65rem]">
						<span class="text-cyan-400/70">Level</span> <span class="text-cyan-400">{level}</span>
					</div>
					<div class="border-4 border-black bg-black px-2 py-1 text-[0.55rem] font-black uppercase tracking-[0.2em] text-yellow-400 shadow-[4px_4px_0_rgba(0,0,0,1)] sm:text-[0.65rem]">
						<span class="text-yellow-400/70">Recorde</span> <span class="text-yellow-400">{highScore.toLocaleString()}</span>
					</div>
				</div>

				<div class="grid items-start gap-2 sm:gap-4 grid-cols-[4.75rem_minmax(0,1fr)_4.75rem] sm:grid-cols-[5.75rem_minmax(0,1fr)_5.75rem]">
					<div class="grid gap-2 sm:gap-4">
						<div class="border-4 border-black bg-black p-1 shadow-[4px_4px_0_rgba(0,0,0,1)] sm:p-2">
							<div class="text-[0.55rem] font-black tracking-[0.2em] uppercase text-cyan-400/70 sm:text-[0.65rem]">Hold</div>
							<div class="box-content mt-1 flex h-12 w-12 items-center justify-center overflow-hidden border-2 border-cyan-800 bg-zinc-900 sm:h-24 sm:w-24">
								{#if holdPieceType}
									{@const preview = getPreviewCells(holdPieceType)}
									<div class="grid" style:grid-template-columns={`repeat(${preview[0].length}, 1fr)`} style:gap="0px">
										{#each preview as row}
											{#each row as cell}
												<div
													class="border border-black/30"
													style:width={`${canHold ? CELL_SIZE * 0.45 : CELL_SIZE * 0.45}px`}
													style:height={`${canHold ? CELL_SIZE * 0.45 : CELL_SIZE * 0.45}px`}
													style:background={cell ? (canHold ? PIECE_COLORS[holdPieceType] : PIECE_COLORS[holdPieceType] + '40') : 'transparent'}
												></div>
											{/each}
										{/each}
									</div>
								{/if}
							</div>
						</div>
					</div>

					<!-- Main Board -->
					<div class="relative border-4 border-black bg-zinc-900 shadow-[8px_8px_0_rgba(0,0,0,1)]" style:width={`${GAME_WIDTH}px`} style:height={`${GAME_HEIGHT}px`}>
					<div class="absolute inset-0 overflow-hidden">
					<!-- Grid lines -->
					{#each Array.from({ length: ROWS }) as _, row}
						{#each Array.from({ length: COLS }) as _, col}
							<div
								class="absolute border border-zinc-800/40"
								style:left={`${col * CELL_SIZE}px`}
								style:top={`${row * CELL_SIZE}px`}
								style:width={`${CELL_SIZE}px`}
								style:height={`${CELL_SIZE}px`}
							></div>
						{/each}
					{/each}

					<!-- Board cells -->
					{#each board as row, rowIndex}
						{#each row as cell, colIndex}
							{#if cell !== null}
								{@const isClearing = clearingRows.includes(rowIndex)}
								<div
									class={['absolute border border-black/30', isClearing ? 'animate-pulse' : ''].join(' ')}
									style:left={`${colIndex * CELL_SIZE}px`}
									style:top={`${rowIndex * CELL_SIZE}px`}
									style:width={`${CELL_SIZE}px`}
									style:height={`${CELL_SIZE}px`}
									style:background={isClearing ? '#fff' : PIECE_COLORS[cell]}
								></div>
							{/if}
						{/each}
					{/each}

					<!-- Ghost piece -->
					{#if currentPiece}
						{@const ghostY = getGhostY(currentPiece)}
						{@const ghostCells = getShapeCells(currentPiece.type, currentPiece.rotation)}
						{#each ghostCells as cell}
							{@const r = ghostY + cell.row}
							{@const c = currentPiece.x + cell.col}
							{#if r >= 0 && r < ROWS && c >= 0 && c < COLS}
								<div
									class="absolute border-2 border-dashed"
									style:left={`${c * CELL_SIZE}px`}
									style:top={`${r * CELL_SIZE}px`}
									style:width={`${CELL_SIZE}px`}
									style:height={`${CELL_SIZE}px`}
									style:border-color={PIECE_COLORS[currentPiece.type]}
									style:background={PIECE_COLORS[currentPiece.type] + '15'}
								></div>
							{/if}
						{/each}
					{/if}

					<!-- Current piece -->
					{#if currentPiece}
						{@const cells = getShapeCells(currentPiece.type, currentPiece.rotation)}
						{#each cells as cell}
							{@const r = currentPiece.y + cell.row}
							{@const c = currentPiece.x + cell.col}
							{#if r >= 0 && r < ROWS && c >= 0 && c < COLS}
								<div
									class="absolute border border-white/30"
									style:left={`${c * CELL_SIZE}px`}
									style:top={`${r * CELL_SIZE}px`}
									style:width={`${CELL_SIZE}px`}
									style:height={`${CELL_SIZE}px`}
									style:background={PIECE_COLORS[currentPiece.type]}
								></div>
							{/if}
						{/each}
					{/if}
					</div>
					</div>

					<div class="grid gap-2 sm:gap-4">
						<div class="border-4 border-black bg-black p-1 shadow-[4px_4px_0_rgba(0,0,0,1)] sm:p-2">
							<div class="text-[0.55rem] font-black tracking-[0.2em] uppercase text-cyan-400/70 sm:text-[0.65rem]">Next</div>
							<div class="box-content mt-1 flex h-12 w-12 items-center justify-center overflow-hidden border-2 border-cyan-800 bg-zinc-900 sm:h-24 sm:w-24">
								{#if nextPieceType}
									{@const nextPreview = getPreviewCells(nextPieceType)}
									<div class="grid" style:grid-template-columns={`repeat(${nextPreview[0].length}, 1fr)`} style:gap="0px">
										{#each nextPreview as row}
											{#each row as cell}
												<div
													class="border border-black/30"
													style:width={`${CELL_SIZE * 0.45}px`}
													style:height={`${CELL_SIZE * 0.45}px`}
													style:background={cell ? PIECE_COLORS[nextPieceType] : 'transparent'}
												></div>
											{/each}
										{/each}
									</div>
								{/if}
							</div>
						</div>

						<div class="border-4 border-black bg-zinc-900 p-1 text-[0.45rem] font-bold uppercase leading-tight text-cyan-400/60 shadow-[4px_4px_0_rgba(0,0,0,1)] sm:p-2 sm:text-[0.65rem]">
							<div>←→ Move</div>
							<div>↑ Rotate</div>
							<div>↓ Soft Drop</div>
							<div>Space Hard Drop</div>
							<div>C Hold</div>
							<div>Z Rot CCW</div>
							<div class="mt-1 text-white/40">P Pause</div>
							<div class="text-white/40">Esc Return</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Mobile Touch Controls -->
			{#if touchCapable && !gameOver && !gameWon}
				<div class="mt-3 flex w-full flex-col items-center gap-2 sm:mt-4" style:transform={`scale(${gameScale > 0.7 ? 1 : gameScale > 0.55 ? 1.15 : 1.3})`} style:transform-origin="top center">
					<div class="flex items-center gap-2">
						<button
							type="button"
							onpointerdown={() => { handleTouchAction('rotateCCW'); }}
							class="flex h-11 w-11 items-center justify-center border-2 border-cyan-400 bg-black text-lg font-black text-cyan-400 active:scale-90 sm:h-14 sm:w-14 sm:text-xl"
						>
							↺
						</button>
						<button
							type="button"
							onpointerdown={() => { handleTouchAction('hold'); }}
							class="flex h-11 w-11 items-center justify-center border-2 border-yellow-400 bg-black text-[0.6rem] font-black text-yellow-400 active:scale-90 sm:h-14 sm:w-14 sm:text-xs"
						>
							HOLD
						</button>
						<button
							type="button"
							onpointerdown={() => { handleTouchAction('rotateCW'); }}
							class="flex h-11 w-11 items-center justify-center border-2 border-cyan-400 bg-black text-lg font-black text-cyan-400 active:scale-90 sm:h-14 sm:w-14 sm:text-xl"
						>
							↻
						</button>
					</div>
					<div class="flex items-center gap-2">
						<button
							type="button"
							onpointerdown={() => startTouchRepeat('left')}
							onpointerup={stopTouchRepeat}
							onpointerleave={stopTouchRepeat}
							class="flex h-13 w-13 items-center justify-center border-2 border-white bg-black text-xl font-black text-white active:scale-90 sm:h-16 sm:w-16 sm:text-2xl"
						>
							◀
						</button>
						<button
							type="button"
							onpointerdown={() => { handleTouchAction('drop'); }}
							class="flex h-13 w-16 items-center justify-center border-2 border-red-500 bg-black text-[0.65rem] font-black text-red-400 active:scale-90 sm:h-16 sm:w-20 sm:text-xs"
						>
							DROP
						</button>
						<button
							type="button"
							onpointerdown={() => startTouchRepeat('right')}
							onpointerup={stopTouchRepeat}
							onpointerleave={stopTouchRepeat}
							class="flex h-13 w-13 items-center justify-center border-2 border-white bg-black text-xl font-black text-white active:scale-90 sm:h-16 sm:w-16 sm:text-2xl"
						>
							▶
						</button>
					</div>
					<button
						type="button"
						onpointerdown={() => startTouchRepeat('down')}
						onpointerup={stopTouchRepeat}
						onpointerleave={stopTouchRepeat}
						class="flex h-11 w-28 items-center justify-center border-2 border-white bg-black text-xl font-black text-white active:scale-90 sm:h-14 sm:w-32 sm:text-2xl"
					>
						▼
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}
</style>
