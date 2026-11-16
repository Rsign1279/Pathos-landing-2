// Sphere and copy share one angular coordinate. No clocks or entrance timers:
// moving back through an angle also winds its content back in.
export const clamp = value => Math.min(1, Math.max(0, value));
export const turnRate = height => Math.PI * 2 / (Math.max(480, height) * 2.4);
export const angleAt = (scroll, top, base, rate) => base + (scroll - top) * rate;
export const revealAt = (angle, start, end) => clamp((angle - start) / Math.max(.0001, end - start));

// Prepare a whole reading group before it reaches the reading area. Existing
// row cohorts are its sequential fragments; their geometry never changes.
export function planReadingChunks(rows,{height,mobile,readingTop,firstVisibleAt=-Infinity}) {
  const budget=Math.max(160,height-readingTop-24)*.8;
  const chunks=[];
  for(const row of rows){
    let chunk=chunks.at(-1);
    const introPair=chunk&&chunk.rows.length===1&&chunk.intro;
    const differentSection=!chunk||row.chapter!==chunk.chapter;
    if(differentSection||(!introPair&&(chunk.rows.length>=3||row.bottom-chunk.top>budget))){
      const intro=differentSection;
      chunk={top:row.top,bottom:row.bottom,chapter:row.chapter,intro,rows:[]};chunks.push(chunk);
    }
    chunk.rows.push(row);chunk.bottom=Math.max(chunk.bottom,row.bottom);
  }
  let previousEnd=-Infinity;
  for(let index=0;index<chunks.length;index++){
    const chunk=chunks[index];
    const desiredStart=chunk.top-height*(mobile?1.30:1.34);
    const desiredEnd=chunk.top-height*(mobile?.90:.92);
    chunk.start=Math.max(desiredStart,previousEnd,index===0?firstVisibleAt:-Infinity);
    // The first emission waits until the surface is visible. Its heading and
    // first body row still get a distinct, readable turn on short viewports.
    const firstSpan=index===0?chunk.rows.length*(mobile?64:80):1;
    chunk.end=Math.max(desiredEnd,chunk.start+firstSpan);
    chunk.oversize=chunk.bottom-chunk.top>budget;
    const slot=(chunk.end-chunk.start)/chunk.rows.length;
    chunk.fragments=chunk.rows.map((row,part)=>({row,start:chunk.start+slot*part,end:chunk.start+slot*(part+1)}));
    previousEnd=chunk.end;
  }
  return chunks;
}
export function surfacePoint(angle, {x, y, radius}, mobile) {
  const latitude = Math.sin(angle * .72) * .24;
  return mobile
    ? {x: x + latitude * radius, y: y + Math.sqrt(1 - latitude * latitude) * radius * .91}
    : {x: x + Math.sqrt(1 - latitude * latitude) * radius * .72, y: y + latitude * radius};
}
export function emergePose(progress, fromX, fromY, mobile) {
  const p = clamp(progress), eased = p * p * (3 - 2 * p);
  const remaining = 1 - eased, arc = Math.sin(p * Math.PI);
  return {
    x: fromX * remaining + arc * (mobile ? 22 : 36),
    y: fromY * remaining - arc * (mobile ? 12 : 38),
    scale: .48 + .52 * eased,
    turn: (mobile ? 12 : -38) * remaining,
    roll: (mobile ? -5 : -7) * remaining,
    opacity: clamp(p / .22),
    trail: arc * remaining * 2.2
  };
}
