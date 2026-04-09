# Twygie — Technical Memory

## Stack
- **Frontend**: Modular vanilla JS + SVG — 12 JS modules, 9 CSS files, 3 HTML shells
- **Auth**: Firebase Auth compat SDK v10.8.0
- **Database**: Cloud Firestore compat SDK v10.8.0
- **Hosting**: Vercel (auto-deploy from GitHub main branch)
- **Fonts**: Google Fonts — Outfit (UI), Cormorant Garamond (headings)

---

## File Structure
```
twygie/
├── app.html                # Main app HTML shell (loads CSS + JS modules)
├── login.html              # Login page
├── timeline.html           # Horizontal timeline view (/timeline)
├── styles/
│   ├── base.css            # Reset, CSS variables, typography, loading, atmosphere
│   ├── tree.css            # SVG nodes, branches, glow/pulse animations, labels
│   ├── header.css          # Header bar, logo, nav buttons, view toggle, export menu
│   ├── cards.css           # Overlay card, link modal, branded modal, bridge badges
│   ├── panels.css          # Members panel, timeline panel, zoom, legend, tooltip
│   ├── settings.css        # Settings overlay, toggles, color pickers, helpers
│   ├── forms.css           # Add member modal, form inputs, buttons
│   ├── timeline.css        # Timeline page styles
│   └── login.css           # Login page styles
├── js/
│   ├── constants.js        # BLOOD_LABELS, relationship sets, INVERSE_REL
│   ├── firebase.js         # Firebase config, auth, encryption, load/save, data mgmt
│   ├── render.js           # SVG rendering: drawNodes, drawBranches, glow, layout
│   ├── kinship.js          # Relationship inference, auto-assign, structural validation
│   ├── settings.js         # Settings panel, color pickers, custom connection types
│   ├── linking.js          # Tree linking, TWYG codes, sharing tiers, auto-adopt
│   ├── ui.js               # Node card, editing, connection management, selection
│   ├── panels.js           # Members panel, tooltip, transform state, scrim
│   ├── export.js           # PNG/PDF export
│   ├── app.js              # Pan/zoom, add member form, event listeners
│   ├── timeline.js         # Timeline page (self-contained with own Firebase init)
│   └── login.js            # Login page (self-contained with own Firebase init)
├── vercel.json             # Route config (cleanUrls + rewrites)
├── firestore.rules         # Firestore security rules
├── plan.md                 # Roadmap
├── memory.md               # This file
└── journal.md              # Dev log
```

### Script Load Order (matters — globals are shared)
```
constants.js → firebase.js → render.js → kinship.js → settings.js →
linking.js → ui.js → panels.js → export.js → app.js
```

---

## Firebase Config
```js
apiKey: "AIzaSyBwtDMGEIphvwvq319MZIr62C32fvSSe-4"
authDomain: "twygie.firebaseapp.com"
projectId: "twygie"
storageBucket: "twygie.firebasestorage.app"
messagingSenderId: "654053569477"
appId: "1:654053569477:web:9296f441c285686d7c11ac"
```

## Firestore Schema
```
familyTrees/{userId}
  people: [Person]
  updatedAt: Timestamp
  ownerEmail: string

userSettings/{userId}
  defaultView: 'simple' | 'complex' | 'bloodline' | 'bonds'
  lineColors: { parentChild, spouse, sibling, labeled }
  nodeColors: { you, spouse, parent, child, sibling, grandparent, extended, deceased, young, default }
  youngAge: number
  autoConnections: boolean
  customLineTypes: [{ id, name, color }]
  updatedAt: Timestamp
```

## Person Object
```js
{
  id: string,               // 'you' | 'u{timestamp}'
  name: string,
  firstName: string,
  lastName: string,
  gender: '' | 'male' | 'female' | 'nonbinary',
  dob: { month, day, year },
  dod: { month, day, year } | null,
  birth: number | null,     // legacy
  death: number | null,     // legacy
  city: string,
  state: string,
  note: string,
  photo: string | null,     // base64 data URL
  parents: [id],            // DIRECT parents ONLY
  spouseOf: id | undefined,
  relationships: [           // v2 engine — all declared relationships
    { targetId, label, category: 'blood'|'bond'|'custom', structural: boolean }
  ],
  customLinks: {             // legacy — maintained for backward compat
    [targetId]: { label: string, lineType: 'sibling'|'blood'|'labeled' }
  },
  relLabel: string,
  isYou: boolean,
  x: number,
  y: number,
}
```

