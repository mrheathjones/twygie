/* ═══ constants.js ═══ Shared relationship constants and label sets ═══ */

// ─── RELATIONSHIP CLASSIFICATION SETS ────────────────────────────────────────
// Used to determine line types, storage routing, and auto-layout behavior

const DIRECT_PARENT_SET = new Set(['Father','Mother','Stepfather','Stepmother','Parent']);
const DIRECT_CHILD_SET  = new Set(['Son','Daughter','Stepson','Stepdaughter','Child']);
const SPOUSE_SET        = new Set(['Husband','Wife','Partner']);

// ─── LAYOUT CATEGORY ARRAYS ─────────────────────────────────────────────────
// Used by submitMember() to determine node placement (above/below/beside isYou)

const CHILD_RELS = [
  'Son','Daughter','Grandson','Granddaughter',
  'Great-grandson','Great-granddaughter','Great-great-grandson','Great-great-granddaughter',
  'Stepson','Stepdaughter','Nephew','Niece',
  'Grand-nephew','Grand-niece','Great-grand-nephew','Great-grand-niece',
  'Godson','Goddaughter'
];

const PARENT_RELS = [
  'Father','Mother','Grandfather','Grandmother',
  'Great-grandfather','Great-grandmother','Great-great-grandfather','Great-great-grandmother',
  'Stepfather','Stepmother','Father-in-law','Mother-in-law',
  'Uncle','Aunt','Great-uncle','Great-aunt','Great-grand-uncle','Great-grand-aunt',
  'Godfather','Godmother'
];

const SPOUSE_RELS = ['Husband','Wife','Partner'];

const SIBLING_RELS = [
  'Brother','Sister','Brother-in-law','Sister-in-law',
  'Half-brother','Half-sister','Stepbrother','Stepsister',
  'Cousin','First Cousin',
  'First Cousin Once Removed','First Cousin Twice Removed','First Cousin Thrice Removed',
  'Second Cousin','Second Cousin Once Removed','Second Cousin Twice Removed','Second Cousin Thrice Removed',
  'Third Cousin','Third Cousin Once Removed','Third Cousin Twice Removed','Third Cousin Thrice Removed'
];

// ─── BLOOD LABELS ────────────────────────────────────────────────────────────
// Any label in this set draws as a SOLID line (blood relation)
// Labels NOT in this set draw as DASHED (non-blood / custom)

const BLOOD_LABELS = new Set([
  // Direct line — ascending
  'Father','Mother','Parent','Stepfather','Stepmother','Stepparent',
  'Grandfather','Grandmother','Grandparent',
  'Great-grandfather','Great-grandmother','Great-grandparent',
  'Great-great-grandfather','Great-great-grandmother','Great-great-grandparent',
  // Direct line — descending
  'Son','Daughter','Child','Stepson','Stepdaughter','Stepchild',
  'Grandson','Granddaughter','Grandchild',
  'Great-grandson','Great-granddaughter','Great-grandchild',
  'Great-great-grandson','Great-great-granddaughter','Great-great-grandchild',
  // Siblings
  'Brother','Sister','Sibling','Half-brother','Half-sister','Stepbrother','Stepsister',
  // Aunts/Uncles
  'Uncle','Aunt',
  'Great-uncle','Great-aunt',
  'Great-grand-uncle','Great-grand-aunt',
  // Nephews/Nieces
  'Nephew','Niece',
  'Grand-nephew','Grand-niece',
  'Great-grand-nephew','Great-grand-niece',
  // In-laws (connected by marriage)
  'Father-in-law','Mother-in-law','Parent-in-law',
  'Son-in-law','Daughter-in-law','Child-in-law',
  'Brother-in-law','Sister-in-law','Sibling-in-law',
  // Godparents
  'Godfather','Godmother',
  // Cousins (all degrees and removes)
  'Cousin','First Cousin',
  'First Cousin Once Removed','First Cousin Twice Removed','First Cousin Thrice Removed',
  'Second Cousin',
  'Second Cousin Once Removed','Second Cousin Twice Removed','Second Cousin Thrice Removed',
  'Third Cousin',
  'Third Cousin Once Removed','Third Cousin Twice Removed','Third Cousin Thrice Removed',
]);

// ─── INVERSE RELATIONSHIPS ───────────────────────────────────────────────────
// Maps a label to its reciprocal (Father↔Son, Uncle↔Nephew, etc.)

const INVERSE_REL = {
  'Father':'Son','Mother':'Daughter','Son':'Father','Daughter':'Mother',
  'Grandfather':'Grandson','Grandmother':'Granddaughter',
  'Grandson':'Grandfather','Granddaughter':'Grandmother',
  'Great-grandfather':'Great-grandson','Great-grandmother':'Great-granddaughter',
  'Great-grandson':'Great-grandfather','Great-granddaughter':'Great-grandmother',
  'Great-great-grandfather':'Great-great-grandson','Great-great-grandmother':'Great-great-granddaughter',
  'Great-great-grandson':'Great-great-grandfather','Great-great-granddaughter':'Great-great-grandmother',
  'Uncle':'Nephew','Aunt':'Niece','Nephew':'Uncle','Niece':'Aunt',
  'Grand-nephew':'Grand-uncle','Grand-niece':'Grand-aunt',
  'Great-uncle':'Grand-nephew','Great-aunt':'Grand-niece',
  'Stepfather':'Stepson','Stepmother':'Stepdaughter',
  'Stepson':'Stepfather','Stepdaughter':'Stepmother',
  'Father-in-law':'Son-in-law','Mother-in-law':'Daughter-in-law',
  'Son-in-law':'Father-in-law','Daughter-in-law':'Mother-in-law',
  'Brother-in-law':'Brother-in-law','Sister-in-law':'Sister-in-law',
  'Grandfather-in-law':'Grandson-in-law','Grandmother-in-law':'Granddaughter-in-law',
  'Grandson-in-law':'Grandfather-in-law','Granddaughter-in-law':'Grandmother-in-law',
  'Godfather':'Godchild','Godmother':'Godchild','Godchild':'Godparent',
};

function inverseLabel(lbl) { return INVERSE_REL[lbl] || lbl; }

// ─── DEBUG LOGGING ───────────────────────────────────────────────────────────
// Set window.TWYGIE_DEBUG = true in browser console to enable verbose logging
// console.warn and console.error always fire regardless of this flag

function debug(...args) {
  if (window.TWYGIE_DEBUG) console.log('[Twygie]', ...args);
}
