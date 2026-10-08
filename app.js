"use strict";
/* Surat Menyurat AI — editor dan ekspor PDF + DOCX asli */
const $=id=>document.getElementById(id);
const preview=$('suratPreview'), output=$('output'), statusBox=$('status');
const KEY='surat_editor_v6', OLD_KEYS=['surat_editor_v5','surat_editor_v4'];
const PAGE_W=794,PAGE_H=1123, CONTENT_X=83,CONTENT_Y=76, CONTENT_W=628;
let layers=[],selectedId=null,draftId=null,draftSource=null,currentOrderId=null,paidOrderId=null;
let active=null,restoring=false,working=false,signatureHasInk=false,editTimer=null;
const uuid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const scale=()=>preview.clientWidth/PAGE_W||1;

function status(message,type='info'){
  statusBox.className=`mt-4 p-3 rounded-lg text-sm ${
    type==='error'
      ?'bg-red-100 text-red-700'
      :type==='success'
      ?'bg-green-100 text-green-700'
      :'bg-blue-100 text-blue-700'
  }`;
  statusBox.textContent=message;
}

function modal(el,show){
  el.classList.toggle('hidden',!show);
  el.classList.toggle('flex',show);
}

function text(){
  return output.innerText.trim();
}

function hasDraft(){
  const s=text();
  return !!s&&!s.startsWith('Hasil surat akan muncul di sini...');
}

function save(){
  if(restoring)return;

  try{
    localStorage.setItem(
      KEY,
      JSON.stringify({
        draftId,
        draftSource,
        currentOrderId,
        paidOrderId,
        text:text(),
        layers,
        form:Object.fromEntries(
          ['jenis','nama','penerima','detail'].map(
            id=>[id,$(id).value]
          )
        )
      })
    );
  }catch(e){
    status(
      'Penyimpanan browser penuh. Perkecil ukuran gambar yang diunggah.',
      'error'
    );
  }
}

function restore(){
  let raw=localStorage.getItem(KEY);

  if(!raw){
    for(const k of OLD_KEYS){
      raw=localStorage.getItem(k);
      if(raw)break;
    }
  }

  if(!raw)return;

  try{
    restoring=true;

    const s=JSON.parse(raw);

    draftId=s.draftId||null;
    draftSource=s.draftSource||null;
    currentOrderId=s.currentOrderId||null;
    paidOrderId=s.paidOrderId||null;

    if(
      s.text&&
      !s.text.startsWith('Hasil surat akan muncul di sini...')
    ){
      output.textContent=s.text;
    }

    layers=(Array.isArray(s.layers)?s.layers:[])
      .filter(l=>l&&l.src)
      .map(l=>({
        ...l,
        ratio:Number(l.ratio)||1,
        width:Number(l.width)||150,
        z:Number(l.z)||1,
        background:!!l.background
      }));

    for(const [id,value] of Object.entries(s.form||{})){
      if($(id))$(id).value=value;
    }

  }catch(e){
    console.error('Restore',e);
  }finally{
    restoring=false;
  }

  render();
  save();
}

function newDraft(source){
  draftId=uuid();
  draftSource=source;
  currentOrderId=null;
  paidOrderId=null;
  save();
}

function ensureDraft(){
  if(hasDraft()&&!draftId){
    newDraft('manual');
  }
}

async function generate(){
  const jenis=$('jenis').value;
  const nama=$('nama').value.trim();
  const penerima=$('penerima').value.trim();
  const detail=$('detail').value.trim();

  if(!nama||!penerima||!detail){
    return status(
      'Lengkapi nama, penerima, dan rincian surat.',
      'error'
    );
  }

  const btn=$('generateBtn');

  btn.disabled=true;
  $('regenerateBtn').disabled=true;
  btn.textContent='⏳ Menyusun surat...';

  try{
    const r=await fetch(
      '/api/generate',
      {
        method:'POST',
        headers:{
          'Content-Type':'application/json'
        },
        body:JSON.stringify({
          jenis,
          nama,
          penerima,
          detail
        })
      }
    );

    const d=await r.json();

    if(!r.ok||!d.result){
      throw Error(
        d.error||'Gagal membuat surat'
      );
    }

    newDraft('ai');

    output.textContent=d.result.trim();

    layers=[];
    selectedId=null;

    render();
    save();

    status(
      'Draft baru berhasil dibuat.',
      'success'
    );

  }catch(e){
    status(e.message,'error');

  }finally{
    btn.disabled=false;
    $('regenerateBtn').disabled=false;
    btn.textContent='✨ Buat Draft Surat';
  }
}

