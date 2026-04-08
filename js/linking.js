/* ═══ linking.js ═══ Tree linking, TWYG codes, sharing tiers, shared nodes, auto-adopt ═══ */

// ─── TREE LINKING (Phase 3) ──────────────────────────────────────────────────

function closeLinkModal(){ document.getElementById('link-bg').classList.remove('open'); }

function openLinkCard(){
  const modal=document.getElementById('link-modal-content');
  modal.innerHTML=`
    <div style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:600;color:var(--text);margin-bottom:4px">Linked Trees</div>
    <div style="font-size:.78rem;color:var(--muted);margin-bottom:18px;line-height:1.5">Connect your tree with other Twygie users through shared family members.</div>
    <div style="font-size:.72rem;color:var(--muted);margin-bottom:6px">Enter a link code</div>
    <div class="link-input-row">
      <input class="link-input" id="link-code-input" placeholder="TWYG-XXXX-XXXX" maxlength="14"/>
      <button class="link-accept" onclick="acceptLinkCode()">Link</button>
    </div>
    <label style="display:flex;align-items:center;gap:6px;margin-top:8px;cursor:pointer">
      <input type="checkbox" id="link-auto-adopt" style="accent-color:var(--gold);width:14px;height:14px"/>
      <span style="font-size:.7rem;color:var(--muted)">Auto-adopt unique nodes from their tree</span>
    </label>
    <div id="link-accept-msg" style="font-size:.72rem;margin-top:6px;min-height:16px"></div>
    <div style="height:14px"></div>
    <div style="font-size:.72rem;color:var(--muted);margin-bottom:6px">Active links</div>
    <div id="linked-trees-list"><div style="font-size:.72rem;color:var(--muted);opacity:.5;padding:8px 0">Loading…</div></div>
    <div style="height:14px"></div>
    <button onclick="closeLinkModal()" style="width:100%;padding:8px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:100px;color:var(--muted);font-family:'Outfit',sans-serif;font-size:.76rem;cursor:pointer">Close</button>
  `;
  document.getElementById('link-bg').classList.add('open');
  loadLinkedTrees();
}

// Generate a SHA-256 hash of name+DOB for bridge node matching
async function hashNode(p){
  const birthYear=p.dob?.year||p.birth||'';
  const raw=`${fullName(p).toLowerCase().trim()}|${birthYear}`;
  const enc=new TextEncoder();
  const buf=await crypto.subtle.digest('SHA-256',enc.encode(raw));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// Generate a random link code: TWYG-XXXX-XXXX
function makeLinkCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I,O,0,1 to avoid confusion
  const seg=()=>Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
  return `TWYG-${seg()}-${seg()}`;
}

// Generate link code for a node and save invite to Firestore
async function generateLinkCode(nodeId){
  const p=peopleById[nodeId]; if(!p) return;
  const nm=fullName(p);
  const code=makeLinkCode();
  const nodeHash=await hashNode(p);

  // Show modal with loading
  const modal=document.getElementById('link-modal-content');
  modal.innerHTML=`<div style="color:var(--muted);padding:20px">Generating link code…</div>`;
  document.getElementById('link-bg').classList.add('open');

  try{
    // Save invite to Firestore
    const expiresAt=new Date();
    expiresAt.setDate(expiresAt.getDate()+7); // 7 day expiry
    await db.collection('linkInvites').doc(code).set({
      createdBy:currentUser.uid,
      creatorName:currentUser.displayName||currentUser.email||'',
      bridgeNodeHash:nodeHash,
      bridgeNodeName:nm,
      bridgeNodeId:nodeId,
      expiresAt:firebase.firestore.Timestamp.fromDate(expiresAt),
      usedBy:null,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });

    // Show code
    modal.innerHTML=`
      <div style="font-size:.82rem;color:var(--muted);margin-bottom:4px">Link code for</div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:1.2rem;font-weight:600;color:var(--text)">${nm}</div>
      <div class="link-code">${code}</div>
      <div style="font-size:.75rem;color:var(--muted);margin-bottom:12px;line-height:1.5">
        Share this code with another Twygie user who has<br><strong>${nm}</strong> in their tree to link your trees.
      </div>
      <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(110,203,138,.06);border:1px solid rgba(110,203,138,.15);border-radius:8px;cursor:pointer;margin-bottom:14px">
        <input type="checkbox" id="link-share-all" style="accent-color:var(--gold);width:16px;height:16px"/>
        <div>
          <div style="font-size:.78rem;color:var(--text)">Share All</div>
          <div style="font-size:.65rem;color:var(--muted)">Share your entire tree when linked</div>
        </div>
      </label>
      <button class="link-copy" onclick="copyLinkCode('${code}')">Copy Code</button>
      <div class="link-expires">Expires in 7 days</div>
      <div style="height:14px"></div>
      <button onclick="closeLinkModal()" style="padding:6px 16px;background:transparent;border:1px solid var(--border);border-radius:100px;color:var(--muted);font-family:'Outfit',sans-serif;font-size:.76rem;cursor:pointer">Close</button>
    `;
    // Listen for Share All checkbox — update invite
    document.getElementById('link-share-all').addEventListener('change',async function(){
      try{
        await db.collection('linkInvites').doc(code).update({autoShareAll:this.checked});
      }catch(e){console.warn('Failed to update invite share flag:',e)}
    });
  }catch(e){
    console.error('Failed to create link invite:',e);
    modal.innerHTML=`
      <div style="color:rgba(200,100,100,.8);padding:20px">Failed to generate code. Please try again.</div>
      <button onclick="closeLinkModal()" style="padding:6px 16px;background:transparent;border:1px solid var(--border);border-radius:100px;color:var(--muted);font-family:'Outfit',sans-serif;font-size:.76rem;cursor:pointer;margin-top:10px">Close</button>
    `;
  }
}

