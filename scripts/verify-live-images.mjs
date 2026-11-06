import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const base='https://swarm-intelligence-ai.github.io/patto_family_dinners/';
const names=['tuscan-orzo','hoisin-udon','thai-coconut-chicken','cottage-pie','spanish-chicken','yakitori-chicken'];
const id=process.env.GITHUB_SHA?.slice(0,12)||'manual';
const sourceHtml=await readFile(new URL('../index.html',import.meta.url),'utf8');
const expectedApp=sourceHtml.match(/<script[^>]*src="([^"]+)"/)?.[1];
const expectedCss=sourceHtml.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/)?.[1];
if(!expectedApp||!expectedCss)throw Error('Local HTML cannot identify app/css');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function download(url){
 const response=await fetch(url,{headers:{'Cache-Control':'no-cache','Pragma':'no-cache'},redirect:'follow'});
 if(!response.ok)throw Error(url+' => HTTP '+response.status);
 return Buffer.from(await response.arrayBuffer());
}
let lastError;
for(let attempt=1;attempt<=12;attempt++){
 try{
  console.log('LIVE PUBLIC WEBSITE AUDIT attempt',attempt,'commit',id);
  const html=(await download(base+'?audit='+id+'-'+attempt)).toString('utf8');
  const js=html.match(/<script[^>]*src="([^"]+)"[^>]*><\/script>/i)?.[1];
  const css=html.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/i)?.[1]||html.match(/<link[^>]*href="([^"]+)"[^>]*rel="stylesheet"/i)?.[1];
  console.log('Live HTML script:',js,'style:',css);
  if(!js)throw Error('Live HTML has no app script');
  if(js!==expectedApp)throw Error('Live site NOT serving the published main-branch application. Expected '+expectedApp+' but found '+js);
  const liveApp=(await download(new URL(js,base).href)).toString('utf8');
  const sourceApp=await readFile(new URL('../'+expectedApp.slice(2),import.meta.url));
  if(!Buffer.from(liveApp,'utf8').equals(sourceApp))throw Error('Live app JS bytes DO NOT match the GitHub main-branch file');
  if(!liveApp.includes("from './core-20261107-dinner-photos.js'"))throw Error('Live application is not referencing the unique matching core module');
  if(css!==expectedCss)throw Error('Live site stylesheet mismatch: expected '+expectedCss+' got '+css);
  const liveCss=await download(new URL(css,base).href);
  if(!liveCss.equals(await readFile(new URL('../'+css.slice(2),import.meta.url))))throw Error('Live CSS bytes differ from source');
  for(const name of names){
   const path='./assets/meal-photos/verified-20261106/'+name+'.avif';
   if(!liveApp.includes('"'+name+'": "'+path+'"'))throw Error('Live JS does not map '+name+' to newly approved photo');
   const local=await readFile(new URL('../assets/meal-photos/verified-20261106/'+name+'.avif',import.meta.url));
   const live=await download(new URL(path+'?audit='+id,base).href);
   if(!live.equals(local))throw Error('IMAGE BYTES DIFFER for '+name+': local '+hash(local)+' live '+hash(live));
   console.log('VERIFIED',name,'exact image byte-for-byte',live.length,'bytes',hash(live).slice(0,20));
  }
  console.log('SUCCESS: live main-branch HTML, JS, CSS and all SIX approved food photographs verified byte-for-byte.');
  process.exit(0);
 }catch(error){lastError=error;console.error('NOT READY:',error.message);if(attempt<12)await new Promise(resolve=>setTimeout(resolve,15000));}
}
throw Error('Live website image verification FAILED after retries: '+lastError?.message);