$('generateBtn').addEventListener('click',generate);
$('regenerateBtn').addEventListener('click',generate);

output.addEventListener(
  'input',
  ()=>{
    clearTimeout(editTimer);

    editTimer=setTimeout(
      ()=>{
        ensureDraft();
        save();
      },
      250
    );
  }
);

output.addEventListener(
  'paste',
  e=>{
    e.preventDefault();

    const plain=
      e.clipboardData?.getData('text/plain')||'';

    document.execCommand(
      'insertText',
      false,
      plain
    );
  }
);

$('editBtn').addEventListener(
  'click',
  ()=>{
    const edit=
      output.contentEditable!=='true';

    output.contentEditable=String(edit);

    $('editBtn').textContent=
      edit
        ?'💾 Selesai Edit'
        :'✏️ Edit';

    if(edit){
      output.focus();
    }else{
      save();
    }
  }
);

$('copyBtn').addEventListener(
  'click',
  async()=>{
    if(!hasDraft()){
      return status(
        'Belum ada draft.',
        'error'
      );
    }

    try{
      await navigator.clipboard.writeText(
        text()
      );

      status(
        'Teks berhasil disalin.',
        'success'
      );

    }catch{
      status(
        'Tidak dapat menyalin teks.',
        'error'
      );
    }
  }
);

for(const id of ['jenis','nama','penerima','detail']){
  $(id).addEventListener('input',save);
}


/* Canvas TTD */
const pad=$('signaturePad');
const ctx=pad.getContext('2d');

ctx.strokeStyle='#111827';
ctx.fillStyle='#111827';
ctx.lineWidth=3;
ctx.lineCap='round';
ctx.lineJoin='round';

let pen=false;
let last=null;

const point=e=>{
  const r=pad.getBoundingClientRect();

  return{
    x:(e.clientX-r.left)*pad.width/r.width,
    y:(e.clientY-r.top)*pad.height/r.height
  };
};

pad.addEventListener(
  'pointerdown',
  e=>{
    e.preventDefault();

    pen=true;
    signatureHasInk=true;
    last=point(e);

    pad.setPointerCapture(e.pointerId);

    ctx.beginPath();
    ctx.arc(
      last.x,
      last.y,
      1.5,
      0,
      Math.PI*2
    );
    ctx.fill();
  }
);

pad.addEventListener(
  'pointermove',
  e=>{
    if(!pen)return;

    e.preventDefault();

    const p=point(e);

    ctx.beginPath();
    ctx.moveTo(last.x,last.y);
    ctx.lineTo(p.x,p.y);
    ctx.stroke();

    last=p;
  }
);

for(const evt of ['pointerup','pointercancel']){
  pad.addEventListener(
    evt,
    ()=>{
      pen=false;
      last=null;
    }
  );
}

$('clearSignatureBtn').addEventListener(
  'click',
  ()=>{
    ctx.clearRect(
      0,
      0,
      pad.width,
      pad.height
    );

    signatureHasInk=false;

    status(
      'Papan tanda tangan dibersihkan.'
    );
  }
);

function cropPad(){
  const img=
    ctx.getImageData(
      0,
      0,
      pad.width,
      pad.height
    );

  const d=img.data;

  let x0=pad.width;
  let y0=pad.height;
  let x1=-1;
  let y1=-1;

  for(let y=0;y<pad.height;y++){
    for(let x=0;x<pad.width;x++){
      if(
        d[(y*pad.width+x)*4+3]
      ){
        x0=Math.min(x0,x);
        y0=Math.min(y0,y);
        x1=Math.max(x1,x);
        y1=Math.max(y1,y);
      }
    }
  }

  if(x1<0)return null;

  const p=10;
  const w=x1-x0+1+2*p;
  const h=y1-y0+1+2*p;

  const c=document.createElement('canvas');

  c.width=w;
  c.height=h;

  c.getContext('2d').drawImage(
    pad,
    x0,
    y0,
    w-2*p,
    h-2*p,
    p,
    p,
    w-2*p,
    h-2*p
  );

  return{
    src:c.toDataURL('image/png'),
    ratio:w/h
  };
}

