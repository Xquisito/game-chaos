import { defineConfig } from 'wuchale';
import { adapter as svelte } from '@wuchale/svelte';

export default defineConfig({
	locales: ['en', 'pt-BR'],
	adapters: {
		main: svelte({
			loader: 'sveltekit'
		})
	}
});
