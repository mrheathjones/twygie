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
- [ ] Share tree (read-only link)
- [ ] Export tree as image/PDF

### Medium-term
- [ ] Collaborative trees (invite family members)
- [ ] Timeline view (by birth year)
- [ ] GEDCOM import
- [ ] Auto-assign propagates beyond isYou + spouse (to grandparents, siblings, etc.)

### Long-term
- [ ] Mobile app (iOS/Android)
- [ ] AI story generation from notes
- [ ] Birthday/anniversary notifications
- [ ] Private family spaces with roles

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
