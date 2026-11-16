import { createPlanet } from './planet.js';
import { initContact } from './contact.js';

const $ = id => document.getElementById(id);
const clamp = (value,min=0,max=1) => Math.max(min,Math.min(max,value));
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
const mobile=matchMedia('(max-width:720px)');
const cosmos=$('cosmos'), scene=$('worldScene'), system=$('planetSystem'), chapters=[...document.querySelectorAll('[data-chapter]')];
const chapterLinks=[...document.querySelectorAll('.chapter-nav a')];
let paused=motionPreference.matches, userOverride=false, visible=true, planet=null, frame=0, dirty=true;
let viewportHeight=innerHeight, lastDraw=0, lastTime=0, ambient=0, scrollAngle=-.45, renderedAngle=-.45, angleOffset=0, currentChapter=-1, activeSignal=.5;
let chapterOffsets=[], cosmosBottom=0, heroHeight=0, lastScroll=0, lastQualityChange=0;
const notes=['A visual journey into what we feel.','Each signal is part of a larger story.','Context before conclusions.','The person is always the point.'];
const orbitLabels=['A world beneath the surface','Signals, in connection','A more complete picture','Built around people'];

function measure(){
  viewportHeight=scene.clientHeight;
  heroHeight=$('hero').offsetHeight;
  chapterOffsets=chapters.map(el=>({top:el.getBoundingClientRect().top+scrollY,height:el.offsetHeight}));
  cosmosBottom=cosmos.getBoundingClientRect().bottom+scrollY;
  dirty=true;requestTick();
}
function updateMotion(){
  if(!paused)angleOffset=renderedAngle-scrollAngle-ambient;
  document.documentElement.classList.toggle('motion-paused',paused);
  const button=$('motionToggle');button.setAttribute('aria-pressed',String(paused));button.setAttribute('aria-label',paused?'Enable ambient motion':'Pause ambient motion');
  button.querySelector('.motion-icon').textContent=paused?'▷':'Ⅱ';button.querySelector('.motion-label').textContent=paused?'Enable motion':'Pause motion';
  dirty=true;requestTick();
}
$('motionToggle').addEventListener('click',()=>{userOverride=true;paused=!paused;updateMotion();});
motionPreference.addEventListener('change',()=>{if(!userOverride){paused=motionPreference.matches;updateMotion();}});

