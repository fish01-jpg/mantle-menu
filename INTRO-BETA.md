# Sp1der Intro beta

Fishes Arcade's separate **Intro beta** entry opens the same current `sp1der.html` after an optional 34-second cinematic. Normal Project Sp1der and its runners are unchanged. The beta is not an authentication or security check.

## Sequence

- **First signal, 0–4s:** signal sweep, depth grid and orbital construction lines.
- **Assembly, 4–8s:** extruded message, window, folder, cursor, person and envelope models fly into an orbital arrangement.
- **Ignition, 8–12s:** separated geodesic vertices converge, with a deep impact, wide shockwaves and flying fragments.
- **Orbital machinery, 12–16s:** three counter-rotating decks, mechanical vanes, circuit supports and scanning planes align around the core.
- **Connections, 16–20s:** a triangulated 110-node sphere and depth corridor unfold as the interface models pass the camera.
- **Transit, 20–24s:** a hexagonal warp corridor, long perspective rails and interface models rush past.
- **Identity, 24–30s:** six independently projected, extruded letters land on half-second musical cues; the full title receives its strongest impact at 28s.
- **Handoff, 30–34s:** two final signals, a sustained title, camera advance and fade reveal the already-loading original app.

Ten major impact cues drive expanding triple wavefronts, flying polygon shards and trails, a localized glow, horizontal lens beams and a short camera punch. Pre-hit contraction follows the soundtrack's 900ms risers. Bass kicks and plucks have separate, smaller pulse envelopes; they are no longer approximated by a continuous cosine. Controls and text remain steady. There are no full-screen white impact flashes.

## Scene sizing and separation

Each phase now owns its geometry. The opening starfield, ground grid and orbital schematics end before phase 2; assembly shows only its six interface models and current musical effects, without the old rings or ghost core underneath. Ignition, machinery, network, transit and identity likewise no longer accumulate previous-phase backgrounds. The poster remains a separate composition and the title is intentionally shared across identity/handoff.

`intro/scene-layout.js` fits each scene's primary objects into artwork bounds measured from the actual controls, caption and footer. Short landscape uses a right-hand artwork region alongside the caption; portrait uses the space above it. Scene-specific scale budgets account for object extents and perspective, including the assembly's elliptical shape, while the title fits available width. Short embedded portrait views use tighter caption spacing to retain useful object sizes without reducing touch targets. Artwork is clipped away from controls/copy, and the handoff camera advance is restrained so the title remains legible. The soundtrack, 34-second timing and app-loading controller are unchanged.

Perspective projection, face fills, front/back edges, independent rotations and depth positioning are calculated locally with Canvas 2D. No Three.js/CDN runtime, video download, Marvel assets or third-party music is required. The restrained cyan/amber spatial artwork is original.

## Sound and controls

`assets/intro/sp1der-intro-beta-v2.mp3` is the real 34-second stereo soundtrack (44.1kHz, 128 kb/s MP3, 545,206 bytes). `scripts/compose-sp1der-intro.cjs` deterministically synthesizes it from oscillators, noise, envelopes and stereo diffusion, then encodes with ffmpeg. No recorded samples are used. The expanded arrangement adds deeper cinematic impacts, metallic tails, bass percussion, snare accents, alternating high-frequency details, transit layers and individually panned title-lock tones.

`intro/sequence.json` supplies stage boundaries, 120 BPM, impact strengths and the versioned audio path. `intro/timing.js` is imported unchanged by both the composer and the embedded browser renderer: its exact event list schedules sound transients and visual envelopes, including the individual title locks. The versioned filename prevents cached original audio from ending the expanded timeline early. The original `assets/intro/sp1der-intro-beta.mp3` remains available for older downloaded 22-second wrappers.

The visuals use `HTMLAudioElement.currentTime` as their master clock. Pausing or buffering audio holds the visual clock; mute does not desynchronize it. Silent mode uses a monotonic performance clock. A deliberate Initialize with sound gesture meets browser autoplay restrictions; nothing plays on ordinary Arcade or Sp1der launch. Missing/blocked audio falls back to silent playback. App loading begins only after Play or Skip.

All launch paths offer Skip (including Escape), optional silent playback and reduced motion. Reduced motion defaults to the operating-system preference and replaces camera travel, spinning, flight and pulsing with static phase compositions. Switching away pauses the intro and asks the visitor to Resume. Controls fit portrait/landscape safe areas, and the renderer caps mobile pixel density and frame rate. After handoff, the original app iframe follows the visible viewport height and offset so an on-screen keyboard can resize its phone composer area.

