# Chaos Arcade — Design System

A design system document that AI agents read to generate consistent UI across the project.

---

## 1. Overview

**Product:** Chaos Arcade — A web-based retro arcade game hub featuring vintage games (Minesweeper, Checkers, Enduro Racing, Space Invaders) built with SvelteKit and Tailwind CSS.

**Target Audience:** Casual gamers, retro enthusiasts, and anyone seeking quick, chaotic arcade experiences in a browser.

**Design Ethos:** Neo-brutalist retro arcade. Heavy black borders, chunky pseudo-3D hard shadows, monospace typography, and high-contrast color blocks evoke 1980s/90s arcade cabinets and console game packaging. Every element should feel like a physical arcade machine component — tactile, immediate, and slightly unpolished in a charming way.

**Key Principles:**
- **Tactile & Chunky:** Every interactive element looks pressable, with thick borders and visible depth.
- **High Contrast:** Black on yellow, white on black, pure saturated game colors. No subtle gradients.
- **Arcade Authenticity:** Use arcade terminology ("Insert Coin", "Cabinet", "Hi-Score", "Hotspots").
- **Accessible Chaos:** Bold typography, clear focus states, gamepad + keyboard navigation support.

---

## 2. Aesthetic Direction

| Attribute | Value |
|-----------|-------|
| **Direction** | Neo-brutalist Retro Arcade |
| **Mood** | Playful, energetic, nostalgic, slightly chaotic |
| **Decoration** | Heavy — thick borders, hard drop shadows, emoji iconography |
| **Edge Treatment** | Sharp corners only (0px radius). Everything is boxed and rigid. |
| **Depth** | Pseudo-3D via solid-color offset shadows (`shadow-[4px_4px_0_rgba(0,0,0,1)]`) |
| **References** | 8-bit/16-bit game box art, arcade cabinet marquees, Neo Geo aesthetics, brutalist web design |

**What to Avoid:**
- No rounded corners (no `border-radius`, no `rounded-*` utilities).
- No soft shadows, blurs, or gradients for depth.
- No thin borders (`border-1` or `border`). Always `border-2`, `border-3`, or `border-4`.
- No serif fonts. No sans-serif fonts (except system fallbacks). Monospace is the personality.
- No pastel or muted tones for primary surfaces.

---

## 3. Colors

### Core Palette

| Token | Tailwind | Hex | Usage |
|-------|----------|-----|-------|
| **Arcade Yellow** | `yellow-300` | `#FDE047` | Primary page background, highlights, active states |
| **Arcade Yellow Dark** | `yellow-400` | `#FACC15` | Buttons, emphasis, marquee accents |
| **Pure Black** | `black` | `#000000` | Borders, text, primary surfaces, shadows |
| **Pure White** | `white` | `#FFFFFF` | Cards, button surfaces, contrast text |
| **Arcade Cream** | `yellow-200` | `#FEF08A` | Header backgrounds, secondary surfaces |

### Game Category Colors

Each game/utility card uses a distinct saturated color for its body, paired with a lighter tint for its marquee header:

| Game | Body Color | Marquee Color | Tailwind Classes |
|------|------------|---------------|------------------|
| Minesweeper | Red | Light Red | `bg-red-500` / `bg-red-200` |
| Checkers | Orange | Light Orange | `bg-orange-400` / `bg-orange-200` |
| Enduro | Green | Light Green | `bg-green-500` / `bg-green-200` |
| Space Chaos | Purple | Light Fuchsia | `bg-purple-600` / `bg-fuchsia-200` |
| Settings | Sky Blue | Light Sky | `bg-sky-400` / `bg-sky-200` |

### Neutral / Functional Colors

| Token | Tailwind | Usage |
|-------|----------|-------|
| **Zinc Dark** | `bg-zinc-900` | Game settings panels, dark surfaces |
| **Zinc Mid** | `bg-zinc-500` | Game grid cells (unrevealed) |
| **Zinc Light** | `bg-zinc-400` | Game grid cells (hover) |
| **Danger Red** | `bg-red-600` / `border-red-500` | Destructive actions (reset scores) |
| **Text Muted** | `text-black/60` / `text-black/70` | Hints, secondary labels, instructions |

### Color Rules
- **Borders are always black** (`border-black`) unless specifying a game category or danger state.
- **Shadows are always pure black** with 100% opacity (`rgba(0,0,0,1)`).
- **Text on dark backgrounds** must use `text-yellow-300` or `text-white` for primary content.
- **Text on light backgrounds** must use `text-black`.

