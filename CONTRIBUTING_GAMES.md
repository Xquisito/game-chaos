# 🕹️ How to Add New Games to The Chaos Arcade

Follow these steps to expand your empire of digital chaos:

### 1. Create Your Game
Develop your new game as a SvelteKit route. For example, if you are making "Snake", create:
`src/routes/snake/+page.svelte`

### 2. Update the Landing Page
Open `src/routes/+page.svelte` and find the `games` array in the `<script>` tag.

### 3. Add a New Game Object
Add a new object to the `games` array following this template:

```ts
{
    name: 'Game Name',
    description: 'A funny or dramatic description of your game.',
    href: '/your-route',
    emoji: '🎮', // Pick a fun emoji
    color: 'bg-blue-500' // Use Tailwind background color classes (e.g., bg-purple-500, bg-green-400, bg-pink-600)
}
```

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
