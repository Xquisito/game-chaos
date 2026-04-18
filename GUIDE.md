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

## Style

- Try keep game chaos style and not bring new one


## Testing e2e

- Use playwright cli either to take a screen shots, access console logs or even play to do an e2e test
