import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateData,getRecipe,recipeIngredients,consolidate,consolidateMealSettings,quantity,escapeHTML,validMealOrder,mealsInOrder,createWeekDraft,publishWeekDraft} from '../core.js';

const book=JSON.parse(await readFile(new URL('../data/recipes.json',import.meta.url),'utf8'));
const plans=JSON.parse(await readFile(new URL('../data/plans.json',import.meta.url),'utf8'));
const week=plans.weeks.find(w=>w.id===plans.current);
const nextMonday=new Date(Date.parse(`${plans.current}T12:00:00Z`)+7*86400000).toISOString().slice(0,10);

test('published plan, recipes and archived snapshots are valid',()=>{
 assert.equal(validateData(book,plans),true);
 assert.ok(week.meals.length>0);
});
test('family-size grocery quantities consolidate without duplicate lines',()=>{
 const list=consolidate(book,week,5,'mixed');
 assert.equal(list.length,new Set(list.map(item=>item.id)).size);
 const ids=list.map(item=>book.aisles.indexOf(item.aisle));
 assert.deepEqual(ids,[...ids].sort((a,b)=>a-b));
 for(const item of list) assert.ok(item.qty>0);
 const beef=week.meals.reduce((total,m)=>total+recipeIngredients(getRecipe(book,week,m.recipe),5,'mixed').filter(([id])=>id==='beef').reduce((sum,[,qty])=>sum+qty,0),0);
 assert.equal(list.find(i=>i.id==='beef')?.qty,beef);
});
test('fish/chicken variations change only selected dinner ingredients',()=>{
 const salmon=consolidate(book,week,5,'salmon');
 const chicken=consolidate(book,week,5,'chicken');
 const mixed=consolidate(book,week,5,'mixed');
 assert.ok(salmon.some(i=>i.id==='salmon'));
 assert.ok(!chicken.some(i=>i.id==='salmon'));
 assert.ok(mixed.some(i=>i.id==='salmon')&&mixed.some(i=>i.id==='chicken'));
});
test('serving amounts use real-life cooking measures',()=>{
 assert.equal(quantity(1.25,''),'2');
 assert.equal(quantity(1.25,'× 400 g tin'),'2 × 400 g tin');
 assert.equal(quantity(18.75,'ml'),'20 ml');
 assert.equal(quantity(0.3125,'tsp'),'¼ tsp');
 assert.equal(quantity(1.5,'tsp'),'1½ tsp');
 assert.equal(recipeIngredients(book.recipes.find(r=>r.id==='pork-tonkatsu'),5).find(([id])=>id==='egg')[1],2);
});
test('shared order must match exactly the meals in its week',()=>{
 const ids=week.meals.map(m=>m.recipe);
 const reversed=[...ids].reverse();
 assert.ok(validMealOrder(week,reversed));
 assert.deepEqual(mealsInOrder(week,reversed).map(m=>m.recipe),reversed);
 assert.deepEqual(mealsInOrder(week,reversed).map(m=>m.day),week.meals.map(m=>m.day));
 assert.equal(validMealOrder(week,[...ids.slice(0,-1),ids[0]]),false);
 assert.equal(validMealOrder(week,['unrecognised',...ids.slice(1)]),false);
 assert.equal(validMealOrder(week,ids.slice(1)),false);
});
test('drafting does not change live menu; publishing freezes outgoing recipes',()=>{
 const before=JSON.stringify(plans);
 const draft=createWeekDraft(book,plans,nextMonday);
 assert.equal(JSON.stringify(plans),before);
 assert.equal(draft.nextWeek.id,nextMonday);
 assert.equal(draft.outgoingRecipeSnapshots[week.meals[0].recipe].id,week.meals[0].recipe);
 const published=publishWeekDraft(book,plans,draft);
 assert.equal(published.current,nextMonday);
 assert.equal(published.weeks.length,plans.weeks.length+1);
 assert.equal(published.weeks.find(w=>w.id===week.id).recipeSnapshots[week.meals[0].recipe].id,week.meals[0].recipe);
 assert.equal(validateData(book,published),true);
 const modifiedBook=structuredClone(book);
 const id=week.meals[0].recipe;
 modifiedBook.recipes.find(r=>r.id===id).ingredients[0][1]=9999;
 assert.notEqual(getRecipe(modifiedBook,published.weeks.find(w=>w.id===week.id),id).ingredients[0][1],9999);
});
test('invalid drafts and unapproved changes cannot be published',()=>{
 const draft=createWeekDraft(book,plans,nextMonday);
 assert.throws(()=>createWeekDraft(book,plans,plans.current));
 const corrupted=structuredClone(draft);
 corrupted.nextWeek.meals.pop();
 assert.throws(()=>publishWeekDraft(book,plans,corrupted),/five dinners/i);
 const diverged=structuredClone(plans);
 diverged.weeks.find(w=>w.id===plans.current).title='Changed after draft';
 assert.throws(()=>publishWeekDraft(book,diverged,draft),/changed after/i);
 const missing=structuredClone(draft);
 delete missing.outgoingRecipeSnapshots[week.meals[0].recipe];
 assert.throws(()=>publishWeekDraft(book,plans,missing),/snapshots/i);
});
test('broken references and unsafe HTML fail safely',()=>{
 const altered=structuredClone(plans);
 altered.weeks[0].meals[0].recipe='missing';
 assert.throws(()=>validateData(book,altered),/Unknown meal/);
 assert.equal(escapeHTML('<img onerror="bad">'),'&lt;img onerror=&quot;bad&quot;&gt;');
});

test('guest count is independent for each dinner and scales the consolidated shop',()=>{
  const count={};
  for(const meal of week.meals)count[meal.recipe]={servings:5,protein:'mixed'};
  const baseline=consolidateMealSettings(book,week,count);
  const pasta=week.meals.find(m=>m.recipe==='italian-chicken-pasta');
  assert.ok(pasta);
  count[pasta.recipe]={servings:6};
  const updated=consolidateMealSettings(book,week,count);
  const pastaRecipe=getRecipe(book,week,pasta.recipe);
  const chickenBase=pastaRecipe.ingredients.find(([id])=>id==='chicken')[1];
  const before=baseline.find(i=>i.id==='chicken').qty;
  const after=updated.find(i=>i.id==='chicken').qty;
  assert.equal(Math.round((after-before)*1000)/1000,chickenBase/pastaRecipe.serves);
  assert.equal(updated.find(i=>i.id==='beef').qty,baseline.find(i=>i.id==='beef').qty);
});
test('protein can vary on the salmon dinner independently of other dinners',()=>{
  const chicken=consolidateMealSettings(book,week,{'sweet-chilli-bowls':{servings:3,protein:'chicken'}});
  const salmon=consolidateMealSettings(book,week,{'sweet-chilli-bowls':{servings:3,protein:'salmon'}});
  assert.ok(!chicken.some(item=>item.id==='salmon'));
  assert.ok(salmon.some(item=>item.id==='salmon'));
  assert.ok(salmon.find(i=>i.id==='chicken').qty<chicken.find(i=>i.id==='chicken').qty);
});
