import {writeFile,mkdir} from 'node:fs/promises';
const folder = new URL('../assets/', import.meta.url); await mkdir(folder,{recursive:true});
let seed = 27;
const rand = () => {seed = (seed * 16807) % 2147483647; return seed / 2147483647;};
const ellipse = (x,y,rx,ry,c,other='') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" ${other}/>`;
const leaf = (x,y,s=1) => `<g transform="translate(${x} ${y}) rotate(${rand()*360}) scale(${s})"><path d="M-15 0Q0-22 17 0Q0 18-15 0" fill="#4d733b"/><path d="M-12 0H12" stroke="#b1bb6c" stroke-width="1.3"/></g>`;
const tomato = (x,y) => ellipse(x,y,13,11,'#c94e32')+ellipse(x-3,y-2,6,5,'#ec8a52')+`<path d="M${x-5} ${y-3}l8 6m-8 0 8-6" stroke="#f6bd73" stroke-width="1.5"/>`;
const cucumber = (x,y) => ellipse(x,y,17,11,'#52723a')+ellipse(x,y,13,8,'#d3db9a')+ellipse(x,y,7,4,'#eef0c5');
const grain = (n, cx,cy,rx,ry,c='#ece0b2') => Array.from({length:n},()=>{const a=rand()*Math.PI*2,r=Math.sqrt(rand());return ellipse(cx+Math.cos(a)*rx*r,cy+Math.sin(a)*ry*r,2+rand()*2,1.4,c,`transform="rotate(${rand()*180} ${cx+Math.cos(a)*rx*r} ${cy+Math.sin(a)*ry*r})"`);}).join('');
function plate(type) {
  seed=27;
  let food='';
  if (type==='mediterranean' || type==='burrito' || type==='salmon') {
    food+=ellipse(217,206,129,118,'#ded5a9')+grain(200,210,205,126,114);
    if(type==='mediterranean'||type==='burrito'){
      food+=Array.from({length:100},()=>{const a=rand()*6.28,r=Math.sqrt(rand()); return ellipse(160+Math.cos(a)*62*r,165+Math.sin(a)*59*r,5+rand()*6,4+rand()*5,rand()>.4?'#79513a':'#a77349');}).join('');
      food+=Array.from({length:12},()=>tomato(235+rand()*55,112+rand()*50)).join('');
      food+=Array.from({length:8},()=>cucumber(270+rand()*39,183+rand()*70)).join('');
      food+=Array.from({length:14},()=>leaf(142+rand()*100,258+rand()*40,.8)).join('');
      if(type==='mediterranean') food+=Array.from({length:16},()=>`<rect x="${145+rand()*135}" y="${130+rand()*120}" width="${6+rand()*8}" height="${6+rand()*7}" rx="2" fill="#fff4d6" transform="rotate(${rand()*80} 215 215)"/>`).join('');
      else {food+=Array.from({length:23},()=>ellipse(242+rand()*45,261+rand()*28,5,3,'#4a3431')).join('');food+=`<path d="M120 221Q147 179 178 223L145 256Z" fill="#49633c"/><path d="M128 220Q148 193 169 224L147 246Z" fill="#a5bb66"/>`; food+=grain(50,216,224,33,20,'#eab746');}
    } else {
      food+=Array.from({length:15},()=>leaf(115+rand()*55,140+rand()*115,1.4)).join('');
      food+=Array.from({length:10},()=>cucumber(257+rand()*39,255+rand()*34)).join('');
      food+=`<g transform="rotate(25 240 185)"><rect x="187" y="117" width="95" height="145" rx="27" fill="#bd643f"/><rect x="192" y="117" width="83" height="136" rx="23" fill="#e89465"/>${Array.from({length:8},(_,i)=>`<path d="M193 ${131+i*15}q40 25 81 0" fill="none" stroke="#ffd4a1" stroke-width="4"/>`).join('')}<path d="M208 120Q228 151 264 139M198 196Q242 220 277 189" fill="none" stroke="#a95832" stroke-width="7" opacity=".8"/></g>`;
    }
  } else if(type==='tonkatsu'){
    food+=Array.from({length:45},()=>`<path d="M${105+rand()*90} ${125+rand()*90}l${20+rand()*35} ${-10+rand()*25}" stroke="${rand()>.5?'#85a367':'#ddd4ac'}" stroke-width="4"/>`).join('');
    food+=Array.from({length:10},(_,i)=>`<path d="M${190+i*11} 265q-16 40 9 41l17-60Z" fill="${i%2?'#d58435':'#eaa74d'}" transform="rotate(${i*8-30} 260 280)"/>`).join('');
    food+=`<g transform="rotate(-22 225 190)">${Array.from({length:7},(_,i)=>`<rect x="${152+i*22}" y="${141+Math.abs(i-3)*4}" width="19" height="${100-Math.abs(i-3)*12}" rx="7" fill="#a86c31"/><rect x="${154+i*22}" y="${144+Math.abs(i-3)*4}" width="14" height="${91-Math.abs(i-3)*12}" rx="5" fill="#e5b75d"/>`).join('')}${grain(100,224,189,66,31,'#f4d47f')}</g>`;
  } else {
    food+=ellipse(214,215,124,116,'#d8aa5f');
    food+=Array.from({length:65},()=>{const a=rand()*6.28,r=Math.sqrt(rand()),x=214+Math.cos(a)*112*r,y=211+Math.sin(a)*103*r; return `<g transform="translate(${x} ${y}) rotate(${rand()*180})"><rect width="27" height="10" rx="4" fill="#f0cc7c"/><path d="M4 2v6m5-6v6m5-6v6m5-6v6" stroke="#d9a74f" stroke-width="1"/></g>`;}).join('');
    food+=Array.from({length:15},()=>tomato(125+rand()*177,135+rand()*150)).join('');
    food+=Array.from({length:12},()=>leaf(120+rand()*180,125+rand()*170,1)).join('');
    food+=Array.from({length:15},()=>ellipse(135+rand()*135,125+rand()*160,12,8,'#d4b17b')).join('');
  }
  food+=`<g transform="translate(304 111) rotate(30)"><path d="M-24 0A24 24 0 0 1 24 0Z" fill="#f5cc54"/><path d="M-18 -1A18 18 0 0 1 18 -1Z" fill="#fff1a9"/><path d="M0-1V-18M0-1l-12-12m12 12 12-12" stroke="#f3d975" stroke-width="2"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 430 410"><defs><filter id="shadow"><feDropShadow dx="1" dy="10" stdDeviation="10" flood-color="#4a3321" flood-opacity=".14"/></filter></defs><g filter="url(#shadow)">${ellipse(215,208,174,172,'#fffdf3')}${ellipse(215,208,157,155,'none','stroke="#c9c7ae" stroke-width="1.5"')}${ellipse(215,208,141,139,'#f1eedb')}${food}</g></svg>`;
}
for(const type of ['mediterranean','tonkatsu','burrito','pasta','salmon']) await writeFile(new URL(`${type}.svg`,folder),plate(type).replace(/-?\d+\.\d{2,}/g,n=>String(Number(Number(n).toFixed(1)))));
await writeFile(new URL('favicon.svg',folder),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#b83224"/><text x="32" y="47" text-anchor="middle" font-family="Georgia,serif" font-size="46" font-weight="bold" fill="#fff9ed">P</text></svg>`);
console.log('Created five original food illustrations and favicon.');
