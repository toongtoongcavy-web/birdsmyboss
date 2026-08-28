# Birds My Boss Design System v1.0

Status: **BMB Visual Masters #1–#8 — frozen**. The approved Bird Profile is the reference implementation. This document governs presentation; it never overrides canonical data, permissions, trusted reads, routes, or business rules.

## 1. Brand philosophy

BMB communicates **care, identity, trust, provenance, and control**. Emotional screens should make every bird feel like an individual with a story; operational screens should make repetitive farm work fast and dependable. The product must not resemble a generic admin template or a pet-shop interface.

## 2. Core palette and meaning

| Token | Value | Meaning and intended use |
|---|---:|---|
| `--bmb-green` | `#2E7D6E` | BMB authority, structural anchors, primary actions |
| `--bmb-turquoise` | `#5BAA9D` | Connections, information flow, secondary interaction |
| `--bmb-mint` | `#8BC4B8` | Trust, verified and selected surfaces |
| `--bmb-orange` | `#F4A261` | Bird identity through the Orange Ring; never a generic CTA |
| `--bmb-gold` | `#E9C46A` | Provenance, hatch milestones, authentication |
| `--bmb-cream` | `#FAF7F2` | Warm product canvas |
| `--bmb-white` | `#FFFFFF` | Clarity and primary surfaces |
| `--bmb-beige` | `#F0E8DC` | Lineage, history and supporting context |
| `--bmb-gray` | `#7A7A7A` | Supporting text only when contrast remains sufficient |

Use color to explain meaning, not to decorate. Never use every brand color in one component.

## 3. Orange Ring Identity

`OrangeRing` is the canonical bird-identity mark. Variants are `compact`, `standard`, `inline`, and `selected`. It links a physical leg ring to a digital identity and should accompany a human-readable Ring ID where context permits. It is reserved for birds and bird references—not alerts, generic buttons, or ornamental bullets. Technical UUIDs remain internal.

## 4. Typography

Hierarchy: product eyebrow → page title → subtitle → hero identity name → section number/eyebrow/title → object title → important value → body → supporting text → metadata → micro label. Bird names and Ring IDs receive deliberate prominence. Use the existing local font stack; do not add fragile external font dependencies.

## 5. Spacing

Use `--bmb-space-xs/sm/md/lg/xl/2xl/3xl` (`4/8/12/16/24/32/48px`). Page gutters are 16px on mobile and up to 56px on desktop. Prefer section spacing and alignment over adding containers. Touch controls remain at least 42px where interactive.

## 6. Shapes, borders, and depth

Use the `10/16/24px` radius scale plus pill radius. Beige is the neutral border; Mint is a trust/selection border. Use subtle shadow for separation and elevated shadow only for a genuinely selected or important object. Depth communicates hierarchy; it is not decoration.

## 7. Surface hierarchy — not everything is a card

Choose the presentation mode that matches the information:

1. Identity hero for a primary entity.
2. Editorial section for narrative grouping.
3. Timeline/story for trusted chronological records.
4. Structured row for registries.
5. Data group for related values.
6. Lineage relationship for ancestry.
7. Trust-document surface for Passport/provenance.
8. Form surface for data entry.
9. Action area for workflow transitions.
10. Metric surface for concise summaries.

Do not nest white cards by default. Whitespace, dividers, typography, and background shifts are preferred.

## 8. Status and trust

Canonical status values never change for presentation. Map them to success, warning, danger, neutral, informational, or trusted tones. Every status must include readable text; color is supplementary. `TrustMarker` uses Mint/Green plus a visible label.

## 9. Provenance and lifecycle

`ProvenanceMarker` uses Gold with readable text. `LifecycleEvent` supports hatch (Gold), sex confirmation (Turquoise), weight (Green), and neutral. Components present trusted records only and never infer or invent events. The aim is a farm story, not a technical audit dump.

## 10. Lineage

The canonical visual relationship is Parent — Bird — Parent. Parents use Soft Beige, the selected bird uses a Mint-tinted elevated surface, connectors use Turquoise, and the selected identity uses one Orange Ring. `LineageNode` provides parent and bird roles. Preserve human identifiers and conceal UUIDs.

## 11. Passport trust surface

Passport combines Green authority, Mint verification, Gold authentication, and Cream/Beige document warmth. It is important but secondary to the bird. Never expose tokens, internal asset metadata, customer/payment information, or UUIDs through decorative presentation.

## 12. Actions

