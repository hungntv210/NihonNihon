# Shadowing · interaction demo

Open `/shadowing` after signing in. This route deliberately ships **one public,
synthetic 9-second canvas video with three quiet tones, no Japanese speech**.
The Japanese/Vietnamese sentences are original test captions, not transcriptions
or learning content. The UI labels this throughout. No TTS, AI, media API,
copyrighted clip, personal recording or private data is committed.

Implemented: full clip playback; choose one of three timed segments; 1/3/5/infinite
segment repeats; 0.5/0.75/1/1.25× playback preserving pitch where the browser
supports it; Japanese/Vietnamese/both/hidden captions; native microphone capture,
stop, replay, download and delete. Captures automatically stop after 60 seconds.
Playing the original pauses replay; recording pauses both. Microphone tracks stop
on completion, errors and React unmount. Replaced/deleted/unmounted blob URLs are
revoked. Permission denial, unsupported APIs and playback errors show feedback.

Recordings live **only in browser memory**. A new take replaces the previous take;
leaving/reloading the route loses it. Download before leaving if needed. Nothing
is uploaded or synced. No recording storage endpoint or database schema change.
Demo activity never writes valid shadowing sessions, progress, weekly quotas or
roadmap unlocks. This does not satisfy the full v1 specification yet.

## Verification

From the repository root, Node 24+, existing dependencies:

```powershell
npm run check
node ../ci-scope-g1/tools/check-route-scope.mjs origin/master g1/shadowing
node --import tsx 'src/app/(study)/shadowing/browser-check.ts'
```

The temporary sibling scope guard contains the expanded route registry; do not
copy its shared files into this feature branch. Once that registry merges, use
the repository's own guard. Commit implementation first, run the full gates on
that commit, then append the exact SHA and results to the verification log.

The browser check starts an isolated production server and demo database, checks
auth and byte ranges, playback/segment repeats, rate/subtitles, native fake-device
recording/replay/download, permission rejection, track cleanup and blob revocation,
and desktop/mobile overflow. Windows uses installed Chrome or `CHROME_PATH`,
otherwise Playwright Chromium. Reports/screenshots stay in ignored `data/reports`.
Fake-device desktop coverage does not establish real Android/iOS compatibility.

Regenerate the synthetic fixture intentionally with:

```powershell
node --import tsx 'src/app/(study)/shadowing/generate-demo.ts'
```

This uses local Chrome canvas capture + oscillator tones; it calls no external
service. Commit the resulting `demo.webm` only after running the checks again.
The authenticated media handler supports byte-range seeking, never public cache.

## Next content and host handoff

The chosen host is the owner's home machine with **Tailscale Serve HTTPS**. Expose
the existing authenticated app only within the owner's tailnet. Microphone access
requires a secure context; plain LAN HTTP is insufficient. Localhost is allowed
for development. Confirm the final HTTPS origin in `APP_ORIGIN`, browser microphone
permission and PWA behavior on physical Chrome Android and Safari iOS. This branch
does not claim that host deployment, DNS/Tailscale configuration or hardware tests
have happened.

Keep a backup **off the host machine** and verify restore. The foundation backup
already includes its configured private recordings directory; this route's
in-memory takes are not in that archive. Downloaded takes need a private backup
if the owner chooses to retain them. Neither downloads nor archives go in git.

Next acceptance requires three owner-provided/legal sources: one Erin clip, one
personal file and one YouTube clip. No sources were supplied for this demo. Keep
private media on the authenticated home server, outside git. YouTube is **embed
URL + start/end times only, never download/extract audio**. Source onboarding,
private server media/recording persistence, clip editing, Whisper, TTS, word lookup,
SRS integration, A–B editing, pause-to-speak, keyboard shortcuts, pitch/scoring and
the four-condition valid-session counter are deferred. They need separate scoped
work and real media; do not report this demo as three real clips or completed study.
