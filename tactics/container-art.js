export const containers = [
  {id:'wooden-crate',name:'Wooden shipping crate',detail:'Pry-off lid · general stores',openOffset:[0,0]},
  {id:'supply-chest',name:'Steel supply chest',detail:'Hinged lid · secured supplies',openOffset:[0,-47]},
  {id:'medicine-cabinet',name:'Medicine cabinet',detail:'Glass doors · medical stores',openOffset:[0,0]},
  {id:'toolbox',name:'Maintenance toolbox',detail:'Hinged lid · tools and spare parts',openOffset:[0,0]}
];
export const spritePath = (id,state) => '../assets/environment/containers/'+id+'-'+state+'.png';
const grid=document.querySelector('#containers');
if(grid){
  for(const item of containers){
    const card=document.createElement('article');
    card.innerHTML='<button class="picture" aria-pressed="false" aria-label="Open '+item.name+'"><img class="closed" alt="'+item.name+' closed"><img class="open" alt="'+item.name+' open" hidden></button><div class="caption"><h2>'+item.name+'</h2><p>'+item.detail+'</p><button class="toggle">Open container</button><div class="downloads"></div></div>';
    for(const state of ['closed','open']){
      const img=card.querySelector('.'+state);
      img.src=spritePath(item.id,state);
      if(state==='open') img.style.transform='translate('+item.openOffset[0]/1254*100+'%,'+item.openOffset[1]/1254*100+'%)';
      const link=document.createElement('a');
      link.href=img.src;link.download='';link.textContent=state+' PNG';
      card.querySelector('.downloads').append(link);
    }
    const setOpen=open=>{
      card.dataset.open=String(open);
      card.querySelector('.closed').hidden=open;
      card.querySelector('.open').hidden=!open;
      card.querySelector('.picture').setAttribute('aria-pressed',String(open));
      card.querySelector('.picture').setAttribute('aria-label',(open?'Close ':'Open ')+item.name);
      card.querySelector('.toggle').textContent=open?'Close container':'Open container';
    };
    for(const button of card.querySelectorAll('button')) button.onclick=()=>setOpen(card.dataset.open!=='true');
    card.setOpen=setOpen;
    grid.append(card);
  }
  document.querySelector('#open-all').onclick=()=>{for(const card of grid.children)card.setOpen(true);};
  document.querySelector('#close-all').onclick=()=>{for(const card of grid.children)card.setOpen(false);};
  document.querySelector('#backdrop').onchange=e=>document.body.dataset.backdrop=e.target.value;
  document.querySelector('#size').onchange=e=>document.body.classList.toggle('small',e.target.value==='small');
}
