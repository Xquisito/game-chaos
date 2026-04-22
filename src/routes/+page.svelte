<svelte:head>
	<title>The Chaos Arcade | Ultimate Vintage Retro Games</title>
	<meta name="description" content="Play the best vintage arcade games online. Minesweeper, Checkers, and 3D Racing. 100% Free and Caotic." />
	<meta property="og:title" content="The Chaos Arcade | Retro Gaming Hub" />
	<meta property="og:description" content="Experience the thrill of classic arcade games with a modern twist. Play Minesweeper, Checkers, and more!" />
</svelte:head>

<script lang="ts">
	type ScoreId = 'minesweeper' | 'checkers' | 'enduro' | 'space-chaos';
	type Direction = 'up' | 'down' | 'left' | 'right';

	type GameCard = {
		id: ScoreId;
		name: string;
		description: string;
		href: string;
		emoji: string;
		kicker: string;
		color: string;
		marquee: string;
		storageKey: string;
		scoreLabel: string;
		cta: string;
	};

	type UtilityCard = {
		id: 'settings';
		name: string;
		description: string;
		href: string;
		emoji: string;
		kicker: string;
		color: string;
		marquee: string;
		meta: string;
		cta: string;
	};

	type DashboardCard = GameCard | UtilityCard;

	const gameCards: GameCard[] = [
		{
			id: 'minesweeper',
			name: 'Minesweeper',
			description: 'Avoid the boom with quick reads and cooler nerves.',
			href: '/minesweeper',
			emoji: '💣',
			kicker: 'Puzzle Bay',
			color: 'bg-red-500',
			marquee: 'bg-red-200',
			storageKey: 'minesweeper-wins',
			scoreLabel: 'Wins',
			cta: 'Insert Coin'
		},
		{
			id: 'checkers',
			name: 'Checkers Chaos',
			description: 'Fast board control in a chunky neon showdown.',
			href: '/checkers',
			emoji: '🎲',
			kicker: 'Battle Table',
			color: 'bg-orange-400',
			marquee: 'bg-orange-200',
			storageKey: 'checkers-wins',
			scoreLabel: 'Wins',
			cta: 'Start Match'
		},
		{
			id: 'enduro',
			name: 'Enduro Chaos',
			description: 'Race the night through storms, ice, and blind corners.',
			href: '/enduro',
			emoji: '🏎️',
			kicker: 'Road Fury',
			color: 'bg-green-500',
			marquee: 'bg-green-200',
			storageKey: 'enduro-high-score',
			scoreLabel: 'Hi-Score',
			cta: 'Burn Rubber'
		},
		{
			id: 'space-chaos',
			name: 'Space Chaos',
			description: 'Scramble the fleet and climb the cosmic score board.',
			href: '/space-invaders',
			emoji: '🛸',
			kicker: 'Galaxy Sector',
			color: 'bg-purple-600',
			marquee: 'bg-fuchsia-200',
			storageKey: 'space-chaos-high-score',
			scoreLabel: 'Hi-Score',
			cta: 'Launch Run'
		}
	];

	const utilityCards: UtilityCard[] = [
		{
			id: 'settings',
			name: 'Settings',
			description: 'Tune the cabinet, inspect scores, and wipe save data.',
			href: '/settings',
			emoji: '⚙️',
			kicker: 'System Deck',
			color: 'bg-sky-400',
			marquee: 'bg-sky-200',
			meta: 'Scores • Reset • System',
			cta: 'Open Panel'
		}
	];

	const dashboardCards: DashboardCard[] = [...gameCards, ...utilityCards];

	let scores = $state<Record<ScoreId, number>>({
		minesweeper: 0,
		checkers: 0,
		enduro: 0,
		'space-chaos': 0
	});

	let lastUp = false;
	let lastDown = false;
	let lastLeft = false;
	let lastRight = false;
	let lastConfirm = false;

	const DEADZONE = 0.45;

	// @ts-ignore
	const appVersion = __APP_VERSION__;

	function setLanguage(lang: string) {
		document.cookie = `lang=${lang}; path=/; max-age=31536000`;
		window.location.reload();
	}

	function isGameCard(card: DashboardCard): card is GameCard {
		return 'storageKey' in card;
	}

	function readStoredNumber(key: string) {
		const stored = localStorage.getItem(key);
		return stored ? Number.parseInt(stored, 10) || 0 : 0;
	}

	function loadScores() {
		for (const card of gameCards) {
			scores[card.id] = readStoredNumber(card.storageKey);
		}
	}

	function getActionables() {
		return Array.from(document.querySelectorAll<HTMLElement>('[data-dashboard-action="true"]'));
	}

	function getFocusedActionable() {
		const active = document.activeElement;
		return active instanceof HTMLElement
			? active.closest<HTMLElement>('[data-dashboard-action="true"]')
			: null;
	}

	function focusFirstActionable(force = false) {
		const items = getActionables();
		if (!items.length) return;

		const active = document.activeElement;
		if (!force && active instanceof HTMLElement && items.includes(active)) return;

		items[0]?.focus();
	}

	function moveFocus(direction: Direction) {
		const items = getActionables();
		if (!items.length) return;

		const active = document.activeElement;
		if (!(active instanceof HTMLElement) || !items.includes(active)) {
			items[0]?.focus();
			return;
		}

		const currentRect = active.getBoundingClientRect();
		const originX = currentRect.left + currentRect.width / 2;
		const originY = currentRect.top + currentRect.height / 2;

		let bestMatch: { element: HTMLElement; score: number } | null = null;

		for (const element of items) {
			if (element === active) continue;

			const rect = element.getBoundingClientRect();
			const targetX = rect.left + rect.width / 2;
			const targetY = rect.top + rect.height / 2;
			const dx = targetX - originX;
			const dy = targetY - originY;

			let mainAxis = 0;
			let crossAxis = 0;

			if (direction === 'up') {
				mainAxis = -dy;
				crossAxis = Math.abs(dx);
			}

			if (direction === 'down') {
				mainAxis = dy;
				crossAxis = Math.abs(dx);
			}

			if (direction === 'left') {
				mainAxis = -dx;
				crossAxis = Math.abs(dy);
			}

			if (direction === 'right') {
				mainAxis = dx;
				crossAxis = Math.abs(dy);
			}

			if (mainAxis <= 12) continue;

			const score = Math.hypot(mainAxis, crossAxis) + crossAxis * 0.65;

			if (!bestMatch || score < bestMatch.score) {
				bestMatch = { element, score };
			}
		}

		bestMatch?.element.focus();
	}

	function activateFocusedAction() {
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.click();
		}
	}

	function handleDashboardKeydown(event: KeyboardEvent) {
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;

		const activeActionable = getFocusedActionable();
		const canNavigate = !!activeActionable || document.activeElement === document.body;

		if (event.key === 'ArrowUp') {
			if (!canNavigate) return;
			event.preventDefault();
			moveFocus('up');
			return;
		}

		if (event.key === 'ArrowDown') {
			if (!canNavigate) return;
			event.preventDefault();
			moveFocus('down');
			return;
		}

		if (event.key === 'ArrowLeft') {
			if (!canNavigate) return;
			event.preventDefault();
			moveFocus('left');
			return;
		}

		if (event.key === 'ArrowRight') {
			if (!canNavigate) return;
			event.preventDefault();
			moveFocus('right');
			return;
		}

		if ((event.key === 'Enter' || event.key === ' ') && activeActionable && !event.repeat) {
			event.preventDefault();
			activateFocusedAction();
		}
	}

	function handleVisibilityChange() {
		if (document.visibilityState === 'visible') {
			loadScores();
		}
	}

	function scoreText(card: GameCard) {
		return `${card.scoreLabel}: ${scores[card.id].toLocaleString()}`;
	}

	$effect(() => {
		loadScores();
		requestAnimationFrame(() => {
			focusFirstActionable(true);
		});

		let animationFrame = 0;

		const pollGamepad = () => {
			const gamepads = navigator.getGamepads?.() ?? [];
			let upPressed = false;
			let downPressed = false;
			let leftPressed = false;
			let rightPressed = false;
			let confirmPressed = false;

			for (const gamepad of gamepads) {
				if (!gamepad) continue;

				const axisX = gamepad.axes[0] ?? 0;
				const axisY = gamepad.axes[1] ?? 0;

				upPressed ||= gamepad.buttons[12]?.pressed || axisY < -DEADZONE;
				downPressed ||= gamepad.buttons[13]?.pressed || axisY > DEADZONE;
				leftPressed ||= gamepad.buttons[14]?.pressed || axisX < -DEADZONE;
				rightPressed ||= gamepad.buttons[15]?.pressed || axisX > DEADZONE;
				confirmPressed ||= !!(
					gamepad.buttons[0]?.pressed ||
					gamepad.buttons[2]?.pressed ||
					gamepad.buttons[3]?.pressed ||
					gamepad.buttons[7]?.pressed
				);
			}

			if (upPressed && !lastUp) moveFocus('up');
			if (downPressed && !lastDown) moveFocus('down');
			if (leftPressed && !lastLeft) moveFocus('left');
			if (rightPressed && !lastRight) moveFocus('right');
			if (confirmPressed && !lastConfirm) activateFocusedAction();

			lastUp = upPressed;
			lastDown = downPressed;
			lastLeft = leftPressed;
			lastRight = rightPressed;
			lastConfirm = confirmPressed;

			animationFrame = requestAnimationFrame(pollGamepad);
		};

		animationFrame = requestAnimationFrame(pollGamepad);

		return () => {
			cancelAnimationFrame(animationFrame);
		};
	});
