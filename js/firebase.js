/* ═══ firebase.js ═══════════════════════════════════════════════════════════
 * Firebase initialization, authentication, and data persistence.
 *
 * DEFINES (globals):
 *   people[]        — master array of all Person objects
 *   peopleById{}    — lookup map: id → Person
 *   currentUser     — Firebase Auth user object
 *   treeMode        — 'simple' | 'complex' (which connections to show)
 *   youngAge        — age threshold for "young" node styling (default 17)
 *   demoMode        — when true, creates fresh tree on every reload
 *   autoConnections — when true, auto-infer relationships on add
 *
 * KEY FUNCTIONS:
 *   loadTree()      — loads + decrypts user tree from Firestore
 *   saveTree()      — encrypts + saves tree to Firestore
 *   scheduleSave()  — debounced save (1.8s delay)
 *   rebuild()       — rebuilds peopleById index + runs auto-layout
 *   fullName(p)     — returns display name for a Person
 *   appAlert/appConfirm/appChoice — branded modal dialogs
 * ═══════════════════════════════════════════════════════════════════════════ */
// ─── FIREBASE ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBwtDMGEIphvwvq319MZIr62C32fvSSe-4",
  authDomain: "twygie.firebaseapp.com",
  projectId: "twygie",
  storageBucket: "twygie.firebasestorage.app",
  messagingSenderId: "654053569477",
  appId: "1:654053569477:web:9296f441c285686d7c11ac"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();


// ─── BRANDED MODALS (replace browser confirm/alert) ─────────────────────────
function appAlert(msg){
  return new Promise(resolve=>{
    const bg=document.getElementById('app-modal-bg');
    document.getElementById('app-modal-msg').innerHTML=msg;
    const btns=document.getElementById('app-modal-btns');
    btns.innerHTML='';
    const okBtn=document.createElement('button');
    okBtn.textContent='OK';
    okBtn.style.cssText='flex:1;padding:8px 16px;background:var(--gold);border:none;border-radius:100px;color:#04070c;font-family:Outfit,sans-serif;font-size:.82rem;font-weight:600;cursor:pointer';
    okBtn.onclick=()=>{bg.classList.remove('open');resolve()};
    btns.appendChild(okBtn);
    bg.classList.add('open');
  });
}
function appConfirm(msg,okText,cancelText){
  return new Promise(resolve=>{
    const bg=document.getElementById('app-modal-bg');
    document.getElementById('app-modal-msg').innerHTML=msg;
    const btns=document.getElementById('app-modal-btns');
    btns.innerHTML='';
    const cancelBtn=document.createElement('button');
    cancelBtn.textContent=cancelText||'Cancel';
    cancelBtn.style.cssText='flex:1;padding:8px 16px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:100px;color:var(--muted);font-family:Outfit,sans-serif;font-size:.82rem;cursor:pointer';
    cancelBtn.onclick=()=>{bg.classList.remove('open');resolve(false)};
    const okBtn=document.createElement('button');
    okBtn.textContent=okText||'OK';
    okBtn.style.cssText='flex:1;padding:8px 16px;background:var(--gold);border:none;border-radius:100px;color:#04070c;font-family:Outfit,sans-serif;font-size:.82rem;font-weight:600;cursor:pointer';
    okBtn.onclick=()=>{bg.classList.remove('open');resolve(true)};
    btns.append(cancelBtn,okBtn);
    bg.classList.add('open');
  });
}
// 3-button dialog: returns 'a','b', or false (cancel)
function appChoice(msg,btnA,btnB,cancelText){
  return new Promise(resolve=>{
    const bg=document.getElementById('app-modal-bg');
    document.getElementById('app-modal-msg').innerHTML=msg;
    const btns=document.getElementById('app-modal-btns');
    btns.innerHTML='';btns.style.flexWrap='wrap';
    const cancelBtn=document.createElement('button');
    cancelBtn.textContent=cancelText||'Cancel';
    cancelBtn.style.cssText='flex:1 1 100%;padding:8px 16px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:100px;color:var(--muted);font-family:Outfit,sans-serif;font-size:.82rem;cursor:pointer;order:3;margin-top:4px';
    cancelBtn.onclick=()=>{bg.classList.remove('open');btns.style.flexWrap='';resolve(false)};
    const aBtn=document.createElement('button');
    aBtn.textContent=btnA;
    aBtn.style.cssText='flex:1;padding:8px 12px;background:var(--gold);border:none;border-radius:100px;color:#04070c;font-family:Outfit,sans-serif;font-size:.78rem;font-weight:600;cursor:pointer';
    aBtn.onclick=()=>{bg.classList.remove('open');btns.style.flexWrap='';resolve('a')};
    const bBtn=document.createElement('button');
    bBtn.textContent=btnB;
    bBtn.style.cssText='flex:1;padding:8px 12px;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:100px;color:var(--text);font-family:Outfit,sans-serif;font-size:.78rem;cursor:pointer';
    bBtn.onclick=()=>{bg.classList.remove('open');btns.style.flexWrap='';resolve('b')};
    btns.append(aBtn,bBtn,cancelBtn);
    bg.classList.add('open');
  });
}