$('addSignatureBtn').addEventListener(
  'click',
  ()=>{
    if(!hasDraft()){
      return status(
        'Buat atau tempelkan draft terlebih dahulu.',
        'error'
      );
    }

    if(!signatureHasInk){
      return status(
        'Gambar tanda tangan terlebih dahulu.',
        'error'
      );
    }

    const s=cropPad();

    if(s){
      addLayer({
        ...s,
        type:'signature',
        name:'Tanda tangan',
        x:430,
        y:820,
        width:155
      });
    }
  }
);


/* Gambar upload */
const readFile=f=>
  new Promise(
    (resolve,reject)=>{
      const fr=new FileReader();

      fr.onload=()=>resolve(fr.result);
      fr.onerror=reject;

      fr.readAsDataURL(f);
    }
  );

const dimensions=src=>
  new Promise(
    (resolve,reject)=>{
      const im=new Image();

      im.onload=()=>
        resolve({
          width:im.naturalWidth,
          height:im.naturalHeight
        });

      im.onerror=reject;
      im.src=src;
    }
  );

$('imageUpload').addEventListener(
  'change',
  async e=>{
    if(!hasDraft()){
      e.target.value='';

      return status(
        'Buat atau tempelkan draft terlebih dahulu.',
        'error'
      );
    }

    for(const file of e.target.files){

      if(
        ![
          'image/png',
          'image/jpeg',
          'image/webp'
        ].includes(file.type)||
        file.size>5*1024*1024
      ){
        status(
          'Gunakan PNG/JPG/WebP maksimal 5 MB.',
          'error'
        );

        continue;
      }

      try{
        const src=await readFile(file);
        const d=await dimensions(src);

        addLayer({
          src,
          ratio:d.width/d.height,
          name:file.name,
          type:'image',
          x:70,
          y:70,
          width:200
        });

      }catch(err){
        status(
          'Gambar gagal dibaca.',
          'error'
        );
      }
    }

    e.target.value='';
  }
);


/* Multi-layer */
function normalize(){
  layers.sort(
    (a,b)=>
      (a.z||0)-(b.z||0)
  );

  layers.forEach(
    (l,i)=>
      l.z=i+1
  );
}

function addLayer(info){
  ensureDraft();
  normalize();

  const l={
    id:uuid(),
    name:info.name||'Gambar',
    type:info.type||'image',
    src:info.src,
    x:info.x||0,
    y:info.y||0,
    width:info.width||150,
    ratio:info.ratio||1,
    z:layers.length+1,
    background:false
  };

  layers.push(l);

  selectedId=l.id;

  render();
  save();

  status(
    'Layer ditambahkan. Klik untuk memilih, geser untuk memindahkan.',
    'success'
  );
}

function layer(id){
  return layers.find(
    l=>l.id===id
  );
}

function applyPosition(el,l){
  const s=scale();

  el.style.left=
    `${l.x*s}px`;

  el.style.top=
    `${l.y*s}px`;

  el.style.width=
    `${l.width*s}px`;

  el.style.height=
    `${l.width/l.ratio*s}px`;
}

