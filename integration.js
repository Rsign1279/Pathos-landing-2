import {createPlanet} from './planet.js';

// The original page owns its content and interactions. This module adds only
// the scoped planetary companion and the accessible navigation enhancement.
const groups=[...document.querySelectorAll('[data-planet-story]')].map(element=>({element,stage:element.querySelector('.planet-stage'),surface:element.querySelector('.planet-surface'),chapters:[...element.querySelectorAll('[data-planet-chapter]')],links:[...element.querySelectorAll('.planet-chapter-links a')],bounds:[],top:0,bottom:0,index:-1}));
const motion=matchMedia('(prefers-reduced-motion:reduce)');
const control=document.getElementById('planetMotion');
const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');canvas.id='integratedPlanet';
let renderer=null,initializing=null,unavailable=false,active=null,frame=0,dirty=true,lastTime=0,lastDraw=0,ambient=0,angle=0,offset=0,lastQuality=0;
let paused=motion.matches,userOverride=false;
const clamp=value=>Math.min(1,Math.max(0,value));
const wake=()=>{if(!frame)frame=requestAnimationFrame(tick);};

function measure(){
  for(const group of groups){const box=group.element.getBoundingClientRect();group.top=box.top+scrollY;group.bottom=box.bottom+scrollY;group.bounds=group.chapters.map(chapter=>{const rect=chapter.getBoundingClientRect();return{top:rect.top+scrollY,height:rect.height};});}
  dirty=true;wake();
}
function mount(group){
  if(unavailable)return;
  if(canvas.parentElement!==group.surface){canvas.parentElement?.classList.remove('has-webgl');group.surface.appendChild(canvas);if(renderer)group.surface.classList.add('has-webgl');}
  if(!renderer&&!initializing){
    initializing=createPlanet(canvas).then(result=>{renderer=result;initializing=null;if(!renderer){unavailable=true;canvas.remove();return;}dirty=true;wake();}).catch(()=>{initializing=null;unavailable=true;canvas.remove();});
  }
}
function update(){
  const y=scrollY,focus=y+innerHeight*.36;
  active=groups.find(group=>group.top<y+innerHeight*.78&&group.bottom>y+112)||null;
  for(const group of groups){
    let index=0;for(let i=0;i<group.bounds.length;i++)if(focus>=group.bounds[i].top)index=i;
    if(group.index!==index){group.index=index;const chapter=group.chapters[index];group.stage.querySelector('.planet-chapter-count').textContent=`0${index+1} / 06`;group.stage.querySelector('.planet-chapter-title').textContent=chapter.dataset.planetTitle;group.stage.querySelector('.planet-chapter-note').textContent=chapter.dataset.planetNote;group.links.forEach((link,i)=>{if(i===index)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');});}
    const current=group.bounds[index],within=clamp((focus-current.top)/Math.max(1,current.height));
    group.progress=(index+within)/group.chapters.length;
    group.stage.querySelector('.orbit-progress span').style.transform=`scaleX(${group.progress})`;
    if(!paused)group.stage.style.setProperty('--orbit-angle',`${group.progress*40}deg`);
  }
  if(active)mount(active);
}
function tick(time){
  frame=0;const elapsed=lastTime?Math.min(80,time-lastTime):0;lastTime=time;
  if(dirty){update();dirty=false;}
  if(active&&!document.hidden){
    if(!paused)ambient+=elapsed*.00002;
    if(renderer&&(time-lastDraw>=32||paused)){
      if(!paused)angle=-.45+active.progress*4.8+ambient+offset;
      const selected=active.element.querySelectorAll('.sig-card[aria-pressed=true]').length;
      const started=performance.now();renderer.render(angle,selected?selected/4:.5);
      if(performance.now()-started>24&&time-lastQuality>2000){renderer.lowerQuality();lastQuality=time;}
      lastDraw=time;
    }
    if(renderer&&!paused)wake();
  }
}
function updateMotion(){
  document.documentElement.classList.toggle('planet-paused',paused);
  if(control){control.setAttribute('aria-pressed',String(paused));control.setAttribute('aria-label',paused?'Resume the planet animation':'Pause the planet animation');control.querySelector('span:first-child').textContent=paused?'▷':'Ⅱ';control.querySelector('.planet-motion-label').textContent=paused?'Resume planet':'Pause planet';}
  if(!paused&&active)offset=angle-(-.45+active.progress*4.8+ambient);
  dirty=true;wake();
}
control?.addEventListener('click',()=>{userOverride=true;paused=!paused;updateMotion();});
motion.addEventListener('change',()=>{if(!userOverride){paused=motion.matches;updateMotion();}});
addEventListener('scroll',()=>{dirty=true;wake();},{passive:true});
addEventListener('resize',measure,{passive:true});
document.addEventListener('visibilitychange',()=>{lastTime=0;if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;}else{dirty=true;wake();}});
document.addEventListener('click',event=>{if(event.target.closest('.sig-card')){dirty=true;wake();}});
const sizes=new ResizeObserver(measure);groups.forEach(group=>sizes.observe(group.element));
const visibility=new IntersectionObserver(()=>{dirty=true;lastTime=0;wake();},{threshold:0});groups.forEach(group=>visibility.observe(group.element));
canvas.addEventListener('planetrestore',()=>{renderer?.destroy();renderer=null;initializing=null;if(active)mount(active);});
document.fonts.ready.then(measure);
measure();updateMotion();

// Preserve original reveal/tilt descendants. The outer wrapper alone emerges.
const arrivals=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){entry.target.classList.add('orbit-arrived');arrivals.unobserve(entry.target);}}},{threshold:.08});
for(const group of groups)for(const chapter of group.chapters){arrivals.observe(chapter);chapter.querySelector(':scope > .wrap')?.addEventListener('animationend',event=>{if(event.animationName==='orbit-emerge'||event.animationName==='orbit-rise')chapter.classList.add('orbit-settled');});}

// The founder's original menu keeps its links and handler, with a focus trap
// and inert page behind it when its mobile panel is open.
const nav=document.getElementById('nav'),main=document.getElementById('main'),footer=document.querySelector('.site-foot');
const mobileMenu=matchMedia('(max-width:900px)');
if(nav){
  const syncMenu=()=>{const open=mobileMenu.matches&&nav.classList.contains('open');if(main)main.inert=open;if(footer)footer.inert=open;document.body.style.overflow=open?'hidden':'';};
  new MutationObserver(syncMenu).observe(nav,{attributes:true,attributeFilter:['class']});mobileMenu.addEventListener('change',syncMenu);
  nav.querySelector('#navLinks')?.addEventListener('click',event=>{const link=event.target.closest('a[href^="#"]');if(link&&mobileMenu.matches){const destination=document.querySelector(link.getAttribute('href'));queueMicrotask(()=>{if(destination){destination.tabIndex=-1;destination.focus({preventScroll:true});}});}});
  nav.addEventListener('keydown',event=>{if(event.key!=='Tab'||!mobileMenu.matches||!nav.classList.contains('open'))return;const focusable=[...nav.querySelectorAll('a[href],button:not([disabled])')].filter(el=>el.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
  syncMenu();
}
