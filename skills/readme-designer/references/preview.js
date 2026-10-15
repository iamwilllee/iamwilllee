const button = document.getElementById('theme');
button.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  button.textContent = dark ? '切换浅色' : '切换深色';
  button.setAttribute('aria-pressed', String(dark));
});
for (const link of document.querySelectorAll('.markdown-body a[href^="#"]')) link.addEventListener('click', event => {
  const hash = decodeURIComponent(link.getAttribute('href').slice(1));
  const target = document.getElementById(hash) || document.getElementById(`user-content-${hash}`);
  if (target) { event.preventDefault(); target.scrollIntoView(); history.replaceState(null, '', `#${encodeURIComponent(hash)}`); }
});
