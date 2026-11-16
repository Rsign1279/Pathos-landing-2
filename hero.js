/* The original marble film, deferred until the first paint and played only
   while visible. A matching poster is the reduced-motion and loading state. */
const hero = document.getElementById('hero');
const video = document.getElementById('heroVideo');

if (hero && video) {
  const tall = matchMedia('(max-aspect-ratio: 4/5)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const sources = { land: 'assets/hero/hero.mp4', port: 'assets/hero/hero-portrait.mp4' };
  const posters = { land: 'assets/hero/hero-poster.webp', port: 'assets/hero/hero-poster-portrait.webp' };
  let kind = '', loadedKind = '', painted = false, onScreen = false;
  let pending = false, blocked = false, attempt = 0, retryTimer = 0, retries = 0;
  let retryButton;

  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';

  const eligible = () => painted && onScreen && !document.hidden && !reduced.matches;
  const clearRetry = () => { clearTimeout(retryTimer); retryTimer = 0; };
  const pause = () => {
    clearRetry();
    attempt++;
    pending = false;
    video.pause();
  };
  const showRetry = () => {
    blocked = true;
    clearRetry();
    video.style.visibility = 'hidden';
    if (!retryButton) {
      retryButton = document.createElement('button');
      retryButton.type = 'button';
      retryButton.className = 'hero-film-retry';
      retryButton.textContent = 'Play background film';
      retryButton.setAttribute('aria-controls', video.id);
      retryButton.style.cssText = 'position:absolute;z-index:3;right:24px;top:96px;padding:8px 12px;border:1px solid #d2af70;border-radius:8px;background:#131209;color:#f3e9e1;font-size:14px;min-height:44px;';
      retryButton.addEventListener('click', () => {
        blocked = false;
        retries = 0;
        if (video.error) loadedKind = '';
        retryButton.hidden = true;
        video.style.visibility = '';
        tryPlay();
      });
      hero.append(retryButton);
    }
    pause();
    retryButton.hidden = !eligible();
  };
  const scheduleRetry = () => {
    if (!eligible() || blocked || retryTimer || retries >= 3) return;
    retryTimer = setTimeout(() => {
      retryTimer = 0;
      if (!eligible() || blocked) return;
      retries++;
      tryPlay();
      if (video.paused || video.readyState < 3) scheduleRetry();
    }, 1500);
  };
  const tryPlay = () => {
    if (!eligible() || blocked || pending) return;
    if (loadedKind !== kind) {
      loadedKind = kind;
      video.src = sources[kind];
      video.load();
    }
    const currentAttempt = ++attempt;
    pending = true;
    Promise.resolve(video.play()).then(() => {
      if (currentAttempt !== attempt) return;
      pending = false;
      if (!eligible()) pause();
    }).catch(error => {
      if (currentAttempt !== attempt) return;
      pending = false;
      if (!eligible()) return;
      if (error.name === 'AbortError') scheduleRetry();
      else showRetry();
    });
  };
  const update = () => {
    video.style.visibility = reduced.matches || blocked ? 'hidden' : '';
    if (retryButton) retryButton.hidden = !blocked || !eligible();
    if (eligible()) tryPlay();
    else pause();
  };
  const pick = () => {
    const next = tall.matches ? 'port' : 'land';
    if (next !== kind) {
      pause();
      kind = next;
      video.poster = posters[kind];
    }
    update();
  };

  pick();
  tall.addEventListener ? tall.addEventListener('change', pick) : tall.addListener(pick);
  reduced.addEventListener ? reduced.addEventListener('change', update) : reduced.addListener(update);
  new IntersectionObserver(entries => {
    onScreen = entries[entries.length - 1].isIntersecting;
    update();
  }, { threshold: 0.02 }).observe(hero);
  document.addEventListener('visibilitychange', update);
  video.addEventListener('canplay', tryPlay);
  video.addEventListener('playing', () => {
    retries = 0;
    clearRetry();
    if (eligible()) video.style.visibility = '';
  });
  video.addEventListener('timeupdate', () => { retries = 0; clearRetry(); });
  video.addEventListener('waiting', scheduleRetry);
  video.addEventListener('stalled', scheduleRetry);
  video.addEventListener('pause', scheduleRetry);
  video.addEventListener('error', () => { if (eligible()) showRetry(); });

  // Nested frames let the still, heading and primary action paint first.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    painted = true;
    update();
  }));
}