function copyLinkCode(code){
  navigator.clipboard.writeText(code).then(()=>{
    const btn=document.querySelector('.link-copy');
    if(btn){btn.textContent='Copied!';setTimeout(()=>{btn.textContent='Copy Code'},2000)}
  }).catch(()=>{});
}

// Accept a link code — match against own nodes and create treeLink
async function acceptLinkCode(){
  const input=document.getElementById('link-code-input');
  const msg=document.getElementById('link-accept-msg');
  const code=(input.value||'').trim().toUpperCase();
  if(!code||code.length<10){msg.style.color='rgba(200,100,100,.8)';msg.textContent='Enter a valid link code.';return}

  msg.style.color='var(--muted)';msg.textContent='Looking up code…';

  try{
    // Fetch the invite
    const inviteSnap=await db.collection('linkInvites').doc(code).get();
    if(!inviteSnap.exists){msg.style.color='rgba(200,100,100,.8)';msg.textContent='Code not found. Check the code and try again.';return}
    const invite=inviteSnap.data();

    // Check if expired
    if(invite.expiresAt&&invite.expiresAt.toDate()<new Date()){msg.style.color='rgba(200,100,100,.8)';msg.textContent='This code has expired.';return}
    // Check if already used
    if(invite.usedBy){msg.style.color='rgba(200,100,100,.8)';msg.textContent='This code has already been used.';return}
    // Can't link to yourself
    if(invite.createdBy===currentUser.uid){msg.style.color='rgba(200,100,100,.8)';msg.textContent='You cannot link to your own tree.';return}

    // Find matching node in our tree
    msg.textContent='Searching for matching Twyg…';
    let matchedNode=null;
    for(const p of people){
      const h=await hashNode(p);
      if(h===invite.bridgeNodeHash){matchedNode=p;break}
    }

    if(!matchedNode){
      msg.style.color='rgba(200,100,100,.8)';
      msg.textContent=`No matching Twyg found for "${invite.bridgeNodeName}". You need this person in your tree to link.`;
      return;
    }

    // Create the tree link
    msg.textContent='Creating link…';
    const autoAdoptCheck=document.getElementById('link-auto-adopt');
    const wantsAutoAdopt=autoAdoptCheck&&autoAdoptCheck.checked;
    const linkId=`${invite.createdBy}_${currentUser.uid}_${Date.now()}`;
    await db.collection('treeLinks').doc(linkId).set({
      userA:invite.createdBy,
      userAName:invite.creatorName,
      userB:currentUser.uid,
      userBName:currentUser.displayName||currentUser.email||'',
      bridgeNodeHash:invite.bridgeNodeHash,
      bridgeNodeName:invite.bridgeNodeName,
      bridgeNodeIdA:invite.bridgeNodeId,
      bridgeNodeIdB:matchedNode.id,
      shareLevel:{[invite.createdBy]:'bridge',[currentUser.uid]:'bridge'},
      sharedNodes:{[invite.createdBy]:[],[currentUser.uid]:[]},
      autoAdopt:{[currentUser.uid]:wantsAutoAdopt},
      status:'active',
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });

    // Mark invite as used
    await db.collection('linkInvites').doc(code).update({usedBy:currentUser.uid});

    // If creator opted for Share All, enable it on their side
    if(invite.autoShareAll){
      try{
        const sharedKey=await deriveSharedKey(invite.createdBy, currentUser.uid);
        // We can't encrypt THEIR data (we don't have it), but the flag is set
        // Their side will detect the link via onSnapshot and see autoShareAll
        await db.collection('treeLinks').doc(linkId).update({
          [`shareLevel.${invite.createdBy}`]:'all'
        });
      }catch(e){console.warn('Could not auto-enable share all for creator:',e)}
    }

    msg.style.color='rgba(110,203,138,.8)';
    input.value='';
    await loadActiveLinks();
    await loadSharedNodes();

    // Auto-adopt unique nodes if checkbox is checked
    const autoAdopt=document.getElementById('link-auto-adopt');
    if(autoAdopt&&autoAdopt.checked&&sharedNodes.length){
      const count=adoptBatch([...sharedNodes]);
      msg.textContent=count?`Linked! ${count} unique node${count>1?'s':''} adopted to your tree.`:`Linked! "${invite.bridgeNodeName}" now bridges your trees.`;
    } else {
      msg.textContent=`Linked! "${invite.bridgeNodeName}" now bridges your trees.`;
    }

    render();
    loadLinkedTrees();
  }catch(e){
    console.error('Failed to accept link:',e);
    msg.style.color='rgba(200,100,100,.8)';
    msg.textContent='Something went wrong. Please try again.';
  }
}

