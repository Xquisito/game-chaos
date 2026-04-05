<script lang="ts">
	import { onMount } from 'svelte';

	// Game configuration
	const ROWS = 10;
	const COLS = 10;
	const MINES_COUNT = 15;

	// Types
	type CellValue = 'mine' | 'empty' | number;
	type CellState = 'hidden' | 'revealed' | 'flagged';

	interface Cell {
		value: CellValue;
		state: CellState;
	}

	// State
	let grid = $state<Cell[][]>([]);
	let gameOver = $state(false);
	let gameWon = $state(false);
	let minesLeft = $state(MINES_COUNT);

	// Modal State
	let showChaosModal = $state(false);
	let modalMessage = $state('');

	// Initialize game
	function initGame() {
		gameOver = false;
		gameWon = false;
		minesLeft = MINES_COUNT;

		// Create empty grid
		const newGrid: Cell[][] = [];
		for (let r = 0; r < ROWS; r++) {
			const row: Cell[] = [];
			for (let c = 0; c < COLS; c++) {
				row.push({ value: 'empty', state: 'hidden' });
			}
			newGrid.push(row);
		}

		// Place mines
		let minesPlaced = 0;
		while (minesPlaced < MINES_COUNT) {
			const r = Math.floor(Math.random() * ROWS);
			const c = Math.floor(Math.random() * COLS);
			if (newGrid[r][c].value !== 'mine') {
				newGrid[r][c].value = 'mine';
				minesPlaced++;
			}
		}

		// Calculate numbers
		for (let r = 0; r < ROWS; r++) {
			for (let c = 0; c < COLS; c++) {
				if (newGrid[r][c].value === 'mine') continue;

				let count = 0;
				for (let dr = -1; dr <= 1; dr++) {
					for (let dc = -1; dc <= 1; dc++) {
						const nr = r + dr;
						const nc = c + dc;
						if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && newGrid[nr][nc].value === 'mine') {
							count++;
						}
					}
				}
				newGrid[r][c].value = count === 0 ? 'empty' : count;
			}
		}

		grid = newGrid;
	}

	function handleReveal(r: number, c: number) {
		if (gameOver || gameWon || grid[r][c].state !== 'hidden') return;

		if (grid[r][c].value === 'mine') {
			revealAllMines();
			gameOver = true;
			return;
		}

		revealCell(r, c);
		checkWin();
	}

	function revealCell(r: number, c: number) {
		if (r < 0 || r >= ROWS || c < 0 || c >= COLS || grid[r][c].state !== 'hidden') return;

		grid[r][c].state = 'revealed';

		if (grid[r][c].value === 'empty') {
			for (let dr = -1; dr <= 1; dr++) {
				for (let dc = -1; dc <= 1; dc++) {
					revealCell(r + dr, c + dc);
				}
			}
		}
	}

	function handleFlag(r: number, c: number) {
		if (gameOver || gameWon || grid[r][c].state === 'revealed') return;

		if (grid[r][c].state === 'flagged') {
			grid[r][c].state = 'hidden';
			minesLeft++;
		} else {
			grid[r][c].state = 'flagged';
			minesLeft--;
		}
	}

	function revealAllMines() {
		for (let r = 0; r < ROWS; r++) {
			for (let c = 0; c < COLS; c++) {
				if (grid[r][c].value === 'mine') {
					grid[r][c].state = 'revealed';
				}
			}
		}
	}

	function checkWin() {
		let unrevealedNonMines = 0;
		for (let r = 0; r < ROWS; r++) {
			for (let c = 0; c < COLS; c++) {
				if (grid[r][c].value !== 'mine' && grid[r][c].state !== 'revealed') {
					unrevealedNonMines++;
				}
			}
		}

		if (unrevealedNonMines === 0) {
			gameWon = true;
		}
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
	}

	// Initialize on mount
	onMount(() => {
		initGame();
	});
</script>

<div
	class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-yellow-300 p-8 font-mono"
>
	<div class="mb-8 animate-bounce text-center">
		<h1 class="mb-2 text-5xl font-black text-black uppercase drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">
			💣 BOOM BOX 💣
		</h1>
		<p class="text-lg font-bold text-black">Don't touch the spicy rocks!</p>
	</div>

	<div
		class="relative z-10 flex flex-col items-center gap-6 border-4 border-black bg-white p-6 shadow-[12px_12px_0_rgba(0,0,0,1)]"
	>
		<div
			class="flex w-full items-center justify-between bg-black p-2 px-4 text-xl font-bold text-yellow-300"
		>
			<span>MINES: {minesLeft}</span>
			<button
				onclick={initGame}
				class="border-2 border-white bg-yellow-300 px-3 py-1 text-sm text-black uppercase transition-colors hover:bg-white"
			>
				Reset 🔄
			</button>
		</div>

		{#if gameOver}
			<div class="animate-pulse text-3xl font-black text-red-600 uppercase">💥 KABOOM! 💥</div>
		{:else if gameWon}
			<div class="animate-bounce text-3xl font-black text-green-600 uppercase">🏆 VICTORY! 🏆</div>
		{/if}

		<div
			class="grid gap-1 border-4 border-black bg-black p-1"
			style:grid-template-columns="repeat({COLS}, minmax(0, 1fr))"
		>
			{#each grid as row, r}
				{#each row as cell, c}
					<button
						class="flex h-8 w-8 items-center justify-center text-sm font-black transition-all
						{cell.state === 'revealed' ? 'bg-white' : 'bg-gray-500 hover:bg-gray-400 active:translate-y-1'}
						{cell.state === 'flagged' ? 'bg-yellow-400' : ''}"
						onclick={() => handleReveal(r, c)}
						oncontextmenu={(e) => {
							e.preventDefault();
							handleFlag(r, c);
						}}
					>
						{#if cell.state === 'revealed'}
							{#if cell.value === 'mine'}
								💣
							{:else if typeof cell.value === 'number' && cell.value > 0}
								<span class="text-blue-600">{cell.value}</span>
							{:else}{/if}
						{:else if cell.state === 'flagged'}
							🚩
						{/if}
					</button>
				{/each}
			{/each}
		</div>
	</div>

	<a
		href="/"
		class="relative z-10 mt-10 font-bold text-black underline decoration-4 transition-colors hover:text-white"
	>
		← BACK TO CHAOS
	</a>

	<!-- Funny Backup Button -->
	<button
		onclick={triggerChaos}
		class="absolute right-4 bottom-4 border-4 border-black bg-pink-500 p-4 text-xs font-black text-white uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] transition-transform hover:rotate-12"
	>
		Don't Click Me 🚫
	</button>

	<!-- Chaos Modal -->
	{#if showChaosModal}
		<div
			class="fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
		>
			<div
				class="animate-in fade-in zoom-in w-full max-w-sm border-8 border-black bg-white p-8 text-center shadow-[16px_16px_0_rgba(0,0,0,1)] duration-200"
			>
				<div class="mb-4 text-6xl">🤬</div>
				<h2 class="mb-4 text-2xl font-black text-black uppercase">Wait, what?!</h2>
				<p class="mb-8 text-xl font-bold text-black italic">"{modalMessage}"</p>
				<button
					onclick={closeChaosModal}
					class="w-full border-4 border-white bg-black px-6 py-3 font-black text-white uppercase transition-colors hover:bg-pink-500"
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
</style>