---

## 4. Typography

### Font Family

| Purpose | Font | Tailwind | Fallback |
|---------|------|----------|----------|
| **All Text** | Monospace | `font-mono` | `ui-monospace`, `monospace` |

**Rule:** Use `font-mono` for 100% of text. This is the soul of the arcade aesthetic.

### Font Weights & Styles

| Element | Weight | Tailwind | Notes |
|---------|--------|----------|-------|
| **Page Titles** | Black (900) | `font-black` | With `drop-shadow-[2px_2px_0_rgba(0,0,0,1)]` or `drop-shadow-[4px_4px_0_rgba(0,0,0,1)]` |
| **Card Titles** | Black (900) | `font-black` | `uppercase`, tight leading (`leading-none`) |
| **Kickers / Labels** | Black (900) | `font-black` | `uppercase`, wide tracking (`tracking-[0.22em]`), very small size |
| **Body / Descriptions** | Bold (700) | `font-bold` | `uppercase`, tight line height (`leading-tight`) |
| **CTA Buttons** | Black (900) | `font-black` | `uppercase` |
| **Score Counters** | Black (900) | `font-black` | Large display size |
| **Hints / Metadata** | Bold (700) | `font-bold` | `uppercase`, muted opacity (`text-black/60`) |

### Type Scale

| Token | Mobile Size | Desktop Size (sm:) | Usage |
|-------|-------------|--------------------|-------|
| **Hero** | `text-3xl` | `text-5xl` / `text-7xl` | Page titles, splash screens |
| **H2** | `text-xl` | `text-[1.7rem]` | Card names, section headers |
| **H3** | `text-lg` | `text-2xl` / `text-3xl` | Sub-headers, button labels |
| **Body** | `text-xs` | `text-base` / `text-[0.95rem]` | Descriptions, instructions |
| **Caption** | `text-[0.6rem]` | `text-xs` / `text-sm` | Kickers, metadata, version badges |
| **Micro** | `text-[0.65rem]` | `text-sm` | Score labels, small badges |

### Typography Rules
- **Always uppercase** for UI text (`uppercase`). Body text, labels, buttons, kickers — everything.
- **Tracking:** Use wide letter-spacing for kickers and arcade labels (`tracking-[0.22em]` to `tracking-[0.45em]`).
- **Drop Shadows:** Page titles and splash headers use hard text shadows (`drop-shadow-[2px_2px_0_rgba(0,0,0,1)]` mobile, `drop-shadow-[4px_4px_0_rgba(0,0,0,1)]` desktop) to mimic 8-bit text rendering.

---

## 5. Spacing & Layout

### Spacing Scale

The project uses a loose, chunky spacing rhythm aligned with the tactile aesthetic:

| Token | Value | Usage |
|-------|-------|-------|
| **xs** | `0.5rem` (8px) | Tight internal gaps, small padding |
| **sm** | `0.75rem` (12px) | Mobile card padding, small gaps |
| **md** | `1rem` (16px) | Standard component padding |
| **lg** | `1.25rem` (20px) | Desktop card padding |
| **xl** | `1.5rem` (24px) | Section gaps, header padding |
| **2xl** | `2rem` (32px) | Large section separations |
| **3xl** | `3rem` (48px) | Hero spacing, splash screen padding |

### Layout Patterns

| Pattern | Implementation |
|---------|----------------|
| **Page Container** | `min-h-screen` with full-bleed background color (`bg-yellow-300` for dashboard, `bg-black` for settings/game screens). |
| **Content Max-Width** | `max-w-6xl` (72rem / 1152px) centered with `mx-auto` for dashboard. `max-w-4xl` for game screens. `max-w-2xl` for focused panels. |
| **Page Padding** | `px-2 py-3` mobile, `sm:px-6 sm:py-6` (or `sm:py-8`) desktop. |
| **Grid** | Dashboard cards use `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` with `gap-3 md:gap-4`. |
| **Flex** | Headers use `flex-col lg:flex-row` for responsive stacking. Cards use `flex flex-col` with internal flex rows. |

### Border & Shadow Sizing

Borders and shadows scale with viewport to maintain chunkiness:

