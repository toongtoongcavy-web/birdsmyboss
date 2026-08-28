# Farm System V1 — Canonical Data Model

## Scope and conventions

This specification defines a new canonical Firestore model for Farm System V1. It does not import, transform, or rely on legacy Firebase data. All timestamps use Firestore `Timestamp`; business dates use an ISO-8601 `YYYY-MM-DD` string. Every document includes `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, and (where applicable) `archivedAt`/`archivedBy` for auditability. Trusted operator writes derive `createdBy`/`updatedBy` from callable authentication context, never caller input.

### Private implementation support: `assetIntakes`

`assetIntakes` is private operational state for server-authorized Bird asset intake/finalization. It is not one of the 21 canonical business collections, is not a canonical business data source, is not directly client-accessible, and is never public Passport data.

The document IDs named below are generated UUIDs unless a rule states otherwise. **V1 references are canonical string document IDs, not Firestore `DocumentReference` values.** The trusted write path must validate the referenced document's existence, entity type, and permitted relationship before accepting a reference. A collection must not mix reference conventions without an explicitly approved architecture revision. A field marked immutable may only be set at creation; corrections require an auditable replacement/correction flow, not an in-place rewrite.

## Ring ID normalization policy — V1

Before validation or storage, `ringId` is normalized by trimming leading and trailing whitespace and converting alphabetic characters to uppercase using one locale-independent system policy. The normalized value is the canonical stored value and is the value used for uniqueness checks. `ringId` remains immutable after creation and uniqueness includes every bird state, including archived, deceased, and sold birds.

Normalization must not infer, remove, add, or rearrange internal characters. Therefore `GC-001 = gc-001`, while `GC-001 ≠ GC 001` and `GC-001 ≠ GC001`.

## Canonical breeding chain

```text
PAIR → PAIR_MEMBER
PAIR → CAGE_ASSIGNMENT → CAGE
PAIR → BREEDING_CYCLE → EGG → 0..1 BIRD
```

`BIRD.eggId` is the source of truth for a farm-hatched bird. Parentage is derived at read time from `BIRD.eggId → EGG.cycleId → BREEDING_CYCLE.pairId → PAIR_MEMBER`. `BIRD.fatherId` and `BIRD.motherId` are deliberately not canonical fields. A handover may contain a read-only parentage snapshot because it is a historical transaction.

## Collections and entities

| Entity | Collection | Document ID | Source of truth / key relationships |
|---|---|---|---|
| CAGE | `cages` | `cageId` | Physical cage; referenced by `cageAssignments.cageId` |
| PAIR | `pairs` | `pairId` | Pair lifecycle; members live in `pairMembers` |
| PAIR_MEMBER | `pairMembers` | `pairMemberId` | Immutable role-to-bird membership: `pairId`, `birdId`, `role` |
| CAGE_ASSIGNMENT | `cageAssignments` | `cageAssignmentId` | Time interval joining one pair and one cage |
| BREEDING_CYCLE | `breedingCycles` | `breedingCycleId` | Belongs to a pair |
| EGG | `eggs` | `eggId` | Belongs to a breeding cycle; may produce one bird |
| BIRD | `birds` | `birdId` | Individual bird; `eggId` is immutable when farm-hatched |
| PHOTO | `photos` | `photoId` | Metadata pointing to a storage object; belongs to one supported owner |
| WEIGHT_HISTORY | `weightHistory` | `weightEntryId` | A dated measurement for one bird |
| SEX_HISTORY | `sexHistory` | `sexHistoryId` | An evidentiary sex determination for one bird |
| DOCUMENT | `documents` | `documentId` | Metadata for a document belonging to one supported owner |
| PRICE_HISTORY | `priceHistory` | `priceHistoryId` | Effective-dated price record for one bird |
| CUSTOMER | `customers` | `customerId` | Customer identity, referenced by commercial records |
| SALE | `sales` | `saleId` | Sale lifecycle for one bird and one customer |
| RESERVATION | `reservations` | `reservationId` | Reservation lifecycle, independent from sale lifecycle |
| PAYMENT | `payments` | `paymentId` | Financial receipt tied to exactly one sale or reservation |
| REFUND | `refunds` | `refundId` | Refund against one payment |
| GIVEAWAY | `giveaways` | `giveawayId` | Non-sale transfer of a bird |
| DELIVERY | `deliveries` | `deliveryId` | Fulfilment/shipping for one completed sale |
| HANDOVER | `handovers` | `handoverId` | Actual custody transfer; may snapshot parentage |
| SALE_TIMELINE | `saleTimeline` | `saleTimelineId` | Immutable chronological event for one sale |

## Entity fields

### CAGE (`cages`)

Required: `code` (string, immutable, unique), `name` (string), `status` (`active|inactive|maintenance`). Optional: `location`, `notes`, `capacity`. No assignment state is stored on the cage; `cageAssignments` is authoritative for occupancy. A cage cannot have overlapping active assignment intervals.

### PAIR (`pairs`)

Required: `status` (`draft|active|inactive|retired`), `startedOn` (date). Optional: `endedOn`, `name`, `notes`. Pair membership is not stored as `maleId`/`femaleId`; `pairMembers` is authoritative. `startedOn` is immutable. A pair cannot be active without exactly one male and one female active member.

### PAIR_MEMBER (`pairMembers`)

Required immutable fields: `pairId` (reference), `birdId` (reference), `role` (`male|female`), `effectiveFrom` (date). Optional: `effectiveTo`, `endedReason`. An active pair has exactly two active members, one per role; a bird may not be an active member of more than one active pair at a time.

### CAGE_ASSIGNMENT (`cageAssignments`)

Required immutable fields: `pairId` (reference), `cageId` (reference), `startsOn` (date). Optional: `endsOn`, `endedReason`, `notes`. An assignment is open when `endsOn` is absent. No two assignments may overlap for the same cage or the same pair.

### BREEDING_CYCLE (`breedingCycles`)

Required immutable fields: `pairId` (reference), `startedOn` (date). Required mutable field: `status` (`planned|active|closed|cancelled`). Optional: `code`, `endedOn`, `notes`. It belongs to the pair named at creation even if that pair later becomes inactive. The pair must have valid members at `startedOn`.

### EGG (`eggs`)

Required immutable fields: `cycleId` (reference), `sequenceNo` (positive integer), `laidOn` (date). Required mutable field: `status` (`laid|fertile|infertile|hatched|lost|discarded`). Optional: `candledOn`, `expectedHatchOn`, `notes`. `(cycleId, sequenceNo)` is unique. A hatched egg is linked to at most one `birds` document by `birds.eggId`.

### BIRD (`birds`)

Required immutable fields: `ringId` (string, globally unique after V1 normalization), `origin` (`farm_hatched|purchased|external|rescued|unknown`). Optional immutable field: `eggId` (reference, required when `origin=farm_hatched`). Required mutable fields: `status` (`active|reserved|sold|given_away|deceased|retired`), `displayName`, `passportStatus` (`draft|published|disabled`). Optional: `species`, `mutation`, `hatchedOn`, `acquiredOn`, `notes`, `publicToken`. Parentage is never entered here; derive it from the breeding chain. `publicToken` is server-generated, cryptographically random (at least 128 bits), unique, non-sequential, and non-predictable; rotation invalidates the prior token.

### PHOTO (`photos`)

Required immutable fields: `ownerType` (`BIRD|PAIR|CUSTOMER|SALE|RESERVATION|DELIVERY|HANDOVER`), `ownerId` (reference), `storagePath` (string), and `managedStorage` for newly finalized Bird assets. Required mutable fields: `status` (`active|archived`), `isPublicOnPassport` (boolean, default `false`). New Bird Photos are created only through verified server-controlled Storage intake as `active`; `archived` is terminal and retains the object. Optional: `caption`, `takenOn`, `sortOrder`, `contentType`, `checksum`. The public resolver issues a bounded opaque BMB media URL only for an active `BIRD`-owned record for the target bird with `managedStorage=true` and `isPublicOnPassport=true`; it returns only `publicUrl`, `caption`, and `sortOrder`. The opaque URL contains no Storage bucket/object path, canonical ID, or Passport token; the trusted media endpoint re-checks eligibility and streams private Storage bytes with no-store caching.

### WEIGHT_HISTORY (`weightHistory`)

Required immutable fields: `birdId` (reference), `measuredOn` (date), `weightGrams` (positive number), `recordedAt` (timestamp). Optional immutable fields: `notes`, `source`. Entries are append-only; corrected readings are represented by a new entry with correction metadata.

### SEX_HISTORY (`sexHistory`)

Required immutable fields: `birdId` (reference), `sex` (`male|female|unknown`), `determinedOn` (date), `method` (`dna|sex_linked|visual|unknown`). Optional immutable fields: `evidenceDocumentId`, `notes`. The current displayed sex is derived from the latest valid history entry, not a freely editable bird field. Historical records written with the former `vet` method remain immutable and readable, but new writes use the current closed enum.

### DOCUMENT (`documents`)

Required immutable fields: `ownerType` (`BIRD|PAIR|CUSTOMER|SALE|RESERVATION|DELIVERY|HANDOVER`), `ownerId`, `documentType`, `storagePath`, `issuedOn`, and `managedStorage` for newly finalized Bird assets. Required mutable fields: `status` (`active|archived|superseded`), `isPublicOnPassport` (boolean, default `false`). New Bird Documents finalize only as `active`. An active Document may become `archived`, or may become `superseded` only in the transaction that links immutable `supersededByDocumentId` to a newly finalized active replacement owned by the same Bird. Both terminal states retain their physical objects. Optional: `expiresOn`, `documentNumber`, `checksum`, `notes`. Passport may return only active `BIRD`-owned records for the target bird with `isPublicOnPassport=true`, and only approved `documentType`, `issuedOn`, and `documentNumber` when present; Documents remain metadata-only publicly.

### PRICE_HISTORY (`priceHistory`)

Required immutable fields: `birdId`, `amount` (finite non-negative decimal), `currency` (`THB` in V1), `effectiveOn` (date), `kind` (`list|offer|final`). Optional immutable fields: `notes`, `validUntil`. It is append-only informational/operator pricing history. Entries may overlap and are never automatically selected, inherited, or propagated into a Reservation or Sale snapshot; it does not replace a completed sale price.

### CUSTOMER (`customers`)

Required: `displayName`. Optional: `phone`, `email`, `address`, `notes`, `status` (`active|archived`). Contact fields may be corrected; completed transaction snapshots preserve historical customer details where required.

### RESERVATION (`reservations`)

Required immutable fields: `birdId`, `customerId`, `reservedOn`; when present, `agreedPrice` and `currency`. Required mutable field: `status` (`active|completed|cancelled|expired`). Optional: `expiresOn`, paired `agreedPrice`/`currency`, `notes`, `cancelReason`. An agreement snapshot is either absent or a finite decimal `agreedPrice > 0` with `currency=THB`; a partial pair is invalid. Missing price does not mean zero or free. A reservation is separate from a sale and Price History is never consulted automatically. At most one active reservation is allowed per bird. Deposit receipts are `payments` with `reservationId`. On Reservation-to-Sale conversion, the trusted transaction copies an existing pair exactly; if absent, the Sale also has no pair. Changing a reservation status never deletes its payments. When a reservation is cancelled or expired, the operator chooses full refund, partial refund, or no refund; partial refund requires an actual amount, reason, and transaction date. There is no automatic refund policy based on cancellation reason.

### SALE (`sales`)

Required immutable fields: `birdId`, `customerId`, `createdOn`; when present, `agreedPrice` and `currency`. Required mutable field: `status` (`draft|confirmed|completed|cancelled`). Optional: `reservationId`, `completedOn`, paired `agreedPrice`/`currency`, `notes`, `cancelReason`. A direct Sale may record an explicit finite decimal `agreedPrice > 0` with `currency=THB`, or omit both; it never inherits Price History. A conversion from a Reservation copies its pair exactly and rejects caller repricing. Snapshots never synchronize with later Price History. Only one completed sale is allowed per bird. A completed sale is never hard-deleted or reassigned to another bird.

### PAYMENT (`payments`)

Required immutable fields: `amount` (positive number), `currency`, `receivedOn`, `paymentMethod`, `status` (`received|voided`). Exactly one of `saleId` or `reservationId` is required. Optional: `referenceNo`, `notes`, `customerId`. Deposit is identified by `reservationId` and `purpose=deposit`; it is not a reservation field.

### REFUND (`refunds`)

Required immutable fields: `paymentId`, `amount` (non-negative number), `refundedOn`, `outcome` (`full_refund|partial_refund|no_refund`), `reason`. Optional: `notes`. A `no_refund` decision has `amount=0`; `full_refund` equals the remaining refundable payment amount; `partial_refund` requires an actual amount greater than zero and less than the remaining refundable amount. Total refunds for one payment cannot exceed that payment's received amount.

### GIVEAWAY (`giveaways`)

Required immutable fields: `birdId`, `recipientName`, `givenOn`. Required mutable field: `status` (`planned|completed|cancelled`). Optional: `customerId`, `notes`, `handoverId`. `customerId` is an optional internal relationship only; it never substitutes for the immutable `handovers.recipientSnapshot`. Completing a Giveaway records agreement completion, not physical custody transfer: Bird.status remains unchanged until Handover, but the completed Giveaway blocks new conflicting Sale/Giveaway workflows. One completed `sourceType=giveaway` Handover records the actual recipient snapshot and transactionally changes `birds.status` to `given_away`. A completed giveaway cannot coexist with a completed sale for the same bird.

### DELIVERY (`deliveries`)

Required immutable fields: `saleId` (a completed Sale), `distanceKm`, `freeDistanceKm`, `pricePerKm`, system-derived `shippingFee`, `currency`, `createdOn`. Required mutable field: `status` (`planned|in_transit|delivered|cancelled`). Optional: `deliveredOn`, `addressSnapshot`, `notes`. The three operator-supplied shipping terms and derived fee are per-delivery snapshots and are the only historical shipping source. The trusted write calculates `shippingFee = max(distanceKm - freeDistanceKm, 0) * pricePerKm`; clients cannot override it. V1 does not support Giveaway- or Handover-owned Deliveries.

### HANDOVER (`handovers`)

Required immutable fields: `birdId`, `handoverOn`, `recipientSnapshot`, `sourceType` (`sale|giveaway|other`). `recipientSnapshot` contains exactly required non-empty `name` plus optional string `phone` and `address`; it is immutable historical data and is not re-derived from Customer changes. Required mutable field: `status` (`planned|completed|cancelled`). Optional immutable fields: `saleId`, `giveawayId`, `deliveryId`, `parentageSnapshot`, `notes`. V1 supports completed Handovers only from a completed matching Sale or Giveaway; a source may have at most one completed Handover. `sourceType=sale` transactionally changes the Bird to `sold`; `sourceType=giveaway` transactionally changes it to `given_away`. `parentageSnapshot` is permitted only as a historical rendering snapshot; it does not override the canonical breeding chain.

### SALE_TIMELINE (`saleTimeline`)

Required immutable fields: `saleId`, `eventType`, `occurredAt`, `actorId`. Optional immutable fields: `payload`, `note`. This is append-only. It records lifecycle events and must not be the source of truth for sale status; `sales.status` remains canonical. Operator visibility is Sale-detail-only, chronological, and read-only, using safe event/timestamp DTO fields.

`SALE_TIMELINE` belongs only to an existing sale: `saleId` remains required. Reservation-only creation, reservation-linked deposit payments, and reservation-linked refunds do not create timeline entries. When a sale is created from a reservation, the immutable sale record retains `reservationId` and the `sale_created` timeline payload may include that ID; no earlier reservation/payment events are backfilled.

## Passport public view and redaction

Passport is a computed view, not a collection and not a duplicate entity. A public request resolves a unique `birds.publicToken` and reads permitted canonical bird data plus derived parentage. It may use an immutable historical `parentageSnapshot` from a handover only for historical rendering.

Public V1 fields are: bird photo, `ringId`, mutation, birth/hatch date, sex when available, origin, safe derived parentage information, handover date, and `passportStatus`. Public Passport must not disclose customer contact information, customer address, payment information, internal notes, internal operational information, or unauthorized transaction/price information. A `publicToken` must never bypass those redactions. No implementation may infer publication permission from mere document/photo ownership.

The canonical public V1 route is `/passport/<publicToken>`. It requires no login and resolves only through the trusted public Passport callable. QR codes are generated locally and encode only the full canonical public Passport URL. Token rotation invalidates the previous route; only `published` Passport data resolves.