// Load active linked trees for Settings display
async function loadLinkedTrees(){
  const list=document.getElementById('linked-trees-list');
  if(!list||!currentUser) return;

  try{
    // Query links where current user is either userA or userB
    const [snapA,snapB]=await Promise.all([
      db.collection('treeLinks').where('userA','==',currentUser.uid).where('status','==','active').get(),
      db.collection('treeLinks').where('userB','==',currentUser.uid).where('status','==','active').get()
    ]);

    const links=[];
    snapA.forEach(doc=>links.push({id:doc.id,...doc.data()}));
    snapB.forEach(doc=>links.push({id:doc.id,...doc.data()}));

    if(!links.length){
      list.innerHTML='<div style="font-size:.72rem;color:var(--muted);opacity:.5;padding:8px 0">No linked trees yet</div>';
      return;
    }

    list.innerHTML=links.map(link=>{
      const otherName=link.userA===currentUser.uid?link.userBName:link.userAName;
      const created=link.createdAt?.toDate?.();
      const dateStr=created?created.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'';
      const myShareLevel=link.shareLevel?.[currentUser.uid]||'bridge';
      const otherShareLevel=link.shareLevel?.[link.userA===currentUser.uid?link.userB:link.userA]||'bridge';
      const isSharingAll=myShareLevel==='all';
      const otherSharingAll=otherShareLevel==='all';
      return `<div class="link-item" style="flex-direction:column;align-items:stretch;gap:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:30px;height:30px;border-radius:50%;background:rgba(200,168,75,.15);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </div>
          <div class="link-item-info">
            <div class="link-item-name">${otherName||'Unknown user'}</div>
            <div class="link-item-node">Bridge: ${link.bridgeNodeName}</div>
            ${dateStr?`<div class="link-item-date">Linked ${dateStr}</div>`:''}
          </div>
          <button class="link-revoke" onclick="revokeLink('${link.id}')">Revoke</button>
        </div>
        <div style="display:flex;gap:6px;align-items:center;padding:6px 0 2px">
          <div style="flex:1;font-size:.68rem">
            <div style="color:var(--muted)">Your sharing:</div>
            <div style="display:flex;gap:4px;margin-top:4px">
              <button onclick="toggleShareLevel('${link.id}','bridge')" style="flex:1;padding:5px 0;border-radius:6px;border:1px solid ${!isSharingAll?'rgba(200,168,75,.4)':'var(--border)'};background:${!isSharingAll?'rgba(200,168,75,.1)':'transparent'};color:${!isSharingAll?'var(--gold)':'var(--muted)'};font-size:.65rem;cursor:pointer;font-family:'Outfit',sans-serif">Bridge Only</button>
              <button onclick="toggleShareLevel('${link.id}','all')" style="flex:1;padding:5px 0;border-radius:6px;border:1px solid ${isSharingAll?'rgba(110,203,138,.4)':'var(--border)'};background:${isSharingAll?'rgba(110,203,138,.1)':'transparent'};color:${isSharingAll?'rgba(110,203,138,.8)':'var(--muted)'};font-size:.65rem;cursor:pointer;font-family:'Outfit',sans-serif">Share All</button>
            </div>
          </div>
          <div style="flex:1;font-size:.68rem">
            <div style="color:var(--muted)">${otherName}'s sharing:</div>
            <div style="margin-top:4px;font-size:.65rem;color:${otherSharingAll?'rgba(110,203,138,.7)':'rgba(255,255,255,.3)'};padding:5px 0">${otherSharingAll?'Sharing all':'Bridge only'}</div>
          </div>
        </div>
      </div>`;
    }).join('');
  }catch(e){
    console.error('Failed to load links:',e);
    list.innerHTML='<div style="font-size:.72rem;color:rgba(200,100,100,.6);padding:8px 0">Failed to load links</div>';
  }
}

