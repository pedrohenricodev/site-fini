const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b,v));
const lerp = (a,b,t) => a+(b-a)*t;
const mod = n => ((n%5)+5)%5;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const flavors = [
  {name:'Beijos', title:'BEIJOS', file:'Beijos-Pacote.png', bit:'Beijo-Sozinho.jpg', color:'#f498c1', dark:'#f12880', line:'UM BEIJO DE DIVERSÃO', type:'Formato de coração'},
  {name:'Dentaduras', title:'DENTADURAS', file:'Dentaduras-pacote.png', bit:'Dentadura-Sozinho.jpg', color:'#6bcee5', dark:'#06a8d2', line:'SORRISOS QUE DÃO GOSTO', type:'Um clássico divertido'},
  {name:'Banana', title:'BANANA', file:'FiniBanana-Pacote.webp', bit:'Banana-Sozinho.webp', color:'#c6db6b', dark:'#8ebf24', line:'UM CACHO DE BOAS IDEIAS', type:'Doçura em forma de fruta'},
  {name:'Tubes Rosa', title:'TUBES ROSA', file:'TubesRosa-Pacote.png', bit:'Tubo-Sozinho.jpg', color:'#f5afd0', dark:'#f483bc', line:'DEIXE O DIA MAIS ROSA', type:'Diversão de ponta a ponta'},
  {name:'Tubes Vermelho', title:'TUBES VERMELHO', file:'TubesVermelho-pacote.webp', bit:'Tubo-Sozinho.jpg', color:'#f57989', dark:'#ef3652', line:'INTENSAMENTE DIVERTIDO', type:'Mais cor para o seu dia'}
];
let active=0, pos=0, target=0, tween=null, auto=!reduced, lastInteraction=performance.now(), drag=null, step=-1, pack=[null,null,null], packTouched=false, packFilled=false;
let selected=[];
try { selected=JSON.parse(localStorage.getItem('fini-selections')||'[]').filter(x=>Array.isArray(x.ids)&&x.ids.length>0&&x.ids.length<=3&&x.ids.every(n=>Number.isInteger(n)&&n>=0&&n<5)).slice(0,100); } catch {}
let renderer,scene,camera,pool=[],traveller,textures=[],pokeStart=0,modelsReady=false;
let viewW=innerWidth, viewH=innerHeight, scrollQueued=true, spin=0, spinFrom=0, spinTo=0, spinStart=0;
const path = name => 'Imagens/'+name;
const loadImage = src => new Promise((resolve,reject)=>{const im=new Image(); im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});

// Crop transparent margins at render time; all supplied source images stay intact.
function packageCanvas(im) {
  const c=document.createElement('canvas'); c.width=im.naturalWidth;c.height=im.naturalHeight;
  const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(im,0,0);
  const p=cx.getImageData(0,0,c.width,c.height).data;
  let l=c.width,r=0,t=c.height,b=0;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]>40){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
  const pad=3;l=Math.max(0,l-pad);t=Math.max(0,t-pad);r=Math.min(c.width-1,r+pad);b=Math.min(c.height-1,b+pad);
  const out=document.createElement('canvas');const s=Math.min(1,900/(b-t+1));out.width=Math.ceil((r-l+1)*s);out.height=Math.ceil((b-t+1)*s);out.getContext('2d').drawImage(c,l,t,r-l+1,b-t+1,0,0,out.width,out.height);return out;
}

// Remove only near-white background connected to the image edges, preserving
// enclosed white details on the candies. This produces transparent render assets.
function candyCanvas(im) {
  const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);
  const pic=ctx.getImageData(0,0,c.width,c.height),p=pic.data,w=c.width,h=c.height,seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let start=0,end=0;
  const add=n=>{if(n<0||n>=w*h||seen[n])return;seen[n]=1;const k=n*4;const min=Math.min(p[k],p[k+1],p[k+2]);if(min>235&&Math.max(p[k],p[k+1],p[k+2])-min<23){queue[end++]=n;p[k+3]=0;}};
  for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
  while(start<end){const n=queue[start++];if(n%w)add(n-1);if(n%w<w-1)add(n+1);add(n-w);add(n+w);}
  ctx.putImageData(pic,0,0);return c;
}
// Canvas is also an image source, so expose its dimensions to the crop helper.
const rawPackageCanvas=packageCanvas;
function cropSource(source){if(source instanceof HTMLCanvasElement){return loadImage(source.toDataURL()).then(rawPackageCanvas);}return Promise.resolve(rawPackageCanvas(source));}

