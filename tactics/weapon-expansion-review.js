import {WEAPON_EXPANSION_FRAMES} from './weapon-expansion-frames.js';
import {EXPANSION_WEAPON_LABELS} from './weapon-expansion-art.js';
const $=id=>document.getElementById(id);
for(const species of new Set(WEAPON_EXPANSION_FRAMES.map(f=>f.species)))$('species').add(new Option(species.replaceAll('-',' '),species));
for(const [weapon,label] of Object.entries(EXPANSION_WEAPON_LABELS))$('weapon').add(new Option(label,weapon));
const filters=['species','outfit','weapon','stance'],query=new URLSearchParams(location.search);
for(const id of filters)if([...$(id).options].some(o=>o.value===query.get(id)))$(id).value=query.get(id);
function render(){
 const frames=WEAPON_EXPANSION_FRAMES.filter(f=>filters.every(id=>$(id).value==='all'||$(id).value===f[id]));
 $('count').textContent=`${frames.length} sprites shown · ${WEAPON_EXPANSION_FRAMES.length} total · Foreman uniform shared by both factions`;
 $('gallery').replaceChildren(...frames.map(frame=>{
  const figure=document.createElement('figure'),stage=document.createElement('div'),img=document.createElement('img'),caption=document.createElement('figcaption');
  caption.textContent=`${frame.species.replaceAll('-',' ')} · ${frame.outfit==='normal'?'Original':'Red Hats'} · ${EXPANSION_WEAPON_LABELS[frame.weapon]} · ${frame.stance}`;
  stage.className='stage';img.src=frame.src;img.alt=caption.textContent;img.loading='lazy';img.width=frame.width;img.height=frame.height;
  stage.append(img);figure.append(stage,caption);return figure;
 }));
}
for(const id of filters)$(id).addEventListener('change',render);
for(const id of ['small','mirror'])$(id).addEventListener('change',()=> $('gallery').classList.toggle(id,$(id).checked));
render();
