/* ═══ export.js ═══ Export tree as PNG image or PDF document ═══ */

// ─── EXPORT ──────────────────────────────────────────────────────────────────

function toggleExportMenu(){
  const m=document.getElementById('export-menu');
  m.style.display=m.style.display==='none'?'block':'none';
  if(m.style.display==='block'){
    setTimeout(()=>document.addEventListener('click',closeExportMenu,{once:true}),10);
  }
}
function closeExportMenu(){ document.getElementById('export-menu').style.display='none'; }

async function exportTree(format){
  closeExportMenu();
  if(!people.length){ appAlert('No Twygs to export.'); return; }

  // 1. Calculate bounding box from node positions
  const pad=120;
  const xs=people.map(p=>p.x), ys=people.map(p=>p.y);
  const x0=Math.min(...xs)-pad, y0=Math.min(...ys)-pad;
  const x1=Math.max(...xs)+pad, y1=Math.max(...ys)+pad;
  const w=x1-x0, h=y1-y0;

  // 2. Clone the SVG
  const origSvg=document.getElementById('svg');
  const clone=origSvg.cloneNode(true);

  // 3. Set proper dimensions and viewBox (remove pan/zoom)
  clone.setAttribute('width',w);
  clone.setAttribute('height',h);
  clone.setAttribute('viewBox',`${x0} ${y0} ${w} ${h}`);
  clone.style.width=w+'px';
  clone.style.height=h+'px';

  // 4. Remove the pan/zoom transform from the tg group
  const tg=clone.querySelector('#tg');
  if(tg) tg.style.transform='none';

  // 5. Add dark background rect as first child
  const bg=document.createElementNS('http://www.w3.org/2000/svg','rect');
  bg.setAttribute('x',x0); bg.setAttribute('y',y0);
  bg.setAttribute('width',w); bg.setAttribute('height',h);
  bg.setAttribute('fill','#04070c');
  clone.insertBefore(bg, clone.firstChild);

  // 6. Embed CSS animations and styles inline
  const styleEl=document.createElementNS('http://www.w3.org/2000/svg','style');
  styleEl.textContent=`
    @keyframes glow-amber{0%,100%{opacity:.8}50%{opacity:.35}}
    @keyframes glow-blue{0%,100%{opacity:.65}50%{opacity:.25}}
    @keyframes glow-you{0%,100%{opacity:1}50%{opacity:.55}}
    @keyframes young-sparkle{0%{opacity:.6}15%{opacity:1}30%{opacity:.55}45%{opacity:.95}60%{opacity:.5}100%{opacity:.6}}
    @keyframes young-outer-ring{0%{opacity:.12}25%{opacity:.22}50%{opacity:.1}75%{opacity:.2}100%{opacity:.12}}
    .gp{animation-duration:3.4s;animation-iteration-count:infinite;animation-timing-function:ease-in-out}
    .hi{animation-name:glow-amber}
    .hi-b{animation-name:glow-blue}
    .hi-y{animation-name:glow-you;animation-duration:2.5s}
    .young-spark{animation-name:young-sparkle;animation-duration:1.8s}
    .young-outer{animation-name:young-outer-ring;animation-duration:2.2s;animation-iteration-count:infinite;animation-timing-function:ease-in-out}
    .nd text{font-family:'Outfit',sans-serif;fill:rgba(255,255,255,.85);font-size:13px;text-anchor:middle;pointer-events:none}
  `;
  clone.insertBefore(styleEl, clone.firstChild);

  // 7. Remove interactive attributes (events, cursors)
  clone.querySelectorAll('.nd').forEach(nd=>{
    nd.style.cursor='default';
    nd.removeAttribute('onclick');
    nd.removeAttribute('onmouseenter');
    nd.removeAttribute('onmouseleave');
  });

  // 8. Serialize SVG to data URL
  const serializer=new XMLSerializer();
  const svgStr=serializer.serializeToString(clone);
  const svgBlob=new Blob([svgStr],{type:'image/svg+xml;charset=utf-8'});
  const svgUrl=URL.createObjectURL(svgBlob);

  // 9. Render to canvas
  const dpr=2; // 2x resolution for crisp export
  const canvas=document.createElement('canvas');
  canvas.width=w*dpr; canvas.height=h*dpr;
  const ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);

  const img=new Image();
  img.onload=async ()=>{
    ctx.fillStyle='#04070c';
    ctx.fillRect(0,0,w,h);
    ctx.drawImage(img,0,0,w,h);
    URL.revokeObjectURL(svgUrl);

    if(format==='png'){
      // Download as PNG
      const link=document.createElement('a');
      link.download=`twygie-tree-${new Date().toISOString().slice(0,10)}.png`;
      link.href=canvas.toDataURL('image/png');
      link.click();
    } else if(format==='pdf'){
      // Convert canvas to PDF
      await exportCanvasToPDF(canvas, w, h);
    }
  };
  img.onerror=()=>{
    URL.revokeObjectURL(svgUrl);
    // Fallback: try without data URLs (photos might cause CORS)
    appAlert('Export failed. Try removing photos from nodes and retrying.');
  };
  img.src=svgUrl;
}