function notify(msg){$('#toast').textContent=msg;$('#toast').classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').classList.remove('show'),2400);}
function changeFlavor(n,instant=false){
  target=n;active=mod(n);lastInteraction=performance.now();
  tween={from:pos,to:n,start:performance.now(),duration:reduced||instant?0:650+Math.min(320,Math.abs(n-pos)*70)};
  const f=flavors[active], old=getComputedStyle(document.documentElement).getPropertyValue('--flav');
  const reveal=$('#reveal');reveal.style.background=f.color;reveal.getAnimations().forEach(a=>a.cancel());
  if(!reduced&&!instant){reveal.animate([{clipPath:'circle(0% at 50% 46%)'},{clipPath:'circle(120% at 50% 46%)'}],{duration:700,easing:'cubic-bezier(.22,.8,.24,1)'}).onfinish=()=>{document.documentElement.style.setProperty('--flav',f.color);};}
  else document.documentElement.style.setProperty('--flav',f.color);
  $('#universo').style.background=f.color;$('#title').textContent=f.title;$('#flavor-type').textContent=f.line;$('#count').textContent=String(active+1).padStart(2,'0');$('#fraction').textContent=String(active+1).padStart(2,'0')+' / 05';
  $('#title').classList.remove('enter');void $('#title').offsetWidth;$('#title').classList.add('enter');fitTitle();
  $$('.card').forEach((c,i)=>c.classList.toggle('live',i===active));
  if(modelsReady)setFlavor(traveller,active);
  if(step===3)updateStep(3,true);
  updateFallback();
}
function fitTitle(){const el=$('#title');el.style.fontSize='';const max=innerWidth<820?innerWidth-30:innerWidth*.68;let size=parseFloat(getComputedStyle(el).fontSize);if(el.scrollWidth>max)el.style.fontSize=size*max/el.scrollWidth+'px';}
function updateFallback(){const root=$('#fallback');root.replaceChildren();[-1,0,1].forEach(k=>{const img=new Image();img.src=flavors[mod(active+k)].src||path(flavors[mod(active+k)].file);img.alt=flavors[mod(active+k)].name;root.append(img);});}
$('#next').onclick=()=>changeFlavor(target+1);$('#prev').onclick=()=>changeFlavor(target-1);
$('#auto').onclick=()=>{auto=!auto;$('#auto').setAttribute('aria-pressed',String(auto));$('#auto-icon').textContent=auto?'Ⅱ':'▷';$('#auto-label').textContent=auto?'AUTOPLAY':'PAUSADO';lastInteraction=performance.now();};
if(reduced){$('#auto').setAttribute('aria-pressed','false');$('#auto-icon').textContent='▷';$('#auto-label').textContent='PAUSADO';}
document.addEventListener('keydown',e=>{if($('#cart').open||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||scrollY>viewH*.4)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();changeFlavor(target+(e.key==='ArrowRight'?1:-1));}});
$('#arc').addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,pos,lastX:e.clientX,lastTime:performance.now(),v:0,moved:false};lastInteraction=performance.now();});
$('#arc').addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>8){drag=null;return;}if(Math.abs(dx)>6){drag.moved=true;$('#arc').setPointerCapture(e.pointerId);tween=null;const s=heroUnit()*245,now=performance.now();pos=drag.pos-dx/s;drag.v=lerp(drag.v,-(e.clientX-drag.lastX)/s/Math.max(1,now-drag.lastTime),.4);drag.lastX=e.clientX;drag.lastTime=now;lastInteraction=now;}});
function release(e){if(!drag)return;if(drag.moved)changeFlavor(Math.round(pos+clamp(drag.v*220,-2,2)));else {const u=heroUnit();const k=Math.round((e.clientX-viewW/2)/(245*u));if(k===0){pokeStart=performance.now();}else changeFlavor(target+clamp(k,-3,3));}drag=null;}
$('#arc').addEventListener('pointerup',release);$('#arc').addEventListener('pointercancel',e=>{if(drag?.moved)changeFlavor(Math.round(pos));drag=null;});

