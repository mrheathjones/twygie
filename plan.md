# Twygie — Project Plan

## What is Twygie?
An interactive, beautiful family tree web app. Each family member is a "Twyg" — a glowing node on a living tree. Users can map their entire family, capture stories, add photos, and visualize relationships through color-coded connection lines.

---

## ✅ Completed Features

### Core Tree
- [x] Organic tree visual with glowing, pulsating nodes
- [x] Auto-layout: parents above, children below the isYou node
- [x] Bezier curve branch lines between nodes
- [x] Pan, zoom, pinch-to-zoom on canvas
- [x] Drag nodes to reposition manually (positions saved)
- [x] "Fit to screen" button

### Node Visuals
- [x] isYou node always brightest (larger glow, faster pulse)
- [x] Young nodes: fast double-flash shimmer — opacity only, no bounce/scale
- [x] Connection-count driven glow — more connections = bigger/brighter halo (22 + cc*4, cap 48px)
- [x] Node colors configurable per category (You, Spouse, Parent, Child, Sibling, Grandparent, Extended, Deceased, Young)
- [x] Configurable "young" age threshold (default 17 and under)
- [x] Pulse color driven by nodeColors settings (not hardcoded CSS)
- [x] Photo support on nodes (circular crop, shown on hover tooltip)

### Relationships & Connections
- [x] Full relationship type list based on Table of Consanguinity
  - Direct: parents, grandparents, great-grandparents, great-great-grandparents (and descending)
  - Siblings (half, step)
  - Aunts/Uncles (through great-grand)
  - Nephews/Nieces (through grand)
  - First/Second/Third Cousins (Once/Twice/Thrice Removed)
  - In-laws, Step-relations, Godparents, Guardian, Family Friend
- [x] Custom relationship types (created in Settings)
- [x] Add a Twyg without specifying relationship (standalone node)
- [x] Add Connection modal — full consanguinity dropdown
- [x] Edit existing connection — pencil icon opens inline dropdown to change type
- [x] Delete any connection type — handles all types (parent, child, sibling, spouse, labeled)
- [x] Grandparents/grandchildren stored as customLinks (not parents[]) — prevents false sibling lines
- [x] Siblings stored as customLinks (lineType:'sibling') — no parent inheritance
- [x] Only directParentLabels (Father/Mother/Stepfather/Stepmother) go into parents[] array
- [x] Gender-aware relationship labels
- [x] isYou node shown as "(You)" in Add Connection list

### Auto-Connections Engine
- [x] Kinship composition table (inferRelToYou) — infers from anchor relationship + new relationship
- [x] Full consanguinity support: cousins, grand-uncles, great-grandparents, in-laws, etc.
- [x] Propagates to isYou's spouse — spouse also gets auto-assigned when relevant
- [x] Direct parent/child inferences use parents[] (green line), not customLinks (purple)
- [x] Spouse's child = Son/Daughter (your child), not Stepchild
- [x] Step-relationships: in-laws still inferred through step-parents
- [x] applyInferredRel() helper routes to correct storage type automatically
- [x] Enable/disable toggle in Settings (persisted to Firestore)

### Connection Lines
- [x] Color-coded: Parent/Child (green solid), Sibling (orange solid), Extended Roots (purple solid), Spouse (blue dashed), Extended Bonds (pink dashed), Bonds (purple dashed)
- [x] Blood = solid; Non-blood = dashed — BLOOD_LABELS set drives this
- [x] Cross-marriage detection: blood labels crossing a marriage boundary render as Extended Bonds
- [x] 4 view modes with active highlight:
  - Tree View: parent-child, sibling, spouse only
  - All Twygs: everything including extended family
  - Roots: blood relatives only — no in-laws or bonds
  - Bonds: non-blood only — spouse, in-laws, family friends
- [x] Line colors fully configurable in Settings per type

### Node Cards
- [x] Glassmorphism overlay card on click with zoom-to-node
- [x] Shows: name, DOB, birthplace, relationship badge, story, all connections
- [x] Edit mode: all fields including deceased toggle with death date, state dropdown, photo
- [x] Death date display: "b. 1940 — d. 2020" format on card
- [x] Edit existing connection inline (pencil icon → dropdown)
- [x] Delete any connection (× on each chip)
- [x] "Add a Twyg" button pre-connected to this node
- [x] "Add Connection" button
- [x] "Remove" with two-step cascade choice

