#!/usr/bin/env node
// Tests the production angular geometry and runs the unmodified story logic
// against a small fake document. No browser, third-party dependency, or timers.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
let checks=0;
const failures=[];
const check=(ok,message)=>{checks++;if(!ok)failures.push(message);};
const near=(a,b,tolerance=1e-9)=>Math.abs(a-b)<=tolerance;
const equalPose=(a,b)=>Object.keys(a).every(key=>near(a[key],b[key]));

async function main(){
  const mathSource=fs.readFileSync(path.join(root,'orbit-motion.js'),'utf8');
  const math=await import('data:text/javascript;base64,'+Buffer.from(mathSource).toString('base64'));
  const {clamp,turnRate,angleAt,revealAt,surfacePoint,emergePose,planReadingChunks}=math;
  check(clamp(-2)===0&&clamp(2)===1&&clamp(.4)===.4,'Progress must remain in its valid range');
  for(const height of [320,568,844,900,1200]){
    const rate=turnRate(height);
    check(Number.isFinite(rate)&&rate>0,`Viewport ${height}: finite positive turn rate`);
    check(near(angleAt(1700+Math.max(480,height)*2.4,1700,.25,rate)-.25,Math.PI*2),`Viewport ${height}: one turn has the intended scroll distance`);
  }
  for(const mobile of [false,true]){
    const origin={x:245,y:272,radius:123};
    for(let step=-50;step<=50;step++){
      const angle=step*.31;
      const point=surfacePoint(angle,origin,mobile),dx=point.x-origin.x,dy=point.y-origin.y;
      const projectedDistanceSquared=dx*dx+dy*dy;
      check(Number.isFinite(point.x)&&Number.isFinite(point.y)&&projectedDistanceSquared<origin.radius*origin.radius,`${mobile?'Phone':'Desktop'} source stays on the visible hemisphere at angle ${angle.toFixed(2)}`);
      check(mobile?dy>0:dx>0,`${mobile?'Phone':'Desktop'} source remains on its outward-facing side`);
      check(equalPose(point,surfacePoint(angle,origin,mobile)),'The same angle gives the same source, independent of time/history');
    }
    const start=emergePose(0,-320,175,mobile),end=emergePose(1,-320,175,mobile);
    check(near(start.x,-320)&&near(start.y,175)&&near(start.scale,.48)&&start.opacity===0&&near(start.trail,0),`${mobile?'Phone':'Desktop'} entry begins at the requested surface origin`);
    check(near(end.x,0)&&near(end.y,0)&&near(end.scale,1)&&near(end.turn,0)&&near(end.roll,0)&&end.opacity===1&&near(end.trail,0),`${mobile?'Phone':'Desktop'} endpoint is upright, full-size, crisp reading text`);
    check(equalPose(emergePose(-1,-320,175,mobile),start)&&equalPose(emergePose(2,-320,175,mobile),end),'Outside progress bounds cannot overshoot the endpoint poses');
    let previousScale=0,previousOpacity=0;
    for(let index=0;index<=40;index++){
      const p=index/40,pose=emergePose(p,-320,175,mobile);
      check(Object.values(pose).every(Number.isFinite),'Every intermediate pose is finite');
      check(pose.scale>=previousScale&&pose.opacity>=previousOpacity,'Text size and visibility grow continuously into the reading pose');
      check(equalPose(pose,emergePose(p,-320,175,mobile)),'A repeated angular progress has an identical pose');
      previousScale=pose.scale;previousOpacity=pose.opacity;
    }
    check(emergePose(.5,-320,175,mobile).trail>0,'A connecting trail exists during emergence');
  }
  const rate=turnRate(900),top=1200,base=.35,startAngle=angleAt(1800,top,base,rate),endAngle=angleAt(2200,top,base,rate);
  const samples=[1700,1800,1900,2000,2100,2200,2300];
  const forward=samples.map(scroll=>revealAt(angleAt(scroll,top,base,rate),startAngle,endAngle));
  check(forward[0]===0&&forward.at(-1)===1,'Angular reveal clamps before entry and after reading');
  check(forward[2]>0&&forward[2]<forward[3]&&forward[3]<forward[4]&&forward[4]<1,'Scroll reveal contains multiple distinct intermediate states');
  const reverse=[...samples].reverse().map(scroll=>revealAt(angleAt(scroll,top,base,rate),startAngle,endAngle)).reverse();
  check(forward.every((p,index)=>near(p,reverse[index])),'Reverse scrolling retraces the exact reveal progress');
  check(near(revealAt(startAngle+.4,startAngle,endAngle),revealAt(startAngle+.4+10,startAngle+10,endAngle+10)),'Reveal depends on the relative angle, not an arbitrary phase origin');

  // Assert the planner's reading contract, independently of its partitioning
  // implementation. Input rows already represent paired-column cohorts.
  function validatePlan(chunks,rows,{height,mobile,readingTop,firstVisibleAt},label){
    const budget=Math.max(160,height-readingTop-24)*.8;
    check(chunks.flatMap(chunk=>chunk.rows).length===rows.length&&chunks.flatMap(chunk=>chunk.rows).every((row,index)=>row===rows[index]),`${label}: planning retains every cohort in order`);
    for(let index=0;index<chunks.length;index++){
      const chunk=chunks[index],previous=chunks[index-1];
      check(chunk.rows.length>0&&chunk.rows.length<=3,`${label}: chunks contain at most three cohorts`);
      check(chunk.rows.every(row=>row.chapter===chunk.rows[0].chapter),`${label}: a chunk never crosses a section`);
      check(chunk.bottom-chunk.top<=budget+.001||chunk.rows.length===1||(chunk.intro&&chunk.rows.length===2),`${label}: a tall atomic row or introductory pair is the only height-budget exception`);
      if(previous)check(chunk.start>=previous.end-1e-8,`${label}: adjacent chunks do not emit concurrently`);
      check(chunk.fragments.length===chunk.rows.length,`${label}: every cohort receives one serial slot`);
      for(let part=0;part<chunk.fragments.length;part++){
        const fragment=chunk.fragments[part],prior=chunk.fragments[part-1];
        check(fragment.end>fragment.start&&fragment.row===chunk.rows[part],`${label}: fragment slots advance and preserve order`);
        if(prior)check(fragment.start>=prior.end-1e-8,`${label}: the preceding fragment finishes before the next begins`);
      }
      check(near(chunk.fragments.at(-1).end,chunk.end,1e-8),`${label}: the final fragment completes the chunk`);
      const deadline=chunk.top-.90*height;
      if(index===0&&chunk.end>deadline+1){
        check(chunk.start>=firstVisibleAt-1,`${label}: the first exceptional chunk waits for the planet to be visible`);
        check(chunk.fragments.every(fragment=>fragment.end-fragment.start>=(mobile?64:80)-.001),`${label}: the first chunk gives each fragment its minimum visible turn`);
        check(chunk.end-chunk.start<=chunk.rows.length*(mobile?64:80)+1,`${label}: first-chunk lateness is limited to the minimum fragment turns`);
      }else check(chunk.end<=deadline+1,`${label}: the whole normal chunk completes by the 0.90H reading deadline`);
    }
    for(const chapter of new Set(rows.map(row=>row.chapter))){
      const sectionRows=rows.filter(row=>row.chapter===chapter),intro=chunks.find(chunk=>chunk.rows.includes(sectionRows[0]));
      if(sectionRows.length>1)check(intro.rows.includes(sectionRows[1]),`${label}: a section heading stays with its first content cohort`);
    }
  }
  check(planReadingChunks([],{height:900,mobile:false,readingTop:112}).length===0,'An empty passage creates no phantom chunks');
  for(const {height,mobile,readingTop} of [{height:900,mobile:false,readingTop:112},{height:844,mobile:true,readingTop:248},{height:568,mobile:true,readingTop:224}]){
    const rows=[];
    for(let chapter=0;chapter<3;chapter++)for(const [offset,tall] of [[0,110],[150,150],[330,180],[550,160],[750,150]])rows.push({top:3000+chapter*1400+offset,bottom:3000+chapter*1400+offset+tall,chapter});
    const options={height,mobile,readingTop,firstVisibleAt:rows[0].top-height*.8};
    const chunks=planReadingChunks(rows,options);
    validatePlan(chunks,rows,options,`${height}px planner`);
  }

  const source=fs.readFileSync(path.join(root,'integration.js'),'utf8').replace(/^import\s+[^;]*?;\s*$/gm,'');
  function fixture({width=1440,height=900,reduced=false,webgl=true,paired=false,rich=false}={}){
    const state={scroll:0,now:0,width,height,created:0,renders:[],nextFrame:1,layoutReads:0};
    const frames=new Map(),windowEvents={},documentEvents={},mutations=[];
    const style=()=>({values:new Map(),setProperty(name,value){this.values.set(name,value);},getPropertyValue(name){return this.values.get(name)||'';}});
    function element(){
      const classes=new Set(),events={};
      return{dataset:{},textContent:'',style:style(),offsetTop:0,offsetLeft:0,offsetHeight:120,offsetWidth:200,offsetParent:null,parentElement:null,events,
        classList:{add(...names){names.forEach(name=>classes.add(name));},remove(...names){names.forEach(name=>classes.delete(name));},toggle(name,force){if(force===undefined)force=!classes.has(name);if(force)classes.add(name);else classes.delete(name);return force;},contains(name){return classes.has(name);}},
        setAttribute(name,value){this[name]=value;},getAttribute(name){return this[name]??null;},removeAttribute(name){delete this[name];},querySelector(){return null;},
        addEventListener(name,callback){(events[name]??=[]).push(callback);},
        appendChild(child){child.parentElement=this;},remove(){this.parentElement=null;},
        closest(selector){if(selector==='.orbit-unit'&&classes.has('orbit-unit'))return this;return null;},
        getBoundingClientRect(){return{top:this.offsetTop-state.scroll,left:this.offsetLeft,width:this.offsetWidth,height:this.offsetHeight,bottom:this.offsetTop-state.scroll+this.offsetHeight};}
      };
    }
    const chapterStep=rich?1100:660,groupHeight=64+6*chapterStep+64;
    const groups=[1000,rich?1000+groupHeight+2000:8000].map((top,groupIndex)=>{
      const group=element(),stage=element(),surface=element();
      group.offsetTop=top;group.offsetHeight=groupHeight;
      const groupRect=group.getBoundingClientRect.bind(group);group.getBoundingClientRect=()=>{state.layoutReads++;return groupRect();};
      stage.offsetLeft=width<=640?24:64;stage.offsetHeight=width<=640?(height<=650?144:168):700;
      stage.getBoundingClientRect=()=>({left:stage.offsetLeft,top:Math.max(top+64-state.scroll,Math.min(width<=640?80:112,top+groupHeight-64-stage.offsetHeight-state.scroll)),width:width<=640?width-48:440,height:stage.offsetHeight});
      surface.offsetWidth=width<=640?120:300;
      surface.getBoundingClientRect=()=>{const box=stage.getBoundingClientRect();return{left:box.left+(width<=640?8:40),top:box.top+(width<=640?10:80),width:surface.offsetWidth,height:surface.offsetWidth};};
      const caption=element(),title=element(),note=element(),bar=element(),thread=element(),trace=element(),sourcePoint=element(),type=element(),typeWords=element();
      const stageNodes={'.planet-chapter-count':caption,'.planet-chapter-title':title,'.planet-chapter-note':note,'.orbit-progress span':bar,'.orbit-thread-path':thread,'.orbit-surface-trace':trace,'.orbit-source':sourcePoint,'.orbit-type':type,'.orbit-type-words':typeWords};
      stage.querySelector=selector=>stageNodes[selector];
      const chapters=Array.from({length:6},(_,index)=>{const node=element();node.offsetTop=top+64+index*chapterStep;node.offsetLeft=width<=640?24:570;node.offsetHeight=chapterStep;node.dataset={planetTitle:`Group ${groupIndex+1} chapter ${index+1}`,planetNote:`Note ${index+1}`};return node;});
      const units=chapters.flatMap(chapter=>{
        const nodes=(rich?[24,220,420,620,820]:[24,220]).map(offset=>{const node=element();node.offsetTop=chapter.offsetTop+offset;node.offsetLeft=chapter.offsetLeft;node.offsetWidth=paired?210:width<=640?width-48:500;return node;});
        if(paired){const pair=element();pair.offsetTop=nodes[1].offsetTop+2;pair.offsetLeft=nodes[1].offsetLeft+260;pair.offsetWidth=210;pair.offsetHeight=240;nodes.push(pair);}
        return nodes;
      });
      units.forEach((node,index)=>{
        const heading=element();heading.textContent=`Original group ${groupIndex+1} heading ${index+1}`;
        node.textContent=heading.textContent+' Original explanatory copy.';
        node.querySelector=selector=>selector==='h2,h3,.how-t,summary,strong'?heading:null;
        node.heading=heading;
      });
      const signalGrid=groupIndex===0?element():null;
      if(signalGrid){signalGrid.pressed=0;signalGrid.querySelectorAll=()=>Array.from({length:signalGrid.pressed},()=>element());}
      const links=chapters.map(()=>element());
      group.querySelector=selector=>({'.planet-stage':stage,'.planet-surface':surface,'.sig-grid':signalGrid}[selector]);
      group.querySelectorAll=selector=>selector==='[data-planet-chapter]'?chapters:selector==='.planet-chapter-links a'?links:selector.startsWith('.sec-head,')?units:[];
      return{group,stage,surface,chapters,units,links,title,signalGrid,type,typeWords};
    });
    const control=element(),controlIcon=element(),controlLabel=element(),main=element(),rootNode=element(),canvas=element();
    control.querySelector=selector=>selector==='span:first-child'?controlIcon:controlLabel;
    const document={hidden:false,documentElement:rootNode,fonts:{ready:Promise.resolve()},
      createElement(){return canvas;},
      getElementById(id){return id==='planetMotion'?control:id==='main'?main:null;},
      querySelectorAll(selector){return selector==='[data-planet-story]'?groups.map(item=>item.group):[];},
      querySelector(){return null;},
      addEventListener(name,callback){(documentEvents[name]??=[]).push(callback);}
    };
    const context={...math,document,innerWidth:width,innerHeight:height,scrollY:0,performance:{now:()=>state.now},
      getComputedStyle:node=>({top:groups.some(group=>group.stage===node)?(width<=640?'80px':'112px'):'0px',paddingTop:'64px',paddingBottom:'64px'}),
      matchMedia:query=>({matches:query.includes('prefers-reduced-motion')?reduced:width<=900,addEventListener(){}}),
      requestAnimationFrame(callback){const id=state.nextFrame++;frames.set(id,callback);return id;},cancelAnimationFrame(id){frames.delete(id);},
      addEventListener(name,callback){(windowEvents[name]??=[]).push(callback);},
      ResizeObserver:class{observe(){}},IntersectionObserver:class{observe(){}},MutationObserver:class{constructor(callback){this.callback=callback;}observe(target){mutations.push({target,callback:this.callback});}},
      createPlanet:async()=>{state.created++;return webgl?{render(angle,signal){state.renders.push({angle,signal,time:state.now});},lowerQuality(){},destroy(){}}:null;},
      queueMicrotask,console
    };
    // Read-only access to the production plan lets the harness select actual
    // slots, while expectations below assert timing and preservation contracts.
    vm.runInNewContext(source+'\nglobalThis.__testOrbitGroups=groups;',context,{filename:'integration.js'});
    const emit=(events,name,event={})=>(events[name]||[]).forEach(callback=>callback(event));
    async function flush(){
      let steps=0;
      await Promise.resolve();
      while(frames.size&&steps<150){
        const callbacks=[...frames.values()];frames.clear();state.now+=1000/60;
        for(const callback of callbacks)callback(state.now);
        await Promise.resolve();steps++;
      }
      check(!frames.size,'Production scheduler settles instead of spinning while idle');
      return steps;
    }
    return{state,groups,runtimeGroups:context.__testOrbitGroups,control,document,canvas,frames,flush,
      async scrollTo(y){state.scroll=context.scrollY=y;emit(windowEvents,'scroll');await flush();},
      async scrollFrame(y){
        state.scroll=context.scrollY=y;emit(windowEvents,'scroll');const callbacks=[...frames.values()];frames.clear();state.now+=1000/60;
        for(const callback of callbacks)callback(state.now);await Promise.resolve();
      },
      async pause(){emit(control.events,'click');await flush();},
      async hidden(value){document.hidden=value;emit(documentEvents,'visibilitychange');await flush();},
      async focus(unit){emit(documentEvents,'focusin',{target:unit});await flush();},
      async blur(unit){emit(documentEvents,'focusout',{target:unit});await flush();},
      async signals(count){const grid=groups[0].signalGrid;grid.pressed=count;for(const observer of mutations)if(observer.target===grid)observer.callback();await flush();},
      async animatedResize(steps=18){
        for(let index=0;index<steps;index++){
          emit(windowEvents,'resize');const callbacks=[...frames.values()];frames.clear();state.now+=1000/60;
          for(const callback of callbacks)callback(state.now);
          await Promise.resolve();
        }
        await flush();
      }
    };
  }

  const fragmentFor=(f,node)=>{
    for(const group of f.runtimeGroups)for(const chunk of group.chunks)for(const fragment of chunk.fragments)if(fragment.row.units.some(unit=>unit.element===node))return fragment;
    throw new Error('Fixture node is absent from the production chunk plan');
  };
  const chunkNodes=chunk=>chunk.rows.flatMap(row=>row.units.map(unit=>unit.element));
  const reading=nodes=>nodes.every(node=>node.dataset.orbitState==='reading'&&node.dataset.orbitProgress==='1.000');
  for(const width of [1440,390,320]){
    const height=width===320?568:width===390?844:900,f=fixture({width,height});await f.flush();
    check(f.state.created===0,'Planet resources are not initialized before a passage approaches');
    const unit=f.groups[0].units[0],slot=fragmentFor(f,unit);
    const points=[0,.25,.5,.75,1].map(p=>slot.start+p*(slot.end-slot.start));
    const poses=[];
    for(const y of points){await f.scrollTo(y);poses.push({p:Number(unit.dataset.orbitProgress),angle:Number(f.groups[0].group.dataset.orbitAngle),x:unit.style.getPropertyValue('--emerge-x'),typeLabel:f.groups[0].typeWords.textContent,typeOffset:f.groups[0].typeWords.getAttribute('startOffset'),typeOpacity:Number(f.groups[0].type.style.opacity)});}
    check(poses.every((pose,index)=>near(pose.p,index/4,.002)),`${width}px: production runtime exposes all five expected reveal phases`);
    check(poses.every((pose,index)=>index===0||pose.angle>poses[index-1].angle),`${width}px: production planet rotates forward with scroll`);
    for(const index of [1,2,3])check(poses[index].typeLabel===unit.heading.textContent,`${width}px: the sphere prints the original upcoming heading rather than invented copy`);
    check(Number(poses[1].typeOffset)<Number(poses[2].typeOffset)&&Number(poses[2].typeOffset)<Number(poses[3].typeOffset),`${width}px: printed words travel across the sphere as the HTML reveal advances`);
    check(near(Number(poses[2].typeOffset)-Number(poses[1].typeOffset),Number(poses[3].typeOffset)-Number(poses[2].typeOffset),.2),`${width}px: equal reveal-phase increments produce equal surface-text travel`);
    check(poses[1].typeOpacity>0&&poses[2].typeOpacity>poses[1].typeOpacity&&poses[3].typeOpacity<poses[2].typeOpacity,`${width}px: surface printing appears then fades as the original HTML unrolls`);
    for(let index=points.length-1;index>=0;index--){
      await f.scrollTo(points[index]);
      check(near(Number(unit.dataset.orbitProgress),poses[index].p,.002)&&near(Number(f.groups[0].group.dataset.orbitAngle),poses[index].angle,.00002),`${width}px: reverse scroll restores text phase and planet angle`);
      if(index>0&&index<4)check(f.groups[0].typeWords.getAttribute('startOffset')===poses[index].typeOffset&&near(Number(f.groups[0].type.style.opacity),poses[index].typeOpacity,.002),`${width}px: reverse scroll rewinds the printed heading and its fade with the same phase`);
    }
    const renderCount=f.state.renders.length;f.state.now+=10000;await f.flush();
    check(f.state.renders.length===renderCount,`${width}px: stationary page does not rotate or redraw on a clock`);
    await f.scrollTo(points[2]);await f.pause();
    const frozen=f.groups[0].group.dataset.orbitAngle;
    check(f.groups.every(group=>group.units.every(node=>node.dataset.orbitState==='reading'&&node.dataset.orbitProgress==='1.000')),`${width}px: pausing exposes every word`);
    check(f.groups[0].type.style.opacity==='0',`${width}px: pausing removes the duplicate decorative surface heading`);
    await f.scrollTo(points[3]);check(f.groups[0].group.dataset.orbitAngle===frozen,`${width}px: paused planet keeps its orientation while scrolling`);
    await f.pause();
    const target=f.groups[0].chapters[5];await f.scrollTo(target.offsetTop-112);
    check(f.groups[0].units.slice(0,11).every(node=>node.dataset.orbitState==='reading'),`${width}px: deep jump immediately exposes earlier and target content`);
    check(f.groups[0].title.textContent==='Group 1 chapter 6',`${width}px: direct chapter landing selects the correct chapter`);
    check(f.groups[0].type.style.opacity==='0',`${width}px: a fully delivered deep-linked chapter has no stale surface heading`);
    const second=f.groups[1].units[0];await f.scrollTo(second.offsetTop-height*.8);
    check(f.state.created===1&&f.canvas.parentElement===f.groups[1].surface,`${width}px: both passages reuse one renderer and canvas`);
    await f.scrollTo(points[1]);const waiting=f.groups[0].units[5];await f.focus(waiting);
    check(waiting.dataset.orbitState==='reading',`${width}px: keyboard focus makes a waiting control readable`);
    check(reading(chunkNodes(fragmentFor(f,waiting).row.chunk)),`${width}px: keyboard focus settles the whole coherent chunk`);
    await f.blur(waiting);await f.scrollTo(waiting.offsetTop+waiting.offsetHeight+200);
    const waitingSlot=fragmentFor(f,waiting);await f.scrollTo((waitingSlot.start+waitingSlot.end)/2);
    check(Number(waiting.dataset.orbitProgress)<1,`${width}px: a blurred offscreen control can rejoin the reversible story`);
    for(const selected of [1,3,0]){await f.signals(selected);check(near(f.state.renders.at(-1).signal,selected?selected/4:.5),`${width}px: keyboard-style signal attribute changes refresh the planet without a click`);}
    await f.hidden(true);const hiddenCount=f.state.renders.length;await f.scrollTo(points[4]);
    check(f.state.renders.length===hiddenCount,`${width}px: hidden document does not render`);
    await f.hidden(false);check(f.state.renders.length>hiddenCount,`${width}px: visible document refreshes the current state`);
    await f.scrollTo(15000);const outsideCount=f.state.renders.length;await f.flush();
    check(f.state.renders.length===outsideCount,`${width}px: renderer stops outside both passages`);
  }
  for(const width of [1440,390]){
    const height=width===390?844:900,f=fixture({width,height,paired:true});await f.flush();
    const [previous,left,right]=f.groups[0].units;
    const slot=fragmentFor(f,left);
    const visual=node=>{
      const transit=node.dataset.orbitState==='transit';
      const x=transit?parseFloat(node.style.getPropertyValue('--emerge-x')):0,y=transit?parseFloat(node.style.getPropertyValue('--emerge-y')):0,scale=transit?parseFloat(node.style.getPropertyValue('--emerge-scale')):1;
      return{left:node.offsetLeft+x,top:node.offsetTop-f.state.scroll+y,bottom:node.offsetTop-f.state.scroll+y+node.offsetHeight*scale,scale};
    };
    for(const phase of [.05,.1,.25,.5,.75,.95]){
      await f.scrollTo(slot.start+phase*(slot.end-slot.start));
      const a=visual(left),b=visual(right),preceding=visual(previous);
      check(left.dataset.orbitProgress===right.dataset.orbitProgress,`${width}px: paired columns share one row phase at ${phase}`);
      check(near(b.left-a.left,(right.offsetLeft-left.offsetLeft)*a.scale,.03),`${width}px: a row retains its column spacing while emerging`);
      check(near(b.top-a.top,(right.offsetTop-left.offsetTop)*a.scale,.03),`${width}px: small row offsets stay in one scaled coordinate system`);
      if(previous.dataset.orbitState!=='waiting')check(a.top>=preceding.bottom-.03,`${width}px: the next flight does not cross the preceding reading row`);
    }
    const reads=f.state.layoutReads;await f.animatedResize(18);const measures=(f.state.layoutReads-reads)/f.groups.length;
    check(measures>0&&measures<=6,`${width}px: an animated resize is coalesced into bounded geometry reads`);
    const count=f.state.renders.length;await f.flush();check(f.state.renders.length===count,`${width}px: pending resize measurement finishes without an idle loop`);
  }
  for(const width of [1440,390,320]){
    const height=width===320?568:width===390?844:900,f=fixture({width,height,rich:true,paired:width>360});await f.flush();
    for(let groupIndex=0;groupIndex<f.runtimeGroups.length;groupIndex++){
      const group=f.runtimeGroups[groupIndex];
      validatePlan(group.chunks,group.rows,{height,mobile:width<=640,readingTop:group.stickyTop+(width<=640?group.stageHeight:0),firstVisibleAt:group.top+group.padding+group.sphere.y+group.sphere.radius*(width<=640?.92:.24)-(height-24)},`${width}px runtime passage ${groupIndex+1}`);
      const initial=group.chunks[0],initialAngle=angleAt(initial.start,group.top,group.base,turnRate(height));
      const initialSource=surfacePoint(initialAngle,group.sphere,width<=640);
      check(group.top+group.padding+initialSource.y-initial.start<=height-24+1,`${width}px: the first serial slot waits for its actual surface emitter to be visible`);
      for(let chunkIndex=0;chunkIndex<group.chunks.length;chunkIndex++){
        const chunk=group.chunks[chunkIndex],nodes=chunkNodes(chunk);
        for(let part=0;part<chunk.fragments.length;part++){
          const fragment=chunk.fragments[part];await f.scrollTo((fragment.start+fragment.end)/2);
          check(fragment.row.units.every(unit=>near(Number(unit.element.dataset.orbitProgress),.5,.002)),`${width}px: each serial fragment has a visible intermediate turn`);
          const earlier=chunk.fragments.slice(0,part).flatMap(item=>item.row.units.map(unit=>unit.element));
          const later=chunk.fragments.slice(part+1).flatMap(item=>item.row.units.map(unit=>unit.element));
          check(reading(earlier)&&later.every(node=>node.dataset.orbitState==='waiting'),`${width}px: a chunk delivers previous fragments before launching the next`);
          if(part===0&&chunkIndex>0)check(reading(chunkNodes(group.chunks[chunkIndex-1])),`${width}px: the previous chunk remains fully delivered during the next emission`);
        }
        const firstException=chunkIndex===0&&chunk.end>chunk.top-.9*height+1;
        const readyAt=firstException?chunk.end+1:chunk.top-.9*height+1;
        for(const extra of [0,.15,.35,.55]){
          await f.scrollTo(readyAt+extra*height);
          check(reading(nodes),`${width}px: the whole ${firstException?'first visible':'early'} chunk stays readable through +${extra}H of scrolling`);
        }
      }
    }
    // Check the raw viewport deadline BEFORE smoothing is allowed to settle.
    // A single native-scroll frame crossing the completed angular boundary
    // must deliver the entire chunk and render its sphere at that same angle.
    const group=f.runtimeGroups[0],ordinary=group.chunks[1];
    for(const [before,after] of [[20,1],[20,50],[.01,1]]){
      await f.scrollTo(ordinary.end-before);
      check(!reading(chunkNodes(ordinary)),`${width}px: deadline regression begins with a genuinely unfinished chunk`);
      const drawn=f.state.renders.length;await f.scrollFrame(ordinary.end+after);
      check(reading(chunkNodes(ordinary)),`${width}px: a ${before}px-before to ${after}px-after deadline crossing delivers the whole chunk on its first frame`);
      check(f.state.renders.length>drawn,`${width}px: a completed raw deadline bypasses the normal frame-rate draw gate`);
      check(near(f.state.renders.at(-1).angle,Number(group.element.dataset.orbitAngle),.000006),`${width}px: a deadline catch-up keeps shader and HTML on the same angle`);
      await f.flush();
    }
    const interior=group.chunks[Math.floor(group.chunks.length/2)],last=group.chunks.at(-1);
    for(const chunk of [group.chunks[0],interior,last]){
      const fragment=chunk.fragments[0],y=fragment.start+(fragment.end-fragment.start)*.4;
      await f.scrollTo(y);const progress=fragment.row.units[0].element.dataset.orbitProgress,angle=group.element.dataset.orbitAngle;
      await f.scrollTo(chunk.end+height*.35);await f.scrollTo(y);
      check(fragment.row.units[0].element.dataset.orbitProgress===progress&&group.element.dataset.orbitAngle===angle,`${width}px: first/interior/last chunks rewind to the same phase and angle`);
    }
    // A late fragment must release its pin BEFORE any sibling row is posed.
    // Keep focus while scrolling past it, blur without another update, then
    // jump back past the chunk's launch in one frame. With row-local cleanup,
    // earlier siblings incorrectly stay pinned while the last row rewinds.
    const pinnedChunk=group.chunks.find(chunk=>chunk.rows.length>1);
    const late=pinnedChunk.rows.at(-1).units.at(-1).element;
    await f.scrollTo(pinnedChunk.end+1);await f.focus(late);
    check(reading(chunkNodes(pinnedChunk)),`${width}px: focusing the last fragment pins every sibling in its chunk`);
    await f.scrollTo(late.offsetTop+late.offsetHeight+height);await f.blur(late);
    const rewind=pinnedChunk.start-2;
    check(late.offsetTop>rewind+height,`${width}px: pin-release regression places the late fragment below the viewport`);
    await f.scrollFrame(rewind);
    check(pinnedChunk.pinned===false&&pinnedChunk.rows.every(row=>row.units.every(unit=>!unit.pinned)),`${width}px: the first reverse update clears the late offscreen pin for the whole chunk`);
    check(chunkNodes(pinnedChunk).every(node=>node.dataset.orbitState==='waiting'&&node.dataset.orbitProgress==='0.000'),`${width}px: no earlier sibling remains held after the late fragment releases`);
    check(f.frames.size===0,`${width}px: pin release is complete on the first resting update without a repair frame`);
    await f.flush();
  }
  const reduced=fixture({reduced:true});await reduced.flush();await reduced.scrollTo(600);const stillAngle=reduced.groups[0].group.dataset.orbitAngle;await reduced.scrollTo(1200);
  check(reduced.groups.every(group=>group.units.every(unit=>unit.dataset.orbitState==='reading')),'Reduced-motion startup leaves all original content readable');
  check(reduced.groups[0].group.dataset.orbitAngle===stillAngle,'Reduced-motion startup does not rotate the planet on scroll');
  const noGL=fixture({webgl:false});await noGL.flush();await noGL.scrollTo(300);await noGL.scrollTo(400);await noGL.scrollTo(500);
  check(noGL.state.created===1,'Unavailable WebGL is attempted once, without repeated initialization');
  check(noGL.groups[0].units[0].dataset.orbitState==='transit'||noGL.groups[0].units[0].dataset.orbitState==='reading','The HTML story continues when WebGL is unavailable');
  console.log(`${checks-failures.length}/${checks} production motion/math checks passed.`);
  console.log('Covered: early section-local reading chunks, serial fragment slots, first-visible minimum turns, raw-frame deadlines and reading holds, forward/reverse sync, source printing, paired geometry, guarded lanes, keyboard chunk settling/signals, bounded resize measurement, pause, reduced motion, deep jumps, shared rendering, idle/hidden/offscreen behavior, and unavailable WebGL at desktop, 390px and 320px.');
  console.log('The fake-document harness tests production JS state changes; visual composition and native interactions still require browser QA.');
  if(failures.length){for(const message of failures)console.error('FAIL: '+message);process.exitCode=1;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
