/* ═══ kinship.js ═══════════════════════════════════════════════════════════
 * Relationship inference engine — the "kinship algebra" that auto-assigns
 * relationships when new nodes are added to the tree.
 *
 * KEY FUNCTIONS:
 *   inferRelToYou(anchorRel, newRel, gender) — kinship composition table
 *   autoAssignToYou(newNodeId, anchorId, rel) — full auto-assign pipeline
 *   getRelToYou_for(targetId, fromId)        — multi-hop relationship lookup
 *   cleanFalseConnections()                  — validates + removes bad links
 *   cleanFalseParents()                      — removes invalid parent entries
 *   recalcAllRelationships()                 — full tree re-inference
 *
 * READS: people[], peopleById{}, BLOOD_LABELS, DIRECT_PARENT_SET, etc.
 * WRITES: Person.parents[], Person.customLinks{}, Person.spouseOf
 * ═══════════════════════════════════════════════════════════════════════════ */
// ─── AUTO-CONNECTIONS ────────────────────────────────────────────────────────

/**
 * Kinship composition table — infers isYou's relationship to a new node
 * given: how the anchor relates to isYou, and how the new node relates to anchor
 */
function inferRelToYou(anchorRelToYou, newRelToAnchor, gender) {
  const m=gender==='male', f=gender==='female';
  const gendered=(male,female,neutral)=>m?male:f?female:neutral;
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
    if(isSibling(r))    return gendered('Son','Daughter','Child'); // child's sibling = also your child
  }
  // ── Grandchild's relatives ─────────────────────────────────────────────────
  if(isGrandchild(a)){
    if(isSpouse(r))     return gendered('Grandson-in-law','Granddaughter-in-law','Grandchild-in-law');
    if(isChild(r))      return gendered('Great-grandson','Great-granddaughter','Great-grandchild');
    if(isGrandchild(r)) return gendered('Great-great-grandson','Great-great-granddaughter','Great-great-grandchild');
    if(isSibling(r))    return gendered('Grandson','Granddaughter','Grandchild'); // grandchild's sibling = also your grandchild
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
    if(isChild(r))      return gendered('Brother','Sister','Sibling'); // parent's other child = your sibling
    if(isSibling(r))    return gendered('Uncle','Aunt','Aunt/Uncle');
    if(isParent(r))     return gendered('Grandfather','Grandmother','Grandparent');
    if(isSpouse(r))     return gendered('Father','Mother','Parent');
    if(isGrandpar(r))   return gendered('Great-grandfather','Great-grandmother','Great-grandparent');
    if(isNieceNeph(r))  return 'Cousin';
    if(isGrandchild(r)) return gendered('Nephew','Niece','Niece/Nephew'); // parent's grandchild (not through you) = nephew/niece
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
    // Your sibling shares your parents/grandparents/uncles/cousins
    if(isParent(r))     return gendered('Father','Mother','Parent');
    if(isGrandpar(r))   return gendered('Grandfather','Grandmother','Grandparent');
    if(isGreatGP(r))    return gendered('Great-grandfather','Great-grandmother','Great-grandparent');
    if(isUncleAunt(r)){
      const isGreat=r.startsWith('great');
      return isGreat?gendered('Great-uncle','Great-aunt','Great-aunt/Uncle'):gendered('Uncle','Aunt','Aunt/Uncle');
    }
    if(isNieceNeph(r))  return gendered('Nephew','Niece','Niece/Nephew');
    if(isCousin(r)){
      // sibling's cousin = your cousin (same degree + removal)
      if(r==='first cousin') return 'First Cousin';
      if(r==='second cousin') return 'Second Cousin';
      if(r==='third cousin') return 'Third Cousin';
      return r.split(' ').map(w=>w[0].toUpperCase()+w.slice(1)).join(' '); // preserve full label
    }
  }
  // ── Uncle/Aunt's relatives ─────────────────────────────────────────────────
  if(isUncleAunt(a)){
    const isGreat=a.startsWith('great');
    if(isChild(r))      return isGreat?'First Cousin Once Removed':'First Cousin';
    if(isGrandchild(r)) return isGreat?'First Cousin Twice Removed':'First Cousin Once Removed';
    if(isSibling(r))    return isGreat?gendered('Great-grand-uncle','Great-grand-aunt','Great-grand-aunt/Uncle'):gendered('Great-uncle','Great-aunt','Great-aunt/Uncle');
    if(isSpouse(r))     return isGreat?gendered('Great-uncle','Great-aunt','Great-aunt/Uncle'):gendered('Uncle','Aunt','Uncle/Aunt');
    if(isParent(r))     return isGreat?gendered('Great-great-grandfather','Great-great-grandmother','Great-great-grandparent'):gendered('Great-grandfather','Great-grandmother','Great-grandparent');
  }
  // ── Nephew/Niece's relatives ──────────────────────────────────────────────
  if(isNieceNeph(a)){
    if(isChild(r))      return gendered('Grand-nephew','Grand-niece','Grand-niece/Nephew');
    if(isSibling(r))    return gendered('Nephew','Niece','Niece/Nephew'); // nephew's sibling = also your nephew
    if(isSpouse(r))     return gendered('Nephew-in-law','Niece-in-law','Niece/Nephew-in-law');
    if(isParent(r))     return gendered('Brother','Sister','Sibling'); // nephew's parent = your sibling
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
    if(isSibling(r))                       return a.split(' ').map(w=>w[0].toUpperCase()+w.slice(1)).join(' '); // cousin's sibling = same cousin
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
// Constants (DIRECT_PARENT_SET, DIRECT_CHILD_SET, SPOUSE_SET, INVERSE_REL, inverseLabel) moved to constants.js

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
  // Store in legacy customLinks (backward compat)
  fromNode.customLinks[toNode.id]={label:inferred,lineType:ltype};
  toNode.customLinks[fromNode.id]={label:inverseLabel(inferred),lineType:ltype};
  // Store in v2 relationships[]
  addRel(fromNode, toNode, inferred);
  toNode.relLabel=inverseLabel(inferred);
}

