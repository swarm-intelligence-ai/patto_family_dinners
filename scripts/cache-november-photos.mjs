import {mkdir,writeFile} from 'node:fs/promises';
const files=[{"art":"tuscan-orzo","file":"Орзо со пилешко.jpg","credit":"Orzo with chicken — Wikimedia Commons"},{"art":"hoisin-udon","file":"Stir fry with udon noodles (1126893572).jpg","credit":"Father.Jack — Stir fry with udon noodles — CC BY 2.0"},{"art":"thai-coconut-chicken","file":"Tom kha chicken with veggies - bowl.JPG","credit":"Thai coconut chicken soup — Wikimedia Commons"},{"art":"cottage-pie","file":"Australian cottage pie (cropped).jpg","credit":"Australian cottage pie — Wikimedia Commons"},{"art":"spanish-chicken","file":"Spicy Tomato Chicken Stew.jpg","credit":"NiferO — Spicy tomato chicken stew — Wikimedia Commons"},{"art":"yakitori-chicken","file":"Yakitori (Teriyaki Chicken Skewers).jpg","credit":"TheCulinaryGeek — Yakitori chicken skewers — CC BY 2.0"}];
const folder=new URL('../assets/meal-photos/nov-2026/',import.meta.url);
await mkdir(folder,{recursive:true});
let failures=0;
for(const entry of files){
 const url='https://commons.wikimedia.org/wiki/Special:Redirect/file/'+encodeURIComponent(entry.file)+'?width=960';
 try{
  const response=await fetch(url,{headers:{'User-Agent':'PattoFamilySocial/1.0 (family menu photo cache; credits in repo)','Accept':'image/jpeg,image/*'}});
  const type=response.headers.get('content-type')||'';
  if(!response.ok||!type.startsWith('image/'))throw Error(response.status+' '+type);
  const buf=Buffer.from(await response.arrayBuffer());
  if(buf.length<8000||buf.length>7000000)throw Error('Unexpected size '+buf.length);
  if(buf[0]!==0xff||buf[1]!==0xd8)throw Error('Not a JPEG image');
  await writeFile(new URL(entry.art+'.jpg',folder),buf);
  console.log('Stored',entry.art,buf.length,entry.credit);
 }catch(error){failures++;console.error('MISSING',entry.art,error.message)}
}
const credits=files.map(e=>'- '+e.art+': '+e.credit+' — https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(e.file)).join('\n');
await writeFile(new URL('CREDITS.md',folder),'# Meal photos for November 2026\n\nLicensed photographs of representative meals; exact recipe plating may differ. Original image and licence pages:\n\n'+credits+'\n');
if(failures)throw Error(failures+' photos could not be downloaded');