function buildCards(){
  $('#cards').innerHTML=flavors.map((f,i)=>`<article class="card ${i===active?'live':''}" style="--card:${f.color}" data-flavor="${i}"><h3>${f.title.replace(' ','<br>')}</h3><img class="pk" src="${f.src||path(f.file)}" alt="Pacote Fini ${f.name}" draggable="false" tabindex="0"><span class="category">${f.type}</span><button class="add" aria-label="Adicionar ${f.name} à sua seleção">+</button></article>`).join('');
  $$('.card').forEach((el,i)=>{
    el.querySelector('.add').onclick=()=>addSelection([i],[el.querySelector('.pk')]);
    const poke=()=>{if(i===active)pokeStart=performance.now();else el.querySelector('.pk').animate([{scale:'1 1'},{scale:'1.08 .93',offset:.3},{scale:'.97 1.04',offset:.6},{scale:'1 1'}],{duration:500});};
    el.querySelector('.pk').onclick=poke;el.querySelector('.pk').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();poke();}};
    el.addEventListener('click',e=>{if(i===active&&!e.target.closest('button')&&e.target!==el.querySelector('.pk'))poke();});
    if(matchMedia('(hover:hover) and (pointer:fine)').matches){el.onpointermove=e=>{const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;el.style.transform=`translateY(-7px) rotateX(${-y*10}deg) rotateY(${x*10}deg)`;el.style.boxShadow='0 24px 40px -18px #281e1459';};el.onpointerleave=()=>{el.style.transform='';el.style.boxShadow='';};}
  });
  $('#choices').innerHTML=flavors.map((f,i)=>`<button class="choice" style="--card:${f.color}" aria-label="Adicionar ${f.name} ao mix"><span class="thumb"><img src="${f.src||path(f.file)}" alt="" draggable="false"></span><span class="name">${f.name}</span><span class="qty" hidden></span></button>`).join('');
  $$('.choice').forEach((b,i)=>b.onclick=()=>{packTouched=true;const empty=pack.indexOf(null);if(empty<0){notify('Seu trio está completo. Remova um pacote para trocar.');return;}pack[empty]=i;$('#mix-glow').style.background=`radial-gradient(circle,${flavors[i].color}70,transparent 64%)`;renderPack();});
}
function renderPack(){
  $('#slots').innerHTML=pack.map((id,i)=>`<div class="slot">${id===null?`<button class="empty-slot" aria-label="Espaço ${i+1} vazio: escolher sabor" data-empty="${i}">+</button>`:`<img src="${flavors[id].src||path(flavors[id].file)}" alt="${flavors[id].name}"><button class="remove-slot" data-remove="${i}" aria-label="Remover ${flavors[id].name} do mix">×</button>`}</div>`).join('');
  $$('[data-remove]').forEach(b=>b.onclick=()=>{packTouched=true;pack[+b.dataset.remove]=null;renderPack();});
  $$('[data-empty]').forEach(b=>b.onclick=()=>{$('.choice').focus();notify('Escolha um dos cinco sabores abaixo.');});
  const n=pack.filter(x=>x!==null).length;$('#pack-count').textContent=`${n} DE 3 ESCOLHIDOS`;$('#add-mix').disabled=n!==3;$('#add-mix').innerHTML=n===3?'Guardar meu mix <span>3 PACOTES · SUA COMBINAÇÃO</span>':`Escolha mais ${3-n} <span>MONTE SEU TRIO</span>`;
  $$('.choice').forEach((b,i)=>{const n=pack.filter(x=>x===i).length,el=b.querySelector('.qty');el.hidden=!n;el.textContent=n;});
}
$('#add-mix').onclick=()=>{if(pack.some(x=>x===null))return;const ids=[...pack];addSelection(ids,$$('.slot img'));pack=[null,null,null];packTouched=true;renderPack();$('#add-mix').textContent='Mix guardado!';setTimeout(renderPack,1600);};
function addSelection(ids,sources){if(selected.length>=100){notify('Sua seleção está cheia. Remova um item para continuar.');return;}selected.push({ids:[...ids]});persist();sources.forEach((src,i)=>fly(src,i*120));notify(ids.length===3?'Seu mix foi guardado!':'Favorito adicionado à sua seleção.');}
function persist(){try{localStorage.setItem('fini-selections',JSON.stringify(selected));}catch{}const badge=$('#badge');badge.textContent=selected.length;badge.hidden=!selected.length;renderCart();}
function fly(src,delay=0){if(reduced||!src)return;const r=src.getBoundingClientRect(),end=$('#basket').getBoundingClientRect();if(r.bottom<0||r.top>viewH)return;const im=src.cloneNode();im.removeAttribute('class');im.className='flying';Object.assign(im.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',visibility:'visible'});document.body.append(im);const dx=end.x+end.width/2-r.x-r.width/2,dy=end.y+end.height/2-r.y-r.height/2;im.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${dx*.4}px,${dy*.4-100}px) scale(.6) rotate(-10deg)`,opacity:1,offset:.45},{transform:`translate(${dx}px,${dy}px) scale(.08) rotate(-18deg)`,opacity:0}],{duration:900,delay,easing:'cubic-bezier(.5,0,.2,1)',fill:'forwards'}).onfinish=()=>{im.remove();$('#basket').animate([{scale:1},{scale:1.2},{scale:1}],{duration:320});};}
function renderCart(){const root=$('#cart-items');root.innerHTML=selected.length?selected.map((item,i)=>`<div class="cart-row"><img src="${flavors[item.ids[0]].src||path(flavors[item.ids[0]].file)}" alt=""><div><h3>${item.ids.length===3?'Seu mix de 3':flavors[item.ids[0]].name}</h3><p>${item.ids.map(id=>flavors[id].name).join(' + ')}</p></div><button data-delete="${i}" aria-label="Remover item ${i+1} da seleção">Remover</button></div>`).join(''):'<p class="empty-cart">Sua seleção está esperando um toque de diversão. Explore os sabores e guarde seus favoritos.</p>';$$('[data-delete]').forEach(b=>b.onclick=()=>{selected.splice(+b.dataset.delete,1);persist();});}
$('#basket').onclick=()=>{$('#cart').showModal();};$('#close-cart').onclick=$('#continue').onclick=()=>$('#cart').close();$('#cart').onclick=e=>{if(e.target===$('#cart')&&e.clientX<$('#cart').getBoundingClientRect().left)$('#cart').close();};

const stepContent=[['PEQUENOS<br>DOCES.<br>GRANDES<br>SORRISOS.','Formas que surpreendem.<br>Diversão em cada escolha.'],['UM FAVORITO<br>PARA CADA<br>MOMENTO.','Um beijo, um sorriso, uma banana.<br>Qual é o seu clássico?'],['MISTURE.<br>COMBINE.<br>DIVIRTA-SE.','Um trio com a sua cara.<br>A próxima escolha é sua.'],['','Abra seu pacote favorito.<br>Deixe a diversão acontecer.']];
function updateStep(n,force=false){if(n===step&&!force)return;step=n;$('#inside-title').innerHTML=n===3?flavors[active].title.replaceAll(' ','<br>'):stepContent[n][0];$('#inside-caption').innerHTML=stepContent[n][1];$('#step-number').textContent=String(n+1).padStart(2,'0');$$('.step-nav button').forEach((b,i)=>b.classList.toggle('active',i===n));if(!reduced)$('#inside-title').animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:550,easing:'ease-out'});spinFrom=spin;spinTo=[0,Math.PI,Math.PI*2,Math.PI*4][n];spinStart=performance.now();}
$$('[data-step]').forEach(b=>b.onclick=()=>{const el=$('#universo');scrollTo({top:el.offsetTop+(el.offsetHeight-viewH)*(+b.dataset.step*.19+.07),behavior:reduced?'instant':'smooth'});});
let mobileCentered=false;
function scrollState(now){const r=$('#universo').getBoundingClientRect(),shop=$('#favoritos').getBoundingClientRect(),mix=$('#mix').getBoundingClientRect();const insideVisible=r.top<viewH&&r.bottom>0;const pinY=r.top>0?r.top:Math.min(0,r.bottom-viewH);const p=clamp(-r.top/(r.height-viewH));const q=clamp((p-.76)/.24);const n=Math.floor(Math.min(p,.759)/.19);if(insideVisible)updateStep(n);
  const front=$('#inside-front');front.style.visibility=insideVisible?'visible':'hidden';front.style.transform=`translateY(${pinY}px)`;front.style.opacity=1-clamp(q*4);$('#step-number').style.opacity=1-clamp(q*4);$('#storm-dark').style.opacity=clamp(q*3.5)*.55;
  const p1=clamp(1-r.top/viewH),p3=clamp((viewH-shop.top)/(viewH*.72));
  if(innerWidth<820&&p3>.05&&!mobileCentered){mobileCentered=true;const el=$$('.card')[active];$('#cards').scrollTo({left:el.offsetLeft- (innerWidth-el.offsetWidth)/2,behavior:reduced?'instant':'smooth'});}if(p3===0)mobileCentered=false;
  if(q>0&&!reduced)$$('.storm-piece').forEach((el,i)=>{const s=clamp((q-.45*i/20)/.55),a=i*2.399,R=.55*Math.hypot(viewW,viewH),radius=(.06+Math.pow(s,1.5)*.95)*R;el.style.opacity=s>0&&s<1?Math.sin(s*Math.PI)*.8:0;el.style.transform=`translate(calc(-50% + ${Math.cos(a)*radius}px),calc(-50% + ${Math.sin(a)*radius*.8}px)) rotate(${s*360*(i%2?1:-1)}deg) scale(${.7+i%4*.2})`;});else $$('.storm-piece').forEach(el=>el.style.opacity=0);
  let section='sabores';if(r.top<viewH*.35)section='universo';if(shop.top<viewH*.35)section='favoritos';if(mix.top<viewH*.35)section='mix';$$('.nav-links a').forEach(a=>a.classList.toggle('active',a.hash==='#'+section));$('#nav').classList.toggle('on-light',section==='favoritos');$('#nav').classList.toggle('on-dark',section==='mix');
  if(!packFilled&&!packTouched&&mix.top<viewH*.7){packFilled=true;[active,mod(active+1),mod(active+2)].forEach((id,i)=>setTimeout(()=>{if(!packTouched){pack[i]=id;renderPack();}},reduced?0:250+i*160));}
  return {p1,p3,q,insideVisible,heroTop:$('#sabores').getBoundingClientRect().top};
}

