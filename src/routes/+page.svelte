<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		createScoreRecord,
		gameCabinets,
		readCabinetScore,
		utilityCabinets,
		type GameCabinet,
		type GameCabinetId,
		type UtilityCabinet,
		type UtilityCabinetId
	} from '$lib/cabinets';
	import {
		activateFocusedControlItem,
		createUnifiedGamepadPoller,
		DASHBOARD_ACTION_SELECTOR,
		focusFirstControlItem,
		handleGridMenuKeydown,
		moveGridFocus
	} from '$lib/unified-controls';

	type DashboardGameCabinet = GameCabinet & {
		name: string;
		description: string;
		kicker: string;
		cta: string;
	};
	type DashboardUtilityCabinet = UtilityCabinet & {
		name: string;
		description: string;
		kicker: string;
		meta: string;
		cta: string;
	};
	type DashboardCabinet = DashboardGameCabinet | DashboardUtilityCabinet;

	const gameCopy: Record<
		GameCabinetId,
		Pick<DashboardGameCabinet, 'name' | 'description' | 'kicker' | 'cta'>
	> = {
		minesweeper: {
			name: 'Minesweeper',
			description: 'Avoid the boom with quick reads and cooler nerves.',
			kicker: 'Puzzle Bay',
			cta: 'Insert Coin'
		},
		sudoku: {
			name: 'Sudoku Chaos',
			description: 'Fill the grid with pure logic, from Easy to Expert.',
			kicker: 'Logic Lab',
			cta: 'Solve It'
		},
		checkers: {
			name: 'Checkers Chaos',
			description: 'Fast board control in a chunky neon showdown.',
			kicker: 'Battle Table',
			cta: 'Start Match'
		},
		enduro: {
			name: 'Enduro Chaos',
			description: 'Race the night through storms, ice, and blind corners.',
			kicker: 'Road Fury',
			cta: 'Burn Rubber'
		},
		'space-chaos': {
			name: 'Space Chaos',
			description: 'Scramble the fleet and climb the cosmic score board.',
			kicker: 'Galaxy Sector',
			cta: 'Launch Run'
		},
		tetris: {
			name: 'Tetris Chaos',
			description: 'Stack the blocks and survive the falling chaos!',
			kicker: 'Block Zone',
			cta: 'Drop In'
		},
		'frog-chaos': {
			name: 'FROG CHAOS',
			description: 'Hop the road, ride the river, and claim every pad.',
			kicker: 'River Panic',
			cta: 'Hop In'
		}
	};

	const utilityCopy: Record<
		UtilityCabinetId,
		Pick<DashboardUtilityCabinet, 'name' | 'description' | 'kicker' | 'meta' | 'cta'>
	> = {
		settings: {
			name: 'Settings',
			description: 'Tune the cabinet, inspect scores, and wipe save data.',
			kicker: 'System Deck',
			meta: 'Scores • Reset • System',
			cta: 'Open Panel'
		}
	};

	const dashboardGameCabinets: DashboardGameCabinet[] = gameCabinets.map((cabinet) => ({
		...cabinet,
		...gameCopy[cabinet.id]
	}));
	const dashboardUtilityCabinets: DashboardUtilityCabinet[] = utilityCabinets.map((cabinet) => ({
		...cabinet,
		...utilityCopy[cabinet.id]
	}));
	const dashboardCabinets: DashboardCabinet[] = [
		...dashboardGameCabinets,
		...dashboardUtilityCabinets
	];

	let scores = $state<Record<GameCabinetId, number>>(createScoreRecord());

	const isMobile =
		typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

	const appVersion = __APP_VERSION__;

	function setLanguage(lang: string) {
		document.cookie = `lang=${lang}; path=/; max-age=31536000`;
		window.location.reload();
	}

	function isGameCard(card: DashboardCabinet): card is DashboardGameCabinet {
		return card.kind === 'game';
	}

	function loadScores() {
		for (const cabinet of gameCabinets) {
			scores[cabinet.id] = readCabinetScore(localStorage, cabinet);
		}
	}

	function handleDashboardKeydown(event: KeyboardEvent) {
		handleGridMenuKeydown(event, { selector: DASHBOARD_ACTION_SELECTOR });
	}

	function scoreLabel(card: GameCabinet) {
		return card.score.mode === 'wins' ? 'Wins' : 'Hi-Score';
	}

	function scoreText(card: DashboardGameCabinet) {
		return `${scoreLabel(card)}: ${scores[card.id].toLocaleString()}`;
	}

	$effect(() => {
		loadScores();
		let animationFrame = requestAnimationFrame(() => {
			focusFirstControlItem(DASHBOARD_ACTION_SELECTOR, true);
		});
		const gamepad = createUnifiedGamepadPoller({
			intervalMs: () => (isMobile ? 250 : 80),
			shouldStart: () => document.visibilityState === 'visible',
			onUp: () => moveGridFocus('up', DASHBOARD_ACTION_SELECTOR),
			onDown: () => moveGridFocus('down', DASHBOARD_ACTION_SELECTOR),
			onLeft: () => moveGridFocus('left', DASHBOARD_ACTION_SELECTOR),
			onRight: () => moveGridFocus('right', DASHBOARD_ACTION_SELECTOR),
			onSelect: () => activateFocusedControlItem(DASHBOARD_ACTION_SELECTOR)
		});

		const handleGamepadChange = () => {
			gamepad.sync();
		};

		const handleVisibilityChange = () => {
			loadScores();
			gamepad.sync();
		};

		window.addEventListener('gamepadconnected', handleGamepadChange);
		window.addEventListener('gamepaddisconnected', handleGamepadChange);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		gamepad.sync();

		return () => {
			cancelAnimationFrame(animationFrame);
			gamepad.destroy();
			window.removeEventListener('gamepadconnected', handleGamepadChange);
			window.removeEventListener('gamepaddisconnected', handleGamepadChange);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});
</script>

<svelte:head>
	<title>The Chaos Arcade | Ultimate Vintage Retro Games</title>
	<meta
		name="description"
		content="Play the best vintage arcade games online. Minesweeper, Checkers, and 3D Racing. 100% Free and Caotic."
	/>
	<meta property="og:title" content="The Chaos Arcade | Retro Gaming Hub" />
	<meta
		property="og:description"
		content="Experience the thrill of classic arcade games with a modern twist. Play Minesweeper, Checkers, and more!"
	/>
</svelte:head>

<svelte:window onfocus={loadScores} onkeydown={handleDashboardKeydown} />

<div class="min-h-screen bg-yellow-300 px-2 py-3 font-mono text-black sm:px-6 sm:py-6">
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-6">
		<header
			class="border-4 border-black bg-yellow-200 p-3 shadow-[4px_4px_0_rgba(0,0,0,1)] sm:p-5 sm:shadow-[8px_8px_0_rgba(0,0,0,1)]"
		>
			<div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<p class="text-[0.6rem] font-black tracking-[0.3em] uppercase sm:text-sm">
						Arcade Hub // Ready
					</p>
					<h1
						class="mt-1 text-3xl font-black tracking-tight uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,1)] sm:mt-2 sm:text-5xl sm:drop-shadow-[4px_4px_0_rgba(0,0,0,1)]"
					>
						🕹️ Chaos Arcade
					</h1>
					<p class="mt-1 max-w-3xl text-xs font-bold uppercase sm:mt-2 sm:text-base">
						Tap or use D-pad to jump cabinets.
					</p>
				</div>

				<div class="flex flex-wrap gap-2 text-[0.65rem] font-black uppercase sm:text-sm">
					<div
						class="border-[3px] border-black bg-black px-2 py-1 text-yellow-300 sm:border-4 sm:px-3 sm:py-2"
					>
						{dashboardCabinets.length} Hotspots
					</div>
					<div class="border-[3px] border-black bg-white px-2 py-1 sm:border-4 sm:px-3 sm:py-2">
						Launch = Enter
					</div>
					<div class="border-[3px] border-black bg-white px-2 py-1 sm:border-4 sm:px-3 sm:py-2">
						v{appVersion}
					</div>
					<button
						type="button"
						onclick={() => setLanguage('en')}
						class="border-[3px] border-black bg-white px-2 py-1 hover:bg-black hover:text-white sm:border-4 sm:px-3 sm:py-2"
					>
						EN
					</button>
					<button
						type="button"
						onclick={() => setLanguage('pt-BR')}
						class="border-[3px] border-black bg-white px-2 py-1 hover:bg-black hover:text-white sm:border-4 sm:px-3 sm:py-2"
					>
						PT
					</button>
				</div>
			</div>
		</header>

		<section class="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-4">
			{#each dashboardCabinets as card (card.id)}
				<a
					href={resolve(card.href)}
					data-dashboard-action="true"
					class="dashboard-card group block focus:outline-none focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black"
				>
					<article
						class="dashboard-card-inner flex h-full flex-col border-4 border-black bg-black shadow-[3px_3px_0_rgba(0,0,0,1)] sm:shadow-[8px_8px_0_rgba(0,0,0,1)]"
					>
						<!-- Marquee header -->
						<div
							class="{card.marquee} flex items-center justify-between border-b-4 border-black px-2 py-1 sm:px-4 sm:py-2"
						>
							<p class="text-[0.5rem] font-black tracking-[0.22em] uppercase sm:text-xs">
								{card.kicker}
							</p>
							<p class="text-[0.65rem] font-black uppercase sm:text-sm">▶</p>
						</div>

						<!-- Unified body: horizontal row on mobile, vertical stack on desktop -->
						<div
							class="{card.color} flex flex-1 items-center gap-3 p-3 sm:flex-col sm:items-start sm:justify-between sm:p-5"
						>
							<div
								class="flex h-12 w-12 shrink-0 items-center justify-center border-4 border-black bg-black text-2xl sm:h-[4.5rem] sm:w-[4.5rem] sm:text-4xl"
							>
								{card.emoji}
							</div>

							<div class="flex min-w-0 flex-1 flex-col justify-between gap-1 sm:w-full sm:flex-1">
								<div>
									<h2 class="text-sm font-black uppercase leading-none sm:text-[1.7rem]">
										{card.name}
									</h2>
									<p
										class="mt-0.5 text-[0.6rem] font-bold uppercase leading-tight text-black/70 sm:mt-2 sm:text-[0.95rem]"
									>
										{card.description}
									</p>
								</div>

								<div class="mt-1 flex items-center justify-between gap-2 sm:mt-4">
									<div
										class="border-[3px] border-black bg-black px-2 py-1 text-[0.5rem] font-black uppercase text-yellow-300 sm:border-4 sm:px-3 sm:py-2 sm:text-sm"
									>
										{#if isGameCard(card)}
											{scoreText(card)}
										{:else}
											{card.meta}
										{/if}
									</div>

									<span
										class="border-[3px] border-black bg-white px-2.5 py-1.5 text-[0.55rem] font-black uppercase shadow-[2px_2px_0_rgba(0,0,0,1)] transition-colors group-hover:bg-black group-hover:text-white group-hover:shadow-none sm:min-w-36 sm:border-4 sm:px-3 sm:py-3 sm:text-base sm:shadow-[4px_4px_0_rgba(0,0,0,1)]"
									>
										{card.cta}
									</span>
								</div>
							</div>
						</div>
					</article>
				</a>
			{/each}
		</section>

		<footer
			class="flex flex-wrap items-center justify-between gap-2 border-4 border-black bg-black px-3 py-2 text-[0.65rem] font-black text-yellow-300 uppercase shadow-[4px_4px_0_rgba(0,0,0,1)] sm:px-4 sm:py-3 sm:text-sm sm:shadow-[8px_8px_0_rgba(0,0,0,1)]"
		>
			<p>Built with ⚡ SvelteKit</p>
			<p>Cabinet memory: Online</p>
		</footer>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}

	.dashboard-card {
		content-visibility: auto;
		contain-intrinsic-size: 5rem;
	}
</style>
