<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import { getCabinetFlow, returnFromCabinet, type CabinetScreen } from '$lib/cabinet-flow';
	import { gameCabinetById, readCabinetScore, recordCabinetHighScore } from '$lib/cabinets';
	import { KEY_SPACE, normalizeKey } from '$lib/keys';
	import {
		activateFocusedControlItem,
		focusFirstControlItem,
		handleLinearMenuKeydown,
		MENU_BUTTON_SELECTOR,
		moveLinearFocus
	} from '$lib/unified-controls';

	const BOARD_OPTIONS = [
		{ label: '18×18', cells: 18, sublabel: 'Tight Arena' },
		{ label: '22×22', cells: 22, sublabel: 'Arcade Grid' },
		{ label: '28×28', cells: 28, sublabel: 'Long Run' }
	] as const;
	const SPEED_OPTIONS = ['easy', 'normal', 'hard'] as const;
	const LOGICAL_CELL_SIZE = 24;
	const START_LENGTH = 4;
	const GAMEPAD_DEADZONE = 0.25;
	const cabinet = gameCabinetById['snake-chaos'];

	type Difficulty = (typeof SPEED_OPTIONS)[number];
	type Direction = 'up' | 'down' | 'left' | 'right';
	type EndMode = 'won' | 'lost' | null;
	type Point = {
		row: number;
		col: number;
	};
	type GamepadState = {
		up: boolean;
		down: boolean;
		left: boolean;
		right: boolean;
		select: boolean;
		back: boolean;
	};

	const DIRECTION_VECTORS: Record<Direction, Point> = {
		up: { row: -1, col: 0 },
		down: { row: 1, col: 0 },
		left: { row: 0, col: -1 },
		right: { row: 0, col: 1 }
	};
	const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
		up: 'down',
		down: 'up',
		left: 'right',
		right: 'left'
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
		volume = 0.055
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

	function playTurn() {
		playTone(260, 0.035, 'square', 0.025);
	}

	function playEat() {
		playTone(520, 0.06, 'square', 0.06);
		setTimeout(() => playTone(760, 0.07, 'square', 0.045), 45);
	}

	function playGameOver() {
		playTone(220, 0.22, 'sawtooth', 0.09);
		setTimeout(() => playTone(150, 0.25, 'sawtooth', 0.08), 150);
		setTimeout(() => playTone(95, 0.35, 'sawtooth', 0.08), 330);
	}

	function playWin() {
		playTone(440, 0.08, 'square', 0.06);
		setTimeout(() => playTone(660, 0.1, 'square', 0.07), 80);
		setTimeout(() => playTone(990, 0.16, 'square', 0.08), 170);
	}

	function getDifficultyLabel(level: Difficulty) {
		if (level === 'easy') return 'Easy';
		if (level === 'normal') return 'Normal';
		return 'Hard';
	}

	function getDifficultySublabel(level: Difficulty) {
		if (level === 'easy') return 'Cruise';
		if (level === 'normal') return 'Classic';
		return 'Turbo';
	}

	function getTickMs(level: Difficulty, eaten: number) {
		const base = level === 'easy' ? 155 : level === 'normal' ? 115 : 86;
		const minimum = level === 'easy' ? 92 : level === 'normal' ? 70 : 54;
		return Math.max(minimum, base - Math.floor(eaten * 2.5));
	}

	function getFoodPoints(level: Difficulty, eaten: number, cells: number) {
		const speedMultiplier = level === 'easy' ? 1 : level === 'normal' ? 1.35 : 1.8;
		const boardMultiplier = cells <= 18 ? 1.15 : cells >= 28 ? 0.9 : 1;
		return Math.round((80 + Math.floor(eaten / 5) * 20) * speedMultiplier * boardMultiplier);
	}

	function createEmptyGamepadState(): GamepadState {
		return {
			up: false,
			down: false,
			left: false,
			right: false,
			select: false,
			back: false
		};
	}

	function samePoint(a: Point, b: Point) {
		return a.row === b.row && a.col === b.col;
	}

	function getPointKey(point: Point) {
		return `${point.row}:${point.col}`;
	}

	function createInitialSnake(cells: number) {
		const center = Math.floor(cells / 2);
		return Array.from({ length: START_LENGTH }, (_, index) => ({
			row: center,
			col: center - index
		}));
	}

	function getRandomFreeCell(nextSnake: Point[], cells: number): Point {
		const occupied = new Set(nextSnake.map(getPointKey));
		const freeCells: Point[] = [];

		for (let row = 0; row < cells; row += 1) {
			for (let col = 0; col < cells; col += 1) {
				const point = { row, col };
				if (!occupied.has(getPointKey(point))) freeCells.push(point);
			}
		}

		return freeCells[Math.floor(Math.random() * freeCells.length)] ?? { row: 0, col: 0 };
	}

	function getDirectionFromKey(key: string): Direction | null {
		const normalized = normalizeKey(key).toLowerCase();

		if (normalized === 'w') return 'up';
		if (normalized === 's') return 'down';
		if (normalized === 'a') return 'left';
		if (normalized === 'd') return 'right';
		return null;
	}

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let ctx: CanvasRenderingContext2D | null = null;
	let screen = $state<CabinetScreen>('splash');
	let endMode = $state<EndMode>(null);
	let selectedBoardIndex = $state(1);
	let boardIndex = $state(1);
	let selectedDifficulty = $state<Difficulty>('normal');
	let difficulty = $state<Difficulty>('normal');
	let snake = $state<Point[]>([]);
	let food = $state<Point>({ row: 0, col: 0 });
	let direction = $state<Direction>('right');
	let pendingDirection = $state<Direction>('right');
	let score = $state(0);
	let apples = $state(0);
	let highScore = $state(0);
	let previousHighScore = $state(0);
	let paused = $state(false);
	let running = $state(false);
	let hasActiveRun = $state(false);
	let helpOpen = $state(false);
	let touchCapable = $state(false);
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);
	let dpr = $state(1);
	let gamepadLast = $state<GamepadState>(createEmptyGamepadState());
	let stepAccumulator = 0;
	let lastTime = 0;
	let gameLoopFrame: number | null = null;

	let flow = $derived(getCabinetFlow(screen));
	let splashScreen = $derived(flow.splashScreen);
	let gameScreen = $derived(flow.gameScreen);
	let endScreen = $derived(flow.endScreen);
	let menuScreen = $derived(flow.menuScreen);
	let board = $derived(BOARD_OPTIONS[boardIndex]);
	let selectedBoard = $derived(BOARD_OPTIONS[selectedBoardIndex]);
	let cells = $derived(board.cells);
	let logicalSize = $derived(cells * LOGICAL_CELL_SIZE);
	let level = $derived(Math.floor(apples / 5) + 1);
	let tickMs = $derived(getTickMs(difficulty, apples));
	let gameWon = $derived(endMode === 'won');
	let totalCells = $derived(cells * cells);
	let speedLabel = $derived(getDifficultyLabel(difficulty));
	let newBest = $derived(score > previousHighScore && score > 0);

	let displaySize = $derived.by(() => {
		if (!viewportWidth || !viewportHeight) return 520;
		const isDesktop = viewportWidth >= 640;
		const hPad = isDesktop ? 64 : 12;
		const hudChrome = isDesktop ? 132 : 116;
		const touchChrome = touchCapable && !isDesktop ? 132 : 0;
		const byWidth = viewportWidth - hPad * 2;
		const byHeight = viewportHeight - hudChrome - touchChrome;
		return Math.floor(Math.max(280, Math.min(640, byWidth, byHeight)));
	});

	function getCanvasContext() {
		if (!canvasEl) return null;
		if (ctx?.canvas !== canvasEl) {
			ctx = canvasEl.getContext('2d');
		}
		return ctx;
	}

	function canvasNode(node: HTMLCanvasElement) {
		canvasEl = node;
		requestAnimationFrame(drawBoard);

		return () => {
			if (canvasEl === node) canvasEl = null;
			if (ctx?.canvas === node) ctx = null;
		};
	}

	function resetRunState() {
		const nextCells = BOARD_OPTIONS[boardIndex].cells;
		snake = createInitialSnake(nextCells);
		food = getRandomFreeCell(snake, nextCells);
		direction = 'right';
		pendingDirection = 'right';
		score = 0;
		apples = 0;
		endMode = null;
		paused = false;
		stepAccumulator = 0;
	}

	function stopGameLoop() {
		running = false;
		if (gameLoopFrame !== null) {
			cancelAnimationFrame(gameLoopFrame);
			gameLoopFrame = null;
		}
	}

	function selectBoard(index: number) {
		if (hasActiveRun) return;
		selectedBoardIndex = index;
	}

	function selectDifficulty(next: Difficulty) {
		if (hasActiveRun) return;
		selectedDifficulty = next;
	}

	async function focusMenuSoon() {
		await tick();
		focusFirstControlItem(MENU_BUTTON_SELECTOR, true);
	}

	async function beginGameplayLoop() {
		await tick();
		if (!running) return;
		lastTime = performance.now();
		stepAccumulator = 0;
		drawBoard();
		queueGameLoop();
	}

	function startGame() {
		boardIndex = selectedBoardIndex;
		difficulty = selectedDifficulty;
		previousHighScore = highScore;
		resetRunState();
		hasActiveRun = true;
		screen = 'game';
		running = true;
		if (audioCtx?.state === 'suspended') void audioCtx.resume();
		void beginGameplayLoop();
	}

	function continueGame() {
		if (!hasActiveRun || !snake.length) return;
		selectedBoardIndex = boardIndex;
		selectedDifficulty = difficulty;
		endMode = null;
		screen = 'game';
		paused = false;
		running = true;
		if (audioCtx?.state === 'suspended') void audioCtx.resume();
		void beginGameplayLoop();
	}

	function backToDashboard() {
		window.location.href = resolve('/');
	}

	function returnToSplash(preserveRun = false) {
		selectedBoardIndex = boardIndex;
		selectedDifficulty = difficulty;
		screen = 'splash';
		paused = false;
		stopGameLoop();

		if (preserveRun) {
			hasActiveRun = true;
			void focusMenuSoon();
			return;
		}

		hasActiveRun = false;
		endMode = null;
		void focusMenuSoon();
	}

	function handleReturnAction() {
		returnFromCabinet(flow, {
			toDashboard: backToDashboard,
			toSplash: returnToSplash
		});
	}

	function finishGame(mode: Exclude<EndMode, null>) {
		if (endMode) return;
		if (score > highScore) {
			highScore = recordCabinetHighScore(localStorage, cabinet, score);
		}
		hasActiveRun = false;
		endMode = mode;
		screen = 'end';
		stopGameLoop();
		if (mode === 'won') playWin();
		else playGameOver();
		void focusMenuSoon();
	}

	function setDirection(next: Direction) {
		if (OPPOSITE_DIRECTION[next] === direction) return;
		if (pendingDirection === next) return;
		pendingDirection = next;
		playTurn();
	}

	function moveSnakeOneStep() {
		if (!snake.length || !gameScreen) return;

		if (OPPOSITE_DIRECTION[pendingDirection] !== direction) {
			direction = pendingDirection;
		}

		const head = snake[0];
		const vector = DIRECTION_VECTORS[direction];
		const nextHead = {
			row: head.row + vector.row,
			col: head.col + vector.col
		};

		if (nextHead.row < 0 || nextHead.row >= cells || nextHead.col < 0 || nextHead.col >= cells) {
			finishGame('lost');
			return;
		}

		const eating = samePoint(nextHead, food);
		const collisionBody = eating ? snake : snake.slice(0, -1);
		if (collisionBody.some((segment) => samePoint(segment, nextHead))) {
			finishGame('lost');
			return;
		}

		if (eating) {
			const grownSnake = [nextHead, ...snake];
			const nextAppleCount = apples + 1;
			snake = grownSnake;
			apples = nextAppleCount;
			score += getFoodPoints(difficulty, nextAppleCount, cells);
			playEat();

			if (grownSnake.length >= totalCells) {
				finishGame('won');
				return;
			}

			food = getRandomFreeCell(grownSnake, cells);
			return;
		}

		snake = [nextHead, ...snake.slice(0, -1)];
	}

	function drawCell(
		context: CanvasRenderingContext2D,
		point: Point,
		color: string,
		inset = 2,
		stroke = 'rgba(0,0,0,0.35)'
	) {
		const x = point.col * LOGICAL_CELL_SIZE;
		const y = point.row * LOGICAL_CELL_SIZE;
		const size = LOGICAL_CELL_SIZE - inset * 2;
		context.fillStyle = color;
		context.fillRect(x + inset, y + inset, size, size);
		context.fillStyle = 'rgba(255,255,255,0.22)';
		context.fillRect(x + inset + 2, y + inset + 2, size - 4, 4);
		context.strokeStyle = stroke;
		context.lineWidth = 1;
		context.strokeRect(x + inset + 0.5, y + inset + 0.5, size - 1, size - 1);
	}

	function drawBoard() {
		const context = getCanvasContext();
		if (!context || context.canvas.width === 0 || context.canvas.height === 0) return;

		context.setTransform(1, 0, 0, 1, 0, 0);
		context.imageSmoothingEnabled = false;
		context.clearRect(0, 0, context.canvas.width, context.canvas.height);

		const scale = context.canvas.width / logicalSize;
		context.setTransform(scale, 0, 0, scale, 0, 0);

		context.fillStyle = '#06130a';
		context.fillRect(0, 0, logicalSize, logicalSize);

		for (let row = 0; row < cells; row += 1) {
			for (let col = 0; col < cells; col += 1) {
				context.fillStyle = (row + col) % 2 === 0 ? '#092413' : '#0d2d18';
				context.fillRect(
					col * LOGICAL_CELL_SIZE,
					row * LOGICAL_CELL_SIZE,
					LOGICAL_CELL_SIZE,
					LOGICAL_CELL_SIZE
				);
			}
		}

		context.strokeStyle = 'rgba(190, 242, 100, 0.12)';
		context.lineWidth = 1;
		for (let index = 0; index <= cells; index += 1) {
			const p = index * LOGICAL_CELL_SIZE + 0.5;
			context.beginPath();
			context.moveTo(p, 0);
			context.lineTo(p, logicalSize);
			context.stroke();
			context.beginPath();
			context.moveTo(0, p);
			context.lineTo(logicalSize, p);
			context.stroke();
		}

		const pulse = 0.78 + Math.sin(performance.now() / 120) * 0.18;
		context.save();
		context.globalAlpha = pulse;
		drawCell(context, food, '#ef4444', 4, '#7f1d1d');
		context.restore();
		context.fillStyle = '#fef08a';
		context.fillRect(food.col * LOGICAL_CELL_SIZE + 9, food.row * LOGICAL_CELL_SIZE + 7, 6, 4);

		snake.forEach((segment, index) => {
			if (index === 0) {
				drawCell(context, segment, '#bef264', 1, '#365314');
				drawSnakeEyes(context, segment);
				return;
			}

			const bodyShade = index % 2 === 0 ? '#22c55e' : '#16a34a';
			drawCell(context, segment, bodyShade, 2, '#052e16');
		});
	}

	function drawSnakeEyes(context: CanvasRenderingContext2D, head: Point) {
		const x = head.col * LOGICAL_CELL_SIZE;
		const y = head.row * LOGICAL_CELL_SIZE;
		const eyePositions: Record<Direction, Point[]> = {
			up: [
				{ row: 7, col: 7 },
				{ row: 7, col: 15 }
			],
			down: [
				{ row: 15, col: 7 },
				{ row: 15, col: 15 }
			],
			left: [
				{ row: 7, col: 7 },
				{ row: 15, col: 7 }
			],
			right: [
				{ row: 7, col: 15 },
				{ row: 15, col: 15 }
			]
		};

		context.fillStyle = '#052e16';
		for (const eye of eyePositions[direction]) {
			context.fillRect(x + eye.col, y + eye.row, 3, 3);
		}
	}

	function queueGameLoop() {
		if (gameLoopFrame !== null) return;
		gameLoopFrame = requestAnimationFrame(gameLoop);
	}

	function gameLoop(time: number) {
		gameLoopFrame = null;
		if (!running) return;

		const dt = Math.min(250, time - lastTime || 16);
		lastTime = time;

		if (!paused && gameScreen) {
			stepAccumulator += dt;
			while (stepAccumulator >= tickMs && gameScreen && !paused) {
				stepAccumulator -= tickMs;
				moveSnakeOneStep();
			}
		}

		drawBoard();
		if (running) queueGameLoop();
	}

	function togglePause() {
		if (!gameScreen) return;
		paused = !paused;
		if (!paused && running) void beginGameplayLoop();
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

		if (!gameScreen) return;

		if (event.key === KEY_SPACE || event.key === 'p' || event.key === 'P') {
			event.preventDefault();
			togglePause();
			return;
		}

		if (paused) return;

		const nextDirection = getDirectionFromKey(event.key);
		if (!nextDirection) return;

		event.preventDefault();
		setDirection(nextDirection);
	}

	function readGamepadState() {
		const state = createEmptyGamepadState();
		const gamepads = navigator.getGamepads?.() ?? [];

		for (const gamepad of gamepads) {
			if (!gamepad) continue;

			const axisX = gamepad.axes[0] ?? 0;
			const axisY = gamepad.axes[1] ?? 0;
			state.up ||= Boolean(gamepad.buttons[12]?.pressed || axisY < -GAMEPAD_DEADZONE);
			state.down ||= Boolean(gamepad.buttons[13]?.pressed || axisY > GAMEPAD_DEADZONE);
			state.left ||= Boolean(gamepad.buttons[14]?.pressed || axisX < -GAMEPAD_DEADZONE);
			state.right ||= Boolean(gamepad.buttons[15]?.pressed || axisX > GAMEPAD_DEADZONE);
			state.select ||= Boolean(
				gamepad.buttons[0]?.pressed ||
				gamepad.buttons[2]?.pressed ||
				gamepad.buttons[3]?.pressed ||
				gamepad.buttons[7]?.pressed
			);
			state.back ||= Boolean(
				gamepad.buttons[1]?.pressed || gamepad.buttons[8]?.pressed || gamepad.buttons[9]?.pressed
			);
		}

		return state;
	}

	function pollGamepad() {
		const current = readGamepadState();
		const currentPrevious = current.up || current.left;
		const currentNext = current.down || current.right;
		const lastPrevious = gamepadLast.up || gamepadLast.left;
		const lastNext = gamepadLast.down || gamepadLast.right;

		if (menuScreen) {
			if (currentPrevious && !lastPrevious) moveLinearFocus(-1, MENU_BUTTON_SELECTOR);
			if (currentNext && !lastNext) moveLinearFocus(1, MENU_BUTTON_SELECTOR);
			if (current.select && !gamepadLast.select) activateFocusedControlItem(MENU_BUTTON_SELECTOR);
			if (current.back && !gamepadLast.back) handleReturnAction();
			gamepadLast = current;
			return;
		}

		if (gameScreen) {
			if (current.back && !gamepadLast.back) {
				handleReturnAction();
			} else if (current.select && !gamepadLast.select) {
				togglePause();
			} else if (!paused) {
				if (current.up && !gamepadLast.up) setDirection('up');
				if (current.down && !gamepadLast.down) setDirection('down');
				if (current.left && !gamepadLast.left) setDirection('left');
				if (current.right && !gamepadLast.right) setDirection('right');
			}
		}

		gamepadLast = current;
	}

	function handleTouchDirection(next: Direction) {
		if (!gameScreen) return;
		if (paused) paused = false;
		setDirection(next);
	}

	onMount(() => {
		highScore = readCabinetScore(localStorage, cabinet);
		previousHighScore = highScore;
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		touchCapable = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
		resetRunState();
		void focusMenuSoon();

		const gamepadPoll = setInterval(pollGamepad, 80);

		return () => {
			stopGameLoop();
			clearInterval(gamepadPoll);
			if (audioCtx) {
				audioCtx.close();
				audioCtx = null;
			}
		};
	});
