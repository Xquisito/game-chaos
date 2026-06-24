import { expect, test } from '@playwright/test';

declare global {
	interface Window {
		__breakoutLoopProbe?: {
			maxPendingGameLoops: number;
			pendingGameLoops: number;
		};
	}
}

test('space pause and resume does not queue duplicate gameplay loops', async ({ page }) => {
	await page.addInitScript(() => {
		const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
		const originalCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
		const gameLoopFrames = new Set<number>();

		window.__breakoutLoopProbe = {
			maxPendingGameLoops: 0,
			pendingGameLoops: 0
		};

		window.requestAnimationFrame = (callback: FrameRequestCallback) => {
			const isGameLoop = callback.name === 'gameLoop';
			let frame = 0;

			frame = originalRequestAnimationFrame((time) => {
				if (isGameLoop) {
					gameLoopFrames.delete(frame);
					window.__breakoutLoopProbe!.pendingGameLoops = gameLoopFrames.size;
				}
				callback(time);
			});

			if (isGameLoop) {
				const probe = window.__breakoutLoopProbe!;
				gameLoopFrames.add(frame);
				probe.pendingGameLoops = gameLoopFrames.size;
				probe.maxPendingGameLoops = Math.max(probe.maxPendingGameLoops, gameLoopFrames.size);
			}

			return frame;
		};

		window.cancelAnimationFrame = (frame) => {
			gameLoopFrames.delete(frame);
			window.__breakoutLoopProbe!.pendingGameLoops = gameLoopFrames.size;
			originalCancelAnimationFrame(frame);
		};
	});

	await page.goto('/breakout');
	await page.getByRole('button', { name: /press start/i }).click();
	await expect(page.getByLabel('Breakout Chaos playfield')).toBeVisible();

	await page.keyboard.press('Space');
	await page.waitForTimeout(100);
	await page.keyboard.press('Space');
	await page.waitForTimeout(50);
	await page.keyboard.press('Space');
	await page.waitForTimeout(50);
	await page.keyboard.press('Space');
	await page.waitForTimeout(50);
	await page.keyboard.press('Space');
	await page.waitForTimeout(100);

	const probe = await page.evaluate(() => window.__breakoutLoopProbe);

	expect(probe?.maxPendingGameLoops).toBeLessThanOrEqual(1);
});
