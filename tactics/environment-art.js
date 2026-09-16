const root=document.documentElement;
document.querySelector('#category').addEventListener('change',e=>{for(const card of document.querySelectorAll('article'))card.hidden=e.target.value!=='all'&&card.dataset.kind!==e.target.value;});
document.querySelector('#backdrop').addEventListener('change',e=>{
 const v=e.target.value;document.body.classList.toggle('check',v==='check');
 root.style.removeProperty('--backdrop');
 if(v.endsWith('.png'))root.style.setProperty('--backdrop',`url('../assets/environment/${v}')`);
 else if(v==='light'||v==='dark')root.style.setProperty('--backdrop',`linear-gradient(${v==='light'?'#e6e1d4,#e6e1d4':'#202520,#202520'})`);
});
document.querySelector('#mirror').addEventListener('click',e=>{const on=e.target.getAttribute('aria-pressed')!=='true';e.target.setAttribute('aria-pressed',String(on));root.style.setProperty('--mirror',on?-1:1);});
document.querySelector('#repeat').addEventListener('change',e=>root.style.setProperty('--repeat',e.target.value));