async function revokeLink(linkId){
  if(!await appConfirm('Unlink this tree?<br><span style="font-size:.78rem;color:var(--muted)">Shared data will be removed for both sides.</span>','Unlink','Keep Link')) return;
  try{
    await db.collection('treeLinks').doc(linkId).update({status:'revoked'});
    await loadActiveLinks();
    await loadSharedNodes();
    render();
    loadLinkedTrees();
  }catch(e){
    console.error('Failed to revoke:',e);
    appAlert('Failed to revoke link. Please try again.');
  }
}

function openUnlinkModal(){
  if(!activeLinks.length){appAlert('No active links to manage.');return}
  const modal=document.getElementById('link-modal-content');
  let listHtml=activeLinks.map(link=>{
    const otherName=link.userA===currentUser.uid?link.userBName:link.userAName;
    return `<label style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;background:rgba(255,255,255,.03);margin-bottom:6px;cursor:pointer">
      <input type="checkbox" class="unlink-cb" value="${link.id}" style="accent-color:rgba(200,100,100,.7);width:16px;height:16px" checked/>
      <div style="flex:1">
        <div style="font-size:.84rem;color:var(--text)">${otherName||'Unknown'}</div>
        <div style="font-size:.65rem;color:var(--gold)">Bridge: ${link.bridgeNodeName}</div>
      </div>
    </label>`;
  }).join('');

  modal.innerHTML=`
    <div style="font-family:'Cormorant Garamond',serif;font-size:1.2rem;font-weight:600;color:var(--text);margin-bottom:14px">Unlink Trees</div>
    <div style="font-size:.78rem;color:var(--muted);margin-bottom:14px">Select which links to remove:</div>
    ${listHtml}
    <div style="display:flex;gap:6px;margin-top:16px">
      <button onclick="unlinkSelected()" style="flex:1;padding:8px;background:rgba(180,80,80,.15);border:1px solid rgba(180,80,80,.3);border-radius:100px;color:rgba(220,120,120,.9);font-family:'Outfit',sans-serif;font-size:.78rem;cursor:pointer;font-weight:500">Unlink Selected</button>
      <button onclick="unlinkAllLinks()" style="flex:1;padding:8px;background:rgba(180,80,80,.25);border:1px solid rgba(180,80,80,.4);border-radius:100px;color:rgba(220,120,120,.9);font-family:'Outfit',sans-serif;font-size:.78rem;cursor:pointer;font-weight:600">Unlink All</button>
    </div>
    <button onclick="closeLinkModal()" style="width:100%;padding:8px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:100px;color:var(--muted);font-family:'Outfit',sans-serif;font-size:.76rem;cursor:pointer;margin-top:8px">Cancel</button>
  `;
  document.getElementById('link-bg').classList.add('open');
}

async function unlinkSelected(){
  const checked=[...document.querySelectorAll('.unlink-cb:checked')].map(cb=>cb.value);
  if(!checked.length){appAlert('Select at least one link to remove.');return}
  for(const id of checked){
    try{await db.collection('treeLinks').doc(id).update({status:'revoked'})}catch(e){console.warn('Failed to revoke',id,e)}
  }
  closeLinkModal();closeCard();
  await loadActiveLinks();await loadSharedNodes();render();
}

async function unlinkAllLinks(){
  if(!await appConfirm(`Unlink all ${activeLinks.length} linked tree${activeLinks.length>1?'s':''}?<br><span style="font-size:.78rem;color:var(--muted)">All shared data will be removed.</span>`,'Unlink All','Cancel')) return;
  for(const link of activeLinks){
    try{await db.collection('treeLinks').doc(link.id).update({status:'revoked'})}catch(e){console.warn('Failed to revoke',link.id,e)}
  }
  closeLinkModal();closeCard();
  await loadActiveLinks();await loadSharedNodes();render();
}