function updateScroll(){
  const y=scrollY;lastScroll=y;
  const transition=clamp((y-heroHeight*.2)/(heroHeight*.6));
  // Motion preference keeps two static compositions, with no travel between them.
  const smooth=paused?(transition>.7?1:0):transition*transition*(3-2*transition);
  if(mobile.matches){system.style.left=`${91-41*smooth}%`;system.style.top=`${45-20*smooth}%`;system.style.transform=`translate(-50%,-50%) scale(${1-.25*smooth})`;}
  else{system.style.left=`${74-46*smooth}%`;system.style.top='49%';system.style.transform=`translate(-50%,-50%) scale(${1-.04*smooth})`;}
  cosmos.classList.toggle('story-active',transition>.8);
  const storyStart=chapterOffsets[0]?.top||heroHeight;
  const progress=clamp((y+viewportHeight*.3-storyStart)/Math.max(1,cosmosBottom-storyStart-viewportHeight*.55));
  scrollAngle=-.45+progress*4.6;
  if(!paused)system.style.setProperty('--orbit-turn',`${progress*38}deg`);
  $('storyProgress').style.transform=`scaleX(${progress})`;
  let index=0;for(let i=0;i<chapterOffsets.length;i++)if(y+viewportHeight*.52>=chapterOffsets[i].top)index=i;
  if(index!==currentChapter){
    currentChapter=index;
    chapterLinks.forEach((link,i)=>{if(i===index)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');});
    $('sceneIndex').textContent=`0${index+1} / 04`;$('sceneNote').textContent=notes[index];$('orbitLabel').textContent=orbitLabels[index];
  }
  // Scroll is always native. Content stays in document flow and fully readable.
  const headerLight=y+48>cosmosBottom&&y+48<$('contact').offsetTop;
  $('header').classList.toggle('on-light',headerLight&& !($('film').offsetTop<y+48&&y+48<$('film').offsetTop+$('film').offsetHeight));
  const currentSection=y<cosmosBottom?'#story':y<$('impact').offsetTop?'#product':y<$('contact').offsetTop?'#impact':'';
  document.querySelectorAll('.desktop-nav a').forEach(link=>{if(link.getAttribute('href')===currentSection)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
}
function requestTick(){if(!frame)frame=requestAnimationFrame(tick);}
function tick(time){
  frame=0;
  const elapsed=lastTime?Math.min(time-lastTime,100):0;lastTime=time;
  if(dirty){updateScroll();dirty=false;}
  if(visible&&!document.hidden){
    if(!paused)ambient+=elapsed*.000025;
    // 30 fps is sufficient for this slow, tactile object. Scroll always gets a frame.
    if(planet&&(time-lastDraw>=32||paused)){
      const start=performance.now();if(!paused)renderedAngle=scrollAngle+ambient+angleOffset;planet.render(renderedAngle,activeSignal);
      const cost=performance.now()-start;
      if(cost>24&&time-lastQualityChange>2000){planet.lowerQuality();lastQualityChange=time;}
      lastDraw=time;
    }
    if(!paused&&planet)requestTick();
  }
}
addEventListener('scroll',()=>{dirty=true;requestTick();},{passive:true});
addEventListener('resize',measure,{passive:true});mobile.addEventListener('change',measure);
document.addEventListener('visibilitychange',()=>{lastTime=0;if(!document.hidden){dirty=true;requestTick();}else if(frame){cancelAnimationFrame(frame);frame=0;}});
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;lastTime=0;if(visible){dirty=true;requestTick();}else if(frame){cancelAnimationFrame(frame);frame=0;}},{threshold:0}).observe(cosmos);
new ResizeObserver(measure).observe(cosmos);
document.fonts.ready.then(measure);
async function setupPlanet(){try{planet=await createPlanet($('planetCanvas'));if(!planet)document.documentElement.classList.add('no-webgl');}catch{document.documentElement.classList.add('no-webgl');}dirty=true;requestTick();}
$('planetCanvas').addEventListener('planetrestore',()=>{planet?.destroy();setupPlanet();});
measure();updateMotion();setupPlanet();

// An accessible signal explorer; no visitor data or medical inference is used.
const signals={
  pulse:{title:'The rhythm within',part:'MAX30102 · planned',description:'Pulse and the variation between beats offer one piece of the picture.',value:.5,path:'M0 38L48 38 57 33 65 40 76 38 85 38 92 11 100 55 110 31 122 38 174 38 183 33 191 40 202 38 211 38 218 11 226 55 236 31 248 38 300 38 309 33 317 40 328 38 337 38 344 11 352 55 362 31 374 38 420 38'},
  skin:{title:'The smallest changes',part:'GSR + ADS1115 · planned',description:'Skin conductance reflects changes in sweating. Context helps make sense of them.',value:.2,path:'M0 50C20 50 35 49 50 50S70 48 85 49C100 48 104 21 121 20S137 41 155 43S175 44 190 42C211 41 218 10 237 12S259 36 278 39S299 40 312 38C329 37 334 22 350 21S375 36 395 37L420 36'},
  temperature:{title:'A different kind of warmth',part:'TMP117 · planned',description:'Skin temperature adds another perspective. A cool room can change it, too.',value:.8,path:'M0 18C30 17 40 19 60 18S98 21 120 24S161 24 181 28S216 29 238 32S272 37 294 38S334 41 358 44S395 46 420 48'},
  motion:{title:'Movement gives us context',part:'MPU6050 · planned',description:'Motion helps distinguish activity from stillness, so a signal is never read alone.',value:.65,path:'M0 35L20 34 30 32 40 36 50 34 60 33 70 36 80 32 90 25 100 48 110 17 120 40 130 28 140 37 150 34 160 35 170 34 180 37 190 32 200 34 210 35 220 30 230 39 240 34 250 25 260 47 270 12 280 43 290 28 300 36 310 34 320 35 330 33 340 36 350 34 360 35 370 33 380 36 390 34 400 35 420 34'}
};
document.querySelectorAll('[data-signal]').forEach(button=>button.addEventListener('click',()=>{
  const key=button.dataset.signal,signal=signals[key];if(!signal)return;
  document.querySelectorAll('[data-signal]').forEach(b=>{const selected=b===button;b.classList.toggle('is-active',selected);b.setAttribute('aria-pressed',String(selected));});
  $('signalTitle').textContent=signal.title;$('signalPart').textContent=signal.part;$('signalDescription').textContent=signal.description;$('signalPath').setAttribute('d',signal.path);activeSignal=signal.value;dirty=true;requestTick();
}));

// Software panels support pointer input and the standard arrow/Home/End keys.
const screens=[
 ['live-instrument','PATHOS Live instrument: room temperature, humidity and pressure, with a simulated status when no board is connected.','The BME280 feed: temperature, humidity and pressure. Simulated when no board is connected.'],
 ['model-study','PATHOS Model study, with sliders for the original model’s three inputs.','Sliders drive the original network’s three inputs directly, bypassing the sensor.'],
 ['source-data','PATHOS Source data showing the synthetic Stress-Lysis dataset.','The synthetic Stress-Lysis dataset used by the original model. This is not clinical data.'],
 ['diagnostics','PATHOS Diagnostics with dataset hash, training seed and architecture.','Dataset hash, training seed, and architecture. The details are there to inspect.']
];
const tabs=[...document.querySelectorAll('[data-screen]')];
function selectScreen(index,focus=false){
  const [name,alt,caption]=screens[index];
  tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});
  $('softwareImage').src=`assets/v1-${name}.webp`;$('softwareImage').alt=alt;$('softwareCaption').textContent=caption;$('softwarePanel').setAttribute('aria-labelledby',tabs[index].id);
  if(focus)tabs[index].focus();
}
tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>selectScreen(index));tab.addEventListener('keydown',event=>{let next=index;if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();selectScreen(next,true);});});