The hidden app stays inert during the cinematic. Successful page loading, not a fictional progress bar, determines app readiness. If the app is still loading at the end, a separate waiting state appears; failed HTTP requests, invalid documents and a 30-second timeout expose Retry and Back to arcade. Once ready, the wrapper disappears and the original app receives focus.

## Sources and builds

- Edit `intro/shell.html`, `intro/sp1der-intro.css`, `intro/sp1der-intro.js`, `intro/timing.js`, `intro/scene-layout.js` and `intro/sequence.json`.
- Run `node scripts/build-sp1der-intro.cjs` to regenerate the standalone `sp1der-intro.html`.
- Run `node scripts/compose-sp1der-intro.cjs` after musical/timing changes. Requires Node.js and ffmpeg with libmp3lame.
- Run `node scripts/build-sp1der-intro.cjs --check` and `node --test tests/*.test.cjs` before committing.

The entry embeds its runtime CSS/JS/cue data for the Arcade raw-HTML launcher; only the actual MP3 and bundled OFL fonts remain separate assets. Font license notices are in `assets/intro/fonts/`.

On normal HTTP hosting the wrapper fetch-verifies and opens the existing `sp1der.html` URL, preserving a real origin for Firebase. On raw GitHub/plaintext mirrors it fetches and embeds that same current app using the existing Arcade-style fallback. Origin-sensitive Firebase features may be restricted in raw/srcdoc contexts, as with the existing runners; use normal HTTP hosting for chat. The intro does not change Firebase, account permissions, moderation, database logic or the three existing Sp1der files.

## Verification

The intro regressions cover generation, catalog separation, eight scored phases, exact hit onset/decay, the shared musical grid, risers, six title locks, motion suppression, media clocks, pause/resume, buffering, mute, background pause, skip, failure/retry, timeout and keyboard viewport forwarding. Regressions explicitly prevent the new intro from handing off at the old 22-second endpoint and ensure phase-2 isolation, exclusive scene ownership, stable reduced-motion layers, fitting across narrow/embedded/desktop viewports, useful compact assembly sizing and clipping away from UI.

All 70 repository tests passed before integration with concurrent upstream changes. On the newer catalog/Resources revision, 68 of 70 pass, including every intro test. Two existing phone-bundle checks still expect the former generated phone implementation in `sp1der.html`; upstream now supplies a different mobile implementation. These same checks fail on upstream without this intro patch. The intro's catalog test now checks unique IDs and preservation of the original entries rather than assuming no additional games can be added. No current application, catalog or mobile implementation was replaced to satisfy an outdated generator check.

The expanded version was replayed naturally with real sound at 1440×900 and 390×844 through all eight stages to original-app reveal and focus handoff. A complete reduced-motion run at 320px, rotated during its paused title, also reaches the app at 34 seconds. Identical canvas frames were checked within both assembly and final handoff phases, including the last second. Screenshots cover impact wavefronts, machinery, network, warp and title, with the title fitting 320px portrait and 667px landscape.

The sizing revision was replayed through all eight scenes with real sound at 1440×900 and compact 320×506, both reaching the original app without page errors. Visual inspection includes the isolated phase-2 view, full title, 667×315 short landscape and the actual Arcade's nested 667×262 intro viewport. Live paused resizing preserves the clock; reduced-motion assembly pixels remain identical across more than 650ms of advancing playback. Browser checks also replayed audio failure to silent fallback, app failure/retry, Skip/Escape, sound/motion toggles, phone/desktop catalog launches and separate normal Sp1der guest navigation.

Additional interactive Chromium checks cover pause/resume, mute, live rotation without a playback-time jump, Skip/Escape, failed audio fallback, failed app load and successful retry, simulated background pause, and a simulated 280px keyboard viewport with restoration. Visible controls remain at least 44px high and within the viewport at 320×568, 375×667, 390×844, 430×932, 667×375, 844×390 and 932×430, with no horizontal document overflow. ffprobe reports exactly 34 seconds; decoded MP3 peak is -1.5 dBFS and mean is -18.9 dBFS. Listening reviews found clear transients, no harsh clipping, a clean ending without abrupt cutoff, and no severe balance problem; mild low-mid density was noted near the final impacts.

The earlier loading-repair QA covers both desktop popups and phone Arcade viewers, normal Sp1der launch separation, catalog search/filter/reset, Back, terms, keyboard warnings and game launches. The extended-intro release must additionally pass the complete Mantle/raw-source beta chain and fresh hosted preview before signoff; these results are recorded in the task's external QA log. No new page errors occurred in the instrumented HTTP extended-intro runs.

Firestore/Auth requests were blocked during browser QA. No accounts were created, no messages were sent and no production data/settings were changed. Physical iPhone/Safari behavior, live authentication and a production hosting redeployment are not verified by these tests.
