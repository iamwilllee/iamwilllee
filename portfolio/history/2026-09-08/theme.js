(function () {
  const KEY = 'portfolio-theme';
  const btn = document.getElementById('themeToggle');
  const year = document.getElementById('currentYear');

  if (year) year.textContent = String(new Date().getFullYear());
  if (!btn) return;

  // Read saved preference, falling back to the current design's palette
  function getTheme() {
    return localStorage.getItem(KEY) || document.documentElement.getAttribute('data-theme') || 'light';
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
  }

  // Init
  apply(getTheme());

  // Toggle on click
  btn.addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(next);
  });
})();
