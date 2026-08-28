# Birds My Boss V1 Production Release Runbook

Target project: `birdsmyboss-v1-prod` (`Birds My Boss V1 Production`). Every Production deploy command must explicitly include `--project birdsmyboss-v1-prod`; `.firebaserc` remains DEV-default to make accidental cross-target deployment less likely.

## A. Reviewed Git source and tag

1. Review the pushed `v1-release-baseline` branch at approved commit `ab4c794a932f23cf19df9ad5398c1667565568b5`.
2. After owner approval, create an immutable release tag (proposed: `v1.0.0`) at the approved commit.
3. Build and deploy only from that tag/commit. Do not deploy from an unreviewed worktree.

## B. Production Firebase provisioning

1. Create the separate Firebase project `birdsmyboss-v1-prod`.
2. Create the default Firestore database and default Storage bucket in that project.
3. Production starts with empty canonical data. DEV fixtures must never be copied, and Legacy migration/backfill is not approved.

## C. Security, Auth, and Secrets

1. Enable Google authentication; do not grant operator rights merely by sign-in.
2. Add the default Hosting domains (and any later approved custom domain) to Firebase Auth authorized domains.
3. Bootstrap the selected Production operator only through `functions/admin/operator-claim-production.mjs`, using explicit `--project birdsmyboss-v1-prod`, `--uid`, and `--confirm SET_OPERATOR_TRUE`. It is never part of deployment.
4. Create a new `BMB_PUBLIC_MEDIA_KEY` from 32 cryptographically random bytes encoded base64url. DEV's secret must never be reused.
5. Apply least-privilege IAM: permit the Firebase Storage service agent to evaluate Firestore Rules for `assetIntakes`; permit the Functions runtime only the private object metadata/read access needed for finalize and opaque public media streaming.

## D. Rules, Functions, and Hosting deployment

1. Deploy committed Firestore Rules and indexes explicitly to Production.
2. Deploy committed Storage Rules explicitly to Production; Storage remains private/default-deny except approved operator intake creates.
3. Deploy Functions explicitly to Production. Bind `BMB_PUBLIC_MEDIA_KEY` only to `getBirdPassport` and `servePublicPhoto`.
4. Build `web/dist` with the six public Production Firebase client values from `web/.env.example`; `VITE_USE_FIREBASE_EMULATORS` must be absent or not `true`.
5. Deploy Hosting explicitly to Production. Preserve the SPA rewrite and `/public-media/v1/**` rewrite to `servePublicPhoto`.
6. Verify the expected 68 Functions, including public `getBirdPassport` and `servePublicPhoto`; all remaining callables require `operator=true`.

## E. Production smoke test

1. Use only clearly synthetic identifiers beginning `PROD-SMOKE-`.
2. Verify operator sign-in/authorization, Bird create/detail trusted reads and writes, Photo intake/finalization, Passport publication, opaque public Photo delivery, and a minimal synthetic commercial workflow.
3. Do not add a deletion feature for smoke testing. Synthetic records may remain as clearly marked historical records; disable Passport/archive assets and cancel non-final workflows where the existing lifecycle allows.

## F. Rollback reference and final approval

1. Keep the prior reviewed release tag and its build/deployment artefacts as the rollback reference.
2. Roll back Hosting, Functions, and Rules only by deploying the prior reviewed source/artifact explicitly to Production; do not rewrite history or data.
3. Obtain final owner approval after Production smoke evidence and Function inventory verification.
