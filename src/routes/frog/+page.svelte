<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import { getCabinetFlow, returnFromCabinet, type CabinetScreen } from '$lib/cabinet-flow';
	import { gameCabinetById, readCabinetScore, recordCabinetHighScore } from '$lib/cabinets';
	import { KEY_SPACE, normalizeKey } from '$lib/keys';
	import {
		activateFocusedControlItem,
		createUnifiedGamepadPoller,
		focusFirstControlItem,
		handleLinearMenuKeydown,
		MENU_BUTTON_SELECTOR,
		moveLinearFocus
	} from '$lib/unified-controls';

	const GRID_SIZE = 13;
	const HOME_ROW = 0;
	const START_ROW = 12;
	const START_COL = 6;
	const MEDIAN_ROW = 6;
	const RIVER_ROWS = [1, 2, 3, 4, 5] as const;
	const ROAD_ROWS = [7, 8, 9, 10, 11] as const;
	const HOME_PAD_COLS = [0, 3, 6, 9, 12] as const;
	const HOP_MS = 120;
	const FROG_MUTED_KEY = 'frog-chaos-muted';
	const FROG_MODAL_BUTTON_SELECTOR = '[data-frog-modal-button]';
	const cabinet = gameCabinetById['frog-chaos'];

	const DIFFICULTY = {
		timerMs: 60_000,
		vehicleSpeed: { min: 1, max: 2.5, scale: 1.12, cap: 5 },
		riverSpeed: { min: 0.6, max: 1.4, scale: 1.1, cap: 3.5 },
		vehicleGap: { min: 4, max: 8, scale: 0.93, cap: 2 },
		turtleSurfaceMs: 3_000,
		turtleSubmergedMs: 1_000,

		turtleSurfaceScale: 0.95,
		turtleSurfaceCapMs: 1_500,
		flySpawnMinMs: 12_000,
		flySpawnMaxMs: 18_000,
		flyVisibleMs: 7_000,
		crocBaseIntervalMs: 60_000,
		crocMinIntervalMs: 30_000,
		crocFrequencyScale: 1.05,
		crocTelegraphMs: 600,
		crocLethalMs: 5_000,
		floaterMs: 800
	} as const;

	type Direction = 'up' | 'down' | 'left' | 'right';
	type LaneKind = 'river' | 'road';
	type OccupantType = 'vehicle' | 'log' | 'turtle';
	type DeathReason = 'drown' | 'squish' | 'timeout' | 'croc';
	type HomePad = null | 'filled';

	type LaneOccupant = {
		id: number;
		type: OccupantType;
		x: number;
		width: number;
		color: string;
		glyph: string;
		submergeOffsetMs?: number;
	};

	type Lane = {
		row: number;
		kind: LaneKind;
		speed: number;
		gap: number;
		occupants: LaneOccupant[];
	};

	type World = {
		level: number;
		lanes: Lane[];
	};

	type Frog = {
		row: number;
		col: number;
		x: number;
		y: number;
		animFrom: { row: number; col: number; x: number; y: number } | null;
		animStartedAt: number;
	};

	type Floater = {
		id: number;
		text: string;
		x: number;
		y: number;
		bornAt: number;
	};

	type GroundDot = {
		x: number;
		y: number;
		radius: number;
		alpha: number;
	};

	const vehicleGlyphs = ['🚗', '🚛', '🏎️', '🚓'];
	const vehicleColors = ['#f97316', '#06b6d4', '#d946ef', '#ef4444', '#facc15'];

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let playfieldEl = $state<HTMLDivElement | null>(null);
	let ctx: CanvasRenderingContext2D | null = null;
	let raf = 0;
	let lastNow = 0;
	let nextOccupantId = 0;
	let nextFloaterId = 0;
	let nextFlyAt = 0;
	let nextCrocAt = 0;
	let audioCtx: AudioContext | null = null;

	let screen = $state<CabinetScreen>('splash');
	let lives = $state(3);
	let level = $state(1);
	let score = $state(0);
	let highScore = $state(0);
	let previousHighScore = $state(0);
	let timerMs = $state<number>(DIFFICULTY.timerMs);
	let maxRowThisLife = $state(START_ROW);
	let frog = $state<Frog>(createFrog());
	let homePads = $state<HomePad[]>(createHomePads());
	let activeFly = $state<{ padIndex: number; expiresAt: number } | null>(null);
	let activeCroc = $state<{ padIndex: number; lethalAt: number; expiresAt: number } | null>(null);
	let world = $state.raw<World>(createWorld(1));
	let floaters = $state.raw<Floater[]>([]);
	let groundDots = $state.raw<GroundDot[]>([]);
	let paused = $state(false);
	let muted = $state(true);
	let touchCapable = $state(false);
	let showFrogModal = $state(false);
	let hasActiveRun = $state(false);
	let cellSize = $state(32);

	let flow = $derived(getCabinetFlow(screen));
	let splashScreen = $derived(flow.splashScreen);
	let gameScreen = $derived(flow.gameScreen);
	let endScreen = $derived(flow.endScreen);
	let menuScreen = $derived(flow.menuScreen || showFrogModal);
	let canvasPixels = $derived(cellSize * GRID_SIZE);
	let timerPercent = $derived(Math.max(0, Math.min(100, (timerMs / DIFFICULTY.timerMs) * 100)));
	let secondsLeft = $derived(Math.max(0, Math.ceil(timerMs / 1000)));
	let gameOver = $derived(lives === 0);
	let newBest = $derived(score > previousHighScore && score > 0);

	function randomBetween(min: number, max: number) {
		return min + Math.random() * (max - min);
	}

	function randomItem<T>(items: readonly T[]) {
		return items[Math.floor(Math.random() * items.length)];
	}

	function scaledValue(base: number, scale: number, currentLevel: number, cap: number) {
		return Math.min(cap, base * scale ** Math.max(0, currentLevel - 1));
	}

	function createFrog(): Frog {
		return {
			row: START_ROW,
			col: START_COL,
			x: START_COL,
			y: START_ROW,
			animFrom: null,
			animStartedAt: 0
		};
	}

	function createHomePads() {
		return Array.from<HomePad>({ length: HOME_PAD_COLS.length }).fill(null);
	}

	function createLane(row: number, kind: LaneKind, currentLevel: number): Lane {
		const direction = row % 2 === 0 ? 1 : -1;
		const isRoad = kind === 'road';
		const speedRange = isRoad ? DIFFICULTY.vehicleSpeed : DIFFICULTY.riverSpeed;
		const baseSpeed = randomBetween(speedRange.min, speedRange.max);
		const speed =
			scaledValue(baseSpeed, speedRange.scale, currentLevel, speedRange.cap) * direction;
		const rawGap = randomBetween(DIFFICULTY.vehicleGap.min, DIFFICULTY.vehicleGap.max);
		const gap = Math.max(
			DIFFICULTY.vehicleGap.cap,
			rawGap * DIFFICULTY.vehicleGap.scale ** Math.max(0, currentLevel - 1)
		);
		const lane: Lane = {
			row,
			kind,
			speed,
			gap,
			occupants: []
		};

		lane.occupants = createOccupants(lane, currentLevel);
		return lane;
	}

	function createOccupants(lane: Lane, currentLevel: number): LaneOccupant[] {
		const occupants: LaneOccupant[] = [];
		let x = randomBetween(-GRID_SIZE, -1);

		while (x < GRID_SIZE + 5) {
			if (lane.kind === 'road') {
				const width = randomBetween(1.15, 1.85);
				occupants.push({
					id: nextOccupantId++,
					type: 'vehicle',
					x,
					width,
					color: randomItem(vehicleColors),
					glyph: randomItem(vehicleGlyphs)
				});
				x += width + lane.gap;
			} else {
				const turtleLane = lane.row === 2 || lane.row === 4;
				const width = turtleLane ? randomItem([2, 3]) : randomItem([2, 3, 4]);
				occupants.push({
					id: nextOccupantId++,
					type: turtleLane ? 'turtle' : 'log',
					x,
					width,
					color: turtleLane ? '#22c55e' : '#92400e',
					glyph: turtleLane ? '🐢' : '🪵',
					submergeOffsetMs: turtleLane ? randomBetween(0, 3_000 + currentLevel * 280) : undefined
				});
				x += width + randomBetween(2.3, 4.6);
			}
		}

		return occupants;
	}

	function createWorld(currentLevel: number): World {
		const lanes = [
			...RIVER_ROWS.map((row) => createLane(row, 'river', currentLevel)),
			...ROAD_ROWS.map((row) => createLane(row, 'road', currentLevel))
		];

		return {
			level: currentLevel,
			lanes
		};
	}

	function getLaneByRow(row: number) {
		return world.lanes.find((lane) => lane.row === row) ?? null;
	}

	function resetChaosSchedule(now = performance.now()) {
		nextFlyAt = now + randomBetween(DIFFICULTY.flySpawnMinMs, DIFFICULTY.flySpawnMaxMs);
		nextCrocAt = now + DIFFICULTY.crocBaseIntervalMs;
		activeFly = null;
		activeCroc = null;
	}

	function resetSession() {
		lives = 3;
		level = 1;
		score = 0;
		timerMs = DIFFICULTY.timerMs;
		maxRowThisLife = START_ROW;
		frog = createFrog();
		homePads = createHomePads();
		world = createWorld(1);
		floaters = [];
		paused = false;
		previousHighScore = readCabinetScore(localStorage, cabinet);
		highScore = previousHighScore;
		resetChaosSchedule();
		draw(performance.now());
	}

	function startGame() {
		resetSession();
		hasActiveRun = true;
		screen = 'game';
		paused = false;
		lastNow = performance.now();
		resumeAudioIfAllowed();
		prepareCanvasSoon();
	}

	function continueGame() {
		if (!hasActiveRun || gameOver) return;

		screen = 'game';
		paused = false;
		lastNow = performance.now();
		resumeAudioIfAllowed();
		prepareCanvasSoon();
	}

	function backToDashboard() {
		window.location.href = resolve('/');
	}

	function returnToSplash(preserveRun = false) {
		screen = 'splash';
		paused = false;
		showFrogModal = false;

		if (!preserveRun) {
			hasActiveRun = false;
			resetSession();
		}

		focusMenuSoon();
	}

	function handleReturnAction() {
		returnFromCabinet(flow, {
			toDashboard: backToDashboard,
			toSplash: returnToSplash
		});
	}

	function handlePlayAgain() {
		hasActiveRun = false;
		resetSession();
		screen = 'splash';
		focusMenuSoon();
	}

	function togglePause() {
		if (!gameScreen || gameOver) return;
		paused = !paused;
		lastNow = performance.now();
		draw(lastNow);
	}

	function isHopping(now: number) {
		return frog.animFrom !== null && now - frog.animStartedAt < HOP_MS;
	}

	function settleHop(now: number) {
		if (!frog.animFrom) return;
		if (now - frog.animStartedAt < HOP_MS) return;
		frog.animFrom = null;
		frog.x = frog.col;
		frog.y = frog.row;
	}

	function addScore(points: number, x = frog.x, y = frog.row) {
		if (points <= 0) return;
		score += points;
		floaters.push({
			id: nextFloaterId++,
			text: `+${points}`,
			x,
			y,
			bornAt: performance.now()
		});
	}

	function respawnFrog() {
		frog = createFrog();
		timerMs = DIFFICULTY.timerMs;
		maxRowThisLife = START_ROW;
	}

	function loseLife(reason: DeathReason) {
		if (!gameScreen || lives <= 0) return;

		if (reason === 'drown' || reason === 'croc') playDrownSound();
		if (reason === 'squish') playSquishSound();

		lives = Math.max(0, lives - 1);
		floaters.push({
			id: nextFloaterId++,
			text: reason === 'timeout' ? 'TIME' : 'OUCH',
			x: frog.x,
			y: frog.row,
			bornAt: performance.now()
		});

		if (lives === 0) {
			endSession();
			return;
		}

		respawnFrog();
	}

	function endSession() {
		previousHighScore = highScore;
		highScore = recordCabinetHighScore(localStorage, cabinet, score);
		hasActiveRun = false;
		paused = false;
		screen = 'end';
		focusMenuSoon();
	}

	function clearLevel() {
		playLevelClearSound();
		addScore(500, START_COL, MEDIAN_ROW);
		level += 1;
		world = createWorld(level);
		homePads = createHomePads();
		resetChaosSchedule();
		respawnFrog();
	}

	function getPadIndexFromCol(col: number) {
		return HOME_PAD_COLS.findIndex((padCol) => padCol === col);
	}

	function attemptCrossing(col: number) {
		const now = performance.now();
		const padIndex = getPadIndexFromCol(col);

		if (padIndex === -1 || homePads[padIndex] === 'filled') {
			playHopSound();
			return;
		}

		if (activeCroc?.padIndex === padIndex && now >= activeCroc.lethalAt) {
			loseLife('croc');
			return;
		}

		homePads[padIndex] = 'filled';
		playCrossingSound();

		const timerBonus = Math.floor(timerMs / 1000) * 10;
		addScore(50, HOME_PAD_COLS[padIndex], HOME_ROW);
		addScore(timerBonus, HOME_PAD_COLS[padIndex], HOME_ROW);

		if (activeFly?.padIndex === padIndex) {
			addScore(200, HOME_PAD_COLS[padIndex], HOME_ROW);
			activeFly = null;
		}

		if (homePads.every((pad) => pad === 'filled')) {
			clearLevel();
			return;
		}

		respawnFrog();
	}

	function hop(direction: Direction) {
		if (!gameScreen || paused || gameOver) return;

		const now = performance.now();
		settleHop(now);
		if (isHopping(now)) return;

		const currentCol = Math.round(frog.x);
		const next = {
			row: frog.row,
			col: currentCol
		};

		if (direction === 'up') next.row -= 1;
		if (direction === 'down') next.row += 1;
		if (direction === 'left') next.col -= 1;
		if (direction === 'right') next.col += 1;

		next.row = Math.max(HOME_ROW, Math.min(START_ROW, next.row));
		next.col = Math.max(0, Math.min(GRID_SIZE - 1, next.col));

		if (next.row === HOME_ROW) {
			attemptCrossing(next.col);
			return;
		}

		playHopSound();

		frog = {
			row: next.row,
			col: next.col,
			x: next.col,
			y: next.row,
			animFrom: { row: frog.row, col: currentCol, x: frog.x, y: frog.y },
			animStartedAt: now
		};

		if (next.row < maxRowThisLife) {
			maxRowThisLife = next.row;
			addScore(10, next.col, next.row);
		}
	}

	function updateLanes(dt: number) {
		const seconds = dt / 1000;

		for (const lane of world.lanes) {
			for (const occupant of lane.occupants) {
				occupant.x += lane.speed * seconds;

				if (lane.speed > 0 && occupant.x > GRID_SIZE + 0.75) {
					occupant.x = -occupant.width - lane.gap;
				} else if (lane.speed < 0 && occupant.x + occupant.width < -0.75) {
					occupant.x = GRID_SIZE + lane.gap;
				}
			}
		}
	}

	function isTurtleSubmerged(occupant: LaneOccupant, now: number) {
		if (occupant.type !== 'turtle') return false;

		const surfaceMs = Math.max(
			DIFFICULTY.turtleSurfaceCapMs,
			DIFFICULTY.turtleSurfaceMs * DIFFICULTY.turtleSurfaceScale ** Math.max(0, level - 1)
		);
		const cycleMs = surfaceMs + DIFFICULTY.turtleSubmergedMs;
		const phase = (now + (occupant.submergeOffsetMs ?? 0)) % cycleMs;
		return phase >= surfaceMs;
	}

	function getSupportOccupant(lane: Lane, centerX: number, now: number) {
		for (const occupant of lane.occupants) {
			const left = occupant.x;
			const right = occupant.x + occupant.width;
			if (centerX >= left && centerX <= right) {
				if (occupant.type === 'turtle' && isTurtleSubmerged(occupant, now)) return null;
				return occupant;
			}
		}

		return null;
	}

	function updateFrogRide(dt: number, now: number) {
		if (isHopping(now) || frog.row === HOME_ROW) return;
		if (!RIVER_ROWS.includes(frog.row as (typeof RIVER_ROWS)[number])) return;

		const lane = getLaneByRow(frog.row);
		if (!lane) return;

		const support = getSupportOccupant(lane, frog.x + 0.5, now);
		if (!support) return;

		frog.x += lane.speed * (dt / 1000);
		frog.col = Math.round(frog.x);

		if (frog.x < -0.45 || frog.x > GRID_SIZE - 0.55) {
			loseLife('drown');
		}
	}

	function updateTimer(dt: number) {
		timerMs = Math.max(0, timerMs - dt);
		if (timerMs === 0) {
			loseLife('timeout');
		}
	}

	function getEmptyPadIndexes() {
		return homePads
			.map((pad, index) => (pad === null ? index : -1))
			.filter(
				(index) => index !== -1 && activeFly?.padIndex !== index && activeCroc?.padIndex !== index
			);
	}

	function updateChaosElements(now: number) {
		if (activeFly && now >= activeFly.expiresAt) {
			activeFly = null;
		}

		if (activeCroc && now >= activeCroc.expiresAt) {
			activeCroc = null;
		}

		if (!activeFly && now >= nextFlyAt) {
			const emptyPads = getEmptyPadIndexes();
			if (emptyPads.length > 0) {
				activeFly = {
					padIndex: randomItem(emptyPads),
					expiresAt: now + DIFFICULTY.flyVisibleMs
				};
			}
			nextFlyAt = now + randomBetween(DIFFICULTY.flySpawnMinMs, DIFFICULTY.flySpawnMaxMs);
		}

		if (level >= 3 && !activeCroc && now >= nextCrocAt) {
			const emptyPads = getEmptyPadIndexes();
			if (emptyPads.length > 0) {
				const padIndex = randomItem(emptyPads);
				activeCroc = {
					padIndex,
					lethalAt: now + DIFFICULTY.crocTelegraphMs,
					expiresAt: now + DIFFICULTY.crocTelegraphMs + DIFFICULTY.crocLethalMs
				};
			}

			const scaledInterval =
				DIFFICULTY.crocBaseIntervalMs / DIFFICULTY.crocFrequencyScale ** Math.max(0, level - 3);
			nextCrocAt = now + Math.max(DIFFICULTY.crocMinIntervalMs, scaledInterval);
		}
	}

	function updateFloaters(now: number) {
		floaters = floaters.filter((floater) => now - floater.bornAt < DIFFICULTY.floaterMs);
	}

	function detectCollisions(now: number) {
		settleHop(now);
		if (isHopping(now) || frog.row === START_ROW || frog.row === MEDIAN_ROW) return;

		if (RIVER_ROWS.includes(frog.row as (typeof RIVER_ROWS)[number])) {
			const lane = getLaneByRow(frog.row);
			const support = lane ? getSupportOccupant(lane, frog.x + 0.5, now) : null;
			if (!support) {
				loseLife('drown');
			}
			return;
		}

		if (ROAD_ROWS.includes(frog.row as (typeof ROAD_ROWS)[number])) {
			const lane = getLaneByRow(frog.row);
			if (!lane) return;

			const frogLeft = frog.x + 0.15;
			const frogRight = frog.x + 0.85;

			for (const occupant of lane.occupants) {
				const vehicleLeft = occupant.x;
				const vehicleRight = occupant.x + occupant.width;
				if (frogRight > vehicleLeft && frogLeft < vehicleRight) {
					loseLife('squish');
					return;
				}
			}
		}
	}

	function tickGame(now: number) {
		raf = requestAnimationFrame(tickGame);

		if (!lastNow) lastNow = now;
		const dt = Math.min(48, now - lastNow);
		lastNow = now;

		if (!gameScreen || paused) {
			draw(now);
			return;
		}

		updateLanes(dt);
		updateFrogRide(dt, now);
		updateTimer(dt);
		updateChaosElements(now);
		updateFloaters(now);
		detectCollisions(now);
		draw(now);
	}

	function drawRowBackgrounds(context: CanvasRenderingContext2D, cell: number) {
		context.fillStyle = '#166534';
		context.fillRect(0, 0, cell * GRID_SIZE, cell * GRID_SIZE);

		for (let row = 0; row < GRID_SIZE; row += 1) {
			if (RIVER_ROWS.includes(row as (typeof RIVER_ROWS)[number])) {
				context.fillStyle = '#0ea5e9';
			} else if (ROAD_ROWS.includes(row as (typeof ROAD_ROWS)[number])) {
				context.fillStyle = '#1f2937';
			} else {
				context.fillStyle = '#84cc16';
			}

			context.fillRect(0, row * cell, cell * GRID_SIZE, cell);
		}

		context.fillStyle = '#14532d';
		context.fillRect(0, 0, cell * GRID_SIZE, cell);

		for (const dot of groundDots) {
			context.globalAlpha = dot.alpha;
			context.fillStyle = '#365314';
			context.beginPath();
			context.arc(dot.x * cell, dot.y * cell, dot.radius * cell, 0, Math.PI * 2);
			context.fill();
			context.globalAlpha = 1;
		}

		for (const roadRow of ROAD_ROWS) {
			context.save();
			context.strokeStyle = '#f8fafc';
			context.lineWidth = Math.max(2, cell * 0.05);
			context.setLineDash([cell / 3, cell / 3]);
			context.beginPath();
			context.moveTo(0, roadRow * cell + cell - 2);
			context.lineTo(cell * GRID_SIZE, roadRow * cell + cell - 2);
			context.stroke();
			context.restore();
		}

		context.strokeStyle = '#000000';
		context.lineWidth = 2;
		for (let i = 0; i <= GRID_SIZE; i += 1) {
			context.globalAlpha = 0.22;
			context.beginPath();
			context.moveTo(i * cell, 0);
			context.lineTo(i * cell, cell * GRID_SIZE);
			context.stroke();
			context.beginPath();
			context.moveTo(0, i * cell);
			context.lineTo(cell * GRID_SIZE, i * cell);
			context.stroke();
			context.globalAlpha = 1;
		}
	}

	function drawRoundedRect(
		context: CanvasRenderingContext2D,
		x: number,
		y: number,
		width: number,
		height: number,
		radius: number
	) {
		context.beginPath();
		context.moveTo(x + radius, y);
		context.lineTo(x + width - radius, y);
		context.quadraticCurveTo(x + width, y, x + width, y + radius);
		context.lineTo(x + width, y + height - radius);
		context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
		context.lineTo(x + radius, y + height);
		context.quadraticCurveTo(x, y + height, x, y + height - radius);
		context.lineTo(x, y + radius);
		context.quadraticCurveTo(x, y, x + radius, y);
		context.closePath();
	}

	function drawHomePads(context: CanvasRenderingContext2D, cell: number, now: number) {
		for (let index = 0; index < HOME_PAD_COLS.length; index += 1) {
			const col = HOME_PAD_COLS[index];
			const x = col * cell + cell * 0.08;
			const y = cell * 0.08;
			const size = cell * 0.84;

			context.fillStyle = '#22c55e';
			context.strokeStyle = '#000000';
			context.lineWidth = 4;
			drawRoundedRect(context, x, y, size, size, cell * 0.18);
			context.fill();
			context.stroke();

			context.textAlign = 'center';
			context.textBaseline = 'middle';

			if (homePads[index] === 'filled') {
				context.font = `${cell * 0.64}px serif`;
				context.fillText('🐸', col * cell + cell / 2, cell / 2 + 1);
			} else if (activeFly?.padIndex === index) {
				context.font = `${cell * 0.62}px serif`;
				context.fillText('🪰', col * cell + cell / 2, cell / 2 + 1);
			} else if (activeCroc?.padIndex === index) {
				const lethal = now >= activeCroc.lethalAt;
				context.fillStyle = lethal ? '#ef4444' : '#fde047';
				context.fillRect(x + cell * 0.08, y + cell * 0.08, size - cell * 0.16, size - cell * 0.16);
				context.font = `${cell * 0.62}px serif`;
				context.fillText('🐊', col * cell + cell / 2, cell / 2 + 1);
			}
		}
	}

	function drawVehicle(
		context: CanvasRenderingContext2D,
		occupant: LaneOccupant,
		row: number,
		cell: number
	) {
		const x = occupant.x * cell;
		const y = row * cell + cell * 0.17;
		const width = occupant.width * cell;
		const height = cell * 0.66;

		context.fillStyle = '#000000';
		context.fillRect(x + 4, y + 4, width, height);
		context.fillStyle = occupant.color;
		context.strokeStyle = '#000000';
		context.lineWidth = 4;
		context.fillRect(x, y, width, height);
		context.strokeRect(x, y, width, height);
		context.font = `${cell * 0.42}px serif`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText(occupant.glyph, x + width / 2, y + height / 2 + 1);
	}

	function drawLog(
		context: CanvasRenderingContext2D,
		occupant: LaneOccupant,
		row: number,
		cell: number
	) {
		const x = occupant.x * cell;
		const y = row * cell + cell * 0.19;
		const width = occupant.width * cell;
		const height = cell * 0.62;

		context.fillStyle = '#000000';
		drawRoundedRect(context, x + 4, y + 4, width, height, cell * 0.2);
		context.fill();
		context.fillStyle = '#92400e';
		context.strokeStyle = '#000000';
		context.lineWidth = 4;
		drawRoundedRect(context, x, y, width, height, cell * 0.2);
		context.fill();
		context.stroke();
		context.font = `${cell * 0.38}px serif`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';

		const glyphs = Math.max(1, Math.floor(occupant.width));
		for (let i = 0; i < glyphs; i += 1) {
			context.fillText('🪵', x + ((i + 0.5) * width) / glyphs, y + height / 2);
		}
	}

	function drawTurtle(
		context: CanvasRenderingContext2D,
		occupant: LaneOccupant,
		row: number,
		cell: number,
		now: number
	) {
		const submerged = isTurtleSubmerged(occupant, now);
		const x = occupant.x * cell;
		const y = row * cell + cell * 0.22;
		const width = occupant.width * cell;
		const height = cell * 0.56;

		context.save();
		context.globalAlpha = submerged ? 0.35 : 1;
		context.fillStyle = '#000000';
		context.fillRect(x + 4, y + 4, width, height);
		context.fillStyle = '#22c55e';
		context.strokeStyle = '#000000';
		context.lineWidth = 4;
		context.fillRect(x, y, width, height);
		context.strokeRect(x, y, width, height);
		context.font = `${cell * 0.38}px serif`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';

		const turtles = Math.max(1, Math.floor(occupant.width));
		for (let i = 0; i < turtles; i += 1) {
			context.fillText(submerged ? '💧' : '🐢', x + ((i + 0.5) * width) / turtles, y + height / 2);
		}
		context.restore();
	}

	function drawOccupants(context: CanvasRenderingContext2D, cell: number, now: number) {
		for (const lane of world.lanes) {
			for (const occupant of lane.occupants) {
				if (occupant.x > GRID_SIZE + 1 || occupant.x + occupant.width < -1) continue;

				if (occupant.type === 'vehicle') {
					drawVehicle(context, occupant, lane.row, cell);
				} else if (occupant.type === 'log') {
					drawLog(context, occupant, lane.row, cell);
				} else {
					drawTurtle(context, occupant, lane.row, cell, now);
				}
			}
		}
	}

	function getFrogDrawPosition(now: number) {
		if (!frog.animFrom) {
			return {
				x: frog.x,
				y: frog.y
			};
		}

		const t = Math.min(1, Math.max(0, (now - frog.animStartedAt) / HOP_MS));
		const eased = 1 - (1 - t) ** 3;
		return {
			x: frog.animFrom.x + (frog.x - frog.animFrom.x) * eased,
			y: frog.animFrom.y + (frog.y - frog.animFrom.y) * eased
		};
	}

	function drawFrog(context: CanvasRenderingContext2D, cell: number, now: number) {
		const position = getFrogDrawPosition(now);
		context.font = `${cell * 0.9}px serif`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText('🐸', position.x * cell + cell / 2, position.y * cell + cell / 2 + 1);
	}

	function drawFloaters(context: CanvasRenderingContext2D, cell: number, now: number) {
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.font = `${cell * 0.34}px monospace`;

		for (const floater of floaters) {
			const age = now - floater.bornAt;
			const progress = Math.min(1, age / DIFFICULTY.floaterMs);
			const x = floater.x * cell + cell / 2;
			const y = floater.y * cell + cell / 2 - progress * cell * 0.9;

			context.globalAlpha = 1 - progress;
			context.lineWidth = 4;
			context.strokeStyle = '#000000';
			context.fillStyle = '#fde047';
			context.strokeText(floater.text, x, y);
			context.fillText(floater.text, x, y);
			context.globalAlpha = 1;
		}
	}

	function draw(now = performance.now()) {
		if (!ctx || !canvasEl) return;

		const cell = cellSize;
		const width = cell * GRID_SIZE;
		const height = cell * GRID_SIZE;

		ctx.clearRect(0, 0, width, height);
		drawRowBackgrounds(ctx, cell);
		drawHomePads(ctx, cell, now);
		drawOccupants(ctx, cell, now);
		drawFrog(ctx, cell, now);
		drawFloaters(ctx, cell, now);
	}

	function createGroundDots() {
		const dots: GroundDot[] = [];
		for (let i = 0; i < 48; i += 1) {
			const safeRow = randomItem([MEDIAN_ROW, START_ROW]);
			dots.push({
				x: randomBetween(0, GRID_SIZE),
				y: safeRow + randomBetween(0.1, 0.9),
				radius: randomBetween(0.025, 0.055),
				alpha: randomBetween(0.2, 0.42)
			});
		}
		return dots;
	}

	function syncCanvasMetrics() {
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		cellSize = Math.max(
			20,
			Math.floor(Math.min((viewportWidth - 24) / GRID_SIZE, viewportHeight / 16))
		);
		groundDots = createGroundDots();

		if (canvasEl) {
			canvasEl.width = cellSize * GRID_SIZE;
			canvasEl.height = cellSize * GRID_SIZE;
		}

		if (playfieldEl) {
			playfieldEl.style.setProperty('--cell', `${cellSize}px`);
		}

		draw(performance.now());
	}

	async function prepareCanvasSoon() {
		await tick();
		ctx = canvasEl?.getContext('2d') ?? null;
		syncCanvasMetrics();
	}

	function ensureAudioCtx() {
		if (!audioCtx) {
			audioCtx = new AudioContext();
		}
		return audioCtx;
	}

	function resumeAudioIfAllowed() {
		if (muted || !audioCtx || audioCtx.state !== 'suspended') return;
		audioCtx.resume();
	}

	function playTone(
		frequency: number,
		duration: number,
		type: OscillatorType = 'square',
		volume = 0.06
	) {
		if (muted) return;

		const audio = ensureAudioCtx();
		const oscillator = audio.createOscillator();
		const gain = audio.createGain();
		oscillator.type = type;
		oscillator.frequency.value = frequency;
		gain.gain.setValueAtTime(volume, audio.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
		oscillator.connect(gain);
		gain.connect(audio.destination);
		oscillator.start(audio.currentTime);
		oscillator.stop(audio.currentTime + duration);
	}

	function playHopSound() {
		playTone(440, 0.08, 'square', 0.05);
	}

	function playDrownSound() {
		if (muted) return;

		const audio = ensureAudioCtx();
		const oscillator = audio.createOscillator();
		const gain = audio.createGain();
		oscillator.type = 'sine';
		oscillator.frequency.setValueAtTime(600, audio.currentTime);
		oscillator.frequency.exponentialRampToValueAtTime(100, audio.currentTime + 0.3);
		gain.gain.setValueAtTime(0.1, audio.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.3);
		oscillator.connect(gain);
		gain.connect(audio.destination);
		oscillator.start(audio.currentTime);
		oscillator.stop(audio.currentTime + 0.3);
	}

	function playSquishSound() {
		if (muted) return;

		const audio = ensureAudioCtx();
		const bufferSize = audio.sampleRate * 0.15;
		const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < bufferSize; i += 1) {
			data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
		}
		const source = audio.createBufferSource();
		const gain = audio.createGain();
		source.buffer = buffer;
		gain.gain.setValueAtTime(0.14, audio.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.15);
		source.connect(gain);
		gain.connect(audio.destination);
		source.start(audio.currentTime);
	}

	function playCrossingSound() {
		playTone(523.25, 0.1, 'square', 0.07);
		setTimeout(() => playTone(783.99, 0.12, 'square', 0.07), 90);
	}

	function playLevelClearSound() {
		[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
			setTimeout(() => playTone(frequency, 0.12, 'square', 0.08), index * 95);
		});
	}

	function toggleMuted() {
		muted = !muted;
		try {
			localStorage.setItem(FROG_MUTED_KEY, muted ? 'true' : 'false');
		} catch {
			// Ignore restricted storage contexts.
		}

		if (!muted) {
			ensureAudioCtx();
			resumeAudioIfAllowed();
		}
	}

	async function focusMenuSoon() {
		await tick();
		focusFirstControlItem(MENU_BUTTON_SELECTOR, true);
	}

	async function focusFrogModalSoon() {
		await tick();
		focusFirstControlItem(FROG_MODAL_BUTTON_SELECTOR, true);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (showFrogModal) {
			handleLinearMenuKeydown(event, {
				enabled: true,
				onBack: () => {
					showFrogModal = false;
					focusMenuSoon();
				},
				selector: FROG_MODAL_BUTTON_SELECTOR
			});
			return;
		}

		if (
			handleLinearMenuKeydown(event, {
				enabled: menuScreen,
				onBack: handleReturnAction,
				selector: MENU_BUTTON_SELECTOR
			})
		) {
			return;
		}

		if (!gameScreen || event.repeat) return;

		const key = normalizeKey(event.key);

		if (event.key === KEY_SPACE) {
			event.preventDefault();
			togglePause();
			return;
		}

		if (key === 'w' || key === 'W') {
			event.preventDefault();
			hop('up');
		} else if (key === 's' || key === 'S') {
			event.preventDefault();
			hop('down');
		} else if (key === 'a' || key === 'A') {
			event.preventDefault();
			hop('left');
		} else if (key === 'd' || key === 'D') {
			event.preventDefault();
			hop('right');
		}
	}

	function handleVisibilityChange() {
		if (document.hidden && gameScreen) {
			paused = true;
			draw(performance.now());
		}
	}

	onMount(() => {
		touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

		try {
			const storedMuted = localStorage.getItem(FROG_MUTED_KEY);
			muted = storedMuted === null ? touchCapable : storedMuted === 'true';
		} catch {
			muted = touchCapable;
		}

		highScore = readCabinetScore(localStorage, cabinet);
		previousHighScore = highScore;
		resetChaosSchedule();
		focusMenuSoon();

		const gamepad = createUnifiedGamepadPoller({
			intervalMs: () => (touchCapable ? 120 : 80),
			shouldStart: () => !document.hidden,
			onUp: () =>
				gameScreen
					? hop('up')
					: moveLinearFocus(-1, showFrogModal ? FROG_MODAL_BUTTON_SELECTOR : MENU_BUTTON_SELECTOR),
			onDown: () =>
				gameScreen
					? hop('down')
					: moveLinearFocus(1, showFrogModal ? FROG_MODAL_BUTTON_SELECTOR : MENU_BUTTON_SELECTOR),
			onLeft: () =>
				gameScreen
					? hop('left')
					: moveLinearFocus(-1, showFrogModal ? FROG_MODAL_BUTTON_SELECTOR : MENU_BUTTON_SELECTOR),
			onRight: () =>
				gameScreen
					? hop('right')
					: moveLinearFocus(1, showFrogModal ? FROG_MODAL_BUTTON_SELECTOR : MENU_BUTTON_SELECTOR),
			onSelect: () =>
				gameScreen
					? togglePause()
					: activateFocusedControlItem(
							showFrogModal ? FROG_MODAL_BUTTON_SELECTOR : MENU_BUTTON_SELECTOR
						),
			onBack: () => {
				if (showFrogModal) {
					showFrogModal = false;
					focusMenuSoon();
					return;
				}
				handleReturnAction();
			}
		});

		const handleGamepadChange = () => {
			gamepad.sync();
		};

		const handleResize = () => {
			syncCanvasMetrics();
		};

		window.addEventListener('resize', handleResize);
		window.addEventListener('gamepadconnected', handleGamepadChange);
		window.addEventListener('gamepaddisconnected', handleGamepadChange);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		gamepad.sync();
		raf = requestAnimationFrame(tickGame);

		return () => {
			cancelAnimationFrame(raf);
			gamepad.destroy();
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('gamepadconnected', handleGamepadChange);
			window.removeEventListener('gamepaddisconnected', handleGamepadChange);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			audioCtx?.close();
			audioCtx = null;
		};
	});
