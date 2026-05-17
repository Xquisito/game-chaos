# Frog Chaos — Implementation Plan

> Self-contained handoff document. Read once, build without further questions.

## 1. Goal

Add a new game cabinet called **Frog Chaos** to The Chaos Arcade (a SvelteKit retro-arcade hub). It is a classic Frogger implementation with three small "chaos" twists, fitting alongside the existing Tetris / Minesweeper / Space Chaos / Checkers / Enduro cabinets at the dashboard route `/`.

A prior implementation was wiped in commit `dae5e10` ("Remove Frog Chaos leftovers"); this is a fresh build from scratch.

## 2. Tech stack (already in repo)

- **SvelteKit 2.50** with **Svelte 5 (runes)**
- **TypeScript**
- **Tailwind CSS v4**
- **Wuchale** for i18n (PT-BR + EN)
- **Vite 7**

## 3. Domain glossary (use these terms exactly, in code and copy)

- **Session** — one play attempt from cabinet start until the last Life is lost. Ends by recording a high score.
- **Life** — one player resource. A Session starts with **3 Lives**.
- **Level** — a round; ends when all 5 **Home Pads** are filled. Clearing speeds the world up and starts a new round with empty Pads.
- **Home Pad** — one of 5 slots on the top row. Filled when a Frog reaches it. Cannot be re-entered in the same Level.
- **Crossing** — a Frog's attempt at the playfield. Ends by reaching an empty Home Pad (success) **or** dying / Timer-expiry (failure). After any Crossing a new Frog spawns at the Start Row, unless the Level just cleared or the Session just ended. **Only failed Crossings consume a Life.**
- **Timer** — 60-second per-Life countdown. Drains potential score; expiry costs one Life.
- **Playfield** — the 13×13 grid the Frog moves on, portrait-locked.
- **Lane** — a single row of the Playfield containing hazards moving in one direction at one speed.
- **River** — the contiguous block of 5 Lanes where the Frog drowns on contact with water.
- **Road** — the contiguous block of 5 Lanes where the Frog is squashed on contact with a Vehicle.
- **Median** — safe row between River and Road.
- **Start Row** — safe bottom row where the Frog spawns at each Life.
- **Frog** — the player-controlled character. One exists at a time.
- **Vehicle** — Road Lane occupant; contact = lose Life.
- **Log** — River Lane occupant the Frog can ride safely.
- **Turtle** — River Lane occupant the Frog can ride, but periodically **submerges** (Frog drowns if it stays on a submerged turtle).
- **Hop** — the atomic Frog action: one discrete 1-cell move in one of four cardinal directions, triggered by one input event. Never continuous.
- **Fly** — periodic bonus glyph appearing on an empty Home Pad; +200 chaos bonus on collect.
- **Crocodile** — telegraphed hazard appearing on an empty Home Pad from Level 3 onward; entering = lose Life.

### Relationships

- A **Session** contains one or more **Level**s.
- A **Level** requires 5 successful **Crossing**s, one per **Home Pad**.
- A failed Crossing consumes one **Life**; a successful Crossing does not.
- A **Session** ends when Lives reach zero.
- A **Fly** and a **Crocodile** can only occupy empty Home Pads.

## 4. Playfield layout (13 rows × 13 columns, portrait-locked)

|  Row | Content                                                                       |
| ---: | ----------------------------------------------------------------------------- |
|    0 | 5 **Home Pads** alternating with hedges                                       |
|  1–5 | **River** (5 Lanes: mix of Log Lanes and Turtle Lanes; some Turtles submerge) |
|    6 | **Median** (safe)                                                             |
| 7–11 | **Road** (5 Lanes of Vehicles, alternating directions per row)                |
|   12 | **Start Row** (safe; Frog spawns at col 6)                                    |

Cell size = `min(viewportWidth / 13, viewportHeight / 16)`. Written to CSS custom property `--cell` on the playfield container; all draw math reads `cellSize` derived from it.

## 5. Architectural decisions (locked, do not revisit)

### 5.1 Rendering — Canvas (deliberate deviation from arcade norm)

**Render the playfield interior on `<canvas>` 2D context, not DOM.** Every other cabinet in this repo uses absolutely-positioned DOM elements with Tailwind brutalist styling. Frog Chaos is the exception because:

- It has the highest concurrent moving-occupant count of any cabinet (~25–30: vehicles, logs, turtles, plus the Frog).
- Mobile performance is a documented project priority.
- DOM transform overhead + Svelte 5 fine-grained reactivity would compete for the 16 ms frame budget on low-end Android.