- Primary: Deep Conure Green; the main safe action.
- Secondary: White or supporting surface with Green border/text.
- Tertiary/quiet: low visual weight for optional actions.
- Danger: explicit danger semantics and confirmation where required.
- Back/navigation: clearly directional, not presented as a destructive action.

Orange is not a default action color. Styling must never change workflow behavior.

## 13. Forms

Operational forms prioritize labels, predictable field order, validation proximity, help text, required state, and disabled state. Group fields only when the group has operational meaning. Decoration stays restrained. Preserve canonical inputs and date conversion behavior.

## 14. Registries

Rows read **identity → important attributes → status → action**. Desktop uses structured horizontal scanning; tablet groups related attributes; mobile presents a compact entity summary rather than stacking every desktop column. Bird registries may use one Orange Ring beside the Ring ID. Never display UUIDs as operator identifiers.

The canonical flock registry pattern uses a shared editorial axis rather than detached cards. Each item combines sequence rhythm, one Orange Ring, Bird name, Ring ID, essential attributes, readable status, and one consistently aligned open action. Search states the already-supported fields explicitly. Creation and recording surfaces follow the collection instead of competing with it.

`Flock Index` is the restrained count of Bird identities represented by the current registry result. A thin Turquoise axis may continue through the presentation sequence and Orange Ring rhythm to organize the collection. It is not a KPI, ranking, relationship, or analytic signal; sequence numbers remain neutral presentation order only.

### Pair Relationship and Breeding Thread

`PairRelationship` preserves two distinct Orange Ring Bird identities while Turquoise expresses their canonical Pair relationship. It exists to avoid presenting a Pair as two unrelated cards or merging the Birds into one identity. Text roles, names, and Ring IDs remain authoritative even when the connection line is absent.

When a parent role already says Father or Mother, do not immediately repeat the equivalent Sex value. Sex remains canonical and belongs where biological identity, filtering, or validation requires it. Use trusted mutation, origin, or parentage metadata as supporting context only when the active read model supplies it; otherwise preserve clean whitespace rather than inventing a replacement.

The Breeding Thread is an editorial progression from Pair context to Cycle chapters and Egg milestones. Turquoise communicates relationship and flow; Gold is reserved for recorded Egg or hatch provenance. It must follow trusted records and must never imply fertility, compatibility, prediction, or biological relationships not present in the read model.

### Commercial Passage

The Commercial Passage presents a truthful relationship between Customer, Bird, and an existing Sale or Reservation record. Customer uses a restrained typographic identity with Mint structure; it never receives an Orange Ring. A genuine Bird reference retains its Orange Ring, name, and Ring ID. Turquoise may connect parties only inside one canonical commercial record.

Money is an editorial record, not an analytics signal. Show stored Payment, Refund, or Delivery amounts with their canonical currency and status; do not derive sale balances, progress, revenue, or payment health when the trusted read model does not define them. Delivery and Handover remain optional related records and must not be rendered as guaranteed workflow stages.

`Commercial Ledger` is the record-first presentation for trusted Payments and Refund activity. Amount and currency lead each row; date, method, and canonical status remain supporting metadata. Use aligned typography, whitespace, and dividers instead of nested cards. Counts must say “Payment records” or “รายการชำระเงิน”—never imply paid, settled, or complete unless a canonical contract proves it.

Reservation is a distinct secondary commercial relationship, not a mandatory stage before Sale. It may share Customer and Bird identity grammar with the Commercial Passage, while its reserved date, optional expiry, and status remain specific to the Reservation. Never imply Reservation → Sale progression or conversion through connectors, numbering, or milestone language.

### Customer identity and the Relationship Ledger

Customers use the Trusted Keeper concept: a restrained typographic identity supported by Turquoise contact structure and Mint trust surfaces. Orange Ring remains exclusive to canonical Bird references. A Contact Ledger presents name, phone, and email without avatar conventions or inferred contact preferences. A Relationship Reference may show a canonical Reservation or Sale separately, with a subordinate Orange Ring Bird identity when the trusted Customer detail supplies its Bird reference. Never infer ownership, conversion, value, frequency, or a combined customer timeline.

**VISUAL MASTER #6 — CUSTOMERS — FROZEN.** The canonical composition is **The Trusted Keeper + Relationship Ledger**: Customer Detail follows Identity → Contact → Trusted Relationships, while Customer Registry remains an editorial Relationship Ledger. Reservation and Sale stay separate canonical relationship references. Do not introduce generic CRM analytics or invented Customer intelligence.

### The Final Passage