</script>

<svelte:head>
	<title>Frog Chaos | Classic River Crossing Arcade</title>
	<meta
		name="description"
		content="Hop across traffic, ride logs, dodge turtles and claim every home pad in Frog Chaos."
	/>
	<meta property="og:title" content="Frog Chaos - Retro Frogger Cabinet" />
	<meta
		property="og:description"
		content="A fast, chaotic Frogger-style cabinet with flies, crocodiles, and brutal arcade scoring."
	/>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div
	class="relative min-h-screen overflow-hidden bg-lime-400 px-2 py-2 font-mono text-black sm:px-6 sm:py-6"
>
	{#if splashScreen}
		<div class="flex min-h-[calc(100vh-1rem)] items-center justify-center">
			<div
				class="w-full max-w-5xl border-4 border-black bg-white p-3 shadow-[4px_4px_0_rgba(0,0,0,1)] sm:p-10 sm:shadow-[14px_14px_0_rgba(0,0,0,1)]"
			>
				<div class="mb-4 text-center sm:mb-8">
					<div
						class="mb-1 text-[0.6rem] font-black tracking-[0.45em] text-black/60 uppercase sm:mb-3 sm:text-sm"
					>
						Game Chaos
					</div>
					<h1
						class="text-4xl leading-none font-black uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:text-7xl sm:drop-shadow-[4px_4px_0_rgba(0,0,0,1)]"
					>
						🐸 FROG CHAOS 🐸
					</h1>
					<p class="mt-2 text-sm font-bold uppercase sm:mt-4 sm:text-2xl">REACH ALL 5 PADS</p>
				</div>

				<div class="grid gap-3 sm:grid-cols-[1.2fr_0.8fr] sm:gap-4">
					<div
						class="border-4 border-black bg-lime-200 p-3 text-[0.68rem] leading-relaxed font-bold uppercase sm:p-5 sm:text-base"
					>
						ARROWS / WASD HOP ONE CELL. SPACE PAUSES. RIDE LOGS, TRUST SOME TURTLES, FEAR ALL
						TRAFFIC.
						<span class="mt-2 block text-black/70 sm:mt-4">
							A / ENTER = SELECT • B / ESC = RETURN
						</span>
						{#if touchCapable}
							<span class="mt-2 block text-black/70">TOUCH D-PAD ARMED BELOW THE CANVAS.</span>
						{/if}
					</div>

					<div class="border-4 border-black bg-black p-3 text-lime-300 sm:p-5">
						<div class="text-[0.6rem] font-black tracking-[0.35em] text-lime-300/70 uppercase">
							Current High Score
						</div>
						<div class="mt-2 text-4xl font-black sm:text-6xl">{highScore.toLocaleString()}</div>
						<div class="mt-1 text-sm font-bold uppercase sm:text-lg">Hi-Score</div>
					</div>
				</div>

				<div class="mt-4 flex flex-col gap-2 sm:mt-8 sm:gap-4">
					{#if hasActiveRun}
						<button
							data-menu-button
							onclick={continueGame}
							class="border-2 border-lime-400 bg-black px-4 py-3 text-lg font-black text-lime-300 uppercase transition-all hover:scale-[1.02] hover:bg-lime-300 hover:text-black focus:scale-[1.02] focus:bg-lime-300 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-5 sm:text-3xl sm:focus-visible:ring-offset-4"
						>
							CONTINUE
						</button>
						<button
							data-menu-button
							onclick={startGame}
							class="border-2 border-black bg-white px-4 py-2 text-base font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-lime-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-4 sm:text-2xl sm:focus-visible:ring-offset-4"
						>
							START
						</button>
					{:else}
						<button
							data-menu-button
							onclick={startGame}
							class="border-2 border-lime-400 bg-black px-4 py-3 text-lg font-black text-lime-300 uppercase transition-all hover:scale-[1.02] hover:bg-lime-300 hover:text-black focus:scale-[1.02] focus:bg-lime-300 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-5 sm:text-3xl sm:focus-visible:ring-offset-4"
						>
							START
						</button>
					{/if}

					<button
						data-menu-button
						onclick={() => {
							showFrogModal = true;
							focusFrogModalSoon();
						}}
						class="border-2 border-black bg-fuchsia-400 px-4 py-2 text-base font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-fuchsia-300 focus:scale-[1.02] focus:bg-black focus:text-fuchsia-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-lime-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-4 sm:text-2xl sm:focus-visible:ring-offset-4"
					>
						DO NOT CLICK THIS FROG
					</button>

					<button
						data-menu-button
						onclick={backToDashboard}
						class="border-2 border-black bg-white px-4 py-2 text-base font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-lime-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-4 sm:text-2xl sm:focus-visible:ring-offset-4"
					>
						BACK
					</button>
				</div>
			</div>
		</div>
	{:else if endScreen}
		<div class="flex min-h-[calc(100vh-1rem)] items-center justify-center">
			<div
				class="w-full max-w-5xl border-4 border-black bg-white p-3 text-black shadow-[4px_4px_0_rgba(0,0,0,1)] sm:p-10 sm:shadow-[14px_14px_0_rgba(0,0,0,1)]"
			>
				<div class="mb-4 text-center sm:mb-8">
					<div
						class="mb-1 text-[0.6rem] font-black tracking-[0.45em] text-black/60 uppercase sm:mb-3 sm:text-sm"
					>
						FROG CHAOS
					</div>
					<h1
						class="text-4xl leading-none font-black uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:text-7xl sm:drop-shadow-[4px_4px_0_rgba(0,0,0,1)]"
					>
						GAME OVER
					</h1>
					{#if newBest}
						<p class="mt-2 animate-pulse text-xl font-black text-fuchsia-600 uppercase sm:text-3xl">
							NEW BEST!
						</p>
					{/if}
				</div>

				<div class="grid gap-3 sm:grid-cols-2 sm:gap-4">
					<div class="border-4 border-black bg-black p-3 text-lime-300 sm:p-5">
						<div class="text-[0.6rem] font-black tracking-[0.35em] text-lime-300/70 uppercase">
							Final Score
						</div>
						<div class="mt-2 text-4xl font-black sm:text-6xl">{score.toLocaleString()}</div>
						<div class="mt-1 text-sm font-bold uppercase sm:text-lg">
							Level {level} • Pads {homePads.filter(Boolean).length}/5
						</div>
					</div>

					<div class="border-4 border-black bg-black p-3 text-yellow-300 sm:p-5">
						<div class="text-[0.6rem] font-black tracking-[0.35em] text-yellow-300/70 uppercase">
							Hi-Score
						</div>
						<div class="mt-2 text-4xl font-black sm:text-6xl">{highScore.toLocaleString()}</div>
						<div class="mt-1 text-sm font-bold uppercase sm:text-lg">Session recorded</div>
					</div>
				</div>

				<div class="mt-4 flex flex-col gap-2 sm:mt-8 sm:gap-4">
					<button
						data-menu-button
						onclick={handlePlayAgain}
						class="border-2 border-lime-400 bg-black px-4 py-3 text-lg font-black text-lime-300 uppercase transition-all hover:scale-[1.02] hover:bg-lime-300 hover:text-black focus:scale-[1.02] focus:bg-lime-300 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-5 sm:text-3xl sm:focus-visible:ring-offset-4"
					>
						PLAY AGAIN
					</button>
					<button
						data-menu-button
						onclick={backToDashboard}
						class="border-2 border-black bg-white px-4 py-2 text-base font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-lime-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-4 sm:text-2xl sm:focus-visible:ring-offset-4"
					>
						BACK TO ARCADE
					</button>
				</div>
			</div>
		</div>
	{:else}
		<div class="mx-auto flex min-h-[calc(100vh-1rem)] w-full max-w-5xl flex-col items-center gap-2">
			<div
				class="grid w-full grid-cols-2 gap-2 border-4 border-black bg-lime-300 p-2 text-[0.62rem] font-black uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] sm:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] sm:text-sm"
			>
				<div class="border-[3px] border-black bg-black px-2 py-1 text-lime-300">
					Lives <span class="text-white">🐸 × {lives}</span>
				</div>
				<div class="border-[3px] border-black bg-black px-2 py-1 text-lime-300">
					Score <span class="text-white">{score.toLocaleString()}</span>
				</div>
				<div class="border-[3px] border-black bg-black px-2 py-1 text-lime-300">
					Timer <span class="text-white">{secondsLeft}s</span>
				</div>
				<div class="border-[3px] border-black bg-black px-2 py-1 text-lime-300">
					Level <span class="text-white">{level}</span>
				</div>
				<button
					type="button"
					onclick={toggleMuted}
					class="border-[3px] border-black bg-white px-2 py-1 text-black hover:bg-black hover:text-white focus:bg-black focus:text-white focus:outline-none"
					aria-pressed={muted}
				>
					{muted ? 'MUTE' : 'SOUND'}
				</button>
				<button
					type="button"
					onclick={togglePause}
					class="border-[3px] border-black bg-white px-2 py-1 text-black hover:bg-black hover:text-white focus:bg-black focus:text-white focus:outline-none"
					aria-pressed={paused}
				>
					||
				</button>
				<div class="col-span-2 h-3 border-[3px] border-black bg-white sm:col-span-6">
					<div class="h-full bg-fuchsia-500" style:width={`${timerPercent}%`}></div>
				</div>
			</div>

			<div
				bind:this={playfieldEl}
				class="relative border-4 border-black bg-black shadow-[8px_8px_0_rgba(0,0,0,1)]"
				style={`--cell: ${cellSize}px; width: calc(var(--cell) * 13); height: calc(var(--cell) * 13);`}
			>
				<canvas
					bind:this={canvasEl}
					width={canvasPixels}
					height={canvasPixels}
					class:opacity-40={paused}
					class="block h-full w-full bg-black transition-opacity"
					aria-label="Frog Chaos playfield"
				></canvas>

				{#if paused}
					<div class="absolute inset-0 flex items-center justify-center bg-black/35">
						<div
							class="border-4 border-black bg-yellow-300 px-5 py-3 text-3xl font-black uppercase shadow-[6px_6px_0_rgba(0,0,0,1)] sm:text-5xl"
						>
							PAUSED
						</div>
					</div>
				{/if}
			</div>

			<div
				class="w-full max-w-[calc(var(--cell,32px)*13)] border-4 border-black bg-black px-3 py-2 text-center text-[0.62rem] font-black text-lime-300 uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] sm:text-xs"
			>
				ARROWS / WASD HOP • SPACE / A PAUSE • ESC / B BACK
			</div>

			{#if touchCapable && gameScreen}
				<div class="mt-1 grid grid-cols-3 grid-rows-3 gap-2">
					<div></div>
					<button
						type="button"
						onpointerdown={() => hop('up')}
						class="flex h-14 w-16 items-center justify-center border-4 border-black bg-white text-2xl font-black text-black shadow-[3px_3px_0_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
					>
						↑
					</button>
					<div></div>
					<button
						type="button"
						onpointerdown={() => hop('left')}
						class="flex h-14 w-16 items-center justify-center border-4 border-black bg-white text-2xl font-black text-black shadow-[3px_3px_0_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
					>
						←
					</button>
					<div
						class="flex h-14 w-16 items-center justify-center border-4 border-black bg-lime-300 text-xl font-black"
					>
						🐸
					</div>
					<button
						type="button"
						onpointerdown={() => hop('right')}
						class="flex h-14 w-16 items-center justify-center border-4 border-black bg-white text-2xl font-black text-black shadow-[3px_3px_0_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
					>
						→
					</button>
					<div></div>
					<button
						type="button"
						onpointerdown={() => hop('down')}
						class="flex h-14 w-16 items-center justify-center border-4 border-black bg-white text-2xl font-black text-black shadow-[3px_3px_0_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
					>
						↓
					</button>
					<div></div>
				</div>
			{/if}
		</div>
	{/if}

	{#if showFrogModal}
		<div class="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
			<div
				class="w-full max-w-xl border-4 border-black bg-fuchsia-300 p-5 text-center shadow-[10px_10px_0_rgba(0,0,0,1)]"
			>
				<div class="text-5xl">🐸</div>
				<p class="mt-4 text-xl font-black uppercase sm:text-3xl">
					🐸 YOU DISOBEYED. THE FROG IS DISAPPOINTED.
				</p>
				<button
					data-frog-modal-button
					onclick={() => {
						showFrogModal = false;
						focusMenuSoon();
					}}
					class="mt-5 w-full border-4 border-black bg-black px-5 py-3 text-xl font-black text-fuchsia-300 uppercase hover:bg-white hover:text-black focus:bg-white focus:text-black focus:outline-none"
				>
					OK FINE
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background: #84cc16;
	}
</style>
