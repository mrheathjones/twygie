/* ═══ app.js ═══ Pan/zoom, view controls, add member form, event listeners ═══ */

// ─── VIEW ────────────────────────────────────────────────────────────────────

function resetView(){
  if(!people.length) return;
  const xs=people.map(p=>p.x), ys=people.map(p=>p.y);
  const x0=Math.min(...xs)-90, x1=Math.max(...xs)+90;
  const y0=Math.min(...ys)-70, y1=Math.max(...ys)+100;
  const W=window.innerWidth, H=window.innerHeight;
  scale=Math.min(1,W/(x1-x0),(H-80)/(y1-y0))*.88;
  tx=(W-(x1-x0)*scale)/2-x0*scale;
  ty=(H-(y1-y0)*scale)/2-y0*scale+18;
  applyT(true);
}
function zoomBy(f){
  const cx=window.innerWidth/2, cy=window.innerHeight/2;
  tx=cx-(cx-tx)*f; ty=cy-(cy-ty)*f;
  scale=Math.max(.12,Math.min(6,scale*f)); applyT();
}

// ─── PAN ─────────────────────────────────────────────────────────────────────
let drag=false, dsx=0, dsy=0;
const wrap=document.getElementById('wrap');

wrap.addEventListener('mousedown',e=>{
  if(e.target.closest('.nd')) return;
  drag=true; dsx=e.clientX-tx; dsy=e.clientY-ty;
  wrap.style.cursor='grabbing'; hideTooltip();
});

wrap.addEventListener('wheel',e=>{
  e.preventDefault();
  const f=e.deltaY<0?1.11:.9;
  const r=wrap.getBoundingClientRect();
  const mx=e.clientX-r.left, my=e.clientY-r.top;
  tx=mx-(mx-tx)*f; ty=my-(my-ty)*f;
  scale=Math.max(.12,Math.min(6,scale*f)); applyT();
},{passive:false});

let ltD=0, tpan=false, tdsx=0, tdsy=0;
wrap.addEventListener('touchstart',e=>{
  if(e.target.closest('.nd')) return;
  if(e.touches.length===1){ tpan=true; tdsx=e.touches[0].clientX-tx; tdsy=e.touches[0].clientY-ty; }
  else if(e.touches.length===2){ tpan=false; ltD=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); }
},{passive:true});
wrap.addEventListener('touchmove',e=>{
  if(nodeDragState) return;
  if(e.touches.length===1&&tpan){ tx=e.touches[0].clientX-tdsx; ty=e.touches[0].clientY-tdsy; applyT(); }
  else if(e.touches.length===2){
    const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    const f=d/ltD; ltD=d;
    const cx=(e.touches[0].clientX+e.touches[1].clientX)/2;
    const cy2=(e.touches[0].clientY+e.touches[1].clientY)/2;
    tx=cx-(cx-tx)*f; ty=cy2-(cy2-ty)*f;
    scale=Math.max(.12,Math.min(6,scale*f)); applyT();
  }
},{passive:true});

// ─── ADD MEMBER ───────────────────────────────────────────────────────────────
let addForNodeId=null;
let modalPhotoData=null;
function handleModalPhoto(event){
  const file=event.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    modalPhotoData=e.target.result;
    const prev=document.getElementById('modal-photo-preview');
    if(prev) prev.innerHTML=`<img src="${modalPhotoData}" style="width:100%;height:100%;object-fit:cover"/>`;
  };
  reader.readAsDataURL(file);
}

const CHILD_RELS=['Son','Daughter','Grandson','Granddaughter','Great-grandson','Great-granddaughter','Great-great-grandson','Great-great-granddaughter','Stepson','Stepdaughter','Nephew','Niece','Grand-nephew','Grand-niece','Great-grand-nephew','Great-grand-niece','Godson','Goddaughter'];
const PARENT_RELS=['Father','Mother','Grandfather','Grandmother','Great-grandfather','Great-grandmother','Great-great-grandfather','Great-great-grandmother','Stepfather','Stepmother','Father-in-law','Mother-in-law','Uncle','Aunt','Great-uncle','Great-aunt','Great-grand-uncle','Great-grand-aunt','Godfather','Godmother'];
const SPOUSE_RELS=['Husband','Wife','Partner'];
const SIBLING_RELS=['Brother','Sister','Brother-in-law','Sister-in-law','Half-brother','Half-sister','Stepbrother','Stepsister','Cousin','First Cousin','First Cousin Once Removed','First Cousin Twice Removed','First Cousin Thrice Removed','Second Cousin','Second Cousin Once Removed','Second Cousin Twice Removed','Second Cousin Thrice Removed','Third Cousin','Third Cousin Once Removed','Third Cousin Twice Removed','Third Cousin Thrice Removed'];