// Check if a node is a bridge node (linked with another user's tree)
let activeLinks=[];
let linkUnsubA=null, linkUnsubB=null;

function subscribeActiveLinks(){
  if(!currentUser) return;
  // Unsubscribe from any previous listeners
  if(linkUnsubA) linkUnsubA();
  if(linkUnsubB) linkUnsubB();

  const rebuild=()=>{
    // Merge both listener results
    const combined=[...linksA,...linksB];
    // Detect ANY change — IDs, share levels, or shared data presence
    const fingerprint=l=>`${l.id}|${l.shareLevel?.[currentUser.uid]||''}|${Object.keys(l.sharedData||{}).join(',')}`;
    const newJson=JSON.stringify(combined.map(fingerprint).sort());
    const oldJson=JSON.stringify(activeLinks.map(fingerprint).sort());
    activeLinks=combined;
    if(newJson!==oldJson){
      console.log('Tree links updated:',activeLinks.length,'active link(s)');
      autoUploadSharedData().then(()=>loadSharedNodes()).then(()=>render());
    }
  };

  let linksA=[], linksB=[];

  // Real-time listener: links where I'm userA
  linkUnsubA=db.collection('treeLinks')
    .where('userA','==',currentUser.uid).where('status','==','active')
    .onSnapshot(snap=>{
      linksA=[];
      snap.forEach(doc=>linksA.push({id:doc.id,...doc.data()}));
      rebuild();
    },err=>console.warn('Link listener A error:',err));

  // Real-time listener: links where I'm userB
  linkUnsubB=db.collection('treeLinks')
    .where('userB','==',currentUser.uid).where('status','==','active')
    .onSnapshot(snap=>{
      linksB=[];
      snap.forEach(doc=>linksB.push({id:doc.id,...doc.data()}));
      rebuild();
    },err=>console.warn('Link listener B error:',err));
}

// Keep loadActiveLinks as a manual refresh for immediate use after creating/revoking
async function loadActiveLinks(){
  if(!currentUser) return;
  try{
    const [snapA,snapB]=await Promise.all([
      db.collection('treeLinks').where('userA','==',currentUser.uid).where('status','==','active').get(),
      db.collection('treeLinks').where('userB','==',currentUser.uid).where('status','==','active').get()
    ]);
    activeLinks=[];
    snapA.forEach(doc=>activeLinks.push({id:doc.id,...doc.data()}));
    snapB.forEach(doc=>activeLinks.push({id:doc.id,...doc.data()}));
  }catch(e){ console.warn('Failed to load active links:',e); }
}

function getBridgeInfo(nodeId){
  for(const link of activeLinks){
    const myBridgeId=link.userA===currentUser.uid?link.bridgeNodeIdA:link.bridgeNodeIdB;
    if(myBridgeId===nodeId){
      const otherName=link.userA===currentUser.uid?link.userBName:link.userAName;
      return {linkId:link.id, otherUserName:otherName, bridgeName:link.bridgeNodeName};
    }
  }
  return null;
}

// ─── PHASE 3C: SHARING TIERS ────────────────────────────────────────────────

// Derive a shared encryption key from both UIDs (both sides get same key)
async function deriveSharedKey(uidA, uidB){
  const sorted=[uidA,uidB].sort().join('|');
  const enc=new TextEncoder();
  const km=await crypto.subtle.importKey('raw',enc.encode(sorted),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2',salt:enc.encode('twygie-shared-v1'),iterations:100000,hash:'SHA-256'},
    km,{name:'AES-GCM',length:256},false,['encrypt','decrypt']
  );
}

async function encryptShared(key,data){
  const enc=new TextEncoder();
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(data)));
  const combined=new Uint8Array(iv.length+ct.byteLength);
  combined.set(iv);combined.set(new Uint8Array(ct),iv.length);
  let bin='';const chunk=8192;
  for(let i=0;i<combined.length;i+=chunk) bin+=String.fromCharCode.apply(null,combined.subarray(i,i+chunk));
  return btoa(bin);
}

async function decryptShared(key,b64){
  const bin=atob(b64);const raw=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) raw[i]=bin.charCodeAt(i);
  const dec=await crypto.subtle.decrypt({name:'AES-GCM',iv:raw.slice(0,12)},key,raw.slice(12));
  return JSON.parse(new TextDecoder().decode(dec));
}

