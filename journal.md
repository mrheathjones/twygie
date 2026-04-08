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
