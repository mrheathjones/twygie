/* ═══ kinship.js ═══ Relationship inference, auto-connections, structural validation ═══ */

// ─── AUTO-CONNECTIONS ────────────────────────────────────────────────────────

/**
 * Kinship composition table — infers isYou's relationship to a new node
 * given: how the anchor relates to isYou, and how the new node relates to anchor
 */
function inferRelToYou(anchorRelToYou, newRelToAnchor, gender) {
  const m=gender==='male', f=gender==='female';
  const g=(male,female,neutral)=>m?male:f?female:neutral;
  const a=anchorRelToYou.toLowerCase();
  const r=newRelToAnchor.toLowerCase();

  const isSpouse    =s=>['wife','husband','partner','spouse'].includes(s);
  const isParent    =s=>['father','mother','parent','stepfather','stepmother'].includes(s);
  const isChild     =s=>['son','daughter','child','stepson','stepdaughter'].includes(s);
  const isSibling   =s=>['brother','sister','sibling','half-brother','half-sister'].includes(s);
  const isGrandpar  =s=>['grandfather','grandmother','grandparent'].includes(s);
  const isGrandchild=s=>['grandson','granddaughter','grandchild'].includes(s);
  const isGreatGP   =s=>s.startsWith('great-grand')&&(s.includes('father')||s.includes('mother')||s.includes('parent'));
  const isGreatGC   =s=>s.startsWith('great-grand')&&(s.includes('son')||s.includes('daughter')||s.includes('child'));
  const isUncleAunt =s=>['uncle','aunt','great-uncle','great-aunt'].includes(s);
  const isNieceNeph =s=>['nephew','niece','grand-nephew','grand-niece'].includes(s);
  const isCousin    =s=>s.includes('cousin');

  // ── Spouse's relatives ─────────────────────────────────────────────────────
  if(isSpouse(a)){
    if(isParent(r))     return gendered('Father-in-law','Mother-in-law','Parent-in-law');
    if(isSibling(r))    return gendered('Brother-in-law','Sister-in-law','Sibling-in-law');
    if(isGrandpar(r))   return gendered('Grandfather-in-law','Grandmother-in-law','Grandparent-in-law');
    if(isGreatGP(r))    return gendered('Great-grandfather-in-law','Great-grandmother-in-law','Great-grandparent-in-law');
    if(isChild(r))      return gendered('Son','Daughter','Child');         // spouse's child = your child
    if(isGrandchild(r)) return gendered('Grandson','Granddaughter','Grandchild');
    if(isGreatGC(r))    return gendered('Great-grandson','Great-granddaughter','Great-grandchild');
    if(isUncleAunt(r))  return gendered('Uncle-in-law','Aunt-in-law','Relative-in-law');
    if(isNieceNeph(r))  return gendered('Nephew','Niece','Niece/Nephew');
  }
  // ── Child's relatives ──────────────────────────────────────────────────────
  if(isChild(a)){
    if(isSpouse(r))     return gendered('Son-in-law','Daughter-in-law','Child-in-law');
    if(isChild(r))      return gendered('Grandson','Granddaughter','Grandchild');
    if(isGrandchild(r)) return gendered('Great-grandson','Great-granddaughter','Great-grandchild');
    if(isGreatGC(r))    return gendered('Great-great-grandson','Great-great-granddaughter','Great-great-grandchild');
  }
  // ── Grandchild's relatives ─────────────────────────────────────────────────
  if(isGrandchild(a)){
    if(isSpouse(r))     return gendered('Grandson-in-law','Granddaughter-in-law','Grandchild-in-law');
    if(isChild(r))      return gendered('Great-grandson','Great-granddaughter','Great-grandchild');
    if(isGrandchild(r)) return gendered('Great-great-grandson','Great-great-granddaughter','Great-great-grandchild');
  }
  // ── Great-grandchild's relatives ──────────────────────────────────────────
  if(isGreatGC(a)){
    if(isSpouse(r))     return gendered('Great-grandson-in-law','Great-granddaughter-in-law','Great-grandchild-in-law');
    if(isChild(r))      return gendered('Great-great-grandson','Great-great-granddaughter','Great-great-grandchild');
  }
  // ── In-law relatives (both directions — key for multi-gen propagation) ──────
  if(a.includes('-in-law')){
    // Son/Daughter-in-law's child = your Grandchild (they married your child)
    if((a==='son-in-law'||a==='daughter-in-law')&&isChild(r))      return gendered('Grandson','Granddaughter','Grandchild');
    if((a==='son-in-law'||a==='daughter-in-law')&&isGrandchild(r)) return gendered('Great-grandson','Great-granddaughter','Great-grandchild');
    // DIL/SIL's parent has NO standard kinship term (e.g. your DIL's mom ≠ your relative)
    if((a==='son-in-law'||a==='daughter-in-law')&&isParent(r))     return null;
    if((a==='son-in-law'||a==='daughter-in-law')&&isGrandpar(r))   return null;
    if((a==='grandson-in-law'||a==='granddaughter-in-law')&&isChild(r)) return gendered('Great-grandson','Great-granddaughter','Great-grandchild');
    // Father/Mother-in-law's child = spouse's sibling = Brother/Sister-in-law
    if((a==='father-in-law'||a==='mother-in-law')&&isChild(r))      return gendered('Brother-in-law','Sister-in-law','Sibling-in-law');
    // Father/Mother-in-law's grandchild = spouse's sibling's child = Nephew/Niece
    if((a==='father-in-law'||a==='mother-in-law')&&isGrandchild(r)) return gendered('Nephew','Niece','Niece/Nephew');
    // Father/Mother-in-law's parent = Grandfather/Grandmother-in-law
    if((a==='father-in-law'||a==='mother-in-law')&&isParent(r))     return gendered('Grandfather-in-law','Grandmother-in-law','Grandparent-in-law');
    // Father/Mother-in-law's sibling = Uncle/Aunt-in-law
    if((a==='father-in-law'||a==='mother-in-law')&&isSibling(r))    return gendered('Uncle-in-law','Aunt-in-law','Relative-in-law');
    // Father/Mother-in-law's spouse = other Parent-in-law
    if((a==='father-in-law'||a==='mother-in-law')&&isSpouse(r))     return gendered('Father-in-law','Mother-in-law','Parent-in-law');
    // Grandfather/Grandmother-in-law's child = no standard term (FIL if already linked)
    if((a==='grandfather-in-law'||a==='grandmother-in-law')&&isChild(r)) return null;
    // Grandfather/Grandmother-in-law's spouse = other Grandparent-in-law
    if((a==='grandfather-in-law'||a==='grandmother-in-law')&&isSpouse(r)) return gendered('Grandfather-in-law','Grandmother-in-law','Grandparent-in-law');
    // Son/Daughter-in-law's spouse = your own child (already linked) → skip
    if((a==='son-in-law'||a==='daughter-in-law')&&isSpouse(r))      return null;
    // Brother/Sister-in-law's child = Nephew/Niece
    if((a==='brother-in-law'||a==='sister-in-law')&&isChild(r))     return gendered('Nephew','Niece','Niece/Nephew');
    // Brother/Sister-in-law's grandchild = Grand-nephew/niece
    if((a==='brother-in-law'||a==='sister-in-law')&&isGrandchild(r)) return gendered('Grand-nephew','Grand-niece','Grand-niece/Nephew');
    // Brother/Sister-in-law's sibling = another Brother/Sister-in-law (or your spouse, alreadyLinked)
    if((a==='brother-in-law'||a==='sister-in-law')&&isSibling(r))   return gendered('Brother-in-law','Sister-in-law','Sibling-in-law');
    // No standard kinship term for other in-law combinations
    return null;
  }
  // ── Parent's relatives ─────────────────────────────────────────────────────
  if(isParent(a)){
    if(isSibling(r))    return gendered('Uncle','Aunt','Aunt/Uncle');
    if(isParent(r))     return gendered('Grandfather','Grandmother','Grandparent');
    if(isSpouse(r))     return gendered('Father','Mother','Parent');
    if(isGrandpar(r))   return gendered('Great-grandfather','Great-grandmother','Great-grandparent');
    if(isNieceNeph(r))  return 'Cousin';
  }
  // ── Grandparent's relatives ────────────────────────────────────────────────
  if(isGrandpar(a)){
    if(isSibling(r))    return gendered('Great-uncle','Great-aunt','Great-aunt/Uncle');
    if(isParent(r))     return gendered('Great-grandfather','Great-grandmother','Great-grandparent');
    if(isChild(r))      return gendered('Uncle','Aunt','Aunt/Uncle');
    if(isSpouse(r))     return gendered('Grandfather','Grandmother','Grandparent');
    if(isGrandchild(r)) return 'First Cousin';
    if(isGreatGC(r))    return 'First Cousin Once Removed';
  }
  // ── Great-grandparent's relatives ─────────────────────────────────────────
  if(isGreatGP(a)){
    if(isSibling(r))    return gendered('Great-grand-uncle','Great-grand-aunt','Great-grand-aunt/Uncle');
    if(isParent(r))     return gendered('Great-great-grandfather','Great-great-grandmother','Great-great-grandparent');
    if(isChild(r))      return gendered('Great-uncle','Great-aunt','Great-aunt/Uncle');
    if(isSpouse(r))     return gendered('Great-grandfather','Great-grandmother','Great-grandparent');
    if(isGrandchild(r)) return 'First Cousin Once Removed';
    if(isGreatGC(r))    return 'Second Cousin';
  }
  // ── Sibling's relatives ────────────────────────────────────────────────────
  if(isSibling(a)){
    if(isChild(r))      return gendered('Nephew','Niece','Niece/Nephew');
    if(isSpouse(r))     return gendered('Brother-in-law','Sister-in-law','Sibling-in-law');
    if(isGrandchild(r)) return gendered('Grand-nephew','Grand-niece','Grand-niece/Nephew');
  }
  // ── Uncle/Aunt's relatives ─────────────────────────────────────────────────
  if(isUncleAunt(a)){
    const isGreat=a.startsWith('great');
    if(isChild(r))      return isGreat?'First Cousin Once Removed':'First Cousin';
    if(isGrandchild(r)) return isGreat?'First Cousin Twice Removed':'First Cousin Once Removed';
    if(isSibling(r))    return isGreat?gendered('Great-grand-uncle','Great-grand-aunt','Great-grand-aunt/Uncle'):gendered('Great-uncle','Great-aunt','Great-aunt/Uncle');
    if(isSpouse(r))     return isGreat?gendered('Great-uncle','Great-aunt','Great-aunt/Uncle'):gendered('Uncle','Aunt','Uncle/Aunt');
  }
  // ── Nephew/Niece's relatives ──────────────────────────────────────────────
  if(isNieceNeph(a)){
    if(isChild(r))      return gendered('Grand-nephew','Grand-niece','Grand-niece/Nephew');
  }
  // ── Cousin's relatives ────────────────────────────────────────────────────
  if(isCousin(a)){
    if(isChild(r)){
      if(a==='first cousin')               return 'First Cousin Once Removed';
      if(a==='second cousin')              return 'Second Cousin Once Removed';
      if(a==='first cousin once removed')  return 'First Cousin Twice Removed';
      if(a==='second cousin once removed') return 'Second Cousin Twice Removed';
      return a+' Once Removed';
    }
    if(a==='first cousin'&&isParent(r))    return gendered('Uncle','Aunt','Uncle/Aunt');
    if(a==='first cousin'&&isSpouse(r))    return 'Cousin-in-law';
  }
  return null;
}