### Forms — Add a Twyg
- [x] Separate first/last name fields; gender; DOB month/day/year
- [x] Deceased toggle with DOD fields
- [x] City + full US state dropdown
- [x] Photo picker with preview
- [x] Full consanguinity relationship dropdown with custom types
- [x] Standalone (no relationship) option

### Members Panel
- [x] Slide-in panel with all members grouped by generation
- [x] Search; click to zoom and open card

### Settings Panel — collapsible sections
- [x] Account: avatar, name, email, sign out + tree stats (members + generations)
- [x] Tree View: default view (Tree View / All Twygs)
- [x] Connections: Auto-assign toggle + custom connection type manager
- [x] Appearance: node colors + line colors per type
- [x] Advanced: young age threshold
- [x] Save button animates green "✓ Saved!" — decoupled from Firestore async
- [x] All settings persisted to Firestore userSettings/{uid}

### Auth & Data
- [x] Firebase Auth: Email/Password, Google, Apple
- [x] Auto-prefill isYou from Firebase display name on first login
- [x] Firestore per-user persistence (familyTrees/{uid}, userSettings/{uid})
- [x] Auto-save with 1.8s debounce; header "Saved" indicator
- [x] Loading: "Picking up all of your Twygs…"

---

## 🔜 Planned

### Near-term
- [ ] Connect twygie.com to Vercel + add to Firebase authorized domains
- [ ] Mobile layout polish
- [x] Demo Mode for testing (Session 10)
- [x] Data protection — treeLoaded flag prevents wipe on failed load (Session 10)
- [x] **Phase 1 — Firestore Security Rules** (Session 10)
- [x] Export tree as Image/PDF (Session 10)
- [x] Timeline view — horizontal timeline page with zoom (Session 10)

### Medium-term
- [x] **Phase 2 — Client-Side Encryption** ✅ DONE (Session 10)
- [x] Timeline view (by birth year) ✅ DONE (Session 10)
- [x] Export tree as image/PDF ✅ DONE (Session 10)
- [ ] GEDCOM import (Ancestry/FamilySearch)
- [x] **Anniversary Capture** (Session 10)
  - When spouse connection is made, branded modal prompts for Wedding Date
  - Shows 💍 Married [date] · [years] in node card info section
  - Editable in the edit form when node has a spouse
- [x] **View Modifiers** — layout modes for the tree (Session 12-13)
  - Compact: 80px spacing, tight cluster
  - Relaxed: 165px spacing (default, unchanged)
  - Expanded: 300px spacing, breathing room
  - Traditional: Classic pedigree chart — recursive binary tree, straight angular lines (WIP — close but needs polish)
  - ✦ Immersive: Three.js 3D mode — spherical layout, zoom-to-node, glow pulse, view mode filtering
- [x] **Birthdate Awareness** (Session 13)
  - Missing Twygs indicator + modal on timeline with inline birthdate entry
  - Creation warning with "Don't remind me again" checkbox
  - Settings reset for birthdate reminders
- [x] **Header Cleanup** (Session 13) — 3-section layout, removed Fit to Screen/Export/avatar, renamed buttons, gold hover tint
- [x] **Timeline Polish** (Session 13) — warm atmosphere background, gold hover, underline fix

### Long-term
- [x] **Phase 3a — Tree Linking infrastructure** (Session 10) — link codes, bridge nodes, real-time sync
- [x] **Phase 3b — Bridge Display** (Session 10) — gold dashed ring on tree nodes, legend entry
- [x] **Phase 3c — Sharing Tiers** (Session 10) — Share All/Bridge Only, auto-adopt, shared encryption, branded modals
- [ ] **Phase 3c follow-up** — in-law line rendering for adopted nodes, Selective sharing tier
- [ ] **Link Tree Enhancement**
  - Send link invitation via email, text, or in-app notification
  - Click node → Link Twyg → delivery options (retains Share All + Auto-Adopt)
    - Email
    - Text
    - Notify/Share
    - Generate Code
