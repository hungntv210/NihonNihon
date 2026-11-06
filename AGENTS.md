# G1 working contract

This PR is the foundation only. Do not start feature implementations in parallel
until `g1/foundation` has merged into `master` and the owner has tested the frame.

After that merge, update each feature branch from the merged `origin/master`.
Use separate worktrees. Each branch may change only its route directory:

| Branch | Owned directory |
| --- | --- |
| g1/srs | `src/app/(study)/srs/` |
| g1/vocab | `src/app/(study)/vocab/` |
| g1/kanji | `src/app/(study)/kanji/` |
| g1/grammar | `src/app/(study)/grammar/` |

Keep route-specific components, handlers, server functions, styles and tests under
that directory. Root `npm test` also discovers route-local `*.test.ts(x)` files.
Shared contracts are described in `docs/foundation-contracts.md`. Reuse those
contracts rather than editing shared layout/auth/fonts/tokens/package files.
Report a missing shared contract for a separate foundation change.

Do not edit schema, add migrations, or create/alter tables. Do not change G0
importer files, its live database, quotas, result files, or environment. G1 uses
its own demo database by default; use a snapshot for integration with G0.
Commit only the public OpenJLPT fixture, never private dictionaries, live databases,
translation outputs, environment files, access credentials, or test reports.

Run `npm run check` before a PR. After foundation merge, also run
`node tools/check-route-scope.mjs origin/master <srs|vocab|kanji|grammar>`.
