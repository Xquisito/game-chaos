<script lang="ts">
	// Use the generated locales list
	import { locales } from '../../locales/data.js';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';

	// Format locale names nicely using the Intl API
	const displayName = (loc: string) => new Intl.DisplayNames([loc], { type: 'language' }).of(loc);

	function changeLanguage(event: Event) {
		const lang = (event.target as HTMLSelectElement).value;
		document.cookie = `lang=${lang}; path=/; max-age=31536000`;
		window.location.reload();
	}
</script>

<select onchange={changeLanguage} class="bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-sm">
	{#each locales as l}
		<option value={l} selected={browser ? document.cookie.includes(`lang=${l}`) : false}>
			{displayName(l)}
		</option>
	{/each}
</select>
