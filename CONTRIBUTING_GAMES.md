# 🕹️ How to Add New Games to The Chaos Arcade

Follow these steps to expand your empire of digital chaos:

### 1. Create Your Game

Develop your new game as a SvelteKit route. For example, if you are making "Snake", create:
`src/routes/snake/+page.svelte`

### 2. Update the Cabinet Registry

Open `src/lib/cabinets.ts` and add your game to the `gameCabinets` array.

### 3. Add a New Game Object

Add a new object following this template:

```ts
{
    kind: 'game',
    id: 'snake',
    schemaName: 'Game Name Chaos',
    href: '/your-route',
    emoji: '🎮', // Pick a fun emoji
    color: 'bg-blue-500', // Use Tailwind background color classes (e.g., bg-purple-500, bg-green-400, bg-pink-600)
    marquee: 'bg-blue-200',
    score: {
        mode: 'high-score',
        storageKey: 'snake-high-score'
    }
}
```

The registry feeds stable cabinet facts to the dashboard, settings reset panel, and search structured data. Keep translatable dashboard copy in `src/routes/+page.svelte` so Wuchale can extract it.

Use the score helpers from `src/lib/cabinets.ts` inside the game route:

- `readCabinetScore` when loading the splash score board.
- `recordCabinetWin` for win-count games.
- `recordCabinetHighScore` for point-score games.

### 4. Use Unified Controls

Use `$lib/unified-controls` for menu focus, keyboard selection, gamepad selection, and return/back behavior. Keep only game-specific movement and action controls inside the game route.

### 5. Use Cabinet Flow

Use `$lib/cabinet-flow` to derive splash/game/end/menu flags and route B / Esc behavior. Game routes should not reimplement the return decision tree by hand.

### 🎨 The Chaos Design Manifesto

To keep the arcade consistent, every game MUST follow these "Golden Rules of Chaos":

#### 1. Vintage Aesthetics

We don't do "subtle" or "minimalist."

- **Thick Borders**: Use heavy black borders (`border-4` or `border-8 border-black`).
- **Hard Shadows**: Use heavy, non-blurred shadows (`shadow-[8px_8px_0_rgba(0,0,0,1)]`).
- **Vibrant Colors**: Use high-saturation background colors (Yellows, Pinks, Neons).
- **Typography**: Use monospaced fonts and heavy font weights (`font-black`, `font-bold`).

#### 2. Dramatic Tone

The writing should be unhinged.

- **Descriptions**: Instead of "A snake game", try "A slippery journey through the digital abyss!"
- **Messages**: Use emojis and caps lock for critical messages.
- **Errors**: If something goes wrong, don't just say "Error". Say "SYSTEM ERROR: Too much chaos detected! ⚠️"

#### 3. Interactive Chaos

Don't just let the user play; mess with them.

- **Funny Modals**: If you add "secret" or "forbidden" buttons, don't use `alert()`. Create a custom, dramatic modal that insults the user or reacts to their curiosity.
- **Animations**: Use `animate-bounce`, `animate-pulse`, or custom CSS transitions to keep the screen alive.

### 💡 Pro-Tips for Maximum Chaos:

- **Colors**: Use vibrant Tailwind colors like `bg-orange-400`, `bg-indigo-500`, or `bg-lime-400`.
- **Emojis**: Don't be shy with the emojis. They are the soul of the arcade.
- **The "Don't Click Me" Rule**: Always include at least one button that explicitly tells the user NOT to click it. It is mandatory.
