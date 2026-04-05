<script lang="ts">
	import { onMount } from 'svelte';

	// --- Game Logic ---
	type PieceType = 'black' | 'white';
	type Piece = { type: PieceType; isKing: boolean } | null;
	type Cell = Piece;

	const SIZE = 8;
	let board = $state<Cell[][]>([]);
	let selectedCell = $state<{ r: number; c: number } | null>(null);
	let turn = $state<PieceType>('white');
	let gameOver = $state(false);
	let winner = $state<PieceType | null>(null);

	// AI & Difficulty State
	type Difficulty = 'easy' | 'medium' | 'hard' | 'human';
	let difficulty = $state<Difficulty>('human');
	let isAiThinking = $state(false);

	// Chaos Modal State
	let showChaosModal = $state(false);
	let modalMessage = $state('');

	function initGame() {
		const newBoard: Cell[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

		for (let r = 0; r < SIZE; r++) {
			for (let c = 0; c < SIZE; c++) {
				if ((r + c) % 2 !== 0) {
					if (r < 3) {
						newBoard[r][c] = { type: 'black', isKing: false };
					} else if (r > 4) {
						newBoard[r][c] = { type: 'white', isKing: false };
					}
				}
			}
		}
		board = newBoard;
		turn = 'white';
		gameOver = false;
		winner = null;
		selectedCell = null;
	}

	function handleCellClick(r: number, c: number) {
		if (gameOver || (difficulty !== 'human' && turn === 'black')) return;

		const cell = board[r][c];

		if (selectedCell) {
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

	function isValidMove(fromR: number, fromC: number, toR: number, toC: number): boolean {
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
		for (let r = 0; r < SIZE; r++) {
			for (let c = 0; c < SIZE; c++) {
				const piece = board[r][c];
				if (piece && piece.type === player) {
					// Check all possible destination cells
					for (let tr = 0; tr < SIZE; tr++) {
						for (let tc = 0; tc < SIZE; tc++) {
							if (isValidMove(r, c, tr, tc)) {
								moves.push({ from: { r, c }, to: { r: tr, c: tc } });
							}
						}
					}
				}
			}
		}
		return moves;
	}

	function executeMove(fromR: number, fromC: number, toR: number, toC: number) {
		const piece = board[fromR][fromC]!;

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
	}

	function checkGameOver() {
		let whiteExists = false;
		let blackExists = false;

		for (let r = 0; r < SIZE; r++) {
			for (let c = 0; c < SIZE; c++) {
				if (board[r][c]?.type === 'white') whiteExists = true;
				if (board[r][c]?.type === 'black') blackExists = true;
			}
		}

		if (!whiteExists) {
			gameOver = true;
			winner = 'black';
		} else if (!blackExists) {
			gameOver = true;
			winner = 'white';
		}
	}

	// --- AI Logic ---
	async function runAiTurn() {
		if (gameOver || turn !== 'black') return;
		isAiThinking = true;

		// Simulate thinking time
		await new Promise((resolve) => setTimeout(resolve, 800));

		const moves = getAllValidMoves('black');

		if (moves.length === 0) {
			// No moves available, check if it's actually game over or just stuck
			checkGameOver();
			if (!gameOver) {
				// If no moves but pieces exist, player might have won by blocking
				gameOver = true;
				winner = 'white';
			}
		} else {
			let selectedMove;

			if (difficulty === 'easy') {
				// Random move
				selectedMove = moves[Math.floor(Math.random() * moves.length)];
			} else if (difficulty === 'medium') {
				// Prioritize jumps
				const jumps = moves.filter((m) => Math.abs(m.to.r - m.from.r) === 2);
				selectedMove =
					jumps.length > 0
						? jumps[Math.floor(Math.random() * jumps.length)]
						: moves[Math.floor(Math.random() * moves.length)];
			} else {
				// Hard: Minimax-lite (Prioritize jumps, then kings)
				// We'll implement a simple heuristic: score = (pieces_captured * 10) + (is_king ? 5 : 0)
				// For simplicity in this single-file version, we'll just pick the best immediate move
				let bestScore = -Infinity;
				for (const move of moves) {
					let score = 0;
					const isJump = Math.abs(move.to.r - move.from.r) === 2;
					if (isJump) score += 10;

					// Check if it makes the piece a king
					const piece = board[move.from.r][move.from.c];
					if (piece?.isKing === false && move.to.r === SIZE - 1) score += 5;

					if (score > bestScore) {
						bestScore = score;
						selectedMove = move;
					}
				}
				selectedMove = selectedMove || moves[0];
			}

			if (selectedMove) {
				executeMove(selectedMove.from.r, selectedMove.from.c, selectedMove.to.r, selectedMove.to.c);
			}
		}

		isAiThinking = false;
	}

	// Watch turn to trigger AI
	$effect(() => {
		if (turn === 'black' && difficulty !== 'human' && !gameOver) {
			runAiTurn();
		}
	});

	function triggerChaos() {
		const messages = [
			'STOP TOUCHING THE BOARD! 😤',
			'SYSTEM ERROR: Too much strategy detected! ⚠️',
			'Are you trying to win?! 🤨',
			'Your pieces are feeling threatened. 🕵️‍♂️',
			'ERROR 404: Victory Not Found. 🧠💨'
		];
		modalMessage = messages[Math.floor(Math.random() * messages.length)];
		showChaosModal = true;
	}

	onMount(() => {
		initGame();
	});
</script>

<div
	class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-orange-400 p-8 font-mono"
>
	<div class="mb-8 animate-bounce text-center">
		<h1 class="mb-2 text-5xl font-black text-black uppercase drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">
			🏁 CHECKERS CHAOS 🏁
		</h1>
		<p class="text-lg font-bold text-black">VICTORY OR TOTAL ANNIHILATION!</p>
	</div>

	<div class="mb-4 flex gap-2">
		{#each ['human', 'easy', 'medium', 'hard'] as diff}
			<button
				onclick={() => {
					difficulty = diff as Difficulty;
					initGame();
				}}
				class="border-2 border-black px-3 py-1 text-xs font-black uppercase transition-all
				{difficulty === diff
					? 'scale-110 bg-black text-orange-400'
					: 'bg-white text-black hover:bg-orange-200'}"
			>
				{diff}
			</button>
		{/each}
	</div>

	<div
		class="relative z-10 flex flex-col items-center gap-6 border-8 border-black bg-white p-6 shadow-[12px_12px_0_rgba(0,0,0,1)]"
	>
		<div
			class="flex w-full items-center justify-between bg-black p-2 px-4 text-xl font-bold text-orange-400"
		>
			<span class="flex items-center gap-2">
				{isAiThinking ? '🤖 AI THINKING...' : `TURN: ${turn.toUpperCase()}`}
			</span>
			<button
				onclick={initGame}
				class="border-2 border-white bg-orange-400 px-3 py-1 text-sm text-black uppercase transition-colors hover:bg-white"
			>
				Reset 🔄
			</button>
		</div>

		{#if gameOver}
			<div class="animate-pulse text-3xl font-black text-red-600 uppercase">
				{winner === 'white' ? '🏆 WHITE WINS! 🏆' : '💀 BLACK WINS! 💀'}
			</div>
		{/if}

		<div
			class="grid border-8 border-black shadow-[8px_8px_0_rgba(0,0,0,0.2)]"
			style:grid-template-columns="repeat({SIZE}, minmax(0, 1fr))"
		>
			{#each board as row, r}
				{#each row as cell, c}
					<button
						class="flex h-12 w-12 items-center justify-center text-4xl transition-all sm:h-20 sm:w-20 sm:text-6xl
						{(r + c) % 2 === 0 ? 'bg-orange-200' : 'bg-orange-800'}
						{selectedCell?.r === r && selectedCell?.c === c ? 'z-20 scale-110 ring-4 ring-yellow-400' : ''}"
						onclick={() => handleCellClick(r, c)}
					>
						{#if cell}
							<span
								class="
								{cell.type === 'white' ? 'text-white' : 'text-black'}
								{cell.isKing ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)]'}
							"
							>
								{cell.isKing ? '👑' : '●'}
							</span>
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

	<!-- Forbidden Button -->
	<button
		onclick={triggerChaos}
		class="absolute right-4 bottom-4 border-4 border-black bg-pink-500 p-4 text-xs font-black text-white uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] transition-transform hover:rotate-12"
	>
		Don't Click Me 🚫
	</button>

	<!-- Chaos Modal -->
	{#if showChaosModal}
		<div
			class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
		>
			<div
				class="animate-in fade-in zoom-in w-full max-w-sm border-8 border-black bg-white p-8 text-center shadow-[16px_16px_0_rgba(0,0,0,1)] duration-200"
			>
				<div class="mb-4 text-6xl">🤬</div>
				<h2 class="mb-4 text-2xl font-black text-black uppercase">Wait, what?!</h2>
				<p class="mb-8 text-xl font-bold text-black italic">"{modalMessage}"</p>
				<button
					onclick={() => (showChaosModal = false)}
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
