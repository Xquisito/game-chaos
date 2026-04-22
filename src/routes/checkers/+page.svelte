<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';

	type PieceType = 'black' | 'white';
	type Piece = { type: PieceType; isKing: boolean } | null;
	type Cell = Piece;
	type Difficulty = 'easy' | 'medium' | 'hard' | 'human';
	type Screen = 'splash' | 'game' | 'end';

	const SIZE = 8;
	const WINS_STORAGE_KEY = 'checkers-wins';
	const MENU_BUTTON_SELECTOR = '[data-menu-button]:not([disabled])';
	const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'human'];

	let board = $state<Cell[][]>([]);
	let selectedCell = $state<{ r: number; c: number } | null>(null);
	let turn = $state<PieceType>('white');
	let gameOver = $state(false);
	let winner = $state<PieceType | null>(null);
	let difficulty = $state<Difficulty>('easy');
	let selectedDifficulty = $state<Difficulty>('easy');
	let isAiThinking = $state(false);
	let screen = $state<Screen>('splash');
	let hasActiveRun = $state(false);
	let wins = $state(0);
	let aiTurnToken = 0;

	let splashScreen = $derived(screen === 'splash');
	let gameScreen = $derived(screen === 'game');
	let endScreen = $derived(screen === 'end');
	let menuScreen = $derived(splashScreen || endScreen);
	let activeDifficultyLabel = $derived(formatDifficulty(difficulty));
	let queuedDifficultyLabel = $derived(formatDifficulty(selectedDifficulty));

	function formatDifficulty(value: Difficulty) {
		return value === 'human' ? '2 Players' : `${value.toUpperCase()} AI`;
	}

	function createBoard() {
		const nextBoard: Cell[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

		for (let r = 0; r < SIZE; r += 1) {
			for (let c = 0; c < SIZE; c += 1) {
				if ((r + c) % 2 === 0) continue;

				if (r < 3) {
					nextBoard[r][c] = { type: 'black', isKing: false };
				} else if (r > 4) {
					nextBoard[r][c] = { type: 'white', isKing: false };
				}
			}
		}

		return nextBoard;
	}

	function initGame() {
		aiTurnToken += 1;
		board = createBoard();
		turn = 'white';
		gameOver = false;
		winner = null;
		selectedCell = null;
		isAiThinking = false;
	}

	function persistWins() {
		try {
			localStorage.setItem(WINS_STORAGE_KEY, String(wins));
		} catch {
			// Ignore storage failures
		}
	}

	function startGame() {
		difficulty = selectedDifficulty;
		initGame();
		hasActiveRun = true;
		screen = 'game';
	}

	function continueGame() {
		if (!hasActiveRun || board.length === 0) return;

		isAiThinking = false;
		aiTurnToken += 1;
		screen = 'game';
		scheduleAiIfNeeded();
	}

	function retryGame() {
		selectedDifficulty = difficulty;
		startGame();
	}

	function backToDashboard() {
		window.location.href = resolve('/');
	}

	function returnToSplash(preserveRun = false) {
		isAiThinking = false;
		aiTurnToken += 1;
		screen = 'splash';
		selectedDifficulty = difficulty;

		if (preserveRun) {
			hasActiveRun = true;
			focusMenuSoon();
			return;
		}

		hasActiveRun = false;
		selectedCell = null;
		focusMenuSoon();
	}

	function handleReturnAction() {
		if (gameScreen) {
			returnToSplash(true);
			return;
		}

		if (endScreen) {
			returnToSplash(false);
			return;
		}

		backToDashboard();
	}

	function finishGame(nextWinner: PieceType) {
		if (gameOver) return;

		gameOver = true;
		winner = nextWinner;
		hasActiveRun = false;
		selectedCell = null;
		isAiThinking = false;
		aiTurnToken += 1;

		if (nextWinner === 'white') {
			wins += 1;
			persistWins();
		}

		screen = 'end';
		focusMenuSoon();
	}

	function isInsideBoard(r: number, c: number) {
		return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
	}

	function isValidMove(fromR: number, fromC: number, toR: number, toC: number): boolean {
		if (!isInsideBoard(fromR, fromC) || !isInsideBoard(toR, toC)) return false;

		const piece = board[fromR][fromC];
		if (!piece) return false;

		if ((toR + toC) % 2 === 0 || board[toR][toC] !== null) return false;

		const rowDiff = toR - fromR;
		const colDiff = Math.abs(toC - fromC);
		const direction = piece.type === 'white' ? -1 : 1;

		if (colDiff === 1 && (piece.isKing ? Math.abs(rowDiff) === 1 : rowDiff === direction)) {
			return true;
		}

		if (colDiff === 2) {
			const midR = fromR + rowDiff / 2;
			const midC = fromC + (toC - fromC) / 2;
			const midPiece = board[midR][midC];

			if (midPiece && midPiece.type !== piece.type) {
				if (piece.isKing ? Math.abs(rowDiff) === 2 : rowDiff === direction * 2) {
					return true;
				}
			}
		}

		return false;
	}

	function getAllValidMoves(player: PieceType) {
		const moves: { from: { r: number; c: number }; to: { r: number; c: number } }[] = [];

		for (let r = 0; r < SIZE; r += 1) {
			for (let c = 0; c < SIZE; c += 1) {
				const piece = board[r][c];
				if (!piece || piece.type !== player) continue;

				for (let tr = 0; tr < SIZE; tr += 1) {
					for (let tc = 0; tc < SIZE; tc += 1) {
						if (isValidMove(r, c, tr, tc)) {
							moves.push({ from: { r, c }, to: { r: tr, c: tc } });
						}
					}
				}
			}
		}

		return moves;
	}

	function checkGameOver() {
		let whiteExists = false;
		let blackExists = false;

		for (let r = 0; r < SIZE; r += 1) {
			for (let c = 0; c < SIZE; c += 1) {
				if (board[r][c]?.type === 'white') whiteExists = true;
				if (board[r][c]?.type === 'black') blackExists = true;
			}
		}

		if (!whiteExists) {
			finishGame('black');
			return;
		}

		if (!blackExists) {
			finishGame('white');
			return;
		}

		if (getAllValidMoves('white').length === 0) {
			finishGame('black');
			return;
		}

		if (getAllValidMoves('black').length === 0) {
			finishGame('white');
		}
	}

	function executeMove(fromR: number, fromC: number, toR: number, toC: number) {
		const piece = board[fromR][fromC];
		if (!piece) return;

		if (Math.abs(toR - fromR) === 2) {
			const midR = fromR + (toR - fromR) / 2;
			const midC = fromC + (toC - fromC) / 2;
			board[midR][midC] = null;
		}

		board[toR][toC] = piece;
		board[fromR][fromC] = null;

		if (piece.type === 'white' && toR === 0) piece.isKing = true;
		if (piece.type === 'black' && toR === SIZE - 1) piece.isKing = true;

		turn = turn === 'white' ? 'black' : 'white';
		checkGameOver();
		scheduleAiIfNeeded();
	}

	function scheduleAiIfNeeded() {
		if (turn === 'black' && difficulty !== 'human' && gameScreen && !gameOver) {
			runAiTurn();
		}
	}

	function handleCellClick(r: number, c: number) {
		if (!gameScreen || gameOver || isAiThinking || (difficulty !== 'human' && turn === 'black')) {
			return;
		}

		const cell = board[r]?.[c];
		if (!cell && !selectedCell) return;

		if (selectedCell) {
			if (selectedCell.r === r && selectedCell.c === c) {
				selectedCell = null;
				return;
			}

			if (isValidMove(selectedCell.r, selectedCell.c, r, c)) {
				executeMove(selectedCell.r, selectedCell.c, r, c);
				selectedCell = null;
				return;
			}
		}

		if (cell && cell.type === turn) {
			selectedCell = { r, c };
		} else {
			selectedCell = null;
		}
	}

	async function runAiTurn() {
		if (!gameScreen || gameOver || turn !== 'black' || difficulty === 'human') return;

		const runToken = ++aiTurnToken;
		isAiThinking = true;

		await new Promise((resolveAi) => setTimeout(resolveAi, 800));

		if (runToken !== aiTurnToken || !gameScreen || gameOver || turn !== 'black') {
			if (runToken === aiTurnToken) isAiThinking = false;
			return;
		}

		const moves = getAllValidMoves('black');

		if (moves.length === 0) {
			finishGame('white');
			return;
		}

		let selectedMove = moves[0];

		if (difficulty === 'easy') {
			selectedMove = moves[Math.floor(Math.random() * moves.length)];
		} else if (difficulty === 'medium') {
			const jumps = moves.filter((move) => Math.abs(move.to.r - move.from.r) === 2);
			selectedMove =
				jumps.length > 0
					? jumps[Math.floor(Math.random() * jumps.length)]
					: moves[Math.floor(Math.random() * moves.length)];
		} else {
			let bestScore = -Infinity;

			for (const move of moves) {
				let score = 0;
				const isJump = Math.abs(move.to.r - move.from.r) === 2;
				if (isJump) score += 10;

				const piece = board[move.from.r][move.from.c];
				if (piece?.isKing === false && move.to.r === SIZE - 1) score += 5;

				if (score > bestScore) {
					bestScore = score;
					selectedMove = move;
				}
			}
		}

		executeMove(selectedMove.from.r, selectedMove.from.c, selectedMove.to.r, selectedMove.to.c);

		if (runToken === aiTurnToken) {
			isAiThinking = false;
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

	async function focusMenuSoon() {
		await tick();
		// On splash screen, focus the currently selected difficulty button
		const selectedButton = document.querySelector('[data-selected="true"]') as HTMLElement | null;
		if (selectedButton) {
			selectedButton.focus();
			return;
		}
		const firstButton = document.querySelector(MENU_BUTTON_SELECTOR) as HTMLElement | null;
		firstButton?.focus();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' || event.key === 'b' || event.key === 'B') {
			event.preventDefault();
			handleReturnAction();
			return;
		}

		if (menuScreen && (event.key === 'ArrowUp' || event.key === 'ArrowLeft')) {
			event.preventDefault();
			moveFocus(-1);
			return;
		}

		if (menuScreen && (event.key === 'ArrowDown' || event.key === 'ArrowRight')) {
			event.preventDefault();
			moveFocus(1);
			return;
		}

		if (menuScreen && (event.key === 'Enter' || event.key === ' ' || event.key === 'a' || event.key === 'A')) {
			event.preventDefault();
			activateFocusedMenuItem();
		}
	}

	function getCellLabel(r: number, c: number, cell: Cell) {
		const position = `Row ${r + 1}, column ${c + 1}`;
		if (!cell) return `${position}, empty square`;
		return `${position}, ${cell.type} ${cell.isKing ? 'king' : 'piece'}`;
	}

	onMount(() => {
		try {
			const savedWins = localStorage.getItem(WINS_STORAGE_KEY);
			const parsedWins = savedWins ? Number.parseInt(savedWins, 10) : 0;
			wins = Number.isFinite(parsedWins) ? parsedWins : 0;
		} catch {
			wins = 0;
		}

		focusMenuSoon();
	});
</script>

<svelte:head>
	<title>Checkers Chaos | Classic Board Game</title>
	<meta name="description" content="Play Checkers Chaos, a fast-paced version of the classic board game. Challenge the AI or play with a friend in this vintage-style arcade cabinet." />
	<meta property="og:title" content="Checkers Chaos - Strategic Board Battle" />
	<meta property="og:description" content="Master the board in Checkers Chaos. Play against easy, medium, or hard AI and claim your victory!" />
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="relative min-h-screen overflow-hidden bg-orange-400 px-1 py-1 font-mono text-black sm:px-6 sm:py-8">
	{#if splashScreen}
		<div class="flex min-h-[calc(100vh-2rem)] items-center justify-center">
			<div class="w-full max-w-5xl border-4 border-black bg-white p-3 shadow-[4px_4px_0_rgba(0,0,0,1)] sm:p-10 sm:shadow-[14px_14px_0_rgba(0,0,0,1)]">
				<div class="mb-3 text-center sm:mb-8">
					<div class="mb-1 text-[0.6rem] font-black tracking-[0.45em] uppercase text-black/60 sm:mb-3 sm:text-sm">Game Chaos</div>
					<h1 class="text-3xl leading-none font-black uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:text-7xl sm:drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">
						🏁 Checkers Chaos 🏁
					</h1>
					<p class="mt-1 text-sm font-bold uppercase sm:mt-4 sm:text-2xl">Pick white. Pick fights.</p>
				</div>

				<div class="grid gap-3 sm:gap-4 sm:grid-cols-[1.1fr_0.9fr]">
					<div class="border-4 border-black bg-orange-200 p-2 text-[0.65rem] font-bold leading-relaxed uppercase sm:p-5 sm:text-base">
						You play white. Tap/click piece then destination.
						<span class="mt-1 block text-black/70 sm:mt-4">
							A / Enter = select • B / Esc = return.
						</span>
					</div>

					<div class="border-4 border-black bg-black p-2 text-orange-400 sm:p-5">
						<div class="flex items-center justify-between sm:block">
							<div class="text-[0.6rem] font-black tracking-[0.35em] uppercase text-orange-400/70 sm:text-xs">Score Board</div>
							<div class="flex items-baseline gap-2 sm:mt-4 sm:block">
								<div class="text-xl font-black sm:text-5xl">{wins}</div>
								<div class="text-xs font-bold uppercase sm:mt-2 sm:text-lg">Player Wins</div>
							</div>
						</div>
					</div>
				</div>

				<div class="mt-2 border-4 border-black bg-white p-2 sm:mt-8 sm:p-5">
					<div class="mb-2 text-[0.6rem] font-black tracking-[0.3em] uppercase text-black/60 sm:mb-3 sm:text-sm">Difficulty</div>
					<div class="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
						{#each DIFFICULTIES as diff (diff)}
							<button
								type="button"
								data-menu-button
								data-selected={selectedDifficulty === diff ? 'true' : undefined}
								onclick={() => (selectedDifficulty = diff)}
								class={[
									'border-2 px-1 py-1 text-[0.7rem] font-black uppercase transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-4 sm:py-4 sm:text-lg sm:focus-visible:ring-offset-4',
									selectedDifficulty === diff
										? 'border-4 border-orange-500 bg-black text-orange-400 scale-105 hover:scale-110 focus-visible:ring-white focus-visible:ring-offset-white'
										: 'border-black bg-orange-100 text-black hover:scale-[1.02] hover:bg-orange-200 focus:bg-orange-200 focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-white'
								]}
							>
								{diff === 'human' ? '2P' : `${diff} AI`}
							</button>
						{/each}
					</div>
				</div>

				<div class="mt-2 flex flex-col gap-2 sm:mt-8 sm:gap-4">
					{#if hasActiveRun}
						<button
							type="button"
							data-menu-button
							onclick={continueGame}
							class="border-2 border-orange-400 bg-black px-4 py-2 text-base font-black text-orange-400 uppercase transition-all hover:scale-[1.02] hover:bg-orange-400 hover:text-black focus:scale-[1.02] focus:bg-orange-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-5 sm:text-3xl sm:focus-visible:ring-offset-4"
						>
							Continue
						</button>
						<button
							type="button"
							data-menu-button
							onclick={startGame}
							class="border-2 border-black bg-white px-4 py-2 text-base font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-4 sm:text-2xl sm:focus-visible:ring-offset-4"
						>
							New Game
						</button>
					{:else}
						<button
							type="button"
							data-menu-button
							onclick={startGame}
							class="border-2 border-orange-400 bg-black px-4 py-2 text-base font-black text-orange-400 uppercase transition-all hover:scale-[1.02] hover:bg-orange-400 hover:text-black focus:scale-[1.02] focus:bg-orange-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-5 sm:text-3xl sm:focus-visible:ring-offset-4"
						>
							Press Start
						</button>
					{/if}

					<button
						type="button"
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
		<div class="flex min-h-[calc(100vh-3rem)] items-center justify-center">
			<div class="relative w-full max-w-5xl border-4 border-black bg-white p-4 shadow-[14px_14px_0_rgba(0,0,0,1)] sm:p-6">
				<div class="mb-5 flex flex-col gap-3 border-4 border-black bg-black p-3 text-sm font-black uppercase text-orange-400 sm:flex-row sm:items-center sm:justify-between sm:text-lg">
					<div class="flex flex-wrap items-center gap-x-6 gap-y-2">
						<span>{isAiThinking ? 'AI Thinking…' : `Turn ${turn}`}</span>
						<span>{activeDifficultyLabel}</span>
						<span>Wins {wins}</span>
					</div>
					{#if gameScreen}
						<button
							type="button"
							onclick={handleReturnAction}
							class="border-4 border-white bg-orange-400 px-4 py-2 text-sm font-black text-black uppercase transition-all hover:bg-white focus:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-400 focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-[0.98]"
						>
							Return
						</button>
					{/if}
				</div>

				<div class="mx-auto aspect-square border-0 bg-black p-1 sm:border-8 sm:p-2 w-full max-w-lg">
					<div class="grid h-full grid-cols-8 grid-rows-8">
						{#each board as row, r (r)}
							{#each row as cell, c (`${r}-${c}`)}
								<button
									type="button"
									tabindex={-1}
									aria-label={getCellLabel(r, c, cell)}
									onclick={() => handleCellClick(r, c)}
									class={[
										'flex items-center justify-center text-[min(9vw,3.5rem)] transition-all select-none overflow-hidden',
										(r + c) % 2 === 0 ? 'bg-orange-200' : 'bg-orange-800',
										selectedCell?.r === r && selectedCell?.c === c
											? 'z-20 scale-110 ring-4 ring-yellow-400'
											: '',
										gameScreen && !gameOver && !isAiThinking ? 'cursor-pointer' : 'cursor-default'
									]}
								>
									{#if cell}
										<span
											class={[
												cell.type === 'white' ? 'text-white' : 'text-black',
												cell.isKing
													? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]'
													: 'drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)]'
											]}
										>
											{cell.isKing ? '👑' : '●'}
										</span>
									{/if}
								</button>
							{/each}
						{/each}
					</div>
				</div>

				{#if gameScreen}
					<div class="mt-5 text-center text-xs font-bold leading-relaxed uppercase text-black/65 sm:text-sm">
						Need a breather? Esc / B returns to splash and Continue resumes this exact match.
					</div>
				{/if}

				{#if endScreen}
					<div class="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]">
						<div class="w-full max-w-md border-4 border-black bg-white p-6 text-center shadow-[12px_12px_0_rgba(0,0,0,1)] sm:p-8">
							<div class="text-6xl sm:text-7xl">{winner === 'white' ? '🏆' : '💀'}</div>
							<h3 class="mt-4 text-4xl font-black uppercase sm:text-5xl">
								{winner === 'white' ? 'Victory' : 'Defeat'}
							</h3>
							<p class="mt-4 text-sm font-bold leading-relaxed uppercase text-black/70 sm:text-base">
								{winner === 'white'
									? `White takes it. Total wins: ${wins}.`
									: 'Black cleaned the board. Retry or head back to splash.'}
							</p>

							<div class="mt-8 flex flex-col gap-4">
								<button
									type="button"
									data-menu-button
									onclick={retryGame}
									class="border-4 border-orange-400 bg-black px-8 py-4 text-2xl font-black text-orange-400 uppercase transition-all hover:scale-[1.02] hover:bg-orange-400 hover:text-black focus:scale-[1.02] focus:bg-orange-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-[0.98]"
								>
									Retry
								</button>
								<button
									type="button"
									data-menu-button
									onclick={() => returnToSplash(false)}
									class="border-4 border-black bg-white px-8 py-4 text-xl font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-400 focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-[0.98]"
								>
									Back to Splash
								</button>
							</div>

							<div class="mt-6 text-xs font-bold uppercase text-black/60">
								Enter / A to select • Esc / B to return
							</div>
						</div>
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
