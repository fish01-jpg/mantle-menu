# Sp1der Intro beta

Fishes Arcade's separate **Intro beta** entry opens the same current `sp1der.html` after an optional 34-second cinematic. Normal Project Sp1der and its runners are unchanged. The beta is not an authentication or security check.

## Sequence

- **First signal, 0–4s:** signal sweep, depth grid and orbital construction lines.
- **Assembly, 4–8s:** extruded message, window, folder, cursor, person and envelope models fly into an orbital arrangement.
- **Ignition, 8–12s:** separated geodesic vertices converge, with a deep impact, wide shockwaves and flying fragments.
- **Orbital machinery, 12–16s:** three counter-rotating decks, mechanical vanes, circuit supports and scanning planes align around the core.
- **Connections, 16–20s:** a triangulated 110-node sphere and depth corridor unfold as the interface models pass the camera.
- **Transit, 20–26s:** a hexagonal warp corridor with wall trusses, light packets, more extruded objects, two destination rings and a beat-synced interconnection web linking the travelling objects to one another and to the corridor axis. The moving CONNECT / BUILD / EXPLORE / BELONG text panels are gone; every other corridor effect is unchanged.
- **Discover, 26–29s:** CONNECT / CREATE / BELONG chapter words change on the 26/27/28s accents, with corresponding YOUR PEOPLE / YOUR IDEAS / YOUR SPACE lines, orbiting objects and a three-part indicator. The old tunnel is completely absent.
- **Identity, 29–32s:** six independently projected, extruded letters lock at 29/29.5/30/30.5/31/31.5s, with the full-title impact at 31.5. The tagline resolves by 32.15.
- **Handoff, 32–34s:** one closing accent, a restrained camera advance and fade reveal the already-loading original app. The rhythmic pattern stops before the title finishes; no repeated tail beats are scheduled after it.

Thirteen major impact cues drive expanding triple wavefronts, flying polygon shards and trails, a localized glow, horizontal lens beams and a short camera punch. Pre-hit contraction follows the soundtrack's 900ms risers. Bass kicks and plucks have separate, smaller pulse envelopes; they are no longer approximated by a continuous cosine. Controls and text remain steady. There are no full-screen white impact flashes.

Narrative captions now advance throughout each main phase, including three additional lines during transit. A reserved two-line caption height avoids moving the artwork when the copy changes. The shared timeline supplies all caption boundaries and chapter words; reduced motion uses an unchanging caption and composition inside each phase, with BELONG as its static discover card.

## Scene sizing and separation

Each phase now owns its geometry. The opening starfield, ground grid and orbital schematics end before phase 2; assembly shows only its six interface models and current musical effects, without the old rings or ghost core underneath. Ignition, machinery, network, transit and identity likewise no longer accumulate previous-phase backgrounds. The poster remains a separate composition and the title is intentionally shared across identity/handoff.

`intro/scene-layout.js` fits each scene's primary objects into artwork bounds measured from the actual controls, caption and footer. Short landscape uses a right-hand artwork region alongside the caption; portrait uses the space above it. Scene-specific scale budgets account for object extents and perspective, including the assembly's elliptical shape, while the title fits available width. Short embedded portrait views use tighter caption spacing to retain useful object sizes without reducing touch targets. Artwork is clipped away from controls/copy, and the handoff camera advance is restrained so the title remains legible. Total duration remains 34 seconds; version 4 layers the progressive soundtrack and matching visual energy together, without changing the app-loading controller.

Perspective projection, face fills, front/back edges, independent rotations and depth positioning are calculated locally with Canvas 2D. No Three.js/CDN runtime, video download, Marvel assets or third-party music is required. The restrained cyan/amber spatial artwork is original.

## Sound and controls