- [ ] **Leafs** — new tab for shared stories & memories
  - Stories shared by nodes: memories, funny stories, photos, etc.
  - Share access to individual nodes so they can contribute their own stories
  - Stories can be "linked" to other nodes (like Add Connection)
- [ ] **Timeline Enhancement** — chronological family story
  - String together event dates + Leafs to tell the family story
    - Person A + Person B got married
    - Person C + Person D had a baby
    - Person E passed away
  - Interactive timeline of all family events
- [ ] **Child Accounts**
  - Create accounts for children under a certain age
    - Option: email or username-based
    - Option: password or account PIN for easy use
    - Ability to reset password/PIN
  - Manage child account permissions
    - Allow/disallow features: CRUD nodes, stories, timeline, contribute
- [ ] Mobile app (iOS/Android)
- [ ] AI story generation from notes
- [ ] Birthday/anniversary notifications
- [ ] Targeted communications (email campaigns to users)

---

## Privacy & Security Architecture

### Design Philosophy
Follow Apple's privacy approach: data minimization, on-device processing, encryption by default, user control, transparency. Users should be able to trust that nobody — not even Twygie's admin — can read their family data.

### What's Private vs. What's Visible to Admin

| Data | Encrypted? | Admin can see? | Purpose |
|---|---|---|---|
| Email address | No | Yes | User comms, support, marketing |
| Display name | No | Yes | Account identification |
| Auth provider (Google/Apple/Email) | No | Yes | Support, analytics |
| Account creation / last login | No | Yes | Engagement metrics |
| App settings (theme, toggles) | No | Yes | Support, debugging |
| Tree stats (node count, generations) | No | Yes | Usage analytics |
| **Family member names** | **Yes** | **No** | Privacy |
| **Dates of birth / death** | **Yes** | **No** | Privacy |
| **Birthplaces, stories, photos** | **Yes** | **No** | Privacy |
| **Relationship labels & connections** | **Yes** | **No** | Privacy |

### Phase 1 — Lock Down Firestore (NOW)

**Goal**: Each user can only read/write their own data. No code changes needed.

**Firestore Security Rules**:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Family tree data — owner only
    match /familyTrees/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // User settings — owner only
    match /userSettings/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // Tree links — both linked users can read; only participants can write
    match /treeLinks/{linkId} {
      allow read: if request.auth != null &&
        (request.auth.uid == resource.data.userA || request.auth.uid == resource.data.userB);
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null &&
        (request.auth.uid == resource.data.userA || request.auth.uid == resource.data.userB);
    }
    // Deny everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Status**: Ready to deploy in Firebase Console → Firestore → Rules.

### Phase 2 — Client-Side Encryption (MEDIUM-TERM)

**Goal**: Encrypt the `people[]` array in the browser before saving to Firestore. Firestore only stores encrypted blobs. Zero-knowledge architecture.

**How it works**:
1. User logs in → encryption key derived from credentials via Web Crypto API (PBKDF2)
2. On save: `people[]` → JSON.stringify → AES-GCM encrypt → base64 → Firestore
3. On load: Firestore → base64 → AES-GCM decrypt → JSON.parse → `people[]`
4. Key never leaves the browser. Firestore never sees plaintext family data.

**Firestore document structure (post-encryption)**:
```
familyTrees/{uid}
  encryptedData: "base64_encrypted_blob"   // the people[] array
  encryptionVersion: 1                     // for future key rotation
  ownerEmail: "user@example.com"           // plaintext — for admin/comms
  nodeCount: 47                            // plaintext — for analytics
  generationCount: 5                       // plaintext — for analytics
  updatedAt: timestamp                     // plaintext
```

