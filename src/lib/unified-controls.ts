import { ARROW_TO_DIR, KEY_ENTER, KEY_ESCAPE, KEY_SPACE, isArrowKey, normalizeKey } from './keys';

export type GridDirection = 'up' | 'down' | 'left' | 'right';
export type LinearDirection = -1 | 1;

export const MENU_BUTTON_SELECTOR = '[data-menu-button]:not([disabled])';
export const DASHBOARD_ACTION_SELECTOR = '[data-dashboard-action="true"]';
export const DEFAULT_GAMEPAD_DEADZONE = 0.45;

type GamepadButtons = {
	up: boolean;
	down: boolean;
	left: boolean;
	right: boolean;
	select: boolean;
	back: boolean;
};

type GamepadPollerOptions = {
	deadzone?: number;
	intervalMs?: number | (() => number);
	shouldStart?: () => boolean;
	onUp?: () => void;
	onDown?: () => void;
	onLeft?: () => void;
	onRight?: () => void;
	onPrevious?: () => void;
	onNext?: () => void;
	onSelect?: () => void;
	onBack?: () => void;
};

function emptyGamepadButtons(): GamepadButtons {
	return {
		up: false,
		down: false,
		left: false,
		right: false,
		select: false,
		back: false
	};
}

export function queryControlItems(selector = MENU_BUTTON_SELECTOR) {
	return Array.from(document.querySelectorAll<HTMLElement>(selector));
}

export function getFocusedControlItem(selector = MENU_BUTTON_SELECTOR) {
	const active = document.activeElement;
	return active instanceof HTMLElement ? active.closest<HTMLElement>(selector) : null;
}

export function focusFirstControlItem(selector = MENU_BUTTON_SELECTOR, force = false) {
	const items = queryControlItems(selector);
	if (!items.length) return false;

	const active = document.activeElement;
	if (!force && active instanceof HTMLElement && items.includes(active)) return true;

	items[0].focus();
	return true;
}

export function focusSelectedOrFirstControlItem(
	selectedSelector: string,
	itemSelector = MENU_BUTTON_SELECTOR
) {
	const selected = document.querySelector<HTMLElement>(selectedSelector);
	if (selected && queryControlItems(itemSelector).includes(selected)) {
		selected.focus();
		return true;
	}

	return focusFirstControlItem(itemSelector, true);
}

export function moveLinearFocus(direction: LinearDirection, selector = MENU_BUTTON_SELECTOR) {
	const items = queryControlItems(selector);
	if (!items.length) return false;

	let index = items.indexOf(document.activeElement as HTMLElement);
	if (index === -1) {
		items[0].focus();
		return true;
	}

	index = (index + direction + items.length) % items.length;
	items[index].focus();
	return true;
}

