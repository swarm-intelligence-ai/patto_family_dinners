import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const dishes=[
  {art:'tm5-risotto',id:'qrleIV6KkfI',credit:'Rob Wicks — Mushroom risotto'},
  {art:'tm5-mexican-beef',id:'VAbBclifmvY',credit:'Svitlana — Sweet potato chili with beans'},
  {art:'med-salmon-salsa',id:'xIDf1bUYCf8',credit:'Sander Dalhuisen — Salmon with potato and tomato'},
  {art:'chicken-veg-nachos',id:'5PkRWJ3ndOw',credit:'lap lap — Nachos with melted cheese'},
  {art:'steak-capsicum',id:'tLGAOnl4p28',credit:'Orkun Orcan — Steak, potatoes and broccoli'}
];
const dest=new URL('../assets/meal-photos/',import.meta.url);
await mkdir(dest,{recursive:true});
for(const d of dishes){
  const api=await fetch('https://unsplash.com/napi/photos/'+d.id,{headers:{'User-Agent':'Mozilla/5.0 (compatible; FamilyCookbookBot/1.0)','Accept':'application/json'}});
  console.log(d.art,'photo lookup',api.status);
  if(!api.ok)throw Error('Unsplash photo lookup failed for '+d.art+': '+api.status);
  const photo=await api.json();
  if(!photo.urls?.regular)throw Error('Photo URL unavailable for '+d.art);
  const url=new URL(photo.urls.regular);url.searchParams.set('w','1000');url.searchParams.set('q','83');url.searchParams.set('fm','jpg');url.searchParams.set('fit','crop');
  const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'}});
  const mime=response.headers.get('content-type')||'';
  if(!response.ok||!mime.startsWith('image/'))throw Error('Image download failed for '+d.art+' '+response.status+' '+mime);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<10000||bytes.length>6000000)throw Error('Unexpected photo size for '+d.art+': '+bytes.length);
  await writeFile(new URL(d.art+'.jpg',dest),bytes);
  console.log('Saved',d.art,bytes.length,'bytes',photo.user?.name||'');
}
const attribution=dishes.map(d=>'- '+d.art+': '+d.credit+' — https://unsplash.com/photos/'+d.id+' (Unsplash License)').join('\n');
await writeFile(new URL('CREDITS.md',dest),'# Food photography credits\n\nImages downloaded from Unsplash and served locally to avoid broken remote links.\n\n'+attribution+'\n');