**Key management considerations**:
- Key derived from Firebase Auth UID + a user-chosen passphrase (optional)
- If no passphrase: key derived from UID alone (encrypted at rest, but admin with UID could theoretically derive key)
- If passphrase: true zero-knowledge (even with UID, data is unreadable without passphrase)
- Recovery: passphrase-based recovery key (like Apple's recovery key for iCloud)
- Key rotation: bump encryptionVersion, re-encrypt on next save

**Migration path**: On first load after encryption ships, detect unencrypted data (no `encryptedData` field), encrypt it, save encrypted version, delete plaintext `people` field.

### Phase 3 — Tree Linking (LONG-TERM)

**Goal**: Let users connect their trees through shared family members without exposing private data.

#### The Bridge Node Model

Each user's tree stays fully encrypted and private. Linking happens through **bridge nodes** — minimal shared reference points where two trees overlap.

#### Linking Flow

**Step 1 — Invite**: User A taps "Link Trees" on a node (e.g., Grandma Dorothy). Twygie generates a link code: `TWYG-A8F3-XK2P`. The code contains only a hash of Dorothy's name + DOB — enough to verify identity, not enough to reconstruct data.

**Step 2 — Accept**: User B enters the code. Twygie checks: "Do you have a node matching this hash?" If yes, confirms the link. If no, shows "No matching Twyg found."

**Step 3 — Bridge Created**: Both trees now have a bridge at Dorothy. Each user sees "Also in [other user's name]'s tree" on Dorothy's card. Neither can see the other's tree yet.

#### Three Sharing Tiers (Asymmetric)

Each user controls their own side independently. You can Share All while the other person shares nothing.

**Tier 1 — Bridge Only (default)**:
- Only the bridge node is visible to the other user
- Shows: name, DOB, relationship label on the bridge node
- Everything else in your tree is invisible

**Tier 2 — Share Specific Nodes**:
- You select individual nodes to share with the linked user
- Each shared node appears in their tree as a read-only "linked node"
- Visual indicator (chain icon, different glow) distinguishes linked vs. owned nodes
- Shared fields are opt-in per node (name always shared; DOB, story, photo optional)

**Tier 3 — Share All**:
- One toggle: "Share entire tree with [user]"
- Every node in your tree becomes visible as read-only linked nodes
- Their tree and your tree visually merge
- Relationship lines connect across both trees
- Indirect connections become visible (your wife's cousin = their neighbor's son)

#### Sharing is Revocable

- Share All → Share Specific → Bridge Only at any time
- Revoking removes shared data from the other user's view immediately
- Deleting your account revokes all links and deletes all encrypted data

#### Data Model

```
treeLinks/{linkId}
  userA: uid
  userB: uid
  bridgeNodeHash: "sha256(name+dob)"       // for matching
  shareLevel: {
    [userA_uid]: 'bridge' | 'selective' | 'all',
    [userB_uid]: 'bridge' | 'selective' | 'all'
  }
  sharedNodes: {
    [userA_uid]: ['nodeId1', 'nodeId2'],    // only used when 'selective'
    [userB_uid]: []
  }
  status: 'pending' | 'active' | 'revoked'
  createdAt, updatedAt

linkInvites/{code}
  createdBy: uid
  bridgeNodeHash: "sha256(name+dob)"
  bridgeNodeName: "encrypted_name"          // encrypted with invite-specific key
  expiresAt: timestamp                      // 7 days default
  usedBy: uid | null
```

#### Encryption for Shared Data

When sharing nodes with a linked user, the data is re-encrypted with a **shared key** derived from both users' keys (Diffie-Hellman key exchange via Web Crypto API). This means:
- Shared data is encrypted in transit and at rest
- Only the two linked users can decrypt it
- Twygie admin cannot read shared data
- If either user revokes the link, the shared key is discarded

---

## Infrastructure

| Service | Purpose |
|---|---|
| Vercel | Hosting — auto-deploy from GitHub main |
| Firebase Auth | Email, Google, Apple sign-in |
| Firestore | familyTrees/{uid}, userSettings/{uid} |
| GitHub | github.com/mrheathjones/twygie |

**Vercel Team ID:** team_nrD8szUQ8HeSzhD71HrIvJGB
**Vercel Project ID:** prj_YZdqrjF8rTlV7jOf3gb0Z0DF0ge4
**Live URL:** twygie.vercel.app

## Branding
- App: **Twygie** | Member: **Twyg** | Loading: *"Picking up all of your Twygs…"*
- Modes: **Tree View** / **All Twygs** | Add: **+ Add a Twyg**
- Gold: `#c8a84b`

---

## Relationship Engine v2 Status (Updated Session 12)

### Working ✓
- Three-layer model: Structural (parents[]/spouseOf) + Declared (relationships[]) + Computed (computeRelationship)
- All cascades working: sibling-of-sibling, parent-to-sibling, sibling→uncle/nephew
- isDirChild, isDirParent, isSibRel, isSpouseRel structural cascades
- computeRelationship: common-ancestor BFS with spouse bridge for in-laws
- Order-independent: top-down, bottom-up, or mixed add orders all produce correct relationships
- Spouse-sibling guard: reclassifies only when married to the other's actual sibling
- Renderer reads relationships[] category directly — no runtime inference
- Migration: customLinks auto-converted to relationships[] on load
- Burn Twygs: clean start option in Settings → Advanced
- 235 lines of legacy workarounds removed from render.js

### Remaining ⚠️
- 154 customLinks references remain (dual-write for backward compat)
- Declared-only relationships (e.g. cousin without uncle) don't backfill when intermediate nodes are added
- AI Relationship Engine not yet implemented (natural language input, consistency checking)

---

## Relationship Engine v2 — Design Document

### Problem Statement

The current relationship engine stores all non-direct relationships (uncle, cousin, grandparent, nephew) as flat `customLinks` — labeled key-value pairs between arbitrary node pairs. This creates systemic issues:

1. **Structural relationships are indistinguishable from social ones.** "Uncle" between two nodes is stored identically to "Family Friend." The engine can't tell which are derivable from the tree and which are user-defined.

2. **Incomplete parent chains.** When a grandfather is added, the system stores a "Grandfather" customLink to isYou instead of creating proper parent-child links (grandpa→parent→isYou). This means the structural tree is perpetually incomplete, requiring ever-more-complex workarounds (inferred parents, sibling propagation, transitive expansion).

3. **Rendering mixed with inference.** `drawBranches()` re-derives relationship types at render time using `BLOOD_LABELS`, `crossesMarriage()`, BFS traversals, etc. It should just read a pre-computed relationship type.

4. **Auto-assign is fragile.** The inference loop, `getRelToYou_for`, `cleanFalseConnections`, and `recalcAllRelationships` are collectively ~500 lines of workarounds for the incomplete data model.

### Design Principles

1. **Any relationship can be created at any time** regardless of whether intermediate nodes exist. You can add a cousin without the uncle/grandparent chain being present.

2. **Relationships are structural when possible, declared when not.** The engine TRIES to build proper parent-child chains but falls back to declared relationships when the chain is incomplete.

3. **Rendering is separate from inference.** A resolver computes relationship types; the renderer just reads them.

4. **The AI Relationship Engine plugs in cleanly.** The declared relationship layer is exactly where an AI resolver would operate — converting natural language into structured relationship data.

### Architecture: Three Layers

#### Layer 1 — Structural (parents[], spouseOf)

The skeleton of the family tree. Always correct when present.

```
Person {
  id, name, gender, ...
  parents: [parentId, ...]     // direct parent-child links
  spouseOf: partnerId | null   // marriage link
}
```

**Rules:**
- Adding Father/Mother/Stepfather/Stepmother → `target.parents.push(newId)`
- Adding Son/Daughter → `newNode.parents.push(targetId)`
- Adding Husband/Wife/Partner → `spouseOf` both directions
- Adding Grandfather → create grandpa, then add grandpa to parent's `parents[]` IF the parent exists. If parent doesn't exist, store as declared (Layer 2).

**What structural links determine:**
- Parent-child lines (green solid)
- Spouse lines (blue dashed)
- Sibling detection (shared parents)
- Generation positioning (layout)

#### Layer 2 — Declared (relationships[])

User-stated relationships that may or may not have structural backing. Replaces the current `customLinks` object.

```
Person {
  ...
  relationships: [
    {
      targetId: "u5",
      label: "Uncle",            // human-readable label
      category: "blood",         // "blood" | "bond" | "custom"
      structural: false          // true if backed by parents[]/spouseOf chain
    }
  ]
}
```

**Categories:**
- **blood**: Derived from shared ancestry. Uncle, Cousin, Grandparent, Nephew, Sibling, etc. Renders as solid lines (Extended Roots).
- **bond**: Connected through marriage. In-laws, spouse's relatives. Renders as dashed lines (Extended Bonds).
- **custom**: User-defined social relationships. Godparent, Family Friend, Guardian, custom types. Renders as dashed lines (Bonds).

**Rules:**
- Adding "Cousin" → creates a declared relationship with `category: "blood"`, `structural: false`
- When the cousin's parent (uncle) is later added, the engine detects the structural chain is complete → sets `structural: true`
- Declared relationships with `structural: true` are validated by the tree structure; if the chain breaks (node deleted), they revert to `structural: false`

**What changes from customLinks:**
- `customLinks` is an object keyed by targetId → only one link per pair
- `relationships[]` is an array → allows the engine to store the label, category, and structural flag explicitly
- `lineType` (the old 'blood'/'sibling'/'labeled'/'inlaw') is replaced by `category` which is set at creation time, not derived at render time

#### Layer 3 — Computed (runtime only, never stored)

A resolver that determines the relationship between any two nodes.

```javascript
function computeRelationship(nodeA, nodeB) {
  // 1. Check structural: trace parents[] to find common ancestor
  //    Use generation-distance math to classify
  // 2. Check structural through spouse bridge: in-law detection
  // 3. Fallback: check declared relationships[]
  // Returns: { label, category, structural }
}
```

**This is the ONLY source of truth for what relationship exists between two nodes.** The renderer calls it. The card display calls it. The inference engine calls it.

### Rendering (Simplified)

```javascript
function drawBranches() {
  // 1. Draw parent-child lines (from parents[])
  // 2. Draw spouse lines (from spouseOf)
  // 3. Draw relationship lines (from relationships[])
  //    - category === 'blood' → solid line, Extended Roots color
  //    - category === 'bond' → dashed line, Extended Bonds color
  //    - category === 'custom' → dashed line, Bonds color
  //    - Sibling special case: solid orange (detected from shared parents OR declared)
}
```

No more `BLOOD_LABELS` set, no more `crossesMarriage()` BFS, no more runtime line type derivation. The category is pre-set when the relationship is created.

### Auto-Assign (Enrichment, Not Source of Truth)

When a new node is added:

1. **Structural cascade:** If adding a direct parent/child/spouse, update `parents[]`/`spouseOf` and cascade (co-parent children, grandparent links, etc.)

2. **Inference pass:** For each existing node, run `computeRelationship(newNode, existing)`. If a relationship is found that doesn't yet exist in `relationships[]`, add it as a declared relationship with `structural: true`.

3. **Backfill pass:** Check if any existing declared relationships with `structural: false` can now be resolved structurally. If adding uncle X completes the chain for cousin Y, update cousin Y's declaration to `structural: true`.

4. **Sibling propagation:** Relationships that are the same for all siblings (uncle, cousin, grandparent) are automatically mirrored to isYou's siblings.

### Adding Intermediate Nodes Later

**Scenario:** User adds cousin Jon without uncle Henry existing.

1. Jon is created with `relationships: [{targetId: isYou, label: "First Cousin", category: "blood", structural: false}]`
2. Solid purple line draws between Jon and isYou. Done.
3. Later, user adds Henry as Uncle to isYou.
4. Engine detects: "Henry is isYou's uncle. Jon is declared as isYou's cousin. Jon could be Henry's child."
5. Engine suggests or auto-creates: Henry→Jon parent link, sets Jon's cousin declaration to `structural: true`.

### Data Migration (one-time)

Existing `customLinks` are converted to `relationships[]`:

```javascript
// For each person with customLinks:
Object.entries(person.customLinks).forEach(([targetId, value]) => {
  const label = typeof value === 'string' ? value : value.label;
  const oldType = typeof value === 'string' ? 'labeled' : value.lineType;

  // Determine category
  let category;
  if (oldType === 'sibling') category = 'blood';
  else if (label.includes('-in-law')) category = 'bond';
  else if (BLOOD_LABELS.has(label)) category = 'blood';
  else category = 'custom';

  person.relationships.push({
    targetId,
    label,
    category,
    structural: false  // will be validated by computeRelationship on next load
  });
});
delete person.customLinks;
```

### Edge Cases

**Deleting an intermediate node:**
- If uncle is deleted, cousin Jon's declaration stays (`structural: false`). The line still draws. The user can add the uncle back later.

**Conflicting declarations:**
- If user declares A as "Uncle" and also as "Family Friend", both are stored. The renderer draws both lines. The card shows both connections.

**Self-referential loops:**
- `computeRelationship` has a depth limit (8 generations) to prevent infinite loops.

**Multiple common ancestors:**
- When two nodes share multiple ancestors (e.g., through both parents), `computeRelationship` uses the shortest path.

### Implementation Plan

**Phase 1 — Data model migration**
- Add `relationships[]` to Person schema
- Write migration: `customLinks` → `relationships[]`
- Update `saveTree`/`loadTree` to handle new format
- Burn Twygs: clean start option ✅ (implemented)

**Phase 2 — Renderer refactor** ✅ COMPLETE
- `drawBranches()` reads `relationships[]` category directly
- Removed auto-detected sibling section (155 lines), bloodFamily BFS (60 lines), crossesMarriage (12 lines)
- render.js: 764 → 530 lines

**Phase 3 — Auto-assign simplification** ✅ COMPLETE
- `computeRelationship()` as single source of truth (parameter order fixed)
- Three cascades: sibling-of-sibling, parent-to-sibling, sibling→uncle/nephew
- isDirParent expanded to check ALL children of new parent
- Spouse-sibling guard narrowed to actual in-law cases
- getRelToYou badge: 40 → 6 lines

**Phase 4 — UI updates** ✅ PARTIAL
- Card connections display reads `relationships[]` with customLinks fallback
- Tooltip fixed (consistent show/hide mechanism)
- Edit/delete connection updates both relationships[] and customLinks

**Phase 5 — AI Relationship Engine (future)**
- Natural language input → AI resolves to label + category
- AI validates tree consistency
- AI suggests missing intermediate nodes

## Session 11 — Modular Refactoring + Features (April 8, 2026)

### Modular Refactoring (30+ commits)
- Split 5,186-line monolith into 24 modular files (3 HTML + 9 CSS + 12 JS)
- index.html → app.html (renamed for Vercel cleanUrls compatibility)
- login.html: 523 → 150 lines + login.css + login.js
- timeline.html: 609 → 45 lines + timeline.css + timeline.js
- 507 variable/function renames for readability
- 60 inline onclick handlers → addEventListener via initEventListeners()
- 75 → 31 inline styles, 5 dead functions removed, 7 duplicate class attributes fixed
- Module documentation headers with DEFINES/READS/WRITES dependency maps
- 12 console.log → debug() gated utility (window.TWYGIE_DEBUG)
- family-tree.html monolith deleted after full validation

### New Features
- **4 View Modes**: Tree View, All Twygs, Roots (blood only), Bonds (non-blood only)
- **Deceased Toggle**: in edit card with death date fields, "b. 1940 — d. 2020" display
- **Deceased Node Color**: changed from blue (#6b9ec2) to muted red (#c27070)
- **Aunt/Uncle/Nephew/Niece-in-law**: added to dropdown, constants, inverse mappings
- **Cross-Marriage Line Classification**: blood labels crossing spouse boundary render as Extended Bonds
- **Legend Renames**: Nodes→Twygs, Lines→Connections, Extended blood→Extended Roots, Extended non-blood→Extended Bonds, Non-blood→Bonds

### Bug Fixes
- 404 on /app: cleanUrls processes before rewrites — renamed index.html→app.html
- gendered() not defined: rename script missed definition (const g= vs g()
- Sibling lines missing in Tree View: auto-detected siblings placed after simple-mode return
- Sibling lines deleted by cleanFalseConnections: hasSharedParent only checked parents[]
- Spouse lines missing: saveConnection only set spouseOf in one direction
- Cross-marriage detection: bloodFamily BFS expanded to trace customLinks + spouseOf check
- Auto-assign in-law suffix for spouse→blood-relative connections