| Element | Mobile | Desktop (sm:) |
|---------|--------|---------------|
| **Card Border** | `border-4` | `border-4` |
| **Card Shadow** | `shadow-[4px_4px_0_rgba(0,0,0,1)]` | `shadow-[8px_8px_0_rgba(0,0,0,1)]` |
| **Game Screen Shadow** | — | `shadow-[14px_14px_0_rgba(0,0,0,1)]` |
| **Modal / End Screen Shadow** | `shadow-[12px_12px_0_rgba(0,0,0,1)]` | `shadow-[12px_12px_0_rgba(0,0,0,1)]` |
| **Small Element Border** | `border-[3px]` | `sm:border-4` |
| **Small Element Shadow** | `shadow-[3px_3px_0_rgba(0,0,0,1)]` | `sm:shadow-[4px_4px_0_rgba(0,0,0,1)]` |

---

## 6. Components

### Arcade Card (Dashboard)

The primary navigational component. Used for game and utility links.

```
Structure:
- Outer <a> (focusable, data-dashboard-action="true")
  - <article> (full height, flex column)
    - Marquee Header: flex row, border-bottom-4, bg-{marqueeColor}, px-3 py-1
      - Kicker text: text-[0.6rem] font-black tracking-[0.22em] uppercase
      - Play icon: text-xs font-black uppercase (▶)
    - Card Body: flex-1 flex column, bg-{gameColor}, p-3
      - Top Row: flex items-start gap-3
        - Emoji Box: h-12 w-12 shrink-0, border-4 border-black bg-black, text-2xl centered
        - Text Block: min-w-0 flex-1
          - Title: text-xl font-black leading-none uppercase
          - Description: mt-1 text-xs font-bold uppercase leading-tight
      - Bottom Row: mt-3 flex items-end justify-between gap-2
        - Score Badge: border-[3px] border-black bg-black, text-yellow-300, text-[0.65rem] font-black uppercase
        - CTA Button: min-w-28, border-[3px] border-black bg-white, text-center, text-xs font-black uppercase, shadow-[3px_3px_0_rgba(0,0,0,1)]

Hover/Focus State:
- Outer article: -translate-y-1 (lift effect)
- CTA Button: translate-x-0.5 translate-y-0.5, shadow-none (pressed effect)

Responsive:
- All spacing, text sizes, and shadow offsets double on sm: breakpoint.
```

### Header Block

```
Structure:
- <header>: border-4 border-black bg-yellow-200, p-3, shadow-[4px_4px_0...]
  - flex-col lg:flex-row lg:items-end lg:justify-between
  - Left:
    - Kicker: text-[0.6rem] font-black tracking-[0.3em] uppercase
    - H1: text-3xl font-black tracking-tight uppercase drop-shadow-[2px_2px_0...]
    - Subtitle: text-xs font-bold uppercase
  - Right:
    - flex-wrap gap-2
    - Badges: border-[3px] or border-4 border-black, various bg colors (black, white)
```

### Arcade Button (Primary)

Used for main actions inside games (Start, Continue, Retry).

```
Style:
- border-2 (mobile) / border-4 (desktop) border-{accentColor}
- bg-black text-{accentColor} (primary variant) OR bg-white text-black (secondary variant)
- px-4 py-3 (mobile) / sm:px-8 sm:py-5 (desktop)
- text-lg (mobile) / sm:text-3xl (desktop)
- font-black uppercase
- transition-all

States:
- Hover: scale-[1.02], bg and text color invert
- Focus: scale-[1.02], bg and text color invert, focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2
- Active: scale-[0.98]
```

### Score Badge

```
Style:
- border-[3px] (mobile) / border-4 (desktop) border-black
- bg-black text-yellow-300
- px-2 py-1.5 (mobile) / sm:px-3 sm:py-2
- text-[0.65rem] (mobile) / sm:text-sm
- font-black uppercase
```

### Footer Block

```
Style:
- border-4 border-black bg-black text-yellow-300
- px-3 py-2 (mobile) / sm:px-4 sm:py-3
- text-[0.65rem] (mobile) / sm:text-sm
- font-black uppercase
- shadow-[4px_4px_0_rgba(0,0,0,1)] (mobile) / sm:shadow-[8px_8px_0...]
- flex flex-wrap items-center justify-between gap-2
```

---

## 7. Motion & Animation

### Animation Philosophy
- **Fast & Snappy:** Arcade machines respond instantly. No slow fades.
- **Physical:** Animations should suggest mechanical movement (lift, press, shift).
- **Minimal:** Only essential state changes are animated.

### Timing Tokens

| Token | Duration | Usage |
|-------|----------|-------|
| **Instant** | `100ms` | Color inversions, subtle shifts |
| **Fast** | `150ms` | Standard hover transitions |
| **Medium** | `200ms` | Accordion-like reveals |
| **Slow** | `250-300ms` | Focus ring animations, larger state changes |
| **Game** | `600ms` | Skill bar fills, score counters |