function makeDefaultTree(user) {
  let firstName = '', lastName = '';
  if (user.displayName) {
    const parts = user.displayName.trim().split(' ');
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ') || '';
  }
  return [
    { id:'you', name: user.displayName||'Your Name', firstName, lastName,
      gender:'', dob:{month:'',day:'',year:''}, city:'', state:'', parents:[],
      isYou:true, note:'Welcome to Twygie! Tap Edit to add your story.', x:600, y:400 }
  ];
}


// ─── AUTH ─────────────────────────────────────────────────────────────────────
let currentUser=null, saveTimer=null, treeLoaded=false;
auth.onAuthStateChanged(async user => {
  if (!user){ window.location.href='/login'; return; }
  currentUser=user;
  const initEl=document.getElementById('uinitial');
  const avatarEl=document.getElementById('uavatar');
  if(avatarEl&&user.photoURL){ if(initEl) initEl.style.display='none'; const img=document.createElement('img'); img.src=user.photoURL; avatarEl.appendChild(img); }
  else if(initEl) initEl.textContent=(user.displayName||user.email||'?')[0].toUpperCase();
  await loadTree();
  await loadLeafs();
  await loadActiveLinks();
  await loadSharedNodes();
  subscribeActiveLinks();
  window._appReady=true; // enable auto-adopt only after initial load
  hideLoading();
});
async function signOut(){ if(!await appConfirm('Sign out of Twygie?','Sign Out','Stay')) return; await auth.signOut(); window.location.href='/login'; }

async function burnTwygs(){
  const count=people.filter(p=>!p.isYou).length;
  if(count===0){ await appAlert('Your tree is already empty.'); return; }

  const step1=await appConfirm(
    `🔥 Burn all ${count} Twygs?\n\nThis will permanently delete every member from your tree except you. This action cannot be undone.`,
    'Continue','Cancel'
  );
  if(!step1) return;

  const step2=await appConfirm(
    `Are you absolutely sure?\n\nAll ${count} members, their connections, photos, stories, and relationship data will be permanently destroyed.`,
    '🔥 Burn them all','Keep my Twygs'
  );
  if(!step2) return;

  // Keep only isYou node, reset everything else
  const you=people.find(p=>p.isYou);
  if(you){
    you.parents=[];
    you.spouseOf=null;
    you.customLinks={};
    you.relationships=[];
    delete you.weddingDate;
  }
  people.length=0;
  if(you) people.push(you);
  peopleById={};
  if(you) peopleById[you.id]=you;
  rebuild([]); render(); await saveTree(false);
  await appAlert(`${count} Twygs burned. Your tree is now empty.`);
  closeSettings();
  if(you) selectNode(you.id);
}