function render(){
  preview
    .querySelectorAll('.editor-layer')
    .forEach(
      e=>e.remove()
    );

  normalize();

  for(const l of layers){

    const el=
      document.createElement('div');

    el.className=
      'editor-layer'+
      (
        selectedId===l.id
          ?' layer-selected'
          :''
      );

    el.dataset.layerId=l.id;

    el.style.zIndex=
      l.background
        ?String(l.z)
        :String(20+l.z);

    applyPosition(el,l);

    const im=
      document.createElement('img');

    im.src=l.src;
    im.alt=l.name;
    im.draggable=false;

    el.append(im);

    const handle=
      document.createElement('div');

    handle.className='resize-handle';
    handle.title='Ubah ukuran';

    el.append(handle);

    const del=
      document.createElement('button');

    del.type='button';
    del.className='delete-layer';
    del.textContent='×';
    del.title='Hapus';

    el.append(del);

    preview.append(el);

    el.addEventListener(
      'pointerdown',
      e=>{
        if(
          e.target===handle||
          e.target===del
        )return;

        e.preventDefault();
        e.stopPropagation();

        selectedId=l.id;

        preview
          .querySelectorAll('.editor-layer')
          .forEach(
            n=>
              n.classList.toggle(
                'layer-selected',
                n.dataset.layerId===l.id
              )
          );

        active={
          mode:'drag',
          id:l.id,
          pointerId:e.pointerId,
          startX:e.clientX,
          startY:e.clientY,
          x:l.x,
          y:l.y,
          s:scale()
        };

        try{
          el.setPointerCapture(
            e.pointerId
          );
        }catch{}
      }
    );

    handle.addEventListener(
      'pointerdown',
      e=>{
        e.preventDefault();
        e.stopPropagation();

        selectedId=l.id;

        active={
          mode:'resize',
          id:l.id,
          pointerId:e.pointerId,
          startX:e.clientX,
          startWidth:l.width,
          s:scale()
        };

        try{
          handle.setPointerCapture(
            e.pointerId
          );
        }catch{}
      }
    );

    del.addEventListener(
      'pointerdown',
      e=>e.stopPropagation()
    );

    del.addEventListener(
      'click',
      e=>{
        e.preventDefault();
        e.stopPropagation();

        removeLayer(l.id);
      }
    );
  }
}

function movePointer(e){
  if(
    !active||
    e.pointerId!==active.pointerId
  )return;

  const l=layer(active.id);

  if(!l)return;

  e.preventDefault();

  if(active.mode==='drag'){

    l.x=clamp(
      active.x+
      (e.clientX-active.startX)/
      active.s,
      0,
      Math.max(
        0,
        PAGE_W-l.width
      )
    );

    l.y=clamp(
      active.y+
      (e.clientY-active.startY)/
      active.s,
      0,
      Math.max(
        0,
        PAGE_H-l.width/l.ratio
      )
    );

  }else{

    const max=
      Math.min(
        PAGE_W-l.x,
        (PAGE_H-l.y)*l.ratio
      );

    l.width=clamp(
      active.startWidth+
      (e.clientX-active.startX)/
      active.s,
      Math.min(35,max),
      max
    );
  }

  const el=[
    ...preview.querySelectorAll('.editor-layer')
  ].find(
    n=>n.dataset.layerId===l.id
  );

  if(el){
    applyPosition(el,l);
  }
}

document.addEventListener(
  'pointermove',
  movePointer,
  {
    passive:false
  }
);

function endPointer(e){
  if(
    !active||
    active.pointerId!==e.pointerId
  )return;

  active=null;

  render();
  save();
}

document.addEventListener(
  'pointerup',
  endPointer
);

document.addEventListener(
  'pointercancel',
  endPointer
);

function removeLayer(id){
  layers=layers.filter(
    l=>l.id!==id
  );

  if(selectedId===id){
    selectedId=null;
  }

  active=null;

  render();
  save();

  status(
    'Layer dihapus.',
    'success'
  );
}

$('deleteSelectedLayerBtn').addEventListener(
  'click',
  ()=>
    selectedId
      ?removeLayer(selectedId)
      :status(
        'Pilih layer terlebih dahulu.',
        'error'
      )
);

function reorder(delta){
  const l=layer(selectedId);

  if(!l){
    return status(
      'Pilih layer terlebih dahulu.',
      'error'
    );
  }

  normalize();

  const i=
    layers.findIndex(
      x=>x.id===l.id
    );

  const j=
    clamp(
      i+delta,
      0,
      layers.length-1
    );

  [
    layers[i],
    layers[j]
  ]=[
    layers[j],
    layers[i]
  ];

  layers.forEach(
    (x,k)=>
      x.z=k+1
  );

  render();
  save();
}

$('bringLayerForwardBtn').addEventListener(
  'click',
  ()=>reorder(1)
);

$('sendLayerBackwardBtn').addEventListener(
  'click',
  ()=>reorder(-1)
);