function toggleDeathDate(){
  const cb=document.getElementById('f-deceased');
  const fields=document.getElementById('f-death-fields');
  const track=document.getElementById('f-deceased-track');
  const thumb=document.getElementById('f-deceased-thumb');
  if(!fields||!cb) return;
  fields.style.display=cb.checked?'block':'none';
  if(track) track.style.background=cb.checked?'rgba(200,168,75,.5)':'rgba(255,255,255,.12)';
  if(thumb) thumb.style.transform=cb.checked?'translateX(15px)':'translateX(0)';
}

function refreshModalRelOptions(){
  const fr=document.getElementById('fr'); if(!fr) return;
  // Remove any existing custom optgroup
  const existing=fr.querySelector('optgroup[data-custom]');
  if(existing) fr.removeChild(existing);
  // Add custom types if any exist
  if(customLineTypes&&customLineTypes.length){
    const og=document.createElement('optgroup');
    og.label='Custom'; og.dataset.custom='1';
    customLineTypes.forEach(t=>{
      const o=document.createElement('option');
      o.value='custom-'+t.name; o.textContent=t.name;
      og.appendChild(o);
    });
    fr.appendChild(og);
  }
}

function openModal(forId){
  addForNodeId=forId;
  const fp=forId?peopleById[forId]:null;
  document.getElementById('msub').textContent=fp?`Connected to ${fullName(fp)}`:'Add someone to your tree';
  document.getElementById('rel-to-label').textContent=fp?(fp.firstName||fullName(fp)):'the tree';
  ['fn-first','fn-last','fdob-day','fdob-year','fcity','fstory','fdod-day','fdod-year'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  ['fdob-month','fgender','fr','fstate','fdod-month'].forEach(id=>{const e=document.getElementById(id);if(e)e.selectedIndex=0;});
  const dec=document.getElementById('f-deceased'); if(dec){dec.checked=false; toggleDeathDate();}
  modalPhotoData=null;
  const prev=document.getElementById('modal-photo-preview'); if(prev) prev.innerHTML='<span>+</span>';
  const fi=document.getElementById('modal-photo-file'); if(fi) fi.value='';
  refreshModalRelOptions();
  document.getElementById('mbg').classList.add('open');
}
function closeModal(){ document.getElementById('mbg').classList.remove('open'); }

function submitMember(){
  const first=document.getElementById('fn-first').value.trim();
  const last=document.getElementById('fn-last').value.trim();
  const name=[first,last].filter(Boolean).join(' ');
  if(!name){ document.getElementById('fn-first').focus(); return; }

  const gender=document.getElementById('fgender').value;
  const dob={
    month:document.getElementById('fdob-month').value,
    day:document.getElementById('fdob-day').value,
    year:document.getElementById('fdob-year').value
  };
  const birth=parseInt(dob.year)||null;
  const deceased=document.getElementById('f-deceased')?.checked;
  const dod=deceased?{month:document.getElementById('fdod-month')?.value||'',day:document.getElementById('fdod-day')?.value||'',year:document.getElementById('fdod-year')?.value||''}:null;
  const death=dod?parseInt(dod.year)||null:null;
  const city=document.getElementById('fcity').value.trim();
  const state=document.getElementById('fstate').value||'';
  const note=document.getElementById('fstory').value.trim();
  const rel=document.getElementById('fr').value;

  // Infer base rel category
  if(!rel){ // No relationship — just add as standalone node
    people.push({id:`u${nextNodeId++}`,name,firstName:first,lastName:last,gender,dob,birth,dod,death,city,state,note,parents:[],customLinks:{},x:600+Math.random()*100-50,y:400+Math.random()*100-50});
    if(modalPhotoData){ people[people.length-1].photo=modalPhotoData; }
    rebuild([]); closeModal(); render(); scheduleSave();
    setTimeout(()=>selectNode(people[people.length-1].id),90); return;
  }
  const baseRel=CHILD_RELS.includes(rel)?'Child':PARENT_RELS.includes(rel)?'Parent':SPOUSE_RELS.includes(rel)?'Spouse':SIBLING_RELS.includes(rel)?'Sibling':'Other';

  const id=`u${nextNodeId++}`;
  const np={id,name,firstName:first,lastName:last,gender,dob,birth,dod,death,city,state,note,parents:[],relLabel:baseRel,x:600,y:400};
  if(modalPhotoData) np.photo=modalPhotoData;

  // Infer gender from relationship label
  if(!np.gender){
    if(['Son','Grandson','Stepson','Nephew','Brother','Brother-in-law','Uncle','Father','Grandfather','Stepfather','Father-in-law','Husband'].includes(rel)) np.gender='male';
    if(['Daughter','Granddaughter','Stepdaughter','Niece','Sister','Sister-in-law','Aunt','Mother','Grandmother','Stepmother','Mother-in-law','Wife'].includes(rel)) np.gender='female';
  }

  if(addForNodeId){
    const target=peopleById[addForNodeId];
    if(baseRel==='Child'){
      const directChildSet=new Set(['Son','Daughter','Stepson','Stepdaughter','Child']);
      if(directChildSet.has(rel)){
        np.parents=[addForNodeId];
      } else {
        // Grandchild, nephew, etc — customLink only
        np.parents=[];
        if(!np.customLinks) np.customLinks={};
        if(!target.customLinks) target.customLinks={};
        const ltype4=BLOOD_LABELS.has(rel)?'blood':'labeled';
        np.customLinks[addForNodeId]={label:rel,lineType:ltype4};
        target.customLinks[id]={label:rel,lineType:ltype4};
      }
    }
    else if(baseRel==='Parent'){
      np.parents=[];
      const directParentLabelsSet=new Set(['Father','Mother','Stepfather','Stepmother','Parent']);
      if(directParentLabelsSet.has(rel)){
        // Direct parent — add to target's parents array
        if(target) target.parents=[...(target.parents||[]),id];
      } else {
        // Grandparent, uncle, etc — store as customLink only
        if(!np.customLinks) np.customLinks={};
        if(!target.customLinks) target.customLinks={};
        const ltype=BLOOD_LABELS.has(rel)?'blood':'labeled';
        np.customLinks[addForNodeId]={label:rel,lineType:ltype};
        target.customLinks[id]={label:rel,lineType:ltype};
      }
    }
    else if(baseRel==='Sibling'){
      const directSibSet=new Set(['Brother','Sister','Half-brother','Half-sister','Stepbrother','Stepsister','Sibling']);
      if(directSibSet.has(rel)){
        // Direct siblings share parents — enables grandparent/uncle cascades
        np.parents=[...(target?.parents||[])];
        if(!np.customLinks) np.customLinks={};
        if(!target.customLinks) target.customLinks={};
        const sibLabel=np.gender==='male'?'Brother':np.gender==='female'?'Sister':'Sibling';
        np.customLinks[addForNodeId]={label:sibLabel,lineType:'sibling'};
        target.customLinks[id]={label:sibLabel,lineType:'sibling'};
      } else {
        // Cousins, in-laws, etc — customLink only (don't copy parents)
        np.parents=[];
        if(!np.customLinks) np.customLinks={};
        if(!target.customLinks) target.customLinks={};
        const ltype=BLOOD_LABELS.has(rel)?'blood':'labeled';
        np.customLinks[addForNodeId]={label:rel,lineType:ltype};
        target.customLinks[id]={label:inverseLabel(rel),lineType:ltype};
      }
    }
        else if(baseRel==='Spouse'){
          np.spouseOf=addForNodeId; if(target) target.spouseOf=id;
          // Structural: anchor's existing children become new spouse's children too
          people.filter(x=>(x.parents||[]).includes(addForNodeId)).forEach(child=>{
            if(!(child.parents||[]).includes(id)){
              child.parents=[...(child.parents||[]),id];
            }
          });
        }
    else if(rel&&rel.startsWith('custom-')){
      // Custom relationship type — store as customLink
      const customLabel=rel.slice(7); // remove 'custom-' prefix
      np.parents=[];
      if(!np.customLinks) np.customLinks={};
      if(!target.customLinks) target.customLinks={};
      np.customLinks[addForNodeId]={label:customLabel,lineType:'labeled'};
      target.customLinks[id]={label:customLabel,lineType:'labeled'};
      np.relLabel=customLabel;
    }
    else np.parents=[addForNodeId];
  }

  people.push(np);
  // Lightweight peopleById sync before auto-assign (full rebuild happens next)
  people.forEach(p=>{ if(!peopleById[p.id]) peopleById[p.id]=p; });
  // Auto-assign relationship to isYou if addForNodeId is set
  if(addForNodeId && rel){
    if(baseRel==='Sibling' && np.parents.length>0){
      // For siblings: run auto-assign as child of each parent — triggers full
      // isDirChild cascade (grandparents, uncles, in-laws, etc.)
      np.parents.forEach(pid=>{
        const childLabel=genderedRel('Child',np.gender);
        autoAssignToYou(id, pid, childLabel);
      });
    } else {
      autoAssignToYou(id, addForNodeId, rel);
    }
  }
  rebuild([id]); closeModal(); render(); scheduleSave();
  setTimeout(()=>{
    selectNode(id);
    // Prompt for wedding date if spouse connection was just created
    if(baseRel==='Spouse') promptWeddingDate(id);
  },90);
}

// ─── WEDDING DATE PROMPT ────────────────────────────────────────────────────
function promptWeddingDate(nodeId){
  const p=peopleById[nodeId]; if(!p) return;
  const spouseName=p.spouseOf?fullName(peopleById[p.spouseOf]):fullName(people.find(x=>x.spouseOf===nodeId)||{});
  const nodeName=fullName(p);
  const modal=document.getElementById('link-modal-content');
  modal.innerHTML=`
    <div style="font-size:.88rem;color:var(--text);margin-bottom:4px">💍 Wedding Date</div>
    <div style="font-size:.78rem;color:var(--muted);margin-bottom:16px;line-height:1.5">
      When did <strong>${nodeName}</strong> and <strong>${spouseName}</strong> get married?
    </div>
    <div style="display:flex;gap:6px;margin-bottom:16px">
      <select id="wd-month" style="flex:1.2;padding:8px;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:'Outfit',sans-serif;font-size:.82rem">
        <option value="">Month</option>
        <option value="1">January</option><option value="2">February</option><option value="3">March</option>
        <option value="4">April</option><option value="5">May</option><option value="6">June</option>
        <option value="7">July</option><option value="8">August</option><option value="9">September</option>
        <option value="10">October</option><option value="11">November</option><option value="12">December</option>
      </select>
      <input id="wd-day" type="number" min="1" max="31" placeholder="Day" style="flex:.7;padding:8px;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:'Outfit',sans-serif;font-size:.82rem"/>
      <input id="wd-year" type="number" min="1900" max="2100" placeholder="Year" style="flex:.8;padding:8px;background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:'Outfit',sans-serif;font-size:.82rem"/>
    </div>
    <div style="display:flex;gap:6px">
      <button onclick="saveWeddingDate('${nodeId}')" style="flex:1;padding:8px;background:var(--gold);border:none;border-radius:100px;color:#04070c;font-family:'Outfit',sans-serif;font-size:.82rem;font-weight:600;cursor:pointer">Save</button>
      <button onclick="closeLinkModal()" style="flex:1;padding:8px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:100px;color:var(--muted);font-family:'Outfit',sans-serif;font-size:.82rem;cursor:pointer">Skip</button>
    </div>
  `;
  document.getElementById('link-bg').classList.add('open');
}

function saveWeddingDate(nodeId){
  const p=peopleById[nodeId]; if(!p) return;
  const month=document.getElementById('wd-month').value;
  const day=document.getElementById('wd-day').value;
  const year=document.getElementById('wd-year').value;
  if(!month&&!day&&!year){closeLinkModal();return}
  p.weddingDate={month,day,year};
  // Also set on spouse for easy access
  const spouse=p.spouseOf?peopleById[p.spouseOf]:people.find(x=>x.spouseOf===p.id);
  if(spouse) spouse.weddingDate={month,day,year};
  closeLinkModal();
  scheduleSave();
  if(selectedNodeId) selectNode(selectedNodeId); // refresh card
}