`assets/intro/sp1der-intro-beta-v4.mp3` is the real 34-second stereo soundtrack (44.1kHz, 128 kb/s MP3, 545,206 bytes). `scripts/compose-sp1der-intro.cjs` deterministically synthesizes it from oscillators, noise, envelopes and stereo diffusion, then encodes with ffmpeg. No recorded samples are used. The v4 arrangement is progressive: every stage adds another connected layer over the same D-minor-to-D-major harmony, so the score keeps growing fuller and more upbeat toward the title. A warm pad bed enters at assembly, a plucked arpeggio at ignition (an octave up through transit), a driving root-fifth bass line at orbital, an off-beat shaker at network, a sixteenth-note transit drive from warp, a lead melody phrase from resolve that resolves to D major at the title, wide-panned bell sparkle through the title locks and a final D major bloom at handoff. The mastering uses two-pass linear loudness normalization, so the stage-by-stage build-up is preserved instead of compressed away. The last rhythmic tick is at 31.25s, the last title lock at 31.5s and the sole remaining accent at 32s.

`intro/sequence.json` supplies stage boundaries, 120 BPM, impact strengths, narrative readouts, chapter words and the versioned audio path. `intro/timing.js` is imported unchanged by both the composer and the embedded browser renderer: its exact event list schedules sound transients and visual envelopes, including the individual title locks. The versioned filename prevents cached audio from using the previous timing. `assets/intro/sp1der-intro-beta.mp3`, `sp1der-intro-beta-v2.mp3` and `sp1der-intro-beta-v3.mp3` remain available for older downloaded wrappers.

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

The intro regressions cover generation, catalog separation, nine scored phases, exact hit onset/decay, the shared musical grid, risers, six title locks, narrative changes and boundaries, discover words/accents, the short non-rhythmic ending, motion suppression, media clocks, pause/resume, buffering, mute, background pause, skip, failure/retry, timeout and keyboard viewport forwarding. Regressions explicitly prevent handoff at the old 22-second endpoint and ensure phase-2 isolation, exclusive scene ownership, stable reduced-motion layers/captions, fitting across narrow/embedded/desktop viewports, useful compact assembly sizing and clipping away from UI.

All 34 targeted intro tests pass, and the complete suite is 72/74. A separate clean checkout of upstream `89fef71` reproduces the same two failures at 68/70: the phone-bundle-identity and phone-generation checks still expect the former generated phone implementation in `sp1der.html`, whereas upstream now supplies a different mobile implementation. No current application, catalog or mobile implementation was replaced to satisfy an outdated generator check.

Version 3 was replayed naturally with the actual soundtrack at 1440×900, 390×844 and compact 320×506 through the later title and original-app reveal. Visual inspection covers the enriched tunnel, readable panels, discover chapters and late title. Compact playback was paused and rotated into the actual short embedded size, 667×262, for tunnel and discover inspection, then returned to portrait and completed naturally. A 320×568 OS-reduced-motion silent run also reaches the app.

The paused soundtrack clock remains identical across 320×506, 390×844, 667×315, 844×390 and 1280×500 resizing. Controls stay at least 44px high and within the viewport, without horizontal overflow. Motion and sound switches round-trip; changing motion while paused refreshes the narrative caption without moving the clock. Phase 2 retains exclusive assembly geometry, without the opening background.

The reduced-motion discover canvas and caption are identical between natural silent time 26.2 and 28.2 within the same phase, followed by successful Resume and app handoff. Browser checks of blocked audio confirm advancing silent fallback and pause/resume; Escape reveals the app. A deliberate app HTTP 503 exposes Retry, and restoring the source plus pressing Retry reveals the original app.

ffprobe reports exactly 34 seconds; the decoded v3 MP3 peak is -1.5 dBFS and mean is -18.4 dBFS. The audio review found no critical defects and classified its dense sci-fi textures as stylistic, not defective clipping. Because that full-track review was truncated before its ending assessment, a separate complete review of the final six seconds confirmed a clean decay without an abrupt cutoff, audible clipping or unnecessary repeated beats.

Earlier loading-repair and sizing QA covers desktop popups, phone Arcade viewers, normal Sp1der launch separation, catalog search/filter/reset, Back, terms, keyboard warnings, source failures/retry, simulated background pause and keyboard viewport forwarding. Version 3 must additionally pass a fresh hosted Mantle/raw-source launch before signoff; the task's external QA log records this release's final controls, failure/retry and hosted results. No new page errors occurred in the instrumented local v3 playback runs.

Firestore/Auth requests were blocked during browser QA. No accounts were created, no messages were sent and no production data/settings were changed. Physical iPhone/Safari behavior, live authentication and a production hosting redeployment are not verified by these tests.
