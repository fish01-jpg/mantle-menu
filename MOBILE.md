# Mantle Menu phone interface

The existing desktop hub is preserved. Phones automatically receive a separate, touch-oriented layout in `index.html`; there is no redirect, setup step, or saved device preference.

## Detection and layout

- Phone user agents and the browser's mobile hint activate phone mode, including landscape widths greater than 600px.
- Small coarse-pointer screens provide a fallback. Narrow desktop windows also get the compact layout, then restore the full desktop layout when widened.
- Resize, orientation, media-query and visual-viewport changes update the interface without reloading it.
- Portrait uses a two-column catalog and bottom navigation. Wider landscape uses a two- or three-column catalog and a side navigation rail.
- Controls have at least 44px touch targets. Safe-area padding, dynamic viewport heights, keyboard focus, reduced motion and browser zoom are supported.
- Search, All / Touch-ready / Games / Apps filters, result counts and an empty state operate on all nine app entries, including the optional Sp1der Intro beta.

## Phone app launches

- Apps open in the current tab, inside a full-height viewer with Back, Reload and Expand. Expand hides the toolbar if native fullscreen is unavailable; Show controls restores it.
- Returning to the menu cancels outstanding requests, removes the app document and releases arcade tracking. Late downloads cannot replace a newly selected app.
- Pixel Canvas starts with a clear painting surface and a collapsible brush panel.
- Tetris has touch buttons for left, right, rotate, down, drop and pause/resume. Holding directional buttons repeats input. The board and controls adapt when rotated, without restarting the game; desktop keyboard controls remain intact.
- Project Sp1der uses `sp1der-mobile.html`, not the desktop chat runner. That legacy entry now shares the same automatic phone interface as `sp1der.html` and the runner's `sp1der-backup.html`. Normal HTTP(S) hosting uses the actual page URL so Firebase receives a real browser origin.
- Raw GitHub / plaintext-CDN embedding retains the existing fetched-HTML fallback. Some browser services, notably Firebase origin-sensitive features, may be restricted in that embedding context; normal hosting is preferable for chat.
- PolyTrack and sp1dercraft remain keyboard-oriented third-party games. They show a keyboard notice with Cancel / Open anyway, rather than claiming to have phone game controls.
- Existing external game sources and desktop popup behavior are retained.

## Mantle and blank-tab loading

- `Mantle.html` and the Arcade inspect real document base elements, not strings in scripts, comments or templates. Relative app assets receive the correct repository root.
- Arcade source resolution also handles older downloaded launchers that supply `about:blank`, `about:srcdoc` or `file:` as the document base. A missing local HTTP base no longer throws before remote fallbacks.
- Duplicate source URLs are tried once. Tetris also has an independent CDN fallback. Menu and app-text requests have a 20-second per-request limit; the large sp1dercraft chunks allow two minutes each instead. Back cancels nested script/worker downloads as well.
- Geometry Dash uses temporary, in-memory progress only when the browser denies access to local storage. Normal saved progress is unchanged. Firebase origin-sensitive features still require an appropriate hosted origin; this repair does not change authentication.
- Fluid Sim's embedded texture images request anonymous CORS access before loading. This prevents WebGL from rejecting repository-hosted textures as cross-origin data in both phone viewers and desktop popups.
- `tests/arcade-loading.test.cjs` covers base handling, fallback deduplication, timeouts and cancellation. Browser QA must include the complete Mantle-to-Arcade-to-app chain and an older Mantle fixture, not just an HTTP-hosted Arcade.

## Files

- `index.html`: detector, responsive phone UI, search/filtering, phone viewer and accessible dialogs.
- `Mantle.html`: viewport safe-area support for the existing loader.
- `sp1der.html`, `sp1der-backup.html`, `sp1der-mobile.html`: self-contained automatic phone interfaces.
- `mobile/sp1der-phone.js`, `mobile/sp1der-phone.css`: shared Sp1der phone source.
- `scripts/build-sp1der-phone.cjs`: embeds those sources in all three standalone entries.
- `tetris/tetris.html`, `tetris/tetris.js`: responsive game surface and touch controls.
- `tests/phone-detection.test.cjs`, `tests/sp1der-phone.test.cjs`: detection, keyboard viewport, syntax and embedded-asset regression tests, using Node's built-in test runner.

## Sp1der itself

The main Sp1der app is `sp1der.html`, not the Arcade's `index.html`. Both `fishes.html` and `fishes-mobile.html` fetch `sp1der-backup.html`, so all three Sp1der entries embed the phone assets. The existing differences in app content and themes are preserved rather than replacing the backup with a different app version.

- Phone detection uses mobile user agents, Client Hints and a small coarse-pointer-screen fallback. Phone mode remains active beyond 1024px in landscape; ordinary tablets and wide desktop windows retain their existing layouts. Narrow desktop windows use compact mode and restore their previous sidebar state when widened.
- Portrait has Home / Community / Games / More bottom navigation. Wider landscape moves it to a side rail. More opens a searchable full navigation drawer that respects hidden role-gated pages. Close, outside tap and Escape dismiss it, with focus management.
- Community and Aegis have a Channels drawer, Back to chat, accessible channel items, and automatic dismissal after selection. Its trigger is outside the dynamically replaced chat header so it survives channel changes.
- Messages wrap long text; code/ASCII content keeps local scrolling. Existing Reply/React/staff actions remain permission-controlled and become touch-visible when present. Mobile Return inserts a newline; the visible Send button or existing Ctrl/Cmd+Enter shortcut sends. Desktop shortcuts are unchanged.
- The visual viewport drives shell height and offset. When a software keyboard reduces the viewport, the dock and nonessential chat controls make room for the composer. Drafts and the selected panel survive rotation.
- Home cards, game search/categories, other panels, viewer controls and dialogs fit phones with safe-area padding and readable form text. Dismissible dialogs gain a sticky Close control using only their existing dismissal action. Non-dismissible gates are not bypassed.
- The existing site tour highlights phone navigation instead of an off-screen desktop sidebar. Desktop appearance, accounts, authentication, channel access, moderation and server command behavior are unchanged.

After editing either shared source, run:

```sh
node scripts/build-sp1der-phone.cjs
node scripts/build-sp1der-phone.cjs --check
node --test tests/*.test.cjs
```

The generated HTML needs no new runtime CSS or JavaScript requests, including inside raw-HTML runners. Do not edit the generated phone blocks individually.

## Verification

Run `node --test tests/*.test.cjs` from the repository root. For browser testing, serve the repository over HTTP with a static server that preserves literal `.html` URLs.

Browser checks cover iPhone and Android emulation, phone rotation, narrow-to-desktop resizing, search and filter states, terms, keyboard warnings, app launch/back/reload, Tetris touch input, Pixel Canvas tools and the existing desktop popup flow. Third-party game availability and external chat authentication depend on their own services.

Sp1der UI checks use blocked Firebase Auth and Firestore traffic. They exercise guest navigation and dialogs, local rendered-message fixtures, draft-preserving rotation, simulated keyboard viewport contraction and the standalone/backup/mobile entries without creating accounts, sending messages, changing server configuration or claiming that authenticated backend behavior was tested. A Chromium mobile emulation is not a physical iPhone/Safari test.
