/* ═══ leafs-page.js ═══ Dedicated Leafs browsing page ═══
 *
 * Self-contained — has its own Firebase init, encryption, and rendering.
 * Loads both people[] and leafs[] from familyTrees/{uid}.
 */

// ─── FIREBASE INIT ───
const firebaseConfig={apiKey:"AIzaSyBwtDMGEIphvwvq319MZIr62C32fvSSe-4",authDomain:"twygie.firebaseapp.com",projectId:"twygie",storageBucket:"twygie.firebasestorage.app",messagingSenderId:"654053569477",appId:"1:654053569477:web:9296f441c285686d7c11ac"};
firebase.initializeApp(firebaseConfig);
const auth=firebase.auth(), db=firebase.firestore();
let currentUser=null, people=[], peopleById={}, leafs=[];

const LEAF_TYPES={story:{icon:'📖',label:'Story'},moment:{icon:'✨',label:'Moment'},photo:{icon:'📷',label:'Photo'},quote:{icon:'💬',label:'Quote'},milestone:{icon:'🏆',label:'Milestone'}};
const MONTHS=['','January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── ENCRYPTION ───
async function deriveKey(uid){const e=new TextEncoder();const km=await crypto.subtle.importKey('raw',e.encode(uid),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:e.encode('twygie-encryption-v1'),iterations:100000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function decrypt(key,b64){const bin=atob(b64);const raw=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)raw[i]=bin.charCodeAt(i);const dec=await crypto.subtle.decrypt({name:'AES-GCM',iv:raw.slice(0,12)},key,raw.slice(12));return JSON.parse(new TextDecoder().decode(dec))}
async function encrypt(key,data){const iv=crypto.getRandomValues(new Uint8Array(12));const enc=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(data)));const buf=new Uint8Array(iv.length+enc.byteLength);buf.set(iv);buf.set(new Uint8Array(enc),iv.length);let b='';for(let i=0;i<buf.length;i++)b+=String.fromCharCode(buf[i]);return btoa(b)}

// ─── HELPERS ───
function fullName(p){return p.name||[(p.firstName||''),(p.lastName||'')].filter(Boolean).join(' ')||'Unknown'}

const nodeColors={you:'#f0efeb',spouse:'#e8a838',parent:'#7ab8e8',child:'#6ecb8a',sibling:'#e87a5a',grandparent:'#b89ae8',extended:'#d4a05a',deceased:'#c27070',young:'#5ac2b0',default:'#c8a84b'};
let youngAge=17;

function relCategory(p){if(p.isYou)return'you';if(p.death||(p.dod&&p.dod.year))return'deceased';const by=parseInt(p.dob&&p.dob.year)||p.birth||0;if(by>0&&(new Date().getFullYear()-by)<=youngAge)return'young';const you=people.find(x=>x.isYou);if(!you)return'default';if((p.parents||[]).includes(you.id))return'child';if((you.parents||[]).includes(p.id))return'parent';if(p.spouseOf===you.id||you.spouseOf===p.id)return'spouse';const myP=new Set(you.parents||[]);if(myP.size&&(p.parents||[]).some(pp=>myP.has(pp)))return'sibling';return'default'}
function getNodeColor(p){return nodeColors[relCategory(p)]||nodeColors.default}

function formatDate(d){
  if(!d||!d.year) return '';
  let s='';
  if(d.month&&MONTHS[d.month]) s+=MONTHS[d.month]+' ';
  if(d.day) s+=d.day+', ';
  s+=d.year;
  return s;
}

// ─── STATE ───
let activeType='all';
let activeTwyg=null;
let searchQuery='';

// ─── RENDER ───
function renderLeafs(){
  const grid=document.getElementById('leaf-grid');
  const empty=document.getElementById('empty');

  if(!leafs.length){
    grid.innerHTML='';
    empty.classList.add('show');
    return;
  }
  empty.classList.remove('show');

  // Filter
  let filtered=leafs;
  if(activeType!=='all') filtered=filtered.filter(l=>l.type===activeType);
  if(activeTwyg) filtered=filtered.filter(l=>(l.twygs||[]).includes(activeTwyg));
  if(searchQuery){
    const q=searchQuery.toLowerCase();
    filtered=filtered.filter(l=>(l.title||'').toLowerCase().includes(q)||(l.content||'').toLowerCase().includes(q));
  }

  // Sort: newest first
  filtered.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));

  if(!filtered.length){
    grid.innerHTML='<div style="text-align:center;color:var(--muted);padding:40px;font-size:.88rem;grid-column:1/-1">No leafs match your filters.</div>';
    return;
  }

  grid.innerHTML=filtered.map(l=>{
    const t=LEAF_TYPES[l.type]||LEAF_TYPES.moment;
    const dateStr=formatDate(l.date);
    const taggedNames=(l.twygs||[]).map(tid=>{const p=peopleById[tid];return p?(p.isYou?'You':fullName(p)):null}).filter(Boolean);
    const content=(l.content||'');
    const isLong=content.length>200;

    return `<div class="lf-card" onclick="openDetail('${l.id}')">
      <div class="lf-header">
        <span class="lf-type-icon">${t.icon}</span>
        <span class="lf-title">${l.title||t.label}</span>
        ${l.emoji?`<span class="lf-emoji">${l.emoji}</span>`:''}
      </div>
      ${dateStr?`<div class="lf-date">${dateStr}</div>`:''}
      <div class="lf-content ${isLong?'short':'full'}">${content}</div>
      ${taggedNames.length?`<div class="lf-tags">${taggedNames.map(n=>'<span class="lf-tag">'+n+'</span>').join('')}</div>`:''}
    </div>`;
  }).join('');
}