$('toggleBackgroundBtn').addEventListener(
  'click',
  ()=>{
    const l=layer(selectedId);

    if(!l){
      return status(
        'Pilih gambar terlebih dahulu.',
        'error'
      );
    }

    l.background=!l.background;

    render();
    save();

    status(
      l.background
        ?'Layer menjadi background di belakang teks.'
        :'Layer kembali ke depan teks.',
      'success'
    );
  }
);

preview.addEventListener(
  'pointerdown',
  e=>{
    if(
      !e.target.closest('.editor-layer')
    ){
      selectedId=null;
      render();
    }
  }
);

window.addEventListener(
  'resize',
  ()=>{
    if(!active){
      render();
    }
  }
);


/* Pembayaran */
async function paymentData(orderId){
  const r=await fetch(
    `/api/get-payment?order_id=${encodeURIComponent(orderId)}`,
    {
      cache:'no-store'
    }
  );

  const d=await r.json();

  if(!r.ok){
    throw Error(
      d.error||
      'Gagal memeriksa pembayaran'
    );
  }

  return d;
}

async function verified(orderId){
  if(!orderId||!draftId){
    return false;
  }

  const d=
    await paymentData(orderId);

  if(
    ![
      'settlement',
      'capture'
    ].includes(
      d.payment_status
    )
  ){
    return false;
  }

  if(!d.draft_id){
    throw Error(
      'Backend belum mengembalikan draft_id. Hubungkan pembayaran dengan draft_id sebelum ekspor.'
    );
  }

  return d.draft_id===draftId;
}

$('printBtn').addEventListener(
  'click',
  async()=>{
    if(!hasDraft()){
      return status(
        'Buat atau tempelkan draft terlebih dahulu.',
        'error'
      );
    }

    ensureDraft();
    save();

    if(paidOrderId){
      try{
        if(
          await verified(
            paidOrderId
          )
        ){
          modal(
            $('printModal'),
            true
          );

          return;
        }

      }catch(e){
        status(
          e.message,
          'error'
        );

        return;
      }
    }

    modal(
      $('paymentInfoModal'),
      true
    );
  }
);

for(const id of [
  'closePaymentInfoModal',
  'cancelPaymentBtn'
]){
  $(id).addEventListener(
    'click',
    ()=>modal(
      $('paymentInfoModal'),
      false
    )
  );
}

$('closePrintModal').addEventListener(
  'click',
  ()=>modal(
    $('printModal'),
    false
  )
);

for(const id of [
  'paymentInfoModal',
  'printModal'
]){
  $(id).addEventListener(
    'click',
    e=>{
      if(e.target===$(id)){
        modal(
          $(id),
          false
        );
      }
    }
  );
}

$('continuePaymentBtn').addEventListener(
  'click',
  async()=>{
    if(working)return;

    ensureDraft();

    working=true;

    const btn=
      $('continuePaymentBtn');

    btn.disabled=true;
    btn.textContent='⏳ Menyiapkan...';

    try{
      const r=await fetch(
        '/api/create-payment',
        {
          method:'POST',
          headers:{
            'Content-Type':'application/json'
          },
          body:JSON.stringify({
            surat_text:text(),
            draft_id:draftId
          })
        }
      );

      const d=await r.json();

      if(
        !r.ok||
        !d.order_id||
        !d.redirect_url
      ){
        throw Error(
          d.error||
          'Gagal membuat transaksi'
        );
      }

      currentOrderId=
        d.order_id;

      save();

      location.assign(
        d.redirect_url
      );

    }catch(e){
      status(
        e.message,
        'error'
      );

      modal(
        $('paymentInfoModal'),
        false
      );

    }finally{
      working=false;

      btn.disabled=false;
      btn.textContent='Lanjut Cetak';
    }
  }
);

