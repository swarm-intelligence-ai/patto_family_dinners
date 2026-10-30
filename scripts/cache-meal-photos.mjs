import {mkdir,writeFile} from 'node:fs/promises';
const files=[
  {art:'tm5-risotto',file:'Mushroom_risotto_(3990739885).jpg',credit:'Karen and Brad Emerson — Mushroom risotto — CC BY 2.0'},
  {art:'tm5-mexican-beef',file:'Baked_Sweet_Potato_on_Salad.jpg',credit:'FitTasteTic — Baked sweet potato on salad — CC BY-SA 2.0'},
  {art:'med-salmon-salsa',file:'Salmon_al_horno.jpg',credit:'LordT — Salmon with potatoes and tomatoes — CC BY-SA 4.0'},
  {art:'chicken-veg-nachos',file:'Lindo_Mexico_-_June_2022_-_Sarah_Stierch_05.jpg',credit:'Sarah Stierch — Chicken, beef and bean nachos — CC BY 4.0'},
  {art:'steak-capsicum',file:'Dinner_at_a_restaurant_with_steak_and_potatoes_and_broccoli.jpg',credit:'Tomwsulcer — Steak, potato and broccoli — CC0'}
];
const dest=new URL('../assets/meal-photos/',import.meta.url);
await mkdir(dest,{recursive:true});
let success=0;
for(const item of files){
  const url='https://commons.wikimedia.org/wiki/Special:Redirect/file/'+encodeURIComponent(item.file)+'?width=900';
  let response;
  try{
    response=await fetch(url,{headers:{'User-Agent':'PattoFamilySocial/1.0 (personal family cookbook; attribution included)','Accept':'image/jpeg,image/*'}});
    const type=response.headers.get('content-type')||'';
    console.log(item.art,response.status,type,response.url);
    if(!response.ok||!type.startsWith('image/'))continue;
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length<10000||bytes.length>6000000)continue;
    await writeFile(new URL(item.art+'.jpg',dest),bytes);
    console.log('SAVED',item.art,bytes.length);
    success++;
  }catch(err){console.log('FAILED',item.art,err.message)}
}
const credits=files.map(x=>'- '+x.art+': '+x.credit+' — https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(x.file)).join('\n');
await writeFile(new URL('CREDITS.md',dest),'# Photo credits\n\nPhotos hosted locally for reliable display. Images show representative versions of the dishes; plating may differ.\n\n'+credits+'\n\nLicenses: https://creativecommons.org/licenses/by/2.0/ · https://creativecommons.org/licenses/by-sa/2.0/ · https://creativecommons.org/licenses/by-sa/4.0/ · https://creativecommons.org/licenses/by/4.0/\n');
console.log('Downloaded',success,'of',files.length);
if(success!==files.length)process.exitCode=1;