The **HUD** (Lives, Score, Timer, Level, mute toggle, pause button) and the **splash + end screens + touch D-pad** remain DOM/Tailwind so the brutalist aesthetic still surrounds the playfield. Only the moving interior is canvas.

This decision is also recorded in `docs/adr/0001-frog-chaos-uses-canvas.md`.

### 5.2 Visual style — emoji + geometric primitives, zero image assets

The repo has no asset pipeline (`static/` holds only OG image, favicon, manifest). Do NOT add a sprite sheet. Draw:

- **Frog**: `ctx.fillText('🐸', ...)` sized to ~`cellSize * 0.9`, centered.
- **Vehicles**: `ctx.fillRect` with a vibrant fill (orange / cyan / fuchsia / red), `lineWidth = 4` black stroke, hard offset shadow drawn as a black `fillRect` at `(x+4, y+4)` to mimic `shadow-[4px_4px_0_rgba(0,0,0,1)]`. Optional emoji glyph on top (`🚗 🚛 🏎️ 🚓 🐊`).
- **Logs**: brown rounded rects (`#92400e`) with `🪵` clusters.
- **Turtles**: small green rects with `🐢` overlay; submerged = lowered alpha + `💧` bubble.
- **River background**: solid `#0ea5e9` per row.
- **Road background**: solid `#1f2937` with dashed white lane lines via `ctx.setLineDash([cellSize/3, cellSize/3])`.
- **Median + Start Row**: solid `#84cc16`, slight noise from a few random dots drawn once on resize.
- **Home Pads**: green lily-pad rects on top row; filled = `🐸` sitting on it.

### 5.3 Movement model

- **Frog**: discrete one-cell **Hops** with a 120 ms CSS-like easing tween (interpolate Frog `x` / `y` over 120 ms in the tick loop). **No input queueing during the hop animation** — extra inputs are dropped.
- **Lane occupants**: continuous smooth movement. Each occupant has a float `x` in cells; tick adds `lane.speed * dt / 1000`. When `x > playfieldWidthCells`, wrap to `-occupantWidth`.
- **Log/Turtle riding**: when Frog is on a River Lane, the Frog's `x` is updated each tick by the Lane it's currently on (find by row). If `x` goes off-screen → drown. Submerged Turtle ridden at the end of the submerge phase → drown.
- **Hop scoring is anti-grind**: per Life, track `maxRowReachedThisLife`; reaching a new max forward row grants +10, backtracking grants 0.

### 5.4 State strategy (Svelte 5 runes)

```ts
let lives = $state(3);
let level = $state(1);
let score = $state(0);
let timerMs = $state(60_000);
let maxRowThisLife = $state(12);
let frog = $state({ row: 12, col: 6, animFrom: null, animStartedAt: 0 });
let homePads = $state<(null | 'filled')[]>([null, null, null, null, null]);
let activeFly = $state<{ padIndex: number; expiresAt: number } | null>(null);
let activeCroc = $state<{ padIndex: number; lethalAt: number; expiresAt: number } | null>(null);
let world = $state.raw(createWorld(1)); // lanes + occupants; mutates in place every tick
let floaters = $state.raw<
	Array<{ id: number; text: string; x: number; y: number; bornAt: number }>
>([]);
let paused = $state(false);
let muted = $state(/* read from localStorage; default true if touchCapable, false otherwise */);
```

`world` and `floaters` use `$state.raw` so per-frame mutations don't fire reactivity for every occupant — coarse reactivity, manual repaint each tick.

### 5.5 Controls

| Input        | Mapping                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| **Keyboard** | Arrows + WASD = Hop. Space = pause toggle. Esc = exit (via cabinet-flow).                                |
| **Gamepad**  | D-pad / left stick = Hop. A button = pause. B button = exit.                                             |
| **Touch**    | On-screen D-pad below the canvas (+ layout, 4 buttons). One `pointerdown` = one Hop. **No** auto-repeat. |

- **Hop debounce during 120 ms animation** — drop extra inputs, don't queue.
- **4-directional only**, no diagonals.
- **Pause** freezes tick + dims canvas to 40% opacity with centered "PAUSED" overlay.
- **`document.visibilitychange` to hidden → auto-pause.**

## 6. Cabinet registry entry

Edit [`src/lib/cabinets.ts`](src/lib/cabinets.ts):

1. Add `'frog-chaos'` to the `GameCabinetId` union (line 1).
2. Add `'/frog'` to the `CabinetHref` union (lines 4–10).
3. Append this entry to `gameCabinets` (after `tetris`, before the closing `]`):

