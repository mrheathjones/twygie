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
├── vercel.json        # Route config
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
