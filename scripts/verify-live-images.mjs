import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const base='https://swarm-intelligence-ai.github.io/patto_family_dinners/';
const names=['tuscan-orzo','hoisin-udon','thai-coconut-chicken','cottage-pie','spanish-chicken','yakitori-chicken'];
const id=process.env.GITHUB_SHA?.slice(0,12)||'manual';
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
  if(js!=='./app-'+id+'.js')throw Error('Live site NOT serving deployed application build. Expected app-'+id+'.js but found '+js+'; possible competing Pages deployment/source.');
  const liveApp=(await download(new URL(js,base).href)).toString('utf8');
  if(!liveApp.includes("from './core-"+id+".js'"))throw Error('App script not referencing matching versioned core');
  for(const name of names){
   const path='./assets/meal-photos/verified-20261106/'+name+'.avif';
   if(!liveApp.includes('"'+name+'": "'+path+'"'))throw Error('Live JS does not map '+name+' to newly approved photo');
   const local=await readFile(new URL('../assets/meal-photos/verified-20261106/'+name+'.avif',import.meta.url));
   const live=await download(new URL(path+'?audit='+id,base).href);
   if(!live.equals(local))throw Error('IMAGE BYTES DIFFER for '+name+': local '+hash(local)+' live '+hash(live));
   console.log('VERIFIED',name,'exact image byte-for-byte',live.length,'bytes',hash(live).slice(0,20));
  }
  console.log('SUCCESS: live HTML, JS, and all SIX real photographic assets are verified against source.');
  process.exit(0);
 }catch(error){lastError=error;console.error('NOT READY:',error.message);if(attempt<12)await new Promise(resolve=>setTimeout(resolve,15000));}
}
throw Error('Live website image verification FAILED after retries: '+lastError?.message);
