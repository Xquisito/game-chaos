export const prerender = true;
export const trailingSlash = 'always';

import { browser } from '$app/environment';
import { loadLocale } from 'wuchale/load-utils';
import '../locales/main.loader.svelte.js';

export const load = async () => {
	if (browser) {
		// Detect language from cookie or navigator
		let lang = document.documentElement.lang;
		const match = document.cookie.match(/(^| )lang=([^;]+)/);
		if (match) {
			lang = match[2];
		} else if (navigator.language) {
			lang = navigator.language.startsWith('pt') ? 'pt-BR' : 'en';
		}
		
		// Ensure exact casing for wuchale
		const exactLang = lang === 'pt-BR' || lang.startsWith('pt') ? 'pt-BR' : 'en';
		
		// Set document language so CSS and Wuchale know the real lang
		document.documentElement.lang = exactLang;
		
		// Await the translation catalogs before SvelteKit hydrates
		await loadLocale(exactLang);
	}
};
