import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const base='https://swarm-intelligence-ai.github.io/patto_family_dinners/';
const names=['nov16-schnitzel','nov16-souvlaki','nov16-bulgogi','nov16-burgers','nov16-steak','nov16-salmon'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const local=path=>readFile(new URL('../dist/'+path,import.meta.url));
const expectedHtml=(await local('index.html')).toString('utf8');
const script=expectedHtml.match(/<script[^>]*src="([^"]+)"/)?.[1];
const css=expectedHtml.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/)?.[1];
if(!script||!css)throw Error('Build HTML is missing app or stylesheet');
const get=async path=>{
 const url=new URL(path.replace(/^\.\//,''),base);
 url.searchParams.set('audit',process.env.GITHUB_SHA?.slice(0,12)||'nov16');
 const response=await fetch(url,{headers:{'Cache-Control':'no-cache'},redirect:'follow'});
 if(!response.ok)throw Error(url+' => HTTP '+response.status);
 return Buffer.from(await response.arrayBuffer());
};
let latest;
for(let attempt=1;attempt<=12;attempt++){
 try{
  const html=(await get('./')).toString('utf8');
  if(!html.includes('src="'+script+'"')||!html.includes('href="'+css+'"'))throw Error('Live HTML not showing current build: '+script);
  for(const path of [script,css,'./data/plans.json','./data/recipes.json']){
    const filename=path.replace(/^\.\//,'');
    const live=await get(path), expected=await local(filename);
    if(!live.equals(expected))throw Error('Live bytes do not match deployed source: '+path+' local '+sha(expected)+' live '+sha(live));
  }
  const app=(await get(script)).toString('utf8');
  const plans=JSON.parse((await get('./data/plans.json')).toString('utf8'));
  const recipes=JSON.parse((await get('./data/recipes.json')).toString('utf8'));
  if(plans.current!=='2026-11-16')throw Error('Wrong live menu: '+plans.current);
  const week=plans.weeks.find(w=>w.id===plans.current);
  if(week?.meals.length!==6)throw Error('Live week must contain six dinners');
  for(const meal of week.meals){
    const recipe=recipes.recipes.find(r=>r.id===meal.recipe);
    if(!recipe)throw Error('Recipe missing: '+meal.recipe);
    const name=recipe.art;
    if(!names.includes(name))throw Error('Unexpected photo art: '+name);
    const matches=[...app.matchAll(new RegExp('^\\s*"'+name+'"\\s*:', 'gm'))];
    if(matches.length!==1)throw Error('Duplicate or missing image mapping: '+name+' count='+matches.length);
    const imageMapBlock=app.slice(app.indexOf('const photoSources = {'),app.indexOf('};',app.indexOf('const photoSources = {')));
    const mapping=imageMapBlock.match(new RegExp('"'+name+'"\\s*:\\s*"(https:[^"]+)"'));
    if(!mapping)throw Error('Dinner is not mapped to a real food photo: '+name);
    console.log('Verified photo assignment',meal.day,recipe.title,mapping[1]);
  }
  console.log('SUCCESS: Live HTML, JS, CSS, JSON, six distinct photograph URLs match published build');
  process.exit(0);
 }catch(error){latest=error;console.error('Live site not ready (attempt '+attempt+'):',error.message);if(attempt<12)await new Promise(r=>setTimeout(r,15000));}
}
throw Error('Live image check failed: '+latest?.message);