function heroUnit(){return viewW<820?Math.min(viewW/560,viewH/980):Math.min(viewW/1440,viewH/900);}
function heroState(k,j,now,heroTop){const u=heroUnit(),a=Math.min(4,Math.abs(k)),i=Math.min(3,Math.floor(a)),f=a-i;const xs=[0,245,452,660,860],ys=[0,24,44,80,118],hs=[430,330,312,296,280];const idle=reduced?0:Math.sin(now/4600*Math.PI*2+j*1.37);return {x:viewW/2+Math.sign(k)*lerp(xs[i],xs[i+1],f)*u,y:heroTop+viewH*(viewW<820?.43:.46)+lerp(ys[i],ys[i+1],f)*u-idle*4*u,h:lerp(hs[i],hs[i+1],f)*u,rz:Math.sign(k)*lerp(i*4,(i+1)*4,f)+idle*.35,ry:-Math.sign(k)*a*.17,rx:0,z:-a*22*u,op:1-clamp((a-3.3)/.6)};}
function blend(a,b,t){const out={};for(const k of Object.keys(a))out[k]=lerp(a[k],b[k],t);return out;}
function smooth(t){return t*t*(3-2*t);}
let THREE;
function setFlavor(group,id){if(!group||group.userData.id===id)return;const tex=textures[id];group.children[0].material.map=tex.front;group.children[0].material.needsUpdate=true;group.children[1].material.map=tex.back;group.children[1].material.needsUpdate=true;group.userData.id=id;}
function makeGeometry(back=false){const g=new THREE.PlaneGeometry(1,1,30,60),p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<p.count;i++){const u=uv.getX(i),v=uv.getY(i),ex=Math.abs(u*2-1),ev=Math.min(v,1-v);let z;if(ev<.065)z=.005+.004*Math.abs(Math.sin(u*Math.PI*34));else z=.006+.065*Math.pow(Math.max(0,1-ex**2.6),.62)*Math.pow(clamp((ev-.065)/.11),.7);p.setZ(i,back?-z:z);}if(back){for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));const a=g.index.array;for(let i=0;i<a.length;i+=3){const t=a[i];a[i]=a[i+2];a[i+2]=t;}}g.computeVertexNormals();return g;}
function makeGroup(frontGeo,backGeo){const g=new THREE.Group();[frontGeo,backGeo].forEach(geo=>{const m=new THREE.MeshPhysicalMaterial({transparent:true,alphaTest:.15,roughness:.65,metalness:0,clearcoat:.25,clearcoatRoughness:.4});g.add(new THREE.Mesh(geo,m));});scene.add(g);return g;}
function place(g,s,now){g.visible=s.op>.005&&s.y+s.h>0&&s.y-s.h<viewH;if(!g.visible)return;const f=textures[g.userData.id],w=s.h*f.aspect;g.position.set(s.x-viewW/2,viewH/2-s.y,s.z);let sx=1,sy=1;if(g===traveller&&pokeStart&&now-pokeStart<500){const t=(now-pokeStart)/500;sx=1+Math.sin(t*Math.PI*2)*.06;sy=1-Math.sin(t*Math.PI*2)*.05;}g.scale.set(w*sx,s.h*sy,w);g.rotation.order='ZYX';g.rotation.set(s.rx||0,s.ry,-s.rz*Math.PI/180);g.children.forEach(m=>m.material.opacity=s.op);}
function resize(){viewW=innerWidth;viewH=innerHeight;fitTitle();if(renderer){renderer.setSize(viewW,viewH);renderer.setPixelRatio(Math.min(devicePixelRatio,viewW<820?1.75:2));const d=1500;camera.aspect=viewW/viewH;camera.fov=2*Math.atan(viewH/2/d)*180/Math.PI;camera.updateProjectionMatrix();}scrollQueued=true;}
addEventListener('resize',resize);addEventListener('scroll',()=>scrollQueued=true,{passive:true});
function draw(now){requestAnimationFrame(draw);if(document.hidden)return;
  if(tween){const t=tween.duration?clamp((now-tween.start)/tween.duration):1;pos=lerp(tween.from,tween.to,1-Math.pow(1-t,4));if(t===1)tween=null;}
  if(auto&&!drag&&now-lastInteraction>4200&&scrollY<viewH*.35&&!$('#cart').open)changeFlavor(target+1);
  const s=scrollState(now);if(!modelsReady)return;
  spin=lerp(spinFrom,spinTo,reduced?1:-(Math.cos(clamp((now-spinStart)/800)*Math.PI)-1)/2);
  const base=Math.floor(pos);
  pool.forEach((g,i)=>{const j=base+i-4,k=j-pos;setFlavor(g,mod(j));const a=heroState(k,j,now,s.heroTop);a.op*=1-clamp(s.p1*1.6);if(j===target)a.op=0;place(g,a,now);});
  const A=heroState(target-pos,target,now,s.heroTop),r=$('#inside-anchor').getBoundingClientRect();
  const B={x:r.x+r.width/2,y:r.y+r.height/2+(reduced?0:Math.sin(now/2600*Math.PI*2)*5),h:r.height,rz:12,ry:spin+(reduced?0:s.q*Math.PI*4),rx:0,z:0,op:1};
  const card=$$('.card')[active],cr=card.querySelector('.pk').getBoundingClientRect();const C={x:cr.x+cr.width/2,y:cr.y+cr.height/2,h:Math.min(cr.height,cr.width/textures[active].aspect),rz:0,ry:Math.round(B.ry/(Math.PI*2))*Math.PI*2,rx:0,z:0,op:1};
  let state=blend(A,B,smooth(s.p1));state=blend(state,C,smooth(s.p3));if(s.p3>=1){state.ry=0;state.rz=0;state.y=C.y;state.h=C.h;}
  place(traveller,state,now);renderer.render(scene,camera);
}

