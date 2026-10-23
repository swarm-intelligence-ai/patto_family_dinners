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
test('kitchen liquids show Australian spoon measures in recipes and shopping',()=>{
 assert.equal(quantity(5,'ml','sesame-oil'),'1 tsp');
 assert.equal(quantity(10,'ml','sesame-oil'),'½ tbsp');
 assert.equal(quantity(20,'ml','soy'),'1 tbsp');
 assert.equal(quantity(30,'ml','honey'),'1½ tbsp');
 assert.equal(quantity(40,'ml','vinegar'),'2 tbsp');
 assert.equal(quantity(25,'ml','sweet-chilli'),'1 tbsp + 1 tsp');
 assert.equal(quantity(7.5,'ml','sesame-oil'),'1½ tsp');
 assert.equal(quantity(10,'ml','stock-chicken'),'10 ml');
 assert.equal(quantity(100,'ml','milk'),'100 ml');
 const dinner=getRecipe(book,week,'crispy-skin-salmon-ginger');
 const sesame=dinner.ingredients.find(([id])=>id==='sesame-oil');
 assert.equal(quantity(sesame[1],book.ingredients['sesame-oil'].unit,'sesame-oil'),'½ tbsp');
 const shopping=consolidateMealSettings(book,week,{});
 const shoppingOil=shopping.find(i=>i.id==='sesame-oil');
 assert.ok(shoppingOil);
 assert.ok(/tsp|tbsp/.test(quantity(shoppingOil.qty,shoppingOil.unit,shoppingOil.id)));
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
 corrupted.nextWeek.meals.splice(0,2);
 assert.throws(()=>publishWeekDraft(book,plans,corrupted),/five or six dinners/i);
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

test('guest count is independent for each dinner and scales its recipe only',()=>{
  const settings=Object.fromEntries(week.meals.map(m=>[m.recipe,{servings:5,protein:'mixed'}]));
  const before=consolidateMealSettings(book,week,settings);
  const recipe=getRecipe(book,week,'thai-basil-beef-veg');
  assert.ok(recipe);
  settings[recipe.id]={servings:6,protein:'mixed'};
  const after=consolidateMealSettings(book,week,settings);
  const baseBeef=recipe.ingredients.find(([id])=>id==='beef')[1];
  assert.equal(Math.round((after.find(i=>i.id==='beef').qty-before.find(i=>i.id==='beef').qty)*1000)/1000,baseBeef/recipe.serves);
  assert.equal(after.find(i=>i.id==='salmon').qty,before.find(i=>i.id==='salmon').qty);
});
test('salmon and chicken selections update only the fish dinner',()=>{
  const id='crispy-skin-salmon-ginger';
  const chicken=consolidateMealSettings(book,week,{[id]:{servings:3,protein:'chicken'}});
  const salmon=consolidateMealSettings(book,week,{[id]:{servings:3,protein:'salmon'}});
  assert.ok(!chicken.some(item=>item.id==='salmon'));
  assert.ok(salmon.some(item=>item.id==='salmon'));
  assert.ok(salmon.find(i=>i.id==='chicken').qty<chicken.find(i=>i.id==='chicken').qty);
});
test('previous current week and its five recipes are frozen in the archive',()=>{
  const old=plans.weeks.find(w=>w.id==='2026-10-12');
  assert.ok(old);
  assert.equal(old.meals.length,5);
  for(const meal of old.meals){
    assert.ok(old.recipeSnapshots[meal.recipe]);
    assert.deepEqual(old.recipeSnapshots[meal.recipe],book.recipes.find(r=>r.id===meal.recipe));
  }
  assert.equal(week.id,'2026-10-26');
  assert.equal(week.meals.length,6);
});
