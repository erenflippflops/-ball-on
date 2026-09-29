# BALL-ON design: "Retro sticker album on a faint football pitch"

Approved by the owner. This file and the HTML mockups next to it are the visual specification.
The mockups are static HTML with inline styles: open any of them in a browser to see the target.
(They contain a `<x-dc>` wrapper and a `support.js` script from the design tool; ignore both.
Everything visible is plain HTML + inline CSS.)

AMO ARENA is NOT part of this design. Never change AMO ARENA's files or look
(amo-arena.html, src/amo-arena-main.tsx, src/amo-style.css). Its only appearance here is its
orange card on the BALL-ON landing page.

## 1. Tokens (use exactly these values; define them once as CSS variables)

| Token | Value | Use |
|---|---|---|
| --paper | #F2E8D5 | page background |
| --card | #FFFDF7 | stickers, cards, inputs, secondary buttons |
| --ink | #1B1A17 | text, all borders, hard shadows |
| --muted | #5B5446 | secondary text, labels |
| --navy | #1F3A5F | player-card photo panel, join/scout buttons, logo |
| --red | #B8341F | primary buttons, OVR badge, step numbers |
| --green | #2F6B3A | positive text ("Tiki-Taka'na uygun"), pitch lines |
| --orange | #E0892F | AMO ARENA card on the landing page and bot avatars only |

Fonts (Google Fonts): **Alfa Slab One** for display (logo, headings, big numbers, primary
buttons) and **Bricolage Grotesque** (400/600/800) for everything else.
Fallbacks: 'Rockwell', serif and 'Trebuchet MS', sans-serif.

Page background = --paper + a faint halftone dot pattern
(`radial-gradient(rgba(120,95,50,0.16) 1px, transparent 1.3px)`, 9px grid) + a faint football
pitch drawn with 2px lines in `rgba(47,107,58,0.17)` and very light horizontal mowing stripes
(`rgba(47,107,58,0.045)`, 60px bands). Pitch is vertical on phones, horizontal on desktop.
Copy the exact geometry from Auction-Mobile.html (phone) and Auction-Desktop.html (desktop).
The pitch is decoration only: pointer-events none, always behind content.

## 2. Components

- **Primary button:** --red background, --card text, Alfa Slab One ~21px, 2px --ink border,
  hard shadow `4px 4px 0 var(--ink)`, height 58px. Pressed: shadow 0 and translate(4px,4px).
- **Secondary button:** --card background, --ink text, Bricolage 800, 2px --ink border,
  shadow `3px 3px 0 var(--ink)`, min height 44px.
- **Selected option (segmented, tactic, formation, team):** --ink (or --navy for tactic tiles)
  background, light text, no shadow.
- **Inputs/selects:** height 48px, 2px --ink border, --card background, Bricolage 600 16px,
  every input has a visible label (LABEL style below).
- **LABEL style:** 12px, weight 800, letter-spacing 0.12em, uppercase, --muted.
- **Sticker:** --card background, 10px white border feel (padding 10px), soft shadow
  `0 2px 0 rgba(27,26,23,0.12), 0 12px 22px rgba(80,60,20,0.18)`, slight rotation (-2 to +1.5deg).
- **Player card (auction):** sticker; top panel --navy with white halftone dots and the player's
  initials in Alfa Slab One (NO photos, NO club logos, ever); position tag bottom-left;
  name, positions/archetype/age; 6 stats in a row between two 2px --ink rules
  (HIZ ŞUT PAS DRİ DEF FİZ); red round OVR badge overlapping the top-right corner, rotated 8deg.
- **Timer ring:** conic-gradient --red over --card with a --ink border, seconds in the middle.
- **Clock chip:** --ink background, --paper text, Alfa Slab One 16px.
- **Monogram avatar:** square, 2px --ink border, initials in Alfa Slab One. Humans --red/--navy,
  bots --orange with --ink text.
- **Ink banner:** --ink background, --paper text, small uppercase heading in #E9B8AE.

## 3. Layout rules

- Phone first (390px wide). All controls >= 44px tall.
- On phones the main action (e.g. "Teklif ver") sits at the BOTTOM of the screen, directly above
  the budget/roster/position-limit bar, so it is reachable with the thumb without scrolling.
- Desktop auction = 3 columns: own squad on a mini pitch + budget + limits | card + bid area |
  rivals, recent sales, gossip. See Auction-Desktop.html.
- Other screens on desktop: same design as phone, centered, max-width ~480px, unless a desktop
  mockup exists.
- Every new visible text goes through src/translations.ts with BOTH Turkish and English.

## 4. Mockup -> code map

| Mockup | Code |
|---|---|
| Landing.html | src/MainMenu.tsx |
| Lobby.html | Lobby() in src/ballon-main.tsx |
| Room.html | the lobby/waiting phase inside Game() |
| Tactic.html | TacticSelection() |
| Auction-Mobile.html, Auction-Desktop.html | Auction() (+ Panel, MiniField, CircularTimer, AuctionResultModal) |
| Halftime.html | src/HalftimeComponent.tsx |
| Steal.html | Steal() (Trade() uses the same look) |
| Match.html | Match() and Result() |
| Bracket.html | FUTURE (tournament), do not build yet |

## 5. In the mockups but NOT built yet (leave out; they arrive later with server work)

Room size selector with every value 2-8 (keep the current options, only restyle them),
"target team" choice in Steal, the tournament bracket, the "gossip debunked" (bluff) banner,
"Kelepir"/"Soygun" tags, live minute-by-minute commentary and possession bar, spectator count.
If a mockup shows one of these, build the screen without it. Never fake data.
