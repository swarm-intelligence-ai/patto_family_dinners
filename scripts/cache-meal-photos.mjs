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
  const candidates=[
    'https://unsplash.com/photos/'+d.id+'/download?force=true&w=1000&q=83',
    'https://unsplash.com/photos/'+d.id,
    'https://unsplash.com/napi/photos/'+d.id
  ];
  let response=null;
  for(const source of candidates){
    const meta=await fetch(source,{headers:{'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'}});
    console.log(d.art,source,meta.status,meta.headers.get('content-type'));
    if(meta.ok && (meta.headers.get('content-type')||'').startsWith('image/')){response=meta;break;}
    if(!meta.ok)continue;
    const text=await meta.text();
    let imageUrl;
    if(source.endsWith('/'+d.id)){
      imageUrl=text.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1]
        ||text.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1];
    }else if(source.includes('/napi/')){
      try{imageUrl=JSON.parse(text).urls?.regular;}catch{}
    }
    if(imageUrl){
      imageUrl=imageUrl.replaceAll('&amp;','&');
      const download=await fetch(imageUrl,{headers:{'User-Agent':'Mozilla/5.0'}});
      console.log(d.art,'resolved image',download.status,download.headers.get('content-type'));
      if(download.ok && (download.headers.get('content-type')||'').startsWith('image/')){response=download;break;}
    }
  }
  if(!response)throw Error('Could not obtain licensed photo for '+d.art);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<10000||bytes.length>6000000)throw Error('Unexpected photo size for '+d.art+': '+bytes.length);
  await writeFile(new URL(d.art+'.jpg',dest),bytes);
  console.log('Saved',d.art,bytes.length,'bytes',d.credit);
}
const attribution=dishes.map(d=>'- '+d.art+': '+d.credit+' — https://unsplash.com/photos/'+d.id+' (Unsplash License)').join('\n');
await writeFile(new URL('CREDITS.md',dest),'# Food photography credits\n\nImages downloaded from Unsplash and served locally to avoid broken remote links.\n\n'+attribution+'\n');
