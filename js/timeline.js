/* ═══ timeline.js ═══════════════════════════════════════════════════════════
 * Timeline page: horizontal chronological view of all family members.
 * Self-contained — has its own Firebase init, encryption, and rendering.
 *
 * KEY FUNCTIONS:
 *   renderTimeline()   — renders all nodes on the horizontal timeline
 *   buildBars()        — creates horizontal scroll + vertical zoom bars
 *   resetView()        — centers on isYou node at default zoom
 * ═══════════════════════════════════════════════════════════════════════════ */

firebase.initializeApp({apiKey:"AIzaSyBwtDMGEIphvwvq319MZIr62C32fvSSe-4",authDomain:"twygie.firebaseapp.com",projectId:"twygie",storageBucket:"twygie.firebasestorage.app",messagingSenderId:"654053569477",appId:"1:654053569477:web:9296f441c285686d7c11ac"});
const auth=firebase.auth(),db=firebase.firestore();
let people=[],peopleById={},currentUser=null,youngAge=17;
const nodeColors={you:'#f0efeb',spouse:'#e8a838',parent:'#7ab8e8',child:'#6ecb8a',sibling:'#e87a5a',grandparent:'#b89ae8',extended:'#e8c87a',deceased:'#6b9ec2',young:'#4ecdb4',default:'#f0b845'};

