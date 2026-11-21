import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('each current dinner has one distinct real food photo and fallback',async()=>{
 const [app,plans,book]=await Promise.all([
  readFile(new URL('../app.js',import.meta.url),'utf8'),
  readFile(new URL('../data/plans.json',import.meta.url),'utf8').then(JSON.parse),
  readFile(new URL('../data/recipes.json',import.meta.url),'utf8').then(JSON.parse)
 ]);
 const primary=app.split('const photoSources = {')[1]?.split('};')[0];
 const backups=app.split('const backupPhotoSources = {')[1]?.split('};')[0];
 assert.ok(primary&&backups,'Both photo maps must exist');
 const week=plans.weeks.find(w=>w.id===plans.current);
 assert.equal(week.meals.length,6);
 const urls=new Set();
 for(const meal of week.meals){
  const recipe=book.recipes.find(r=>r.id===meal.recipe);
  assert.ok(recipe,'Recipe is present for '+meal.recipe);
  const key=recipe.art;
  const mapping=new RegExp('"'+key+'"\\s*:\\s*"([^\"]+)"','g');
  const main=[...primary.matchAll(mapping)].map(m=>m[1]);
  const secondary=[...backups.matchAll(mapping)].map(m=>m[1]);
  assert.equal(main.length,1,'Exactly one primary for '+recipe.title);
  assert.equal(secondary.length,1,'Exactly one fallback for '+recipe.title);
  for(const url of [...main,...secondary]){
   assert.match(url,/^https:\/\//,'Current dinner images must be real hosted photos: '+key);
   assert.equal(urls.has(url),false,'No reused photo across dinners');
   urls.add(url);
  }
 }
});