// Toggle share level for a link
async function toggleShareLevel(linkId, newLevel){
  const link=activeLinks.find(l=>l.id===linkId);
  if(!link){
    console.warn('Link not found:',linkId,'activeLinks:',activeLinks.length);
    appAlert('Link not found. Try closing and reopening the link manager.');
    return;
  }
  console.log('toggleShareLevel:',linkId,newLevel,'userA:',link.userA,'userB:',link.userB,'me:',currentUser.uid);

  try{
    if(newLevel==='all'){
      // Encrypt our people[] with the shared key and store in the link
      const sharedKey=await deriveSharedKey(link.userA, link.userB);
      // Share stripped-down node data (no customLinks internals, no isYou)
      const sharedData=people.map(p=>{
        const spouseId=p.spouseOf||(people.find(x=>x.spouseOf===p.id)||{}).id||null;
        return {
          id:p.id, name:fullName(p),
          firstName:p.firstName||'', lastName:p.lastName||'',
          gender:p.gender||'',
          dob:p.dob||null, dod:p.dod||null,
          birth:p.birth||null, death:p.death||null,
          city:p.city||'', state:p.state||'',
          relLabel:getRelToYou(p.id)||p.relLabel||'',
          parents:p.parents||[], spouseOf:spouseId,
          isYou:p.isYou||false, x:p.x, y:p.y
        };
      });
      const encrypted=await encryptShared(sharedKey, sharedData);
      console.log('Shared data size:',encrypted.length,'chars for',people.length,'nodes');

      await db.collection('treeLinks').doc(linkId).update({
        [`shareLevel.${currentUser.uid}`]:'all',
        [`sharedData.${currentUser.uid}`]:encrypted
      });
    } else {
      // Bridge only — remove shared data
      await db.collection('treeLinks').doc(linkId).update({
        [`shareLevel.${currentUser.uid}`]:'bridge',
        [`sharedData.${currentUser.uid}`]:firebase.firestore.FieldValue.delete()
      });
    }
    await loadActiveLinks();
    await loadSharedNodes();
    render();
    loadLinkedTrees();
  }catch(e){
    console.error('Failed to toggle share level:',e.code,e.message,e);
    appAlert(`Failed to update sharing.<br><span style="font-size:.72rem;color:var(--muted)">${e.message||e}</span>`);
  }
}

// ─── SHARED NODES (received from linked users) ──────────────────────────────
let sharedNodes=[];

// Batch-adopt shared nodes in parent→child order
function adoptBatch(nodes){
  if(!nodes.length) return 0;
  let adopted=0;
  const sorted=[...nodes];
  sorted.sort((a,b)=>{
    const aLocal=(a.parents||[]).every(pid=>peopleById[pid]);
    const bLocal=(b.parents||[]).every(pid=>peopleById[pid]);
    if(aLocal&&!bLocal) return -1;
    if(!aLocal&&bLocal) return 1;
    return 0;
  });
  const remaining=new Set(sorted.map(n=>n.id));
  for(let pass=0;pass<5&&remaining.size;pass++){
    for(const sn of sorted){
      if(!remaining.has(sn.id)) continue;
      const newId='n'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
      const oldId=sn.id;
      const node={id:newId,name:sn.name||'',firstName:sn.firstName||'',lastName:sn.lastName||'',
        gender:sn.gender||'',photo:sn.photo||null,dob:sn.dob||null,dod:sn.dod||null,
        birth:sn.birth||null,death:sn.death||null,city:sn.city||'',state:sn.state||'',
        note:sn.note||'',relLabel:sn.relLabel||'',parents:[],spouseOf:null,
        customLinks:{},isYou:false,_adopted:true,
        x:sn.x||Math.random()*400+200,y:sn.y||Math.random()*400+200};
      const parentIds=(sn.parents||[]).filter(pid=>peopleById[pid]);
      node.parents=parentIds;
      if(sn.spouseOf&&peopleById[sn.spouseOf]) node.spouseOf=sn.spouseOf;
      people.push(node);peopleById[newId]=node;
      sharedNodes.forEach(n=>{n.parents=(n.parents||[]).map(pid=>pid===oldId?newId:pid);if(n.spouseOf===oldId)n.spouseOf=newId});
      sorted.forEach(n=>{if(n.id!==oldId){n.parents=(n.parents||[]).map(pid=>pid===oldId?newId:pid);if(n.spouseOf===oldId)n.spouseOf=newId}});
      people.forEach(n=>{if(n.id===newId)return;n.parents=(n.parents||[]).map(pid=>pid===oldId?newId:pid);if(n.spouseOf===oldId)n.spouseOf=newId});
      remaining.delete(oldId);
      sharedNodes=sharedNodes.filter(n=>n.id!==oldId);
      adopted++;
    }
  }
  if(adopted){rebuild();recalcAllRelationships(true);scheduleSave();}
  return adopted;
}