function renderTwygFilters(){
  const el=document.getElementById('twyg-filter');
  if(!el) return;
  const twygIds=new Set();
  leafs.forEach(l=>(l.twygs||[]).forEach(tid=>twygIds.add(tid)));
  
  let opts='<option value="">All Twygs</option>';
  [...twygIds].forEach(tid=>{
    const p=peopleById[tid];
    if(!p) return;
    const nm=p.isYou?'You':fullName(p);
    opts+=`<option value="${tid}"${activeTwyg===tid?' selected':''}>${nm}</option>`;
  });
  el.innerHTML=opts;
}

// ─── DETAIL MODAL ───
function openDetail(leafId){
  const l=leafs.find(x=>x.id===leafId);
  if(!l) return;
  const t=LEAF_TYPES[l.type]||LEAF_TYPES.moment;
  const dateStr=formatDate(l.date);
  const taggedNames=(l.twygs||[]).map(tid=>{const p=peopleById[tid];return p?(p.isYou?'You':fullName(p)):null}).filter(Boolean);
  const created=l.createdAt?new Date(l.createdAt).toLocaleDateString():'';

  const card=document.getElementById('detail-card');
  card.innerHTML=`
    <button class="dc-close" onclick="closeDetail()">✕</button>
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:1.4rem;margin-bottom:6px">${t.icon}${l.emoji?' '+l.emoji:''}</div>
      <div style="font-size:1.2rem;font-weight:600;color:var(--text)">${l.title||t.label}</div>
      ${dateStr?`<div style="font-size:.82rem;color:var(--muted);margin-top:4px">${dateStr}</div>`:''}
    </div>
    <div style="font-size:.92rem;line-height:1.7;color:var(--text);white-space:pre-wrap;margin-bottom:16px">${l.content||''}</div>
    ${taggedNames.length?`<div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin-bottom:12px">
      ${taggedNames.map(n=>`<span style="padding:3px 10px;border-radius:100px;background:rgba(100,180,100,.08);border:1px solid rgba(100,180,100,.2);font-size:.72rem;color:rgba(100,180,100,.7)">${n}</span>`).join('')}
    </div>`:''}
    ${created?`<div style="text-align:center;font-size:.66rem;color:var(--muted)">Added ${created}</div>`:''}
  `;
  document.getElementById('detail-bg').classList.add('open');
}

function closeDetail(){
  document.getElementById('detail-bg').classList.remove('open');
}

// ─── AUTH + LOAD ───
auth.onAuthStateChanged(async user=>{
  if(!user){window.location.href='login.html';return}
  currentUser=user;
  try{
    const ss=await db.collection('userSettings').doc(user.uid).get();
    if(ss.exists){const d=ss.data();if(d.nodeColors)Object.assign(nodeColors,d.nodeColors);if(d.youngAge!=null)youngAge=parseInt(d.youngAge)||17}
    const snap=await db.collection('familyTrees').doc(user.uid).get();
    if(snap.exists){
      const d=snap.data();
      const key=await deriveKey(user.uid);
      if(d.encryptedData) people=await decrypt(key,d.encryptedData);
      else if(d.people&&d.people.length) people=d.people;
      if(d.encryptedLeafs) leafs=await decrypt(key,d.encryptedLeafs);
    }
    peopleById={};people.forEach(p=>{peopleById[p.id]=p});
    renderTwygFilters();
    renderLeafs();
  }catch(e){console.error('Failed:',e);document.getElementById('empty').classList.add('show')}
  const ld=document.getElementById('loading');ld.classList.add('fade');setTimeout(()=>ld.classList.add('gone'),400);
});

// ─── EVENT LISTENERS ───
document.getElementById('detail-bg')?.addEventListener('click',e=>{
  if(e.target===e.currentTarget) closeDetail();
});

document.getElementById('search')?.addEventListener('input',e=>{
  searchQuery=e.target.value;
  renderLeafs();
});