async function deriveKey(uid){const e=new TextEncoder();const km=await crypto.subtle.importKey('raw',e.encode(uid),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:e.encode('twygie-encryption-v1'),iterations:100000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function decrypt(key,b64){const bin=atob(b64);const raw=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)raw[i]=bin.charCodeAt(i);const dec=await crypto.subtle.decrypt({name:'AES-GCM',iv:raw.slice(0,12)},key,raw.slice(12));return JSON.parse(new TextDecoder().decode(dec))}
async function encrypt(key,data){const iv=crypto.getRandomValues(new Uint8Array(12));const enc=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(data)));const buf=new Uint8Array(iv.length+enc.byteLength);buf.set(iv);buf.set(new Uint8Array(enc),iv.length);let b='';for(let i=0;i<buf.length;i++)b+=String.fromCharCode(buf[i]);return btoa(b)}
function fullName(p){return p.name||[(p.firstName||''),(p.lastName||'')].filter(Boolean).join(' ')||'Unknown'}
function initials(p){return fullName(p).split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
function calcAge(p){const by=parseInt(p.dob&&p.dob.year)||p.birth||null;if(!by)return null;const dy=parseInt(p.dod&&p.dod.year)||p.death||null;return(dy||new Date().getFullYear())-by}
function genderedRel(b,g){const m=g==='male',f=g==='female';const map={'Parent':m?'Father':f?'Mother':'Parent','Child':m?'Son':f?'Daughter':'Child','Sibling':m?'Brother':f?'Sister':'Sibling','Spouse':m?'Husband':f?'Wife':'Partner','Grandparent':m?'Grandfather':f?'Grandmother':'Grandparent','Grandchild':m?'Grandson':f?'Granddaughter':'Grandchild'};return map[b]||b}
function getRelToYou(id){const you=people.find(p=>p.isYou);if(!you||id===you.id)return'';const p=peopleById[id];if(!p)return'';if((p.parents||[]).includes(you.id))return genderedRel('Child',p.gender);if((you.parents||[]).includes(id))return genderedRel('Parent',p.gender);if(p.spouseOf===you.id||you.spouseOf===id)return genderedRel('Spouse',p.gender);const ycl=you.customLinks&&you.customLinks[id];if(ycl)return typeof ycl==='string'?ycl:ycl.label;const pcl=p.customLinks&&p.customLinks[you.id];if(pcl)return typeof pcl==='string'?pcl:pcl.label;if(p.relLabel)return p.relLabel;const myP=new Set(you.parents||[]);if(myP.size&&(p.parents||[]).some(pp=>myP.has(pp)))return genderedRel('Sibling',p.gender);return''}
function relCategory(p){if(p.isYou)return'you';if(p.death||(p.dod&&p.dod.year))return'deceased';const by=parseInt(p.dob&&p.dob.year)||p.birth||0;if(by>0&&(new Date().getFullYear()-by)<=youngAge)return'young';const you=people.find(x=>x.isYou);if(!you)return'default';if((p.parents||[]).includes(you.id))return'child';if((you.parents||[]).includes(p.id))return'parent';if(p.spouseOf===you.id||you.spouseOf===p.id)return'spouse';const myP=new Set(you.parents||[]);if(myP.size&&(p.parents||[]).some(pp=>myP.has(pp)))return'sibling';if((you.customLinks&&you.customLinks[p.id])||(p.customLinks&&p.customLinks[you.id]))return'extended';return'default'}
function getNodeColor(p){return nodeColors[relCategory(p)]||nodeColors.default}

// ─── TIMELINE STATE ───
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
let scrollPos=0.5; // 0-1 horizontal position — start centered
let zoomLevel=0.5; // 0=overview, 1=month-level — start mid-bar
let minY=1950, maxY=2030, byYearCount={};

// Zoom → pixels per year
function yearPx(){
  // 0 → 15px/yr (overview), 0.3 → 50px/yr (decade), 0.6 → 200px/yr (year), 1.0 → 800px/yr (month)
  return Math.round(15*Math.pow(800/15, zoomLevel));
}

function xOf(year,month){
  const px=yearPx();
  const base=(year-minY)*px;
  if(month!=null) return 100+base+(month/12)*px;
  return 100+base;
}

function renderTimeline(){
  const inner=document.getElementById('tl-inner');
  const curYr=new Date().getFullYear();
  const you=people.find(p=>p.isYou);
  const entries=people.filter(p=>(parseInt(p.dob&&p.dob.year)||p.birth||0)>0);
  const undated=people.filter(p=>!((parseInt(p.dob&&p.dob.year)||p.birth||0)>0));
  const missingBtn=document.getElementById('tl-missing-btn');
  const countEl=document.getElementById('tl-missing-count');
  const listEl=document.getElementById('tl-missing-list');
  if(missingBtn&&countEl){
    if(undated.length>0){
      missingBtn.style.display='';
      countEl.textContent=undated.length;
      if(listEl){
        listEl.innerHTML=undated.map(p=>{
          const c=getNodeColor(p), nm=fullName(p), ini=initials(p);
          return `<div class="tl-miss-row" id="miss-${p.id}" style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:10px;padding:12px;transition:all .3s">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <div style="width:32px;height:32px;border-radius:50%;background:${c};display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:600;color:#04070c;flex-shrink:0">${ini}</div>
              <div style="font-size:.88rem;font-weight:500;color:var(--text)">${nm}</div>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
              <input type="number" placeholder="Year" min="1800" max="2030" id="yr-${p.id}" style="flex:2;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--text);font-family:Outfit,sans-serif;font-size:.8rem"/>
              <select id="mo-${p.id}" style="flex:2;padding:6px 4px;border-radius:6px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--text);font-family:Outfit,sans-serif;font-size:.8rem">
                <option value="">Mo</option>${MONTHS.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('')}
              </select>
              <input type="number" placeholder="Day" min="1" max="31" id="dy-${p.id}" style="flex:1.5;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--text);font-family:Outfit,sans-serif;font-size:.8rem"/>
              <button onclick="window._saveDob('${p.id}')" style="padding:6px 10px;border-radius:6px;background:var(--gold);border:none;color:#04070c;font-family:Outfit,sans-serif;font-size:.78rem;font-weight:600;cursor:pointer">Save</button>
            </div>
          </div>`;
        }).join('');
      }
    } else {
      missingBtn.style.display='none';
      closeMissing();
    }
  }
  if(!entries.length){document.getElementById('empty').classList.add('show');return}

  const bys=entries.map(p=>parseInt(p.dob&&p.dob.year)||p.birth);
  let rawMin=Math.min(...bys)-2, rawMax=Math.max(curYr,...bys)+2;

  // Pad range symmetrically around isYou so they appear centered on the h-bar
  const youNode=you;
  const youBY=youNode?(parseInt(youNode.dob&&youNode.dob.year)||youNode.birth||0):0;
  if(youBY){
    const distLeft=youBY-rawMin;
    const distRight=rawMax-youBY;
    const maxDist=Math.max(distLeft,distRight);
    minY=youBY-maxDist;
    maxY=youBY+maxDist;
  } else {
    minY=rawMin; maxY=rawMax;
  }
  byYearCount={};entries.forEach(p=>{const by=parseInt(p.dob&&p.dob.year)||p.birth;byYearCount[by]=(byYearCount[by]||0)+1});

  const px=yearPx();
  const totalW=200+(maxY-minY)*px;
  inner.style.width=totalW+'px';

  let html='';

  // ── Markers based on zoom ──
  const showMonths=px>=150; // show month ticks when zoomed in enough
  const showYears=px>=30;   // show year ticks
  for(let y=minY;y<=maxY;y++){
    const iD=y%10===0;
    if(!showYears&&!iD) continue;
    const x=xOf(y);
    html+=`<div class="yr${iD?' decade':''}" style="left:${x}px"><div class="yr-tick"></div><div class="yr-label">${y}</div></div>`;
    // Month subdivisions
    if(showMonths){
      for(let m=1;m<12;m++){
        const mx=xOf(y,m);
        html+=`<div class="yr month" style="left:${mx}px"><div class="yr-tick"></div><div class="yr-label">${MONTHS[m]}</div></div>`;
      }
    }
  }

  // ── Group entries by birth year ──
  const byYear={};entries.forEach(p=>{const by=parseInt(p.dob&&p.dob.year)||p.birth;if(!byYear[by])byYear[by]=[];byYear[by].push(p)});

  Object.keys(byYear).sort((a,b)=>a-b).forEach(year=>{
    const ms=byYear[year],x=xOf(parseInt(year));

    if(ms.length===1){
      const p=ms[0],c=getNodeColor(p),rel=p.isYou?'You':getRelToYou(p.id),age=calcAge(p),nm=fullName(p);
      const dy=parseInt(p.dod&&p.dod.year)||p.death||0;
      const story=(p.note&&!p.note.includes('Tap Edit'))?p.note:'';
      const dot=p.photo?`<img src="${p.photo}"/>`:`<span>${initials(p)}</span>`;
      let ds=`${year}`;if(dy)ds+=` – ${dy}`;
      const ag=age!=null?(dy?`Lived ${age} years`:`Age ${age}`):'';
      const pp=p.photo?`<div class="tl-pp" style="background:${c}"><img src="${p.photo}"/></div>`:`<div class="tl-pp" style="background:${c};color:#04070c">${initials(p)}</div>`;

      html+=`<div class="tl-node" style="left:${x}px;bottom:32%" onclick="openDetail('${p.id}')">
        <div class="tl-popup"><div class="tl-pop">${pp}<div class="tl-pn">${nm}</div>${rel?`<div class="tl-pr">${rel}</div>`:''}<div class="tl-pd">${ds}</div>${ag?`<div class="tl-pa">${ag}</div>`:''}${story?`<div class="tl-ps">${story}</div>`:''}</div></div>
        <div class="tl-dot" style="background:${c};color:#04070c">${dot}</div>
        <div class="tl-nm">${nm.split(' ')[0]}</div>
        <div class="tl-conn" style="background:${c};height:10px"></div>
      </div>`;
    } else {
      const sd=ms.slice(0,5).map(p=>`<div class="tl-sd" style="background:${getNodeColor(p)}"></div>`).join('');
      let cards='';
      ms.forEach(p=>{const c=getNodeColor(p),rel=p.isYou?'You':getRelToYou(p.id),age=calcAge(p),nm=fullName(p);
        const dy=parseInt(p.dod&&p.dod.year)||p.death||0;let ds=`${year}`;if(dy)ds+=` – ${dy}`;
        const ag=age!=null?(dy?`${age} yrs`:`Age ${age}`):'';
        const ph=p.photo?`<div class="tl-gc-p" style="background:${c}"><img src="${p.photo}"/></div>`:`<div class="tl-gc-p" style="background:${c};color:#04070c">${initials(p)}</div>`;
        cards+=`<div class="tl-gc" onclick="event.stopPropagation();openDetail('${p.id}')">${ph}<div style="flex:1;min-width:0"><div class="tl-gc-n">${nm}</div>${rel?`<div class="tl-gc-r">${rel}</div>`:''}<div class="tl-gc-m">${ds}${ag?' · '+ag:''}</div></div></div>`});

      html+=`<div class="tl-group" style="left:${x}px;bottom:32%">
        <div class="tl-gpop"><div class="tl-gpi">${cards}</div></div>
        <div class="tl-badge">${ms.length}</div>
        <div class="tl-stack">${sd}</div>
        <div class="tl-conn" style="background:var(--gold);height:10px;opacity:.3"></div>
      </div>`;
    }
  });

  inner.innerHTML=`<div id="tl-line"></div>${html}`;

  // Legend
  const cats=new Set(entries.map(p=>relCategory(p)));
  const cl={you:'You',spouse:'Spouse',parent:'Parent',child:'Child',sibling:'Sibling',grandparent:'Grandparent',extended:'Extended',deceased:'Deceased',young:'Young',default:'Other'};
  let lh='';cats.forEach(c=>{lh+=`<div class="leg-i"><div class="leg-d" style="background:${nodeColors[c]}"></div>${cl[c]||c}</div>`});
  document.getElementById('legend').innerHTML=lh;

  applyScroll();
}

function applyScroll(){
  const inner=document.getElementById('tl-inner');
  const area=document.getElementById('tl-scroll');
  const totalW=parseFloat(inner.style.width)||1;
  const viewW=area.clientWidth;
  const maxOffset=Math.max(0,totalW-viewW);
  const offset=-scrollPos*maxOffset;
  inner.style.transform=`translateX(${offset}px)`;
}

// ─── SCROLL BARS ───
const BAR_N=32;
const GLOW='0 0 8px rgba(200,168,75,.2)';
let vBars=[],hBars=[];

function buildBars(){
  const vc=document.getElementById('vb-lines'),hc=document.getElementById('hb-lines');
  vc.innerHTML='';hc.innerHTML='';vBars=[];hBars=[];
  for(let i=0;i<BAR_N;i++){
    const vb=document.createElement('div');vb.className='sb-line';vc.appendChild(vb);vBars.push(vb);
    const hb=document.createElement('div');hb.className='sb-line';hc.appendChild(hb);hBars.push(hb);
  }
}

function updateYouTick(){
  const tick=document.getElementById('you-tick');
  const hbar=document.getElementById('h-bar');
  if(!tick||!hbar)return;
  const you=people.find(p=>p.isYou);
  if(!you){tick.style.display='none';return}
  const yby=parseInt(you.dob&&you.dob.year)||you.birth||0;
  if(!yby){tick.style.display='none';return}
  tick.style.display='';
  // Calculate where isYou falls in the total timeline as 0-1
  const span=maxY-minY||1;
  const youFrac=(yby-minY)/span;
  // Map to h-bar width (accounting for padding)
  const rect=hbar.getBoundingClientRect();
  const barPad=12; // matches CSS padding
  const barW=rect.width-barPad*2;
  tick.style.left=(barPad+youFrac*barW)+'px';
}

function renderBars(){
  const maxC=Math.max(1,...Object.values(byYearCount));
  const span=maxY-minY||1;

  // Position the isYou tick on horizontal bar
  updateYouTick();

  // Horizontal bar — position indicator
  const hActive=scrollPos*(hBars.length-1);
  hBars.forEach((bar,i)=>{
    const dist=Math.abs(i-hActive);
    const posOp=Math.min(.9,Math.max(.06,1-dist*.17));
    const barYear=Math.round(minY+(i/(hBars.length-1))*span);
    let dens=0;for(let y=barYear-1;y<=barYear+1;y++)dens+=byYearCount[y]||0;
    const densOp=dens>0?Math.min(.4,.1+dens/maxC*.3):0;
    const op=Math.min(1,posOp+densOp);
    const sc=1+Math.max(0,.2-dist*.025);
    if(dens>0&&dist>2){bar.style.backgroundColor=`rgba(200,168,75,${densOp+.06})`}
    else{bar.style.backgroundColor=`rgba(255,255,255,${op})`}
    bar.style.transform=`scaleY(${sc})`;
    bar.style.boxShadow=dist<.8?GLOW:'none';
  });

  // Vertical bar — zoom level indicator
  const vActive=zoomLevel*(vBars.length-1);
  vBars.forEach((bar,i)=>{
    const dist=Math.abs(i-vActive);
    const op=Math.min(.9,Math.max(.06,1-dist*.17));
    const sc=1+Math.max(0,.2-dist*.025);
    bar.style.backgroundColor=`rgba(200,168,75,${op})`;
    bar.style.transform=`scaleX(${sc})`;
    bar.style.boxShadow=dist<.8?GLOW:'none';
  });
}

// ─── BAR INTERACTION ───
function setupBar(el, axis, onDrag){
  let active=false;
  const getProgress=(e)=>{
    const r=el.getBoundingClientRect();
    if(axis==='y') return Math.min(1,Math.max(0,(e.clientY-r.top)/r.height));
    return Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));
  };
  el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);active=true;el.classList.add('active');onDrag(getProgress(e))});
  el.addEventListener('pointermove',e=>{if(!active)return;e.preventDefault();onDrag(getProgress(e))});
  el.addEventListener('pointerup',()=>{active=false;el.classList.remove('active')});
  el.addEventListener('pointercancel',()=>{active=false;el.classList.remove('active')});
  el.addEventListener('lostpointercapture',()=>{active=false;el.classList.remove('active')});
}