/**
 * After adding/connecting a node, auto-assign its relationship to isYou
 * anchorId = the node the new node was connected to
 * relToAnchor = the label used (e.g. "Mother")
 * newNodeId = the new/updated node
 */
// Direct parent/child labels that use parents[] (green lines) not customLinks
const DIRECT_PARENT_SET=new Set(['Father','Mother','Stepfather','Stepmother','Parent']);
const DIRECT_CHILD_SET =new Set(['Son','Daughter','Stepson','Stepdaughter','Child']);
const SPOUSE_SET       =new Set(['Husband','Wife','Partner']);

// Inverse relationship labels — so both nodes store from their own perspective
const INVERSE_REL={
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
function inverseLabel(lbl){ return INVERSE_REL[lbl]||lbl; }

function applyInferredRel(fromNode, toNode, inferred){
  // Direct parent-child → parents[] (green line)
  if(DIRECT_CHILD_SET.has(inferred)){
    if(!(toNode.parents||[]).includes(fromNode.id))
      toNode.parents=[...(toNode.parents||[]),fromNode.id];
    toNode.relLabel=inferred;
    return;
  }
  if(DIRECT_PARENT_SET.has(inferred)){
    if(!(fromNode.parents||[]).includes(toNode.id))
      fromNode.parents=[...(fromNode.parents||[]),toNode.id];
    toNode.relLabel=inferred;
    return;
  }
  if(SPOUSE_SET.has(inferred)){
    toNode.spouseOf=fromNode.id;
    toNode.relLabel=inferred;
    return;
  }
  const isSib=['Brother','Sister','Half-brother','Half-sister'].includes(inferred);
  const ltype=isSib?'sibling':BLOOD_LABELS.has(inferred)?'blood':'labeled';
  if(!fromNode.customLinks) fromNode.customLinks={};
  if(!toNode.customLinks) toNode.customLinks={};
  // Store label from each node's OWN perspective using inverse lookup
  fromNode.customLinks[toNode.id]={label:inferred,lineType:ltype};
  toNode.customLinks[fromNode.id]={label:inverseLabel(inferred),lineType:ltype};
  toNode.relLabel=inverseLabel(inferred);
}

// Helper: link two nodes with explicit labels without applyInferredRel routing
function linkNodes(nodeA, nodeB, labelAtoB, labelBtoA){
  if(!nodeA||!nodeB||nodeA.id===nodeB.id) return;
  const alreadyLinked=
    (nodeA.parents||[]).includes(nodeB.id)||(nodeB.parents||[]).includes(nodeA.id)||
    nodeA.spouseOf===nodeB.id||nodeB.spouseOf===nodeA.id||
    (nodeA.customLinks&&nodeA.customLinks[nodeB.id])||
    (nodeB.customLinks&&nodeB.customLinks[nodeA.id]);
  if(alreadyLinked) return;
  const ltypeAB=BLOOD_LABELS.has(labelAtoB)?'blood':'labeled';
  const ltypeBA=BLOOD_LABELS.has(labelBtoA)?'blood':'labeled';
  if(!nodeA.customLinks) nodeA.customLinks={};
  if(!nodeB.customLinks) nodeB.customLinks={};
  nodeA.customLinks[nodeB.id]={label:labelAtoB,lineType:ltypeAB};
  nodeB.customLinks[nodeA.id]={label:labelBtoA,lineType:ltypeBA};
}

function autoAssignToYou(newNodeId, anchorId, relToAnchor){
  if(!autoConnections) return;
  const newNode=people.find(p=>p.id===newNodeId)||peopleById[newNodeId]; if(!newNode) return;
  const anchor=people.find(p=>p.id===anchorId)||peopleById[anchorId]; if(!anchor) return;

  // Sync peopleById so all lookups are current
  peopleById[newNodeId]=newNode; peopleById[anchorId]=anchor;
  people.forEach(p=>{ peopleById[p.id]=p; });

  const m=newNode.gender==='male', f=newNode.gender==='female';
  const gn=(male,female,neutral)=>m?male:f?female:neutral;

  // ── STRUCTURAL CASCADE: explicit rules for common relationships ───────────
  // These cover cases that inference chains miss due to multi-hop paths

  const isDirChild  =DIRECT_CHILD_SET.has(relToAnchor);
  const isDirParent =DIRECT_PARENT_SET.has(relToAnchor);
  const isSpouseRel =SPOUSE_SET.has(relToAnchor);
  const isSibRel    =['Brother','Sister','Half-brother','Half-sister','Sibling'].includes(relToAnchor);

  // Find anchor's spouse
  const anchorSpouseId=anchor.spouseOf||(people.find(p=>p.spouseOf===anchor.id)||{}).id;
  const anchorSpouse=anchorSpouseId?people.find(p=>p.id===anchorSpouseId):null;

  if(isDirChild){
    // New node is a CHILD of anchor
    // → anchor's parents = new node's grandparents
    (anchor.parents||[]).forEach(gpId=>{
      const gp=people.find(p=>p.id===gpId); if(!gp) return;
      const gpLabel=genderedRel('Grandparent',gp.gender);
      const gcLabel=gn('Grandson','Granddaughter','Grandchild');
      linkNodes(gp, newNode, gcLabel, gpLabel);
    });
    // → anchor's spouse is also new node's parent (co-parent)
    // Only use DIRECT spouseOf — don't traverse through children
    const directSpouseId=anchor.spouseOf||null;
    const reverseSpouse=directSpouseId?null:(people.find(p=>p.spouseOf===anchor.id));
    const coParentId=directSpouseId||(reverseSpouse?reverseSpouse.id:null);
    if(coParentId){
      const coParent=people.find(p=>p.id===coParentId);
      if(coParent){
        // Co-parent's parents = new node's grandparents (other side)
        (coParent.parents||[]).forEach(gpId=>{
          const gp=people.find(p=>p.id===gpId); if(!gp) return;
          const gpLabel=genderedRel('Grandparent',gp.gender);
          const gcLabel=gn('Grandson','Granddaughter','Grandchild');
          linkNodes(gp, newNode, gcLabel, gpLabel);
        });
        // Co-parent is also new node's parent
        if(!((newNode.parents||[]).includes(coParentId))){
          newNode.parents=[...(newNode.parents||[]),coParentId];
        }
      }
    }
    // → anchor's siblings = new node's uncles/aunts
    const anchorSibIds=Object.keys(anchor.customLinks||{}).filter(k=>{
      const v=anchor.customLinks[k]; const lt=typeof v==='string'?'labeled':v.lineType;
      return lt==='sibling';
    });
    anchorSibIds.forEach(sibId=>{
      const sib=people.find(p=>p.id===sibId); if(!sib) return;
      const sibLabel=genderedRel('Sibling',sib.gender); // Uncle/Aunt
      const uaLabel=sib.gender==='male'?'Uncle':sib.gender==='female'?'Aunt':'Uncle/Aunt';
      const npLabel=gn('Nephew','Niece','Niece/Nephew');
      linkNodes(sib, newNode, npLabel, uaLabel);
    });
  }

  if(isDirParent){
    // New node is a PARENT of anchor
    // → anchor's children = new node's grandchildren
    people.filter(x=>(x.parents||[]).includes(anchorId)).forEach(gc=>{
      const gcLabel=genderedRel('Grandchild',gc.gender);
      const gpLabel=genderedRel('Grandparent',newNode.gender);
      linkNodes(newNode, gc, gcLabel, gpLabel);
    });
    // → anchor's spouse's children (shared) = new node's grandchildren
    if(anchorSpouse){
      people.filter(x=>(x.parents||[]).includes(anchorSpouseId)).forEach(gc=>{
        const gcLabel=genderedRel('Grandchild',gc.gender);
        const gpLabel=genderedRel('Grandparent',newNode.gender);
        linkNodes(newNode, gc, gcLabel, gpLabel);
      });
      // → anchor's spouse = new node's child-in-law
      const spouseLabel=genderedRel('Spouse',anchorSpouse.gender)+'-in-law';
      const newLabel=genderedRel('Spouse',newNode.gender)+'-in-law';
      linkNodes(newNode, anchorSpouse, genderedRel('Child',anchorSpouse.gender)+'-in-law', genderedRel('Parent',newNode.gender)+'-in-law');
    }
  }

  if(isSpouseRel){
    // New node is a SPOUSE of anchor
    // → anchor's children = new node's children (both parents)
    people.filter(x=>(x.parents||[]).includes(anchorId)).forEach(child=>{
      if(!(child.parents||[]).includes(newNodeId)){
        child.parents=[...(child.parents||[]),newNodeId];
      }
    });
    // → anchor's parents = new node's in-laws
    (anchor.parents||[]).forEach(ilId=>{
      const il=people.find(p=>p.id===ilId); if(!il) return;
      const ilLabel=genderedRel('Parent',il.gender)+'-in-law';
      const rLabel=genderedRel('Child',newNode.gender)+'-in-law';
      linkNodes(newNode, il, ilLabel, rLabel);
    });
  }

  // ── INFERENCE LOOP: for remaining nodes not caught by structural cascade ──
  people.forEach(existing=>{
    if(existing.id===newNodeId||existing.id===anchorId) return;

    const anchorRelToExisting=getRelToYou_for(anchorId, existing.id);
    if(!anchorRelToExisting) return;

    const inferred=inferRelToYou(anchorRelToExisting, relToAnchor, newNode.gender||'');
    if(!inferred) return;

    const alreadyLinked=
      (existing.parents||[]).includes(newNodeId)||
      (newNode.parents||[]).includes(existing.id)||
      existing.spouseOf===newNodeId||newNode.spouseOf===existing.id||
      (existing.customLinks&&existing.customLinks[newNodeId])||
      (newNode.customLinks&&newNode.customLinks[existing.id]);
    if(alreadyLinked) return;

    applyInferredRel(existing, newNode, inferred);
  });

  // Post-processing: remove any connections that can't be traced through real family structure
  cleanFalseConnections();
  cleanFalseParents();
}

// Remove parent-child connections where the "parent" is actually an in-law
function cleanFalseParents(){
  people.forEach(p=>{
    if(!(p.parents||[]).length) return;
    const validParents=p.parents.filter(pid=>{
      const par=peopleById[pid]||people.find(x=>x.id===pid);
      if(!par) return false;
      // Check if this "parent" has an in-law customLink to p (meaning they're NOT a real parent)
      const cl=par.customLinks?.[p.id];
      if(cl){
        const label=typeof cl==='string'?cl:cl.label||'';
        if(label.includes('-in-law')) return false; // Remove: in-laws aren't parents
      }
      const cl2=p.customLinks?.[pid];
      if(cl2){
        const label=typeof cl2==='string'?cl2:cl2.label||'';
        if(label.includes('-in-law')) return false;
      }
      return true;
    });
    if(validParents.length!==p.parents.length){
      console.log('cleanFalseParents: fixed',fullName(p),'parents from',p.parents.length,'to',validParents.length);
      p.parents=validParents;
    }
  });
}

// Generic getRelToYou from any node's perspective (not just isYou)
// Returns: how TARGET appears to FROM (FROM's perspective)
function getRelToYou_for(targetId, fromId){
  const from=people.find(p=>p.id===fromId); if(!from) return '';
  const t=peopleById[targetId]||people.find(p=>p.id===targetId); if(!t) return '';
  if(t.id===from.id) return '';

  // ── 1. Direct structural (always correct) ────────────────────────────────
  if((t.parents||[]).includes(from.id)) return genderedRel('Child',t.gender);    // t is from's child
  if((from.parents||[]).includes(targetId)) return genderedRel('Parent',t.gender); // t is from's parent
  if(t.spouseOf===from.id||from.spouseOf===targetId) return genderedRel('Spouse',t.gender);
  const fromP=new Set(from.parents||[]);
  if(fromP.size&&(t.parents||[]).some(pp=>fromP.has(pp))) return genderedRel('Sibling',t.gender);

  // ── 2. One-hop structural: target is child's spouse (Son/Daughter-in-law) ─
  const fromChildren=people.filter(x=>(x.parents||[]).includes(from.id));
  for(const child of fromChildren){
    if(t.spouseOf===child.id||child.spouseOf===targetId){
      // Use CHILD gender (not Spouse) → "Son-in-law"/"Daughter-in-law" not "Husband-in-law"/"Wife-in-law"
      return genderedRel('Child',t.gender)+'-in-law';
    }
  }

  // ── 3. One-hop: target is from's grandchild (child's child) ─────────────
  for(const child of fromChildren){
    if((t.parents||[]).includes(child.id)) return genderedRel('Grandchild',t.gender);
  }

  // ── 4. One-hop: target is from's grandparent (parent's parent) ───────────
  for(const pid of (from.parents||[])){
    const par=peopleById[pid]||people.find(p=>p.id===pid); if(!par) continue;
    if((par.parents||[]).includes(targetId)) return genderedRel('Grandparent',t.gender);
  }

  // ── 5. One-hop: target is from's spouse's parent (Parent-in-law) ────────
  const fromSpouseId=from.spouseOf||(people.find(p=>p.spouseOf===from.id)||{}).id;
  if(fromSpouseId&&fromSpouseId!==targetId){
    const sp=peopleById[fromSpouseId]||people.find(p=>p.id===fromSpouseId);
    if(sp){
      if((sp.parents||[]).includes(targetId)) return genderedRel('Parent',t.gender)+'-in-law';
      // Spouse's sibling = Sibling-in-law
      const spP=new Set(sp.parents||[]);
      if(spP.size&&(t.parents||[]).some(pp=>spP.has(pp))&&targetId!==fromSpouseId)
        return genderedRel('Sibling',t.gender)+'-in-law';
      // Spouse's child (not shared) = step-child
      if((t.parents||[]).includes(fromSpouseId)&&!(t.parents||[]).includes(from.id))
        return genderedRel('Child',t.gender); // treat as child for auto-assign purposes
      // Spouse's grandchild = grandchild
      const spChildren=people.filter(x=>(x.parents||[]).includes(fromSpouseId));
      for(const sc of spChildren){
        if((t.parents||[]).includes(sc.id)) return genderedRel('Grandchild',t.gender);
      }
    }
  }

  // ── 6. Two-hop: grandchild through spouse (spouse's child's child) ───────
  if(fromSpouseId&&fromSpouseId!==targetId){
    const sp=peopleById[fromSpouseId]||people.find(p=>p.id===fromSpouseId);
    if(sp){
      const spChildren=people.filter(x=>(x.parents||[]).includes(fromSpouseId));
      for(const child of spChildren){
        if((t.parents||[]).includes(child.id)) return genderedRel('Grandchild',t.gender);
        // grandchild's spouse = grandson/daughter-in-law
        if(t.spouseOf===child.id||child.spouseOf===targetId)
          return genderedRel('Spouse',t.gender)+'-in-law';
      }
    }
  }

  // ── 7. Explicit customLinks — from's own stored label for target only ───────
  // (NOT t.customLinks[fromId] — that's target's perspective, which can mislead)
  // (NOT t.relLabel — that's a global label from isYou's perspective, not from's)
  if(from.customLinks&&from.customLinks[targetId]){
    const v=from.customLinks[targetId];
    return typeof v==='string'?v:v.label;
  }
  return '';
}

function recalcAllRelationships(force){
  if(!force&&!autoConnections){ appAlert('Enable auto-assign first.'); return; }
  // Run autoAssignToYou for every node against every other node it's directly connected to
  // Iterate over every direct structural connection in the tree
  const seen=new Set();
  people.forEach(p=>{
    // For each of p's parents: re-run as if p was just added with that parent as anchor
    (p.parents||[]).forEach(parentId=>{
      const key=p.id+'|'+parentId;
      if(seen.has(key)) return; seen.add(key);
      const par=people.find(x=>x.id===parentId); if(!par) return;
      const relLabel=genderedRel('Child',p.gender); // e.g. "Son" from parent's view
      autoAssignToYou(p.id, parentId, relLabel);
    });
    // For spouse: re-run as if spouse was just added
    if(p.spouseOf){
      const spouseKey=[p.id,p.spouseOf].sort().join('|');
      if(!seen.has(spouseKey)){
        seen.add(spouseKey);
        const spLabel=genderedRel('Spouse',p.gender);
        autoAssignToYou(p.id, p.spouseOf, spLabel);
        autoAssignToYou(p.spouseOf, p.id, spLabel);
      }
    }
  });
  // Clean up any false cross-family connections (co-grandparent/in-law artifacts)
  cleanFalseConnections();
  rebuild(); render(); scheduleSave();
  // Flash feedback
  const btn=event.target;
  const orig=btn.textContent;
  btn.textContent='✓ Done!'; btn.style.background='rgba(80,180,80,.15)'; btn.style.borderColor='rgba(80,180,80,.4)';
  setTimeout(()=>{ btn.textContent=orig; btn.style.background=''; btn.style.borderColor=''; },2000);
}

// ─── STRUCTURAL VALIDATION HELPERS ───────────────────────────────────────────

function getSpouseNode(node){
  if(node.spouseOf) return people.find(p=>p.id===node.spouseOf);
  return people.find(p=>p.spouseOf===node.id)||null;
}

// Collect all ancestor IDs through parents[] chains, up to maxGen generations
function collectAncestors(nodeId, maxGen){
  const ancestors=new Set();
  let current=new Set([nodeId]);
  for(let g=0;g<maxGen;g++){
    const next=new Set();
    for(const id of current){
      const node=people.find(p=>p.id===id); if(!node) continue;
      for(const pid of (node.parents||[])){
        if(!ancestors.has(pid)){ ancestors.add(pid); next.add(pid); }
      }
    }
    if(next.size===0) break;
    current=next;
  }
  return ancestors;
}

// Collect all descendant IDs through reverse parents[] lookup, up to maxGen generations
function collectDescendants(nodeId, maxGen){
  const desc=new Set();
  let current=new Set([nodeId]);
  for(let g=0;g<maxGen;g++){
    const next=new Set();
    for(const id of current){
      people.filter(p=>(p.parents||[]).includes(id)).forEach(child=>{
        if(!desc.has(child.id)){ desc.add(child.id); next.add(child.id); }
      });
    }
    if(next.size===0) break;
    current=next;
  }
  return desc;
}

// Check if two nodes share at least one parent
function hasSharedParent(a, b){
  const ap=new Set(a.parents||[]);
  return (b.parents||[]).some(p=>ap.has(p));
}

// Check if two nodes are blood-related: share a common ancestor OR one descends from the other
// Traces through parents[] only (no spouseOf crossings) — up to 6 generations
function hasBloodPath(nodeA, nodeB){
  const ancA=collectAncestors(nodeA.id, 6); ancA.add(nodeA.id);
  const ancB=collectAncestors(nodeB.id, 6); ancB.add(nodeB.id);
  // Common ancestor = blood relation (siblings, cousins, uncle/nephew, etc.)
  for(const id of ancA){ if(ancB.has(id)) return true; }
  // A is ancestor of B or B is ancestor of A (direct line: grandparent/grandchild)
  const descA=collectDescendants(nodeA.id, 6);
  if(descA.has(nodeB.id)) return true;
  const descB=collectDescendants(nodeB.id, 6);
  if(descB.has(nodeA.id)) return true;
  // Uncle/nephew/cousin: A's ancestor's descendant = B (through a sibling branch)
  for(const aId of ancA){
    const d=collectDescendants(aId, 6);
    if(d.has(nodeB.id)) return true;
  }
  return false;
}

// Check if there's a valid in-law structural path between two nodes
// In-law = connected through exactly ONE marriage bridge
// Valid paths: A→spouse→blood→B, A→child/grandchild→marriage→B, or the reverse
function hasInLawPath(nodeA, nodeB){
  // Path 1: A's spouse is blood-related to B
  // Covers: Father/Mother/Grandfather/Brother/Uncle-in-law, Nephew through marriage, etc.
  const spouseA=getSpouseNode(nodeA);
  if(spouseA && hasBloodPath(spouseA, nodeB)) return true;

  // Path 2: B's spouse is blood-related to A (reverse of path 1)
  const spouseB=getSpouseNode(nodeB);
  if(spouseB && hasBloodPath(spouseB, nodeA)) return true;

  // Path 3: A's child/grandchild married B directly → Son/Daughter/Grandson-in-law
  const childrenA=people.filter(x=>(x.parents||[]).includes(nodeA.id));
  for(const c of childrenA){
    if(c.spouseOf===nodeB.id||nodeB.spouseOf===c.id) return true;
    // Grandchild level
    const gcs=people.filter(x=>(x.parents||[]).includes(c.id));
    for(const gc of gcs){
      if(gc.spouseOf===nodeB.id||nodeB.spouseOf===gc.id) return true;
    }
  }

  // Path 4: B's child/grandchild married A directly (reverse of path 3)
  const childrenB=people.filter(x=>(x.parents||[]).includes(nodeB.id));
  for(const c of childrenB){
    if(c.spouseOf===nodeA.id||nodeA.spouseOf===c.id) return true;
    const gcs=people.filter(x=>(x.parents||[]).includes(c.id));
    for(const gc of gcs){
      if(gc.spouseOf===nodeA.id||nodeA.spouseOf===gc.id) return true;
    }
  }

  return false;
}

// ─── CONNECTION CLEANUP ─────────────────────────────────────────────────────
// Remove connections that have no valid structural kinship path
// Validates ALL customLink types — blood, labeled, and sibling
function cleanFalseConnections(){
  const toRemove=[];
  people.forEach(p=>{
    if(!p.customLinks) return;
    Object.keys(p.customLinks).forEach(tid=>{
      // Only process each pair once (lower id processes)
      if(p.id>tid) return;
      const other=people.find(x=>x.id===tid); if(!other) return;
      const v=p.customLinks[tid];
      const label=typeof v==='string'?v:v.label;
      const lt=typeof v==='string'?'labeled':v.lineType;

      let valid=false;

      if(lt==='sibling'){
        // Siblings must share at least one parent
        valid=hasSharedParent(p, other);
      } else if(lt==='blood'||lt==='labeled'){
        // If the label is in BLOOD_LABELS or is an in-law type, trust the auto-assign system
        if(BLOOD_LABELS.has(label)||label.includes('-in-law')) valid=true;
        // Otherwise validate there's a real blood OR in-law path
        else valid=hasBloodPath(p, other)||hasInLawPath(p, other);
      } else {
        // Custom/unknown lineTypes (user-created custom connection types) — always keep
        valid=true;
      }

      if(!valid) toRemove.push({a:p.id, b:tid});
    });
  });
  // Remove invalid connections (deferred to avoid mutating during iteration)
  toRemove.forEach(({a,b})=>{
    const nodeA=people.find(x=>x.id===a);
    const nodeB=people.find(x=>x.id===b);
    if(nodeA&&nodeA.customLinks) delete nodeA.customLinks[b];
    if(nodeB&&nodeB.customLinks) delete nodeB.customLinks[a];
  });
  if(toRemove.length) console.log('cleanFalseConnections: removed',toRemove.length,'invalid connection(s)');
}

function toggleAutoConn(){
  autoConnections=!autoConnections;
  syncAutoConnToggle();
}
function syncAutoConnToggle(){
  const track=document.getElementById('ac-track');
  const thumb=document.getElementById('ac-thumb');
  const opt=document.getElementById('sp-autoconn');
  if(track) track.classList.toggle('toggle-track-on',autoConnections);
  if(thumb) thumb.classList.toggle('on',autoConnections);
  if(opt) opt.classList.toggle('active',autoConnections);
}

function toggleDemoMode(){
  demoMode=!demoMode;
  syncDemoToggle();
}
function syncDemoToggle(){
  const track=document.getElementById('dm-track');
  const thumb=document.getElementById('dm-thumb');
  const opt=document.getElementById('sp-demo');
  if(track) track.classList.toggle('toggle-track-on',demoMode);
  if(thumb) thumb.classList.toggle('on',demoMode);
  if(opt) opt.classList.toggle('active',demoMode);
}