function toggleSection(id){
  const body=document.getElementById(id);
  const icon=document.getElementById('icon-'+id);
  if(!body) return;
  const isOpen=body.classList.contains('open');
  body.classList.toggle('open',!isOpen);
  if(icon) icon.classList.toggle('open',!isOpen);
}


// ─── FIRESTORE ────────────────────────────────────────────────────────────────
function userDoc(){ return db.collection('familyTrees').doc(currentUser.uid); }

// ─── CLIENT-SIDE ENCRYPTION (Phase 2) ────────────────────────────────────────
// AES-256-GCM encryption using Web Crypto API
// Key derived from Firebase UID via PBKDF2 — data is encrypted before leaving the browser
let encryptionKey=null;

async function deriveEncryptionKey(uid){
  const enc=new TextEncoder();
  const keyMaterial=await crypto.subtle.importKey(
    'raw', enc.encode(uid), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {name:'PBKDF2', salt:enc.encode('twygie-encryption-v1'), iterations:100000, hash:'SHA-256'},
    keyMaterial,
    {name:'AES-GCM', length:256},
    false,
    ['encrypt','decrypt']
  );
}

async function encryptPeople(key, people){
  const enc=new TextEncoder();
  const iv=crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const plaintext=enc.encode(JSON.stringify(people));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, plaintext);
  // Prepend IV to ciphertext, then base64 encode
  const combined=new Uint8Array(iv.length+ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext),iv.length);
  // Convert to base64 in chunks to avoid call stack overflow on large arrays
  let binary='';
  const chunk=8192;
  for(let i=0;i<combined.length;i+=chunk){
    binary+=String.fromCharCode.apply(null,combined.subarray(i,i+chunk));
  }
  return btoa(binary);
}