// Helper: link two nodes with explicit labels without applyInferredRel routing
function linkNodes(nodeA, nodeB, labelAtoB, labelBtoA){
  if(!nodeA||!nodeB||nodeA.id===nodeB.id) return;
  const alreadyLinked=
    (nodeA.parents||[]).includes(nodeB.id)||(nodeB.parents||[]).includes(nodeA.id)||
    nodeA.spouseOf===nodeB.id||nodeB.spouseOf===nodeA.id;
  if(alreadyLinked) return;
  // Check relationships[] for existing link
  const existingRel=getRel(nodeA, nodeB);
  if(existingRel) return;
  // Write to v2 relationships[]
  addRel(nodeA, nodeB, labelAtoB);
  // Write to legacy customLinks (backward compat)
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
    // Find ALL children of the new parent (includes anchor + siblings from CASCADE B)
    const allChildren=people.filter(x=>(x.parents||[]).includes(newNodeId));
    allChildren.forEach(child=>{
      // → each child's children = new node's grandchildren
      people.filter(gc=>(gc.parents||[]).includes(child.id)).forEach(gc=>{
        const gcLabel=genderedRel('Grandchild',gc.gender);
        const gpLabel=genderedRel('Grandparent',newNode.gender);
        linkNodes(newNode, gc, gcLabel, gpLabel);
        // → grandchild's spouse = new node's grandchild-in-law
        const gcSpId=gc.spouseOf||(people.find(p=>p.spouseOf===gc.id)||{}).id;
        if(gcSpId){
          const gcSp=peopleById[gcSpId];
          if(gcSp){
            linkNodes(newNode, gcSp, genderedRel('Grandchild',gcSp.gender)+'-in-law', genderedRel('Grandparent',newNode.gender)+'-in-law');
          }
        }
      });
      // → each child's spouse = new node's child-in-law
      const chSpId=child.spouseOf||(people.find(p=>p.spouseOf===child.id)||{}).id;
      if(chSpId && chSpId!==newNodeId){
        const chSp=peopleById[chSpId];
        if(chSp){
          linkNodes(newNode, chSp, genderedRel('Child',chSp.gender)+'-in-law', genderedRel('Parent',newNode.gender)+'-in-law');
        }
      }
    });
  }

  if(isSibRel){
    // New node is a SIBLING of anchor
    // Collect ALL siblings of the new node (not just anchor — CASCADE A may have added more)
    const allSibIds=new Set([anchorId]);
    (newNode.relationships||[]).forEach(r=>{ if(SIBLING_LABELS.has(r.label)) allSibIds.add(r.targetId); });
    Object.entries(newNode.customLinks||{}).forEach(([tid,v])=>{
      const l=typeof v==='string'?v:v.label||'';
      if(SIBLING_LABELS.has(l)) allSibIds.add(tid);
    });

    // For EACH sibling: their children = new node's nephews/nieces
    allSibIds.forEach(sibId=>{
      const sib=peopleById[sibId]; if(!sib) return;
      people.filter(x=>(x.parents||[]).includes(sibId)).forEach(child=>{
        // Skip if child is already a sibling of the new node
        if(allSibIds.has(child.id)) return;
        if(getRel(newNode, child)&&SIBLING_LABELS.has(getRel(newNode, child).label)) return;
        const uaLabel=newNode.gender==='male'?'Uncle':newNode.gender==='female'?'Aunt':'Uncle/Aunt';
        const npLabel=child.gender==='male'?'Nephew':child.gender==='female'?'Niece':'Nephew/Niece';
        linkNodes(newNode, child, npLabel, uaLabel);
        // grandchildren = grand-nephews/nieces
        people.filter(gc=>(gc.parents||[]).includes(child.id)).forEach(gc=>{
          const gnpLabel=gc.gender==='male'?'Grand-nephew':gc.gender==='female'?'Grand-niece':'Grand-nephew/niece';
          const guaLabel=newNode.gender==='male'?'Great-uncle':newNode.gender==='female'?'Great-aunt':'Great-uncle/aunt';
          linkNodes(newNode, gc, gnpLabel, guaLabel);
        });
      });
      // sibling's spouse = new node's sibling-in-law
      const sibSpouseId=sib.spouseOf||(people.find(p=>p.spouseOf===sibId)||{}).id;
      if(sibSpouseId && sibSpouseId!==newNodeId){
        const sibSpouse=peopleById[sibSpouseId]; 
        if(sibSpouse){
          const silLabel=genderedRel('Sibling',sibSpouse.gender)+'-in-law';
          const rsilLabel=genderedRel('Sibling',newNode.gender)+'-in-law';
          linkNodes(newNode, sibSpouse, silLabel, rsilLabel);
        }
      }
    });
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

  // ── COMPUTE PASS: use structural resolver to find relationships to all nodes ──
  // Instead of the old two-hop inference chain (anchor→existing→infer), directly
  // compute the relationship between newNode and every other node structurally.
  people.forEach(existing=>{
    if(existing.id===newNodeId||existing.id===anchorId) return;

    // Skip if already linked structurally
    if((existing.parents||[]).includes(newNodeId)||
       (newNode.parents||[]).includes(existing.id)||
       existing.spouseOf===newNodeId||newNode.spouseOf===existing.id) return;

    // Skip if already has a relationship
    const existingRel=getRel(existing, newNode);
    if(existingRel) return;

    // Compute structural relationship
    const rel=computeRelationship(existing.id, newNodeId);
    if(!rel||!rel.label) return;

    applyInferredRel(existing, newNode, rel.label);
  });

  // ── SIBLING PROPAGATION: mirror relevant connections to isYou's siblings ──
  // If newNode is linked to isYou as Uncle/Cousin/Grandparent/etc, isYou's
  // siblings should get the same link. Without this, downstream inferences
  // (e.g. cousin Jon ↔ sister Maddy) fail because getRelToYou_for can't
  // find how the anchor relates to the sibling.
  const youNode=people.find(p=>p.isYou);
  if(youNode){
    // Find isYou's siblings (from parents[] + sibling customLinks)
    const youSibIds=new Set();
    const yp=youNode.parents||[];
    people.forEach(s=>{
      if(s.id===youNode.id||s.isYou) return;
      if((s.parents||[]).some(pid=>yp.includes(pid))) youSibIds.add(s.id);
    });
    Object.entries(youNode.customLinks||{}).forEach(([tid,v])=>{
      const l=typeof v==='string'?v:v.label||'';
      if(['Brother','Sister','Sibling','Half-brother','Half-sister','Stepbrother','Stepsister'].includes(l))
        youSibIds.add(tid);
    });

    // Relationship types that are the SAME for all siblings
    const SIBLING_SHARED=new Set([
      'Uncle','Aunt','Great-uncle','Great-aunt','Great-grand-uncle','Great-grand-aunt',
      'Grandfather','Grandmother','Grandparent',
      'Great-grandfather','Great-grandmother','Great-grandparent',
      'Great-great-grandfather','Great-great-grandmother','Great-great-grandparent',
      'Nephew','Niece','Grand-nephew','Grand-niece',
      'Great-grand-nephew','Great-grand-niece',
      'First Cousin','Second Cousin','Third Cousin',
      'First Cousin Once Removed','First Cousin Twice Removed','First Cousin Thrice Removed',
      'Second Cousin Once Removed','Second Cousin Twice Removed','Second Cousin Thrice Removed',
      'Third Cousin Once Removed','Third Cousin Twice Removed','Third Cousin Thrice Removed',
      'Uncle-in-law','Aunt-in-law','Nephew-in-law','Niece-in-law',
      'Grandfather-in-law','Grandmother-in-law',
    ]);

    // Check newNode's connection to isYou (from isYou's perspective)
    const youRel=getRel(youNode, newNode);
    const youLink=youRel||((youNode.customLinks&&youNode.customLinks[newNodeId])?youNode.customLinks[newNodeId]:null);
    if(youLink){
      const youLabel=youRel?youRel.label:(typeof youLink==='string'?youLink:youLink.label||'');
      if(SIBLING_SHARED.has(youLabel)){
        youSibIds.forEach(sibId=>{
          const sib=peopleById[sibId]; if(!sib) return;
          if(getRel(sib, newNode)) return;
          if((sib.parents||[]).includes(newNodeId)||(newNode.parents||[]).includes(sibId)) return;
          linkNodes(sib, newNode, youLabel, inverseLabel(youLabel));
        });
      }
    }

    // Reverse: check newNode's link to isYou (newNode's perspective)
    const newRel=getRel(newNode, youNode);
    const newLink=newRel||((newNode.customLinks&&newNode.customLinks[youNode.id])?newNode.customLinks[youNode.id]:null);
    if(newLink){
      const newLabel=newRel?newRel.label:(typeof newLink==='string'?newLink:newLink.label||'');
      if(SIBLING_SHARED.has(newLabel)){
        youSibIds.forEach(sibId=>{
          const sib=peopleById[sibId]; if(!sib) return;
          if(getRel(sib, newNode)) return;
          if((sib.parents||[]).includes(newNodeId)||(newNode.parents||[]).includes(sibId)) return;
          linkNodes(sib, newNode, inverseLabel(newLabel), newLabel);
        });
      }
    }
  }

  // Post-processing: fix any in-laws that ended up in parents[]
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
      debug('cleanFalseParents: fixed',fullName(p),'parents from',p.parents.length,'to',validParents.length);
      p.parents=validParents;
    }
  });
}

