// Preserve the full in-page hardware study; load it only when it approaches.
const section=document.getElementById('prototype');
let started=false;
const start=()=>{if(started||!section)return;started=true;import('./prototype.js').catch(()=>{const status=document.getElementById('hwStatus');if(status){status.hidden=false;status.textContent='The interactive model could not load. The still and the real prototype photographs remain available.';}});};
if(section){
  if(location.hash.startsWith('#prototype')||new URLSearchParams(location.search).has('bake'))start();
  else new IntersectionObserver((entries,observer)=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();start();}},{rootMargin:'100% 0px'}).observe(section);
}
