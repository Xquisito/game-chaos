<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import { getCabinetFlow, returnFromCabinet, type CabinetScreen } from '$lib/cabinet-flow';
	import { gameCabinetById, readCabinetScore, recordCabinetWin } from '$lib/cabinets';
	import {
		focusFirstControlItem,
		handleLinearMenuKeydown,
		isBackControlKey,
		MENU_BUTTON_SELECTOR
	} from '$lib/unified-controls';
	import { isArrowKey, ARROW_TO_DIR } from '$lib/keys';

	const DIFFICULTIES = [
		{ label: 'Easy', clues: 44, blurb: 'A gentle warm up.' },
		{ label: 'Medium', clues: 35, blurb: 'A balanced challenge.' },
		{ label: 'Hard', clues: 29, blurb: 'Bring your logic.' },
		{ label: 'Expert', clues: 24, blurb: 'No mercy for the brain.' }
	] as const;
	const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
	const cabinet = gameCabinetById.sudoku;

	type EndMode = 'won' | null;

	interface Cell {
		value: number;
		given: boolean;
		notes: number[];
	}

	let cells = $state<Cell[][]>([]);
	let solution = $state<number[][]>([]);
	let screen = $state<CabinetScreen>('splash');
	let endMode = $state<EndMode>(null);
	let hasActiveRun = $state(false);
	let generating = $state(false);
	let wins = $state(0);
	let seconds = $state(0);
	let selectedDifficultyIndex = $state(1);
	let selRow = $state(-1);
	let selCol = $state(-1);
	let draftMode = $state(false);
	let timerId: ReturnType<typeof setInterval> | null = null;

	let flow = $derived(getCabinetFlow(screen));
	let splashScreen = $derived(flow.splashScreen);
	let gameScreen = $derived(flow.gameScreen);
	let endScreen = $derived(flow.endScreen);
	let menuScreen = $derived(flow.menuScreen);
	let gameWon = $derived(endMode === 'won');
	let difficulty = $derived(DIFFICULTIES[selectedDifficultyIndex]);

	let selectedValue = $derived(
		selRow >= 0 && selCol >= 0 ? (cells[selRow]?.[selCol]?.value ?? 0) : 0
	);

	// How many of each digit are already on the board (1-9). Index 0 unused.
	let digitCounts = $derived.by(() => {
		const counts = Array(10).fill(0);
		for (const row of cells) {
			for (const cell of row) {
				if (cell.value > 0) counts[cell.value] += 1;
			}
		}
		return counts;
	});

	// Keys "r:c" of every cell that breaks a Sudoku rule given current values.
	let conflictKeys = $derived.by(() => {
		const conflicts = new Set<string>();
		if (cells.length !== 9) return conflicts;

		const flag = (a: [number, number], b: [number, number]) => {
			conflicts.add(`${a[0]}:${a[1]}`);
			conflicts.add(`${b[0]}:${b[1]}`);
		};

		for (let r = 0; r < 9; r += 1) {
			for (let c = 0; c < 9; c += 1) {
				const v = cells[r][c].value;
				if (v === 0) continue;

				for (let cc = c + 1; cc < 9; cc += 1) {
					if (cells[r][cc].value === v) flag([r, c], [r, cc]);
				}
				for (let rr = r + 1; rr < 9; rr += 1) {
					if (cells[rr][c].value === v) flag([r, c], [rr, c]);
				}
			}
		}

		for (let br = 0; br < 9; br += 3) {
			for (let bc = 0; bc < 9; bc += 3) {
				const seen = new Map<number, [number, number]>();
				for (let r = br; r < br + 3; r += 1) {
					for (let c = bc; c < bc + 3; c += 1) {
						const v = cells[r][c].value;
						if (v === 0) continue;
						const prev = seen.get(v);
						if (prev) flag(prev, [r, c]);
						else seen.set(v, [r, c]);
					}
				}
			}
		}

		return conflicts;
	});

	let conflictCount = $derived(conflictKeys.size);
	let filledCount = $derived(digitCounts.reduce((sum: number, n: number) => sum + n, 0));

	// ---- Generation / solving (pure helpers, not reactive) ----

	function isValidPlacement(grid: number[][], r: number, c: number, n: number) {
		for (let i = 0; i < 9; i += 1) {
			if (grid[r][i] === n) return false;
			if (grid[i][c] === n) return false;
		}
		const br = r - (r % 3);
		const bc = c - (c % 3);
		for (let dr = 0; dr < 3; dr += 1) {
			for (let dc = 0; dc < 3; dc += 1) {
				if (grid[br + dr][bc + dc] === n) return false;
			}
		}
		return true;
	}

	function shuffled<T>(items: readonly T[]): T[] {
		const copy = [...items];
		for (let i = copy.length - 1; i > 0; i -= 1) {
			const j = Math.floor(Math.random() * (i + 1));
			[copy[i], copy[j]] = [copy[j], copy[i]];
		}
		return copy;
	}

	function fillGrid(grid: number[][]): boolean {
		for (let r = 0; r < 9; r += 1) {
			for (let c = 0; c < 9; c += 1) {
				if (grid[r][c] !== 0) continue;
				for (const n of shuffled(DIGITS)) {
					if (!isValidPlacement(grid, r, c, n)) continue;
					grid[r][c] = n;
					if (fillGrid(grid)) return true;
					grid[r][c] = 0;
				}
				return false;
			}
		}
		return true;
	}

	// Count solutions, bailing out at `limit` (we only care whether it is unique).
	function countSolutions(grid: number[][], limit: number): number {
		let r = -1;
		let c = -1;
		outer: for (let i = 0; i < 9; i += 1) {
			for (let j = 0; j < 9; j += 1) {
				if (grid[i][j] === 0) {
					r = i;
					c = j;
					break outer;
				}
			}
		}
		if (r === -1) return 1;

		let total = 0;
		for (let n = 1; n <= 9; n += 1) {
			if (!isValidPlacement(grid, r, c, n)) continue;
			grid[r][c] = n;
			total += countSolutions(grid, limit);
			grid[r][c] = 0;
			if (total >= limit) break;
		}
		return total;
	}

	function buildPuzzle(targetClues: number) {
		const solved = Array.from({ length: 9 }, () => Array(9).fill(0));
		fillGrid(solved);

		const puzzle = solved.map((row) => [...row]);
		let clues = 81;
		// Dig holes in pairs of symmetric positions while keeping a unique solution.
		for (const index of shuffled(Array.from({ length: 81 }, (_, i) => i))) {
			if (clues <= targetClues) break;

			const r = Math.floor(index / 9);
			const c = index % 9;
			if (puzzle[r][c] === 0) continue;

			const backup = puzzle[r][c];
			puzzle[r][c] = 0;

			const probe = puzzle.map((row) => [...row]);
			if (countSolutions(probe, 2) !== 1) {
				puzzle[r][c] = backup;
			} else {
				clues -= 1;
			}
		}

		solution = solved;
		cells = puzzle.map((row) =>
			row.map((value) => ({ value, given: value !== 0, notes: [] }))
		);
	}

	// ---- Game flow ----

	function clearConfiguredRun() {
		hasActiveRun = false;
		endMode = null;
		cells = [];
		solution = [];
	}

	function startGame() {
		endMode = null;
		seconds = 0;
		selRow = -1;
		selCol = -1;
		draftMode = false;
		generating = true;
		screen = 'game';

		// Defer the heavy generation one frame so the board frame can paint first.
		setTimeout(() => {
			buildPuzzle(difficulty.clues);
			generating = false;
			selectFirstEmpty();
		}, 30);

		hasActiveRun = true;
	}

	function selectFirstEmpty() {
		for (let r = 0; r < 9; r += 1) {
			for (let c = 0; c < 9; c += 1) {
				if (cells[r]?.[c]?.value === 0) {
					selRow = r;
					selCol = c;
					return;
				}
			}
		}
	}

	function selectDifficulty(index: number) {
		if (selectedDifficultyIndex === index) return;
		selectedDifficultyIndex = index;
		clearConfiguredRun();
	}

	function continueGame() {
		if (!hasActiveRun || cells.length === 0) return;
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

	function finishWin() {
		if (endMode === 'won') return;
		wins = recordCabinetWin(localStorage, cabinet, wins);
		hasActiveRun = false;
		endMode = 'won';
		screen = 'end';
		focusMenuSoon();
	}

	function checkWin() {
		if (cells.length !== 9 || solution.length !== 9) return;
		for (let r = 0; r < 9; r += 1) {
			for (let c = 0; c < 9; c += 1) {
				if (cells[r][c].value !== solution[r][c]) return;
			}
		}
		finishWin();
	}

	// ---- Cell interaction ----

	function selectCell(r: number, c: number) {
		if (!gameScreen || generating) return;
		selRow = r;
		selCol = c;
	}

	function inputDigit(n: number) {
		if (!gameScreen || generating) return;
		if (selRow < 0 || selCol < 0) return;
		const cell = cells[selRow][selCol];
		if (cell.given) return;

		if (draftMode) {
			if (cell.value !== 0) return;
			const idx = cell.notes.indexOf(n);
			if (idx === -1) cell.notes = [...cell.notes, n].sort((a, b) => a - b);
			else cell.notes = cell.notes.filter((m) => m !== n);
			return;
		}

		cell.value = cell.value === n ? 0 : n;
		cell.notes = [];
		if (cell.value !== 0) pruneNotes(selRow, selCol, n);
		checkWin();
	}

	// Remove a freshly placed value from the notes of its row, column and box.
	function pruneNotes(r: number, c: number, n: number) {
		const strip = (cell: Cell) => {
			if (cell.notes.includes(n)) cell.notes = cell.notes.filter((m) => m !== n);
		};
		for (let i = 0; i < 9; i += 1) {
			strip(cells[r][i]);
			strip(cells[i][c]);
		}
		const br = r - (r % 3);
		const bc = c - (c % 3);
		for (let dr = 0; dr < 3; dr += 1) {
			for (let dc = 0; dc < 3; dc += 1) {
				strip(cells[br + dr][bc + dc]);
			}
		}
	}

	function eraseCell() {
		if (!gameScreen || generating) return;
		if (selRow < 0 || selCol < 0) return;
		const cell = cells[selRow][selCol];
		if (cell.given) return;
		cell.value = 0;
		cell.notes = [];
	}

	function toggleDraft() {
		draftMode = !draftMode;
	}

	function moveSelection(dir: 'up' | 'down' | 'left' | 'right') {
		if (selRow < 0 || selCol < 0) {
			selectFirstEmpty();
			return;
		}
		if (dir === 'up') selRow = (selRow + 8) % 9;
		if (dir === 'down') selRow = (selRow + 1) % 9;
		if (dir === 'left') selCol = (selCol + 8) % 9;
		if (dir === 'right') selCol = (selCol + 1) % 9;
	}

	// ---- Highlight helpers ----

	function isPeer(r: number, c: number) {
		if (selRow < 0 || selCol < 0) return false;
		if (r === selRow || c === selCol) return true;
		const sameBoxRow = Math.floor(r / 3) === Math.floor(selRow / 3);
		const sameBoxCol = Math.floor(c / 3) === Math.floor(selCol / 3);
		return sameBoxRow && sameBoxCol;
	}

	function cellClasses(r: number, c: number, cell: Cell) {
		const selected = r === selRow && c === selCol;
		const conflict = conflictKeys.has(`${r}:${c}`);
		const matchesValue = cell.value !== 0 && cell.value === selectedValue;
		const classes: string[] = [];

		if (selected) classes.push('bg-yellow-300');
		else if (conflict) classes.push('bg-red-200');
		else if (matchesValue) classes.push('bg-amber-200');
		else if (isPeer(r, c)) classes.push('bg-yellow-100');
		else classes.push('bg-white');

		if (cell.given) classes.push('text-black');
		else if (conflict) classes.push('text-red-600');
		else classes.push('text-blue-700');

		return classes.join(' ');
	}

	// ---- Keyboard ----

	async function focusMenuSoon() {
		await tick();
		focusFirstControlItem(MENU_BUTTON_SELECTOR, true);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (menuScreen) {
			handleLinearMenuKeydown(event, {
				enabled: menuScreen,
				onBack: handleReturnAction,
				selector: MENU_BUTTON_SELECTOR
			});
			return;
		}

		if (!gameScreen) return;

		if (isBackControlKey(event.key)) {
			event.preventDefault();
			handleReturnAction();
			return;
		}

		if (isArrowKey(event.key)) {
			event.preventDefault();
			moveSelection(ARROW_TO_DIR[event.key]);
			return;
		}

		if (event.key >= '1' && event.key <= '9') {
			event.preventDefault();
			inputDigit(Number(event.key));
			return;
		}

		if (event.key === '0' || event.key === 'Backspace' || event.key === 'Delete') {
			event.preventDefault();
			eraseCell();
			return;
		}

		if (event.key === 'n' || event.key === 'N') {
			event.preventDefault();
			toggleDraft();
		}
	}

	function formatTime(total: number) {
		const m = Math.floor(total / 60)
			.toString()
			.padStart(2, '0');
		const s = (total % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	}

	onMount(() => {
		wins = readCabinetScore(localStorage, cabinet);
		focusMenuSoon();

		timerId = setInterval(() => {
			if (screen === 'game' && !generating && endMode === null) seconds += 1;
		}, 1000);

		return () => {
			if (timerId) clearInterval(timerId);
		};
	});
</script>

<svelte:head>
	<title>Sudoku Chaos | Vintage Number Logic Puzzle</title>
	<meta
		name="description"
		content="Sharpen your logic with Sudoku Chaos. A vintage-style number puzzle with adjustable difficulty, pencil-mark drafts, and completed-number tracking."
	/>
	<meta property="og:title" content="Sudoku Chaos - The Classic Number Puzzle" />
	<meta
		property="og:description"
		content="Fill the grid from Easy to Expert. Draft notes, track finished digits, and solve the most chaotic Sudoku yet."
	/>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div
	class="relative min-h-screen overflow-hidden bg-yellow-300 px-1 py-1 font-mono text-black sm:px-6 sm:py-8"
>
	{#if splashScreen}
		<div class="flex min-h-[calc(100vh-2rem)] items-center justify-center">
			<div
				class="w-full max-w-4xl border-4 border-black bg-white p-4 shadow-[4px_4px_0_rgba(0,0,0,1)] sm:p-10 sm:shadow-[14px_14px_0_rgba(0,0,0,1)]"
			>
				<div class="mb-5 text-center sm:mb-8">
					<div
						class="mb-2 text-[0.6rem] font-black tracking-[0.45em] text-black/60 uppercase sm:mb-3 sm:text-sm"
					>
						Game Chaos
					</div>
					<h1
						class="text-3xl leading-none font-black uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:text-7xl sm:drop-shadow-[4px_4px_0_rgba(0,0,0,1)]"
					>
						🔢 Sudoku Chaos 🔢
					</h1>
					<p class="mt-2 text-sm font-bold uppercase sm:mt-4 sm:text-2xl">
						Pure logic. One solution.
					</p>
				</div>

				<div class="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
					<div
						class="border-4 border-black bg-yellow-200 p-3 text-xs leading-relaxed font-bold uppercase sm:p-5 sm:text-base"
					>
						Fill every row, column and box with 1-9.<br />
						Tap a cell, then a number to place it.<br />
						Toggle Draft to pencil in candidate notes.<br />
						<span class="mt-3 block text-black/70 sm:mt-4">
							A / Enter = select • B / Esc = return.
						</span>
					</div>

					<div class="border-4 border-black bg-black p-3 text-yellow-300 sm:p-5">
						<div
							class="text-[0.6rem] font-black tracking-[0.35em] text-yellow-300/70 uppercase sm:text-xs"
						>
							Score Board
						</div>
						<div class="mt-2 text-3xl font-black sm:mt-4 sm:text-5xl">{wins}</div>
						<div class="mt-1 text-sm font-bold uppercase sm:mt-2 sm:text-lg">Puzzles Solved</div>
					</div>
				</div>

				<div class="mt-6 flex flex-col gap-2 sm:mt-8 sm:gap-4">
					{#if hasActiveRun}
						<button
							data-menu-button
							onclick={continueGame}
							class="border-2 border-yellow-400 bg-black px-4 py-3 text-lg font-black text-yellow-400 uppercase transition-all hover:scale-[1.02] hover:bg-yellow-400 hover:text-black focus:scale-[1.02] focus:bg-yellow-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-5 sm:text-3xl sm:focus-visible:ring-offset-4"
						>
							Continue
						</button>
						<button
							data-menu-button
							onclick={startGame}
							class="border-2 border-black bg-white px-4 py-2 text-base font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-4 sm:text-2xl sm:focus-visible:ring-offset-4"
						>
							New Puzzle
						</button>
					{:else}
						<button
							data-menu-button
							onclick={startGame}
							class="border-2 border-yellow-400 bg-black px-4 py-3 text-lg font-black text-yellow-400 uppercase transition-all hover:scale-[1.02] hover:bg-yellow-400 hover:text-black focus:scale-[1.02] focus:bg-yellow-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-5 sm:text-3xl sm:focus-visible:ring-offset-4"
						>
							Press Start
						</button>
					{/if}

					<button
						data-menu-button
						onclick={backToDashboard}
						class="border-2 border-black bg-white px-4 py-2 text-base font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:border-4 sm:px-8 sm:py-4 sm:text-2xl sm:focus-visible:ring-offset-4"
					>
						Dashboard
					</button>
				</div>

				<div class="mt-6 border-4 border-black bg-yellow-100 p-3 sm:mt-8 sm:p-4">
					<div class="mb-3 text-xs font-black tracking-[0.3em] text-black/60 uppercase sm:text-sm">
						Difficulty
					</div>
					<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
						{#each DIFFICULTIES as option, index (option.label)}
							<button
								type="button"
								data-menu-button
								onclick={() => selectDifficulty(index)}
								class={[
									'flex flex-col gap-1 border-2 border-black px-3 py-2 text-left text-sm font-black uppercase transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 sm:border-4 sm:text-base',
									selectedDifficultyIndex === index
										? 'bg-black text-yellow-300'
										: 'bg-white text-black hover:bg-black hover:text-white focus:bg-black focus:text-white'
								]}
							>
								<span>{option.label}</span>
								<span class="text-[0.6rem] font-bold normal-case opacity-70 sm:text-xs">
									{option.clues} clues
								</span>
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="flex min-h-[calc(100vh-3rem)] items-center justify-center">
			<div
				class="relative w-full max-w-xl border-4 border-black bg-gradient-to-br from-white via-yellow-50 to-amber-100 p-3 shadow-[14px_14px_0_rgba(0,0,0,1)] sm:rounded-[1.5rem] sm:p-6"
			>
				<div
					class="mb-4 flex flex-col gap-3 border-4 border-black bg-[linear-gradient(180deg,#111_0%,#000_100%)] p-3 text-sm font-black text-yellow-300 uppercase shadow-[0_6px_0_rgba(0,0,0,0.2)] sm:flex-row sm:items-center sm:justify-between sm:text-lg"
				>
					<div class="flex flex-wrap items-center gap-2 sm:gap-3">
						<span
							class="border-2 border-yellow-400 bg-black px-3 py-1 tracking-[0.2em] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
						>
							{difficulty.label}
						</span>
						<span
							class="border-2 border-yellow-400 bg-black px-3 py-1 tracking-[0.2em] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
						>
							{formatTime(seconds)}
						</span>
						<span
							class={[
								'border-2 px-3 py-1 tracking-[0.2em] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
								conflictCount > 0
									? 'border-red-400 bg-red-500 text-white'
									: 'border-yellow-400 bg-black'
							]}
						>
							Conflicts {conflictCount}
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

				{#if generating}
					<div
						class="mx-auto flex aspect-square w-full max-w-[min(92vw,30rem)] items-center justify-center rounded-[1rem] border-4 border-black bg-black text-center text-lg font-black tracking-[0.3em] text-yellow-300 uppercase"
					>
						Generating…
					</div>
				{:else}
					<div
						class="sudoku-grid mx-auto grid w-full max-w-[min(92vw,30rem)] grid-cols-9 overflow-hidden rounded-[0.5rem] border-4 border-black bg-black shadow-[0_0_0_4px_rgba(250,204,21,0.7),0_16px_30px_rgba(0,0,0,0.35)]"
					>
						{#each cells as row, r (r)}
							{#each row as cell, c (`${r}-${c}`)}
								<button
									type="button"
									class={[
										'sudoku-cell relative flex aspect-square items-center justify-center text-lg font-black select-none sm:text-2xl',
										c === 8 ? '' : c % 3 === 2 ? 'border-r-[3px] border-r-black' : 'border-r border-r-black/20',
										r === 8 ? '' : r % 3 === 2 ? 'border-b-[3px] border-b-black' : 'border-b border-b-black/20',
										cellClasses(r, c, cell)
									]}
									tabindex={-1}
									aria-label={`Row ${r + 1}, column ${c + 1}${
										cell.value ? `, value ${cell.value}` : ', empty'
									}`}
									aria-pressed={r === selRow && c === selCol}
									onclick={() => selectCell(r, c)}
								>
									{#if cell.value !== 0}
										<span
											class={[
												cell.given ? '' : 'drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]'
											]}
										>
											{cell.value}
										</span>
									{:else if cell.notes.length}
										<span class="grid h-full w-full grid-cols-3 grid-rows-3 p-px">
											{#each DIGITS as n (n)}
												<span
													class="flex items-center justify-center text-[0.5rem] leading-none font-bold text-black/55 sm:text-[0.65rem]"
												>
													{cell.notes.includes(n) ? n : ''}
												</span>
											{/each}
										</span>
									{/if}
								</button>
							{/each}
						{/each}
					</div>

					<div class="mt-4 flex items-center justify-between gap-2">
						<button
							type="button"
							onclick={toggleDraft}
							aria-pressed={draftMode}
							class={[
								'flex items-center gap-2 border-4 border-black px-4 py-2 text-sm font-black uppercase transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:text-base',
								draftMode
									? 'bg-black text-yellow-300 shadow-[inset_0_2px_0_rgba(255,255,255,0.15)]'
									: 'bg-white text-black hover:bg-black hover:text-white'
							]}
						>
							✏️ Draft {draftMode ? 'On' : 'Off'}
						</button>
						<button
							type="button"
							onclick={eraseCell}
							class="border-4 border-black bg-white px-4 py-2 text-sm font-black text-black uppercase transition-all hover:bg-black hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:text-base"
						>
							⌫ Erase
						</button>
					</div>

					<div class="mt-3 grid grid-cols-9 gap-1 sm:gap-2">
						{#each DIGITS as n (n)}
							{@const remaining = 9 - digitCounts[n]}
							{@const done = remaining <= 0}
							<button
								type="button"
								onclick={() => inputDigit(n)}
								disabled={done}
								class={[
									'relative flex aspect-square items-center justify-center rounded-[0.4rem] border-2 border-black text-lg font-black transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 active:scale-[0.96] sm:border-4 sm:text-2xl',
									done
										? 'cursor-default bg-black/30 text-black/30 line-through'
										: draftMode
											? 'bg-yellow-100 text-black hover:bg-yellow-300'
											: 'bg-white text-black hover:bg-black hover:text-white'
								]}
							>
								{n}
								{#if !done}
									<span
										class="absolute right-0.5 bottom-0 text-[0.5rem] leading-none font-bold text-black/45 sm:text-[0.6rem]"
									>
										{remaining}
									</span>
								{/if}
							</button>
						{/each}
					</div>
				{/if}

				{#if gameScreen && !generating}
					<div
						class="mt-4 text-center text-xs leading-relaxed font-bold text-black/65 uppercase sm:text-sm"
					>
						N toggles draft • Backspace erases • Esc / B returns to splash.
					</div>
				{/if}

				{#if endScreen}
					<div
						class="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
					>
						<div
							class="w-full max-w-md border-4 border-black bg-white p-6 text-center shadow-[12px_12px_0_rgba(0,0,0,1)] sm:p-8"
						>
							<div class="text-6xl sm:text-7xl">🏆</div>
							<h3 class="mt-4 text-4xl font-black uppercase sm:text-5xl">Solved!</h3>
							<p class="mt-4 text-sm leading-relaxed font-bold text-black/70 uppercase sm:text-base">
								{difficulty.label} grid cleared in {formatTime(seconds)}. Total solved: {wins}.
							</p>

							<div class="mt-8 flex flex-col gap-4">
								<button
									data-menu-button
									onclick={retryGame}
									class="border-4 border-yellow-400 bg-black px-8 py-4 text-2xl font-black text-yellow-400 uppercase transition-all hover:scale-[1.02] hover:bg-yellow-400 hover:text-black focus:scale-[1.02] focus:bg-yellow-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black active:scale-[0.98]"
								>
									New Puzzle
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

	.sudoku-cell {
		touch-action: manipulation;
		-webkit-touch-callout: none;
	}
</style>