// Generic getRelToYou from any node's perspective (not just isYou)
// Returns: how TARGET appears to FROM (FROM's perspective)
function getRelToYou_for(targetId, fromId, _depth){
  if((_depth||0)>2) return ''; // recursion guard for spouse bridges
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

  // ── 7. STRUCTURAL RESOLVER: find common ancestor and determine relationship ──
  // This is the core genealogical algorithm: trace parent chains from both nodes
  // upward to find a shared ancestor, then use generation distances to classify.
  {
    const PARENT_CL=new Set(['Father','Mother','Parent','Stepfather','Stepmother']);
    const CHILD_CL=new Set(['Son','Daughter','Child','Stepson','Stepdaughter','Stepchild']);
    const GRANDPARENT_CL=new Set(['Grandfather','Grandmother','Grandparent']);
    const GRANDCHILD_CL=new Set(['Grandson','Granddaughter','Grandchild']);
    const GREAT_GP_CL=new Set(['Great-grandfather','Great-grandmother','Great-grandparent']);
    const GREAT_GC_CL=new Set(['Great-grandson','Great-granddaughter','Great-grandchild']);
    const SIBLING_CL=new Set(['Brother','Sister','Sibling','Half-brother','Half-sister','Stepbrother','Stepsister']);

    // ── PRE-PROCESS: infer missing parent chains from grandparent/sibling links ──
    // Problem: parents[] is often incomplete (grandpa added as Grandfather to isYou,
    // not as Father of Hank). This infers the missing structural links.
    const inferredParents={}; // nodeId → Set of parentIds
    // Step 1: If node has Grandfather customLink to G, and node has parent P → G is P's parent
    people.forEach(node=>{
      Object.entries(node.customLinks||{}).forEach(([tid,v])=>{
        const lbl=typeof v==='string'?v:v.label||'';
        if(GRANDPARENT_CL.has(lbl)){
          (node.parents||[]).forEach(pid=>{
            if(!inferredParents[pid]) inferredParents[pid]=new Set();
            inferredParents[pid].add(tid);
          });
        }
        if(GREAT_GP_CL.has(lbl)){
          (node.parents||[]).forEach(pid=>{
            if(!inferredParents[pid]) inferredParents[pid]=new Set();
            inferredParents[pid].add(tid);
          });
        }
      });
      // Reverse grandchild labels
      people.forEach(p=>{
        const cl=p.customLinks&&p.customLinks[node.id];
        if(cl){
          const lbl=typeof cl==='string'?cl:cl.label||'';
          if(GRANDCHILD_CL.has(lbl)||GREAT_GC_CL.has(lbl)){
            (node.parents||[]).forEach(pid=>{
              if(!inferredParents[pid]) inferredParents[pid]=new Set();
              inferredParents[pid].add(p.id);
            });
          }
        }
      });
    });
    // Step 2: Propagate inferred parents to siblings
    // If Hank has inferred parent grandpa, and Henry is Hank's sibling → Henry also has parent grandpa
    let ipChanged=true;
    while(ipChanged){
      ipChanged=false;
      people.forEach(node=>{
        Object.entries(node.customLinks||{}).forEach(([tid,v])=>{
          const lbl=typeof v==='string'?v:v.label||'';
          if(!SIBLING_CL.has(lbl)) return;
          const nodeP=inferredParents[node.id]||new Set();
          const tidP=inferredParents[tid]||new Set();
          for(const pid of nodeP){
            if(!tidP.has(pid)){ if(!inferredParents[tid]) inferredParents[tid]=new Set(); inferredParents[tid].add(pid); ipChanged=true; }
          }
          for(const pid of tidP){
            if(!nodeP.has(pid)){ if(!inferredParents[node.id]) inferredParents[node.id]=new Set(); inferredParents[node.id].add(pid); ipChanged=true; }
          }
        });
      });
    }

    // Get all parents of a node: parents[] + parent customLinks + inferred
    function getAllParents(nid){
      const node=peopleById[nid]; if(!node) return [];
      const pset=new Set(node.parents||[]);
      Object.entries(node.customLinks||{}).forEach(([tid,v])=>{
        const lbl=typeof v==='string'?v:v.label||'';
        if(PARENT_CL.has(lbl)) pset.add(tid);
      });
      people.forEach(p=>{
        const cl=p.customLinks&&p.customLinks[nid];
        if(cl){
          const lbl=typeof cl==='string'?cl:cl.label||'';
          if(CHILD_CL.has(lbl)) pset.add(p.id);
        }
      });
      if(inferredParents[nid]) inferredParents[nid].forEach(pid=>pset.add(pid));
      return [...pset];
    }

    // BFS upward from both nodes through parents only (no sibling hops — 
    // siblings are handled by inferredParents propagation above)
    const ancFrom={}, ancTarget={};
    let qF=[{id:fromId,gen:0}], qT=[{id:targetId,gen:0}];
    let found=null;
    const MAX_GEN=8;
    for(let step=0;step<MAX_GEN*2&&!found;step++){
      if(qF.length){
        const next=[];
        for(const {id,gen} of qF){
          if(id in ancFrom){ if(ancFrom[id]<=gen) continue; }
          ancFrom[id]=gen;
          if(id in ancTarget){ found={id,genA:gen,genB:ancTarget[id]}; break; }
          if(gen<MAX_GEN) getAllParents(id).forEach(pid=>next.push({id:pid,gen:gen+1}));
        }
        qF=next;
        if(found) break;
      }
      if(qT.length){
        const next=[];
        for(const {id,gen} of qT){
          if(id in ancTarget){ if(ancTarget[id]<=gen) continue; }
          ancTarget[id]=gen;
          if(id in ancFrom){ found={id,genA:ancFrom[id],genB:gen}; break; }
          if(gen<MAX_GEN) getAllParents(id).forEach(pid=>next.push({id:pid,gen:gen+1}));
        }
        qT=next;
      }
    }

    if(found){
      const {genA,genB}=found; // genA = from→ancestor, genB = target→ancestor
      const g=t.gender;

      // Direct line: one IS the ancestor
      if(genA===0){
        if(genB===1) return genderedRel('Child',g);
        if(genB===2) return genderedRel('Grandchild',g);
        if(genB===3) return genderedRel('Great-grandchild',g);
        if(genB===4) return genderedRel('Great-great-grandchild',g);
      }
      if(genB===0){
        if(genA===1) return genderedRel('Parent',g);
        if(genA===2) return genderedRel('Grandparent',g);
        if(genA===3) return genderedRel('Great-grandparent',g);
        if(genA===4) return genderedRel('Great-great-grandparent',g);
      }

      // Same generation
      if(genA===genB){
        if(genA===1) return genderedRel('Sibling',g);
        const cousinDeg=genA-1; // 2→first, 3→second, 4→third
        const labels=['','First','Second','Third'];
        return (labels[cousinDeg]||cousinDeg+'th')+' Cousin';
      }

      // Different generations — uncle/nephew or cousin-removed
      const minGen=Math.min(genA,genB), maxGen=Math.max(genA,genB);
      const diff=maxGen-minGen;

      if(minGen===1){
        // One is child of common ancestor → uncle/nephew relationship
        if(genA<genB){
          // from is closer to ancestor → target is nephew/niece level
          if(diff===1) return genderedRel('Nephew',g)||'Nephew/Niece';
          if(diff===2) return genderedRel('Grand-nephew',g)||'Grand-nephew/niece';
          if(diff===3) return genderedRel('Great-grand-nephew',g)||'Great-grand-nephew/niece';
        } else {
          // target is closer to ancestor → target is uncle/aunt level
          if(diff===1) return g==='male'?'Uncle':g==='female'?'Aunt':'Uncle/Aunt';
          if(diff===2) return g==='male'?'Great-uncle':g==='female'?'Great-aunt':'Great-uncle/aunt';
          if(diff===3) return g==='male'?'Great-grand-uncle':g==='female'?'Great-grand-aunt':'Great-grand-uncle/aunt';
        }
      }

      // Cousin with removal
      const cousinDeg=minGen-1;
      const labels=['','First','Second','Third'];
      const removedLabels=['','Once Removed','Twice Removed','Thrice Removed'];
      return (labels[cousinDeg]||cousinDeg+'th')+' Cousin'+(removedLabels[diff]?' '+removedLabels[diff]:'');
    }

    // ── 8. No common blood ancestor — check for in-law via spouse bridge ──
    // If from's spouse shares a common ancestor with target, it's an in-law relationship
    if(fromSpouseId){
      const sp=peopleById[fromSpouseId];
      if(sp){
        const spouseRel=getRelToYou_for(targetId, fromSpouseId, (_depth||0)+1);
        if(spouseRel && !spouseRel.includes('-in-law')){
          // Spouse's blood relative → in-law to from
          return spouseRel+'-in-law';
        }
      }
    }
    // Reverse: target's spouse is blood-related to from
    const targetSpouseId=t.spouseOf||(people.find(p=>p.spouseOf===targetId)||{}).id;
    if(targetSpouseId && targetSpouseId!==fromId){
      const tsp=peopleById[targetSpouseId];
      if(tsp){
        const tspRel=getRelToYou_for(targetSpouseId, fromId, (_depth||0)+1);
        if(tspRel && !tspRel.includes('-in-law')){
          // Target's spouse is from's blood relative → target is in-law
          // e.g. spouse is "Uncle" → target is "Uncle-in-law"
          return tspRel+'-in-law';
        }
      }
    }
  }

  // ── 9. Fallback: declared relationships[] (v2) ──
  const declaredRel=(from.relationships||[]).find(r=>r.targetId===targetId);
  if(declaredRel) return declaredRel.label;

  // ── 10. Fallback: explicit customLinks (legacy) ──
  if(from.customLinks&&from.customLinks[targetId]){
    const v=from.customLinks[targetId];
    return typeof v==='string'?v:v.label;
  }
  return '';
}

