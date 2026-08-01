(function () {
  const KEY = 'portfolio-theme';
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  // Read saved preference, fallback to dark
  function getTheme() {
    return localStorage.getItem(KEY) || 'dark';
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
