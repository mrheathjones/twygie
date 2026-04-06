# Twygie — Development Journal

---

## Session 1 — April 5–6, 2026

### Project Genesis
Started from a request for an interactive family tree website. First iteration was a parchment-aesthetic card-based tree. User requested a full redesign toward something more modern and organic.

### Design Direction
Settled on: dark background (`#04070c`), organic glowing nodes, warm atmospheric radial glow, Cormorant Garamond + Outfit fonts. Each family member became a "Twyg" — a pulsating orb on a living tree.

### Infrastructure Setup
- Created Firebase project `twygie`
- Deployed to Vercel via GitHub integration (`github.com/mrheathjones/twygie`)
- Connected Vercel MCP to Claude for deployments
- Domain **twygie.com** purchased by user (DNS connection pending)
- Firebase config hardcoded into HTML files

### Naming
Brainstormed app names around "storytelling + playful + tree". Landed on **Twygie** after exploring: Yarns, Storied, Twiggy, Twygy, Twiggee, Twygie. User owned `twygie.com`.

---

## Session 2 — Major Feature Build

### Login Page
Built `login.html` with glassmorphism card over a ghost tree silhouette. Email/password, Google, Apple sign-in. Password reset flow. Firebase Auth integration.

### Family Tree App — First Version
- Pre-seeded Ashford family demo (14 members, 4 generations)
- SVG tree with bezier connector lines
- Pan/zoom/pinch
- Click node → right-side panel with details
- Add member modal

### Redesign Iterations
1. **Overlay card** — replaced side panel with centered transparent glassmorphism card
2. **Member count** — clickable pill in header showing member count
3. **Organic branches** — tapered bezier paths with trunk extending below oldest generation

---

## Session 3 — Auth + Data

### Firebase Integration
- Connected real Firebase config (user provided)
- Firestore save/load per user
- Auto-save with 1.8s debounce
- First-time users get default tree seeded from their display name
- Authorized domain added: `twygie.vercel.app`

---

## Session 4 — Relationship System Overhaul

### Problems Fixed
- Nodes stacking (auto-layout rewrite — gen-based BFS positioning)
- Relationship dropdown expanded: Son, Daughter, Father, Mother, Husband, Wife, etc.
- Members list panel (grouped by generation, search)
- "Add a Twyg" per-node button
- Photos on nodes (Base64, circular crop, in tooltips)
- Hover tooltip shows photo + age

### Forms Redesign
- Split first/last name fields
- Date of birth: Month/Day/Year
- City + State (dropdown with 50 states)
- Deceased toggle with death date
- Gender field
- Story/note textarea

---

## Session 5 — Visual Polish + Settings

### Node Visual System
- Pulsate animations: opacity-only (no translate/scale except for isYou)
- isYou: always brightest (extra outer glow ring)
- Young nodes: fast double-flash shimmer vs slow breathe for adults
- Connection-count driven glow radius (`22 + cc*4`, capped at 48)
- All pulse colors driven by `nodeColors` settings (not hardcoded CSS)

### Settings Panel
Built full settings side panel:
- Account info + sign out
- Default view (Tree View / All Twygs) — persisted to Firestore
- Line color pickers (4 types)
- Node color pickers (10 categories)
- Young age threshold input (default 17)
- Custom relationship types
- Tree stats

### Line System
Final line type hierarchy:
| Type | Color | Style | Modes |
|---|---|---|---|
| Parent-child | Green | Solid bold | Both |
| Sibling | Orange | Solid bold | Both |
| Extended blood (grandparent, aunt, etc.) | Purple | Solid | All Twygs |
| Spouse | Blue | Dashed | Both |
| Non-blood labeled | Purple | Dashed | All Twygs |

---

## Session 6 — Bug Fixes

### Major Bugs Resolved
- **File truncation bug** — Python string replacement sliced file at `function drawNodes(){`, removing entire second half. Fixed by restoring from git history and applying targeted patches with `node --check` validation before every push.
- **Grandparent→sibling bug** — Grandparents added to `parents[]` triggered false sibling detection. Fixed by using `directParentLabels` whitelist — only Father/Mother/Stepparents go in `parents[]`, everything else to `customLinks`.
- **Labeled connections not saving** — `saveConnection` was missing the `labeled` branch entirely; fell through silently. Fixed and switched to `customLinks` object (flat key-value, survives Firestore round-trips better than nested arrays).
- **Settings save silently failing** — stale reference to `mode-btn` element (removed in dual-button refactor) threw error inside `loadSettings`, preventing all settings from applying.
- **JS always-stuck loading** — missing `}` closing brace on `drawBranches` caused silent syntax error. Fixed with `node --check` validation step.

### Key Architectural Decisions Made
- **`parents[]` = direct parents only** — Grandfather, Aunt, Nephew etc. go in `customLinks`
- **`customLinks` as flat object** — `{ [targetId]: { label, lineType } }` — simpler than arrays, serializes cleanly to Firestore
- **Single glow filter** — all nodes use `gf-a`, pulse color comes from `fill` (nodeColors). Removed per-category filter so color picker changes reflect immediately.
- **`BLOOD_LABELS` set** — determines solid vs dashed for `customLinks` lines
- **Sibling = customLink only** — never copy parents[], avoids false sibling detection

### Remove Node — Safe Cascade
Two-step confirmation:
1. "Remove just this person?"
2. "Also remove N connected Twygs below them?"
Choosing no to step 2 keeps descendants but unlinks them.

---

## Pending / Known Issues (as of last session)
- twygie.com domain not yet pointed to Vercel
- twygie.com not yet in Firebase authorized domains
- Photos stored as Base64 in Firestore (approaching doc size limits for large photos)
- Existing nodes with old `connections[]` arrays (pre-customLinks refactor) may have stale data
- Tree View / All Twygs button state doesn't always sync on first load from Firestore settings