// Horizontal bar → scroll position
setupBar(document.getElementById('h-bar'),'x',p=>{
  scrollPos=p;
  applyScroll();
  renderBars();
});

// Vertical bar → zoom level
setupBar(document.getElementById('v-bar'),'y',p=>{
  // Save center year before zoom
  const area=document.getElementById('tl-scroll');
  const inner=document.getElementById('tl-inner');
  const totalW=parseFloat(inner.style.width)||1;
  const viewW=area.clientWidth;
  const centerX=scrollPos*Math.max(0,totalW-viewW)+viewW/2;
  const centerYear=minY+(centerX-100)/yearPx();

  zoomLevel=p;
  updateZoomLabel();
  renderTimeline();

  // Restore center year after re-render
  const newPx=yearPx();
  const newTotalW=200+(maxY-minY)*newPx;
  const newCenterX=100+(centerYear-minY)*newPx;
  const newMaxOffset=Math.max(0,newTotalW-viewW);
  scrollPos=newMaxOffset>0?Math.min(1,Math.max(0,(newCenterX-viewW/2)/newMaxOffset)):0;
  applyScroll();
  renderBars();
});

// ─── HOVER MAGNIFICATION (dock-like effect) ───
function addHoverMag(el, getBars, axis){
  el.addEventListener('mousemove',e=>{
    const bars=getBars();
    if(!bars.length)return;
    const r=el.getBoundingClientRect();
    const frac=axis==='x'
      ?(e.clientX-r.left)/r.width
      :(e.clientY-r.top)/r.height;
    const hoverIdx=frac*(bars.length-1);
    bars.forEach((bar,i)=>{
      const dist=Math.abs(i-hoverIdx);
      const mag=Math.max(1, 2.2-dist*0.35);
      const prop=axis==='x'?'scaleY':'scaleX';
      bar.style.transform=`${prop}(${mag})`;
    });
  });
  el.addEventListener('mouseleave',()=>{
    renderBars();
  });
}
addHoverMag(document.getElementById('h-bar'), ()=>hBars, 'x');
addHoverMag(document.getElementById('v-bar'), ()=>vBars, 'y');

