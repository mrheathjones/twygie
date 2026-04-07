# Twygie — Technical Memory

## Stack
- **Frontend**: Single HTML file (family-tree.html / index.html) — vanilla JS + SVG
- **Auth**: Firebase Auth compat SDK v10.8.0
- **Database**: Cloud Firestore compat SDK v10.8.0
- **Hosting**: Vercel (auto-deploy from GitHub main branch)
- **Fonts**: Google Fonts — Outfit (UI), Cormorant Garamond (headings)

---

## File Structure
```
twygie/
├── family-tree.html   # Main app (authenticated tree view)
├── index.html         # Copy of family-tree.html (Vercel root)
├── login.html         # Login page
├── timeline.html      # Horizontal timeline view (/timeline)
├── vercel.json        # Route config (cleanUrls + rewrites)
├── firestore.rules    # Firestore security rules (Phase 1)
├── plan.md            # Roadmap
├── memory.md          # This file
└── journal.md         # Dev log
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
  defaultView: 'simple' | 'complex'
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
  customLinks: {            // all non-direct relationships
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

### parents[] vs customLinks
- `parents[]` = Father, Mother, Stepfather, Stepmother, Parent ONLY
- Everything else → `customLinks` with appropriate lineType
- This is the only way to prevent false sibling detection (shared parents auto-trigger sibling lines)

### lineType values
| lineType | Source | Visual | Shown in |
|---|---|---|---|
| parents[] | direct parents | Green solid bold | Both modes |
| `sibling` | customLinks | Orange solid bold | Both modes |
| `blood` | customLinks | Purple solid | All Twygs |
| `labeled` | customLinks | Purple dashed | All Twygs |
| spouseOf | direct | Blue dashed | Both modes |

### BLOOD_LABELS set
All blood relations (grandparents, aunts, uncles, cousins, etc.) → `lineType:'blood'` (solid purple).
Non-blood (in-laws, godparents, etc.) → `lineType:'labeled'` (dashed purple).

### Auto-Connections System
```
autoAssignToYou(newNodeId, anchorId, relToAnchor)
  → getRelToYou(anchorId)           // how anchor relates to isYou
  → inferRelToYou(anchorRel, newRel, gender)  // kinship algebra
  → applyInferredRel(isYou, newNode, inferred) // route to correct storage
  → repeat for isYou's spouse
```

`applyInferredRel()` routing:
- Son/Daughter/Father/Mother → `parents[]` (green line)
- Husband/Wife/Partner → `spouseOf`
- Brother/Sister/Half-* → `customLinks` with `lineType:'sibling'`
- All others → `customLinks` with blood/labeled based on BLOOD_LABELS

Key rules:
- Spouse's child = Son/Daughter (not Stepchild)
- Step-relationships don't block inference (in-laws still assigned)
- Auto-assign propagates to isYou AND isYou's spouse
- `getRelToYou_for(targetId, fromId)` enables inference from any node's perspective

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
cp family-tree.html index.html
# ALWAYS validate JS before pushing:
python3 -c "extract inline <script>" > /tmp/check.js
node --check /tmp/check.js
git add . && git commit -m "..." && git push https://{GH_TOKEN}@github.com/mrheathjones/twygie.git main
```
- Vercel auto-deploys in ~30s after push
- Rotate GH/Vercel tokens after use — never leave in chat

## Vercel IDs
- Team: `team_nrD8szUQ8HeSzhD71HrIvJGB`
- Project: `prj_YZdqrjF8rTlV7jOf3gb0Z0DF0ge4`

---

## Known Gotchas

1. **JS validation is mandatory** — always `node --check` before pushing. File truncation from Python str-replace has crashed the app multiple times.
2. **byId is stale before rebuild()** — always use `P.find(p=>p.id===id)` when accessing nodes before a rebuild, especially in autoAssign and removeConn.
3. **position:relative on settings panel** — will override the CSS class's `position:fixed`, causing the panel to float. Never add inline position style to #settings-panel.
4. **settings save was async** — `await settingsDoc().set()` used to block the UI. Now fire-and-forget. Don't revert to async.
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
