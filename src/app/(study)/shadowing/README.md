# Shadowing · private clips and interaction demo

Open `/shadowing` after signing in. The route ships **one public,
synthetic 9-second canvas video with three quiet tones, no Japanese speech**.
The Japanese/Vietnamese sentences are original test captions, not transcriptions
or learning content. The UI labels this throughout. No TTS, remote AI,
copyrighted clip, personal recording or private data is committed.

Implemented: full clip playback; choose one of three timed segments; 1/3/5/infinite
segment repeats; 0.5/0.75/1/1.25× playback preserving pitch where the browser
supports it; Japanese/Vietnamese/both/hidden captions; native microphone capture,
stop, replay, download and delete. Captures automatically stop after 60 seconds.
Playing the original pauses replay; recording pauses both. Microphone tracks stop
on completion, errors and React unmount. Replaced/deleted/unmounted blob URLs are
revoked. Permission denial, unsupported APIs and playback errors show feedback.

Recordings live **only in browser memory, separately for each sentence**. A new take replaces the previous take for that sentence;
leaving/reloading the route loses it. Download before leaving if needed. Nothing
is uploaded or synced. No recording storage endpoint or database schema change.
Demo activity never writes valid shadowing sessions, progress, weekly quotas or
roadmap unlocks. This does not satisfy the full v1 specification yet.

## Verification

From the repository root, Node 24+, existing dependencies:

```powershell
npm run check
node tools/check-route-scope.mjs origin/master shadowing
npm run test:browser
node --import tsx 'src/app/(study)/shadowing/browser-check.ts'
```

Use the repository's authoritative scope registry. Commit implementation first, run the full gates on
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

Acceptance requires three owner-provided/legal sources: one Erin clip, one
personal file and one YouTube clip. This change supports the first local-file clip. Keep
private media on the authenticated home server, outside git. YouTube is **embed
URL + start/end times only, never download/extract audio**. Source onboarding,
private recording persistence, clip editing, TTS, word lookup,
SRS integration, A–B editing, pause-to-speak, keyboard shortcuts, pitch/scoring and
the four-condition valid-session counter are deferred. They need separate scoped
work and real media; do not report this demo as three real clips or completed study.

## Private file onboarding

Import into the app's own `demo.sqlite`, using the G0 importer described in
`docs/data/importer.md` section 4 on `g0/data-import`. Do not write to the Frozen
snapshot. Use source `user-media`, `usage_scope=private_only`, `origin.kind=file`,
the file's SHA-256, attribution and license. Every revision keeps its original
immutable clip manifest; each segment may additionally store `kana` and `speaker`.
Keep IDs stable across timing revisions. Timings must be integer milliseconds,
ordered, non-overlapping, end > start, and within the original file duration.
Use absolute file paths or paths relative to the clips JSON. Keep the media,
manifest, scripts, SRTs, comparison reports and databases outside git and public/.

The authenticated page lists imported active private clips beside the demo.
The server reads metadata only; client props never contain filesystem paths.
The media handler validates the file SHA-256 before serving authenticated ranges;
an optional `NIHON_SHADOWING_MEDIA_ROOT` confines files to a chosen local directory.
Wrong hashes, missing files and non-clip IDs cannot be served. Nothing is copied
to public/ or sent to remote AI. Playback is bounded to the six selected sentences,
while byte ranges refer to the original file. Kana and speaker labels come from
the official script. Missing Vietnamese captions show an explicit empty state.
Sentence timing proposals remain pending tester review.

Set `NIHON_DB_PATH` to the private app `demo.sqlite`, reuse normal login settings,
then run `npm start -- --port 3000` and open `http://localhost:3000/shadowing`.
The real private clip is intentionally absent from CI: `private-fixture.ts` uses
the public synthetic WebM and six invented captions to verify the same DB/media
path, ranges, kana/speakers, sentence highlighting, speed and separate recordings.