function updateZoomLabel(){
  const px=yearPx();
  const label=document.getElementById('zoom-label');
  if(px>=400) label.textContent='Month';
  else if(px>=120) label.textContent='Year';
  else if(px>=35) label.textContent='Decade';
  else label.textContent='Overview';
}

// ─── RESET VIEW ───
function resetView(){
  zoomLevel=0.5;
  renderTimeline();
  scrollToYou();
  renderBars();
  updateZoomLabel();
}

// ─── DETAIL MODAL ───
function closeDetail(){document.getElementById('detail-bg').classList.remove('open')}

function openDetail(id){
  const p=peopleById[id];if(!p)return;
  const c=getNodeColor(p);
  const rel=p.isYou?'You':getRelToYou(p.id);
  const age=calcAge(p);
  const nm=fullName(p);
  const by=parseInt(p.dob&&p.dob.year)||p.birth||0;
  const dy=parseInt(p.dod&&p.dod.year)||p.death||0;
  const story=(p.note&&!p.note.includes('Tap Edit'))?p.note:'';

  // Photo
  const photoHtml=p.photo
    ?`<div class="dc-photo" style="border:3px solid ${c}"><img src="${p.photo}"/></div>`
    :`<div class="dc-photo" style="background:${c};color:#04070c">${initials(p)}</div>`;

  // Dates
  let dateStr='';
  if(by){
    const months=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const bParts=[];
    if(p.dob&&p.dob.month)bParts.push(months[parseInt(p.dob.month)]||'');
    if(p.dob&&p.dob.day)bParts.push(p.dob.day);
    bParts.push(by);
    dateStr='Born '+bParts.join(' ');
    if(age!=null) dateStr+=` · ${dy?'Lived '+age+' years':'Age '+age}`;
    if(dy){
      const dParts=[];
      if(p.dod&&p.dod.month)dParts.push(months[parseInt(p.dod.month)]||'');
      if(p.dod&&p.dod.day)dParts.push(p.dod.day);
      dParts.push(dy);
      dateStr+='<br>Died '+dParts.join(' ');
    }
  }

  // ── Build mini family tree ──
  let treeHtml='';

  // Parents
  const parents=(p.parents||[]).map(pid=>peopleById[pid]).filter(Boolean);
  if(parents.length){
    treeHtml+='<div class="dc-tree-label">Parents</div><div class="dc-tree-row">';
    parents.forEach(par=>{
      const pc=getNodeColor(par);
      const dot=par.photo?`<img src="${par.photo}"/>`:`<span>${initials(par)}</span>`;
      treeHtml+=`<div class="dc-mini" onclick="openDetail('${par.id}')"><div class="dc-mini-dot" style="background:${pc};color:#04070c">${dot}</div><div class="dc-mini-name">${fullName(par).split(' ')[0]}</div></div>`;
    });
    treeHtml+='</div><div class="dc-tree-line"></div>';
  }

  // Spouse + Self row
  const spouse=p.spouseOf?peopleById[p.spouseOf]:people.find(x=>x.spouseOf===p.id);
  treeHtml+='<div class="dc-tree-row">';
  if(spouse){
    const sc=getNodeColor(spouse);
    const sdot=spouse.photo?`<img src="${spouse.photo}"/>`:`<span>${initials(spouse)}</span>`;
    treeHtml+=`<div class="dc-mini" onclick="openDetail('${spouse.id}')"><div class="dc-mini-dot" style="background:${sc};color:#04070c">${sdot}</div><div class="dc-mini-name">${fullName(spouse).split(' ')[0]}</div><div class="dc-mini-rel">${genderedRel('Spouse',spouse.gender)}</div></div>`;
    treeHtml+='<div class="dc-tree-hline"></div>';
  }
  const selfDot=p.photo?`<img src="${p.photo}"/>`:`<span>${initials(p)}</span>`;
  treeHtml+=`<div class="dc-mini" style="opacity:1"><div class="dc-mini-dot" style="background:${c};color:#04070c;box-shadow:0 0 12px ${c}">${selfDot}</div><div class="dc-mini-name" style="color:var(--text);font-weight:600">${nm.split(' ')[0]}</div></div>`;
  treeHtml+='</div>';

  // Children
  const children=people.filter(x=>(x.parents||[]).includes(p.id));
  if(children.length){
    treeHtml+='<div class="dc-tree-line"></div><div class="dc-tree-label">Children</div><div class="dc-tree-row">';
    children.forEach(ch=>{
      const cc=getNodeColor(ch);
      const cdot=ch.photo?`<img src="${ch.photo}"/>`:`<span>${initials(ch)}</span>`;
      treeHtml+=`<div class="dc-mini" onclick="openDetail('${ch.id}')"><div class="dc-mini-dot" style="background:${cc};color:#04070c">${cdot}</div><div class="dc-mini-name">${fullName(ch).split(' ')[0]}</div></div>`;
    });
    treeHtml+='</div>';
  }

  // Siblings
  const myP=new Set(p.parents||[]);
  const siblings=myP.size?people.filter(x=>x.id!==p.id&&(x.parents||[]).some(pp=>myP.has(pp))):[];
  // Also check customLinks for siblings
  const clSibs=Object.keys(p.customLinks||{}).filter(tid=>{
    const v=p.customLinks[tid];const lt=typeof v==='string'?'labeled':v.lineType;
    return lt==='sibling'&&!siblings.find(s=>s.id===tid);
  }).map(tid=>peopleById[tid]).filter(Boolean);
  const allSibs=[...siblings,...clSibs];
  if(allSibs.length){
    treeHtml+='<div style="height:8px"></div><div class="dc-tree-label">Siblings</div><div class="dc-tree-row">';
    allSibs.forEach(sib=>{
      const sc=getNodeColor(sib);
      const sdot=sib.photo?`<img src="${sib.photo}"/>`:`<span>${initials(sib)}</span>`;
      treeHtml+=`<div class="dc-mini" onclick="openDetail('${sib.id}')"><div class="dc-mini-dot" style="background:${sc};color:#04070c">${sdot}</div><div class="dc-mini-name">${fullName(sib).split(' ')[0]}</div></div>`;
    });
    treeHtml+='</div>';
  }

  // Assemble card
  const card=document.getElementById('detail-card');
  card.innerHTML=`
    <button class="dc-close" onclick="closeDetail()">✕</button>
    ${photoHtml}
    <div class="dc-name">${nm}</div>
    ${rel?`<div class="dc-rel">${rel}</div>`:''}
    ${dateStr?`<div class="dc-dates">${dateStr}</div>`:''}
    ${story?`<div class="dc-story">"${story}"</div>`:''}
    <div class="dc-divider"></div>
    <div class="dc-tree">${treeHtml}</div>
    <a class="dc-link" href="/app">View in Tree →</a>
  `;
  document.getElementById('detail-bg').classList.add('open');
}

