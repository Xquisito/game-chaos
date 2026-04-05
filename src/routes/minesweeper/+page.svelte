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
	let modalMessage = $state("");

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
			"I TOLD YOU NOT TO CLICK IT! 😤",
			"SYSTEM ERROR: Too much chaos detected! ⚠️",
			"Are you even listening?! 🤨",
			"Your finger is too curious for its own good. 🕵️‍♂️",
			"ERROR 404: Sanity Not Found. 🧠💨"
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

<div class="min-h-screen bg-yellow-300 flex flex-col items-center justify-center p-8 font-mono overflow-hidden relative">
	<div class="text-center mb-8 animate-bounce">
		<h1 class="text-5xl font-black text-black mb-2 drop-shadow-[4px_4px_0_rgba(0,0,0,1)] uppercase">
			💣 BOOM BOX 💣
		</h1>
		<p class="text-lg text-black font-bold">Don't touch the spicy rocks!</p>
	</div>

	<div class="bg-white border-4 border-black p-6 shadow-[12px_12px_0_rgba(0,0,0,1)] flex flex-col items-center gap-6 relative z-10">
		<div class="flex justify-between w-full items-center bg-black text-yellow-300 p-2 px-4 font-bold text-xl">
			<span>MINES: {minesLeft}</span>
			<button 
				onclick={initGame}
				class="bg-yellow-300 text-black px-3 py-1 border-2 border-white hover:bg-white transition-colors uppercase text-sm"
			>
				Reset 🔄
			</button>
		</div>

		{#if gameOver}
			<div class="text-3xl font-black text-red-600 animate-pulse uppercase">
				💥 KABOOM! 💥
			</div>
		{:else if gameWon}
			<div class="text-3xl font-black text-green-600 animate-bounce uppercase">
				🏆 VICTORY! 🏆
			</div>
		{/if}

		<div class="grid gap-1 bg-black p-1 border-4 border-black" 
			 style:grid-template-columns="repeat({COLS}, minmax(0, 1fr))">
			{#each grid as row, r}
				{#each row as cell, c}
					<button
						class="w-8 h-8 flex items-center justify-center text-sm font-black transition-all
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
							{:else}
								
							{/if}
						{:else if cell.state === 'flagged'}
							🚩
						{/if}
					</button>
				{/each}
			{/each}
		</div>
	</div>

	<a href="/" class="mt-10 text-black font-bold underline decoration-4 hover:text-white transition-colors relative z-10">
		← BACK TO CHAOS
	</a>

	<!-- Funny Backup Button -->
	<button 
		onclick={triggerChaos}
		class="absolute bottom-4 right-4 bg-pink-500 text-white font-black p-4 border-4 border-black shadow-[4px_4px_0_rgba(0,0,0,1)] hover:rotate-12 transition-transform uppercase text-xs"
	>
		Don't Click Me 🚫
	</button>

	<!-- Chaos Modal -->
	{#if showChaosModal}
		<div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
			<div class="bg-white border-8 border-black p-8 shadow-[16px_16px_0_rgba(0,0,0,1)] max-w-sm w-full text-center animate-in fade-in zoom-in duration-200">
				<div class="text-6xl mb-4">🤬</div>
				<h2 class="text-2xl font-black text-black mb-4 uppercase">Wait, what?!</h2>
				<p class="text-xl font-bold text-black mb-8 italic">"{modalMessage}"</p>
				<button 
					onclick={closeChaosModal}
					class="w-full bg-black text-white font-black py-3 px-6 border-4 border-white hover:bg-pink-500 transition-colors uppercase"
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
