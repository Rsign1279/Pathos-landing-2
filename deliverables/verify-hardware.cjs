// Allocation policy and quality regressions; actual rendering is browser QA.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const ctx=vm.createContext({});
vm.runInContext(read('hardware-quality.js').replace(/export /g,'')+'\nglobalThis.policy=hardwareResolution;globalThis.budget=HARDWARE_PIXEL_BUDGET;',ctx);
let checks=0;const test=(value,message)=>{checks++;assert(value,message);};
for(const [w,h,dpr] of [[1320,720,1],[1320,720,2],[350,704,3],[390,650,3],[320,600,3],[768,900,2]]){
 const size=ctx.policy(w,h,dpr);
 test(size.ratio>=dpr,`${w}px: native DPR retained or supersampled`);
 const pictureWidth=Math.min(w,h*16/9),pictureHeight=pictureWidth*9/16;
 test(pictureWidth*size.ratio>=1919.99&&pictureHeight*size.ratio>=1079.99,`${w}px: actual film is Full HD even inside a portrait view`);
}
test(ctx.policy(1280,720,1).width===1920&&ctx.policy(1280,720,1).height===1080,'A 720p 1× view actually renders 1920 × 1080');
test(ctx.policy(960,540,1).width===1920&&ctx.policy(960,540,1).height===1080,'Small desktop view keeps a real Full HD render');
test(ctx.policy(1920,1080,2).width===3840&&ctx.policy(1920,1080,2).height===2160,'Retina Full HD view retains native 4K detail within budget');
for(const [w,h,dpr,limit] of [[1320,2000,4,8192],[1320,720,8,8192],[1320,720,3,2048],[8192,8192,2,8192]]){
 const size=ctx.policy(w,h,dpr,limit);test(size.width*size.height<=ctx.budget,'Extreme viewport buffers stay bounded');test(size.width<=limit&&size.height<=limit,'Respect the hardware renderbuffer limit');
}
const portrait=ctx.policy(320,900,3,8192,400,225);
test(portrait.ratio*400>=1919.99&&portrait.ratio*225>=1079.99,'Explicit virtual film dimensions retain Full HD on a tall phone');
test(portrait.width*portrait.height<=ctx.budget,'Tall phone Full HD film remains within allocation budget');
const source=read('prototype.js');
test(source.includes("const MODEL = './assets/pathos-hardware.glb'"),'Every device receives original geometry');
test(source.includes("const MARBLE = './assets/marble.webp'")&&source.includes("const SHOT = ''"),'Every device receives original texture sources');
test(source.includes('window.__hwSequence === true'),'Compressed sequence is opt-in only');
test(!source.includes('cap * quality')&&!/quality\s*(?:-=|\*=|=\s*Math\.max)/.test(source),'Slow frames cannot progressively lower resolution');
test(source.includes('renderer.shadowMap.autoUpdate = false')&&source.includes('renderer.shadowMap.needsUpdate = true'),'Full-resolution shadows are cached and pose changes invalidate them');
test(source.includes('if (frame !== appliedFrame)'),'Unchanged poses avoid animation evaluation');
test(source.includes('room.dispose()')&&source.includes('pmrem.dispose()')&&source.includes('draco.setWorkerLimit(2)'),'Environment scratch resources and decode concurrency are bounded');
test(source.includes('await renderer.compileAsync(scene, camera)'),'Shader compilation can run asynchronously');
test(source.includes('if (!visible || document.hidden) return;'),'Offscreen or background hardware cannot keep rendering');
test(source.includes('renderer.setSize(1, 1, false)')&&source.includes('if (!renderWidth && !document.hidden) resize()'),'Invisible study releases large draw buffers and restores them before display');
test(read('prototype-loader.js').includes("rootMargin:'100% 0px'"),'Model preparation begins one viewport ahead');
test(source.includes("PATHOS dashboard • inset rounded window")&&source.includes('PATHOS_ROOT__static'),'Original model lookup names survive');
test(source.includes('maxRenderDimension, film.w, film.h'),'Allocation uses actual Blender picture dimensions rather than the whole viewport');
test(source.includes('planned.ratio / native < 1.5'),'Sufficient supersampling avoids stacking an additional MSAA buffer');
console.log(`${checks}/${checks} hardware resolution, resource and playback policy checks passed.`);