---

## Key Architecture Decisions

### Three-Layer Relationship Model (v2)
1. **Structural** (`parents[]`, `spouseOf`) — the skeleton, always correct
2. **Declared** (`relationships[]`) — user-stated relationships with category
3. **Computed** (`computeRelationship()`) — runtime resolver, never stored

### Relationship Categories
| Category | Visual | Meaning |
|---|---|---|
| parents[] | Green solid bold | Direct parent-child |
| spouseOf | Blue dashed | Marriage |
| `blood` | Orange solid (sibling) or Purple solid (extended) | Shared ancestry |
| `bond` | Pink dashed | Connected through marriage (in-laws) |
| `custom` | Purple dashed | User-defined (godparent, friend, etc.) |

### Cascades (order-independent)
- **CASCADE A (sibling-of-sibling)**: Adding A as B's sibling → connects A to ALL of B's existing siblings
- **CASCADE B (parent-to-sibling)**: Adding P as A's parent → adds P to ALL of A's siblings' parents[]
- **Sibling→Uncle/Nephew**: Adding a sibling → creates uncle/nephew for ALL siblings' children
- **isDirParent**: Adding a parent → finds ALL children (including CASCADE B additions) → creates grandchild, child-in-law relationships
- **isDirChild**: Adding a child → finds anchor's parents (grandparents), siblings (uncles/aunts), spouse (co-parent)

### Auto-Connections System (v2)
```
autoAssignToYou(newNodeId, anchorId, relToAnchor)
  → Structural cascades (isDirChild, isDirParent, isSibRel, isSpouseRel)
  → Compute pass: computeRelationship(existing, newNode) for all nodes
  → Sibling propagation: mirror shared relationships to isYou's siblings
```

`computeRelationship(fromId, targetId)`:
- Calls `getRelToYou_for(targetId, fromId)` — returns "how TARGET appears to FROM"
- Uses common-ancestor BFS + spouse bridge for in-law detection
- Returns `{label, category}` or null

`applyInferredRel()` routing:
- Son/Daughter/Father/Mother → `parents[]` (green line)
- Husband/Wife/Partner → `spouseOf`
- Everything else → `addRel()` which writes to both `relationships[]` and legacy `customLinks`

### Spouse-Sibling Guard
`addRel` reclassifies sibling labels to "-in-law" (bond) only when one node is married to the other's actual sibling (shares parents). Being married alone doesn't trigger reclassification.

### Connection Count → Glow Size
```js
function gr(p) {
  if(p.isYou) return 40;
  const cc = connCount(p); // parents + children + spouse + customLinks
  return Math.min(48, 22 + cc * 4);
}
```

### Young Node Detection
```js
const currentYear = new Date().getFullYear();
if(birthYear > 0 && (currentYear - birthYear) <= youngAge) return 'young';
```

Young nodes: fast double-flash pulse (1.8s, opacity-only, no transform/scale).
Adult nodes: slow breathe (3.4s amber / 4.3s blue / 2.5s you).

### Settings Save Pattern
```js
// Non-blocking — UI feedback fires immediately, Firestore is fire-and-forget
function saveSettings(){
  // 1. Apply values immediately
  youngAge = ...; treeMode = settingsMode; setTreeMode(); render();
  // 2. Show button feedback
  btn.textContent='✓ Saved!'; btn.style.background='#4caf7d';
  setTimeout(() => { btn.reset(); closeSettings(); flashSaved(); }, 1500);
  // 3. Persist in background
  settingsDoc().set({...}).catch(e => console.warn(e));
}
```

---

## Deployment
```bash
cd /home/claude/twygie
# Validate ALL JS files before pushing:
for f in js/*.js; do node --check "$f" || echo "FAIL: $f"; done
# Or combined check (simulates browser load order):
cat js/constants.js js/firebase.js js/render.js js/kinship.js js/settings.js js/linking.js js/ui.js js/panels.js js/export.js js/app.js > /tmp/combined.js && node --check /tmp/combined.js
git add . && git commit -m "..." && git push https://{GH_TOKEN}@github.com/mrheathjones/twygie.git main
```
- Vercel auto-deploys in ~30s after push
- Rotate GH/Vercel tokens after use — never leave in chat
- No build step needed — Vercel serves styles/ and js/ as static files

