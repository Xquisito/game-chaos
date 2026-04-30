<script lang="ts">
	import { onMount } from 'svelte';

	let highScores = $state<Record<string, number>>({
		minesweeper: 0,
		checkers: 0,
		enduro: 0,
		'space-chaos': 0,
		tetris: 0
	});

	let lastJoyUp = false;
	let lastJoyDown = false;
	let lastFireBtn = false;

	function loadScores() {
		highScores.minesweeper = parseInt(localStorage.getItem('minesweeper-wins') || '0', 10);
		highScores.checkers = parseInt(localStorage.getItem('checkers-wins') || '0', 10);
		highScores.enduro = parseInt(localStorage.getItem('enduro-high-score') || '0', 10);
		highScores['space-chaos'] = parseInt(localStorage.getItem('space-chaos-high-score') || '0', 10);
		highScores.tetris = parseInt(localStorage.getItem('tetris-chaos-high-score') || '0', 10);
	}

	function resetScore(game: string) {
		let key = '';
		if (game === 'minesweeper') key = 'minesweeper-wins';
		else if (game === 'checkers') key = 'checkers-wins';
		else if (game === 'enduro') key = 'enduro-high-score';
		else if (game === 'tetris') key = 'tetris-chaos-high-score';
		else key = 'space-chaos-high-score';

		localStorage.removeItem(key);
		loadScores();
	}

	function moveFocus(direction: number) {
		const focusable = Array.from(
			document.querySelectorAll('button:not([disabled]), a:not([disabled])')
		) as HTMLElement[];
		if (focusable.length === 0) return;

		let index = focusable.indexOf(document.activeElement as HTMLElement);
		if (index === -1) {
			focusable[0].focus();
			return;
		}

		index = (index + direction + focusable.length) % focusable.length;
		focusable[index].focus();
	}

	onMount(() => {
		loadScores();

		// Auto-focus first button
		setTimeout(() => {
			const firstBtn = document.querySelector('button, a') as HTMLElement;
			firstBtn?.focus();
		}, 100);

		let gamepadPollId: number | null = null;

		const stopGamepadPolling = () => {
			if (gamepadPollId !== null) {
				clearInterval(gamepadPollId);
				gamepadPollId = null;
			}

			lastJoyUp = false;
			lastJoyDown = false;
			lastFireBtn = false;
		};

		const pollGamepad = () => {
			const gamepads = navigator.getGamepads();
			for (const gp of gamepads) {
				if (!gp) continue;

				const axisY = gp.axes[1];
				const DEADZONE = 0.3;

				const joyUp = gp.buttons[12]?.pressed || axisY < -DEADZONE;
				const joyDown = gp.buttons[13]?.pressed || axisY > DEADZONE;
				const fireBtn =
					gp.buttons[0]?.pressed ||
					gp.buttons[2]?.pressed ||
					gp.buttons[3]?.pressed ||
					gp.buttons[7]?.pressed;
				const quitBtn = gp.buttons[1]?.pressed || gp.buttons[8]?.pressed || gp.buttons[9]?.pressed;

				if (joyUp && !lastJoyUp) moveFocus(-1);
				if (joyDown && !lastJoyDown) moveFocus(1);

				if (fireBtn && !lastFireBtn) {
					if (document.activeElement instanceof HTMLElement) {
						document.activeElement.click();
					}
				}

				if (quitBtn) {
					window.location.href = '/';
				}

				lastJoyUp = joyUp;
				lastJoyDown = joyDown;
				lastFireBtn = fireBtn;
			}
		};

		const startGamepadPolling = () => {
			if (gamepadPollId !== null || document.visibilityState !== 'visible') return;

			pollGamepad();
			gamepadPollId = window.setInterval(pollGamepad, 80);
		};

		const syncGamepadPolling = () => {
			if (document.visibilityState !== 'visible') {
				stopGamepadPolling();
				return;
			}

			const hasConnectedGamepad = (navigator.getGamepads?.() ?? []).some(Boolean);
			if (hasConnectedGamepad) {
				startGamepadPolling();
				return;
			}

			stopGamepadPolling();
		};

		const handleVisibilityChange = () => {
			syncGamepadPolling();
		};

		window.addEventListener('gamepadconnected', handleVisibilityChange);
		window.addEventListener('gamepaddisconnected', handleVisibilityChange);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		syncGamepadPolling();

		return () => {
			stopGamepadPolling();
			window.removeEventListener('gamepadconnected', handleVisibilityChange);
			window.removeEventListener('gamepaddisconnected', handleVisibilityChange);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});
</script>

<svelte:head>
	<title>System Settings | The Chaos Arcade</title>
	<meta name="description" content="Manage your Chaos Arcade cabinet. Reset scores, tune performance, and configure system settings." />
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-black p-8 font-mono text-white">
	<div class="mb-12 text-center">
		<h1
			class="mb-4 text-6xl font-black tracking-tighter text-yellow-400 uppercase drop-shadow-[4px_4px_0_rgba(255,255,255,0.2)]"
		>
			⚙️ SYSTEM SETTINGS ⚙️
		</h1>
		<p class="text-xl font-bold text-gray-400">MEMORY MANAGEMENT UNIT</p>
	</div>

	<div class="flex w-full max-w-2xl flex-col gap-6">
		<!-- Minesweeper -->
		<div class="flex items-center justify-between border-4 border-white bg-zinc-900 p-6">
			<div>
				<h2 class="text-3xl font-black uppercase">Minesweeper</h2>
				<p class="text-lg font-bold text-yellow-400">WINS: {highScores.minesweeper}</p>
			</div>
			<button
				onclick={() => resetScore('minesweeper')}
				class="border-4 border-red-500 bg-red-600 px-8 py-3 text-xl font-black text-white transition-all hover:scale-110 focus:scale-110 focus:outline-none active:scale-95"
			>
				RESET
			</button>
		</div>

		<!-- Checkers -->
		<div class="flex items-center justify-between border-4 border-white bg-zinc-900 p-6">
			<div>
				<h2 class="text-3xl font-black uppercase">Checkers Chaos</h2>
				<p class="text-lg font-bold text-yellow-400">WINS: {highScores.checkers}</p>
			</div>
			<button
				onclick={() => resetScore('checkers')}
				class="border-4 border-red-500 bg-red-600 px-8 py-3 text-xl font-black text-white transition-all hover:scale-110 focus:scale-110 focus:outline-none active:scale-95"
			>
				RESET
			</button>
		</div>

		<!-- Enduro -->
		<div class="flex items-center justify-between border-4 border-white bg-zinc-900 p-6">
			<div>
				<h2 class="text-3xl font-black uppercase">Enduro Chaos</h2>
				<p class="text-lg font-bold text-yellow-400">HI-SCORE: {highScores.enduro}</p>
			</div>
			<button
				onclick={() => resetScore('enduro')}
				class="border-4 border-red-500 bg-red-600 px-8 py-3 text-xl font-black text-white transition-all hover:scale-110 focus:scale-110 focus:outline-none active:scale-95"
			>
				RESET
			</button>
		</div>

		<!-- Space Chaos -->
		<div class="flex items-center justify-between border-4 border-white bg-zinc-900 p-6">
			<div>
				<h2 class="text-3xl font-black uppercase">Space Chaos</h2>
				<p class="text-lg font-bold text-yellow-400">HI-SCORE: {highScores['space-chaos']}</p>
			</div>
			<button
				onclick={() => resetScore('space-chaos')}
				class="border-4 border-red-500 bg-red-600 px-8 py-3 text-xl font-black text-white transition-all hover:scale-110 focus:scale-110 focus:outline-none active:scale-95"
			>
				RESET
			</button>
		</div>

		<!-- Tetris -->
		<div class="flex items-center justify-between border-4 border-white bg-zinc-900 p-6">
			<div>
				<h2 class="text-3xl font-black uppercase">Tetris Chaos</h2>
				<p class="text-lg font-bold text-yellow-400">HI-SCORE: {highScores.tetris}</p>
			</div>
			<button
				onclick={() => resetScore('tetris')}
				class="border-4 border-red-500 bg-red-600 px-8 py-3 text-xl font-black text-white transition-all hover:scale-110 focus:scale-110 focus:outline-none active:scale-95"
			>
				RESET
			</button>
		</div>

		<!-- Return -->
		<a
			href="/"
			class="mt-8 border-4 border-white bg-white py-5 text-center text-3xl font-black text-black transition-all hover:scale-105 focus:scale-105 focus:outline-none active:scale-95"
		>
			RETURN TO DASHBOARD
		</a>
	</div>

	<div class="mt-12 text-sm font-bold text-gray-500 uppercase italic">
		Joystick: A to Select · B to Return
	</div>
</div>

<style>
	:global(body) {
		background-color: black;
	}
</style>
