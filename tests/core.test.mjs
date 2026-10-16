import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {consolidate,validateData,getRecipe,recipeIngredients,quantity,escapeHTML} from '../core.js';
const book=JSON.parse(await readFile(new URL('../data/recipes.json',import.meta.url),'utf8'));
const plans=JSON.parse(await readFile(new URL('../data/plans.json',import.meta.url),'utf8'));
const week=plans.weeks.find(w=>w.id===plans.current);
test('all weekly references, recipe methods and grocery aisles are valid',()=>assert.equal(validateData(book,plans),true));
test('shared ingredients consolidate across five dinners in aisle order',()=>{
  const items=consolidate(book,week,4,'salmon');
  assert.equal(items.find(i=>i.id==='beef').qty,1100);
  assert.equal(items.find(i=>i.id==='tomato').qty,900);
  assert.equal(items.find(i=>i.id==='garlic').qty,9);
  assert.equal(items.find(i=>i.id==='rice').qty,480);
  assert.equal(items.find(i=>i.id==='yoghurt').qty,420);
  assert.equal(items.length,new Set(items.map(i=>i.id)).size);
  const indices=items.map(i=>book.aisles.indexOf(i.aisle));assert.deepEqual(indices,[...indices].sort((a,b)=>a-b));
});
test('Friday chicken removes salmon and adds to Thursday chicken',()=>{
  const items=consolidate(book,week,4,'chicken');assert.ok(!items.some(i=>i.id==='salmon'));assert.equal(items.find(i=>i.id==='chicken').qty,1200);
});
test('half-and-half and portion scaling preserve shared totals',()=>{
  const items=consolidate(book,week,6,'mixed');
  assert.equal(items.find(i=>i.id==='salmon').qty,450);assert.equal(items.find(i=>i.id==='chicken').qty,1350);assert.equal(items.find(i=>i.id==='rice').qty,720);
});
test('recipe quantities scale independently of fixed method time',()=>{
  const recipe=book.recipes.find(r=>r.id==='pork-tonkatsu');assert.equal(recipeIngredients(recipe,2).find(([id])=>id==='egg')[1],.5);
});
test('historical recipes stay frozen when the live recipe changes',()=>{
  const frozen=structuredClone(week);frozen.recipeSnapshots={'mediterranean-beef':structuredClone(book.recipes[0])};const edited=structuredClone(book);edited.recipes[0].ingredients[0][1]=999;
  assert.equal(getRecipe(edited,frozen,'mediterranean-beef').ingredients[0][1],600);
});
test('invalid data fails before rendering or deployment',()=>{
  const bad=structuredClone(plans);bad.weeks[0].meals[0].recipe='missing';assert.throws(()=>validateData(book,bad),/Unknown meal/);
  const invalid=structuredClone(book);invalid.recipes[0].ingredients[0][1]=-1;assert.throws(()=>validateData(invalid,plans),/Invalid ingredient/);
});
test('grocery edits cannot become markup and quantities stay readable',()=>{assert.equal(escapeHTML('<img onerror="bad">'),'&lt;img onerror=&quot;bad&quot;&gt;');assert.equal(quantity(1.5,'× 400 g tin'),'1.5 × 400 g tin');});
