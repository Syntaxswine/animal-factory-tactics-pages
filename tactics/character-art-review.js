import {CHARACTER_SPECIES,CHARACTER_STANCES,characterArt} from './character-art.js';
const weapons=[['hands','Hand to hand · default'],['knife','NR-40 knife'],['pistol','TT-33 pistol'],['rifle','Mosin-Nagant'],['assault','AK-47']];
const gallery=document.querySelector('#gallery'),species=document.querySelector('#species');
for(const name of CHARACTER_SPECIES)species.add(new Option(name.replaceAll('-',' '),name));
const requested=new URLSearchParams(location.search).get('species');if(CHARACTER_SPECIES.includes(requested))species.value=requested;
const stance=document.querySelector('#stance');
function render(){gallery.innerHTML=CHARACTER_SPECIES.filter(s=>species.value==='all'||species.value===s).map(s=>CHARACTER_STANCES.filter(t=>stance.value==='all'||stance.value===t).map(t=>`<section><h2>${s.replaceAll('-',' ')} · ${t}</h2><div class="row">${weapons.map(([w,label])=>`<figure><div class="stage"><img src="${characterArt(s,w,'idle',t).src}" alt="${s} — ${label} — ${t}"></div><figcaption>${label}</figcaption></figure>`).join('')}</div></section>`).join('')).join('');}
stance.onchange=render;
species.onchange=render;document.querySelector('#scale').onchange=e=>gallery.classList.toggle('small',e.target.value==='small');document.querySelector('#mirror').onchange=e=>gallery.classList.toggle('mirror',e.target.checked);render();
