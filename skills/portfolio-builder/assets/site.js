const filters = [...document.querySelectorAll('[data-filter]')];
const projects = [...document.querySelectorAll('.project')];
const search = document.getElementById('project-search');
let category = 'all';
function updateGallery() {
  const query = search.value.trim().toLocaleLowerCase();
  let visible = 0;
  for (const project of projects) {
    project.hidden = !(category === 'all' || project.dataset.categories.split(' ').includes(category)) || !project.dataset.search.includes(query);
    if (!project.hidden) visible++;
  }
  document.getElementById('visible-count').textContent = `${visible} 个作品`;
  document.getElementById('empty-state').hidden = visible !== 0;
  document.querySelector('.collection-heading').hidden = !projects.slice(1).some(p => !p.hidden);
}
for (const button of filters) button.addEventListener('click', () => {
  category = button.dataset.filter;
  for (const filter of filters) { const active = filter === button; filter.classList.toggle('active', active); filter.setAttribute('aria-pressed', String(active)); }
  updateGallery();
});
search.addEventListener('input', updateGallery);
