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
		moveLinearFocus,
		MENU_BUTTON_SELECTOR
	} from '$lib/unified-controls';
	import { onMount } from 'svelte';

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

	function formatScore(cabinet: GameCabinet) {
		return highScores[cabinet.id].toLocaleString();
	}

	onMount(() => {
		loadScores();

		setTimeout(() => {
			focusFirstControlItem(MENU_BUTTON_SELECTOR, true);
		}, 100);

		const gamepad = createUnifiedGamepadPoller({
			deadzone: 0.3,
			shouldStart: () => document.visibilityState === 'visible',
			onPrevious: () => moveLinearFocus(-1, MENU_BUTTON_SELECTOR),
			onNext: () => moveLinearFocus(1, MENU_BUTTON_SELECTOR),
			onSelect: () => activateFocusedControlItem(MENU_BUTTON_SELECTOR),
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
	class="min-h-screen bg-yellow-300 px-1 py-1 font-mono text-black sm:px-6 sm:py-8"
>
	<div class="mx-auto flex min-h-[calc(100vh-0.5rem)] w-full max-w-2xl items-center justify-center sm:min-h-[calc(100vh-4rem)]">
		<div
			class="w-full border-4 border-black bg-white shadow-[4px_4px_0_rgba(0,0,0,1)] sm:shadow-[14px_14px_0_rgba(0,0,0,1)]"
		>
			<div class="border-b-4 border-black bg-black px-4 py-3 text-yellow-300 sm:px-8 sm:py-5">
				<div
					class="text-[0.55rem] font-black tracking-[0.4em] uppercase text-yellow-300/50 sm:text-xs"
				>
					System Deck
				</div>
				<h1
					class="text-xl font-black leading-none uppercase sm:text-5xl sm:drop-shadow-[3px_3px_0_rgba(255,221,0,0.25)]"
				>
					⚙️ System Settings ⚙️
				</h1>
				<p class="mt-1 text-[0.65rem] font-bold uppercase text-yellow-300/60 sm:mt-2 sm:text-base">
					Memory management unit — wipe cabinet saves.
				</p>
			</div>

			<div class="p-3 sm:p-8">
				<div class="mb-3 flex items-center justify-between gap-2 sm:mb-4">
					<div
						class="text-[0.55rem] font-black tracking-[0.3em] uppercase text-black/50 sm:text-xs"
					>
						Cabinet Memory
					</div>
					<div class="text-[0.55rem] font-bold uppercase text-black/50 sm:text-xs">
						{gameCabinets.length} units
					</div>
				</div>

				<ul class="flex flex-col gap-1.5 sm:gap-3">
					{#each gameCabinets as cabinet (cabinet.id)}
						<li
							class="flex items-center gap-2 border-2 border-black bg-yellow-100 p-2 sm:gap-3 sm:border-4 sm:p-3"
						>
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-black bg-black text-base sm:h-12 sm:w-12 sm:border-4 sm:text-2xl"
								aria-hidden="true"
							>
								{cabinet.emoji}
							</div>

							<div class="min-w-0 flex-1">
								<h2
									class="truncate text-[0.7rem] font-black uppercase leading-tight sm:text-lg"
								>
									{cabinet.schemaName}
								</h2>
								<div
									class="mt-0.5 inline-block border-[2px] border-black bg-black px-1.5 py-0.5 text-[0.55rem] font-black uppercase text-yellow-300 sm:mt-1 sm:border-[3px] sm:px-2 sm:py-1 sm:text-[0.65rem]"
								>
									{scoreLabel(cabinet)}: {formatScore(cabinet)}
								</div>
							</div>

							<button
								type="button"
								data-menu-button
								onclick={() => resetScore(cabinet)}
								class="shrink-0 border-2 border-red-500 bg-red-600 px-2 py-1.5 text-[0.6rem] font-black uppercase text-white transition-all hover:scale-110 focus:scale-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300 focus-visible:ring-offset-2 active:scale-95 sm:border-4 sm:px-4 sm:py-2 sm:text-sm"
							>
								Reset
							</button>
						</li>
					{/each}
				</ul>

				<a
					href={resolve('/')}
					data-menu-button
					class="mt-3 flex w-full items-center justify-center border-2 border-black bg-white py-2.5 text-sm font-black uppercase transition-all hover:bg-black hover:text-white focus:bg-black focus:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 active:scale-[0.98] sm:mt-6 sm:border-4 sm:py-4 sm:text-xl"
				>
					Return to Dashboard
				</a>

				<p
					class="mt-3 text-center text-[0.6rem] font-bold uppercase text-black/60 sm:mt-4 sm:text-xs"
				>
					A / Enter = select • B / Esc = return
				</p>
			</div>
		</div>
	</div>
</div>
