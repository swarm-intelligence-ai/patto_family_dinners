import {readFile} from 'node:fs/promises';
const base='https://swarm-intelligence-ai.github.io/patto_family_dinners/';
const local=path=>readFile(new URL('../dist/'+path,import.meta.url));
const expected=(await local('index.html')).toString('utf8');
const script=expected.match(/<script[^>]*src="([^"]+)"/)?.[1];
const stylesheet=expected.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/)?.[1];
if(!script||!stylesheet)throw Error('Build is missing JS or CSS');
const artKeys=['nov23-burgers','nov23-sesame-chicken','nov23-steak','nov16-salmon','nov23-potatoes','nov23-viet-salad'];
const recipeIDs=['bbq-beef-cheeseburgers-nov23','crispy-honey-sesame-chicken-nov23','porterhouse-chimichurri-nov23','sticky-soy-ginger-salmon','bbq-chicken-bacon-potatoes-nov23','vietnamese-chicken-noodle-salad-nov23'];
async function fetchLive(path){
 const url=new URL(path.replace(/^\.\//,''),base);
 url.searchParams.set('audit',process.env.GITHUB_SHA?.slice(0,12)||'nov23');
 const response=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('HTTP '+response.status+': '+url);
 return Buffer.from(await response.arrayBuffer());
}
let last;
for(let attempt=1;attempt<=8;attempt++){
 try {
   const html=(await fetchLive('./')).toString('utf8');
   if(!html.includes('src="'+script+'"')||!html.includes('href="'+stylesheet+'"'))throw Error('Deployed HTML has stale versioned JS or CSS');
   for(const path of [script,stylesheet,'./data/plans.json','./data/recipes.json']){
     const remote=await fetchLive(path);
     const expected=await local(path.replace(/^\.\//,''));
     if(!remote.equals(expected))throw Error('Live bytes differ: '+path);
   }
   const app=(await fetchLive(script)).toString('utf8');
   const plans=JSON.parse((await fetchLive('./data/plans.json')).toString('utf8'));
   const recipes=JSON.parse((await fetchLive('./data/recipes.json')).toString('utf8'));
   if(plans.current!=='2026-11-23')throw Error('Wrong current week: '+plans.current);
   const week=plans.weeks.find(w=>w.id===plans.current);
   if(!week||JSON.stringify(week.meals.map(m=>m.recipe))!==JSON.stringify(recipeIDs))throw Error('Wrong lineup or ordering');
   const photoBlock=app.split('const photoSources = {')[1]?.split('};')[0];
   const backupBlock=app.split('const backupPhotoSources = {')[1]?.split('};')[0];
   if(!photoBlock||!backupBlock)throw Error('Missing primary or backup photo mappings');
   for(let i=0;i<recipeIDs.length;i++){
     const recipe=recipes.recipes.find(r=>r.id===recipeIDs[i]);
     if(recipe?.art!==artKeys[i])throw Error('Wrong art key: '+recipeIDs[i]);
     const escaped=artKeys[i].replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&');
     const re=new RegExp('"'+escaped+'"\\s*:\\s*"(https:\\/\\/[^"]+)"','g');
     const primary=[...photoBlock.matchAll(re)].map(m=>m[1]);
     const backups=[...backupBlock.matchAll(re)].map(m=>m[1]);
     if(primary.length!==1||backups.length!==1||primary[0]===backups[0])throw Error('Missing or duplicate source/backup for '+artKeys[i]);
     for(const source of [primary[0],backups[0]]){
       const res=await fetch(source,{signal:AbortSignal.timeout(25000)});
       const type=res.headers.get('content-type')||'';
       const bytes=Buffer.from(await res.arrayBuffer());
       if(!res.ok||!type.includes('image/')||bytes.length<10000)throw Error('Source photo broken: '+source+' '+res.status+' '+type+' '+bytes.length);
     }
     console.log('VERIFIED primary and fallback',recipe.title);
   }
   console.log('SUCCESS: Site, current menu, shopping data and six primary/backup food photos verified.');
   process.exit(0);
 }catch(e){last=e;console.error('Live audit attempt '+attempt+': '+e.message);if(attempt<8)await new Promise(resolve=>setTimeout(resolve,12000));}
}
throw Error('Published site verification failed: '+last?.message);