// ─── INITIAL SCROLL TO isYou ───
function scrollToYou(){
  const you=people.find(p=>p.isYou);if(!you)return;
  const yby=parseInt(you.dob&&you.dob.year)||you.birth||0;if(!yby)return;
  const inner=document.getElementById('tl-inner');
  const area=document.getElementById('tl-scroll');
  const totalW=parseFloat(inner.style.width)||1;
  const viewW=area.clientWidth;
  const targetX=xOf(yby);
  const maxOffset=Math.max(0,totalW-viewW);
  // Center isYou in viewport
  scrollPos=maxOffset>0?Math.min(1,Math.max(0,(targetX-viewW/2)/maxOffset)):0.5;
  applyScroll();
}

// ─── AUTH + LOAD ───
auth.onAuthStateChanged(async user=>{
  if(!user){window.location.href='login.html';return}
  currentUser=user;
  try{
    const ss=await db.collection('userSettings').doc(user.uid).get();
    if(ss.exists){const d=ss.data();if(d.nodeColors)Object.assign(nodeColors,d.nodeColors);if(d.youngAge!=null)youngAge=parseInt(d.youngAge)||17}
    const snap=await db.collection('familyTrees').doc(user.uid).get();
    if(snap.exists){const d=snap.data();if(d.encryptedData){const key=await deriveKey(user.uid);people=await decrypt(key,d.encryptedData)}else if(d.people&&d.people.length)people=d.people}
    peopleById={};people.forEach(p=>{if(!p.customLinks)p.customLinks={};peopleById[p.id]=p});
    buildBars();
    renderTimeline();
    scrollToYou();
    renderBars();
    updateZoomLabel();
  }catch(e){console.error('Failed:',e);document.getElementById('empty').classList.add('show')}
  const ld=document.getElementById('loading');ld.classList.add('fade');setTimeout(()=>ld.classList.add('gone'),400);
});

