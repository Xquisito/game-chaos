<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import { getCabinetFlow, returnFromCabinet, type CabinetScreen } from '$lib/cabinet-flow';
	import { gameCabinetById, readCabinetScore, recordCabinetWin } from '$lib/cabinets';
	import {
		focusFirstControlItem,
		handleLinearMenuKeydown,
		MENU_BUTTON_SELECTOR
	} from '$lib/unified-controls';

	const BOARD_SIZES = [
		{ label: '10×10', rows: 10, cols: 10 },
		{ label: '12×12', rows: 12, cols: 12 },
		{ label: '15×15', rows: 15, cols: 15 }
	] as const;
	const DIFFICULTIES = [
		{ label: 'Easy', density: 0.12 },
		{ label: 'Medium', density: 0.15 },
		{ label: 'Death Field', density: 0.21 }
	] as const;
	const LONG_PRESS_MS = 360;
	const cabinet = gameCabinetById.minesweeper;

	type CellValue = 'mine' | 'empty' | number;
	type CellState = 'hidden' | 'revealed' | 'flagged';
	type EndMode = 'won' | 'lost' | null;

	interface Cell {
		value: CellValue;
		state: CellState;
	}

	let grid = $state<Cell[][]>([]);
	let screen = $state<CabinetScreen>('splash');
	let endMode = $state<EndMode>(null);
	let hasActiveRun = $state(false);
	let wins = $state(0);
	let selectedBoardIndex = $state(0);
	let selectedDifficultyIndex = $state(1);
	let helpOpen = $state(false);
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let longPressPointerId: number | null = null;
	let longPressCellKey = '';
	let suppressedRevealKeys: string[] = [];

	let flow = $derived(getCabinetFlow(screen));
	let splashScreen = $derived(flow.splashScreen);
	let gameScreen = $derived(flow.gameScreen);
	let endScreen = $derived(flow.endScreen);
	let menuScreen = $derived(flow.menuScreen);
	let gameWon = $derived(endMode === 'won');
	let gameOver = $derived(endMode === 'lost');
	let board = $derived(BOARD_SIZES[selectedBoardIndex]);
	let difficulty = $derived(DIFFICULTIES[selectedDifficultyIndex]);
	let rows = $derived(board.rows);
	let cols = $derived(board.cols);
	let minesCount = $derived(getMineCount(rows, cols, difficulty.density));
	let minesLeft = $derived.by(() => {
		let flagged = 0;
		for (const row of grid) {
			for (const cell of row) {
				if (cell.state === 'flagged') flagged += 1;
			}
		}
		return minesCount - flagged;
	});

	function createEmptyGrid() {
		const nextGrid: Cell[][] = [];

		for (let r = 0; r < rows; r += 1) {
			const row: Cell[] = [];
			for (let c = 0; c < cols; c += 1) {
				row.push({ value: 'empty', state: 'hidden' });
			}
			nextGrid.push(row);
		}

		return nextGrid;
	}

	function getMineCount(rows: number, cols: number, density: number) {
		const totalCells = rows * cols;
		const roundedMines = Math.round(totalCells * density);
		return Math.min(Math.max(roundedMines, 1), totalCells - 1);
	}

	function clearConfiguredRun() {
		hasActiveRun = false;
		endMode = null;
		grid = [];
	}

	function initGame() {
		clearLongPress();
		endMode = null;
		grid = createEmptyGrid();

		let minesPlaced = 0;
		while (minesPlaced < minesCount) {
			const r = Math.floor(Math.random() * rows);
			const c = Math.floor(Math.random() * cols);

			if (grid[r][c].value === 'mine') continue;

			grid[r][c].value = 'mine';
			minesPlaced += 1;
		}

		for (let r = 0; r < rows; r += 1) {
			for (let c = 0; c < cols; c += 1) {
				if (grid[r][c].value === 'mine') continue;

				let count = 0;
				for (let dr = -1; dr <= 1; dr += 1) {
					for (let dc = -1; dc <= 1; dc += 1) {
						if (dr === 0 && dc === 0) continue;

						const nr = r + dr;
						const nc = c + dc;
						if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
						if (grid[nr][nc].value === 'mine') count += 1;
					}
				}

				grid[r][c].value = count === 0 ? 'empty' : count;
			}
		}
	}

	function startGame() {
		initGame();
		hasActiveRun = true;
		screen = 'game';
	}

	function selectBoard(index: number) {
		if (selectedBoardIndex === index) return;

		selectedBoardIndex = index;
		clearConfiguredRun();
	}

	function selectDifficulty(index: number) {
		if (selectedDifficultyIndex === index) return;

		selectedDifficultyIndex = index;
		clearConfiguredRun();
	}

	function continueGame() {
		if (!hasActiveRun || grid.length === 0) return;
		endMode = null;
		screen = 'game';
	}

	function retryGame() {
		startGame();
	}

	function backToDashboard() {
		window.location.href = resolve('/');
	}

	function returnToSplash(preserveRun = false) {
		clearLongPress();
		screen = 'splash';
		focusMenuSoon();

		if (preserveRun) {
			hasActiveRun = true;
			endMode = null;
			return;
		}

		hasActiveRun = false;
		endMode = null;
	}

	function handleReturnAction() {
		returnFromCabinet(flow, {
			toDashboard: backToDashboard,
			toSplash: returnToSplash
		});
	}

	function revealCell(r: number, c: number) {
		if (r < 0 || r >= rows || c < 0 || c >= cols) return;

		const cell = grid[r][c];
		if (cell.state !== 'hidden') return;

		cell.state = 'revealed';

		if (cell.value === 'empty') {
			for (let dr = -1; dr <= 1; dr += 1) {
				for (let dc = -1; dc <= 1; dc += 1) {
					if (dr === 0 && dc === 0) continue;
					revealCell(r + dr, c + dc);
				}
			}
		}
	}

	function revealAllMines() {
		for (const row of grid) {
			for (const cell of row) {
				if (cell.value === 'mine') {
					cell.state = 'revealed';
				}
			}
		}
	}

	function finishWin() {
		if (endMode === 'won') return;

		wins = recordCabinetWin(localStorage, cabinet, wins);
		hasActiveRun = false;
		endMode = 'won';
		screen = 'end';
		focusMenuSoon();
	}

	function finishLoss() {
		hasActiveRun = false;
		endMode = 'lost';
		screen = 'end';
		focusMenuSoon();
	}

	function checkWin() {
		for (const row of grid) {
			for (const cell of row) {
				if (cell.value !== 'mine' && cell.state !== 'revealed') {
					return;
				}
			}
		}

		finishWin();
	}

	function handleReveal(r: number, c: number) {
		if (!gameScreen) return;

		const cell = grid[r]?.[c];
		if (!cell || cell.state !== 'hidden') return;

		if (cell.value === 'mine') {
			revealAllMines();
			finishLoss();
			return;
		}

		revealCell(r, c);
		checkWin();
	}

	function handleFlag(r: number, c: number) {
		if (!gameScreen) return;

		const cell = grid[r]?.[c];
		if (!cell) return;

		if (cell.state === 'hidden') {
			cell.state = 'flagged';
		} else if (cell.state === 'flagged') {
			cell.state = 'hidden';
		}
	}

	function getCellKey(r: number, c: number) {
		return `${r}:${c}`;
	}

	function clearLongPress(event?: PointerEvent) {
		if (event) {
			const element = event.currentTarget;
			if (
				element instanceof HTMLElement &&
				longPressPointerId !== null &&
				element.hasPointerCapture(longPressPointerId)
			) {
				element.releasePointerCapture(longPressPointerId);
			}
		}

		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}

		longPressPointerId = null;
		longPressCellKey = '';
	}

	function handleCellPointerDown(event: PointerEvent, r: number, c: number) {
		if (!gameScreen || event.pointerType === 'mouse') return;

		clearLongPress();
		longPressPointerId = event.pointerId;
		longPressCellKey = getCellKey(r, c);

		const element = event.currentTarget;
		if (element instanceof HTMLElement) {
			element.setPointerCapture(event.pointerId);
		}

		longPressTimer = setTimeout(() => {
			const activeKey = getCellKey(r, c);
			if (longPressCellKey !== activeKey) return;

			if (!suppressedRevealKeys.includes(activeKey)) {
				suppressedRevealKeys.push(activeKey);
			}
			handleFlag(r, c);
			longPressTimer = null;
		}, LONG_PRESS_MS);
	}

	function handleCellPointerEnd(event: PointerEvent) {
		clearLongPress(event);
	}

	function handleCellClick(r: number, c: number) {
		const key = getCellKey(r, c);
		const suppressedIndex = suppressedRevealKeys.indexOf(key);
		if (suppressedIndex !== -1) {
			suppressedRevealKeys.splice(suppressedIndex, 1);
			return;
		}

		handleReveal(r, c);
	}

	function handleCellContextMenu(event: MouseEvent, r: number, c: number) {
		event.preventDefault();
		handleFlag(r, c);
	}

	async function focusMenuSoon() {
		await tick();
		focusFirstControlItem(MENU_BUTTON_SELECTOR, true);
	}

	function handleKeydown(event: KeyboardEvent) {
		handleLinearMenuKeydown(event, {
			enabled: menuScreen,
			onBack: handleReturnAction,
			selector: MENU_BUTTON_SELECTOR
		});
	}

	function getCellLabel(cell: Cell, r: number, c: number) {
		const position = `Row ${r + 1}, column ${c + 1}`;

		if (cell.state === 'flagged') return `${position}, flagged`;
		if (cell.state === 'hidden') return `${position}, hidden`;
		if (cell.value === 'mine') return `${position}, mine`;
		if (cell.value === 'empty') return `${position}, empty`;
		return `${position}, ${cell.value} nearby mines`;
	}

	onMount(() => {
		wins = readCabinetScore(localStorage, cabinet);

		focusMenuSoon();
	});
