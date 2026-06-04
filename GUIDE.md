# Guide to Game

## Interaction

Basic rules to intercation with games

- All games should be controlled by keyboard/gesture/mouse/joystick - named unified controls (UC for now)
- All games should have a splash screen end end game screen (either loosing o winning)
- Navigation from dashboard to splash, splash to game must use UC controls. When selecting start from splash game opens and starts
- Navigation back from end game screen shoud have a choice to go back to splash or retry (that works like start on "Splash")
- Use navigation UC even if this kind of navigation does not exists on orginal game
- Nav Buttons on UX should should change their background/foreground colors changing when focus
- Use ['A', 'enter'] ot select or start a game if arrived at game screen
- Use ['B', 'esc'] to return
- Use ['keyboard keys', 'D-Pad', 'TAB'] to nav over buttons and clickables on current screen
- If selecting "return" when playing, it should go back to splash
- Once back on splash screen and game were running, it should have an option to continue game (using 'selects' options)

## Sounds

- If it is action game then try to reproduce the original game sound if its a clone, otherwise, create a new old 8-bits for that

## Score boards

- All game must have a score board with higher points according game type, or # wins, points, and so on
- The high scores should appears on dashboard
- Use localstorage to persiste
- Create a settings buttos where user could reset scores

## Splash Screen

Every game splash screen must follow the **Compact Card** pattern established in Minesweeper. It replaces the older "help panel + score card side-by-side" layout.

### Structure overview

```
bg-yellow-300 full-screen
  └── Card  border-4 border-black bg-white shadow-[4px_4px_0_rgba(0,0,0,1)]
        ├── Black Header Band   (title + compact score counter)
        └── Content Area  p-4 sm:p-8
              ├── Config Grid      (2-col, always)
              ├── Accordion Help   (collapsed by default)
              └── CTA Buttons      (2-col grid)
```

### 1. Black Header Band

Contains the game title, a one-line tagline, and the score counter inline — no separate score card.

```html
<div class="border-b-4 border-black bg-black px-4 py-3 text-yellow-300 sm:px-8 sm:py-5">
  <!-- Kicker -->
  <div class="text-[0.55rem] font-black tracking-[0.4em] uppercase text-yellow-300/50 sm:text-xs">
    Game Chaos
  </div>
  <!-- Title row: name left, wins right -->
  <div class="flex items-center justify-between gap-4">
    <h1 class="text-xl font-black leading-none uppercase sm:text-5xl">
      💣 Game Title 💣
    </h1>
    <div class="shrink-0 text-right">
      <div class="text-[0.5rem] tracking-widest uppercase text-yellow-300/50 sm:text-[0.6rem]">
        Total Wins  <!-- or "Hi-Score", "Best Time", etc. -->
      </div>
      <div class="text-lg font-black leading-none sm:text-4xl">{score}</div>
    </div>
  </div>
  <!-- Tagline -->
  <p class="mt-1 text-[0.65rem] font-bold uppercase text-yellow-300/60 sm:mt-2 sm:text-base">
    Short punchy tagline here.
  </p>
</div>
```

**Rules:**
- Band background is always `bg-black`. Text is `text-yellow-300`.
- Score counter: label in `text-[0.5rem]` muted, value in `text-lg` (mobile) / `sm:text-4xl` (desktop).
- Tagline opacity `text-yellow-300/60` — it's context, not a headline.

### 2. Config Grid (2-col, always)

Options such as board size, difficulty, level, speed — whatever the game needs. Two panels, side-by-side at all breakpoints.

```html
<div class="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:gap-4">
  <!-- Panel template (repeat for each config axis) -->
  <div class="border-2 border-black bg-yellow-100 p-2 sm:border-4 sm:p-4">
    <div class="mb-2 text-[0.55rem] font-black tracking-[0.3em] uppercase text-black/50 sm:mb-3 sm:text-xs">
      Panel Label
    </div>
    <div class="flex flex-col gap-1 sm:gap-2">
      {#each OPTIONS as option, i}
        <button
          type="button"
          data-menu-button
          onclick={() => select(i)}
          class={['border-2 border-black px-1.5 py-1.5 text-xs font-black uppercase transition-all
                   focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2
                   sm:border-4 sm:px-3 sm:py-2 sm:text-base',
                  selected === i
                    ? 'bg-black text-yellow-300'
                    : 'bg-white text-black hover:bg-black hover:text-white focus:bg-black focus:text-white']}
        >
          {option.label}
          <!-- Optional second line for sub-info (mine count, time limit, etc.) -->
          <span class="block text-[0.5rem] opacity-60 sm:text-xs">{option.sublabel}</span>
        </button>
      {/each}
    </div>
  </div>
</div>
```

**Rules:**
- Always `grid-cols-2` — never stacks on mobile.
- Panel background: `bg-yellow-100`.
- Active option: `bg-black text-yellow-300`. Inactive: `bg-white text-black`.
- All option buttons must have `data-menu-button` for keyboard/gamepad navigation.
- If only one config axis exists, use `grid-cols-1` and allow the single panel to span full width.

