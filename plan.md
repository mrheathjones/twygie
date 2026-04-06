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
- [x] Young nodes: fast double-flash shimmer (opacity only, no bounce)
- [x] Connection-count driven glow size — more connections = bigger/brighter halo
- [x] Node colors configurable per category (You, Spouse, Parent, Child, Sibling, Grandparent, Extended, Deceased, Young)
- [x] Configurable "young" age threshold (default 17 and under)
- [x] Photo support on nodes (circular crop, shown on hover tooltip)

### Relationships & Connections
- [x] Full relationship type list (Son, Daughter, Father, Mother, Grandfather, Grandmother, etc.)
- [x] Custom relationship types (created in Settings)
- [x] Add a Twyg without specifying relationship (standalone node)
- [x] Add Connection modal — links any two existing nodes
- [x] Grandparents / grandchildren stored as customLinks (not parents[])
- [x] Siblings stored as customLinks (no false grandparent connections)
- [x] Gender-aware relationship labels (Father vs Mother vs Parent)
- [x] Delete any connection type from the node card
- [x] isYou node shown as "(You)" in Add Connection list

### Connection Lines
- [x] Color-coded lines: Parent/Child (green), Sibling (orange), Extended blood (purple solid), Spouse (blue dashed), Non-blood (purple dashed)
- [x] Blood family = solid bold lines
- [x] Non-blood = dashed lines
- [x] Tree View: shows only parent-child, sibling, spouse
- [x] All Twygs View: shows all connection types
- [x] Dual view buttons with active highlight (Tree view / All Twygs)
- [x] Line colors fully configurable in Settings

### Node Cards
- [x] Transparent overlay card (glassmorphism) on click
- [x] Shows: name, DOB, birthplace, relationship badge, story, connections
- [x] Edit mode: first/last name, gender, DOB (month/day/year), city/state, photo, story
- [x] State dropdown (50 US states + territories)
- [x] Death date toggle (month/day/year)
- [x] Photo picker (Base64, stored in Firestore)
- [x] "Add a Twyg" button — opens add modal pre-connected to this node
- [x] "Add Connection" button — link to another node
- [x] "Remove" with descendant cascade choice

### Forms
- [x] "Add a Twyg" modal with full fields + photo picker
- [x] Separate first/last name fields
- [x] Date of birth (month/day/year dropdowns/inputs)
- [x] Deceased toggle with date of death
- [x] State dropdown
- [x] Relationship dropdown with grouped options + custom types

### Members Panel
- [x] Clickable member count in header
- [x] Slide-in panel listing all members grouped by generation
- [x] Search by name
- [x] Click member to zoom and open card

### Settings Panel
- [x] Account info + sign out
- [x] Default view: Tree View / All Twygs (persisted to Firestore)
- [x] Line color pickers (per relationship type)
- [x] Node color pickers (per category)
- [x] Young age threshold input
- [x] Custom relationship types (add/remove)
- [x] Tree stats (member count, generation count)
- [x] All settings saved to Firestore `userSettings/{uid}`

### Authentication & Data
- [x] Firebase Auth: Email/Password, Google, Apple sign-in
- [x] Password reset flow
- [x] Auto-prefill isYou node from Firebase display name on first login
- [x] Firestore data persistence per user (`familyTrees/{uid}`)
- [x] Auto-save with debounce (1.8s after last change)
- [x] "Saved" indicator
- [x] Loading screen: "Picking up all of your Twygs…"

### Deployment
- [x] GitHub repo: github.com/mrheathjones/twygie
- [x] Vercel auto-deploy on every push
- [x] Live at: twygie.vercel.app
- [x] Domain: twygie.com (purchased, DNS connection pending)
- [x] Firebase project: twygie (console.firebase.google.com)

---

## 🔜 Planned / Ideas

### Near-term
- [ ] Connect twygie.com domain to Vercel
- [ ] Add twygie.com to Firebase authorized domains
- [ ] Mobile-optimized layout improvements
- [ ] Share tree (read-only link)
- [ ] Export tree as image/PDF

### Medium-term
- [ ] Collaborative trees (invite family members)
- [ ] Timeline view (horizontal by birth year)
- [ ] Search within tree
- [ ] Import from GEDCOM (standard genealogy format)
- [ ] Merge duplicate nodes

### Long-term
- [ ] Mobile app (iOS/Android)
- [ ] AI-assisted story generation from notes
- [ ] Family stats / insights dashboard
- [ ] Notifications (birthdays, anniversaries)
- [ ] Private family spaces with roles (admin, viewer, editor)

---

## Infrastructure

| Service | Purpose | Details |
|---|---|---|
| **Vercel** | Hosting | Free tier, auto-deploy from GitHub |
| **Firebase Auth** | Authentication | Email, Google, Apple |
| **Firestore** | Database | `familyTrees/{uid}`, `userSettings/{uid}` |
| **GitHub** | Source control | github.com/mrheathjones/twygie |

---

## Branding Notes
- App name: **Twygie**
- Each family member = a **Twyg**
- Loading text: *"Picking up all of your Twygs…"*
- View modes: **Tree View** / **All Twygs**
- Add member button: **+ Add a Twyg**
- Domain: **twygie.com**
- Color: `#c8a84b` (gold)