async function checkReturn(){
  const p=
    new URLSearchParams(
      location.search
    );

  const id=
    p.get('order_id')||
    currentOrderId;

  if(!id)return;

  try{
    const d=
      await paymentData(id);

    if(
      !hasDraft()&&
      d.surat_text
    ){
      output.textContent=
        d.surat_text;
    }

    if(
      !draftId&&
      d.draft_id
    ){
      draftId=
        d.draft_id;
    }

    if(
      [
        'settlement',
        'capture'
      ].includes(
        d.payment_status
      )&&
      d.draft_id&&
      d.draft_id===draftId
    ){
      paidOrderId=id;
      currentOrderId=id;

      save();

      modal(
        $('printModal'),
        true
      );

      status(
        'Pembayaran berhasil diverifikasi.',
        'success'
      );

      if(
        p.has('order_id')
      ){
        history.replaceState(
          {},
          document.title,
          location.pathname
        );
      }

    }else if(
      p.has('order_id')
    ){
      status(
        'Pembayaran belum terkonfirmasi atau tidak cocok dengan draft ini.',
        'info'
      );
    }

  }catch(e){
    status(
      `Pemeriksaan pembayaran: ${e.message}`,
      'error'
    );
  }
}


/* =========================================================
   PDF EXPORT
   Hanya bagian ini yang diubah:
   tidak langsung download, tetapi buka PDF di tab baru
========================================================= */

async function pdfExport(){

  if(
    typeof html2canvas!=='function'||
    !window.jspdf?.jsPDF
  ){
    throw Error(
      'Library PDF belum dimuat. Periksa koneksi internet.'
    );
  }

  const old=selectedId;

  selectedId=null;
  render();

  preview.classList.add(
    'exporting'
  );

  try{

    await document.fonts.ready;

    const canvas=
      await html2canvas(
        preview,
        {
          backgroundColor:'#ffffff',
          scale:2,
          useCORS:true,
          logging:false,
          scrollX:0,
          scrollY:0,

          onclone:doc=>{
            const clone=
              doc.getElementById(
                'suratPreview'
              );

            clone?.classList.add(
              'exporting'
            );
          }
        }
      );

    const pdf=
      new window.jspdf.jsPDF({
        orientation:'portrait',
        unit:'mm',
        format:'a4',
        compress:true
      });

    const pagePx=
      canvas.width*297/210;

    let y=0;
    let page=0;

    while(
      y<canvas.height
    ){

      const h=
        Math.min(
          pagePx,
          canvas.height-y
        );

      const part=
        document.createElement(
          'canvas'
        );

      part.width=
        canvas.width;

      part.height=
        Math.ceil(h);

      part
        .getContext('2d')
        .drawImage(
          canvas,
          0,
          y,
          canvas.width,
          h,
          0,
          0,
          canvas.width,
          h
        );

      if(page++){
        pdf.addPage();
      }

      pdf.addImage(
        part.toDataURL(
          'image/png'
        ),
        'PNG',
        0,
        0,
        210,
        h/canvas.width*210
      );

      y+=h;
    }


    /*
      SEBELUMNYA:
      pdf.save('surat.pdf');

      SEKARANG:
      buka PDF di tab baru
    */

    const blob=
      pdf.output('blob');

    const url=
      URL.createObjectURL(
        blob
      );

    const win=
      window.open(
        url,
        '_blank'
      );

    if(!win){
      URL.revokeObjectURL(
        url
      );

      throw Error(
        'Popup PDF diblokir browser. Izinkan popup untuk situs ini.'
      );
    }

    setTimeout(
      ()=>{
        URL.revokeObjectURL(
          url
        );
      },
      120000
    );

  }finally{

    preview.classList.remove(
      'exporting'
    );

    selectedId=old;

    render();
  }
}


/* DOCX asli */
function paragraphRuns(s){
  return s
    .split('\n')
    .map(
      (part,i)=>{
        const r=
          new window.docx.TextRun({
            text:part,
            break:i?1:0
          });

        return r;
      }
    );
}