## Vercel IDs
- Team: `team_nrD8szUQ8HeSzhD71HrIvJGB`
- Project: `prj_YZdqrjF8rTlV7jOf3gb0Z0DF0ge4`

---

## Known Gotchas

1. **JS validation is mandatory** — always `node --check` each file before pushing. The modular split reduces truncation risk vs the old monolith, but syntax errors in one file still break the app.
2. **Script load order matters** — all JS files share global scope via `<script>` tags. constants.js must load first; app.js must load last. See index.html for the full order.
3. **peopleById is stale before rebuild()** — always use `people.find(p=>p.id===id)` when accessing nodes before a rebuild, especially in autoAssign and removeConn.
4. **Settings save is fire-and-forget** — `settingsDoc().set()` runs in background. Don't revert to `await`.
5. **Photos as base64 in Firestore** — approaching 1MB doc limit for nodes with large photos. Future: use Firebase Storage.
6. **connType missing from sibs array** — auto-detected siblings from shared parents had no connType, causing remove to silently fail. Always include connType in every chip's connection object.

---

## Auto-Assign Architecture (Session 9 — Current State)

### autoAssignToYou(newNodeId, anchorId, relToAnchor)
Two-pass system:

**Pass 1 — Structural Cascade** (explicit, reliable):
```
isDirChild  → anchor.parents → grandparents
             anchor.spouse.parents → other-side grandparents
             anchor.spouse → add as co-parent
             anchor.siblings → uncles/aunts via linkNodes()
isDirParent → anchor.children → grandchildren
             anchor.spouse.children → grandchildren
             anchor.spouse → child-in-law via linkNodes()
isSpouseRel → anchor.children → add newNode as co-parent
             anchor.parents → in-laws via linkNodes()
```

**Pass 2 — Inference Loop** (getRelToYou_for + inferRelToYou for all other nodes)

