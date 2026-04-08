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
- [x] Color-coded: Parent/Child (green solid bold), Sibling (orange solid bold), Extended blood (purple solid), Spouse (blue dashed), Non-blood (purple dashed)
- [x] Blood = solid bold; Non-blood = dashed — BLOOD_LABELS set drives this
- [x] Tree View: parent-child, sibling, spouse only
- [x] All Twygs: everything including extended blood and non-blood
- [x] Dual view buttons with active highlight (Tree view / All Twygs)
- [x] Line colors fully configurable in Settings per type

### Node Cards
- [x] Glassmorphism overlay card on click with zoom-to-node
- [x] Shows: name, DOB, birthplace, relationship badge, story, all connections
- [x] Edit mode: all fields including death date toggle, state dropdown, photo
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
- [ ] **View Modifiers** — layout modes for the tree
  - Compact: nodes cluster close in a tight orb pattern
  - Relaxed: nodes spread out a bit (current default)
  - Expanded: exploded view like stars in space
  - Traditional: classic top-down family tree layout

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

## Auto-Assign Status (Updated Session 9)

### Working ✓
- Child from either parent gets grandparents from BOTH sides
- Child node draws green line (parents[]) not purple (customLinks)
- Spouse's child = Son/Daughter (not Stepchild)
- Spouse gets auto-assigned when new node is added
- In-laws assigned when spouse is added
- Full consanguinity chain: cousin degrees, great-grandparents, etc.
- Recalculate button in Settings → Connections

### Paused / Known Issues ⚠️
- ~~Alternating parent additions creates wrong cross-family links~~ **FIXED Session 10**
- ~~`recalcAllRelationships` can amplify wrong links~~ **FIXED Session 10** (cleanFalseConnections runs after every auto-assign)
- ~~Root: isDirParent cascade + remaining inference chains through anchorSpouse path~~ **FIXED Session 10**

### Fixed in Session 10
1. ✅ cleanFalseConnections validates ALL customLink types structurally
2. ✅ Spouse addition links co-parent to children regardless of auto-connections toggle
3. ✅ Inference table: 3 bugs fixed, 11 missing rules added, Step defaults removed
4. ✅ Siblings copy parents and trigger full isDirChild cascade