```ts
{
    kind: 'game',
    id: 'frog-chaos',
    schemaName: 'Frog Chaos',
    href: '/frog',
    emoji: '🐸',
    color: 'bg-lime-500',
    marquee: 'bg-lime-200',
    score: {
        mode: 'high-score',
        storageKey: 'frog-chaos-high-score'
    }
}
```

## 7. Files to create / modify

**Create**

- `src/routes/frog/+page.svelte` — the entire cabinet. Single-file structure, matching other cabinets.

**Modify**

- `src/lib/cabinets.ts` — as in §6.
- `src/routes/+page.svelte` — add `frog-chaos` entry to the existing `gameCopy` object with `{ title: 'FROG CHAOS', description: '...' }`. PT-BR title stays `'FROG CHAOS'` (brand consistency); description translated.

**Auto-regenerated**

- `src/locales/en.po`, `src/locales/pt-BR.po` — run Wuchale extract; translate new entries manually.

## 8. Utilities to reuse (do NOT reimplement)

| Need                              | Use                                          | Location                                                                                                                                                   |
| --------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Splash → game → end flow          | `createCabinetFlow`                          | [src/lib/cabinet-flow.ts](src/lib/cabinet-flow.ts)                                                                                                         |
| Splash high score load            | `readCabinetScore`                           | [src/lib/cabinets.ts:150](src/lib/cabinets.ts:150)                                                                                                         |
| End-Session score write           | `recordCabinetHighScore`                     | [src/lib/cabinets.ts:185](src/lib/cabinets.ts:185)                                                                                                         |
| Gamepad → directional callbacks   | `createUnifiedGamepadPoller`                 | [src/lib/unified-controls.ts:275](src/lib/unified-controls.ts:275)                                                                                         |
| Menu keyboard nav                 | `handleLinearMenuKeydown`                    | [src/lib/unified-controls.ts:187](src/lib/unified-controls.ts:187)                                                                                         |
| Arrow key → direction             | `ARROW_TO_DIR`, `normalizeKey`, `isArrowKey` | [src/lib/keys.ts](src/lib/keys.ts)                                                                                                                         |
| Touch D-pad layout (copy & adapt) | `<button onpointerdown=...>` block           | [src/routes/tetris/+page.svelte:1387-1459](src/routes/tetris/+page.svelte:1387) — strip out `startTouchRepeat`/`stopTouchRepeat` for Frog (no auto-repeat) |
| Web Audio synth pattern           | Oscillator helpers                           | [src/routes/space-invaders/+page.svelte](src/routes/space-invaders/+page.svelte) — copy the synth shape                                                    |

## 9. Difficulty defaults (tunable in playtest)

Put all numbers in a single `const DIFFICULTY = {...}` at the top of `+page.svelte`:

| Parameter                      | Level 1                         | Per-Level scale             | Cap        |
| ------------------------------ | ------------------------------- | --------------------------- | ---------- |
| Vehicle lane speed (cells/sec) | 1.0–2.5 random per lane         | × 1.12                      | 5.0        |
| Log/Turtle lane speed          | 0.6–1.4 random per lane         | × 1.10                      | 3.5        |
| Vehicle spawn gap (cells)      | 4–8 random per lane             | × 0.93                      | min 2.0    |
| Log length (cells)             | 2 / 3 / 4 random                | unchanged                   | —          |
| Turtle group size              | 2 or 3                          | unchanged                   | —          |
| Turtle submerge cycle          | 3 s surface / 2 s submerged     | surface × 0.95              | min 1.5 s  |
| Fly spawn interval             | every 12–18 s                   | unchanged                   | —          |
| Crocodile (Level ≥ 3)          | 5 s lethal window once per 60 s | × 1.05 freq                 | every 30 s |
| Crocodile telegraph            | 600 ms before lethal            | unchanged                   | —          |
| Per-Life Timer                 | 60 s                            | **unchanged across Levels** | —          |

## 10. Scoring formula (anti-grind classic)

| Event                                      | Points                 |
| ------------------------------------------ | ---------------------- |
| Reaching a new max forward row this Life   | +10                    |
| Backtracking or revisiting a row this Life | 0                      |
| Crossing (Home Pad filled)                 | +50                    |
| Timer bonus on Crossing                    | +10 × secondsRemaining |
| Level clear (all 5 Pads filled)            | +500                   |
| Fly collected                              | +200                   |

Float a `+N` ticker glyph on the canvas near the Frog for each event (cleared after 800 ms).

## 11. Audio

