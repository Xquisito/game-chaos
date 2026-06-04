<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		createScoreRecord,
		gameCabinets,
		readCabinetScore,
		resetCabinetScore,
		type GameCabinet,
		type GameCabinetId
	} from '$lib/cabinets';
	import {
		activateFocusedControlItem,
		createUnifiedGamepadPoller,
		focusFirstControlItem,
		moveLinearFocus
	} from '$lib/unified-controls';
	import { onMount } from 'svelte';

	const cabinetNames: Record<GameCabinetId, string> = {
		minesweeper: 'Minesweeper',
		sudoku: 'Sudoku Chaos',
		checkers: 'Checkers Chaos',
		enduro: 'Enduro Chaos',
		'space-chaos': 'Space Chaos',
		tetris: 'Tetris Chaos',
		'frog-chaos': 'Frog Chaos'
	};

	let highScores = $state<Record<GameCabinetId, number>>(createScoreRecord());

	function loadScores() {
		for (const cabinet of gameCabinets) {
			highScores[cabinet.id] = readCabinetScore(localStorage, cabinet);
		}
	}

	function resetScore(cabinet: GameCabinet) {
		resetCabinetScore(localStorage, cabinet);
		loadScores();
	}

	function scoreLabel(cabinet: GameCabinet) {
		return cabinet.score.mode === 'wins' ? 'Wins' : 'Hi-Score';
	}

	onMount(() => {
		loadScores();

		// Auto-focus first button
		setTimeout(() => {
			focusFirstControlItem('button:not([disabled]), a:not([disabled])', true);
		}, 100);

		const controlSelector = 'button:not([disabled]), a:not([disabled])';
		const gamepad = createUnifiedGamepadPoller({
			deadzone: 0.3,
			shouldStart: () => document.visibilityState === 'visible',
			onPrevious: () => moveLinearFocus(-1, controlSelector),
			onNext: () => moveLinearFocus(1, controlSelector),
			onSelect: () => activateFocusedControlItem(controlSelector),
			onBack: () => {
				window.location.href = resolve('/');
			}
		});

		const handleVisibilityChange = () => {
			gamepad.sync();
		};

		window.addEventListener('gamepadconnected', handleVisibilityChange);
		window.addEventListener('gamepaddisconnected', handleVisibilityChange);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		gamepad.sync();

		return () => {
			gamepad.destroy();
			window.removeEventListener('gamepadconnected', handleVisibilityChange);
			window.removeEventListener('gamepaddisconnected', handleVisibilityChange);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});
</script>

<svelte:head>
	<title>System Settings | The Chaos Arcade</title>
	<meta
		name="description"
		content="Manage your Chaos Arcade cabinet. Reset scores, tune performance, and configure system settings."
	/>
	<meta name="robots" content="noindex" />
</svelte:head>

<div
	class="flex min-h-screen flex-col items-center justify-center bg-black p-8 font-mono text-white"
>
	<div class="mb-12 text-center">
		<h1
			class="mb-4 text-6xl font-black tracking-tighter text-yellow-400 uppercase drop-shadow-[4px_4px_0_rgba(255,255,255,0.2)]"
		>
			⚙️ SYSTEM SETTINGS ⚙️
		</h1>
		<p class="text-xl font-bold text-gray-400">MEMORY MANAGEMENT UNIT</p>
	</div>

	<div class="flex w-full max-w-2xl flex-col gap-6">
		{#each gameCabinets as cabinet (cabinet.id)}
			<div class="flex items-center justify-between border-4 border-white bg-zinc-900 p-6">
				<div>
					<h2 class="text-3xl font-black uppercase">{cabinetNames[cabinet.id]}</h2>
					<p class="text-lg font-bold text-yellow-400">
						{scoreLabel(cabinet)}: {highScores[cabinet.id]}
					</p>
				</div>
				<button
					onclick={() => resetScore(cabinet)}
					class="border-4 border-red-500 bg-red-600 px-8 py-3 text-xl font-black text-white transition-all hover:scale-110 focus:scale-110 focus:outline-none active:scale-95"
				>
					RESET
				</button>
			</div>
		{/each}

		<!-- Return -->
		<a
			href={resolve('/')}
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
