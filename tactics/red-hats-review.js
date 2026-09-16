import {RED_HAT_SPECIES,ARMED_WEAPONS,CHARACTER_STANCES,redHatArt} from './red-hats-art.js';
import {characterArt} from './character-art.js';
import {EXPANSION_WEAPON_LABELS} from './weapon-expansion-art.js';
const $=id=>document.getElementById(id),labels={hands:'Unarmed',knife:'NR-40 knife',pistol:'TT-33 pistol',rifle:'Mosin-Nagant',assault:'AK-47',...EXPANSION_WEAPON_LABELS};
for(const [weapon,label] of Object.entries(EXPANSION_WEAPON_LABELS))$('weapon').add(new Option(label,weapon));
for(const s of RED_HAT_SPECIES)$('species').add(new Option(s.replaceAll('-',' '),s));
const requested=new URLSearchParams(location.search).get('species');if(RED_HAT_SPECIES.includes(requested))$('species').value=requested;
function render(){
 const cards=[];
 for(const species of RED_HAT_SPECIES.filter(s=>$('species').value==='all'||$('species').value===s))
 for(const stance of CHARACTER_STANCES.filter(s=>$('stance').value==='all'||$('stance').value===s))
 for(const weapon of ['hands',...ARMED_WEAPONS,...Object.keys(EXPANSION_WEAPON_LABELS)].filter(w=>$('weapon').value==='all'||$('weapon').value===w)){
  const frame=redHatArt(species,weapon,stance);if(!frame)continue;
  cards.push(`<figure><h2>${species.replaceAll('-',' ')}</h2><div class="pair"><img class="original" src="${characterArt(species,weapon,'idle',stance).src}" alt="${species} original outfit"><img src="${frame.src}" alt="${species} Red Hats ${labels[weapon]} ${stance}"></div><figcaption>${labels[weapon]} · ${stance}</figcaption></figure>`);
 }
 $('gallery').innerHTML=cards.join('')||'<p>No unarmed pose is available for this selection. Choose a weapon to see all three stances.</p>';
}
for(const id of ['species','stance','weapon'])$(id).onchange=render;
for(const id of ['compare','mirror'])$(id).onchange=e=>$('gallery').classList.toggle(id,e.target.checked);
$('scale').onchange=e=>$('gallery').classList.toggle('small',e.target.value==='small');
render();
