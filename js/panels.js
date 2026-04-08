/* ═══ panels.js ═══ Members panel, timeline panel, tooltip, scrim ═══ */

// ─── MEMBERS PANEL ────────────────────────────────────────────────────────────
function openMembersPanel(){
  renderMembersList();
  document.getElementById('members-panel').classList.add('open');
  document.getElementById('scrim').classList.add('on');
}
function closeMembersPanel(){
  document.getElementById('members-panel').classList.remove('open');
  if(!selectedNodeId) document.getElementById('scrim').classList.remove('on');
}

function renderMembersList(){
  const query=(document.getElementById('mp-search-input').value||'').toLowerCase();
  const youNode=people.find(p=>p.isYou);
  const gen={};
  if(youNode){
    const q=[{id:youNode.id,gv:0}]; const vis=new Set();
    while(q.length){ const {id,gv}=q.shift(); if(vis.has(id)) continue; vis.add(id); gen[id]=gv;
      const p=peopleById[id]; if(!p) continue;
      (p.parents||[]).forEach(pid=>{ if(!vis.has(pid)) q.push({id:pid,gv:gv-1}); });
      people.filter(x=>(x.parents||[]).includes(id)).forEach(c=>{ if(!vis.has(c.id)) q.push({id:c.id,gv:gv+1}); });
    }
  }
  people.forEach(p=>{ if(gen[p.id]===undefined) gen[p.id]=0; });

  const genLabels={'-4':'Great-Great-Grandparents','-3':'Great-Grandparents','-2':'Grandparents','-1':'Parents','0':'Your Generation','1':'Children','2':'Grandchildren','3':'Great-Grandchildren'};
  const filtered=people.filter(p=>!query||fullName(p).toLowerCase().includes(query));
  const byGen2={};
  filtered.forEach(p=>{ const gv=gen[p.id]||0; if(!byGen2[gv]) byGen2[gv]=[]; byGen2[gv].push(p); });
  const gens=Object.keys(byGen2).map(Number).sort((a,b)=>a-b);

  let html='';
  gens.forEach(gv=>{
    const label=genLabels[gv]||(gv<0?`${Math.abs(gv)} generations up`:`${gv} generations down`);
    html+=`<div class="mp-gen">${label}</div>`;
    byGen2[gv].sort((a,b)=>fullName(a).localeCompare(fullName(b))).forEach(p=>{
      const c=getNodeColor(p), rel=getRelToYou(p.id);
      html+=`<div class="mp-item" onclick="closeMembersPanel();selectNode('${p.id}')">
        <div class="mp-photo" style="color:${c}">${p.photo?`<img src="${p.photo}"/>`:`<span>${initials(p)}</span>`}</div>
        <div class="mp-info">
          <div class="mp-name">${fullName(p)}${p.isYou?' (You)':''}</div>
          <div class="mp-sub">${rel||''}${dobDisplay(p)?` · ${dobDisplay(p)}`:''}</div>
        </div>
        <div class="mp-dot" style="background:${c};box-shadow:0 0 5px ${c}"></div>
      </div>`;
    });
  });
  if(!filtered.length) html=`<div style="text-align:center;padding:30px;color:var(--muted);font-size:.84rem">No members found</div>`;
  document.getElementById('mp-list').innerHTML=html;
}

// ─── TIMELINE ────────────────────────────────────────────────────────────────

function openTimeline(){
  renderTimeline();
  document.getElementById('timeline-panel').classList.add('open');
  document.getElementById('scrim').classList.add('on');
}
function closeTimeline(){
  document.getElementById('timeline-panel').classList.remove('open');
  if(!selectedNodeId&&!document.getElementById('members-panel').classList.contains('open'))
    document.getElementById('scrim').classList.remove('on');
}