### 3. Accordion Help

Help is hidden by default. A single toggle line expands inline.

```svelte
<!-- In <script>: let helpOpen = $state(false); -->

<div class="mb-4 border-2 border-black sm:mb-6 sm:border-4">
  <button
    onclick={() => (helpOpen = !helpOpen)}
    class="flex w-full items-center justify-between bg-yellow-200 px-3 py-2
           text-xs font-black uppercase transition-colors hover:bg-yellow-300
           active:scale-[0.98] sm:px-4 sm:py-3 sm:text-sm"
  >
    <span>❓ How to Play</span>
    <span class="text-base leading-none transition-transform duration-200"
          class:rotate-180={helpOpen}>▾</span>
  </button>
  {#if helpOpen}
    <div class="border-t-2 border-black bg-yellow-50 px-3 py-2
                text-xs font-bold leading-relaxed uppercase
                sm:border-t-4 sm:px-4 sm:py-3 sm:text-sm">
      Describe controls here.<br />
      Tap/click to do X • Long-press for Y.<br />
      <span class="mt-2 block text-[0.6rem] text-black/60 sm:text-xs">
        A / Enter = select • B / Esc = return.
      </span>
    </div>
  {/if}
</div>
```

**Rules:**
- Toggle button background: `bg-yellow-200` at rest, `bg-yellow-300` on hover.
- Chevron `▾` rotates 180° when open via `class:rotate-180={helpOpen}`.
- Content background: `bg-yellow-50`.
- The toggle button does NOT need `data-menu-button` — it is a Tab-reachable affordance, not a primary game action.

### 4. CTA Buttons

Primary action (Start / Continue) and secondary action (Dashboard) are always in a `grid-cols-2` row. When a game is in-progress, a third "New Game" escape hatch sits below as a full-width slim button.

```svelte
{#if hasActiveRun}
  <div class="grid grid-cols-2 gap-2 sm:gap-4">
    <button data-menu-button onclick={continueGame}
      class="border-2 border-yellow-400 bg-black py-3 text-base font-black text-yellow-400 uppercase
             transition-all hover:bg-yellow-400 hover:text-black focus:bg-yellow-400 focus:text-black
             focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2
             active:scale-[0.98] sm:border-4 sm:py-5 sm:text-2xl">
      Continue
    </button>
    <button data-menu-button onclick={backToDashboard}
      class="border-2 border-black bg-white py-3 text-base font-black text-black uppercase
             transition-all hover:bg-black hover:text-white focus:bg-black focus:text-white
             focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2
             active:scale-[0.98] sm:border-4 sm:py-5 sm:text-2xl">
      Dashboard
    </button>
  </div>
  <button data-menu-button onclick={startGame}
    class="mt-2 w-full border-2 border-black bg-white py-2 text-sm font-black text-black uppercase
           transition-all hover:bg-black hover:text-white focus:outline-none
           focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2
           active:scale-[0.98] sm:border-4 sm:py-3 sm:text-base">
    New Game
  </button>
{:else}
  <div class="grid grid-cols-2 gap-2 sm:gap-4">
    <button data-menu-button onclick={startGame}
      class="border-2 border-yellow-400 bg-black py-3 text-base font-black text-yellow-400 uppercase
             transition-all hover:bg-yellow-400 hover:text-black focus:bg-yellow-400 focus:text-black
             focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2
             active:scale-[0.98] sm:border-4 sm:py-5 sm:text-2xl">
      Press Start
    </button>
    <button data-menu-button onclick={backToDashboard}
      class="border-2 border-black bg-white py-3 text-base font-black text-black uppercase
             transition-all hover:bg-black hover:text-white focus:bg-black focus:text-white
             focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2
             active:scale-[0.98] sm:border-4 sm:py-5 sm:text-2xl">
      Dashboard
    </button>
  </div>
{/if}
```

**Rules:**
- Primary CTA: `bg-black text-yellow-400 border-yellow-400`. Secondary: `bg-white text-black border-black`.
- All CTA buttons must have `data-menu-button` for arrow-key / gamepad navigation.
- Never stack CTAs vertically when there are only two — use the 2-col grid.
- "New Game" (destructive restart) is always the smallest and lowest button.

### 5. Splash Screen Checklist

- [ ] Header band is `bg-black` with `text-yellow-300` — no separate score card block.
- [ ] Score counter is compact (`text-lg` / `sm:text-4xl`) and lives in the header band.
- [ ] Config panels are always `grid-cols-2` — never stacks on mobile.
- [ ] Help accordion is collapsed by default; `helpOpen = $state(false)` in script.
- [ ] CTA row is `grid-cols-2`; "Pressione Iniciar" + "Painel" side-by-side.
- [ ] All option and CTA buttons have `data-menu-button`.
- [ ] No padding on the outer card `<div>` — padding lives in the content area `p-4 sm:p-8`.

## Style

- Try keep game chaos style and not bring new one

## Testing e2e

- Use playwright cli either to take a screen shots, access console logs or even play to do an e2e test
