#!/usr/bin/env node
// Zero-dependency source/integration audit. Browser behavior is verified separately.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gzipSync } = require('node:zlib');
const root = path.resolve(__dirname, '..');
const pages = ['index.html', 'hardware.html', 'privacy.html', '404.html'];
const scripts = ['experience.js', 'planet.js', 'contact.js', 'hardware-launch.js', 'prototype.js'];
const issues = [];
let checks = 0;
function check(condition, message) { checks++; if (!condition) issues.push(message); }
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = Object.fromEntries(pages.map(file => [file, read(file)]));
const ids = Object.fromEntries(pages.map(file => [file, [...html[file].matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1])]));
const attr = (tag, name) => new RegExp(`(?:^|\\s)${name}=["']([^"']*)["']`, 'i').exec(tag)?.[1];
const decode = text => text.replace(/&amp;/g, '&');
function localTarget(source, raw) {
  if (!raw || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(raw)) return null;
  const [pathname, fragment] = decode(raw).split('#');
  const withoutQuery = pathname.split('?')[0];
  let file = withoutQuery ? path.resolve(root, path.dirname(source), decodeURIComponent(withoutQuery)) : path.join(root, source);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  return { file, fragment: fragment && decodeURIComponent(fragment) };
}
function verifyReference(source, raw) {
  const target = localTarget(source, raw);
  if (!target) return;
  check(target.file.startsWith(root + path.sep), `${source}: reference escapes checkout: ${raw}`);
  check(fs.existsSync(target.file), `${source}: missing local reference ${raw}`);
  if (target.fragment && fs.existsSync(target.file) && /\.html$/.test(target.file)) {
    const targetPage = path.relative(root, target.file).replaceAll(path.sep, '/');
    const targetIds = ids[targetPage] || [...fs.readFileSync(target.file, 'utf8').matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]);
    check(targetIds.includes(target.fragment), `${source}: broken fragment ${raw}`);
  }
}
for (const page of pages) {
  const source = html[page];
  check(new Set(ids[page]).size === ids[page].length, `${page}: duplicate IDs`);
  check((source.match(/<h1\b/gi) || []).length === 1, `${page}: must have one h1`);
  check(/<html\s+lang=["']en["']/i.test(source), `${page}: language missing`);
  check(/name=["']viewport["']/i.test(source), `${page}: viewport missing`);
  check(/<a\b[^>]*href=["']#main["'][^>]*>\s*Skip to content\s*<\/a>/.test(source), `${page}: skip link missing`);
  check(!/fonts\.(?:googleapis|gstatic)\.com/.test(source), `${page}: remote fonts reintroduced`);
  for (const match of source.matchAll(/<(?:a|link|script|img|video|source|button)\b[^>]*>/gi)) {
    const tag = match[0];
    for (const name of ['href','src','poster','data-src','data-photo']) {
      const value = attr(tag, name);
      if (value) verifyReference(page, value);
    }
    for (const name of ['aria-controls','aria-labelledby','aria-describedby']) {
      const value = attr(tag, name);
      if (value) for (const id of value.split(/\s+/)) check(ids[page].includes(id), `${page}: ${name} points to absent #${id}`);
    }
    if (/^<img\b/i.test(tag)) check(attr(tag, 'alt') !== undefined, `${page}: image missing alt attribute`);
    if (/^<a\b/i.test(tag) && attr(tag, 'target') === '_blank') check(/\bnoopener\b/.test(attr(tag, 'rel') || ''), `${page}: external new tab lacks noopener`);
  }
}
const main = html['index.html'];
const css = read('experience.css');
const experience = read('experience.js');
const planet = read('planet.js');
const prototype = read('prototype.js');
const contact = read('contact.js');
const moduleSources = [...main.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].map(m => m[1]);
const sheets = [...main.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/g)].map(m => attr(m[0], 'href'));
check(moduleSources.length === 1 && moduleSources[0] === 'experience.js', 'Main page must load only its current entry module');
check(sheets.length === 1 && sheets[0] === 'experience.css', 'Main page must use the consolidated visual system');
check(!/import\s*\(?["'][^"']*(?:three|prototype|hero\.js|field\.js|play\.js|story\.js)/.test(experience + planet + contact), 'Main entry graph eagerly imports legacy/heavy rendering code');
const videos = [...main.matchAll(/<video\b[^>]*>/gi)].map(m => m[0]);
check(videos.length === 1, 'Expected one on-demand project film');
for (const tag of videos) {
  check(attr(tag, 'preload') === 'none', 'Main video must not eagerly preload');
  check(!/\bautoplay\b/.test(tag), 'Main video must not autoplay');
}
check(/<source\b[^>]*\bsrc=["']assets\/film\/film-1080\.mp4["']/.test(main), 'Film needs a real source for no-JavaScript controls');
check(!/\.glb\b|assets\/hw-seq\//.test(main), 'Main document must not request hardware models or frame sequences');
check(/<noscript>[^]*?\.desktop-nav\{display:flex/.test(main), 'No-JavaScript mobile navigation is unavailable');
check(/<form\b[^>]*action=["']https:\/\/formsubmit\.co\/rsignsv1279@gmail\.com["']/.test(main), 'No-JavaScript contact action missing');
check(!/<form\b[^>]*\bnovalidate\b/.test(main), 'Native validation must remain available without JavaScript');
check(/String\(result\.success\)\s*!==\s*'true'/.test(contact), 'Contact must require a confirmed service success');
check(/controller\.abort\(\)/.test(contact), 'Contact network timeout missing');
check(/Illustrative signals, not measurements/.test(main), 'Signal illustration disclosure missing');
check(/Not yet validated on PATHOS hardware/.test(main), 'Research/hardware limitation missing');
check(/Body sensors are in development/.test(main), 'Current versus planned hardware status missing');
check(/PATHOS \/ The hardware concept/.test(main), 'Rendered study must be labeled as a concept');
check(/Not a retail price/.test(main), 'Parts budget must not imply retail pricing');
check(/Not a medical device; does not diagnose/.test(main), 'Wellness limitation missing');
check(/if\(!paused&&planet\)requestTick\(\)/.test(experience), 'Unavailable planet renderer must not sustain an idle RAF loop');
check(/document\.hidden/.test(experience) && /IntersectionObserver/.test(experience), 'Ambient renderer must respect tab and viewport visibility');
check(/removeEventListener\('webglcontextlost',onLost\)/.test(planet) && /removeEventListener\('webglcontextrestored',onRestored\)/.test(planet), 'Planet context handlers must clean up on reinitialization');
for (const m of planet.matchAll(/smoothstep\(\s*([-.\d]+)\s*,\s*([-.\d]+)\s*,/g)) check(Number(m[1]) < Number(m[2]), `Invalid reversed smoothstep edges: ${m[0]}`);
const cacheLimit = Number(/SEQ_CACHE_LIMIT\s*=\s*(\d+)/.exec(prototype)?.[1]);
const concurrency = Number(/SEQ_CONCURRENCY\s*=\s*(\d+)/.exec(prototype)?.[1]);
check(cacheLimit > 0 && cacheLimit <= 24, 'Decoded hardware frame cache must be bounded to <=24');
check(concurrency > 0 && concurrency <= 3, 'Hardware frame loading must be bounded to <=3 requests');
check(/while\s*\(seqImgs\.size\s*>\s*SEQ_CACHE_LIMIT\)/.test(prototype) && /\.close\?\.\(\)/.test(prototype), 'Evicted decoded frame resources must be released');
check(!/requestIdleCallback|setTimeout\(start,\s*1500/.test(prototype), 'Hardware must not restart unconditional idle loading');
for (const file of scripts) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  check(result.status === 0, `${file}: JavaScript syntax failure: ${result.stderr}`);
}
for (const match of css.matchAll(/url\(["']?([^\s)'";]+)["']?\)/g)) verifyReference('experience.css', match[1]);
for (const file of ['assets/fonts/figtree-latin-variable.woff2','assets/fonts/eb-garamond-latin-400.woff2']) {
  const font = fs.readFileSync(path.join(root, file));
  check(font.subarray(0,4).toString() === 'wOF2', `${file}: invalid WOFF2 signature`);
}
const entryAssets = ['index.html','experience.css','experience.js','planet.js','contact.js','assets/marble-sm.webp','assets/fonts/figtree-latin-variable.woff2','assets/fonts/eb-garamond-latin-400.woff2','favicon.ico','apple-touch-icon.png'];
const rawBytes = entryAssets.reduce((sum,file) => sum + fs.statSync(path.join(root,file)).size,0);
const compressedBytes = entryAssets.reduce((sum,file) => { const bytes = fs.readFileSync(path.join(root,file)); return sum + (/\.(?:js|css|html)$/.test(file) ? gzipSync(bytes).length : bytes.length); },0);
check(rawBytes < 350 * 1024, `Core first-view assets exceeded 350 KiB source budget: ${rawBytes}`);
console.log(`${checks - issues.length}/${checks} source/integration checks passed.`);
console.log(`Core first-view asset set: ${(rawBytes/1024).toFixed(1)} KiB raw; ${(compressedBytes/1024).toFixed(1)} KiB with gzip for text.`);
console.log('This is a source budget, not a measured browser transfer, frame rate, or Lighthouse score.');
if (issues.length) { for (const issue of issues) console.error(`FAIL: ${issue}`); process.exitCode = 1; }