function renderTimeline(){
  const body=document.getElementById('tl-body');
  const currentYear=new Date().getFullYear();

  // Build sorted list of members with birth years
  const entries=people.map(p=>{
    const birthYear=parseInt(p.dob&&p.dob.year)||p.birth||0;
    const deathYear=parseInt(p.dod&&p.dod.year)||p.death||0;
    const age=calcAge(p);
    const rel=p.isYou?'You':getRelToYou(p.id);
    const c=getNodeColor(p);
    return {p,birthYear,deathYear,age,rel,color:c,name:fullName(p)};
  }).filter(e=>e.birthYear>0) // Only show members with known birth years
   .sort((a,b)=>a.birthYear-b.birthYear);

  if(!entries.length){
    body.innerHTML='<div style="text-align:center;padding:60px 20px;color:var(--muted);font-size:.88rem">No birth years recorded yet.<br>Add dates to your Twygs to see the timeline.</div>';
    return;
  }

  // Find the year range
  const minYear=entries[0].birthYear;
  const maxYear=Math.max(...entries.map(e=>e.deathYear||currentYear));
  const span=maxYear-minYear||1;

  // Group entries by decade
  const decades={};
  entries.forEach(e=>{
    const decade=Math.floor(e.birthYear/10)*10;
    if(!decades[decade]) decades[decade]=[];
    decades[decade].push(e);
  });

  let html='';
  const sortedDecades=Object.keys(decades).sort((a,b)=>a-b);

  sortedDecades.forEach(decade=>{
    // Decade marker
    html+=`<div class="tl-year-mark">${decade}s</div>`;

    decades[decade].forEach(e=>{
      const p=e.p;
      const lifespan=e.deathYear?(e.deathYear-e.birthYear):(currentYear-e.birthYear);
      const barWidth=Math.max(8, Math.min(200, (lifespan/span)*200));

      // Photo
      const photoHtml=p.photo
        ?`<div class="tl-photo"><img src="${p.photo}"/></div>`
        :`<div class="tl-photo" style="color:${e.color}">${initials(p)}</div>`;

      // Life dates
      let dateStr=`${e.birthYear}`;
      if(e.deathYear) dateStr+=` – ${e.deathYear}`;
      else dateStr+=` – present`;
      if(e.age!=null) dateStr+=` · ${e.deathYear?e.age+' yrs':'Age '+e.age}`;

      // Story preview
      const storyHtml=(p.note&&!p.note.includes('Tap Edit to add your story'))
        ?`<div class="tl-story">${p.note}</div>`:'';

      html+=`<div class="tl-entry" onclick="closeTimeline();selectNode('${p.id}')" style="--dot-color:${e.color}">
        ${photoHtml}
        <div class="tl-info">
          <div class="tl-name">${e.name}</div>
          ${e.rel?`<div class="tl-rel">${e.rel}</div>`:''}
          <div class="tl-meta">${dateStr}</div>
          <div class="tl-lifespan" style="width:${barWidth}px;background:${e.color}"></div>
          ${storyHtml}
        </div>
      </div>`;
    });
  });

  body.innerHTML=html;
}

// ─── TOOLTIP ─────────────────────────────────────────────────────────────────
function calcAge(p){
  const birthYear=parseInt(p.dob&&p.dob.year)||p.birth||null;
  if(!birthYear) return null;
  const deathYear=parseInt(p.dod&&p.dod.year)||p.death||null;
  const endYear=deathYear||(new Date().getFullYear());
  return endYear-birthYear;
}

function showTooltip(e,p){
  if(selectedNodeId||nodeDragState) return;
  const t=document.getElementById('tip');
  const photoHtml=p.photo?`<div class="tip-photo"><img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/></div>`:'';
  const rel=getRelToYou(p.id);
  const age=calcAge(p);
  const ageStr=age?(p.death||(p.dod&&p.dod.year)?` · ${age} yrs`:(` · Age ${age}`)):'';
  t.innerHTML=`${photoHtml}<span>${fullName(p)}${rel?' · '+rel:''}${ageStr}</span>`;
  t.style.left=(e.clientX+14)+'px'; t.style.top=(e.clientY-12)+'px';
  t.classList.add('show');
}
function hideTooltip(){ document.getElementById('tip').classList.remove('show'); }

// ─── SCRIM CLICK ─────────────────────────────────────────────────────────────
function handleScrimClick(e){
  if(document.getElementById('settings-panel').classList.contains('open')){ closeSettings(); return; }
  if(document.getElementById('members-panel').classList.contains('open')){ closeMembersPanel(); return; }
  if(document.getElementById('timeline-panel').classList.contains('open')){ closeTimeline(); return; }
  closeCard();
}

// ─── TRANSFORM ────────────────────────────────────────────────────────────────
let panX=0, panY=0, scale=1;
function applyTransform(anim=false){
  const tg=document.getElementById('tg');
  if(anim){ tg.classList.add('anim'); setTimeout(()=>tg.classList.remove('anim'),700); }
  tg.style.transform=`translate(${panX}px,${panY}px) scale(${scale})`;
}