async function docxExport(){
  const D=window.docx;

  if(
    !D?.Document||
    !D?.ImageRun||
    !D?.Packer
  ){
    throw Error(
      'Library Word belum dimuat. Periksa koneksi internet.'
    );
  }

  const EMU=9525;
  const TWIP=20;

  const pageWidth=11906;
  const pageHeight=16838;

  const marginX=
    Math.round(
      CONTENT_X/PAGE_W*
      pageWidth
    );

  const marginY=
    Math.round(
      CONTENT_Y/PAGE_H*
      pageHeight
    );

  const paras=
    text()
      .split(/\n\s*\n/)
      .map(
        s=>
          new D.Paragraph({
            children:
              paragraphRuns(s),

            spacing:{
              after:160,
              line:360
            },

            alignment:
              D.AlignmentType
                .JUSTIFIED
          })
      );

  const imgs=[];

  for(
    const l
    of [...layers]
      .sort(
        (a,b)=>
          a.z-b.z
      )
  ){

    const width=
      Math.max(
        1,
        Math.round(
          l.width
        )
      );

    const height=
      Math.max(
        1,
        Math.round(
          l.width/l.ratio
        )
      );

    let data=l.src;
    let type='png';

    if(
      data.startsWith(
        'data:image/jpeg'
      )
    ){
      type='jpg';

    }else if(
      data.startsWith(
        'data:image/webp'
      )
    ){
      const c=
        document.createElement(
          'canvas'
        );

      const im=
        new Image();

      im.src=data;

      await im.decode();

      c.width=
        im.naturalWidth;

      c.height=
        im.naturalHeight;

      c.getContext('2d')
        .drawImage(
          im,
          0,
          0
        );

      data=
        c.toDataURL(
          'image/png'
        );
    }

    const bytes=
      Uint8Array.from(
        atob(
          data.split(',')[1]
        ),
        c=>
          c.charCodeAt(0)
      );

    const run=
      new D.ImageRun({
        data:bytes,
        type,

        transformation:{
          width,
          height
        },

        floating:{
          horizontalPosition:{
            relative:
              D.HorizontalPositionRelativeFrom.PAGE,

            offset:
              Math.round(
                l.x*EMU
              )
          },

          verticalPosition:{
            relative:
              D.VerticalPositionRelativeFrom.PAGE,

            offset:
              Math.round(
                l.y*EMU
              )
          },

          wrap:{
            type:
              D.TextWrappingType.NONE
          },

          behindDocument:
            !!l.background,

          allowOverlap:true,
          layoutInCell:false
        }
      });

    imgs.push(run);
  }

  const doc=
    new D.Document({
      sections:[
        {
          properties:{
            page:{
              size:{
                width:pageWidth,
                height:pageHeight
              },

              margin:{
                top:marginY,
                bottom:marginY,
                left:marginX,
                right:marginX
              }
            }
          },

          children:[
            new D.Paragraph({
              children:imgs,
              spacing:{
                after:0,
                before:0
              }
            }),

            ...paras
          ]
        }
      ]
    });

  const blob=
    await D.Packer.toBlob(
      doc
    );

  downloadBlob(
    blob,
    'surat.docx'
  );
}

function downloadBlob(blob,name){
  const url=
    URL.createObjectURL(
      blob
    );

  const a=
    document.createElement(
      'a'
    );

  a.href=url;
  a.download=name;

  document.body.appendChild(
    a
  );

  a.click();

  a.remove();

  setTimeout(
    ()=>
      URL.revokeObjectURL(
        url
      ),
    5000
  );
}

async function exportWithPayment(kind){
  if(working)return;

  working=true;

  const btn=$(
    kind==='pdf'
      ?'pdfBtn'
      :'wordBtn'
  );

  btn.disabled=true;

  try{

    if(
      !await verified(
        paidOrderId
      )
    ){
      throw Error(
        'Pembayaran untuk draft ini belum terverifikasi.'
      );
    }

    modal(
      $('printModal'),
      false
    );

    if(kind==='pdf'){
      await pdfExport();
    }else{
      await docxExport();
    }

    status(
      `${
        kind==='pdf'
          ?'PDF'
          :'Word (.docx)'
      } berhasil dibuat.`,
      'success'
    );

  }catch(e){
    console.error(e);

    status(
      `Gagal ekspor: ${e.message}`,
      'error'
    );

  }finally{
    btn.disabled=false;
    working=false;
  }
}

$('pdfBtn').addEventListener(
  'click',
  ()=>exportWithPayment('pdf')
);

$('wordBtn').addEventListener(
  'click',
  ()=>exportWithPayment('word')
);

document.addEventListener(
  'keydown',
  e=>{
    if(e.key==='Escape'){
      selectedId=null;

      render();

      modal(
        $('printModal'),
        false
      );

      modal(
        $('paymentInfoModal'),
        false
      );
    }
  }
);

restore();
checkReturn();