export function moveGridFocus(direction: GridDirection, selector = DASHBOARD_ACTION_SELECTOR) {
	const items = queryControlItems(selector);
	if (!items.length) return false;

	const active = document.activeElement;
	if (!(active instanceof HTMLElement) || !items.includes(active)) {
		items[0].focus();
		return true;
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
	return bestMatch !== null;
}

export function activateFocusedControlItem(selector = MENU_BUTTON_SELECTOR) {
	const items = queryControlItems(selector);
	if (!items.length) return false;

	const active = document.activeElement as HTMLElement | null;
	if (active && items.includes(active)) {
		active.click();
		return true;
	}

	items[0].focus();
	return true;
}

export function isBackControlKey(key: string) {
	return key === KEY_ESCAPE || key === 'b' || key === 'B';
}

export function isSelectControlKey(key: string) {
	return key === KEY_ENTER || key === KEY_SPACE || key === 'a' || key === 'A';
}

export function getLinearMenuDirection(key: string): LinearDirection | null {
	const normalizedKey = normalizeKey(key);
	const arrow = isArrowKey(key);

	if (normalizedKey === 'w' || normalizedKey === 'W' || (arrow && normalizedKey === 'a')) {
		return -1;
	}

	if (normalizedKey === 's' || normalizedKey === 'S' || (arrow && normalizedKey === 'd')) {
		return 1;
	}

	return null;
}

export function handleLinearMenuKeydown(
	event: KeyboardEvent,
	options: {
		enabled: boolean;
		onBack: () => void;
		selector?: string;
	}
) {
	if (isBackControlKey(event.key)) {
		event.preventDefault();
		options.onBack();
		return true;
	}

	if (!options.enabled) return false;

	const direction = getLinearMenuDirection(event.key);
	if (direction) {
		event.preventDefault();
		moveLinearFocus(direction, options.selector);
		return true;
	}

	if (isSelectControlKey(event.key)) {
		event.preventDefault();
		activateFocusedControlItem(options.selector);
		return true;
	}

	return false;
}

export function handleGridMenuKeydown(
	event: KeyboardEvent,
	options: {
		selector?: string;
	}
) {
	if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return false;

	const activeItem = getFocusedControlItem(options.selector ?? DASHBOARD_ACTION_SELECTOR);
	const canNavigate = !!activeItem || document.activeElement === document.body;
	const direction = ARROW_TO_DIR[event.key];

	if (direction) {
		if (!canNavigate) return false;
		event.preventDefault();
		moveGridFocus(direction, options.selector);
		return true;
	}

	if ((event.key === KEY_ENTER || event.key === KEY_SPACE) && activeItem && !event.repeat) {
		event.preventDefault();
		activateFocusedControlItem(options.selector);
		return true;
	}

	return false;
}

function readGamepadButtons(deadzone: number): GamepadButtons {
	const state = emptyGamepadButtons();
	const gamepads = navigator.getGamepads?.() ?? [];

	for (const gamepad of gamepads) {
		if (!gamepad) continue;

		const axisX = gamepad.axes[0] ?? 0;
		const axisY = gamepad.axes[1] ?? 0;

		state.up ||= Boolean(gamepad.buttons[12]?.pressed || axisY < -deadzone);
		state.down ||= Boolean(gamepad.buttons[13]?.pressed || axisY > deadzone);
		state.left ||= Boolean(gamepad.buttons[14]?.pressed || axisX < -deadzone);
		state.right ||= Boolean(gamepad.buttons[15]?.pressed || axisX > deadzone);
		state.select ||= Boolean(
			gamepad.buttons[0]?.pressed ||
			gamepad.buttons[2]?.pressed ||
			gamepad.buttons[3]?.pressed ||
			gamepad.buttons[7]?.pressed
		);
		state.back ||= Boolean(
			gamepad.buttons[1]?.pressed || gamepad.buttons[8]?.pressed || gamepad.buttons[9]?.pressed
		);
	}

	return state;
}

export function createUnifiedGamepadPoller(options: GamepadPollerOptions) {
	const deadzone = options.deadzone ?? DEFAULT_GAMEPAD_DEADZONE;
	let last = emptyGamepadButtons();
	let pollId: number | null = null;

	const stop = () => {
		if (pollId !== null) {
			clearInterval(pollId);
			pollId = null;
		}

		last = emptyGamepadButtons();
	};

	const poll = () => {
		const current = readGamepadButtons(deadzone);
		const previous = current.up || current.left;
		const next = current.down || current.right;
		const lastPrevious = last.up || last.left;
		const lastNext = last.down || last.right;

		if (current.up && !last.up) options.onUp?.();
		if (current.down && !last.down) options.onDown?.();
		if (current.left && !last.left) options.onLeft?.();
		if (current.right && !last.right) options.onRight?.();
		if (previous && !lastPrevious) options.onPrevious?.();
		if (next && !lastNext) options.onNext?.();
		if (current.select && !last.select) options.onSelect?.();
		if (current.back && !last.back) options.onBack?.();

		last = current;
	};

	const start = () => {
		if (pollId !== null) return;
		if (options.shouldStart && !options.shouldStart()) return;

		poll();
		const interval =
			typeof options.intervalMs === 'function' ? options.intervalMs() : options.intervalMs;
		pollId = window.setInterval(poll, interval ?? 80);
	};

	const sync = () => {
		if (options.shouldStart && !options.shouldStart()) {
			stop();
			return;
		}

		const hasConnectedGamepad = (navigator.getGamepads?.() ?? []).some(Boolean);
		if (hasConnectedGamepad) {
			start();
			return;
		}

		stop();
	};

	const destroy = () => {
		stop();
	};

	return { start, stop, sync, destroy, poll };
}
