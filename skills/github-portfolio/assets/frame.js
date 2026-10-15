document.addEventListener('click',event=>{
 const link=event.target.closest('a[href]');
 if(!link)return;
 if(link.getAttribute('href').startsWith('#'))return;
 link.target='_blank';link.rel='noopener';
});
