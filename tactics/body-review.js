import {BODY_FRAMES} from './body-art.js';
const $=id=>document.getElementById(id);
function render(){
 const frames=BODY_FRAMES.filter(f=>$('outfit').value==='all'||f.outfit===$('outfit').value);
 $('count').textContent=frames.length+' sprites · Foreman uniform shared by both factions';
 $('gallery').replaceChildren(...frames.map(f=>{
 const figure=document.createElement('figure'),stage=document.createElement('div'),img=document.createElement('img'),caption=document.createElement('figcaption');
 stage.className='stage';img.src=f.src;img.alt=f.species+' · '+f.outfit+' · side-lying';img.width=f.width;img.height=f.height;caption.textContent=img.alt;
 stage.append(img);figure.append(stage,caption);return figure;
 }));
}
$('outfit').addEventListener('change',render);
for(const id of ['mirror','small'])$(id).addEventListener('change',()=>$('gallery').classList.toggle(id,$(id).checked));
render();