document.getElementById('type-filters')?.addEventListener('click',e=>{
  const btn=e.target.closest('.type-btn');
  if(!btn) return;
  activeType=btn.dataset.type;
  document.querySelectorAll('.type-btn').forEach(b=>b.classList.toggle('active',b.dataset.type===activeType));
  renderLeafs();
});

document.getElementById('twyg-filter')?.addEventListener('change',e=>{
  activeTwyg=e.target.value||null;
  renderLeafs();
});

// ─── ADD LEAF MODAL ──────────────────────────────────────────────────────────
let addLeafType='moment';
let addLeafEmoji='';

function openAddLeaf(){
  const bg=document.getElementById('add-bg');
  if(!bg) return;

  // Type picker
  const picker=document.getElementById('add-type-picker');
  picker.innerHTML=Object.entries(LEAF_TYPES).map(([k,v])=>
    `<button type="button" class="add-type-btn${k==='moment'?' active':''}" data-type="${k}"><span class="at-icon">${v.icon}</span><span class="at-label">${v.label}</span></button>`
  ).join('');
  addLeafType='moment';
  picker.querySelectorAll('.add-type-btn').forEach(btn=>{
    btn.onclick=()=>{
      picker.querySelectorAll('.add-type-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      addLeafType=btn.dataset.type;
    };
  });

  // Twyg tags
  const tags=document.getElementById('add-twyg-tags');
  tags.innerHTML=people.map(p=>{
    const nm=p.isYou?'You':fullName(p).split(' ')[0];
    const c=getNodeColor(p);
    return `<button type="button" class="add-twyg-btn" data-tid="${p.id}"><span class="twyg-dot" style="background:${c}"></span>${nm}</button>`;
  }).join('');
  tags.querySelectorAll('.add-twyg-btn').forEach(btn=>{
    btn.onclick=()=>btn.classList.toggle('active');
  });

  // Emoji picker
  const emRow=document.getElementById('add-emoji-row');
  addLeafEmoji='';
  emRow.innerHTML=['😂','❤️','😢','🎉','🙏','😮'].map(em=>
    `<span class="add-emoji" data-em="${em}">${em}</span>`
  ).join('');
  emRow.querySelectorAll('.add-emoji').forEach(em=>{
    em.onclick=()=>{
      const was=em.classList.contains('active');
      emRow.querySelectorAll('.add-emoji').forEach(e=>e.classList.remove('active'));
      if(!was){em.classList.add('active');addLeafEmoji=em.dataset.em;}
      else{addLeafEmoji='';}
    };
  });

  // Clear inputs
  document.getElementById('add-title').value='';
  document.getElementById('add-content').value='';
  document.getElementById('add-year').value='';
  document.getElementById('add-month').value='';
  document.getElementById('add-day').value='';

  bg.classList.add('open');
}

function closeAddLeaf(){
  document.getElementById('add-bg').classList.remove('open');
}

async function submitNewLeaf(){
  const title=document.getElementById('add-title').value.trim();
  const content=document.getElementById('add-content').value.trim();
  if(!content&&!title){
    document.getElementById('add-content').style.borderColor='rgba(200,80,80,.6)';
    setTimeout(()=>{document.getElementById('add-content').style.borderColor='';},2000);
    return;
  }

  const year=parseInt(document.getElementById('add-year').value)||0;
  const month=parseInt(document.getElementById('add-month').value)||0;
  const day=parseInt(document.getElementById('add-day').value)||0;
  const date=year?{year,month,day}:null;

  const twygs=[];
  document.querySelectorAll('.add-twyg-btn.active').forEach(btn=>twygs.push(btn.dataset.tid));
  if(!twygs.length){
    // Must tag at least one twyg
    document.getElementById('add-twyg-tags').style.outline='1px solid rgba(200,80,80,.4)';
    setTimeout(()=>{document.getElementById('add-twyg-tags').style.outline='';},2000);
    return;
  }

  const leaf={
    id:'leaf_'+Date.now(),
    type:addLeafType,
    title,
    content,
    date,
    emoji:addLeafEmoji||null,
    twygs,
    media:[],
    createdBy:currentUser.uid,
    createdAt:Date.now()
  };

  leafs.push(leaf);

  // Save to Firestore
  try{
    const key=await deriveKey(currentUser.uid);
    const encrypted=await encrypt(key, leafs);
    await db.collection('familyTrees').doc(currentUser.uid).update({encryptedLeafs:encrypted, leafCount:leafs.length});
  }catch(e){console.error('Save leaf failed:',e);}

  closeAddLeaf();
  renderTwygFilters();
  renderLeafs();
}

document.getElementById('btn-new-leaf')?.addEventListener('click', openAddLeaf);
document.getElementById('btn-submit-new-leaf')?.addEventListener('click', submitNewLeaf);
document.getElementById('add-bg')?.addEventListener('click',e=>{
  if(e.target===e.currentTarget) closeAddLeaf();
});
