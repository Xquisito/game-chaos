/**
 * Keyboard key constants.
 *
 * Wuchale (i18n) translates bare string literals it finds in source code.
 * Strings like 'Escape', 'Enter', 'ArrowUp' look like translatable text,
 * so they get replaced at compile time (e.g. 'Escape' → 'Esc' in pt-BR).
 * Defining them as object values prevents Wuchale from touching them.
 */

// Special keys
export const KEY_ESCAPE = 'Escape';
export const KEY_ENTER = 'Enter';
export const KEY_SPACE = ' ';

// Arrow → WASD normalization map
export const ARROW_TO_WASD: Record<string, string> = {
	ArrowUp: 'w',
	ArrowDown: 's',
	ArrowLeft: 'a',
	ArrowRight: 'd',
};

// Arrow → direction normalization map (for grid/2D navigation)
export const ARROW_TO_DIR: Record<string, 'up' | 'down' | 'left' | 'right'> = {
	ArrowUp: 'up',
	ArrowDown: 'down',
	ArrowLeft: 'left',
	ArrowRight: 'right',
};

/** Normalize an arrow key to its WASD equivalent, or return the key as-is. */
export function normalizeKey(key: string): string {
	return ARROW_TO_WASD[key] ?? key;
}

/** Check if a key is an arrow key (before normalization). */
export function isArrowKey(key: string): boolean {
	return key in ARROW_TO_WASD;
}
