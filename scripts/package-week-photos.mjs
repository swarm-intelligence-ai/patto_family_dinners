import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const output=new URL('../dist/assets/meal-photos/nov23/',import.meta.url);
const photos=[
  ['nov23-burgers',19247585,'BBQ beef cheeseburger with salad'],
  ['nov23-sesame-chicken',35081826,'Crispy Asian chicken with sesame and rice'],
  ['nov23-steak',11089568,'Grilled steak with chimichurri and roast potatoes'],
  ['nov23-salmon',10156758,'Salmon with rice, broccoli and vegetables'],
  ['nov23-potatoes',34495400,'Loaded baked potato with cheese and bacon'],
  ['nov23-viet-salad',2116096,'Vietnamese chicken noodle salad']
];
const digest=buffer=>createHash('sha256').update(buffer).digest('hex');
await mkdir(output,{recursive:true});
const hashes=new Set();
for(const [name,id,description] of photos){
  const url='https://images.pexels.com/photos/'+id+'/pexels-photo-'+id+'.jpeg?auto=compress&cs=tinysrgb&w=1200';
  let bytes=null,last=null;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(25000),headers:{'Accept':'image/jpeg'}});
      if(!response.ok)throw Error('HTTP '+response.status);
      const contentType=response.headers.get('content-type')||'';
      bytes=Buffer.from(await response.arrayBuffer());
      if(!contentType.includes('image/')||bytes.length<30000||bytes.length>6000000||bytes[0]!==255||bytes[1]!==216)throw Error('Invalid or too-small JPEG: '+contentType+', '+bytes.length+' bytes');
      break;
    }catch(e){last=e;bytes=null;console.warn('Photo fetch retry',name,attempt,String(e));}
  }
  if(!bytes)throw Error('Cannot package photo '+name+': '+last);
  const hash=digest(bytes);
  if(hashes.has(hash))throw Error('Duplicated photo detected for '+name);
  hashes.add(hash);
  await writeFile(new URL(name+'.jpg',output),bytes);
  console.log('Packaged real photograph',name,id,bytes.length,'bytes',hash,description);
}
const plans=JSON.parse(await readFile(new URL('data/plans.json',root),'utf8'));
if(plans.current==='2026-11-23' && plans.weeks.find(w=>w.id===plans.current)?.meals.length!==6)throw Error('Invalid current six-dinner week');
