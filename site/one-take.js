/* ZERO ONE — One Take, integrated chapter */
(() => {
  'use strict';
  const section = document.querySelector('#one-take');
  if (!section) return;
  const stage = section.querySelector('.ot-stage');
  const canvas = section.querySelector('.ot-canvas');
  const ctx = canvas && canvas.getContext('2d');
  const scenes = [...section.querySelectorAll('.ot-scene')];
  const progress = section.querySelector('.ot-progress span');
  const cta = section.querySelector('.ot-cta');
  const skip = section.querySelector('[data-ot-skip]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gsap = window.gsap, ST = window.ScrollTrigger;
  let width=0,height=0,dpr=1,particles=[],frame=0,scrollProgress=0,mouseX=-999,mouseY=-999,trigger=null;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function resize(){
    if(!ctx)return;
    const rect=stage.getBoundingClientRect(); width=rect.width;height=rect.height;dpr=Math.min(devicePixelRatio||1,1.6);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    const count=width<700?360:700;
    particles=Array.from({length:count},(_,i)=>({a:i/count*Math.PI*2,r:.72+Math.random()*.28,x:Math.random()*width,y:Math.random()*height,size:.7+Math.random()*1.5,phase:Math.random()*Math.PI*2}));
  }
  function targetFor(p,step){
    const cx=width*(width<700?.72:.72),cy=height*.49,R=Math.min(width,height)*(width<700?.24:.3);
    if(step<.5){const a=p.a;return [cx+Math.cos(a)*R*p.r,cy+Math.sin(a)*R*p.r]}
    if(step<1.5){const a=Math.floor((p.a/(Math.PI*2))*12)/12*Math.PI*2;return [cx+Math.cos(a)*R*p.r,cy+Math.sin(a)*R*p.r]}
    if(step<2.5){return [cx+(p.r-.5)*R*.16,cy+(p.phase/Math.PI-1)*height*.6]}
    if(step<3.5){return [width*.1+Math.floor(p.r*13)*(width*.8/13),cy+(p.phase/Math.PI-1)*height*.55]}
    if(step<4.5){return [width*.1+(p.a/(Math.PI*2))*(width*.8),cy+Math.sin(p.a*4+p.phase)*height*.13]}
    if(step<5.5){const band=Math.floor(p.r*5);return [cx-width*.3+band*width*.13+(p.r-.5)*width*.06,cy+height*.3-p.r*height*.6]}
    // Last beat: the particle field resolves into a clean ring/one mark.
    const angle=p.a;return [cx+Math.cos(angle)*R*p.r,cy+Math.sin(angle)*R*p.r];
  }
  function draw(){
    if(!ctx||!width||!height)return;
    ctx.clearRect(0,0,width,height);
    const n=scrollProgress*(scenes.length-1),idx=Math.min(Math.floor(n),scenes.length-2),mix=n-idx;
    const blend=mix*mix*(3-2*mix);
    particles.forEach(p=>{
      const a=targetFor(p,idx),b=targetFor(p,idx+1),tx=a[0]+(b[0]-a[0])*blend,ty=a[1]+(b[1]-a[1])*blend;
      if(!reduced){p.x+=(tx-p.x)*.09;p.y+=(ty-p.y)*.09;const dx=p.x-mouseX,dy=p.y-mouseY,d=dx*dx+dy*dy;if(d<14000){p.x+=dx/(Math.sqrt(d)||1)*.8;p.y+=dy/(Math.sqrt(d)||1)*.8}}
      else{p.x=tx;p.y=ty}
      ctx.fillStyle=(p.phase>4.9)?'#fff':'#FF5A1F';ctx.globalAlpha=.55+.45*Math.sin(p.phase+frame*.018);ctx.fillRect(p.x,p.y,p.size,p.size);
    });
    ctx.globalAlpha=1;frame++;
  }
  function paintScene(value){
    scrollProgress=clamp(value,0,1);
    const step=scrollProgress*(scenes.length-1);
    scenes.forEach((el,i)=>{const opacity=clamp(1-Math.abs(step-i)*2.1,0,1);el.style.opacity=String(opacity);el.style.visibility=opacity>.02?'visible':'hidden';el.style.transform='translateY(calc(-43% + '+((i-step)*-22)+'px))';});
    if(progress)progress.style.transform='scaleX('+scrollProgress+')';
    const show=clamp((scrollProgress-.82)*7,0,1);
    if(cta){cta.style.opacity=String(show);cta.style.visibility=show>.02?'visible':'hidden';cta.style.pointerEvents=show>.4?'auto':'none'}
    draw();
  }
  function init(){
    resize();paintScene(0);
    if(gsap&&ST&&!reduced){
      gsap.registerPlugin(ST);
      trigger=ST.create({trigger:stage,start:'top top',end:()=>'+='+Math.max(window.innerHeight*5.8,3000),pin:true,scrub:.65,invalidateOnRefresh:true,onUpdate:self=>paintScene(self.progress)});
    } else {
      // Reduced-motion and fallback: use a short, non-pinned chapter that still reveals all copy.
      scenes.forEach((el,i)=>{el.style.position='relative';el.style.inset='auto';el.style.transform='none';el.style.opacity='1';el.style.visibility='visible';});
      stage.style.height='auto';stage.style.minHeight='0';
      canvas.style.position='absolute';canvas.style.height='100%';
      section.querySelector('.ot-scenes').style.position='relative';
      section.querySelector('.ot-scenes').style.padding='100px 0';
      section.querySelectorAll('.ot-scene').forEach(el=>{el.style.padding='36px 0';});
      if(cta){cta.style.position='relative';cta.style.left='auto';cta.style.bottom='auto';cta.style.opacity='1';cta.style.visibility='visible';cta.style.padding='0 var(--pad) 36px';cta.style.pointerEvents='auto'}
    }
  }
  skip?.addEventListener('click',()=>{if(trigger&&ST){window.scrollTo({top:trigger.end-2,behavior:reduced?'auto':'smooth'})}else section.scrollIntoView({behavior:reduced?'auto':'smooth',block:'end'})});
  stage.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();mouseX=e.clientX-r.left;mouseY=e.clientY-r.top});
  stage.addEventListener('pointerleave',()=>{mouseX=mouseY=-999});
  window.addEventListener('resize',()=>{resize();if(ST)ST.refresh();draw()},{passive:true});
  // Keep the canvas animation lightweight and self-contained.
  let raf=0;
  function tick(){draw();raf=requestAnimationFrame(tick)}
  if(!reduced)raf=requestAnimationFrame(tick);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{resize();draw()});
  init();
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);trigger?.kill()},{once:true});
})();