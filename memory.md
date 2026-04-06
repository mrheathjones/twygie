# Twygie — Technical Memory

## Stack
- **Frontend**: Single HTML file (`family-tree.html` / `index.html`) — vanilla JS + SVG
- **Auth**: Firebase Auth (compat SDK v10.8.0)
- **Database**: Cloud Firestore (compat SDK v10.8.0)
- **Hosting**: Vercel (auto-deploy from GitHub main branch)
- **Fonts**: Google Fonts — Outfit (UI), Cormorant Garamond (headings/names)

---

## File Structure
```
twygie/
├── family-tree.html   # Main app (authenticated tree view)
├── index.html         # Copy of family-tree.html (Vercel serves this as root)
├── login.html         # Login page (email, Google, Apple)
├── vercel.json        # Route config
├── plan.md            # This project's roadmap
├── memory.md          # Technical reference (this file)
└── journal.md         # Development log
```

---

## Firebase Configuration
```js
const firebaseConfig = {
  apiKey: "AIzaSyBwtDMGEIphvwvq319MZIr62C32fvSSe-4",
  authDomain: "twygie.firebaseapp.com",
  projectId: "twygie",
  storageBucket: "twygie.firebasestorage.app",
  messagingSenderId: "654053569477",
  appId: "1:654053569477:web:9296f441c285686d7c11ac"
};
```

## Firestore Schema
```
familyTrees/{userId}
  people: [Person]          // Array of all nodes
  updatedAt: Timestamp
  ownerEmail: string

userSettings/{userId}
  defaultView: 'simple' | 'complex'
  lineColors: { parentChild, spouse, sibling, labeled }
  nodeColors: { you, spouse, parent, child, sibling, grandparent, extended, deceased, young, default }
  youngAge: number           // Age threshold for "young" category
  customLineTypes: [{ id, name, color }]
  updatedAt: Timestamp
```

## Person Object Shape
```js
{
  id: string,               // 'you' | 'u{timestamp}'
  name: string,             // full name (computed)
  firstName: string,
  lastName: string,
  gender: '' | 'male' | 'female' | 'nonbinary',
  dob: { month, day, year },
  dod: { month, day, year } | null,
  birth: number | null,     // birth year (legacy)
  death: number | null,     // death year (legacy)
  city: string,
  state: string,
  place: string,            // legacy field
  note: string,             // story/bio
  photo: string | null,     // base64 data URL
  parents: [id],            // DIRECT parents only (Father/Mother/Stepparents)
  spouseOf: id | undefined,
  customLinks: {            // all non-parent relationships
    [targetId]: { label: string, lineType: 'sibling'|'blood'|'labeled' }
  },
  relLabel: string,         // relationship label relative to isYou
  isYou: boolean,
  x: number,                // canvas position (auto-layout, user-draggable)
  y: number,
}
```

---

## Key Design Decisions

### parents[] vs customLinks
- `parents[]` = ONLY direct parents: Father, Mother, Stepfather, Stepmother, Parent
- Everything else (Grandfather, Aunt, Grandson, etc.) goes in `customLinks`
- This prevents false sibling detection (shared parents triggering auto-sibling lines)

### lineType values
| lineType | Visual | Shown in |
|---|---|---|
| parent-child (parents[]) | Green solid bold | Both modes |
| `sibling` | Orange solid bold | Both modes |
| `blood` | Purple solid | All Twygs only |
| `labeled` | Purple dashed | All Twygs only |
| spouse (spouseOf) | Blue dashed | Both modes |

### BLOOD_LABELS set
Determines whether a `customLinks` entry gets `lineType:'blood'` (solid) vs `lineType:'labeled'` (dashed).
Includes: Father, Mother, Son, Daughter, Brother, Sister, Grandfather, Grandmother, Grandson, Granddaughter, Half-brother, Half-sister, Uncle, Aunt, Nephew, Niece, Cousin, Stepfather, Stepmother, Stepson, Stepdaughter, Parent, Child, Sibling, Grandparent, Grandchild

### Auto-layout
- isYou node anchored at `y: 400, x: 600`
- Generation assigned via BFS from isYou
- Positive generations (children) → higher y (below)
- Negative generations (parents) → lower y (above)
- `genH = 170` (vertical spacing between generations)
- `spacing = 165` (horizontal spacing within a generation)

### Connection-count driven glow
```js
function gr(p) {
  if(p.isYou) return 40;
  const cc = connCount(p); // parents + children + spouse + customLinks
  return Math.min(48, 22 + cc * 4);
}
```

### Young node detection
```js
const currentYear = new Date().getFullYear();
if(birthYear > 0 && (currentYear - birthYear) <= youngAge) return 'young';
```

---

## Deployment Pipeline
1. Code changes made in `/home/claude/twygie/`
2. `cp family-tree.html index.html` (keep in sync)
3. `git add . && git commit -m "..." && git push`
4. Vercel auto-detects push → deploys within ~30 seconds
5. Live at **twygie.vercel.app**

## GitHub Access
- Repo: `github.com/mrheathjones/twygie`
- Push via: `https://{GH_TOKEN}@github.com/mrheathjones/twygie.git`
- Note: Rotate token after use — never leave in chat history

## Vercel Access
- Team ID: `team_nrD8szUQ8HeSzhD71HrIvJGB`
- Project ID: `prj_YZdqrjF8rTlV7jOf3gb0Z0DF0ge4`
- Connected via MCP: `https://mcp.vercel.com`

---

## Known Gotchas

1. **JS syntax validation** — always run `node --check` on extracted script before pushing. Previous truncation bugs caused silent failures.
2. **File truncation risk** — Python string replace on large files can truncate if the replacement pattern overlaps with the match. Prefer targeted regex or index-based replacement for large blocks.
3. **Firestore photo storage** — photos are stored as base64 in Firestore. Large photos approaching Firestore's 1MB document limit. Consider Firebase Storage for future.
4. **Single HTML file** — entire app is one file (~70KB+). Split into modules if it gets much larger.
5. **Auto-layout resets dragged positions** — `rebuild()` calls `autoLayout()` which recalculates positions. Dragged positions should be preserved by passing node IDs to skip.

---

## Settings Persistence Pattern
```js
// Load
const snap = await settingsDoc().get();
if(snap.exists) {
  const d = snap.data();
  if(d.defaultView) treeMode = d.defaultView;
  if(d.lineColors) lineColors = {...DEFAULT_LINE_COLORS, ...d.lineColors};
  if(d.nodeColors) nodeColors = {...DEFAULT_NODE_COLORS, ...d.nodeColors};
  if(d.youngAge != null) youngAge = parseInt(d.youngAge) || 17;
}

// Save
await settingsDoc().set({
  defaultView: settingsMode,
  lineColors,
  nodeColors,
  youngAge,
  customLineTypes,
  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
});
```
