// The hardware study is a separate, explicitly requested load.
document.documentElement.classList.add('js');
import('./prototype.js').catch(error => {
  document.documentElement.classList.remove('js', 'hw-js');
  const status = document.getElementById('hwStatus');
  status.textContent = 'The interactive study could not load. The still and prototype photographs remain available.';
  status.hidden = false;
  console.warn('PATHOS hardware study:', error.message);
});
