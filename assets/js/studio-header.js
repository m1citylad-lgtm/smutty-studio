(function(){'use strict';
const toggle=document.getElementById('sbs-more'),menu=document.getElementById('sbs-more-sections');if(!toggle||!menu)return;
function close(focus=false){menu.hidden=true;toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus();}
toggle.addEventListener('click',()=>{menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));});
toggle.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();menu.hidden=false;toggle.setAttribute('aria-expanded','true');menu.querySelector('button').focus();}});
document.addEventListener('click',e=>{if(!e.target.closest('.sbs-more-wrap'))close();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){e.preventDefault();close(true);}if(!menu.hidden&&menu.contains(e.target)&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const items=Array.from(menu.querySelectorAll('button')),i=items.indexOf(document.activeElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}});
document.querySelectorAll('[data-primary-tab]').forEach(b=>b.addEventListener('click',()=>{const inMenu=menu.contains(b);toggle.classList.toggle('active',inMenu);toggle.setAttribute('aria-label','More Studio sections'+(inMenu?' — current: '+b.textContent.trim():''));close(inMenu);try{sessionStorage.setItem('sbs-current-section',b.dataset.primaryTab);}catch(e){}}));
const info=document.getElementById('sbs-header-info');if(info)info.onclick=()=>document.getElementById('sbs-guide-open').click();
// Existing Studio handlers own navigation, permissions and panel state.
document.addEventListener('DOMContentLoaded',()=>{try{const saved=sessionStorage.getItem('sbs-current-section');if(saved&&document.getElementById('sbs-app').dataset.openSettings!=='1'){const b=Array.from(document.querySelectorAll('[data-primary-tab]')).find(b=>b.dataset.primaryTab===saved);if(b)b.click();}}catch(e){} });
})();
