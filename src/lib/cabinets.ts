export type GameCabinetId =
	| 'minesweeper'
	| 'sudoku'
	| 'checkers'
	| 'enduro'
	| 'space-chaos'
	| 'breakout-chaos'
	| 'snake-chaos'
	| 'tetris'
	| 'frog-chaos';
export type UtilityCabinetId = 'settings';
export type CabinetId = GameCabinetId | UtilityCabinetId;
export type CabinetHref =
	| '/minesweeper'
	| '/sudoku'
	| '/checkers'
	| '/enduro'
	| '/space-invaders'
	| '/breakout'
	| '/snake'
	| '/tetris'
	| '/frog'
	| '/settings';

export type ScoreMode = 'wins' | 'high-score';

export type GameCabinet = {
	kind: 'game';
	id: GameCabinetId;
	schemaName: string;
	href: CabinetHref;
	emoji: string;
	color: string;
	marquee: string;
	score: {
		mode: ScoreMode;
		storageKey: string;
	};
};

export type UtilityCabinet = {
	kind: 'utility';
	id: UtilityCabinetId;
	href: CabinetHref;
	emoji: string;
	color: string;
	marquee: string;
};

export type Cabinet = GameCabinet | UtilityCabinet;

export const gameCabinets: readonly GameCabinet[] = [
	{
		kind: 'game',
		id: 'minesweeper',
		schemaName: 'Minesweeper Chaos',
		href: '/minesweeper',
		emoji: '💣',
		color: 'bg-red-500',
		marquee: 'bg-red-200',
		score: {
			mode: 'wins',
			storageKey: 'minesweeper-wins'
		}
	},
	{
		kind: 'game',
		id: 'sudoku',
		schemaName: 'Sudoku Chaos',
		href: '/sudoku',
		emoji: '🔢',
		color: 'bg-indigo-500',
		marquee: 'bg-indigo-200',
		score: {
			mode: 'wins',
			storageKey: 'sudoku-wins'
		}
	},
	{
		kind: 'game',
		id: 'checkers',
		schemaName: 'Checkers Chaos',
		href: '/checkers',
		emoji: '🎲',
		color: 'bg-orange-400',
		marquee: 'bg-orange-200',
		score: {
			mode: 'wins',
			storageKey: 'checkers-wins'
		}
	},
	{
		kind: 'game',
		id: 'enduro',
		schemaName: 'Enduro 3D Chaos',
		href: '/enduro',
		emoji: '🏎️',
		color: 'bg-green-500',
		marquee: 'bg-green-200',
		score: {
			mode: 'high-score',
			storageKey: 'enduro-high-score'
		}
	},
	{
		kind: 'game',
		id: 'space-chaos',
		schemaName: 'Space Chaos',
		href: '/space-invaders',
		emoji: '🛸',
		color: 'bg-purple-600',
		marquee: 'bg-fuchsia-200',
		score: {
			mode: 'high-score',
			storageKey: 'space-chaos-high-score'
		}
	},
	{
		kind: 'game',
		id: 'breakout-chaos',
		schemaName: 'Breakout Chaos',
		href: '/breakout',
		emoji: '🧱',
		color: 'bg-orange-500',
		marquee: 'bg-orange-200',
		score: {
			mode: 'high-score',
			storageKey: 'breakout-chaos-high-score'
		}
	},
	{
		kind: 'game',
		id: 'snake-chaos',
		schemaName: 'Snake Chaos',
		href: '/snake',
		emoji: '🐍',
		color: 'bg-emerald-500',
		marquee: 'bg-lime-200',
		score: {
			mode: 'high-score',
			storageKey: 'snake-chaos-high-score'
		}
	},
	{
		kind: 'game',
		id: 'tetris',
		schemaName: 'Tetris Chaos',
		href: '/tetris',
		emoji: '🧱',
		color: 'bg-cyan-500',
		marquee: 'bg-cyan-200',
		score: {
			mode: 'high-score',
			storageKey: 'tetris-chaos-high-score'
		}
	},
	{
		kind: 'game',
		id: 'frog-chaos',
		schemaName: 'Frog Chaos',
		href: '/frog',
		emoji: '🐸',
		color: 'bg-lime-500',
		marquee: 'bg-lime-200',
		score: {
			mode: 'high-score',
			storageKey: 'frog-chaos-high-score'
		}
	}
];

export const utilityCabinets: readonly UtilityCabinet[] = [
	{
		kind: 'utility',
		id: 'settings',
		href: '/settings',
		emoji: '⚙️',
		color: 'bg-sky-400',
		marquee: 'bg-sky-200'
	}
];

export const cabinets: readonly Cabinet[] = [...gameCabinets, ...utilityCabinets];

export const gameCabinetById = Object.fromEntries(
	gameCabinets.map((cabinet) => [cabinet.id, cabinet])
) as Record<GameCabinetId, GameCabinet>;

export const arcadeStructuredData = {
	'@context': 'https://schema.org',
	'@type': 'GameServer',
	name: 'The Chaos Arcade',
	description: 'Uma coleção de jogos vintages e caóticos feitos com SvelteKit.',
	url: 'https://chaos-arcade.pages.dev/',
	genre: ['Arcade', 'Retro', 'Strategy'],
	gameItem: gameCabinets.map((cabinet) => ({
		'@type': 'VideoGame',
		name: cabinet.schemaName
	}))
};

export function createScoreRecord() {
	return Object.fromEntries(gameCabinets.map((cabinet) => [cabinet.id, 0])) as Record<
		GameCabinetId,
		number
	>;
}

type ScoreStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function normalizeScore(score: number) {
	return Number.isFinite(score) ? Math.max(0, Math.trunc(score)) : 0;
}

export function readCabinetScore(storage: Pick<Storage, 'getItem'>, cabinet: GameCabinet) {
	try {
		const stored = storage.getItem(cabinet.score.storageKey);
		const parsed = stored ? Number.parseInt(stored, 10) : 0;

		return normalizeScore(parsed);
	} catch {
		return 0;
	}
}

export function writeCabinetScore(
	storage: Pick<Storage, 'setItem'>,
	cabinet: GameCabinet,
	score: number
) {
	const normalizedScore = normalizeScore(score);

	try {
		storage.setItem(cabinet.score.storageKey, String(normalizedScore));
	} catch {
		// Keep the in-memory game score even when storage is unavailable.
	}

	return normalizedScore;
}

export function recordCabinetWin(
	storage: Pick<Storage, 'setItem'>,
	cabinet: GameCabinet,
	currentWins: number
) {
	return writeCabinetScore(storage, cabinet, currentWins + 1);
}

export function recordCabinetHighScore(storage: ScoreStorage, cabinet: GameCabinet, score: number) {
	const currentHighScore = readCabinetScore(storage, cabinet);
	if (score <= currentHighScore) return currentHighScore;

	return writeCabinetScore(storage, cabinet, score);
}

export function resetCabinetScore(storage: ScoreStorage, cabinet: GameCabinet) {
	try {
		storage.removeItem(cabinet.score.storageKey);
	} catch {
		// Ignore storage failures in private/restricted contexts.
	}
}
