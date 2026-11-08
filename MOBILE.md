# Mantle Menu phone interface

The existing desktop hub is preserved. Phones automatically receive a separate, touch-oriented layout in `index.html`; there is no redirect, setup step, or saved device preference.

## Detection and layout

- Phone user agents and the browser's mobile hint activate phone mode, including landscape widths greater than 600px.
- Small coarse-pointer screens provide a fallback. Narrow desktop windows also get the compact layout, then restore the full desktop layout when widened.
- Resize, orientation, media-query and visual-viewport changes update the interface without reloading it.
- Portrait uses a two-column catalog and bottom navigation. Wider landscape uses a two- or three-column catalog and a side navigation rail.
- Controls have at least 44px touch targets. Safe-area padding, dynamic viewport heights, keyboard focus, reduced motion and browser zoom are supported.
- Search, All / Touch-ready / Games / Apps filters, result counts and an empty state operate on the existing eight app entries.

## Phone app launches

- Apps open in the current tab, inside a full-height viewer with Back, Reload and Expand. Expand hides the toolbar if native fullscreen is unavailable; Show controls restores it.
- Returning to the menu cancels outstanding requests, removes the app document and releases arcade tracking. Late downloads cannot replace a newly selected app.
- Pixel Canvas starts with a clear painting surface and a collapsible brush panel.
- Tetris has touch buttons for left, right, rotate, down, drop and pause/resume. Holding directional buttons repeats input. The board and controls adapt when rotated, without restarting the game; desktop keyboard controls remain intact.
- Project Sp1der uses `sp1der-mobile.html`, not the desktop chat runner. Its navigation breakpoint includes 932px-wide phones in landscape. Normal HTTP(S) hosting uses the actual page URL so Firebase receives a real browser origin.
- Raw GitHub / plaintext-CDN embedding retains the existing fetched-HTML fallback. Some browser services, notably Firebase origin-sensitive features, may be restricted in that embedding context; normal hosting is preferable for chat.
- PolyTrack and sp1dercraft remain keyboard-oriented third-party games. They show a keyboard notice with Cancel / Open anyway, rather than claiming to have phone game controls.
- Existing external game sources and desktop popup behavior are retained.

## Files

- `index.html`: detector, responsive phone UI, search/filtering, phone viewer and accessible dialogs.
- `Mantle.html`: viewport safe-area support for the existing loader.
- `sp1der-mobile.html`: phone landscape navigation breakpoint.
- `tetris/tetris.html`, `tetris/tetris.js`: responsive game surface and touch controls.
- `tests/phone-detection.test.cjs`: detector and JavaScript syntax regression tests, using Node's built-in test runner.

## Verification

Run `node --test tests/phone-detection.test.cjs` from the repository root. For browser testing, serve the repository over HTTP, for example with `python -m http.server 3000`.

Browser checks cover iPhone and Android emulation, phone rotation, narrow-to-desktop resizing, search and filter states, terms, keyboard warnings, app launch/back/reload, Tetris touch input, Pixel Canvas tools and the existing desktop popup flow. Third-party game availability and external chat authentication depend on their own services.
