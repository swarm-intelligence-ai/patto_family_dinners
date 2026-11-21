import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const base='https://swarm-intelligence-ai.github.io/patto_family_dinners/';
const local=path=>readFile(new URL('../dist/'+path,import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const expectedHtml=(await local('index.html')).toString('utf8');
const expectedScript=expectedHtml.match(/<script[^>]*src="([^"]+)"/)?.[1];
const expectedCSS=expectedHtml.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/)?.[1];
if(!expectedScript||!expectedCSS)throw Error('Missing built JS or CSS');
const required=['nov23-burgers','nov23-sesame-chicken','nov23-steak','nov16-salmon','nov23-potatoes','nov23-viet-salad'];
const jpg=(name)=>name==='nov16-salmon'?'nov23-salmon':name;
const fetchLive=async path=>{
 const u=new URL(path.replace(/^\.\//,''),base);u.searchParams.set('build',process.env.GITHUB_SHA||'nov23');
 const response=await fetch(u,{redirect:'follow',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error('HTTP '+response.status+' '+u);
 return Buffer.from(await response.arrayBuffer());
};
let last;
for(let attempt=1;attempt<=12;attempt++){
 try{
  const html=(await fetchLive('./')).toString('utf8');
  if(!html.includes('src="'+expectedScript+'"')||!html.includes('href="'+expectedCSS+'"'))throw Error('Live HTML does not reference new versioned assets');
  for(const item of [expectedScript,expectedCSS,'./data/recipes.json','./data/plans.json']){
   const live=await fetchLive(item);
   const expected=await local(item.replace(/^\.\//,''));
   if(!live.equals(expected))throw Error('Live asset differs byte-for-byte: '+item);
  }
  const app=(await fetchLive(expectedScript)).toString('utf8');
  const plans=JSON.parse((await fetchLive('./data/plans.json')).toString('utf8'));
  const book=JSON.parse((await fetchLive('./data/recipes.json')).toString('utf8'));
  if(plans.current!=='2026-11-23')throw Error('Current week is '+plans.current+' (expected 23 November)');
  const week=plans.weeks.find(w=>w.id===plans.current);
  if(week?.meals.length!==6)throw Error('Current week does not have exactly six dinners');
  const expectedMeals=['bbq-beef-cheeseburgers-nov23','crispy-honey-sesame-chicken-nov23','porterhouse-chimichurri-nov23','sticky-soy-ginger-salmon','bbq-chicken-bacon-potatoes-nov23','vietnamese-chicken-noodle-salad-nov23'];
  if(JSON.stringify(week.meals.map(m=>m.recipe))!==JSON.stringify(expectedMeals))throw Error('Published meals mismatch the locked menu');
  for(let i=0;i<required.length;i++){
   const meal=week.meals[i];
   const recipe=book.recipes.find(r=>r.id===meal.recipe);
   if(!recipe||recipe.art!==required[i])throw Error('Recipe artwork mismatch on '+meal.day);
   const key=required[i];const imagePath='./assets/meal-photos/nov23/'+jpg(key)+'.jpg';
   const mappings=[...app.matchAll(new RegExp('^\\s*"'+key+'"\\s*:\\s*"([^"]+)"','gm'))];
   if(mappings.length!==1||mappings[0][1]!==imagePath)throw Error('Wrong or duplicate photograph mapping: '+key);
   const live=await fetchLive(imagePath),expected=await local(imagePath.slice(2));
   if(!live.equals(expected)||live[0]!==255||live[1]!==216||live.length<30000)throw Error('Live image bytes invalid: '+imagePath);
   console.log('VERIFIED',meal.day,recipe.title,imagePath,live.length,'bytes',sha(live).slice(0,16));
  }
  const salmon=book.recipes.find(r=>r.id==='sticky-soy-ginger-salmon');
  if(!salmon?.proteins?.mixed?.some(([id])=>id==='chicken')||!salmon?.proteins?.mixed?.some(([id])=>id==='salmon'))throw Error('Mixed salmon/chicken shopping list options not present');
  console.log('SUCCESS: Six correct live food photographs and all app/data files verified byte-for-byte');
  process.exit(0);
 }catch(error){last=error;console.error('Live verification attempt '+attempt+':',error.message);if(attempt<12)await new Promise(resolve=>setTimeout(resolve,15000));}
}
throw Error('Live site verification failed: '+last?.message);
