# Legacy Audit Findings — Farm System V1

This document records the findings from the read-only audit of branch `farm-system-v1-build`. It is not a data migration plan and legacy Firebase data is not a V1 source of truth.

| Legacy behavior found | Risk | V1 decision |
|---|---|---|
| A single `index.html` contains all UI, Firebase access, and domain logic. | No isolated domain layer or trusted cross-document validation. | Keep V1 specification independent; implement canonical write paths separately. |
| Main app writes Firestore collections `birds`, `pairs`, `breedingCycles`, `eggs`, `chicks`, `weights`, `sales`, `income`, `expenses`. | `chicks` duplicates lifecycle concepts and creates an unclear boundary with `birds`. | Do not create `chicks` in V1. Hatch creates `BIRD` with immutable `eggId`. |
| Pair records store `maleId`/`femaleId`; display also tolerates legacy `maleBirdId`/`femaleBirdId`. | Mixed field names can bypass conflict checks and corrupt active assignments. | Use `PAIR_MEMBER` exclusively; role and temporal validity are explicit. |
| Pair creation prevents a duplicate active pair only in browser state. | Concurrent clients or legacy field names can produce conflicting pair assignments. | Enforce active-member and cage interval invariants on trusted transactional writes. |
| Pair UI does not validate each selected bird's sex or kinship. | Same-sex, self/close-relative, or unsupported pair assignments are possible. | Derive sex from `SEX_HISTORY`; resolve pedigree only through `BIRD → EGG → BREEDING_CYCLE → PAIR → PAIR_MEMBER`. Policy C blocks parent×offspring and sibling×sibling, warns on other detectable kinship, and reports insufficient pedigree as unknown without inference. |
| Birds allow editable `fatherId` and `motherId`. | Manual parentage can contradict pair/cycle/egg lineage. | Do not store canonical father/mother IDs on `BIRD`; derive parentage from breeding chain. |
| A chick copies `fatherId`/`motherId` from current pair lookup when created. | The copied data can disagree with later chain data and has no immutable provenance guarantee. | `BIRD.eggId` alone is canonical for farm-hatched lineage; handover may snapshot displayed parentage. |
| The same fertile egg can be selected to create multiple chicks. | One egg can incorrectly yield multiple offspring records. | Enforce `EGG → 0..1 BIRD` atomically. |
| Egg number and chick code are generated from loaded client state. | Concurrent creation can produce duplicates. | Use transactional uniqueness for `(cycleId, sequenceNo)` and `ringId`; code policy is not canonical unless separately specified. |
| `weights` stores bird weights under `birdId` and chick weights under `chickId`. | Split history and inconsistent views. | Use one append-only `WEIGHT_HISTORY` with required `birdId`. |
| Sale flow creates a sale then separately marks the bird sold; payment status is hard-coded as paid. | Partial writes, duplicate sales, and inaccurate payment state are possible. | Separate `SALE`, `PAYMENT`, `RESERVATION`, and `REFUND`; complete a sale atomically and allow at most one completed sale per bird. |
| No reservation or deposit entity is present. | Reservation/payment state cannot be audited or refunded correctly. | Reservation is independent; deposit is a `PAYMENT` linked to `RESERVATION`. |
| No refund model is present. | Deposit repayment policy cannot be represented safely. | Use immutable `REFUND` records and enforce total refund ≤ payment amount. |
| No cage assignment model is present. | Pair location and temporal occupancy cannot be proven. | Add `CAGE` and interval-based `CAGE_ASSIGNMENT` with one-to-one overlap constraints. |
| No Passport entity/flow is present. | A future Passport could become duplicate, stale data. | Passport is a computed public-token view from canonical records. |
| Legacy application has no public-field redaction model for Passport. | A public feature could leak customer, payment, note, operational, or unauthorized transaction information. | V1 Passport exposes only the locked public field set and keeps those sensitive categories private by default. |
| Legacy application has no reservation lifecycle or deposit disposition policy. | Cancellation, expiry, refund, forfeiture, and conversion outcomes could be silently invented by implementation. | Preserve reservation-linked payments and payment-linked refunds. On cancellation/expiry, the operator chooses full, partial, or no refund; partial refund needs amount, reason, and transaction date. No automatic refund policy is used. |
| Legacy application has no canonical ring normalization policy. | Visually similar rings can evade client-side uniqueness checks. | V1 trims and uppercases before uniqueness checking; `GC-001 = gc-001`, while `GC-001 ≠ GC 001` and `GC-001 ≠ GC001`. |
| Legacy photo/document ownership model is not defined. | Arbitrary owner types could cause inconsistent metadata relationships. | Photos/documents remain storage metadata. Owner types are restricted to `BIRD`, `PAIR`, `CUSTOMER`, `SALE`, `RESERVATION`, `DELIVERY`, and `HANDOVER`. |
| Legacy writes occur directly from the client. | Client checks can be bypassed and cannot safely serialize cross-document invariants. | V1 uses Cloud Functions as the trusted write layer; implementation is not created in this documentation stage. |
| `tools/firebase-audit.html` reads legacy `birds`, `pairs`, `clutches`, `sales`; main app actually uses `breedingCycles`, not `clutches`. | Audit output can misrepresent current app-shaped data. | Retain only as a legacy diagnostic; do not use it as V1 schema or data authority. |
| Audit tool expects legacy sales fields `price`, `customerName`, `birdRing`; main app writes `amount`, `customer`, `birdId`. | Legacy audit flags may be inaccurate for the app's newer write shape. | V1 schema defines explicit `SALE` and `PAYMENT` fields; no migration is performed in Stage 1. |
| The audit tool can inspect RTDB root while the app itself uses Firestore. | Broad legacy inspection may expose unrelated data if permissions allow it. | Do not run it as a V1 operational dependency; scope any later audit to approved read-only paths. |

## Files deliberately unchanged in Stage 1

- `index.html`
- `tools/firebase-audit.html`
- Firebase configuration and Firebase data

No legacy records were read, migrated, modified, or treated as canonical during this stage.

## Legacy isolation lock

Legacy Firebase data — including legacy `birds`, `pairs`, `chicks`, `sales`, and other historical records — is not V1 canonical data. V1 begins with a clean/test dataset created under the approved V1 model; this is not a migration plan. `tools/firebase-audit.html` remains a legacy diagnostic only: it is not a V1 operational dependency, V1 schema, or V1 source of truth.