async function exportCanvasToPDF(canvas, w, h){
  // Load jsPDF from CDN
  if(!window.jspdf){
    try{
      await new Promise((resolve,reject)=>{
        const s=document.createElement('script');
        s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload=resolve; s.onerror=reject;
        document.head.appendChild(s);
      });
    }catch(e){
      const link=document.createElement('a');
      link.download=`twygie-tree-${new Date().toISOString().slice(0,10)}.png`;
      link.href=canvas.toDataURL('image/png');
      link.click();
      appAlert('PDF export unavailable offline. Saved as PNG instead.');
      return;
    }
  }
  const {jsPDF}=window.jspdf;

  // ── Constants ──
  const pw=612, ph=792; // US Letter in points (8.5 x 11")
  const margin=50, lineH=16, smallH=13;
  const dark='#04070c', cream='#f5f0e8', gold='#c8a84b', muted='#8a8579';
  const dateStr=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});

  const pdf=new jsPDF({unit:'pt',format:'letter',orientation:'portrait'});

  // ── Helper: set font safely ──
  const setFont=(style='normal',size=11)=>{
    pdf.setFontSize(size);
    try{ pdf.setFont('helvetica',style); }catch(e){ pdf.setFont('helvetica','normal'); }
  };

  // ── Gather member data ──
  const you=people.find(p=>p.isYou);
  const userName=you?fullName(you):'My Family';
  const members=people.map(p=>{
    const rel=p.isYou?'You':getRelToYou(p.id);
    const name=fullName(p);
    const dob=dobDisplay(p);
    const place=placeDisplay(p);
    const connections=[];
    // Parents
    (p.parents||[]).forEach(pid=>{
      const par=peopleById[pid]; if(par) connections.push({name:fullName(par),rel:genderedRel('Parent',par.gender)});
    });
    // Children
    people.filter(x=>(x.parents||[]).includes(p.id)).forEach(c=>{
      connections.push({name:fullName(c),rel:genderedRel('Child',c.gender)});
    });
    // Spouse
    const spouseNode=getSpouseNode(p);
    if(spouseNode) connections.push({name:fullName(spouseNode),rel:genderedRel('Spouse',spouseNode.gender)});
    // CustomLinks
    Object.keys(p.customLinks||{}).forEach(tid=>{
      const other=peopleById[tid]; if(!other) return;
      const v=p.customLinks[tid];
      const label=typeof v==='string'?v:v.label;
      connections.push({name:fullName(other),rel:label});
    });
    return {name,rel,dob,place,connections,isYou:!!p.isYou,gender:p.gender||'',
      deceased:!!(p.dod&&(p.dod.month||p.dod.day||p.dod.year)),
      age:calcAge(p),
      dodDisplay:(()=>{
        if(!p.dod||(!(p.dod.month||p.dod.day||p.dod.year))) return '';
        const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const parts=[];
        if(p.dod.month) parts.push(months[parseInt(p.dod.month)-1]);
        if(p.dod.day) parts.push(p.dod.day);
        if(p.dod.year) parts.push(p.dod.year);
        return `d. ${parts.join(' ')}`;
      })(),
      story:(p.note&&!p.note.includes('Tap Edit to add your story'))?p.note:'',
      photo:p.photo||null
    };
  }).sort((a,b)=>{
    // Sort: You first, then by relationship category, then alphabetically
    if(a.isYou) return -1; if(b.isYou) return 1;
    const order=['Husband','Wife','Partner','Father','Mother','Son','Daughter','Brother','Sister',
      'Grandfather','Grandmother','Grandson','Granddaughter'];
    const ai=order.indexOf(a.rel), bi=order.indexOf(b.rel);
    if(ai!==-1&&bi!==-1) return ai-bi;
    if(ai!==-1) return -1; if(bi!==-1) return 1;
    return a.name.localeCompare(b.name);
  });

  // ── Count generations ──
  const genCount=(()=>{
    let maxUp=0, maxDown=0;
    if(!you) return 1;
    const walkUp=(id,d)=>{ const n=peopleById[id]; if(!n) return; if(d>maxUp) maxUp=d; (n.parents||[]).forEach(pid=>walkUp(pid,d+1)); };
    const walkDn=(id,d)=>{ if(d>maxDown) maxDown=d; people.filter(x=>(x.parents||[]).includes(id)).forEach(c=>walkDn(c.id,d+1)); };
    walkUp(you.id,0); walkDn(you.id,0);
    return maxUp+maxDown+1;
  })();

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER SHEET
  // ══════════════════════════════════════════════════════════════════════════════
  pdf.setFillColor(dark);
  pdf.rect(0,0,pw,ph,'F');

  // Twygie logo — render SVG to canvas then embed
  try{
    const logoSize=80;
    const logoSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="${logoSize}" height="${logoSize}" viewBox="0 0 24 24" fill="none" stroke="${gold}" stroke-width="1.5" stroke-linecap="round">
      <path d="M12 22V10"/><path d="M12 10C12 6 8 3.5 4 4.5"/><path d="M12 10C12 6 16 3.5 20 4.5"/>
      <path d="M12 16C12 13 9 11 5 12"/><path d="M12 16C12 13 15 11 19 12"/>
    </svg>`;
    const logoBlob=new Blob([logoSvg],{type:'image/svg+xml;charset=utf-8'});
    const logoUrl=URL.createObjectURL(logoBlob);
    const logoImg=await new Promise((resolve,reject)=>{
      const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=logoUrl;
    });
    const lc=document.createElement('canvas'); lc.width=logoSize*2; lc.height=logoSize*2;
    const lctx=lc.getContext('2d'); lctx.scale(2,2); lctx.drawImage(logoImg,0,0,logoSize,logoSize);
    URL.revokeObjectURL(logoUrl);
    pdf.addImage(lc.toDataURL('image/png'),'PNG',(pw-logoSize)/2,60,logoSize,logoSize);
  }catch(e){ /* logo failed — skip gracefully */ }

  // Decorative gold line
  pdf.setDrawColor(gold);
  pdf.setLineWidth(0.8);
  pdf.line(margin,160,pw-margin,160);
  pdf.line(margin,580,pw-margin,580);

  // Title
  setFont('bold',42);
  pdf.setTextColor(cream);
  pdf.text('Twygie',pw/2,240,{align:'center'});

  // Subtitle
  setFont('normal',16);
  pdf.setTextColor(muted);
  pdf.text('Family Tree',pw/2,275,{align:'center'});

  // User name
  setFont('bold',22);
  pdf.setTextColor(gold);
  pdf.text(`The ${you?.lastName||userName} Family`,pw/2,360,{align:'center'});

  // Stats
  setFont('normal',12);
  pdf.setTextColor(muted);
  pdf.text(`${people.length} Members  ·  ${genCount} Generations`,pw/2,400,{align:'center'});

  // Date
  setFont('normal',11);
  pdf.setTextColor(muted);
  pdf.text(dateStr,pw/2,620,{align:'center'});

  // Footer
  setFont('normal',9);
  pdf.setTextColor(80,80,80);
  pdf.text('Generated by Twygie — twygie.com',pw/2,750,{align:'center'});

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 2 — TABLE OF CONTENTS
  // ══════════════════════════════════════════════════════════════════════════════
  pdf.addPage();
  pdf.setFillColor(dark);
  pdf.rect(0,0,pw,ph,'F');

  setFont('bold',24);
  pdf.setTextColor(cream);
  pdf.text('Table of Contents',margin,80);

  pdf.setDrawColor(gold);
  pdf.setLineWidth(0.5);
  pdf.line(margin,95,pw-margin,95);

  let tocY=140;
  const tocItem=(label, pageNum)=>{
    setFont('normal',13);
    pdf.setTextColor(cream);
    pdf.text(label,margin+10,tocY);
    // Dotted leader line
    setFont('normal',13);
    pdf.setTextColor(muted);
    const labelW=pdf.getTextWidth(label);
    const numW=pdf.getTextWidth(String(pageNum));
    const dotsStart=margin+10+labelW+8;
    const dotsEnd=pw-margin-numW-8;
    let dotX=dotsStart;
    while(dotX<dotsEnd){ pdf.text('·',dotX,tocY); dotX+=6; }
    pdf.setTextColor(gold);
    pdf.text(String(pageNum),pw-margin,tocY,{align:'right'});
    tocY+=28;
  };

  tocItem('Family Tree Visualization',3);
  tocItem('Member Directory',4);

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 3 — TREE VISUALIZATION
  // ══════════════════════════════════════════════════════════════════════════════
  // Fit tree image to page with margins
  const imgW=pw-margin*2, imgH=ph-margin*2-40;
  const treeAspect=w/h;
  const pageAspect=imgW/imgH;
  let drawW, drawH;
  if(treeAspect>pageAspect){ drawW=imgW; drawH=imgW/treeAspect; }
  else { drawH=imgH; drawW=imgH*treeAspect; }
  const drawX=(pw-drawW)/2, drawY=margin+30+(imgH-drawH)/2;

  // Use landscape page if tree is wider than tall
  if(treeAspect>1.3){
    pdf.addPage('letter','landscape');
    pdf.setFillColor(dark);
    pdf.rect(0,0,ph,pw,'F'); // landscape: w=792, h=612
    setFont('bold',14);
    pdf.setTextColor(cream);
    pdf.text('Family Tree',margin,35);
    const lw=ph-margin*2, lh=pw-margin*2-30;
    const la=lw/lh;
    let dW,dH;
    if(treeAspect>la){ dW=lw; dH=lw/treeAspect; } else { dH=lh; dW=lh*treeAspect; }
    const dX=(ph-dW)/2, dY=45+(lh-dH)/2;
    const imgData=canvas.toDataURL('image/png');
    pdf.addImage(imgData,'PNG',dX,dY,dW,dH);
  } else {
    pdf.addPage();
    pdf.setFillColor(dark);
    pdf.rect(0,0,pw,ph,'F');
    setFont('bold',14);
    pdf.setTextColor(cream);
    pdf.text('Family Tree',margin,40);
    const imgData=canvas.toDataURL('image/png');
    pdf.addImage(imgData,'PNG',drawX,drawY,drawW,drawH);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 4+ — MEMBER DIRECTORY
  // ══════════════════════════════════════════════════════════════════════════════
  pdf.addPage();
  pdf.setFillColor(dark);
  pdf.rect(0,0,pw,ph,'F');

  setFont('bold',24);
  pdf.setTextColor(cream);
  pdf.text('Member Directory',margin,80);

  pdf.setDrawColor(gold);
  pdf.setLineWidth(0.5);
  pdf.line(margin,95,pw-margin,95);

  let y=130;
  const maxY=ph-60;

  const newPage=()=>{
    pdf.addPage();
    pdf.setFillColor(dark);
    pdf.rect(0,0,pw,ph,'F');
    y=60;
  };

  members.forEach((m,idx)=>{
    // Estimate height needed for this entry
    const photoH=m.photo?48:0;
    const storyLines=m.story?pdf.splitTextToSize(m.story,pw-margin*2-80):[];
    const entryH=60+photoH+Math.max(0,m.connections.length)*11+storyLines.length*11+10;
    if(y+Math.min(entryH,120)>maxY) newPage();

    // ── Photo + Name block ──
    const textX=m.photo?margin+58:margin+10;

    if(m.photo){
      try{
        // Extract format from data URL
        const photoMatch=m.photo.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/);
        const fmt=photoMatch?(photoMatch[1]==='jpg'?'JPEG':photoMatch[1].toUpperCase()):'JPEG';
        pdf.addImage(m.photo,fmt,margin+10,y-10,40,40);
      }catch(e){
        // Photo failed to embed — draw placeholder circle
        pdf.setFillColor(30,30,30);
        pdf.circle(margin+30,y+10,20,'F');
        setFont('bold',14);
        pdf.setTextColor(muted);
        pdf.text(m.name.charAt(0),margin+30,y+15,{align:'center'});
      }
    }

    // Name
    setFont('bold',13);
    pdf.setTextColor(cream);
    pdf.text(m.name,textX,y);

    // Relationship badge
    if(m.rel){
      const nameW=pdf.getTextWidth(m.name);
      setFont('normal',10);
      pdf.setTextColor(gold);
      pdf.text(m.isYou?'(You)':m.rel,textX+nameW+8,y);
    }
    y+=smallH;

    // DOB · Age · Place
    const detailParts=[];
    if(m.dob) detailParts.push(m.dob);
    if(m.age!=null){
      detailParts.push(m.deceased?`Lived ${m.age} years`:`Age ${m.age}`);
    }
    if(m.place) detailParts.push(m.place);
    if(detailParts.length){
      setFont('normal',10);
      pdf.setTextColor(muted);
      pdf.text(detailParts.join('  ·  '),textX,y);
      y+=smallH;
    }

    // Death date
    if(m.dodDisplay){
      setFont('normal',10);
      pdf.setTextColor(120,100,100);
      pdf.text(`† ${m.dodDisplay}`,textX,y);
      y+=smallH;
    }

    // Make sure y is below the photo if photo was taller than text
    if(m.photo){
      const photoBottom=y-smallH*2+45; // rough photo bottom
      if(y<photoBottom) y=photoBottom;
    }

    // Story
    if(m.story){
      y+=4;
      if(y>maxY) newPage();
      setFont('italic',10);
      pdf.setTextColor(160,155,140);
      // Word-wrap story text
      const maxW=pw-margin*2-20;
      const lines=pdf.splitTextToSize(m.story,maxW);
      const maxLines=6; // cap at 6 lines to prevent one story dominating a page
      const showLines=lines.slice(0,maxLines);
      showLines.forEach(line=>{
        if(y>maxY) newPage();
        pdf.text(line,margin+10,y);
        y+=11;
      });
      if(lines.length>maxLines){
        setFont('normal',9);
        pdf.setTextColor(100,100,100);
        pdf.text('(continued in app)',margin+10,y);
        y+=11;
      }
    }

    // Connections list
    if(m.connections.length){
      y+=2;
      setFont('normal',8);
      pdf.setTextColor(80,80,80);
      pdf.text('CONNECTIONS',margin+10,y);
      y+=10;
      m.connections.forEach(conn=>{
        if(y>maxY) newPage();
        setFont('normal',9);
        pdf.setTextColor(120,120,120);
        pdf.text(`${conn.rel}: ${conn.name}`,margin+20,y);
        y+=11;
      });
    }

    // Separator line
    y+=8;
    if(y<maxY-10){
      pdf.setDrawColor(40,40,40);
      pdf.setLineWidth(0.3);
      pdf.line(margin+10,y,pw-margin,y);
      y+=14;
    }
  });

  // ── Footer on all pages ──
  const pageCount=pdf.internal.getNumberOfPages();
  for(let i=2;i<=pageCount;i++){
    pdf.setPage(i);
    setFont('normal',8);
    pdf.setTextColor(80,80,80);
    pdf.text(`Twygie — ${userName}'s Family Tree`,margin,ph-25);
    pdf.text(`Page ${i} of ${pageCount}`,pw-margin,ph-25,{align:'right'});
  }

  // ── Save ──
  pdf.save(`twygie-tree-${new Date().toISOString().slice(0,10)}.pdf`);
}