// Auto-upload shared data if our shareLevel is 'all' but data isn't uploaded yet
async function autoUploadSharedData(){
  if(!currentUser||!people.length) return;
  for(const link of activeLinks){
    const myLevel=link.shareLevel?.[currentUser.uid];
    const myData=link.sharedData?.[currentUser.uid];
    if(myLevel==='all'&&!myData){
      try{
        console.log('Auto-uploading shared data for link',link.id);
        const sharedKey=await deriveSharedKey(link.userA, link.userB);
        const sharedData=people.map(p=>{
          const spouseId=p.spouseOf||(people.find(x=>x.spouseOf===p.id)||{}).id||null;
          return {
            id:p.id, name:fullName(p),
            firstName:p.firstName||'', lastName:p.lastName||'',
            gender:p.gender||'',
            dob:p.dob||null, dod:p.dod||null,
            birth:p.birth||null, death:p.death||null,
            city:p.city||'', state:p.state||'',
            relLabel:getRelToYou(p.id)||p.relLabel||'',
            parents:p.parents||[], spouseOf:spouseId,
            isYou:p.isYou||false, x:p.x, y:p.y
          };
        });
        const encrypted=await encryptShared(sharedKey, sharedData);
        console.log('Auto-upload shared data size:',encrypted.length,'chars for',people.length,'nodes');
        await db.collection('treeLinks').doc(link.id).update({
          [`sharedData.${currentUser.uid}`]:encrypted
        });
      }catch(e){console.warn('Auto-upload failed for link',link.id,e)}
    }
  }
}

// Adopt a shared node — copy it into the local tree as a regular node
function adoptSharedNode(sharedId){
  const sn=sharedNodes.find(n=>n.id===sharedId);
  if(!sn){closeLinkModal();return}

  // Generate a new local ID
  const newId='n'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
  const oldId=sn.id;

  // Find bridge node for positioning
  const link=activeLinks.find(l=>l.id===sn._linkId);
  const myBridgeId=link?(link.userA===currentUser.uid?link.bridgeNodeIdA:link.bridgeNodeIdB):null;
  const bridge=myBridgeId?peopleById[myBridgeId]:null;

  // Build the adopted node
  const adopted={
    id:newId,
    name:sn.name||'', firstName:sn.firstName||'', lastName:sn.lastName||'',
    gender:sn.gender||'', photo:sn.photo||null,
    dob:sn.dob||null, dod:sn.dod||null,
    birth:sn.birth||null, death:sn.death||null,
    city:sn.city||'', state:sn.state||'',
    note:sn.note||'', relLabel:sn.relLabel||'',
    parents:[], spouseOf:null,
    customLinks:{}, isYou:false, _adopted:true,
    x:bridge?(bridge.x+Math.random()*200-100):(Math.random()*400+200),
    y:bridge?(bridge.y+Math.random()*200+50):(Math.random()*400+200)
  };

  // Remap parents — keep references to local nodes
  (sn.parents||[]).forEach(pid=>{
    if(peopleById[pid]) adopted.parents.push(pid);
  });

  // Remap spouse — keep if local node exists
  if(sn.spouseOf&&peopleById[sn.spouseOf]) adopted.spouseOf=sn.spouseOf;

  // Add to tree
  people.push(adopted);
  peopleById[newId]=adopted;

  // Remap references: update remaining shared nodes AND local nodes
  // that pointed to the old shared ID → now point to new local ID
  sharedNodes.forEach(n=>{
    n.parents=(n.parents||[]).map(pid=>pid===oldId?newId:pid);
    if(n.spouseOf===oldId) n.spouseOf=newId;
  });
  people.forEach(n=>{
    if(n.id===newId) return;
    n.parents=(n.parents||[]).map(pid=>pid===oldId?newId:pid);
    if(n.spouseOf===oldId) n.spouseOf=newId;
  });

  // Remove from shared nodes
  sharedNodes=sharedNodes.filter(n=>n.id!==sharedId);

  closeLinkModal();
  rebuild();
  scheduleSave();
  render();
} // [{...node, _sharedBy, _sharedByName, _linkId}]