### getRelToYou_for(targetId, fromId) — 7 steps
Returns: how target appears to from (from's perspective)
1. Direct structural (parents[], spouseOf, shared parents = sibling)
2. from's child's spouse = target (Child-in-law)
3. from's child's child = target (Grandchild)
4. from's parent's parent = target (Grandparent)
5. from's spouse's parent/sibling/child/grandchild
6. Two-hop: from's spouse's child's child or spouse
7. from.customLinks[targetId] only (NOT t.customLinks[fromId], NOT t.relLabel)

⚠️ CRITICAL: Steps 7b (t.customLinks[fromId]) and 8 (t.relLabel) were REMOVED.
- t.relLabel is a GLOBAL label (e.g. "Grandfather" from Kinder's view) — returning it for 
  any query about Tony caused Tony to appear as "Grandfather" to everyone
- t.customLinks[fromId] is from target's perspective, not from's → asymmetric chains

### linkNodes(nodeA, nodeB, labelAtoB, labelBtoA)
Direct customLinks writer — does NOT go through applyInferredRel routing.
Always writes to customLinks regardless of label type.
Used for explicit structural cascade assignments.

### Known Issues (PAUSED — to revisit)
- No known auto-assign issues remaining as of Session 10
- cleanFalseConnections runs after every autoAssignToYou call as a safety net
- If false connections appear, check browser console for `cleanFalseConnections: removed N` messages

### Session 10 Fixes Applied
- Siblings copy anchor's parents[] and auto-assign runs as child-of-each-parent
- Spouse addition links co-parent to children in form submit (not dependent on autoAssignToYou)
- Inference table: no more Step defaults, 3 bugs fixed, 11 rules added
- cleanFalseConnections validates blood/in-law/sibling paths structurally

---

## Client-Side Encryption (Phase 2 — Session 10)

**Algorithm**: AES-256-GCM via Web Crypto API
**Key derivation**: PBKDF2 from Firebase UID (100k iterations, SHA-256, salt: 'twygie-encryption-v1')
**IV**: 96-bit random per save, prepended to ciphertext

**Save flow**: `people[]` → JSON → AES-GCM encrypt → base64 (chunked) → Firestore
**Load flow**: Firestore → base64 → AES-GCM decrypt → JSON → `people[]`

**Firestore document (post-encryption)**:
```
familyTrees/{uid}
  encryptedData: "base64_blob"    // encrypted people[]
  encryptionVersion: 1
  ownerEmail: "user@example.com"  // plaintext
  nodeCount: number               // plaintext
  updatedAt: timestamp
```

**Migration**: auto-detects legacy `people` field → encrypts → saves as `encryptedData` → logs to console
**Safety**: `treeLoaded` flag blocks saves until Firestore load succeeds. Demo mode blocks saves entirely.

---

## Export (Session 10)

**PNG**: Clone SVG → set viewBox → embed styles + dark bg → render to canvas at 2x → download
**PDF (jsPDF from CDN)**:
- Page 1: Cover sheet (logo, family name, stats, date)
- Page 2: Table of contents
- Page 3: Tree visualization (auto landscape/portrait)
- Page 4+: Member directory (photos, names, rels, DOB, age, DOD, stories, connections)
- Footers + page numbers on all pages
- Filters placeholder story text

---

## Timeline Page (Session 10)

**File**: timeline.html → /timeline (cleanUrls)
**Stack**: Same Firebase auth + encryption as main app

**Layout**:
- Single horizontal line at 68% height
- Nodes above the line with connectors dropping down
- Filled circles (photo or initials), first name below
- Overlapping birth years → gold count badge → hover shows member list
- Year markers every 5 years, decades emphasized, months when zoomed

**Dual Scroll Bar System**:
- Horizontal bar (bottom at 76%): scrubs chronologically, density-aware brightness, green "You" tick
- Vertical bar (right at 32px): zoom depth (Overview→Decade→Year→Month), exponential scale
- Both: dock-like hover magnification effect
- Timeline range padded symmetrically around isYou for centered green tick

**Zoom**: `yearPx = 15 * (800/15) ^ zoomLevel` where zoomLevel 0→1
**Detail modal**: glass overlay (75% opacity, blur), mini family tree, clickable nodes, "View in Tree" link
**Reset**: restores 0.5 zoom, re-centers on isYou

---

## Tree Linking — Phase 3a (Session 10)

### Link Code Generation
- Button: "Link Trees" on every node card
- Code format: `TWYG-XXXX-XXXX` (no I/O/0/1 to avoid confusion)
- Bridge hash: `SHA-256(fullName.lowercase + '|' + birthYear)` — name + year only (not month/day)
- Stored in `linkInvites/{code}` with 7-day expiry

### Link Acceptance Flow
1. User enters code in Settings → Linked Trees → Manage Linked Trees
2. Fetch invite from Firestore, validate (exists, not expired, not used, not self)
3. Hash all local nodes, find one matching `invite.bridgeNodeHash`
4. Create `treeLinks/{linkId}` with both UIDs + bridge node IDs
5. Mark invite as used

### Firestore Collections
```
linkInvites/{code}
  createdBy, creatorName, bridgeNodeHash, bridgeNodeName,
  bridgeNodeId, expiresAt (7 days), usedBy, createdAt

treeLinks/{linkId}
  userA, userAName, userB, userBName,
  bridgeNodeHash, bridgeNodeName, bridgeNodeIdA, bridgeNodeIdB,
  shareLevel: {[uid]: 'bridge'|'selective'|'all'},
  sharedNodes: {[uid]: []},
  status: 'active'|'revoked', createdAt
```

### Real-Time Sync
- `subscribeActiveLinks()`: two Firestore `onSnapshot` listeners (userA + userB queries)
- Auto-merges results, only re-renders if link set actually changed
- Both sides see bridge badges appear/disappear instantly — no page refresh needed
- `loadActiveLinks()` kept as manual refresh for immediate post-action use

### Bridge Detection
- `getBridgeInfo(nodeId)`: checks `activeLinks` array for matching bridge node ID
- Returns `{linkId, otherUserName, bridgeName}` or null
- Bridge badge shown on node card: "Linked with [name]'s tree"

### Settings UI
- Settings panel: centered overlay card (not slide-in panel)
  - 380px wide, gold border, 18px radius, backdrop blur scrim
  - Scale+fade animation on open/close
- Linked Trees section: "Manage Linked Trees" button opens link modal
- Link modal: enter code input, status messages, active links list, revoke buttons

### Seed Page
- `/seed-maddy`: creates test account with Maddy + Hank(1967) + Mary(1966) + Heath(1980)
- Same encryption as main app — tree saved as AES-256-GCM encrypted blob

### Phase 3b — Bridge Display (Session 10)
- Gold dashed ring (`stroke-dasharray:4,3`, `stroke:rgba(200,168,75,0.5)`) around bridge nodes
- Slowly rotating animation (20s `bridge-spin` keyframes)
- "Linked" entry in node legend with matching dashed gold circle
- Bridge badge on card: "Linked with [name]'s tree" below relationship badge
- All visual indicators driven by `activeLinks` array (real-time via onSnapshot)

### Phase 3c — Sharing Tiers (Session 10)

**Share Toggle**: Per-link toggle in Manage Linked Trees: Bridge Only ↔ Share All
**Asymmetric**: each user controls their own side independently

**Shared Key**: `PBKDF2(sort([uidA,uidB]).join('|'), 'twygie-shared-v1')` — both sides compute independently
**Encryption**: AES-256-GCM with shared key, stored in `treeLinks/{linkId}.sharedData.{uid}`

**Shared data fields** (stripped for size):
- id, name, firstName, lastName, gender, dob, dod, birth, death, city, state, relLabel, parents, spouseOf, isYou, x, y
- NO photos (base64 too large), NO notes/stories, NO customLinks

**Deduplication**: Two-level fingerprinting
- Primary: firstName+birthYear OR fullName+birthYear → maps otherID→localID
- Aggressive fallback: firstName-only match
- All duplicate mappings used for parent/spouse ID remapping (two-pass)

**Auto-adopt**: `adoptBatch()` — standalone global function
- Sorts parents-first, multi-pass (up to 5) adoption
- Remaps old→new IDs across sharedNodes, sorted, and people[] after each adopt
- Adopted nodes flagged `_adopted:true` → double-ring visual on tree
- Preference stored on `treeLinks.autoAdopt.{uid}`, triggered at end of `loadSharedNodes()`
- `window._appReady` guard prevents auto-adopt during initial boot

**Branded Modals**: `appAlert(msg)`, `appConfirm(msg,okText,cancelText)`, `appChoice(msg,btnA,btnB,cancelText)`
- All browser confirm()/alert() replaced — dark glass aesthetic matching app

**Known gotcha**: Function scoping — never define functions inside other functions via str_replace. Always ensure closing `}` before starting new function.

### UI Polish (Session 10 — Late)
- Connections section: limited to 5, "See all N connections" button expands
- dobDisplay: full month names + comma ("January 1, 1980")
- Young node animation: removed (all nodes use standard pulse now)
- BLOOD_LABELS expanded: added in-law labels (Brother/Sister/Father/Mother-in-law, Son/Daughter-in-law, Godfather/Godmother)
- drawBranches: BOTH blood and non-blood sections re-check BLOOD_LABELS at draw time using label text, ignoring stale stored lineType
- recalcAllRelationships(force): force param bypasses autoConnections toggle check — used by adoptBatch
- Linked legend: inline SVG circle with stroke-dasharray (CSS border too small)

### Known Issues to Revisit
- In-law connection lines may not draw for adopted nodes that had lineType:'labeled' stored before BLOOD_LABELS update — re-check in next session
- Selective sharing tier (Phase 3c intermediate) not yet implemented — only Bridge Only and Share All
- Photos in shared data stripped (Firestore 1MB limit) — future: Firebase Storage with URLs

### Line Categories (6 total — Session 10 Final)
- Solid green:  Parent/Child (structural parents[])
- Solid orange: Sibling (customLinks lineType='sibling')
- Solid purple: Extended blood (customLinks, label in BLOOD_LABELS)
- Dashed blue:  Spouse (structural spouseOf)
- Dashed pink:  Extended non-blood / In-law (label contains '-in-law')
- Dashed purple: Non-blood (everything else — friends, godparents, custom)

**DEFAULT_LINE_COLORS**: parentChild=#64b464, spouse=#648cdc, sibling=#dc8c3c, labeled=#a064dc, inlaw=#dc6488
**lineType detection at draw time**: always derived from label text + BLOOD_LABELS. Never uses stored v.lineType.
**cleanFalseConnections**: trusts BLOOD_LABELS labels AND '-in-law' labels. Only validates non-family labeled connections.
**cleanFalseParents()**: runs after every autoAssignToYou. Removes parent-child where "parent" has an in-law customLink to child.

---

## Session 13 — View Modes + Immersive + Birthdate Awareness

### Immersive Mode (js/immersive.js ~270 lines)
- Three.js r128 via CDN
- **Transparent canvas** (`alpha:true`) — app's warm `#atm` gradient shows through
- Spherical shell layout: isYou at center, family on Fibonacci sphere (IMM_SPHERE_R=200)
- **Zoom-to-node**: Click → camera orbits to node (immTargetLookAt + immTargetRadius=80) → selectNode() card overlay after 800ms
- **Line glow pulse**: `baseOp + sin(t*1.2+i*0.5)*0.2` — solid lines 0.6±0.2, dashed 0.5±0.2
- **Node emissive pulse**: base 0.6-1.0 + ±0.25 oscillation; selected glow 0.35+±0.12
- **View mode filtering**: immRefreshLines() called from setTreeMode() when layoutMode==='immersive'
- **Exit button**: Outside immersive-wrap (z-index 101), solid gold, show/hide in enter/exit
- In immersive mode: hdr-left + hdr-right hidden, only view toggle visible centered

### Header Structure (3-section)
```html
#hdr (flex, space-between)
  .hdr-left: logo + #mcount
  .hdr-center: .toggle-stack > .view-toggle + .layout-toggle
  .hdr-right: #save-ind + #btn-add-member + timeline link + gear button
```
- User avatar removed — gear icon opens settings
- Export moved to Settings → Export section (collapsible)
- Gold hover tint on all interactive elements: `rgba(200,168,75,.12)` bg + `var(--gold)` text

### Traditional Layout (layoutTraditional in firebase.js)
- Classic pedigree binary tree, recursive from isYou
- placeParents(childId, childX, childY, spread): spread×1.2 each generation
- COUPLE_GAP=80px, initial spread=300px
- Spouses toward outside (away from center line)
- Straight angular lines in render.js: `M x1 y1 L x1 midY L x2 midY L x2 y2`

### Birthdate Awareness
- `dobWarnDismissed` persisted to Firestore userSettings
- `persistDobWarn()` in firebase.js
- Timeline Missing Twygs modal: `window._saveDob(pid)` global function
- Save: `deriveKey(uid)` → `encrypt(key, people)` → `familyTrees/{uid}.set({encryptedData, encryptionVersion:1, ownerEmail})`
- encrypt() uses for-loop btoa (not spread operator — crashes on large data)

### Timeline Page
- Has own `#atm` div for warm atmosphere (inline styles in timeline.html)
- `encrypt(key,data)` and `decrypt(key,b64)` functions local to timeline.js
- Firestore collection: `familyTrees` (NOT `trees`)

### Leafs Storage (Final — Session 14)
- Stored as `encryptedLeafs` field in `familyTrees/{uid}` document
- NOT a separate Firestore collection (rules weren't deployed, caused silent write failures)
- `saveLeafs()` → `userDoc().update({encryptedLeafs, leafCount})`
- `loadLeafs()` → `userDoc().get()` → `d.encryptedLeafs` → `decryptPeople()`
- Same AES-256-GCM encryption as tree data
- All CRUD functions are async and await saveLeafs()

### Leafs UI Functions (ui.js)
- `openLeafModal(personId, editId)` — opens add/edit modal
- `closeLeafModal()` — closes modal
- `submitLeaf()` — async, collects form data, calls addLeaf/editLeaf
- `openLeafDetail(leafId)` — appChoice with full content + Edit/Delete
- `openLeafList(personId)` — appAlert with all leafs for a node
- `formatLeafDate(d)` — formats {year,month,day} to readable string
- `closeAllModals()` — closes app-modal-bg

### Tag System
- Toggle pill buttons with `.leaf-tag-btn[data-tid]` + `.active` class
- Replaces checkbox approach (was invisible against dark bg)
- Multi-node: primary node always tagged, others optional

### Orb Collision Engine (js/orb-engine.js — Session 14)
- Loaded before render.js in script order
- OrbEngine class: orbs Map, obstacles array, rAF loop
- Config: repulsionRadius:60, minimumSeparation:28, pushStrength:1.2, damping:0.75
- Static obstacles: `engine.addObstacle(x, y, radius)` — twyg nodes at 50px radius
- Physics: repulsion → orb separation → obstacle avoidance → spring return → damping → clamp → integrate
- `updateLeafPositions(orbs)`: callback updates SVG transform + connection line paths
- Drag: `leafDragActive` (var in render.js, checked in ui.js mousemove)
- Drag origin reads `orb.x/orb.y` at mousedown (not stale home position)
- `snapLeafFromNodes(x, y, leafId)`: 2-phase drop resolution
