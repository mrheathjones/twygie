# Twygie — Development Journal

---

## Session 1 — April 5–6, 2026 — Genesis

### Project Start
Built from scratch as an interactive family tree website. First iteration used parchment aesthetic. User requested full redesign toward organic/modern.

### Design Direction
Dark background (#04070c), glowing nodes, warm atmospheric glow, Cormorant Garamond + Outfit fonts. Each member became a "Twyg."

### Infrastructure
- Firebase project `twygie` set up
- Vercel connected to GitHub (github.com/mrheathjones/twygie)
- Domain twygie.com purchased

### Naming
Explored: Yarns, Storied, Twiggy, Twygy, Twygie. Settled on Twygie.

---

## Session 2 — Forms, Cards, Relationship System

### Major Overhaul
- Replaced side panel with centered glassmorphism overlay card
- Auto-layout: BFS from isYou, parents above, children below
- Expanded relationship dropdown: Son, Daughter, Father, Mother, Husband, Wife, etc.
- Members list panel grouped by generation with search
- Photos on nodes (Base64, circular crop)
- Hover tooltip with photo + age

### Form Redesign
- Split first/last name fields
- Date of birth: Month/Day/Year selects
- City + full US state dropdown (50 states)
- Deceased toggle with death date
- Gender field
- Photo picker with preview

---

## Session 3 — Auth + Firestore

- Connected Firebase Auth (Email, Google, Apple)
- Firestore save/load per user with auto-save (1.8s debounce)
- First-time users: isYou prefilled from display name
- Settings saved to userSettings/{uid}

---

## Session 4 — Connection Line System

### Line Type Hierarchy (final)
| Type | Color | Style | Mode |
|---|---|---|---|
| Parent-child | Green | Solid bold | Both |
| Sibling | Orange | Solid bold | Both |
| Extended blood (grandparent, aunt, etc.) | Purple | Solid | All Twygs |
| Spouse | Blue | Dashed | Both |
| Non-blood (in-law, etc.) | Purple | Dashed | All Twygs |

### Key Decisions
- `parents[]` = ONLY direct parents (Father/Mother/Stepparents)
- Grandparents, aunts, cousins → `customLinks` with lineType:'blood'
- Siblings → `customLinks` with lineType:'sibling' (no parent array copy)
- `BLOOD_LABELS` set determines solid vs dashed

### Tree View vs All Twygs
- Tree View: parent-child, sibling, spouse
- All Twygs: + extended blood (solid) + non-blood (dashed)
- Dual highlighted buttons in header

---

## Session 5 — Settings Panel Rebuild

### Collapsible Sections
Reorganized flat settings into 5 collapsible sections:
- **Account** — user info + tree stats (moved from separate section)
- **Tree View** — default view
- **Connections** — auto-assign toggle + custom types
- **Appearance** — node + line color pickers
- **Advanced** — young age threshold

### Save Indicator Fix
Settings save was using `await settingsDoc().set()` which blocked the UI.
Fixed by decoupling: button animates green "✓ Saved!" immediately, Firestore write is fire-and-forget with `.catch()`.

---

## Session 6 — Auto-Connections Engine

### Kinship Algebra
Built `inferRelToYou(anchorRelToYou, newRelToAnchor, gender)` — full composition table:
- Spouse's parent → Father/Mother-in-law
- Spouse's sibling → Brother/Sister-in-law
- Child's spouse → Son/Daughter-in-law
- Parent's sibling → Uncle/Aunt
- Parent's parent → Grandfather/Grandmother
- Sibling's child → Nephew/Niece
- Grandparent's sibling → Great-uncle/aunt
- Uncle/Aunt's child → First Cousin
- First Cousin's child → First Cousin Once Removed
- etc. (full consanguinity table)

### applyInferredRel()
Routing function that determines HOW to store an inferred relationship:
- Son/Daughter → `parents[]` (green line, not purple customLink)
- Spouse → `spouseOf`
- Sibling → `customLinks` lineType:'sibling'
- Others → `customLinks` lineType:'blood' or 'labeled'

### Spouse Propagation
Auto-assign now runs for BOTH isYou AND isYou's spouse using `getRelToYou_for(targetId, fromId)` helper.
Example: add Manny's wife Jenny → isYou gets "Daughter-in-law" AND Rose (wife) also gets "Daughter-in-law"

### Step-Relationship Rules
- Spouse's child = Son/Daughter (NOT Stepchild)
- Step-parents don't block inference (stepfather's mother = Grandmother still infers)

---

## Session 7 — Full Table of Consanguinity

### Dropdown Expansion
Both "Add a Twyg" and "Add Connection" dropdowns now include the full consanguinity table:
- Great-grandparents / Great-great-grandparents
- Great-grandchildren / Great-great-grandchildren
- Great-uncle/aunt, Great-grand-uncle/aunt
- Grand-nephew/niece, Great-grand-nephew/niece
- First Cousins Once/Twice/Thrice Removed
- Second Cousins Once/Twice/Thrice Removed
- Third Cousins Once/Twice/Thrice Removed
- Full in-law hierarchy
- Godparents, Guardian, Family Friend

### BLOOD_LABELS Expansion
All cousin degrees (including removed) added to BLOOD_LABELS → draw as solid purple lines.

---

## Session 8 — Connection Management

### Edit Existing Connection
Added pencil (✎) icon on each connection chip.
Tapping opens an inline dropdown pre-selected to current relationship.
`saveEditedConnRel()` removes old connection type and applies new one correctly (routes to parents[], spouseOf, or customLinks based on new label).

### Delete Connection Fix
Root causes found and fixed:
1. `sibs` array (auto-detected siblings) was missing `connType` field → fell through to 'labeled' → tried delete from customLinks → nothing happened since they're detected from shared parents
2. `byId` was stale when `removeConnFromCard` ran → used `P.find()` directly instead
3. Rewrote as `switch` statement covering all 5 types cleanly