async function loadSharedNodes(){
  sharedNodes=[];
  if(!currentUser||!activeLinks.length) return;

  // Build local node fingerprints for deduplication
  // Match on firstName+year, fullName+year, AND name-only (for missing years)
  const fpToLocalId={};
  const nameOnlyToLocalId={};
  people.forEach(p=>{
    const fn=(p.firstName||fullName(p).split(' ')[0]||'').toLowerCase().trim();
    const full=fullName(p).toLowerCase().trim();
    const by=p.dob?.year||p.birth||'';
    if(fn&&by) fpToLocalId[`${fn}|${by}`]=p.id;
    if(full&&by) fpToLocalId[`${full}|${by}`]=p.id;
    // Also store name-only for cases where one side has no year
    if(fn) nameOnlyToLocalId[fn]=p.id;
    if(full&&full!==fn) nameOnlyToLocalId[full]=p.id;
  });

  for(const link of activeLinks){
    const otherUid=link.userA===currentUser.uid?link.userB:link.userA;
    const otherName=link.userA===currentUser.uid?link.userBName:link.userAName;
    const otherShareLevel=link.shareLevel?.[otherUid];
    const otherData=link.sharedData?.[otherUid];

    if(otherShareLevel==='all'&&otherData){
      try{
        const sharedKey=await deriveSharedKey(link.userA, link.userB);
        const nodes=await decryptShared(sharedKey, otherData);
        const myBridgeId=link.userA===currentUser.uid?link.bridgeNodeIdA:link.bridgeNodeIdB;
        const otherBridgeId=link.userA===currentUser.uid?link.bridgeNodeIdB:link.bridgeNodeIdA;

        // First pass: build a map of other-node-ID → local-node-ID for duplicates
        const otherToLocal={};
        otherToLocal[otherBridgeId]=myBridgeId; // bridge always maps
        nodes.forEach(n=>{
          const nFull=(n.name||[n.firstName,n.lastName].filter(Boolean).join(' ')||'').toLowerCase().trim();
          const nFirst=(n.firstName||nFull.split(' ')[0]||'').toLowerCase().trim();
          const nBy=n.dob?.year||n.birth||'';
          // Check if this node has a local duplicate (by name+year or name-only)
          const localId=fpToLocalId[`${nFirst}|${nBy}`]||fpToLocalId[`${nFull}|${nBy}`]
            ||(nBy?null:nameOnlyToLocalId[nFirst]||nameOnlyToLocalId[nFull]) // fallback: name-only if no year
            ||(nFirst?nameOnlyToLocalId[nFirst]:null); // aggressive: match first name alone
          if(localId) otherToLocal[n.id]=localId;
        });

        // Helper: remap an ID — use local node if duplicate, otherwise prefix as shared
        const remap=id=>otherToLocal[id]||`shared_${link.id}_${id}`;

        // Second pass: add non-duplicate nodes with remapped IDs
        nodes.forEach(n=>{
          if(otherToLocal[n.id]) return; // skip duplicates (including bridge)
          n._origId=n.id;
          n.id=`shared_${link.id}_${n.id}`;
          n._sharedBy=otherUid;
          n._sharedByName=otherName;
          n._linkId=link.id;
          n._readOnly=true;
          // Remap parent/spouse IDs to local equivalents where possible
          n.parents=(n.parents||[]).map(pid=>remap(pid));
          if(n.spouseOf) n.spouseOf=remap(n.spouseOf);
          sharedNodes.push(n);
        });
      }catch(e){console.warn('Failed to decrypt shared nodes from',otherName,e)}
    }
  }

  // Auto-adopt trigger: if preference is set and we have shared nodes, adopt them
  // Only run after initial load is complete (appReady flag)
  if(sharedNodes.length&&currentUser&&window._appReady){
    for(const link of activeLinks){
      if(link.autoAdopt?.[currentUser.uid]){
        const toAdopt=[...sharedNodes.filter(sn=>sn._linkId===link.id)];
        if(toAdopt.length){
          console.log('Auto-adopting',toAdopt.length,'shared nodes from',link.id);
          adoptBatch(toAdopt);
          // Clear flag so it doesn't re-run
          db.collection('treeLinks').doc(link.id).update({[`autoAdopt.${currentUser.uid}`]:false}).catch(()=>{});
        }
      }
    }
  }
}