Five Web Audio oscillator SFX. Copy the synth pattern from Space Invaders.

| Event                | Sound                                   |
| -------------------- | --------------------------------------- |
| Hop                  | 80 ms square-wave blip, ~440 Hz         |
| Drowning             | 300 ms descending sine, 600 Hz → 100 Hz |
| Squish (Vehicle hit) | 150 ms white-noise burst                |
| Crossing             | Two-note arpeggio C5 → G5               |
| Level clear          | Four-note fanfare C5–E5–G5–C6           |

Mute toggle in HUD persists to `localStorage['frog-chaos-muted']`. Default: **muted on mobile** (touch detected), **unmuted on desktop**. No music loop. No haptic.

## 12. Splash screen contents

- Title: `FROG CHAOS` (untranslated, brand)
- Current high score (from `readCabinetScore`)
- Instructions: "REACH ALL 5 PADS" (translatable)
- **START** button → switch to game screen
- **DO NOT CLICK THIS FROG** / **NÃO CLIQUE NESTE SAPO** button → opens dramatic modal:
  - Body: `🐸 YOU DISOBEYED. THE FROG IS DISAPPOINTED.` / `🐸 VOCÊ DESOBEDECEU. O SAPO ESTÁ DECEPCIONADO.`
  - Single dismiss button: `OK FINE` / `TUDO BEM`
  - No gameplay or score effect
- **BACK** button → return to dashboard

## 13. End screen contents

- `GAME OVER`
- Final Score
- `NEW BEST!` badge if `score > previousHighScore`
- **PLAY AGAIN** → reset state, switch to splash
- **BACK TO ARCADE** → return to dashboard

## 14. Implementation outline (top-to-bottom in `+page.svelte`)

1. `<script lang="ts">` block: imports, `DIFFICULTY` const, types (`Lane`, `LaneOccupant`, `Vehicle`, `Log`, `Turtle`, `Frog`, `World`).
2. `createWorld(level: number): World` — generate 13 rows with Level-scaled speeds. Spawn lane occupants with randomized initial `x` offsets.
3. Runes from §5.4. Derived: `let gameOver = $derived(lives === 0)`. `cabinet-flow` integration for `screen` / `endMode`.
4. **Tick loop**: `function tick(now: number) { if (paused || screen !== 'game') return loop(); const dt = now - lastNow; lastNow = now; updateLanes(dt); updateFrogRide(dt); updateTimer(dt); updateChaosElements(now); updateFloaters(now); detectCollisions(); draw(ctx); loop(); }` where `loop = () => raf = requestAnimationFrame(tick)`.
5. **`detectCollisions()`**: Frog row in River → find Lane, check for Log/Turtle under Frog `col` → if missing or submerged → `loseLife('drown')`. Frog row in Road → AABB check vs every Vehicle in that Lane → on overlap `loseLife('squish')`.
6. **`hop(dir)`**: if mid-hop (now − animStartedAt < 120) → return. Compute newRow/newCol; clamp to grid. If newRow === 0 (Home Pad row) → `attemptCrossing(newCol)`. Else play hop SFX, update Frog, set animStartedAt, if newRow < maxRowThisLife → score +10, maxRowThisLife = newRow, spawn floater "+10".
7. **`attemptCrossing(col)`**: derive padIndex from col. If padIndex invalid or pad already filled → bounce back (no Hop committed). If activeCroc on this pad and `now >= lethalAt` → `loseLife('croc')`. Else fill pad. Score +50 + (timerMs/1000)\*10. If fly on this pad → +200, clear fly. Spawn floaters. If all 5 pads filled → `clearLevel()`. Else `respawnFrog()` (no Life lost).
8. **`clearLevel()`**: +500, level++, world = createWorld(level), homePads = Array(5).fill(null), respawnFrog().
9. **`respawnFrog()`**: frog = { row: 12, col: 6, animFrom: null, animStartedAt: 0 }; timerMs = 60_000; maxRowThisLife = 12. Does NOT change Lives.
10. **`loseLife(reason)`**: play matching SFX, lives--. If lives === 0 → end Session (recordCabinetHighScore, switch screen to 'end'). Else respawnFrog().
11. **`updateChaosElements(now)`**: spawn/expire Fly; spawn/telegraph/expire Crocodile per DIFFICULTY cadence and Level gating.
12. **`draw(ctx)`**: clear → row backgrounds (River blue, Road dark, Median+Start lime) → Home Pads + their occupants (Fly/Croc/filled-Frog) → River occupants (Logs, Turtles with alpha for submerged) → Road occupants → Frog (interpolated position if mid-hop) → floaters (`+N` text).
13. **HUD** (outside the `<canvas>`, in a Tailwind container): `<div class="border-4 border-black bg-lime-300 shadow-[8px_8px_0_rgba(0,0,0,1)] p-3 ...">` with Lives (`🐸 × {lives}`), Score, Timer bar (width %), Level, mute toggle, pause `||` button. All caps, font-mono, font-black.
14. **Touch D-pad** below canvas: `{#if touchCapable && screen === 'game'}` block, 4 buttons (↑ ← ↓ →) in + layout, each `onpointerdown={() => hop('up')}` etc., styling per [tetris/+page.svelte:1395-1448](src/routes/tetris/+page.svelte:1395).
15. **Splash + end screens**: Tailwind brutalist layout per §12 and §13. Wire menu nav with `handleLinearMenuKeydown`.
16. **Lifecycle** (`onMount` / `onDestroy`): start gamepad poller, attach `keydown` listener, attach `visibilitychange` listener, compute cell size + write `--cell`, attach resize listener, get canvas 2d context. Cleanup mirrors.

