<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';

	const ROWS = 10;
	const COLS = 10;
	const MINES_COUNT = 15;
	const WINS_STORAGE_KEY = 'minesweeper-wins';
	const LONG_PRESS_MS = 360;
	const MENU_BUTTON_SELECTOR = '[data-menu-button]:not([disabled])';

	type CellValue = 'mine' | 'empty' | number;
	type CellState = 'hidden' | 'revealed' | 'flagged';
	type Screen = 'splash' | 'game' | 'end';
	type EndMode = 'won' | 'lost' | null;

	interface Cell {
		value: CellValue;
		state: CellState;
	}

	let grid = $state<Cell[][]>([]);
	let screen = $state<Screen>('splash');
	let endMode = $state<EndMode>(null);
	let hasActiveRun = $state(false);
	let wins = $state(0);
	let showChaosModal = $state(false);
	let modalMessage = $state('');

	let splashScreen = $derived(screen === 'splash');
	let gameScreen = $derived(screen === 'game');
	let endScreen = $derived(screen === 'end');
	let menuScreen = $derived(splashScreen || endScreen);
	let gameWon = $derived(endMode === 'won');
	let gameOver = $derived(endMode === 'lost');
	let minesLeft = $derived.by(() => {
		let flagged = 0;
		for (const row of grid) {
			for (const cell of row) {
				if (cell.state === 'flagged') flagged += 1;
			}
		}
		return MINES_COUNT - flagged;
	});

	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let longPressPointerId: number | null = null;
	let longPressCellKey = '';
	let suppressedRevealKeys: string[] = [];

	function createEmptyGrid() {
		const nextGrid: Cell[][] = [];

		for (let r = 0; r < ROWS; r += 1) {
			const row: Cell[] = [];
			for (let c = 0; c < COLS; c += 1) {
				row.push({ value: 'empty', state: 'hidden' });
			}
			nextGrid.push(row);
		}

		return nextGrid;
	}

	function initGame() {
		clearLongPress();
		endMode = null;
		grid = createEmptyGrid();

		let minesPlaced = 0;
		while (minesPlaced < MINES_COUNT) {
			const r = Math.floor(Math.random() * ROWS);
			const c = Math.floor(Math.random() * COLS);

			if (grid[r][c].value === 'mine') continue;

			grid[r][c].value = 'mine';
			minesPlaced += 1;
		}

		for (let r = 0; r < ROWS; r += 1) {
			for (let c = 0; c < COLS; c += 1) {
				if (grid[r][c].value === 'mine') continue;

				let count = 0;
				for (let dr = -1; dr <= 1; dr += 1) {
					for (let dc = -1; dc <= 1; dc += 1) {
						if (dr === 0 && dc === 0) continue;

						const nr = r + dr;
						const nc = c + dc;
						if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
						if (grid[nr][nc].value === 'mine') count += 1;
					}
				}

				grid[r][c].value = count === 0 ? 'empty' : count;
			}
		}
	}

	function persistWins() {
		try {
			localStorage.setItem(WINS_STORAGE_KEY, String(wins));
		} catch {
			// Ignore storage failures in private/restricted contexts
		}
	}

	function startGame() {
		showChaosModal = false;
		initGame();
		hasActiveRun = true;
		screen = 'game';
	}

	function continueGame() {
		if (!hasActiveRun || grid.length === 0) return;
		showChaosModal = false;
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
		showChaosModal = false;
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

	function revealCell(r: number, c: number) {
		if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;

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

		wins += 1;
		persistWins();
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
		if (!cell || cell.state === 'revealed') return;

		cell.state = cell.state === 'flagged' ? 'hidden' : 'flagged';
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

	function triggerChaos() {
		const messages = [
			'I TOLD YOU NOT TO CLICK IT! 😤',
			'SYSTEM ERROR: Too much chaos detected! ⚠️',
			'Are you even listening?! 🤨',
			'Your finger is too curious for its own good. 🕵️‍♂️',
			'ERROR 404: Sanity Not Found. 🧠💨'
		];

		modalMessage = messages[Math.floor(Math.random() * messages.length)];
		showChaosModal = true;
	}

	function closeChaosModal() {
		showChaosModal = false;
		if (menuScreen) {
			focusMenuSoon();
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
		const firstButton = document.querySelector(MENU_BUTTON_SELECTOR) as HTMLElement | null;
		firstButton?.focus();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (showChaosModal && ['Escape', 'Enter', ' ', 'a', 'A', 'b', 'B'].includes(event.key)) {
			event.preventDefault();
			closeChaosModal();
			return;
		}

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

		if (
			menuScreen &&
			(event.key === 'Enter' || event.key === ' ' || event.key === 'a' || event.key === 'A')
		) {
			event.preventDefault();
			activateFocusedMenuItem();
		}
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
	<title>Minesweeper Chaos | Vintage Puzzle Game</title>
	<meta name="description" content="Test your logic with Minesweeper Chaos. A vintage-style minefield puzzle game. Avoid the bombs and clear the grid!" />
	<meta property="og:title" content="Minesweeper Chaos - The Classic Game" />
	<meta property="og:description" content="Can you clear the 10x10 grid without hitting a mine? Try the most chaotic Minesweeper yet." />
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div
	class="relative min-h-screen overflow-hidden bg-yellow-300 px-4 py-6 font-mono text-black sm:px-6 sm:py-8"
>
	{#if splashScreen}
		<div class="flex min-h-[calc(100vh-3rem)] items-center justify-center">
			<div
				class="w-full max-w-4xl border-4 border-black bg-white p-6 shadow-[14px_14px_0_rgba(0,0,0,1)] sm:p-10"
			>
				<div class="mb-8 text-center">
					<div class="mb-3 text-sm font-black tracking-[0.45em] text-black/60 uppercase">
						Game Chaos
					</div>
					<h1
						class="text-5xl leading-none font-black uppercase drop-shadow-[4px_4px_0_rgba(0,0,0,1)] sm:text-7xl"
					>
						💣 Boom Box 💣
					</h1>
					<p class="mt-4 text-lg font-bold uppercase sm:text-2xl">
						Vintage little minefield. No mercy.
					</p>
				</div>

				<div class="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
					<div
						class="border-4 border-black bg-yellow-200 p-5 text-sm leading-relaxed font-bold uppercase sm:text-base"
					>
						Reveal every safe tile to win.<br />
						Click or tap to reveal.<br />
						Right click or long-press to flag.<br />
						<span class="mt-4 block text-black/70">
							Arrow keys / Tab move menu focus.<br />
							A / Enter = select • B / Esc = return.
						</span>
					</div>

					<div class="border-4 border-black bg-black p-5 text-yellow-300">
						<div class="text-xs font-black tracking-[0.35em] text-yellow-300/70 uppercase">
							Score Board
						</div>
						<div class="mt-4 text-5xl font-black">{wins}</div>
						<div class="mt-2 text-lg font-bold uppercase">Total Wins</div>
						<div class="mt-5 text-xs leading-relaxed font-bold text-yellow-300/70 uppercase">
							10 × 10 grid<br />15 mines<br />Simple. Mean. Loud.
						</div>
					</div>
				</div>

				<div class="mt-8 flex flex-col gap-4">
					{#if hasActiveRun}
						<button
							data-menu-button
							onclick={continueGame}
							class="border-4 border-yellow-400 bg-black px-8 py-5 text-3xl font-black text-yellow-400 uppercase transition-all hover:scale-[1.02] hover:bg-yellow-400 hover:text-black focus:scale-[1.02] focus:bg-yellow-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-yellow-300 active:scale-[0.98]"
						>
							Continue
						</button>
						<button
							data-menu-button
							onclick={startGame}
							class="border-4 border-black bg-white px-8 py-4 text-2xl font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-4 focus-visible:ring-offset-yellow-300 active:scale-[0.98]"
						>
							New Game
						</button>
					{:else}
						<button
							data-menu-button
							onclick={startGame}
							class="border-4 border-yellow-400 bg-black px-8 py-5 text-3xl font-black text-yellow-400 uppercase transition-all hover:scale-[1.02] hover:bg-yellow-400 hover:text-black focus:scale-[1.02] focus:bg-yellow-400 focus:text-black focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-yellow-300 active:scale-[0.98]"
						>
							Press Start
						</button>
					{/if}

					<button
						data-menu-button
						onclick={backToDashboard}
						class="border-4 border-black bg-white px-8 py-4 text-2xl font-black text-black uppercase transition-all hover:scale-[1.02] hover:bg-black hover:text-white focus:scale-[1.02] focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-4 focus-visible:ring-offset-yellow-300 active:scale-[0.98]"
					>
						Dashboard
					</button>
				</div>
			</div>
		</div>
	{:else}
		<div class="flex min-h-[calc(100vh-3rem)] items-center justify-center">
			<div
				class="relative w-full max-w-4xl border-4 border-black bg-white p-4 shadow-[14px_14px_0_rgba(0,0,0,1)] sm:p-6"
			>
				<div
					class="mb-5 flex flex-col gap-3 border-4 border-black bg-black p-3 text-sm font-black text-yellow-300 uppercase sm:flex-row sm:items-center sm:justify-between sm:text-lg"
				>
					<div class="flex flex-wrap items-center gap-x-6 gap-y-2">
						<span>Mines {minesLeft}</span>
						<span>Wins {wins}</span>
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

				<div class="mb-5 text-center">
					<h2
						class="text-4xl font-black uppercase drop-shadow-[3px_3px_0_rgba(0,0,0,1)] sm:text-5xl"
					>
						{gameWon ? 'Victory!' : gameOver ? 'Kaboom!' : 'Minefield Live'}
					</h2>
					<p class="mt-2 text-xs leading-relaxed font-bold text-black/70 uppercase sm:text-sm">
						Click / tap reveal • Right click / long-press flag • Esc / B returns to splash
					</p>
				</div>

				<div
					class="mx-auto grid w-fit gap-1 border-4 border-black bg-black p-1"
					style={`grid-template-columns: repeat(${COLS}, minmax(0, 1fr));`}
				>
					{#each grid as row, r (r)}
						{#each row as cell, c (`${r}-${c}`)}
							<button
								type="button"
								class={[
									'cell-button flex h-8 w-8 items-center justify-center border-2 border-black text-sm font-black transition-all select-none sm:h-10 sm:w-10 sm:text-base',
									cell.state === 'revealed'
										? 'bg-white text-black'
										: 'bg-zinc-500 text-white hover:bg-zinc-400 active:translate-y-[2px]',
									cell.state === 'flagged' ? 'bg-yellow-400 text-black' : '',
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
										💣
									{:else if typeof cell.value === 'number' && cell.value > 0}
										<span
											class={[
												cell.value === 1 && 'text-blue-600',
												cell.value === 2 && 'text-green-600',
												cell.value === 3 && 'text-red-600',
												cell.value === 4 && 'text-purple-700',
												cell.value >= 5 && 'text-pink-600'
											]}
										>
											{cell.value}
										</span>
									{/if}
								{:else if cell.state === 'flagged'}
									🚩
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

	<button
		type="button"
		tabindex={-1}
		onclick={triggerChaos}
		class="absolute right-4 bottom-4 border-4 border-black bg-pink-500 p-4 text-xs font-black text-white uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] transition-transform hover:scale-105 hover:rotate-6 active:scale-95"
	>
		Don't Click Me 🚫
	</button>

	{#if showChaosModal}
		<div
			class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
		>
			<div
				class="w-full max-w-sm border-8 border-black bg-white p-8 text-center shadow-[16px_16px_0_rgba(0,0,0,1)]"
			>
				<div class="mb-4 text-6xl">🤬</div>
				<h2 class="mb-4 text-2xl font-black uppercase">Wait, what?!</h2>
				<p class="mb-8 text-xl font-bold italic">&quot;{modalMessage}&quot;</p>
				<button
					type="button"
					onclick={closeChaosModal}
					class="w-full border-4 border-white bg-black px-6 py-3 font-black text-white uppercase transition-colors hover:bg-pink-500 focus:bg-pink-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-4 focus-visible:ring-offset-white"
				>
					Fine, I'm sorry 😔
				</button>
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
	}
</style>