`DeliveryLedger` is an editorial history of optional Delivery records. It presents stored distance, free distance, price per kilometre, currency, status, and the trusted shipping-fee snapshot as a transparent equation; it is not a route tracker, a current-shipment card, or a mandatory path to Handover. Multiple records remain distinct and receive neutral sequence rhythm.

`RecipientSnapshot` is a restrained handoff identity with only the immutable recipient name and any stored phone or address. It is conceptually distinct from the Customer / Trusted Keeper even if fixture data happens to match.

`HandoverMilestone` uses a calm Gold provenance treatment for the authoritative handoff record. Orange Ring remains on the Bird identity alone. The Bird’s Sold state appears only when the trusted Bird read model reports `sold`; never infer it merely from a selected Sale or Handover form.

**VISUAL MASTER #7 — DELIVERY & HANDOVER — FROZEN.** The approved signature is **The Final Passage**: a Bird-first, traceable final handoff from farm to recipient. `DeliveryLedger` remains optional operational history, while `HandoverMilestone` remains the distinct provenance record of actual transfer; neither may be presented as a mandatory courier-style sequence. The Trusted Keeper and Recipient Snapshot remain separate identities. Shipping Snapshot presents the backend-authoritative formula transparently, without an editable fee or invented logistics intelligence. Orange Ring stays exclusive to Bird identity, Gold remains calm handover provenance, and the responsive ledger preserves readable human identifiers without exposing internal IDs.

### The Living Record — Visual Master #8

`LivingRecordHeader` is a public Bird-first identity surface: one Orange Ring, a Ring ID, and only the public Bird facts supplied by the trusted Passport resolver. It is neither a certificate nor a private Bird Profile. `LineageTrace` shows only the safe parent Ring IDs returned by the public resolver; it must not claim pedigree, inheritance, or additional generations.

`PublishedEvidence` is a selective-publication treatment for eligible public Bird photos and document metadata. It never exposes storage paths, checksums, notes, internal asset identifiers, or a fabricated download action. `PublicationBoundary` is the private operator surface that manages publication status, public assets, and the existing public-link/QR controls. It explains the boundary without exposing token mechanics as product identity.

**VISUAL MASTER #8 — PASSPORT — FROZEN.** The approved signature is **The Living Record**. Passport is a selective public Bird provenance record, not a certificate, ownership claim, or private Bird Profile. `LivingRecordHeader`, `LineageTrace`, `PublishedEvidence`, and `PublicationBoundary` form its canonical patterns. Orange Ring stays Bird-only. The public/private boundary is deliberate: public output contains only explicitly published resolver data; the operator controls that boundary privately. Completed Handover contributes only a restrained supported provenance date. QR and public-link controls remain secondary private publication controls, while unavailable tokens retain the one safe public response.

### Dashboard summaries

`BmbMetric` provides primary and secondary hierarchy; `OperationalSignal` presents an honest current count without implying an alert; `SummaryGroup` groups related trusted values without forcing every number into an equal card. Establish one Farm Pulse before operational groups and existing Quick Actions. Do not generate trends, percentages, alerts, or gauges without canonical source data.

## 15. Navigation

The shell supports content rather than competing with it. Active, hover, and focus states must remain distinct. Preserve routes. Mobile navigation must remain reachable without causing intrinsic-width overflow.

## 16. Responsive behavior

Responsive work is intentional composition, not automatic column stacking. Desktop emphasizes narrative breadth; tablet reduces decoration and regroups metadata; mobile prioritizes identity, current status, primary action, essential information, then history. Minimum review width is 390px. No clipping, inaccessible content, or unresolved intrinsic widths.

## 17. Accessibility

Maintain readable contrast, keyboard focus, semantic labels, visible statuses, and touch targets. Mark purely decorative rings `aria-hidden`. Mint, Orange, and Gold are normally surfaces or accents—not low-contrast body text. Motion or decoration must never obscure data.

## 18. Do / Don't

**Do:** use Warm Cream as the environment; reserve Orange Ring for bird identity; use Gold for real provenance; let typography and whitespace establish hierarchy; use trusted human-readable identifiers.

**Don't:** flood screens with Green; use Orange for generic CTAs; invent lifecycle events; expose UUIDs; nest cards without purpose; turn operational forms into decorative showcases; change canonical values for prettier labels.

## 19. Implementation map

- Tokens and utility styling: `web/src/bmb-design-system.css`
- React primitives: `web/src/bmb-design-system.tsx`
- Frozen reference: `web/src/BirdProfile.tsx` with its approved rules in `web/src/refinement.css`

Future screen rounds should adopt these primitives incrementally and validate each screen against the frozen Bird Profile rather than globally restyling the application in one pass.
