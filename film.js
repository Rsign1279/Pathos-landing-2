/* The original PATHOS film. Its poster loads first; video preparation begins
   near the viewport. Native controls remain available, including when a
   browser blocks autoplay or the visitor prefers reduced motion. */
const stage = document.getElementById('filmStage');
const video = document.getElementById('filmVideo');
const bar = document.getElementById('filmScrub');

if (stage && video) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let onScreen = false, near = false, prepared = false, userPaused = false;
  let internalPause = false, blocked = false, pending = false, attempt = 0;
  let frame = 0, videoFrame = false, retryTimer = 0, retries = 0;

  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.controls = true;
  video.preload = 'none';
  video.setAttribute('aria-label', 'Pathos IoT in 44 seconds');

  const eligible = () => prepared && onScreen && !document.hidden && !reduced.matches && !userPaused && !blocked;
  const clearRetry = () => { clearTimeout(retryTimer); retryTimer = 0; };
  const drawBar = () => {
    if (bar && Number.isFinite(video.duration) && video.duration > 0) {
      bar.style.transform = `scaleX(${Math.min(1, video.currentTime / video.duration).toFixed(4)})`;
    }
  };
  const stopDraw = () => {
    if (!frame) return;
    if (videoFrame) video.cancelVideoFrameCallback(frame);
    else cancelAnimationFrame(frame);
    frame = 0;
  };
  const draw = () => {
    frame = 0;
    drawBar();
    if (video.paused || !onScreen || document.hidden) return;
    videoFrame = typeof video.requestVideoFrameCallback === 'function';
    frame = videoFrame ? video.requestVideoFrameCallback(draw) : requestAnimationFrame(draw);
  };
  const pause = () => {
    clearRetry();
    stopDraw();
    attempt++;
    pending = false;
    if (!video.paused) {
      internalPause = true;
      video.pause();
    }
  };
  const scheduleRetry = () => {
    if (!eligible() || retryTimer || retries >= 3) return;
    retryTimer = setTimeout(() => {
      retryTimer = 0;
      if (!eligible()) return;
      retries++;
      tryPlay();
      if (video.paused || video.readyState < 3) scheduleRetry();
    }, 1500);
  };
  const tryPlay = () => {
    if (!eligible() || pending) return;
    const currentAttempt = ++attempt;
    pending = true;
    Promise.resolve(video.play()).then(() => {
      if (currentAttempt !== attempt) return;
      pending = false;
      if (!onScreen || document.hidden || reduced.matches) pause();
    }).catch(error => {
      if (currentAttempt !== attempt) return;
      pending = false;
      if (!eligible()) return;
      if (error.name === 'AbortError') scheduleRetry();
      else { blocked = true; clearRetry(); }
      // The native play control is a usable fallback; do not retry policy
      // rejections continuously or override a visitor's deliberate pause.
    });
  };
  const prepare = () => {
    if (prepared || !near || document.hidden) return;
    prepared = true;
    if (!reduced.matches) {
      video.preload = 'metadata';
      video.load();
    }
  };
  const update = () => {
    prepare();
    if (!onScreen || document.hidden || reduced.matches) pause();
    else tryPlay();
  };

  new IntersectionObserver((entries, observer) => {
    near = entries[entries.length - 1].isIntersecting;
    prepare();
    if (prepared) observer.disconnect();
  }, { rootMargin: '200px 0px' }).observe(stage);
  new IntersectionObserver(entries => {
    onScreen = entries[entries.length - 1].isIntersecting;
    if (onScreen) near = true;
    update();
  }, { threshold: 0.15 }).observe(stage);
  document.addEventListener('visibilitychange', update);
  reduced.addEventListener ? reduced.addEventListener('change', update) : reduced.addListener(update);
  video.addEventListener('play', () => {
    userPaused = false;
    blocked = false;
    prepared = true;
    if (!onScreen || document.hidden) pause();
  });
  video.addEventListener('playing', () => {
    retries = 0;
    clearRetry();
    if (!frame) draw();
  });
  video.addEventListener('pause', () => {
    clearRetry();
    stopDraw();
    if (internalPause) internalPause = false;
    else if (onScreen && !document.hidden) userPaused = true;
  });
  video.addEventListener('canplay', tryPlay);
  video.addEventListener('waiting', scheduleRetry);
  video.addEventListener('stalled', scheduleRetry);
  video.addEventListener('timeupdate', () => { retries = 0; clearRetry(); drawBar(); });
  video.addEventListener('seeked', drawBar);
  video.addEventListener('loadedmetadata', drawBar);
  video.addEventListener('error', () => { blocked = true; clearRetry(); stopDraw(); });
}