async function decryptPeople(key, base64Data){
  const binary=atob(base64Data);
  const raw=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) raw[i]=binary.charCodeAt(i);
  const iv=raw.slice(0,12);
  const ciphertext=raw.slice(12);
  const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv}, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(decrypted));
}
async function loadTree(){
  // Load settings FIRST so we know if demoMode is on
  await loadSettings();

  // Derive encryption key from user's UID
  try{ encryptionKey=await deriveEncryptionKey(currentUser.uid); }
  catch(e){ console.warn('Web Crypto unavailable — encryption disabled',e); encryptionKey=null; }

  if(demoMode){
    // Demo mode: fresh tree every reload, saves blocked (treeLoaded stays false)
    people=makeDefaultTree(currentUser);
    debug('Demo Mode: fresh tree created. Saves are disabled.');
  } else {
    try{
      const snap=await userDoc().get();
      if(snap.exists){
        const d=snap.data();
        if(d.encryptedData && encryptionKey){
          // ── Encrypted format (Phase 2) ──
          try{
            people=await decryptPeople(encryptionKey, d.encryptedData);
            treeLoaded=true;
            debug('Tree loaded and decrypted successfully.');
          }catch(decErr){
            console.error('Decryption failed:',decErr);
            people=makeDefaultTree(currentUser||{displayName:''});
            setTimeout(()=>appAlert('Could not decrypt your tree data. If you recently changed accounts, the encryption key may not match.'),500);
          }
        } else if(d.people && d.people.length){
          // ── Legacy plaintext format — migrate to encrypted ──
          people=d.people;
          treeLoaded=true;
          debug('Legacy plaintext tree loaded. Migrating to encrypted format...');
          // Auto-migrate: save in encrypted format immediately
          if(encryptionKey){
            try{
              const encrypted=await encryptPeople(encryptionKey,people);
              await userDoc().set({
                encryptedData:encrypted,
                encryptionVersion:1,
                ownerEmail:currentUser.email||'',
                nodeCount:people.length,
                updatedAt:firebase.firestore.FieldValue.serverTimestamp()
              });
              debug('Migration complete — tree data is now encrypted.');
            }catch(migErr){ console.warn('Migration save failed — will retry on next save:',migErr); }
          }
        } else {
          // ── Empty/new user ──
          people=makeDefaultTree(currentUser);
          treeLoaded=true;
          await saveTree(false);
        }
      } else {
        people=makeDefaultTree(currentUser);
        treeLoaded=true;
        await saveTree(false);
      }
    }catch(e){
      console.error('Failed to load tree from Firestore:',e);
      people=makeDefaultTree(currentUser||{displayName:''});
      setTimeout(()=>appAlert('Could not load your tree. You may be offline. Your saved data is safe. Please refresh to try again.'),500);
    }
  }
  rebuild(); render(); setTimeout(()=>{setTreeMode(treeMode||'simple'); setLayoutMode(layoutMode||'relaxed',false); resetView();},90);
}
async function saveTree(ind=true){
  if(!currentUser) return;
  if(!treeLoaded){ console.warn('Save blocked — tree not loaded from Firestore yet'); return; }
  try{
    if(encryptionKey){
      // ── Encrypted save (Phase 2) ──
      const encrypted=await encryptPeople(encryptionKey, people);
      await userDoc().set({
        encryptedData:encrypted,
        encryptionVersion:1,
        ownerEmail:currentUser.email||'',
        nodeCount:people.length,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // ── Fallback: plaintext save (Web Crypto unavailable) ──
      await userDoc().set({
        people:people,
        ownerEmail:currentUser.email||'',
        nodeCount:people.length,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    if(ind) flashSaved();
  }catch(e){ console.warn('Save failed',e); }
}
function scheduleSave(){ clearTimeout(saveTimer); saveTimer=setTimeout(()=>saveTree(true),1800); }
function flashSaved(){ const e=document.getElementById('save-ind'); e.classList.add('show'); setTimeout(()=>e.classList.remove('show'),2500); }
function hideLoading(){ const e=document.getElementById('loading'); e.classList.add('fade'); setTimeout(()=>e.classList.add('gone'),420); }

// ─── DATA ─────────────────────────────────────────────────────────────────────
let people=[], peopleById={};
let leafs=[];

// ─── LEAFS DATA LAYER ───────────────────────────────────────────────────────
// Stored as encryptedLeafs field in familyTrees/{uid} — same doc as tree data

async function loadLeafs(){
  try{
    const snap=await userDoc().get();
    if(snap.exists){
      const d=snap.data();
      if(d.encryptedLeafs&&encryptionKey){
        leafs=await decryptPeople(encryptionKey, d.encryptedLeafs);
      } else { leafs=[]; }
    } else { leafs=[]; }
  }catch(e){ console.warn('Load leafs failed:',e); leafs=[]; }
}

async function saveLeafs(){
  if(!currentUser||!treeLoaded) { console.warn('saveLeafs blocked'); return; }
  try{
    if(encryptionKey){
      const encrypted=await encryptPeople(encryptionKey, leafs);
      await userDoc().update({encryptedLeafs:encrypted, leafCount:leafs.length});
    }
    flashSaved();
  }catch(e){ console.error('Save leafs failed:',e); }
}

async function addLeaf(leaf){
  leaf.id='leaf_'+Date.now();
  leaf.createdBy=currentUser.uid;
  leaf.createdByName=currentUser.displayName||currentUser.email||'';
  leaf.createdAt=Date.now();
  leaf.modifiedBy=null;
  leaf.modifiedByName=null;
  leaf.modifiedAt=null;
  leafs.push(leaf);
  await saveLeafs();
  return leaf;
}

async function editLeaf(leafId, updates){
  const l=leafs.find(x=>x.id===leafId);
  if(!l) return null;
  Object.assign(l, updates);
  l.modifiedBy=currentUser.uid;
  l.modifiedByName=currentUser.displayName||currentUser.email||'';
  l.modifiedAt=Date.now();
  await saveLeafs();
  return l;
}

async function deleteLeaf(leafId){
  const idx=leafs.findIndex(x=>x.id===leafId);
  if(idx<0) return false;
  leafs.splice(idx,1);
  await saveLeafs();
  return true;
}

function getLeafsForNode(personId){
  return leafs.filter(l=>(l.twygs||[]).includes(personId));
}

function migrateCustomLinks(p){
  if(!p.customLinks) p.customLinks={};
  // Legacy: string values → object
  Object.keys(p.customLinks).forEach(tid=>{
    const v=p.customLinks[tid];
    if(typeof v==='string') p.customLinks[tid]={label:v,lineType:'labeled'};
  });
  // v2 migration: customLinks → relationships[]
  if(!p.relationships) p.relationships=[];
  Object.entries(p.customLinks).forEach(([tid,v])=>{
    const label=typeof v==='string'?v:v.label||'';
    if(!label) return;
    // Skip if already in relationships[]
    if(p.relationships.some(r=>r.targetId===tid)) return;
    let category=getRelCategory(label);
    // Reclassify: sibling label where one is married to the other's actual sibling
    if(SIBLING_LABELS.has(label) && !label.includes('-in-law')){
      const other=peopleById[tid];
      if(other){
        const pA=new Set(p.parents||[]);
        const sharesParent=pA.size>0 && (other.parents||[]).some(pid=>pA.has(pid));
        if(!sharesParent){
          const pSpouseId=p.spouseOf;
          const oSpouseId=other.spouseOf;
          const pSpouseIsOSib=pSpouseId && (other.parents||[]).some(pid=>(peopleById[pSpouseId]?.parents||[]).includes(pid));
          const oSpouseIsPSib=oSpouseId && (p.parents||[]).some(pid=>(peopleById[oSpouseId]?.parents||[]).includes(pid));
          if(pSpouseIsOSib||oSpouseIsPSib) category='bond';
        }
      }
    }
    p.relationships.push({targetId:tid, label, category, structural:false});
  });
}
function rebuild(newIds=[]){ peopleById={}; people.forEach(p=>{ if(!p.dob) p.dob={}; if(!p.customLinks) p.customLinks={}; if(!p.relationships) p.relationships=[]; migrateCustomLinks(p); peopleById[p.id]=p; }); autoLayoutNew(newIds); updateCount(); }
// g(id) removed — use peopleById[id] directly
let nextNodeId=Date.now();
let treeMode='complex'; // 'simple' | 'complex'
let youngAge=17; // 'young' if age <= this
let demoMode=false; // when true, creates fresh tree on every reload
let autoConnections=true; // auto-infer relationships to isYou
let layoutMode='relaxed'; // 'compact' | 'relaxed' | 'expanded' | 'traditional' | 'immersive'
let layoutWarnDismissed=false; // "don't warn me again" for layout changes
let dobWarnDismissed=false; // "don't warn me again" for missing birthdate
let showLeafs=false; // show leaf nodes on tree view
function setTreeMode(mode){
  treeMode=mode;
  ['btn-tree','btn-all','btn-blood','btn-bonds'].forEach(id=>{
    const btn=document.getElementById(id);
    if(btn) btn.classList.toggle('active',
      (id==='btn-tree'&&mode==='simple')||(id==='btn-all'&&mode==='complex')||
      (id==='btn-blood'&&mode==='bloodline')||(id==='btn-bonds'&&mode==='bonds'));
  });
  render();
  // Refresh 3D lines if in immersive mode
  if(layoutMode==='immersive'&&typeof immRefreshLines==='function') immRefreshLines();
}

function setLayoutMode(mode, force){
  const prev=layoutMode;
  layoutMode=mode;
  // Update toggle buttons
  ['btn-compact','btn-relaxed','btn-expanded','btn-traditional','btn-immersive'].forEach(id=>{
    const btn=document.getElementById(id);
    if(btn) btn.classList.toggle('active',
      (id==='btn-compact'&&mode==='compact')||(id==='btn-relaxed'&&mode==='relaxed')||
      (id==='btn-expanded'&&mode==='expanded')||(id==='btn-traditional'&&mode==='traditional')||
      (id==='btn-immersive'&&mode==='immersive'));
  });
  // Handle immersive mode toggle
  if(mode==='immersive'){
    if(typeof enterImmersive==='function') enterImmersive();
    return;
  } else if(prev==='immersive'){
    if(typeof exitImmersive==='function') exitImmersive();
  }
  // Re-layout all nodes
  if(force!==false) relayoutAll();
  render();
  scheduleSave();
}

function relayoutAll(){
  const allIds=people.map(p=>p.id);
  autoLayoutNew(allIds);
}

function persistLayoutMode(){
  if(!currentUser) return;
  settingsDoc().update({layoutMode, layoutWarnDismissed}).catch(()=>{
    // If doc doesn't exist yet, set it
    settingsDoc().set({layoutMode, layoutWarnDismissed},{merge:true}).catch(e=>console.warn('Layout save failed:',e));
  });
}
function persistDobWarn(){
  if(!currentUser) return;
  settingsDoc().set({dobWarnDismissed},{merge:true}).catch(e=>console.warn('DOB warn save failed:',e));
}
function updateCount(){ document.getElementById('mcnum').textContent=people.length; }
function fullName(p){ return p.name||[(p.firstName||''),(p.lastName||'')].filter(Boolean).join(' ')||'Unknown'; }

// ─── AUTO LAYOUT ──────────────────────────────────────────────────────────────
// CONVENTION: parents ABOVE (smaller y), children BELOW (larger y)
const LAYOUT_PARAMS={
  compact:     {genH:100, spacing:80,  centerX:600, baseY:400},
  relaxed:     {genH:170, spacing:165, centerX:600, baseY:400},
  expanded:    {genH:280, spacing:300, centerX:600, baseY:400},
  traditional: {genH:200, spacing:140, centerX:600, baseY:400},
};

function autoLayoutNew(newIds=[]){
  if(!people.length) return;
  if(layoutMode==='immersive') return; // 3D handles its own layout

  const youNode=people.find(p=>p.isYou)||people[0];
  const gen={};
  const visited=new Set();
  const queue=[{id:youNode.id, gv:0}];
  while(queue.length){
    const {id,gv}=queue.shift();
    if(visited.has(id)) continue;
    visited.add(id); gen[id]=gv;
    const p=peopleById[id]; if(!p) continue;
    (p.parents||[]).forEach(pid=>{ if(!visited.has(pid)) queue.push({id:pid,gv:gv-1}); });
    people.filter(x=>(x.parents||[]).includes(id)).forEach(c=>{ if(!visited.has(c.id)) queue.push({id:c.id,gv:gv+1}); });
    if(p.spouseOf){ const sp=peopleById[p.spouseOf]; if(sp&&!visited.has(p.spouseOf)) queue.push({id:p.spouseOf,gv}); }
    const spNode=people.find(x=>x.spouseOf===id);
    if(spNode&&!visited.has(spNode.id)) queue.push({id:spNode.id,gv});
  }
  people.forEach(p=>{ if(gen[p.id]===undefined) gen[p.id]=0; });

  const byGen={};
  people.forEach(p=>{ const gv=gen[p.id]; if(!byGen[gv]) byGen[gv]=[]; byGen[gv].push(p); });

  const params=LAYOUT_PARAMS[layoutMode]||LAYOUT_PARAMS.relaxed;
  const {genH, spacing, centerX, baseY}=params;

  if(layoutMode==='traditional'){
    // Traditional: family-unit centered layout
    // Parents centered above their children, spouses side by side
    layoutTraditional(byGen, gen, newIds, params);
  } else {
    // Compact / Relaxed / Expanded: generation rows with variable spacing
    Object.entries(byGen).forEach(([gStr,genPeople])=>{
      const gNum=parseInt(gStr);
      const y=baseY+gNum*genH;

      // Sort: isYou first, then spouses adjacent, then alphabetical
      genPeople.sort((a,b)=>{
        if(a.isYou) return -1; if(b.isYou) return 1;
        const you=genPeople.find(x=>x.isYou);
        if(you){
          const aIsSpouse=a.spouseOf===you.id||you.spouseOf===a.id;
          const bIsSpouse=b.spouseOf===you.id||you.spouseOf===b.id;
          if(aIsSpouse&&!bIsSpouse) return 1;
          if(bIsSpouse&&!aIsSpouse) return -1;
        }
        return fullName(a).localeCompare(fullName(b));
      });

      const n=genPeople.length, totalW=(n-1)*spacing, startX=centerX-totalW/2;
      genPeople.forEach((p,i)=>{
        if(newIds.includes(p.id)||p.x===undefined||p.x===null){
          p.x=startX+i*spacing; p.y=y;
        }
      });
    });
  }
}

function layoutTraditional(byGen, gen, newIds, params){
  const {genH, centerX, baseY}=params;
  const COUPLE_GAP=80;    // tight gap between spouses
  const placed=new Set();

  function place(id, x, y){
    placed.add(id);
    const p=peopleById[id];
    if(p){p.x=x; p.y=y;}
  }

  function getSpouseId(id){
    const p=peopleById[id]; if(!p) return null;
    return p.spouseOf||(people.find(x=>x.spouseOf===id)||{}).id||null;
  }

  // ── Classic pedigree: each ancestor generation doubles in width ──
  // isYou at center, parents spread above, grandparents wider, etc.
  const youNode=people.find(p=>p.isYou);
  if(!youNode) return;

  // Place isYou
  place(youNode.id, centerX, baseY);

  // Place spouse beside isYou
  const youSpId=getSpouseId(youNode.id);
  if(youSpId&&!placed.has(youSpId)){
    place(youSpId, centerX-COUPLE_GAP, baseY);
  }

  // Place ancestors: recursive binary tree spreading outward
  // Each generation: the horizontal spread doubles
  function placeParents(childId, childX, childY, spread){
    const child=peopleById[childId]; if(!child) return;
    const parentIds=(child.parents||[]).filter(pid=>!placed.has(pid));
    if(!parentIds.length) return;

    const py=childY-genH;

    if(parentIds.length>=2){
      // Two parents: one left, one right of child's x
      const p1x=childX-spread/2;
      const p2x=childX+spread/2;
      place(parentIds[0], p1x, py);
      place(parentIds[1], p2x, py);

      // Each parent's spouse goes beside them (toward outside)
      const sp1=getSpouseId(parentIds[0]);
      if(sp1&&!placed.has(sp1)) place(sp1, p1x-COUPLE_GAP, py);
      const sp2=getSpouseId(parentIds[1]);
      if(sp2&&!placed.has(sp2)) place(sp2, p2x+COUPLE_GAP, py);

      // Recurse: each parent's parents spread wider
      placeParents(parentIds[0], p1x, py, spread*1.2);
      placeParents(parentIds[1], p2x, py, spread*1.2);
    } else {
      // Single parent centered above
      place(parentIds[0], childX, py);
      const sp=getSpouseId(parentIds[0]);
      if(sp&&!placed.has(sp)) place(sp, childX+COUPLE_GAP, py);
      placeParents(parentIds[0], childX, py, spread*1.2);
    }
  }

  // Start spreading from isYou with initial spread of 300px
  placeParents(youNode.id, centerX, baseY, 300);

  // Place siblings at each generation level
  // Find unplaced siblings of placed nodes and position beside them
  people.forEach(p=>{
    if(placed.has(p.id)) return;
    // Check if any sibling is placed
    const sibs=[];
    (p.parents||[]).forEach(pid=>{
      people.filter(s=>s.id!==p.id&&placed.has(s.id)&&(s.parents||[]).includes(pid))
        .forEach(s=>sibs.push(s));
    });
    if(sibs.length>0){
      const sibNode=sibs[0];
      place(p.id, sibNode.x+160, sibNode.y);
      const sp=getSpouseId(p.id);
      if(sp&&!placed.has(sp)) place(sp, sibNode.x+160+COUPLE_GAP, sibNode.y);
    }
  });

  // Place children below isYou
  function placeChildren(parentId, parentX, parentY){
    const children=people.filter(c=>!placed.has(c.id)&&(c.parents||[]).includes(parentId));
    if(!children.length) return;
    const totalW=(children.length-1)*160;
    let x=parentX-totalW/2;
    children.forEach(child=>{
      place(child.id, x, parentY+genH);
      const sp=getSpouseId(child.id);
      if(sp&&!placed.has(sp)) place(sp, x+COUPLE_GAP, parentY+genH);
      placeChildren(child.id, x, parentY+genH);
      x+=160;
    });
  }
  placeChildren(youNode.id, centerX, baseY);
  if(youSpId) placeChildren(youSpId, centerX, baseY);

  // Place any remaining unplaced
  let ux=centerX+500;
  people.forEach(p=>{
    if(!placed.has(p.id)){
      place(p.id, ux, baseY+(gen[p.id]||0)*genH);
      ux+=160;
    }
  });
}

// ─── VISUAL HELPERS ───────────────────────────────────────────────────────────
function getNodeColor(p){
  const cat=relCategory(p);
  return nodeColors[cat]||nodeColors.default||'#f0b845';
}
function getGlowClass(p){ const cat=relCategory(p); const map={you:'you',deceased:'blue',young:'teal'}; return map[cat]||'amber'; }
function getGlowFilter(p){ return 'gf-a'; } // Single filter — color driven by fill (nodeColors)
function getConnectionCount(p){
  let n=(p.parents||[]).length;
  n+=people.filter(x=>(x.parents||[]).includes(p.id)).length;
  if(p.spouseOf||(people.find(x=>x.spouseOf===p.id))) n+=1;
  // Count relationships[] (v2) or fall back to customLinks
  const relCount=(p.relationships||[]).length;
  const clCount=Object.keys(p.customLinks||{}).length;
  n+=Math.max(relCount, clCount); // use whichever is larger to avoid double-counting
  return n;
}
function getNodeRadius(p){ return p.isYou?13:9; }
function getGlowRadius(p){
  if(p.isYou) return 40;
  // Scale glow radius by connection count: more connections = bigger, brighter glow
  const cc=getConnectionCount(p);
  return Math.min(48, 22 + cc*4); // base 22, +4 per connection, cap 48
}
function initials(p){ const n=fullName(p); return n.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(); }

function deterministicOffset(a,b){
  const h=a.charCodeAt(0)*127+b.charCodeAt(0)*31+a.length*17;
  const v=Math.sin(h*.4531)*43758.5;
  return (v-Math.floor(v)-.5)*28;
}

function dobDisplay(p){
  if(p.dob && (p.dob.month||p.dob.day||p.dob.year)){
    const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
    const {month,day,year}=p.dob;
    const parts=[];
    if(month) parts.push(months[parseInt(month)-1]);
    if(day) parts.push(day+(year?',':''));
    if(year) parts.push(year);
    return `b. ${parts.join(' ')}`;
  }
  return p.birth?`b. ${p.birth}`:'';
}

function placeDisplay(p){
  if(p.city||p.state) return [p.city,p.state].filter(Boolean).join(', ');
  return p.place||'';
}