// ─── EVENT LISTENERS ─────────────────────────────────────────────────────────
document.getElementById('btn-tl-reset')?.addEventListener('click', resetView);
document.getElementById('detail-bg')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeDetail();
});

// Missing Twygs modal
function openMissing(){
  const bg=document.getElementById('missing-bg');
  if(bg){bg.style.opacity='1';bg.style.pointerEvents='all';}
}
function closeMissing(){
  const bg=document.getElementById('missing-bg');
  if(bg){bg.style.opacity='0';bg.style.pointerEvents='none';}
}
document.getElementById('tl-missing-btn')?.addEventListener('click', openMissing);
document.getElementById('missing-bg')?.addEventListener('click', e => {
  if(e.target===e.currentTarget) closeMissing();
});

// Event delegation for save buttons — also expose globally
document.getElementById('tl-missing-list')?.addEventListener('click', e => {
  const btn=e.target.closest('button[onclick]');
  // handled by inline onclick → window._saveDob
});

// Save birthdate from Missing Twygs modal
window._saveDob = async function(pid){
  const p=people.find(x=>x.id===pid); if(!p) return;
  const yr=document.getElementById('yr-'+pid);
  const mo=document.getElementById('mo-'+pid);
  const dy=document.getElementById('dy-'+pid);
  const year=parseInt(yr?.value);
  if(!year){ if(yr) yr.style.borderColor='#c44'; return; }

  const month=parseInt(mo?.value)||0;
  const day=parseInt(dy?.value)||0;

  if(!p.dob) p.dob={};
  p.dob.year=year;
  if(month) p.dob.month=month;
  if(day) p.dob.day=day;

  // Visual feedback
  const row=document.getElementById('miss-'+pid);
  const saveBtn=row?.querySelector('button');
  if(saveBtn){ saveBtn.textContent='Saving…'; saveBtn.disabled=true; }

  try{
    const treeRef=db.collection('familyTrees').doc(currentUser.uid);
    const key=await deriveKey(currentUser.uid);
    const encrypted=await encrypt(key, people);
    await treeRef.set({
      encryptedData:encrypted,
      encryptionVersion:1,
      ownerEmail:currentUser.email||''
    });

    // Animate row removal then re-render
    if(row){
      row.style.opacity='0';
      row.style.transform='scale(.95)';
      setTimeout(()=>renderTimeline(), 350);
    } else renderTimeline();
  }catch(e){
    console.error('Save DOB failed:',e);
    if(saveBtn){ saveBtn.textContent='Error'; setTimeout(()=>{saveBtn.textContent='Save';saveBtn.disabled=false;},2000); }
  }
};