</script>

<svelte:head>
	<title>Minesweeper Chaos | Vintage Puzzle Game</title>
	<meta
		name="description"
		content="Test your logic with Minesweeper Chaos. A vintage-style minefield puzzle game. Avoid the bombs and clear the grid!"
	/>
	<meta property="og:title" content="Minesweeper Chaos - The Classic Game" />
	<meta
		property="og:description"
		content="Can you clear the 10x10 grid without hitting a mine? Try the most chaotic Minesweeper yet."
	/>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div
	class="relative min-h-screen overflow-hidden bg-yellow-300 px-1 py-1 font-mono text-black sm:px-6 sm:py-8"
>
	{#if splashScreen}
		<div class="flex min-h-[calc(100vh-2rem)] items-center justify-center">
			<div
				class="w-full max-w-4xl border-4 border-black bg-white shadow-[4px_4px_0_rgba(0,0,0,1)] sm:shadow-[14px_14px_0_rgba(0,0,0,1)]"
			>
				<!-- Black header band: title + compact wins counter -->
				<div class="border-b-4 border-black bg-black px-4 py-3 text-yellow-300 sm:px-8 sm:py-5">
					<div class="text-[0.55rem] font-black tracking-[0.4em] uppercase text-yellow-300/50 sm:text-xs">
						Game Chaos
					</div>
					<div class="flex items-center justify-between gap-4">
						<h1
							class="text-xl font-black leading-none uppercase sm:text-5xl sm:drop-shadow-[3px_3px_0_rgba(255,221,0,0.25)]"
						>
							💣 Boom Box 💣
						</h1>
						<div class="shrink-0 text-right">
							<div class="text-[0.5rem] tracking-widest uppercase text-yellow-300/50 sm:text-[0.6rem]">
								Total Wins
							</div>
							<div class="text-lg font-black leading-none sm:text-4xl">{wins}</div>
						</div>
					</div>
					<p class="mt-1 text-[0.65rem] font-bold uppercase text-yellow-300/60 sm:mt-2 sm:text-base">
						Vintage minefield. No mercy.
					</p>
				</div>

				<div class="p-4 sm:p-8">
					<!-- Config: board size + difficulty always side-by-side -->
					<div class="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:gap-4">
						<div class="border-2 border-black bg-yellow-100 p-2 sm:border-4 sm:p-4">
							<div
								class="mb-2 text-[0.55rem] font-black tracking-[0.3em] uppercase text-black/50 sm:mb-3 sm:text-xs"
							>
								Board Size
							</div>
							<div class="flex flex-col gap-1 sm:gap-2">
								{#each BOARD_SIZES as option, index (`${option.rows}x${option.cols}`)}
									<button
										type="button"
										data-menu-button
										onclick={() => selectBoard(index)}
										class={[
											'border-2 border-black px-1.5 py-1.5 text-left text-xs font-black uppercase leading-tight transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 sm:border-4 sm:px-3 sm:py-2 sm:text-base',
											selectedBoardIndex === index
												? 'bg-black text-yellow-300'
												: 'bg-white text-black hover:bg-black hover:text-white focus:bg-black focus:text-white'
										]}
									>
										<span class="block">{option.label}</span>
										<span class="block text-[0.5rem] opacity-60 sm:text-xs">
											{getMineCount(option.rows, option.cols, difficulty.density)} mines
										</span>
									</button>
								{/each}
							</div>
						</div>

						<div class="border-2 border-black bg-yellow-100 p-2 sm:border-4 sm:p-4">
							<div
								class="mb-2 text-[0.55rem] font-black tracking-[0.3em] uppercase text-black/50 sm:mb-3 sm:text-xs"
							>
								Difficulty
							</div>
							<div class="flex flex-col gap-1 sm:gap-2">
								{#each DIFFICULTIES as option, index (option.label)}
									<button
										type="button"
										data-menu-button
										onclick={() => selectDifficulty(index)}
										class={[
											'border-2 border-black px-1.5 py-1.5 text-xs font-black uppercase transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 sm:border-4 sm:px-3 sm:py-2 sm:text-base',
											selectedDifficultyIndex === index
												? 'bg-black text-yellow-300'
												: 'bg-white text-black hover:bg-black hover:text-white focus:bg-black focus:text-white'
										]}
									>
										{option.label}
									</button>
								{/each}
							</div>
						</div>
					</div>

					<!-- Accordion help -->
					<div class="mb-4 border-2 border-black sm:mb-6 sm:border-4">
						<button
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
								Reveal every safe tile to win.<br />
								Click/tap reveal • Long-press flag.<br />
								<span class="mt-2 block text-[0.6rem] text-black/60 sm:text-xs">
									A / Enter = select • B / Esc = return.
								</span>
							</div>
						{/if}
					</div>

					<!-- CTA buttons: primary + Dashboard side-by-side; New Game below when resuming -->
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
	{:else}
		<div class="flex min-h-[calc(100vh-3rem)] items-center justify-center">
			<div
				class="relative w-full max-w-4xl border-4 border-black bg-gradient-to-br from-white via-yellow-50 to-amber-100 p-2 shadow-[14px_14px_0_rgba(0,0,0,1)] sm:rounded-[1.5rem] sm:p-6"
			>
				<div
					class="mb-5 flex flex-col gap-3 border-4 border-black bg-[linear-gradient(180deg,#111_0%,#000_100%)] p-3 text-sm font-black text-yellow-300 uppercase shadow-[0_6px_0_rgba(0,0,0,0.2)] sm:flex-row sm:items-center sm:justify-between sm:text-lg"
				>
					<div class="flex flex-wrap items-center gap-2 sm:gap-3">
						<span class="border-2 border-yellow-400 bg-black px-3 py-1 tracking-[0.2em] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
							Mines {minesLeft}
						</span>
						<span class="border-2 border-yellow-400 bg-black px-3 py-1 tracking-[0.2em] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
							Wins {wins}
						</span>
					</div>
					{#if gameScreen}
						<button
							onclick={handleReturnAction}
							class="border-4 border-white bg-yellow-300 px-4 py-2 text-sm font-black text-black uppercase transition-all hover:bg-white focus:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-[0.98]"
						>
							Return
						</button>
					{/if}
				</div>

				<div class="mb-3 text-center sm:mb-5">
					<h2
						class="hidden text-4xl font-black uppercase drop-shadow-[3px_3px_0_rgba(255,255,255,0.65)] sm:block sm:text-5xl"
					>
						{gameWon ? 'Victory!' : gameOver ? 'Kaboom!' : 'Minefield Live'}
					</h2>
					<p
						class="mt-1 hidden text-xs leading-relaxed font-bold text-black/70 uppercase sm:mt-2 sm:block sm:text-sm"
					>
						Click / tap reveal • Right click / long-press flag • Esc / B returns to splash
					</p>
				</div>

					<div
						class="board-grid mx-auto w-full sm:w-fit rounded-[1.25rem] border-4 border-black bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.2),_transparent_40%),linear-gradient(180deg,#111_0%,#000_100%)] p-2 shadow-[0_0_0_4px_rgba(250,204,21,0.7),0_16px_30px_rgba(0,0,0,0.35)] sm:p-3"
						style={`display: grid; grid-template-columns: repeat(${cols}, minmax(0, 1fr)); gap: ${cols >= 15 ? '2px' : cols >= 12 ? '3px' : '4px'}; --cols: ${cols};`}
					>
						{#each grid as row, r (r)}
							{#each row as cell, c (`${r}-${c}`)}
								<button
									type="button"
									class={[
										'cell-button flex aspect-square w-full items-center justify-center rounded-[0.2rem] border border-black font-black transition-all select-none sm:h-10 sm:w-10 sm:rounded-[0.4rem] sm:border-2 sm:text-sm',
										cell.state === 'revealed'
											? 'bg-[linear-gradient(180deg,#fffef5_0%,#e7e1d0_100%)] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-2px_0_rgba(0,0,0,0.08)]'
											: 'bg-[linear-gradient(180deg,#8f8f8f_0%,#5c5c5c_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-2px_0_rgba(0,0,0,0.35)] hover:-translate-y-[1px] hover:brightness-110 active:translate-y-[1px]',
										cell.state === 'flagged'
											? 'bg-[linear-gradient(180deg,#fde68a_0%,#f59e0b_100%)] text-red-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),inset_0_-2px_0_rgba(0,0,0,0.1)]'
											: '',
										gameScreen && cell.state === 'hidden' ? 'cursor-pointer' : 'cursor-default'
									]}
									tabindex={-1}
								aria-label={getCellLabel(cell, r, c)}
								onclick={() => handleCellClick(r, c)}
								onpointerdown={(event) => handleCellPointerDown(event, r, c)}
								onpointerup={handleCellPointerEnd}
								onpointercancel={handleCellPointerEnd}
								oncontextmenu={(event) => handleCellContextMenu(event, r, c)}
							>
									{#if cell.state === 'revealed'}
										{#if cell.value === 'mine'}
											<span class="drop-shadow-[1px_1px_0_rgba(255,255,255,0.35)] sm:text-xl">💣</span>
										{:else if typeof cell.value === 'number' && cell.value > 0}
											<span
												class={[
													cell.value === 1 && 'text-blue-700',
													cell.value === 2 && 'text-emerald-700',
												cell.value === 3 && 'text-red-600',
												cell.value === 4 && 'text-violet-700',
												cell.value >= 5 && 'text-fuchsia-700',
												'[text-shadow:1px_1px_0_rgba(255,255,255,0.65)]'
											]}
											>
												{cell.value}
											</span>
										{/if}
									{:else if cell.state === 'flagged'}
										<span class="drop-shadow-[1px_1px_0_rgba(255,255,255,0.35)] sm:text-xl">🚩</span>
									{/if}
								</button>
							{/each}
						{/each}
					</div>

				{#if gameScreen}
					<div
						class="mt-5 text-center text-xs leading-relaxed font-bold text-black/65 uppercase sm:text-sm"
					>
						Need a breather? Esc / B returns to splash and Continue resumes this exact board.
					</div>
				{/if}

				{#if endScreen}
					<div
						class="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
					>
						<div
							class="w-full max-w-md border-4 border-black bg-white p-6 text-center shadow-[12px_12px_0_rgba(0,0,0,1)] sm:p-8"
						>
							<div class="text-6xl sm:text-7xl">{gameWon ? '🏆' : '💥'}</div>
							<h3 class="mt-4 text-4xl font-black uppercase sm:text-5xl">
								{gameWon ? 'Victory' : 'Kaboom'}
							</h3>
							<p
								class="mt-4 text-sm leading-relaxed font-bold text-black/70 uppercase sm:text-base"
							>
								{gameWon
									? `Board cleared. Total wins: ${wins}.`
									: 'You poked the spicy rock. Try again or bail to splash.'}
							</p>

							<div class="mt-8 flex flex-col gap-4">
								<button
									data-menu-button
									onclick={retryGame}
									class="border-4 border-yellow-400 bg-black px-8 py-4 text-2xl font-black text-yellow-400 uppercase transition-all hover:scale-[1.02] hover:bg-yellow-400 hover:text-black focus:scale-[1.02] focus:bg-yellow-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-[0.98]"
								>
									Retry
								</button>
								<button
									data-menu-button
									onclick={() => returnToSplash(false)}
									class="border-4 border-black bg-white px-8 py-4 text-xl font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-[0.98]"
								>
									Back to Splash
								</button>
							</div>

							<div class="mt-6 text-xs font-bold text-black/60 uppercase">
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

	.cell-button {
		touch-action: manipulation;
		-webkit-touch-callout: none;
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.18);
	}

	@media (max-width: 639px) {
		.board-grid {
			font-size: clamp(0.45rem, calc((100vw - 3.5rem) / var(--cols) * 0.55), 0.875rem);
		}
	}

	@media (min-width: 640px) {
		.cell-button {
			font-size: 0.875rem;
		}
	}
</style>
