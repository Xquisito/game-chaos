# 0001 - Frog Chaos Uses Canvas

## Status

Accepted

## Context

Frog Chaos has more simultaneous moving occupants than the other cabinets: vehicles, logs,
turtles, hazards, floaters, and one player frog. The project also prioritizes mobile performance.

## Decision

Render the Frog Chaos playfield interior with a 2D canvas. Keep the HUD, splash screen, end
screen, modal, and touch controls in Svelte/Tailwind DOM.

## Consequences

Canvas keeps per-frame occupant movement out of Svelte reactivity and avoids a large DOM transform
surface on low-end mobile devices. The tradeoff is that collision, layout, and drawing code stay
inside the cabinet route instead of using the DOM element model used by the other games.