---

## Major Bugs Resolved (all sessions)

| Bug | Cause | Fix |
|---|---|---|
| App stuck on loading | Missing `}` closing drawBranches / file truncated | `node --check` validation + restore from git |
| File truncated to 70KB | Python str-replace cut at `function drawNodes(){` | Restore from git history, targeted patches only |
| Labeled connections not saving | `saveConnection` missing `labeled` branch entirely | Added branch, switched to `customLinks` object |
| Settings save hanging | `await settingsDoc().set()` blocking UI | Decoupled: feedback immediate, Firestore fire-and-forget |
| Settings panel floating | `style="position:relative"` overrode CSS `position:fixed` | Remove inline style |
| Grandparent → false sibling | Grandparents added to `parents[]` triggered sibling detection | directParentLabels whitelist |
| Remove connection no-op | `byId` stale + `sibs` missing connType | Use `P.find()`, add connType to all chip objects |
| Auto-assign child draws purple | Inferred Son/Daughter stored as customLink | `applyInferredRel()` routes to `parents[]` for direct types |
| Auto-assign only hits isYou | No spouse propagation | Added `getRelToYou_for()` + spouse loop in autoAssignToYou |
| byId stale in autoAssign | autoAssignToYou called before rebuild() | Lightweight byId sync + P.find() fallback |

---

## Session 9 — April 6, 2026 — Auto-Assign Deep Fix (In Progress)

### Work Done

#### Full consanguinity dropdown + Table of Consanguinity
- Expanded both "Add a Twyg" and "Add Connection" dropdowns to include the full Table of Consanguinity reference
- First/Second/Third Cousins Once/Twice/Thrice Removed
- Great-grandparents/grandchildren through Great-great level
- Great-uncle/aunt, Grand-nephew/niece, all in-law variants
- BLOOD_LABELS set expanded to include all cousin degrees

#### Settings panel redesign
- Collapsible sections (Tree View, Connections, Appearance, Advanced)
- Tree stats (Members / Generations) displayed as stat cards under Account
- Save button animates green "✓ Saved!" — decoupled from Firestore async (fire-and-forget)
- Fixed position:relative override that broke panel positioning

#### Edit existing connection
- ✎ pencil icon on each chip opens inline dropdown pre-selected to current label
- `saveEditedConnRel()` removes old connection and re-applies new one with correct storage type
- Handles structural changes (e.g. Mother → Wife changes parents[] to spouseOf)

#### Delete connection fixed
- `sibs` array was missing `connType` field → fell through to wrong branch
- All branches now use `P.find()` instead of stale `byId[]`

#### Auto-assign overhaul

**applyInferredRel()**: Routes inferred relationships to correct storage:
- Son/Daughter → `parents[]` (green line)
- Husband/Wife/Partner → `spouseOf`
- Sibling → `customLinks` lineType:'sibling'
- Others → `customLinks` lineType:'blood' or 'labeled'

**autoAssignToYou() — enumerate all nodes**: Changed from "only isYou + spouse" to looping ALL existing nodes via `getRelToYou_for(anchorId, existing.id)`.

**Structural cascade in autoAssignToYou**: Explicit rules for common cases that inference chains miss:
- `isDirChild`: anchor.parents → grandparents, anchor.spouse.parents → other-side grandparents, add spouse as co-parent, siblings → uncles/aunts
- `isDirParent`: anchor.children → grandchildren, anchor.spouse's children → grandchildren, anchor.spouse → child-in-law
- `isSpouseRel`: anchor.children → add spouse to parents[], anchor.parents → in-laws