async function boot(){
  try{
    await Promise.all(flavors.map(async f=>{f.canvas=await cropSource(await loadImage(path(f.file)));f.src=f.canvas.toDataURL('image/png');}));
    buildCards();renderPack();persist();updateFallback();
    const bitNames=[...new Set(flavors.map(f=>f.bit))],bits={};
    for(const name of bitNames){const im=await loadImage(path(name));const raw=candyCanvas(im);bits[name]=await cropSource(raw);}
    const bitOrder=['Beijo-Sozinho.jpg','Banana-Sozinho.webp','Dentadura-Sozinho.jpg','Tubo-Sozinho.jpg','Beijo-Sozinho.jpg'];
    bitOrder.forEach(name=>{const el=document.createElement('div');el.className='bit';const c=document.createElement('canvas');c.width=bits[name].width;c.height=bits[name].height;c.getContext('2d').drawImage(bits[name],0,0);el.append(c);$('#bits').append(el);});
    for(let i=0;i<20;i++){const el=new Image();el.className='storm-piece';el.alt='';el.src=bits[bitOrder[i%5]].toDataURL();$('#storm').append(el);}
    THREE=await import('./vendor/three.module.min.js');
    renderer=new THREE.WebGLRenderer({canvas:$('#world'),antialias:true,alpha:true,powerPreference:'low-power'});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0);scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(45,viewW/viewH,10,6000);camera.position.z=1500;
    scene.add(new THREE.AmbientLight(0xffffff,2.1));const light=new THREE.DirectionalLight(0xffffff,1.4);light.position.set(-600,800,1500);scene.add(light);const fill=new THREE.DirectionalLight(0xffffff,.6);fill.position.set(700,100,1000);scene.add(fill);
    textures=flavors.map(f=>{const front=new THREE.CanvasTexture(f.canvas);front.colorSpace=THREE.SRGBColorSpace;front.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());const c=document.createElement('canvas');c.width=f.canvas.width;c.height=f.canvas.height;const ctx=c.getContext('2d');ctx.drawImage(f.canvas,0,0);ctx.globalCompositeOperation='source-atop';ctx.fillStyle=f.dark;ctx.fillRect(0,0,c.width,c.height);ctx.globalCompositeOperation='source-over';ctx.fillStyle='#fff9f0';ctx.textAlign='center';ctx.font=`bold ${c.width*.22}px Arial`;ctx.fillText('Fini',c.width/2,c.height*.22);ctx.font=`bold ${c.width*.09}px Arial`;ctx.fillText('ABRA A',c.width/2,c.height*.41);ctx.fillText('DIVERSÃO.',c.width/2,c.height*.48);ctx.font=`${c.width*.04}px Arial`;ctx.fillText('Um mundo de possibilidades.',c.width/2,c.height*.67);ctx.fillText('Informações do produto:',c.width/2,c.height*.8);ctx.fillText('consulte a embalagem original.',c.width/2,c.height*.84);const back=new THREE.CanvasTexture(c);back.colorSpace=THREE.SRGBColorSpace;return {front,back,aspect:c.width/c.height};});
    const fg=makeGeometry(),bg=makeGeometry(true);pool=Array.from({length:9},()=>makeGroup(fg,bg));traveller=makeGroup(fg,bg);setFlavor(traveller,active);modelsReady=true;document.body.classList.add('gl-ready');resize();
    $('#world').addEventListener('webglcontextlost',e=>{e.preventDefault();modelsReady=false;document.body.classList.remove('gl-ready');$('#world').style.display='none';});
  }catch(err){console.warn('A visualização 3D não está disponível. A versão com imagens permanece ativa.',err);document.body.classList.remove('gl-ready');$('#world').style.display='none';}
}
buildCards();renderPack();persist();updateFallback();fitTitle();requestAnimationFrame(draw);boot();document.fonts.ready.then(fitTitle);
