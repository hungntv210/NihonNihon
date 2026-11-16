# Motion inventory and implementation (PR 1)

The requested skills were read before implementation: emil-design-eng, choreograph,
find-animation-opportunities (read-only inventory), animation-performance and mobile-native.
The owner's explicit 40ms entry stagger and <=200ms pointer SRS swap take precedence
against the skills' preference for no high-frequency motion. No keyboard animation.

## Opportunities / frequency gate

| Location | Before | Purpose | Frequency | Decision |
| --- | --- | --- | --- | --- |
| RoutePresentation | Page pops in | Spatial/state continuity | Often | Native View Transitions 180ms; keyboard native navigation; API unavailable keeps normal routing |
| First corner/day | No orientation | First-run orientation | Once/day/corner | Mascot/name, auto-dismiss520+100ms, tap skips; local Vietnam day persisted |
| First page cards | Scroll reveal | Group arrival | Once/route load | First5 only,160ms plus0/40/80/120ms, no filtering/changing-answer stagger |
| SRS | Answer/card snap | Feedback | 100+/day | Pointer160/180ms; keyboard instant, no delays or server wait added |
| JLPT | Feedback snap | Correct/wrong indication |10/day | Green border +済 stamp180ms; wrong single3px shake180ms; final count600ms |
| Progress | Static bars/counts | State indication | Occasional | Bar transform240ms; counts once600ms, no React state per frame |
| Play/record/toast/nav | Static icons/status | Input feedback | Often | Icons160ms, actual analyser30fps, toast180/120ms, nav indicator180ms |

Rejected: keyboard SRS animations (frequency and input gate); review toast on every
card (100 messages would hinder reading); per-letter Japanese motion (functional
content); stagger after filters or answer updates (repeated interaction); width/height
and color-variable tweens during navigation (layout/paint costs).

## Timeline

| Element | Role | Start | Duration | Properties | Relationship |
| --- | --- | --- | --- | --- | --- |
| Page | Lead | Route commits |180ms|opacity|Native old/new crossfade |
| First corner | Support | First daily visit |<=620ms total|opacity, subtle scale|Together, tappable skip |
| Entry cards | Support |0/40/80/120ms|160ms|opacity, translateY8px|Overlapping wave, cap first5 |
| SRS old/new | Lead | Durable local queue succeeds |180ms both|opacity, translateX16px|Together, old clone inert/out of layout |
| Answer | Support | Reveal |160ms|opacity, translateY4px|No grade delay |
| Stamp/toast | Support | Result |180ms in/120ms out|opacity, transform|Exit shorter, rapid toast replacement safe |
| Counters | Support | Intersection |<=600ms|text only|One time, direct DOM text, no per-frame React |

Page text, inputs, menus and keyboard actions do not move. Reduced motion/settings
off strip positions and retain <=80ms fade; pixel engine remains static. Only
transform/opacity are animated; state border color changes immediately. Hover is
capability-gated; touch targets/zoom remain. Audio stays local: MediaStream source
connects to AnalyserNode with no speaker output or upload, context/RAF cleaned on
stop/unmount;8 bars derive actual bins, reduced uses static bars plus aria value.

Koi:2 large slow residents are decorative and independent of stored review counts;
0–10 smaller fish reflect the real supported due queue. A transition to0 sends only
the small cohort out through the water in3 seconds; reduced mode removes it in the
static frame. Residency never writes or fabricates SRS data.

Browser proof runs100 synthetic cached cards with successful mock transport to
isolate UI/outbox stress. Existing SRS tests still exercise real backend grading.
It checks nominal180ms simultaneous swaps,160ms answers, keyboard no animations,
fade-only reduced/settings, JLPT feedback and positive amplitude from fake mic.
Physical phone touch feel/GPU/battery still require hardware review.