**getRelToYou_for() rewrite**: Multi-hop structural traversal in 7 steps:
1. Direct structural (parents[], spouseOf, siblings)
2. Child's spouse (Son/Daughter-in-law)
3. Grandchild (child's child)
4. Grandparent (parent's parent)
5. Spouse's parent (Parent-in-law) + spouse's sibling + spouse's grandchild
6. Two-hop through spouse
7. from's own customLinks for target

**inferRelToYou() expansion**: Added missing sections:
- Grandchild's relatives (grandchild+spouse=Grandchild-in-law, grandchild+child=Great-grandchild)
- Great-grandchild chains
- In-law section tightened: removed broad isParent/isSibling fallbacks that created co-grandparent links

**Bug fixes along the way:**
- `genderedRel('Spouse',...)` bug in getRelToYou_for step 2 → should be `genderedRel('Child',...)` to get "Son-in-law" not "Wife-in-law"
- `son-in-law + spouse = granddaughter` case removed (son-in-law's wife = your daughter, already linked)
- `isSibling(r)` fallback in in-law section removed (no standard kinship term for sibling-of-in-law)
- **Root cause of cross-family links**: `getRelToYou_for` steps 7b and 8 removed:
  - Step 7b: `t.customLinks[fromId]` = target's perspective, not from's → was creating asymmetric chains
  - Step 8: `t.relLabel` = global label (e.g. "Grandfather" from Kinder's perspective) was returned for ANY node asking about Tony, not just Kinder → caused Tony to appear as "Grandfather" to Annette
- `getRelToYou` changed to return `''` instead of `'Family'` for unknown relationships

**Recalculate button**: Added "↻ Recalculate all auto-connections" in Settings → Connections. Retroactively re-runs cascade for all structural connections in the tree.

### Current Status (PAUSED)
Auto-assign is mostly working. Remaining issues to revisit:
- When parent nodes are added alternately between isYou and spouse, the last added parent may still get incorrect connections to the other side's parents
- Likely caused by remaining inference chains in recalcAllRelationships or the isDirParent/isDirChild cascade creating links through the anchorSpouse path
- The "Recalculate" button currently makes things worse if existing wrong links exist — need to add cleanup pass first

### Next Steps When Revisiting
1. Add `cleanFalseConnections()` validation pass before or during recalc
2. Audit the isDirParent cascade: `linkNodes(newNode, anchorSpouse, ...)` may be incorrectly linking new parent to anchor's spouse's OTHER parents
3. Consider adding a "dry run" mode that shows what connections would be created before applying
4. Consider limiting autoAssignToYou to only first-degree inferences (depth=1) and letting recalc handle chaining

---

## Session 10 — April 7, 2026 — Auto-Assign Deep Fix (Complete)

### cleanFalseConnections Overhaul
- Added structural validation helpers: `collectAncestors()`, `collectDescendants()`, `hasBloodPath()`, `hasSharedParent()`, `getSpouseNode()`
- `hasBloodPath()`: validates blood relations via common ancestor through parents[] chains (6 gen depth)
- `hasInLawPath()` rewritten: validates in-law connections through marriage bridges (spouse→blood, child/grandchild→spouse)
- `cleanFalseConnections()` now validates ALL customLink types (blood, labeled, sibling), not just in-law labels
- Runs after every `autoAssignToYou()` call to catch false cross-family links immediately
- Correctly rejects co-grandparent links (Dad↔FatherInLaw) while preserving valid multi-gen in-laws

### Spouse Addition Fix
- Adding a spouse now links them as co-parent to anchor's existing children directly in form submit
- Works regardless of auto-connections toggle (structural, not inferential)
- Previously only handled inside autoAssignToYou which requires auto-connections enabled

### Inference Table — Comprehensive Audit
**Bugs fixed (3):**
- FIL/MIL + child: was Grandchild → now Brother/Sister-in-law
- FIL/MIL + grandchild: was Great-grandchild → now Nephew/Niece
- GIL/GMIL + child: was Great-grandchild → now null

**Step/in-law defaults corrected:**
- Parent's spouse: was Stepfather/Stepmother → now Father/Mother (user edits to Step manually)
- Grandparent's spouse: was Grandparent-in-law → now Grandparent
- Great-GP's spouse: added → Great-grandparent

**Missing rules added (11):**
- Spouse's nephew/niece → Nephew/Niece
- Uncle/Aunt's spouse → Uncle/Aunt
- Great-uncle's spouse → Great-aunt/uncle
- FIL's parent → Grandparent-in-law
- FIL's sibling → Uncle/Aunt-in-law
- BIL/SIL's grandchild → Grand-nephew/niece
- BIL/SIL's sibling → Brother/Sister-in-law
- Grandparent's great-grandchild → First Cousin Once Removed
- Great-GP's great-grandchild → Second Cousin
- First Cousin's parent → Uncle/Aunt
- First Cousin's spouse → Cousin-in-law
- FIL/MIL's spouse → other Parent-in-law
- GIL/GMIL's spouse → other Grandparent-in-law

### Sibling Fix
- Siblings now copy anchor's parents[] (previously set to empty)
- Auto-assign runs as "child of each parent" instead of "sibling of anchor"
- Triggers full isDirChild cascade: grandparents, uncles, in-laws all connected
- Previously siblings were orphaned with just a single customLink

### Export Feature
- Added Export dropdown button in header (Save as Image / Save as PDF)
- PNG: clones SVG, calculates bounding box, renders at 2x resolution, downloads
- PDF: multi-page document using jsPDF from CDN:
  - Cover sheet: Twygie logo, family name, member count, generation count, date
  - Table of contents with dotted leader lines
  - Tree visualization (auto landscape/portrait)
  - Member directory: photos, names, relationships, DOB, age, death dates, stories, connections
  - Page numbers and footers on every page
  - Filters out placeholder story text

### Timeline Page (/timeline)
Built as a separate HTML page (timeline.html) with:
- Horizontal single-line timeline with nodes positioned by birth year
- Filled circle dots (photo or initials) above the line with connectors
- Overlapping birth years grouped into gold count badges with hover popup listing all members
- Single members show hover popup with photo, name, relationship, dates, age, story

#### Dual Scroll Bar System
- **Horizontal bar (bottom)**: scrubs left/right through time chronologically
  - Density-aware: bars glow brighter gold near birth year clusters
  - Green glowing "You" tick marks isYou's position on the bar
- **Vertical bar (right)**: controls zoom depth
  - Overview (~15px/yr) → Decade (~50px/yr) → Year (~200px/yr) → Month (~800px/yr)
  - Exponential scale: yearPx = 15 * (800/15)^zoomLevel
  - Maintains center position when zooming
  - Zoom label below bar (Overview/Decade/Year/Month)
- Both bars: dock-like hover magnification effect (bars swell near cursor)
- Timeline range padded symmetrically around isYou so green tick is centered

#### Detail Modal
- Click any node → glass overlay modal (75% opacity, 30px backdrop blur)
- Shows: photo, name, relationship, birth/death dates, age, story
- Mini family tree visualization: parents above, spouse beside, children below, siblings
- Each mini node is clickable (navigate within modal)
- "View in Tree →" link to return to main app

#### Other Timeline Features
- Reset button restores default zoom and centers on isYou
- Same Firebase auth + AES-256 encryption as main app
- Route: /timeline in vercel.json (cleanUrls handles mapping)
- Responsive: touch pinch-to-zoom, drag-to-pan on mobile

### Phase 3a — Tree Linking (Session 10)
- "Link Trees" button on node cards generates TWYG-XXXX-XXXX codes
- SHA-256 hash of name + birth year for bridge node matching
- Link code stored in Firestore linkInvites/{code} with 7-day expiry
- "Enter link code" UI in Settings → Linked Trees → Manage Linked Trees modal
- Validates: exists, not expired, not used, not self-link
- Matches bridge node by hashing all local nodes against invite hash
- Creates treeLinks/{linkId} document with both user IDs + bridge info
- Active links list with revoke capability
- Bridge badge on node cards: "Linked with [name]'s tree"
- Real-time sync via Firestore onSnapshot — both sides update instantly
- Seed page created for Maddy test account (/seed-maddy) with shared family

### Settings Card Overlay (Session 10)
- Settings converted from slide-in side panel to centered overlay card
- 380px wide, max 92vw, max 88vh, gold-tinted border, rounded corners
- Scale + fade animation on open/close
- Backdrop blur (6px) on scrim behind card

### Phase 3b — Bridge Display (Session 10)
- Gold dashed ring around bridge nodes on the SVG tree (slowly rotating, 20s)
- "Linked" entry added to the node legend with matching dashed gold circle
- Chain icon badge removed (ring alone is sufficient)
- Bridge badge on node card: "Linked with [name]'s tree" (from Phase 3a)
- All indicators update in real-time via onSnapshot listeners

### Phase 3c — Sharing Tiers (Session 10)
- Share All / Bridge Only toggle per link in Manage Linked Trees
- Shared encryption key: PBKDF2(sort([uidA,uidB]).join('|'), 'twygie-shared-v1')
- Shared data encrypted with AES-256-GCM, stored in treeLinks.sharedData.{uid}
- Photos and notes stripped from shared data (Firestore 1MB limit)
- Bidirectional spouse detection when building shared data
- getRelToYou() used for accurate relationship labels at share-time
- Share All checkbox during link code generation (autoShareAll flag on invite)
- Auto-upload: onSnapshot detects shareLevel='all' + no data → auto-encrypts

#### Shared Node Rendering
- Ghost/faded gold dashed circles at 50% opacity
- Positioned relative to bridge node (scaled + offset)
- Dashed connection lines: green for parent-child, blue for spouse
- Hover tooltip: "Name · From [user]'s tree"
- Click opens styled popup card (not browser alert)
- Deduplication: name+birthYear fingerprinting, aggressive firstName-only fallback

#### Auto-Adopt
- Checkbox in link card: "Auto-adopt unique nodes from their tree"
- adoptBatch() sorts parents-first, multi-pass (up to 5) adoption
- Properly remaps parent/spouse IDs as each node is adopted
- Adopted nodes get double-ring visual (inner solid + outer dashed spinning 12s)
- Auto-adopt flag stored on treeLink, triggered inside loadSharedNodes
- appReady guard prevents auto-adopt during initial boot

#### Node Card Buttons
- isYou: "Link Tree" (generate code) + "Unlink" (multi-select modal)
- Other nodes: "Link Twyg" (opens code entry) + "Unlink" on bridge nodes
- Unlink modal: checkbox list of linked users, Unlink Selected, Unlink All, Cancel

#### Branded Modals
- appAlert(msg): single OK button, dark glass aesthetic
- appConfirm(msg, okText, cancelText): two buttons with custom labels
- appChoice(msg, btnA, btnB, cancelText): three buttons, returns 'a'/'b'/false
- All browser confirm()/alert() calls replaced throughout the app

### UI Polish & Bug Fixes (Session 10 — Late)
- Connections limited to top 5 with "See all N connections" button
- Young node pulse animation removed (matches all other nodes now)
- Birthdate format: "Jan 1 1980" → "January 1, 1980" (full month, comma)
- Linked legend icon: replaced CSS border with inline SVG dashed circle
- In-law labels (Brother/Sister/Father/Mother-in-law etc.) added to BLOOD_LABELS
- Both drawBranches sections re-check BLOOD_LABELS at draw time (fixes stale lineType)
- recalcAllRelationships(force) parameter added — adoptBatch forces recalc for in-law links
- Godfather/Godmother added to BLOOD_LABELS

### Relationship & Line Rendering Fixes (Session 10 — Final)
- SIBLING_RELS expanded: all cousin variants, half/step-siblings
- CHILD_RELS expanded: godchildren, great-grand-nephew/niece
- PARENT_RELS expanded: godparents, great-grand-uncle/aunt
- Sibling handler split: direct siblings copy parents, cousins/in-laws get customLink only
- cleanFalseConnections: trusts BLOOD_LABELS + any '-in-law' label (doesn't delete)
- cleanFalseParents(): new guard removes false parent-child connections for in-laws
- drawBranches: ALWAYS derives lineType from BLOOD_LABELS at draw time (never uses stored)
- New line category: "Extended non-blood" (inlaw) — dashed pink (#dc6488) for in-law connections
- 6 line categories total: parent-child, sibling, extended blood, spouse, extended non-blood, non-blood
- Legend and Settings updated with new inlaw color picker

---

## Session 11 — April 8, 2026 — Modular Refactoring

### Monolith Split
- Split 5,186-line family-tree.html into 18 modular files
- index.html → app.html (571-line HTML shell, renamed for cleanUrls compat)
- 9 CSS files in styles/ (base, tree, header, cards, panels, settings, forms, timeline, login)
- 12 JS modules in js/ (constants, firebase, render, kinship, settings, linking, ui, panels, export, app, timeline, login)
- login.html: 523 → 150 lines + login.css + login.js
- timeline.html: 609 → 45 lines + timeline.css + timeline.js
- All JS syntax validated, all HTML onclick handlers verified

### Variable & Function Renames (507 references)
- P → people, byId → peopleById, nxt → nextNodeId
- se() → createSvgElement(), NS → SVG_NS
- gr() → getGlowRadius(), nr() → getNodeRadius()
- col() → getNodeColor(), gclass() → getGlowClass(), gfilt() → getGlowFilter()
- orb() → deterministicOffset(), bstyle() → getBranchStyle()
- connCount() → getConnectionCount(), brRgba() → getBranchRgba()
- showTip/hideTip → showTooltip/hideTooltip
- tx/ty → panX/panY, drag → isDragging, applyT → applyTransform
- Local g() in kinship.js → gendered() (gender-aware label selector)
- selId → selectedNodeId, addFor → addForNodeId, nodeDrag → nodeDragState

### Code Quality
- 75 → 31 inline styles (remaining are dynamic JS-controlled colors)
- 5 JS functions converted from style.X= to classList toggles
- 5 dead functions removed (toggleTreeMode, openTimeline, hexToAlpha, rgbToHex, deleteConnection)
- 9 relationship constants consolidated into constants.js
- Module documentation headers with dependency maps on all files
- 12 console.log → debug() gated utility (window.TWYGIE_DEBUG)
- 60 inline onclick/oninput/onchange → addEventListener via initEventListeners()
- Fixed 7 duplicate class attributes on form elements
- All family-tree.html references → /app, login.html → /login

### Bug Fixes
- **404 on /app**: Renamed index.html → app.html for Vercel cleanUrls compatibility
- **gendered is not defined**: Rename script missed `const g=` definition (only matched `g(` calls)
- **Sibling lines missing in Tree View**: Auto-detected sibling rendering was placed after the `if(simple) return` gate — moved before it
- **Sibling lines deleted by cleanFalseConnections**: hasSharedParent() only checked parents[] arrays; siblings were validated as invalid when parents were stored in customLinks. Fix: trust all sibling customLinks + expanded hasSharedParent to check customLinks
- **Sibling label detection**: Expanded isSibLabel to include Stepbrother, Stepsister, Sibling
- **Robust sibling rendering**: Added parent-centric sibling detection via parentChildMap that checks parents[], child-type customLinks, and parent-type customLinks
- **Timeline logo lost gold**: Fixed color from var(--text) to var(--gold)

### Features Added (Session 11 continued)
- **4 View Modes**: Tree View | All Twygs | Roots | Bonds
  - Roots: blood relatives only (parent-child, sibling, extended blood)
  - Bonds: non-blood only (spouse, in-law, family friends)
  - Uses showBlood/showNonBlood/showExtended flags in drawBranches
- **Deceased Toggle in Edit Card**: checkbox with death date fields, saves dod/death
- **Deceased Node Color**: #6b9ec2 (blue) → #c27070 (muted red) — was identical to parent blue
- **Aunt/Uncle/Nephew/Niece-in-law**: dropdown, constants, inverse mappings, gender inference
- **Cross-Marriage Line Classification**: bloodFamily BFS + spouseOf check reclassifies blood labels crossing marriage boundary as Extended Bonds
- **Legend/UI Renames**: Nodes→Twygs, Lines→Connections, Extended blood→Extended Roots, Extended non-blood→Extended Bonds, Non-blood→Bonds

### Additional Bug Fixes
- Spouse lines missing: saveConnection only set spouseOf one direction; rendering now also checks customLinks for Husband/Wife/Partner labels
- bloodFamily set incomplete: expanded BFS to trace through blood-type customLinks + post-BFS cleanup removes married-in spouses
- gendered() definition missed by rename script: const g= vs g( regex mismatch
- hasSharedParent too narrow: expanded to check customLinks parent-child relationships
- cleanFalseConnections too aggressive: now trusts all sibling customLinks

### Relationship Engine v2 (Session 11 continued)

**Phase 1 — Data Model:**
- Added relationships[] array to Person schema
- Each relationship: {targetId, label, category, structural}
- Categories: 'blood' (solid), 'bond' (dashed pink), 'custom' (dashed purple)
- Helper functions: addRel(), removeRel(), getRel(), getAllRels(), getRelCategory()
- Migration: customLinks auto-converted to relationships[] on load via rebuild()
- burnTwygs clears relationships[]

**Phase 2 — Renderer:**
- drawBranches reads relationships[] — category determines line style directly
- No more runtime BLOOD_LABELS/crossesMarriage classification
- Sibling → solid orange, blood → solid purple, bond → dashed pink, custom → dashed purple

**Phase 3 — Simplified Auto-assign:**
- computeRelationship(): single source of truth wrapper over structural resolver
- Replaced 30-line inference loop with 12-line compute pass
- getRelToYou badge: 40 lines → 6 lines (relationships[] → computeRelationship → fallback)
- relCategory: checks relationships[] for node coloring
- Removed cleanFalseConnections from autoAssignToYou
- removePerson/getConnectionCount updated for relationships[]

**Design Doc:** Full architecture written in plan.md covering three-layer model, migration plan, edge cases, and future AI engine integration.

### Session 12 — Relationship Engine Completion (April 8, 2026)

**Structural Resolver:**
- Common-ancestor BFS: traces parent chains upward, finds shared ancestor, counts generation distances
- Handles uncle/nephew (genA=1, genB=2), cousin degrees, in-law via spouse bridge
- Inferred parent chains: if isYou has Grandfather link to G and parent P, infers G is P's parent
- Sibling propagation: inferred parents shared between declared siblings

**Critical Fixes:**
- computeRelationship had SWAPPED PARAMETERS — was returning labels from wrong perspective (isYou labeled Alan as "Grandson" instead of "Grandfather")
- Missing SIBLING CASCADE in autoAssignToYou — when adding a sibling, never created uncle/nephew with anchor's children
- isDirParent cascade only checked anchor's children, not ALL children of new parent (missed CASCADE B additions)
- Spouse-sibling guard too aggressive — blocked real siblings who happened to be married. Narrowed to only reclassify when one is married to the other's actual sibling.

**Three Cascades (working):**
- CASCADE A (sibling-of-sibling): Adding A as B's sibling → connects A to ALL of B's existing siblings
- CASCADE B (parent-to-sibling): Adding P as A's parent → adds P to ALL of A's siblings' parents[]
- SIBLING→UNCLE/NEPHEW: Adding a sibling → creates uncle/nephew for ALL siblings' children, great-uncle for grandchildren, sibling-in-law for spouses

**Legacy Code Removed:**
- Auto-detected sibling section (155 lines) — v2 uses relationships[]
- bloodFamily BFS (60 lines) — v2 uses category directly
- crossesMarriage (12 lines) — replaced by category field
- render.js: 764 → 530 lines (-235 lines)

**Other Fixes:**
- Tooltip stuck visible: inconsistent show/hide (class vs inline opacity)
- Burn Twygs button added to Settings → Advanced

**Order Independence Verified:**
- Top-down, bottom-up, and mixed add orders all produce correct relationships
- Only requirement: each node must be added with a relationship to an existing connected node

---

## Session 13 — View Modes, Immersive Polish, Header Cleanup, Birthdate Awareness (April 9, 2026)

### Immersive Mode Improvements
- **Zoom-to-node**: Click node → camera smoothly orbits to it → opens full selectNode card as overlay (stays in 3D)
- **Line glow pulse**: Sine wave opacity oscillation on all connection lines (baseOp + sin(t*1.2+i*0.5)*0.2)
- **View mode filtering**: All Twygs/Roots/Bonds work in 3D — immRefreshLines() rebuilds on view change
- **Transparent canvas**: alpha:true so app's warm #atm gradient shows through (consistent background everywhere)
- **Node pulse strengthened**: Emissive base 0.6→1.0, glow opacity doubled, selected node highlight 0.35+±0.12
- **Exit button**: Solid gold, z-index 101 (outside immersive-wrap stacking context), hover brightens to #e0c060

### Header Toolbar Cleanup
- Restructured: 3-section layout (.hdr-left / .hdr-center / .hdr-right)
- Removed: "Fit to Screen" button, Export dropdown (moved to Settings), user avatar icon
- Renamed: "Tree view" → "Tree", "Add member" → "Add Twyg"
- Toggle stack: view toggle + layout toggle stacked vertically in center
- Gold hover tint (rgba(200,168,75,.12) + gold text) applied consistently across all buttons
- Timeline link underline removed (force-override all anchor states)

### Traditional Layout — Classic Pedigree Chart
- Recursive binary tree: isYou at center, parents spread above (300px), each generation 1.2x wider
- Spouses toward outside (80px couple gap)
- Siblings placed beside their family unit
- Straight angular lines for Traditional mode (vertical→horizontal→vertical connectors)
- Relationship lines also use angular style in Traditional mode
- Work in progress — close but needs further refinement

### Birthdate Awareness System
- **Timeline indicator**: Gold "X Missing Twygs" button in timeline header
- **Missing Twygs modal**: Centered 640px glassmorphism card, single-column scrollable (45vh max)
  - Each row: color dot, name, inline year/month/day inputs, Save button
  - Header: "Pick up your Twygs" / "We think you dropped something"
  - Save writes to Firestore with correct encryption (deriveKey + AES-GCM)
  - Row animates out on save, timeline re-renders with node placed
  - Close via ✕ button or click outside
- **Creation warning**: appConfirm when adding node without birthdate
  - "Don't remind me again" checkbox, persisted as dobWarnDismissed to Firestore
  - "Got it" / "Edit now" options
- **Settings reset**: Advanced → "Birthdate Reminders" with Reset button

### Timeline Page
- Warm brown atmosphere background added (#atm div matching main app)
- Gold hover tint on Reset and Back to Tree buttons

### Bug Fixes
- Firebase save in timeline: was writing to wrong collection ('trees' vs 'familyTrees')
- encrypt() spread operator crash on large data — switched to for-loop btoa
- January missing from month select (i>0 filter skipped index 0)
- Layout toggle invisible: header used align-items:center, gradient faded too quickly
- Immersive exit button trapped inside stacking context (z-index capped by parent)

### Export Moved to Settings
- New collapsible "Export" section in Settings panel
- Contains "Save as Image" and "Save as PDF" buttons
- Section toggle handler wired in app.js

### Commits: ~25 commits across app.html, timeline.html, 7 JS files, 3 CSS files

## Session 14 — Leafs Phase 1 Complete + Phase 3/4 Started (April 9, 2026)

### Leafs Phase 1 — COMPLETE
- LEAF_TYPES constant: story/moment/photo/quote/milestone with icons
- Data layer: loadLeafs/saveLeafs/addLeaf/editLeaf/deleteLeaf/getLeafsForNode
- Storage: encryptedLeafs field in familyTrees/{uid} (same doc as tree)
  - Initially tried separate leafs/{uid} collection — failed because Firestore rules not deployed
  - Moved to familyTrees doc — uses existing rules, same encryption
- Node card: Leafs section with count, 3 most recent, "+ Add Leaf", "See all N Leafs"
- Add Leaf modal: 5-type picker, title, content, date, emoji picker, tag other Twygs
- Tag buttons: toggle pill buttons with node color dots (replaced broken checkboxes)
- Leaf detail: appChoice modal with Edit/Delete options
- Leaf list: appAlert with all leafs, click to open detail
- All CRUD async with await — persistence verified

### Roadmap Update
- Added: Connection lines assessment (edge cases found)
- Added: Traditional layout polish, customLinks cleanup to near-term
- Priority order: Leafs Phase 3 (timeline) → Phase 4 (tree view) → mobile → GEDCOM

### Leafs Phase 3+4 — Timeline + Tree View (Session 14 continued)

**Phase 3 — Timeline Integration:**
- Dated leafs appear above timeline line in organic stagger zone (bottom 52-67%)
- Hash-based positioning: pseudo-random height + ±15px horizontal jitter
- Hover popup above dot (title, content preview, tagged names)
- Click opens detail modal (centered, glassmorphism)
- 🍃 leaf emoji on dot and in legend
- "You" shown instead of user name in tagged lists

**Phase 4 — Tree View Integration:**
- 🍃 Leafs toggle button in view bar (separated by divider)
- Leaf nodes rendered in lG SVG group (behind bG branches and nG nodes)
- Draggable with position persistence to Firestore

**Orb Collision Engine (js/orb-engine.js):**
- OrbEngine class with requestAnimationFrame loop
- Soft repulsion from dragged orb (inverse-power falloff)
- Orb-to-orb separation (minimumSeparation 28px, force 0.35)
- Static obstacles: twyg nodes registered as immovable (50px radius, force 0.5)
- Spring return to home position after displacement
- Velocity damping (0.75) for smooth deceleration
- Configurable: repulsionRadius, minimumSeparation, springStrength, etc.
- SVG elements created once, engine updates transform attributes (no full re-render)

**Snap-on-drop (2-phase):**
- Phase 1: iterative push from nodes (60px) and leafs (30px)
- Phase 2: if still blocked, orbit primary twyg testing 24 angles for clearest spot
- 150px max drift cap prevents flying

**Key bug fixes:**
- Drag origin: use orb's current position, not stale home position
- Node avoidance: continuous in engine (not just on drop)
- Encrypt: for-loop btoa (spread operator crashes on large arrays)
- Firestore: leafs stored in familyTrees/{uid} (not separate collection)

### Leafs Phase 6 — Dedicated Leafs Page (Session 14 continued)

**New Files:**
- leafs.html — page shell with filters, grid, modals
- styles/leafs.css — masonry grid, cards, filter UI, modals
- js/leafs-page.js — self-contained Firebase + rendering + CRUD

**Page Features:**
- 3-column masonry grid (responsive: 2 at 900px, 1 at 560px)
- Search bar filters by title + content
- Type filter pills: All / Stories / Moments / Photos / Quotes / Milestones
- Twyg filter dropdown: filter by tagged person
- Sort dropdown: Newest/Oldest Created, Recently/Least Recently Modified
- Green-tinted cards matching leaf theme
- Click card → detail modal with Edit + Delete buttons

**New Leaf Button:**
- Green accent button in header
- Full creation modal: type picker, title, content, date, emoji, twyg tags
- Saves encrypted to Firestore

**Edit + Delete:**
- Edit reopens add modal pre-populated, stamps modifiedBy/modifiedAt
- Delete uses branded confirmation modal (not browser confirm)

**Metadata:**
- createdBy/createdByName/createdAt on all leafs
- modifiedBy/modifiedByName/modifiedAt stamped on edit
- Displayed on cards and detail modal

**UI Polish:**
- Tree view toggle: "🍃 Leafs" → just "🍃" emoji (no text confusion)
- "🍃 Leafs" header link navigates to page
- Green tinted modals (dark green bg + green border)
- Type icons removed from card/detail titles

### Session Wrap-up — Node Physics + Immersive Leafs

**Node Collision Avoidance:**
- pushNodesFromDragged(): 4-pass collision during drag
- Dragged node pushes others (84px radius, 0.35 force)
- Non-dragged nodes separate from each other (70px min, 0.2 force)
- Skipped for Traditional + Immersive modes
- Nodes stay where pushed (no spring return)

**Immersive Leafs:**
- Green 3D spheres orbiting their primary twyg node
- Tag-based brightness (emissive + glow scaling)
- Dashed green connection lines to primary twyg
- Gentle Y-axis float animation
- Expand animation synced with nodes
- Respects showLeafs toggle
- Rebuilt on view mode changes

### Session 14 Final Wrap-up

**Critical Fixes:**
- saveTree() was wiping encryptedLeafs — all .set() calls now use {merge:true}
- showLeafs toggle persists to Firestore userSettings, restores on load
- Leafs toggle button: soft green active state (not solid gold)

**Node Physics (velocity-based spring system):**
- nodePhysicsStart(): snapshots _homeX/_homeY on drag start
- pushNodesFromDragged(): repulsion (100px), spring return (0.06), damping (0.75)
- nodePhysicsEnd(): rAF settle loop springs nodes back after drop
- Skipped for Traditional + Immersive modes

**Immersive Leafs:**
- Toggle on/off with 🍃 button (calls buildImmLeafs)
- Green spheres orbit primary twyg (25-37 units, push from all nodes)
- Dashed green lines to ALL tagged twygs (not just primary)
- Tag-based brightness + glow scaling
- Click → zoom (radius 40) → openLeafDetail() after 600ms
- Gentle Y-axis float animation

**Leafs Page Polish:**
- Edit leaf modal: green tint matching Leafs page
- Leaf detail modal (tree view): green tint via .leaf-modal class
- Loading text: "Gathering Leafs...."
- Branded delete confirmation modal
- Green-tinted cards (bg + border)

### Session 14 — Final Additions

**Nicknames:**
- New `nickname` field on person object
- Shown on: node card (italic below name), tooltip, members panel
- Input on: Add a Twyg form, Edit card form

**Country Field:**
- Dropdown with 195 sovereign states (COUNTRIES array in constants.js)
- countrySelectOpts() helper for generating <option> tags
- On both Add a Twyg and Edit card forms
- placeDisplay: "City, State, Country"

**Deceased Toggle Fix:**
- Bug: label wrapping checkbox caused double-toggle (click label → toggle, click track → toggle again = cancel out)
- Fix: onclick="event.preventDefault()" on label, wrapper click handler with stopPropagation
- Applied to both Add a Twyg and Edit card forms

**Twyg Map (roadmap):**
- Interactive world map showing family locations
- Dark theme tiles, clustering, dual search (twyg name + location)
- Complexity: Medium-High (~4-5 hours)

**Leafs Page Left-Align:**
- Grid margin changed from `0 auto` to `0 auto 0 24px`

---

## Session 15 — April 10, 2026 — Universal Usernames + Managed Accounts Design

### Design Phase — Managed Accounts (Child Accounts)

Full architecture designed for supervised family member accounts with three-tier blossom protocol:

**Three Tiers:**
- **Seedling** (Non-Blossomed): Full parent supervision, reads parent's tree with swapped isYou, all permissions toggleable
- **Sprouted** (Blossomed, Under 18): Light supervision, own tree copy, some permissions locked open, parent controls structural changes
- **Full Bloom** (18+): Auto-triggers on login when DOB indicates 18+, all supervision revoked, peer-to-peer tree link remains

**Auth Paths:**
- **Email (13+)**: Normal Firebase Auth, system detects managed account on login
- **Username + PIN (any age, required under 13)**: Firebase Anonymous Auth, COPPA-compliant
- COPPA age gate: hard gate — if node's DOB indicates under 13, email path is not rendered at all

**Key Design Decisions:**
- Managed accounts read from parent's `familyTrees/{parentUid}` (Seedling) or own copy (Sprouted+)
- Two-collection uniqueness pattern for usernames: `usernames/{name}` + `userProfiles/{uid}`
- Blossom can be parent-triggered or child-requested (parent approves)
- PIN accounts use `linkWithCredential()` for auth upgrade during blossom
- COPPA defense: reasonable age gate + no child PII collection under 13 = "actual knowledge" standard met

**Universal Usernames Decision:**
- Every account (regular + managed) gets a unique @username
- Replaces email exposure in social features (linking, sharing, managed account references)
- Required step after Firebase Auth before tree access
- Existing users get one-time migration prompt

### Phase 1 — Universal Usernames (Implementation Started)

#### Phase 1A — Schema & Validation
- `userProfiles/{uid}` collection: username, displayName, email, createdAt
- `usernames/{username}` collection: uid, createdAt (uniqueness enforcer)
- Validation: lowercase alphanumeric + underscores, 3–20 chars
- Reserved words: admin, twygie, support, help, system, null, undefined, etc.
- Firestore security rules updated for new collections

#### Phase 1B — Username Selection Flow (New Users)
- Post-auth modal: "Choose your username" with real-time availability check
- Debounced Firestore lookup on `usernames/{input}`
- Green checkmark / red X feedback
- Write `usernames/{name}` first, then `userProfiles/{uid}` — atomic uniqueness
- Blocks tree access until username is set

#### Phase 1C — Username Selection Flow (Existing Users)
- One-time prompt on next login if no `userProfiles/{uid}` doc exists
- Pre-suggest from display name (lowercase, stripped, truncated)

#### Phase 1D — Display Integration
- Settings → Account shows @username (editable with availability check)
- Linked tree data uses username instead of email

### Phase 2 — Managed Account Infrastructure

#### Phase 2A — Schema & Utility Functions
- `managedAccounts/{id}` Firestore collection with full schema (authType, email/pin paths, tier, permissions, blossom timestamps)
- `getAgeFromDob(dob)` — precise age calculator (accounts for month/day)
- `canUseEmailAuth(dob)` — COPPA gate returns true only for 13+
- `hashPin(pin, salt)` — SHA-256 with per-account salt via Web Crypto API
- `generateSalt()` — cryptographically random 16-byte hex salt
- `DEFAULT_SEEDLING_PERMISSIONS` — default permission set for new managed accounts
- `createManagedAccount(opts)` — creates managed account doc, hashes PIN if provided
- `loadManagedAccounts()` — queries all managed accounts where parentUid matches current user
- `updateManagedPermissions(accountId, permissions)` — updates permission toggles
- `pauseManagedAccount(accountId, paused)` — soft disable/enable
- `resetManagedPin(accountId, newPin)` — generates new salt + hash
- `deleteManagedAccount(accountId)` — removes from allowedReaders, deletes username, deletes doc
- `addAllowedReader(uid)` — adds UID to familyTrees allowedReaders array
- `checkManagedAccountByEmail(email)` — finds managed account by email (email auth path)
- `checkManagedAccountByUid(uid)` — finds managed account by anonUid (PIN auth path)
- `triggerBlossom(accountId)` — Seedling→Sprouted: deep-copies tree, locks permissions, removes from allowedReaders
- Globals: `managedAccounts[]`, `isManagedSession`, `managedAccountDoc`

#### Phase 2B — Firestore Security Rules
- `familyTrees/{userId}`: read now allows owner OR uid in `allowedReaders` array
- Handles missing `allowedReaders` field gracefully via `keys().hasAny()` check
- `managedAccounts/{id}`: parent can CRUD, child/anonUid can read own doc
- Username deletion scoped to owner UID only

#### Auth Handler Updates
- Managed account detection: checks email path (by email) and PIN path (by anonUid)
- Paused account blocking: shows alert and signs out
- Auto-blossom: Sprouted→Full Bloom when age >= 18 (checked on every login)
- Full Bloom accounts treated as normal (exit managed mode)
- Email path: auto-claims childUid on first login, adds to allowedReaders
- lastActiveAt updated on every managed login

#### loadTree Updates
- Seedling managed accounts load from parent's `familyTrees/{parentUid}` instead of own
- Encryption key derived from parent's UID (seedling) or own UID (sprouted+)
- isYou swap: all nodes set `isYou:false`, child's node set `isYou:true`
- Save blocked for seedling accounts (treeLoaded stays false)