## 15. Verification checklist

Run in this order. Don't ship until every box is checked.

1. `npm run check` — typecheck passes (cabinet ID + href additions compile).
2. `npm run build` — production build succeeds.
3. `npm run dev` — open `/`, see new lime cabinet with 🐸 emoji + correct title in current locale.
4. Navigate to `/frog` — splash renders, high score reads 0, all three buttons focusable by keyboard (Tab) and gamepad (D-pad).
5. Click START — transition to game; canvas renders 13×13 grid with moving cars and logs.
6. **Hop tests**: arrow keys, WASD, gamepad D-pad, on-screen D-pad each Hop the Frog one cell in the right direction. Mid-hop inputs (within 120 ms) are dropped.
7. **Failure tests**:
   - Walk Frog into a Vehicle → squish SFX, lose Life, respawn at Start Row.
   - Hop onto water (River row, no Log/Turtle under) → drown SFX, lose Life.
   - Ride a Log off the right edge → drown.
   - Stand on a Turtle as it submerges and don't Hop off → drown at end of submerge phase.
   - Let Timer reach 0 → lose Life (no SFX needed for timeout but Timer bar should visibly empty).
8. **Success tests**:
   - Reach an empty Home Pad → crossing SFX, "+50" + time bonus floats up, Pad fills with Frog glyph, new Frog spawns.
   - Fill all 5 Pads → fanfare, "+500" floats up, world visibly speeds up, Pads reset, Level number increments.
9. **Chaos tests**:
   - Wait ~15 s during play → Fly appears on a random empty Pad; reach it → +200 ticker.
   - Reach Level 3 → Crocodile occasionally appears with 600 ms warning then 5 s lethal window; entering = lose Life.
   - On splash, click DO NOT CLICK button → modal opens with dramatic copy; OK dismisses.
10. **Persistence**: end a Session with score > 0 → `localStorage.getItem('frog-chaos-high-score')` reflects it. Splash shows the saved score on next visit. `/settings` reset works.
11. **Mobile**: DevTools 360×800. Canvas fits viewport. D-pad usable. Audio muted by default; toggle works. No frame drops in perf panel.
12. **Pause**: Space / A button / `||` button freezes tick + dims canvas. Timer stops. Switch tab → auto-pauses; return → still paused.
13. `npm run lint` and `npm run format` — clean.
14. PT-BR locale renders all new strings translated.

## 16. Non-goals (do NOT add to v1)

- Pixel art / sprite sheet
- Music loop
- Settings sub-page for difficulty (the DIFFICULTY const is the dial)
- "LEVEL N" announcement overlay between Levels
- Multiplayer / co-op
- Online leaderboard
- Gamepad rumble
- Haptic vibration
- Landscape orientation support
- Lady frog escort bonus
- Powerups (invincibility, double-hop, etc.)
- UFO / chainsaw / boss enemies
- Animated splash transitions

## 17. House style reminders

- All UI text **ALL CAPS**, monospace font, font-black weight.
- Borders: `border-4` or `border-8 border-black`.
- Shadows: `shadow-[8px_8px_0_rgba(0,0,0,1)]` (DOM) or hard offset fillRect (canvas).
- Colors: vibrant Tailwind (lime, orange, fuchsia, cyan). No gradients, no rounded corners, no soft shadows.
- Tone: "unhinged but readable" — slightly dialed back from the manifesto's full intensity per the user's branding choice.
- The DO NOT CLICK button is mandatory (manifesto rule).