</script>

<svelte:head>
	<title>Snake Chaos | Classic Arcade Serpent</title>
	<meta
		name="description"
		content="Eat, grow, and survive the grid in Snake Chaos, a fast retro arcade cabinet built for keyboard, touch, and gamepad."
	/>
	<meta property="og:title" content="Snake Chaos - Classic Arcade Serpent" />
	<meta
		property="og:description"
		content="Classic Snake with chunky Game Chaos controls and hi-score memory."
	/>
</svelte:head>

<svelte:window
	bind:innerWidth={viewportWidth}
	bind:innerHeight={viewportHeight}
	onkeydown={handleKeydown}
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
						class="text-[0.55rem] font-black tracking-[0.4em] text-yellow-300/50 uppercase sm:text-xs"
					>
						Grid Garden
					</div>
					<div class="flex items-center justify-between gap-4">
						<h1
							class="text-xl leading-none font-black uppercase sm:text-5xl sm:drop-shadow-[3px_3px_0_rgba(255,221,0,0.25)]"
						>
							🐍 Snake Chaos 🐍
						</h1>
						<div class="shrink-0 text-right">
							<div
								class="text-[0.5rem] tracking-widest text-yellow-300/50 uppercase sm:text-[0.6rem]"
							>
								Hi-Score
							</div>
							<div class="text-lg leading-none font-black sm:text-4xl">
								{highScore.toLocaleString()}
							</div>
						</div>
					</div>
					<p
						class="mt-1 text-[0.65rem] font-bold text-yellow-300/60 uppercase sm:mt-2 sm:text-base"
					>
						Eat the red chip. Grow forever. Hit nothing.
					</p>
				</div>

				<div class="p-4 sm:p-8">
					<div class="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:gap-4">
						<div class="border-2 border-black bg-yellow-100 p-2 sm:border-4 sm:p-4">
							<div
								class="mb-2 text-[0.55rem] font-black tracking-[0.3em] text-black/50 uppercase sm:mb-3 sm:text-xs"
							>
								Board Size
							</div>
							<div class="flex flex-col gap-1 sm:gap-2">
								{#each BOARD_OPTIONS as option, index (option.label)}
									<button
										type="button"
										data-menu-button
										onclick={() => selectBoard(index)}
										aria-pressed={selectedBoardIndex === index}
										class={[
											'border-2 border-black px-1.5 py-1.5 text-xs font-black uppercase transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 sm:border-4 sm:px-3 sm:py-2 sm:text-base',
											selectedBoardIndex === index
												? 'bg-black text-yellow-300'
												: 'bg-white text-black hover:bg-black hover:text-white focus:bg-black focus:text-white',
											hasActiveRun && selectedBoard.label !== option.label && 'opacity-80'
										]}
									>
										<span class="block">{option.label}</span>
										<span class="block text-[0.5rem] opacity-60 sm:text-xs">
											{option.sublabel}
										</span>
									</button>
								{/each}
							</div>
						</div>

						<div class="border-2 border-black bg-yellow-100 p-2 sm:border-4 sm:p-4">
							<div
								class="mb-2 text-[0.55rem] font-black tracking-[0.3em] text-black/50 uppercase sm:mb-3 sm:text-xs"
							>
								Speed
							</div>
							<div class="flex flex-col gap-1 sm:gap-2">
								{#each SPEED_OPTIONS as option (option)}
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
											hasActiveRun && difficulty !== option && 'opacity-80'
										]}
									>
										<span class="block">{getDifficultyLabel(option)}</span>
										<span class="block text-[0.5rem] opacity-60 sm:text-xs">
											{getDifficultySublabel(option)}
										</span>
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
								class="border-t-2 border-black bg-yellow-50 px-3 py-2 text-xs leading-relaxed font-bold uppercase sm:border-t-4 sm:px-4 sm:py-3 sm:text-sm"
							>
								Use arrows or WASD to turn one cell at a time. Eat red chips to score.<br />
								Walls and your own trail end the run. Space pauses.<br />
								{#if touchCapable}
									Touch D-pad appears during gameplay.<br />
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
							onclick={startGame}
							class="mt-2 w-full border-2 border-black bg-white py-2 text-sm font-black text-black uppercase transition-all hover:bg-black hover:text-white focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:py-3 sm:text-base"
						>
							New Game
						</button>
					{:else}
						<div class="grid grid-cols-2 gap-2 sm:gap-4">
							<button
								data-menu-button
								onclick={startGame}
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
						{gameWon ? '🏆 GRID CLEARED 🏆' : '💀 GAME OVER 💀'}
					</h1>
					<p class="mt-1 text-sm font-bold uppercase sm:mt-4 sm:text-2xl">
						{gameWon ? 'Every cell belongs to the run!' : 'The line finally caught itself.'}
					</p>
				</div>

				<div class="grid gap-3 sm:grid-cols-2 sm:gap-4">
					<div class="border-4 border-black bg-black p-3 text-emerald-400 sm:p-5">
						<div
							class="text-[0.6rem] font-black tracking-[0.35em] text-emerald-400/70 uppercase sm:text-xs"
						>
							Final Score
						</div>
						<div class="text-3xl font-black sm:text-5xl">{score.toLocaleString()}</div>
						<div class="mt-2 text-xs font-bold text-emerald-400/70 uppercase sm:text-sm">
							{apples} Apples • Length {snake.length} • Level {level}
						</div>
					</div>
					<div class="border-4 border-black bg-black p-3 text-emerald-400 sm:p-5">
						<div
							class="text-[0.6rem] font-black tracking-[0.35em] text-emerald-400/70 uppercase sm:text-xs"
						>
							Hi-Score
						</div>
						<div class="text-3xl font-black sm:text-5xl">{highScore.toLocaleString()}</div>
						{#if newBest}
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
						onclick={startGame}
						class="border-2 border-emerald-400 bg-black px-4 py-2 text-base font-black text-emerald-400 uppercase transition-all hover:scale-[1.02] hover:bg-emerald-400 hover:text-black focus:scale-[1.02] focus:bg-emerald-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-5 sm:text-3xl sm:focus-visible:ring-offset-4"
					>
						Retry
					</button>
					<button
						data-menu-button
						onclick={() => returnToSplash(false)}
						class="border-2 border-black bg-white px-4 py-2 text-base font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-4 sm:text-2xl sm:focus-visible:ring-offset-4"
					>
						Splash Screen
					</button>
					<button
						data-menu-button
						onclick={backToDashboard}
						class="border-2 border-black bg-white px-4 py-2 text-base font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-4 sm:text-2xl sm:focus-visible:ring-offset-4"
					>
						Dashboard
					</button>
				</div>
			</div>
		</div>
	{:else}
		<div class="relative mx-auto w-fit">
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
						Space resumes • B / Esc returns to splash
					</p>
				</div>
			{/if}

			<div class="flex flex-col items-center gap-2 sm:gap-4">
				<div class="grid w-full grid-cols-4 gap-1 sm:gap-3">
					<div
						class="border-4 border-black bg-black px-2 py-1 text-[0.55rem] font-black tracking-[0.2em] text-emerald-400 uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] sm:text-[0.65rem]"
					>
						<span class="text-emerald-400/70">Score</span>
						<span class="text-emerald-400">{score.toLocaleString()}</span>
					</div>
					<div
						class="border-4 border-black bg-black px-2 py-1 text-[0.55rem] font-black tracking-[0.2em] text-emerald-400 uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] sm:text-[0.65rem]"
					>
						<span class="text-emerald-400/70">Apples</span>
						<span class="text-emerald-400">{apples}</span>
					</div>
					<div
						class="border-4 border-black bg-black px-2 py-1 text-[0.55rem] font-black tracking-[0.2em] text-emerald-400 uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] sm:text-[0.65rem]"
					>
						<span class="text-emerald-400/70">Speed</span>
						<span class="text-emerald-400">{speedLabel}</span>
					</div>
					<div
						class="border-4 border-black bg-black px-2 py-1 text-[0.55rem] font-black tracking-[0.2em] text-yellow-400 uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] sm:text-[0.65rem]"
					>
						<span class="text-yellow-400/70">Record</span>
						<span class="text-yellow-400">{highScore.toLocaleString()}</span>
					</div>
				</div>

				<div
					class="relative border-4 border-black bg-zinc-950 shadow-[8px_8px_0_rgba(0,0,0,1)]"
					style:width={`${displaySize}px`}
					style:height={`${displaySize}px`}
				>
					<canvas
						{@attach canvasNode}
						width={Math.max(1, Math.round(displaySize * dpr))}
						height={Math.max(1, Math.round(displaySize * dpr))}
						class="block h-full w-full touch-none bg-zinc-950"
						aria-label="Snake Chaos playfield"
					></canvas>
				</div>

				<p class="text-[0.6rem] font-bold text-black/70 uppercase sm:text-xs">
					{#if touchCapable}
						Touch D-pad • Space / tap center pauses • Esc returns to splash
					{:else}
						Arrows / WASD turn • Space pauses • Esc returns to splash
					{/if}
				</p>

				{#if touchCapable}
					<div class="grid grid-cols-3 gap-1.5 sm:gap-2">
						<div></div>
						<button
							type="button"
							onpointerdown={() => handleTouchDirection('up')}
							class="flex h-12 w-14 items-center justify-center border-2 border-emerald-400 bg-black text-xl font-black text-emerald-400 active:scale-90 sm:h-14 sm:w-16 sm:border-4 sm:text-2xl"
						>
							▲
						</button>
						<div></div>
						<button
							type="button"
							onpointerdown={() => handleTouchDirection('left')}
							class="flex h-12 w-14 items-center justify-center border-2 border-white bg-black text-xl font-black text-white active:scale-90 sm:h-14 sm:w-16 sm:border-4 sm:text-2xl"
						>
							◀
						</button>
						<button
							type="button"
							onpointerdown={togglePause}
							class="flex h-12 w-14 items-center justify-center border-2 border-yellow-400 bg-black text-[0.6rem] font-black text-yellow-400 uppercase active:scale-90 sm:h-14 sm:w-16 sm:border-4 sm:text-xs"
						>
							Pause
						</button>
						<button
							type="button"
							onpointerdown={() => handleTouchDirection('right')}
							class="flex h-12 w-14 items-center justify-center border-2 border-white bg-black text-xl font-black text-white active:scale-90 sm:h-14 sm:w-16 sm:border-4 sm:text-2xl"
						>
							▶
						</button>
						<div></div>
						<button
							type="button"
							onpointerdown={() => handleTouchDirection('down')}
							class="flex h-12 w-14 items-center justify-center border-2 border-emerald-400 bg-black text-xl font-black text-emerald-400 active:scale-90 sm:h-14 sm:w-16 sm:border-4 sm:text-2xl"
						>
							▼
						</button>
						<div></div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}
</style>
