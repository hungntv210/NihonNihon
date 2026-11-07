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

While GitHub Actions is billing-locked, run the complete `npm run check`
(typecheck, test, build, test:app) before **every push**, including documentation
pushes. Do not push on failure. Do not add another CI service or a self-hosted runner.

Commit implementation/config changes first, then run the check on that commit.
Append the checked commit SHA, start/end timestamps with timezone, environment,
passed/total test counts, and all four gate results to
`docs/foundation-verification.md`. Commit that audit entry and push. Only this
report entry may change after the successful check; any other change requires
running the complete check again. Never label a different commit as checked.
Keep raw logs/screenshots in gitignored `data/reports/`.

The sole exception to feature route ownership is an **append-only** entry in
`docs/foundation-verification.md`; do not edit prior entries or shared code.
After foundation merge, also run
`node tools/check-route-scope.mjs origin/master <srs|vocab|kanji|grammar>`.

## Remaining foundation and today-roadmap work

The owner explicitly authorized parallel completion of remaining foundation and
`g1/today-roadmap`. Today owns only `src/app/(study)/today-roadmap/`; foundation
owns only the exact shared whitelist in `tools/check-route-scope.mjs`, the settings
route, and font assets. Neither may edit existing feature directories, schema,
G0 tooling, live databases or private data. Run the guard with `foundation` or
`today-roadmap` against the starting `origin/master` commit, before every push.
The full check and append-only verification rules above still apply.
