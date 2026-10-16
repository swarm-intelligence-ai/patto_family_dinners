import {readFile,writeFile} from 'node:fs/promises';
import {validateData,getRecipe} from '../core.js';
const plansFile=new URL('../data/plans.json',import.meta.url);
const book=JSON.parse(await readFile(new URL('../data/recipes.json',import.meta.url),'utf8'));
const plans=JSON.parse(await readFile(plansFile,'utf8'));
const id=process.argv[2];
if(!id || !/^\d{4}-\d{2}-\d{2}$/.test(id) || Number.isNaN(Date.parse(id)) || new Date(`${id}T12:00:00Z`).toISOString().slice(0,10)!==id || new Date(`${id}T12:00:00Z`).getUTCDay()!==1 || id<=plans.current || plans.weeks.some(w=>w.id===id)) {
  console.error('Use a new Monday after the current week: node scripts/new-week.mjs YYYY-MM-DD');process.exit(1);
}
const current=plans.weeks.find(w=>w.id===plans.current);
current.recipeSnapshots=Object.fromEntries(current.meals.map(m=>[m.recipe,structuredClone(getRecipe(book,current,m.recipe))]));
plans.weeks.push({id,title:'Another week. More happy plates.',note:'Our next five family dinners. Edit this lineup before publishing.',meals:structuredClone(current.meals)});
plans.current=id;
validateData(book,plans);
await writeFile(plansFile,JSON.stringify(plans,null,2)+'\n');
console.log(`Saved ${current.id} and its recipes in the archive. Created ${id} by copying the previous lineup. Edit data/plans.json and data/recipes.json before publishing.`);