// Real media loads on request, so a visitor pays for what they choose to see.
const video=$('pathosFilm'), play=$('filmPlay');
function attachFilm(){const source=video.querySelector('source');if(source.dataset.src){source.src=source.dataset.src;delete source.dataset.src;video.load();}}
play.addEventListener('click',async()=>{attachFilm();play.hidden=true;try{await video.play();}catch{video.setAttribute('controls','');}});
video.addEventListener('play',()=>{play.hidden=true;});
video.addEventListener('error',()=>{play.hidden=true;const note=document.querySelector('.film-caveat');note.textContent='The film could not load. Please try reloading, or explore the prototype above.';});
new IntersectionObserver(entries=>{if(!entries[0].isIntersecting&&!video.paused)video.pause();},{threshold:.05}).observe(video);

const menu=$('mobileMenu'),menuToggle=$('menuToggle');let menuDestination=null;
menuToggle.addEventListener('click',()=>{menu.showModal();menuToggle.setAttribute('aria-expanded','true');});
$('menuClose').addEventListener('click',()=>menu.close());
menu.addEventListener('close',()=>{menuToggle.setAttribute('aria-expanded','false');if(menuDestination){menuDestination.tabIndex=-1;menuDestination.focus({preventScroll:true});menuDestination=null;}else menuToggle.focus({preventScroll:true});});
menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{menuDestination=document.querySelector(link.getAttribute('href'));menu.close();}));
mobile.addEventListener('change',()=>{if(!mobile.matches&&menu.open)menu.close();});
const photoDialog=$('photoDialog');
document.querySelectorAll('[data-photo]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();$('expandedPhoto').src=button.dataset.photo;$('expandedPhoto').alt=button.querySelector('img').alt;$('expandedCaption').textContent=button.dataset.caption;photoDialog.showModal();}));
$('photoClose').addEventListener('click',()=>photoDialog.close());
photoDialog.addEventListener('click',event=>{if(event.target===photoDialog){const box=photoDialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)photoDialog.close();}});
initContact();

// Content is visible before enhancement. The observer adds only a brief arrival.
if(!motionPreference.matches){const arrivals=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('reveal');arrivals.unobserve(entry.target);}});},{threshold:.12});document.querySelectorAll('.chapter-copy,.section-heading,.build-details,.software-feature,.founder,.contact-intro').forEach(el=>arrivals.observe(el));}
// Preserve useful inbound links from the earlier landing page.
const aliases={problem:'chapter-listen',solution:'chapter-signals',philosophy:'chapter-signals',ai:'chapter-understand',how:'product',roadmap:'pathos-iot',workshops:'impact',journey:'impact',proof:'impact'};
const alias=aliases[location.hash.slice(1)];if(alias)requestAnimationFrame(()=>$(alias)?.scrollIntoView({behavior:'instant'}));