</script>

<svelte:window onfocus={loadScores} onkeydown={handleDashboardKeydown} />
<svelte:document onvisibilitychange={handleVisibilityChange} />

<div class="min-h-screen bg-yellow-300 px-2 py-3 font-mono text-black sm:px-6 sm:py-6">
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-6">
		<header class="border-4 border-black bg-yellow-200 p-3 shadow-[4px_4px_0_rgba(0,0,0,1)] sm:p-5 sm:shadow-[8px_8px_0_rgba(0,0,0,1)]">
			<div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<p class="text-[0.6rem] font-black tracking-[0.3em] uppercase sm:text-sm">Arcade Hub // Ready</p>
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
					<div class="border-[3px] border-black bg-black px-2 py-1 text-yellow-300 sm:border-4 sm:px-3 sm:py-2">
						{dashboardCards.length} Hotspots
					</div>
					<div class="border-[3px] border-black bg-white px-2 py-1 sm:border-4 sm:px-3 sm:py-2">Launch = Enter</div>
					<div class="border-[3px] border-black bg-white px-2 py-1 sm:border-4 sm:px-3 sm:py-2">v{appVersion}</div>
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

		<section class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
			{#each dashboardCards as card (card.id)}
				<a
					href={card.href}
					data-dashboard-action="true"
					class="group block min-h-32 focus:outline-none focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black sm:min-h-44"
				>
					<article
						class="flex h-full flex-col border-4 border-black bg-black shadow-[4px_4px_0_rgba(0,0,0,1)] transition-transform duration-100 group-hover:-translate-y-1 group-focus-visible:-translate-y-1 sm:shadow-[8px_8px_0_rgba(0,0,0,1)]"
					>
						<div class="{card.marquee} flex items-center justify-between border-b-4 border-black px-3 py-1 sm:px-4 sm:py-2">
							<p class="text-[0.6rem] font-black tracking-[0.22em] uppercase sm:text-xs">
								{card.kicker}
							</p>
							<p class="text-xs font-black uppercase sm:text-sm">▶</p>
						</div>

						<div class="{card.color} flex flex-1 flex-col justify-between p-3 sm:p-5">
							<div class="flex items-start gap-3 sm:gap-4">
								<div
									class="flex h-12 w-12 shrink-0 items-center justify-center border-4 border-black bg-black text-2xl sm:h-[4.5rem] sm:w-[4.5rem] sm:text-4xl"
								>
									{card.emoji}
								</div>

								<div class="min-w-0 flex-1">
									<h2 class="text-xl font-black leading-none uppercase sm:text-[1.7rem]">
										{card.name}
									</h2>
									<p class="mt-1 text-xs leading-tight font-bold uppercase sm:mt-2 sm:text-[0.95rem]">
										{card.description}
									</p>
								</div>
							</div>

							<div class="mt-3 flex items-end justify-between gap-2 sm:mt-4 sm:gap-3">
								<div class="border-[3px] border-black bg-black px-2 py-1.5 text-[0.65rem] font-black uppercase text-yellow-300 sm:border-4 sm:px-3 sm:py-2 sm:text-sm">
									{#if isGameCard(card)}
										{scoreText(card)}
									{:else}
										{card.meta}
									{/if}
								</div>

								<span
									class="min-w-28 border-[3px] border-black bg-white px-2 py-2 text-center text-xs font-black uppercase shadow-[3px_3px_0_rgba(0,0,0,1)] transition-all group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-none sm:min-w-36 sm:border-4 sm:px-3 sm:py-3 sm:text-base sm:shadow-[4px_4px_0_rgba(0,0,0,1)]"
								>
									{card.cta}
								</span>
							</div>
						</div>
					</article>
				</a>
			{/each}
		</section>

		<footer class="flex flex-wrap items-center justify-between gap-2 border-4 border-black bg-black px-3 py-2 text-[0.65rem] font-black uppercase text-yellow-300 shadow-[4px_4px_0_rgba(0,0,0,1)] sm:px-4 sm:py-3 sm:text-sm sm:shadow-[8px_8px_0_rgba(0,0,0,1)]">
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
</style>