### Easing
- Default: `ease` (Tailwind default) or `transition-all` without specifying.
- For hover lifts: `duration-100` or `duration-150`.
- For scale effects: `transition-all` covers `transform` and `box-shadow`.

### Specific Patterns

| Interaction | Animation |
|-------------|-----------|
| **Card Hover** | `group-hover:-translate-y-1` on article, shadow stays fixed (creates lift illusion) |
| **CTA Press** | `group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-none` |
| **Button Hover** | `hover:scale-[1.02]` + background/text color inversion |
| **Button Active** | `active:scale-[0.98]` |
| **Focus Visible** | `focus-visible:ring-4 focus-visible:ring-{color} focus-visible:ring-offset-2` |
| **Danger Button** | `hover:scale-110 focus:scale-110 active:scale-95` (more dramatic) |
| **Modal Overlay** | `bg-black/70 backdrop-blur-[2px]` (static, no animation) |
| **Game Grid Cell** | `active:translate-y-[2px]` on press |

---

## 8. Voice & Tone

### Brand Voice Attributes
- **Arcade-First:** Use cabinet and coin-op terminology. "Insert Coin", "Cabinet memory", "Launch = Enter", "Burn Rubber".
- **Bold & Direct:** Short, punchy statements. No fluff.
- **Playfully Chaotic:** The brand name is "Chaos". Embrace slightly absurd, high-energy copy.
- **Vintage Nostalgia:** Reference CRTs, cartridges, memory units, and 8-bit era language.

### Copy Patterns

| Context | Pattern | Examples |
|---------|---------|----------|
| **CTAs** | Verb + Arcade Noun | "Insert Coin", "Burn Rubber", "Launch Run", "Start Match", "Open Panel" |
| **Kickters** | Category + Location | "Puzzle Bay", "Battle Table", "Road Fury", "Galaxy Sector", "System Deck" |
| **Score Labels** | Abbreviated Arcade Style | "Wins", "Hi-Score", "Total Wins" |
| **Instructions** | Command + Key | "A / Enter = select", "B / Esc = return", "Tap or use D-pad to jump cabinets" |
| **Status** | Hardware Metaphor | "Cabinet memory: Online", "MEMORY MANAGEMENT UNIT" |

### Text Case Rules
- **UI Text:** Always `UPPERCASE`.
- **Kickers/Labels:** Always `UPPERCASE` with wide tracking.
- **User-Generated / Dynamic:** Can preserve original case if needed, but UI framing stays uppercase.

---

## 9. Design Checklist

When creating new UI components or pages for Chaos Arcade, verify:

- [ ] **Font:** Is `font-mono` applied to all text?
- [ ] **Case:** Is all UI text `uppercase`?
- [ ] **Weight:** Is at least `font-bold` used? Headlines and CTAs should use `font-black`.
- [ ] **Borders:** Are borders `border-2` minimum (prefer `border-4` for primary elements)? Are they `border-black`?
- [ ] **Shadows:** Are shadows hard-offset (`shadow-[Xpx_Ypx_0_rgba(0,0,0,1)]`) and not soft/blurred?
- [ ] **Corners:** Are all corners sharp (no `rounded-*` utilities)?
- [ ] **Colors:** Is the palette limited to arcade yellow, pure black/white, game category colors, and zinc grays?
- [ ] **Background:** Does the page use `bg-yellow-300` for dashboard/marketing, or `bg-black` for game/settings screens?
- [ ] **Responsive:** Do borders, shadows, text sizes, and padding scale up at `sm:` breakpoint?
- [ ] **Focus:** Are focus states visible with `focus-visible:ring-4` and adequate offset?
- [ ] **Voice:** Does the copy use arcade terminology and uppercase styling?
- [ ] **Depth:** Do interactive elements have a "lift" hover state (`-translate-y-1`) or "press" state (`shadow-none` + shift)?

---

## Key Files

| Purpose | Location |
|---------|----------|
| Global Styles | `src/routes/layout.css` |
| Landing Page / Dashboard | `src/routes/+page.svelte` |
| Root Layout | `src/routes/+layout.svelte` |
| Tailwind Config | Implicit (Tailwind v4 via CSS import) |
| Settings Page | `src/routes/settings/+page.svelte` |
| Game Pages | `src/routes/minesweeper/+page.svelte`, `src/routes/checkers/+page.svelte`, `src/routes/enduro/+page.svelte`, `src/routes/space-invaders/+page.svelte` |
