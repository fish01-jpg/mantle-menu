# Sp1der Intro beta

Fishes Arcade's separate **Intro beta** entry opens the same current `sp1der.html` after an optional 22-second cinematic. Normal Project Sp1der and its runners are unchanged. The beta is not an authentication or security check.

## Sequence

- **First signal, 0–3s:** signal sweep, depth grid and orbital construction lines.
- **Assembly, 3–7s:** extruded message, window, folder, cursor, person and envelope models fly into an orbital arrangement.
- **Ignition, 7–11s:** separated geodesic vertices converge, with layered counter-rotating rings and expanding wavefronts.
- **Connections, 11–15s:** a triangulated 110-node sphere and depth corridor unfold as the interface models pass the camera.
- **Identity, 15–19s:** six individually projected, extruded letters assemble into SP1DER.
- **Handoff, 19–22s:** the title holds, the camera advances, and the already-loading original app is revealed.

Perspective projection, face fills, front/back edges, independent rotations and depth positioning are calculated locally with Canvas 2D. No Three.js/CDN runtime, video download, Marvel assets or third-party music is required. The restrained cyan/amber spatial artwork is original.

## Sound and controls

`assets/intro/sp1der-intro-beta.mp3` is the real 22-second stereo soundtrack (128 kb/s MP3, approximately 353 KB). `scripts/compose-sp1der-intro.cjs` deterministically synthesizes it from oscillators, noise, envelopes and stereo diffusion using the shared `intro/sequence.json` score, then encodes with ffmpeg. No recorded samples are used. The cue boundaries and musical impacts share the same timing data.

The visuals use `HTMLAudioElement.currentTime` as their master clock. Pausing or buffering audio holds the visual clock; mute does not desynchronize it. Silent mode uses a monotonic performance clock. A deliberate Initialize with sound gesture meets browser autoplay restrictions; nothing plays on ordinary Arcade or Sp1der launch. Missing/blocked audio falls back to silent playback. App loading begins only after Play or Skip.

All launch paths offer Skip (including Escape), optional silent playback and reduced motion. Reduced motion defaults to the operating-system preference and replaces camera travel, spinning, flight and pulsing with static phase compositions. Switching away pauses the intro and asks the visitor to Resume. Controls fit portrait/landscape safe areas, and the renderer caps mobile pixel density and frame rate. After handoff, the original app iframe follows the visible viewport height and offset so an on-screen keyboard can resize its phone composer area.

The hidden app stays inert during the cinematic. Successful page loading, not a fictional progress bar, determines app readiness. If the app is still loading at the end, a separate waiting state appears; failed HTTP requests, invalid documents and a 30-second timeout expose Retry and Back to arcade. Once ready, the wrapper disappears and the original app receives focus.

## Sources and builds

- Edit `intro/shell.html`, `intro/sp1der-intro.css`, `intro/sp1der-intro.js` and `intro/sequence.json`.
- Run `node scripts/build-sp1der-intro.cjs` to regenerate the standalone `sp1der-intro.html`.
- Run `node scripts/compose-sp1der-intro.cjs` after musical/timing changes. Requires Node.js and ffmpeg with libmp3lame.
- Run `node scripts/build-sp1der-intro.cjs --check` and `node --test tests/*.test.cjs` before committing.

The entry embeds its runtime CSS/JS/cue data for the Arcade raw-HTML launcher; only the actual MP3 and bundled OFL fonts remain separate assets. Font license notices are in `assets/intro/fonts/`.

On normal HTTP hosting the wrapper fetch-verifies and opens the existing `sp1der.html` URL, preserving a real origin for Firebase. On raw GitHub/plaintext mirrors it fetches and embeds that same current app using the existing Arcade-style fallback. Origin-sensitive Firebase features may be restricted in raw/srcdoc contexts, as with the existing runners; use normal HTTP hosting for chat. The intro does not change Firebase, account permissions, moderation, database logic or the three existing Sp1der files.

## Verification

All 39 Node regression tests pass, including the original 23 checks and 16 intro checks covering generation, catalog separation, scored phases, clocks, pause/resume, buffering, mute, reduced motion, background pause, skip, failure/retry, timeout and keyboard viewport forwarding.

Interactive Chromium checks cover a complete sound-enabled run and app reveal; silent start; pause/resume and mute; portrait-to-landscape rotation without losing playback position; Skip and Escape; failed audio fallback; failed app load and successful retry; OS reduced-motion detection with identical canvas frames within a phase; and a simulated 280px keyboard viewport with restoration. Controls were checked at 320×568, 375×667, 390×844, 430×932, 667×375, 844×390 and 932×430, with no horizontal document overflow.

Both the desktop popup and phone Arcade viewer reach the existing Sp1der app. The regular phone Sp1der and desktop runner remain separate. Search, Apps filtering, empty/reset, Back, terms, keyboard warnings, Tetris, Pixel Canvas controls, Geometry Dash and Server Tiers were replayed. No new page errors were observed in the instrumented intro and regression pages.

Firestore/Auth requests were blocked during browser QA. No accounts were created, no messages were sent and no production data/settings were changed. Physical iPhone/Safari behavior, live authentication and a production hosting redeployment are not verified by these tests.
