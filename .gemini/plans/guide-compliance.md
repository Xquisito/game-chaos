# Plan: GUIDE.md Compliance Refactor

This plan outlines the steps to bring all games into full compliance with the latest `GUIDE.md` standards.

## Objective
Standardize navigation and control across all games using **Unified Controls (UC)**, implement missing UI screens (Splash and End Game), and integrate persistent scoreboards for all games.

## Implementation Steps

### 1. Unified Controls (UC) Standardization
- **Confirm/Select**: `['A', 'Enter', 'Space', 'Left-Click']` (using standard `onclick` on buttons).
- **Return/Pause**: `['B', 'Esc', 'Left-Click' (outside buttons during gameplay)]` or dedicated buttons.
- **Gamepad Polling**: Move to `requestAnimationFrame` loop for consistent performance.

### 2. UI & Session Flow
- **Splash Screen**:
  - Show "START" on fresh load.
  - Show "CONTINUE" and "NEW GAME" if a session is currently active.
- **End Game Screen**:
  - Options: "RETRY" (jumps to game) and "BACK TO SPLASH".

### 3. Minesweeper & Checkers Refactor
- **Repair Syntax**: Fix broken files from previous edits.
- **Implement Flow**: Add Splash and End screens.
- **Joystick Support**: Add full D-Pad/Stick navigation.
- **Scoreboard**: Persist win counts to `localStorage` and display on dashboard.

### 4. Cleanup
- **Enduro & Space Chaos**: Revert experimental right-click mapping to standard left-click Confirm.
- **Consistency**: Ensure all buttons use high-contrast focus states (scale/color).