// ── computeRelationship: the single source of truth for any two nodes ──
// Returns {label, category} or null
function computeRelationship(fromId, targetId){
  // getRelToYou_for(targetId, fromId) returns "how TARGET appears to FROM"
  // That's what we want: from FROM's perspective, what is TARGET?
  const label=getRelToYou_for(targetId, fromId);
  if(!label) return null;
  return {label, category:getRelCategory(label)};
}

function recalcAllRelationships(force){
  if(!force&&!autoConnections){ appAlert('Enable auto-assign first.'); return; }

  // Step 1: Run autoAssignToYou for every direct connection
  const seen=new Set();
  people.forEach(p=>{
    (p.parents||[]).forEach(parentId=>{
      const key=p.id+'|'+parentId;
      if(seen.has(key)) return; seen.add(key);
      autoAssignToYou(p.id, parentId, genderedRel('Child',p.gender));
    });
    if(p.spouseOf){
      const key=[p.id,p.spouseOf].sort().join('|');
      if(!seen.has(key)){
        seen.add(key);
        autoAssignToYou(p.id, p.spouseOf, genderedRel('Spouse',p.gender));
      }
    }
  });

  // Step 2: Compute pass — find missing relationships for every node pair
  // Uses the structural resolver (common ancestor) to discover relationships
  // that the cascade missed
  const youNode=people.find(p=>p.isYou);
  if(youNode){
    people.forEach(node=>{
      if(node.isYou) return;
      // Already connected structurally?
      if((youNode.parents||[]).includes(node.id)||(node.parents||[]).includes(youNode.id)) return;
      if(youNode.spouseOf===node.id||node.spouseOf===youNode.id) return;
      // Already has a relationship?
      if(getRel(youNode, node)) return;
      // Try to compute one
      const rel=computeRelationship(youNode.id, node.id);
      if(rel&&rel.label){
        addRel(youNode, node, rel.label, rel.category);
        // Also write legacy customLinks
        if(!youNode.customLinks) youNode.customLinks={};
        if(!node.customLinks) node.customLinks={};
        const ltype=rel.category==='blood'?'blood':'labeled';
        youNode.customLinks[node.id]={label:rel.label,lineType:ltype};
        node.customLinks[youNode.id]={label:inverseLabel(rel.label),lineType:ltype};
      }
    });
  }

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
  // Check parents[] array
  const ap=new Set(a.parents||[]);
  if((b.parents||[]).some(p=>ap.has(p))) return true;

  // Also check via customLinks — parent might be connected through
  // child-type labels (e.g. grandfather has "Son" link to both Hank and Lois)
  // or parent-type labels (e.g. Hank has "Father" link to grandfather)
  const CHILD_LABELS=new Set(['Son','Daughter','Child','Stepson','Stepdaughter','Stepchild']);
  const PARENT_LABELS=new Set(['Father','Mother','Parent','Stepfather','Stepmother']);

  // Build set of all "parents" of node a (from parents[] + customLinks)
  const aParents=new Set(a.parents||[]);
  Object.entries(a.customLinks||{}).forEach(([tid,v])=>{
    const lbl=typeof v==='string'?v:v.label||'';
    if(PARENT_LABELS.has(lbl)) aParents.add(tid);
  });
  // Check if any person has a child-type link to a
  people.forEach(p=>{
    Object.entries(p.customLinks||{}).forEach(([tid,v])=>{
      if(tid===a.id){
        const lbl=typeof v==='string'?v:v.label||'';
        if(CHILD_LABELS.has(lbl)) aParents.add(p.id);
      }
    });
  });

  // Build set of all "parents" of node b
  const bParents=new Set(b.parents||[]);
  Object.entries(b.customLinks||{}).forEach(([tid,v])=>{
    const lbl=typeof v==='string'?v:v.label||'';
    if(PARENT_LABELS.has(lbl)) bParents.add(tid);
  });
  people.forEach(p=>{
    Object.entries(p.customLinks||{}).forEach(([tid,v])=>{
      if(tid===b.id){
        const lbl=typeof v==='string'?v:v.label||'';
        if(CHILD_LABELS.has(lbl)) bParents.add(p.id);
      }
    });
  });

  // Check for any shared parent
  for(const pid of aParents){
    if(bParents.has(pid)) return true;
  }
  return false;
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
        // Sibling customLinks are always intentionally created (submitMember or applyInferredRel).
        // Trust them — the label itself (Brother/Sister/etc) is specific enough.
        // hasSharedParent may fail when parent-child chains use customLinks instead of parents[].
        valid=true;
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
  if(toRemove.length) debug('cleanFalseConnections: removed',toRemove.length,'invalid connection(s)');
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

