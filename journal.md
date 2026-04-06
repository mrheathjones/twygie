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
