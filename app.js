import {validateData, getRecipe, recipeIngredients, consolidate, consolidateMealSettings, quantity, weekLabel, mealsInOrder, validMealOrder, escapeHTML as e} from './core.js';

const photoSources = {
  "mediterranean": "https://img.hellofresh.com/f_auto%2Cfl_lossy%2Ch_640%2Cq_auto%2Cw_1200/hellofresh_s3/image/mediterranean-style-beef-bowl-26170e17.jpg",
  "tonkatsu": "https://img.hellofresh.com/f_auto%2Cfl_lossy%2Ch_640%2Cq_auto%2Cw_1200/hellofresh_s3/image/southern-crumbed-pork-slaw-5c7cea7f-b277dde3.jpg",
  "burrito": "https://freshforklab.com/assets/images/1768562036399-gwh3g09x.webp",
  "pasta": "https://dishanddelights.com/wp-content/uploads/2025/07/pakoblog__Chicken_Zucchini_Pasta_Skillet_front_angle_shot_low_a_66f00475-96ec-41e9-9fab-0eac1f5262a8.webp",
  "salmon": "https://platefullyjoy.com/cdn-cgi/image/fit%3Dcontain%2Cwidth%3D768%2Cquality%3D80%2Cformat%3Dauto/assets/images/1763241280263-6g5ajo7m.webp",
  "mustard-chicken": "https://www.bistromd.com/cdn/shop/files/HoneyMustardChickenwithRosemaryMashedPotatonew.png?v=1760032612",
  "teriyaki-bowls": "https://dashnosh.com/assets/images/1766220780136-39zs7kh2.webp",
  "stroganoff": "https://avarecipes.com/wp-content/uploads/2024/07/Simple-Beef-Stroganoff-Recipe.png",
  "pork-wraps": "https://v.cdn.ww.com/media/system/wine/5996ece2b0a1a625825a7ad7/708dc88e-cb7d-41af-b405-3bee3768d070/wsyb196tofnux6zfil7o.jpg",
  "fried-rice": "https://www.zoopindia.com/_next/image?q=75&url=https%3A%2F%2Fmedia.zoopindia.com%2Fixigo-outlets-images%2Fi1573.webp&w=580",
  "cheeseburgers": "https://i.pinimg.com/originals/c9/96/d2/c996d2b5b84306b7a867b232aecb5261.jpg"
};
const imageFor = r => photoSources[r.art] || `./assets/${r.art}.svg`;
const fallbackFor = r => `./assets/${r.art}.svg`;

const main = document.querySelector('main');
const recipeDialog = document.querySelector('#recipe-dialog');
let book, plans, selectedWeek, openedRecipe, storageOK = true;
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(`patto:${key}`)) ?? fallback; } catch { storageOK = false; return fallback; } };
const write = (key, value) => { try { localStorage.setItem(`patto:${key}`, JSON.stringify(value)); } catch { storageOK = false; toast('Browser storage is unavailable. Keep this tab open or export your list.'); } };
const prefs = read('preferences', {});
// Retain the legacy grocery-list storage key so Kym's existing ticks and removals survive.
const legacyServings=Number.isInteger(prefs.servings) && prefs.servings>=2 && prefs.servings<=10 ? prefs.servings : 5;
const legacyProtein=['salmon','chicken','mixed'].includes(prefs.protein) ? prefs.protein : 'mixed';
let mealSettings={};
function loadMealSettings() {
  const saved=read(`meal-settings:${selectedWeek}`,{});
  mealSettings=saved && typeof saved==='object' && !Array.isArray(saved)?saved:{};
}
function mealChoice(id) {
  const value=mealSettings[id]||{};
  const servings=Number.isInteger(value.servings)&&value.servings>=1&&value.servings<=20?value.servings:5;
  const protein=['salmon','chicken','mixed'].includes(value.protein)?value.protein:'mixed';
  return {servings,protein};
}
function updateMealChoice(id,prop,value) {
  if(!current().meals.some(m=>m.recipe===id)) return;
  mealSettings[id]={...mealChoice(id),[prop]:value};
  write(`meal-settings:${selectedWeek}`,mealSettings);
  const currentScroll=window.scrollY;
  const recipeOpen=recipeDialog.open && openedRecipe?.id===id;
  const dialogScroll=recipeOpen?recipeDialog.scrollTop:0;
  const checkedIds=recipeOpen?[...recipeDialog.querySelectorAll('.ingredient-list input:checked')].map(el=>el.dataset.ingredient):[];
  const activeSetting=recipeOpen?(document.activeElement?.dataset.recipeServings?'servings':document.activeElement?.dataset.recipeProtein?'protein':null):null;
  render();
  window.scrollTo(0,currentScroll);
  if(recipeOpen) {
    openRecipe(id);
    for(const ingredient of checkedIds) {
      const field=[...recipeDialog.querySelectorAll('.ingredient-list input')].find(el=>el.dataset.ingredient===ingredient);
      if(field) field.checked=true;
    }
    recipeDialog.scrollTop=dialogScroll;
    if(activeSetting) recipeDialog.querySelector(activeSetting==='servings'?'[data-recipe-servings]':'[data-recipe-protein]')?.focus({preventScroll:true});
  }
  toast('Dinner portions updated. Aldi list recalculated.');
}
let favourites = read('favourites', []); if (!Array.isArray(favourites)) favourites = [];
let search = '', filter = 'all', list, toastTimer;
const icon = (name) => ({clock:'◷',arrow:'↗',heart:'♡',check:'✓'}[name]);

const current = () => plans.weeks.find(w => w.id === selectedWeek);
function orderedMeals(week) {
  const saved=read(`meal-order:${week.id}`, []);
  return mealsInOrder(week,saved);
}
function shareUrl() {
  const ids=orderedMeals(current()).map(m=>m.recipe);
  const params=new URLSearchParams({week:selectedWeek,order:ids.join(','),guests:ids.map(id=>mealChoice(id).servings).join(',')});
  const proteinMeal=current().meals.find(m=>getRecipe(book,current(),m.recipe).proteins);
  if(proteinMeal) params.set('protein',mealChoice(proteinMeal.recipe).protein);
  return `${location.origin}${location.pathname}${location.search}#week?${params.toString()}`;
}
async function shareWeek() {
  const url=shareUrl();
  const title='The Patto Dinner Club — our week';
  try {
    if (navigator.share) { await navigator.share({title,text:'Here’s our dinner lineup for the week.',url}); return; }
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); toast('Week link copied. Send it to Kym!'); return; }
    window.prompt('Copy this link to share our week:',url);
  } catch (error) {
    if (error?.name !== 'AbortError') window.prompt('Copy this link to share our week:',url);
  }
}
function applySharedLink() {
  const [page,search] = location.hash.slice(1).split('?');
  if (page !== 'week' || !search) return false;
  const params = new URLSearchParams(search);
  const week = plans.weeks.find(w=>w.id===params.get('week'));
  const ids = (params.get('order') || '').split(',');
  if (!validMealOrder(week,ids)) return false;
  selectedWeek=week.id;
  loadMealSettings();
  const guests=params.get('guests');
  if(guests) {
    const counts=guests.split(',');
    if(counts.length===ids.length && counts.every(n=>/^([1-9]|10)$/.test(n))) {
      ids.forEach((id,i)=>{mealSettings[id]={...mealChoice(id),servings:Number(counts[i])};});
    }
  }
  const sharedProtein=params.get('protein');
  if(['salmon','chicken','mixed'].includes(sharedProtein)) {
    const dish=week.meals.find(m=>getRecipe(book,week,m.recipe).proteins);
    if(dish) mealSettings[dish.recipe]={...mealChoice(dish.recipe),protein:sharedProtein};
  }
  write(`meal-settings:${week.id}`,mealSettings);
  write(`meal-order:${week.id}`,ids);
  history.replaceState(null,'',`${location.pathname}${location.search}#${week.id===plans.current?'week':`archived-${week.id}`}`);
  return true;
}
function moveDinner(from, shift) {
  const meals=orderedMeals(current());
  const to=from+shift;
  if(to<0||to>=meals.length)return;
  const ids=meals.map(m=>m.recipe);
  [ids[from],ids[to]]=[ids[to],ids[from]];
  write(`meal-order:${selectedWeek}`,ids);
  const y=window.scrollY;
  render();
  window.scrollTo(0,y);
  document.querySelector(`[data-dinner-position="${to}"]`)?.focus({preventScroll:true});
  toast('Dinner order saved on this device.');
}

const route = () => {
  const name=location.hash.slice(1).split('?')[0];
  if (/^archived-\d{4}-\d{2}-\d{2}$/.test(name)) return 'archived';
  return ['week','recipes','groceries','archive'].includes(name) ? name : 'week';
};
function syncWeekWithRoute() {
  const archived=location.hash.match(/^#archived-(\d{4}-\d{2}-\d{2})/);
  if(archived) {
    const match=plans.weeks.find(w=>w.id===archived[1] && w.id!==plans.current);
    if(match && selectedWeek!==match.id){selectedWeek=match.id;loadMealSettings();}
  } else if (route()==='week' && !location.hash.includes('?') && selectedWeek!==plans.current) {
    selectedWeek=plans.current;loadMealSettings();
  }
}
function toast(message) { clearTimeout(toastTimer); const t=document.querySelector('#toast'); t.textContent=message;t.classList.add('show');toastTimer=setTimeout(()=>t.classList.remove('show'),4000); }
function storageKey() { return `list:${selectedWeek}:${legacyServings}:${legacyProtein}`; }
function loadList() {
  const raw=read(storageKey(), {});
  const revision=JSON.stringify(current());
  const fingerprint=JSON.stringify(current().meals.map(m=>getRecipe(book,current(),m.recipe)));
  list={checks:{},edits:{},removed:[],extras:[],...(raw && typeof raw === 'object' ? raw : {}), revision,fingerprint};
  if (!list.checks || typeof list.checks!=='object') list.checks={};
  if (!list.edits || typeof list.edits!=='object') list.edits={};
  if (!Array.isArray(list.removed)) list.removed=[];
  if (!Array.isArray(list.extras)) list.extras=[];
}
const saveList=()=>write(storageKey(),list);
function listItems() {
  return [...consolidateMealSettings(book,current(),mealSettings).map(i=>({...i,amount:quantity(i.qty,i.unit)})),...list.extras].filter(i=>!list.removed.includes(i.id)).map(i=>({...i,...list.edits[i.id]}));
}
function dinnerSettings(r) {
  const choice=mealChoice(r.id);
  return `<div class="dinner-settings"><label>Cooking for <select data-dinner-servings="${e(r.id)}" aria-label="Number of people eating ${e(r.title)}">${Array.from({length:10},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===choice.servings?'selected':''}>${n} ${n===1?'person':'people'}</option>`).join('')}</select></label>${r.proteins?`<label>Protein <select data-dinner-protein="${e(r.id)}" aria-label="Protein for ${e(r.title)}"><option value="mixed" ${choice.protein==='mixed'?'selected':''}>Salmon + chicken</option><option value="salmon" ${choice.protein==='salmon'?'selected':''}>All salmon</option><option value="chicken" ${choice.protein==='chicken'?'selected':''}>All chicken</option></select></label>`:''}</div>`;
}
function card(r, day, position = -1, count = 0) {
  const liked=favourites.includes(r.id);
  return `<article class="meal-card"><div class="meal-art" style="--meal-colour:${r.colour}"><button class="art-open" data-recipe="${e(r.id)}" aria-label="Open ${e(r.title)}"><img src="${e(imageFor(r))}" data-fallback="${e(fallbackFor(r))}" alt="${e(r.title)} plated for dinner" loading="lazy" decoding="async" width="430" height="410"></button><span class="meal-day">${e(day||r.cuisine)}</span><button class="favourite ${liked?'is-liked':''}" data-favourite="${e(r.id)}" aria-label="${liked?'Remove':'Add'} ${e(r.title)} ${liked?'from':'to'} favourites" aria-pressed="${liked}">${liked?'♥':'♡'}</button></div><div class="meal-copy"><p class="meal-meta">${e(r.cuisine)} <span>${icon('clock')} ${r.time} min</span></p><h3><button data-recipe="${e(r.id)}">${e(r.title)}</button></h3><p>${e(r.subtitle)}</p><button class="recipe-link" data-recipe="${e(r.id)}">Let’s get cooking <span aria-hidden="true">↗</span></button>${position >= 0 ? dinnerSettings(r) : ''}${position >= 0 ? `<div class="meal-reorder"><span>Change dinner night</span><div><button data-move="-1" data-index="${position}" data-dinner-position="${position}" aria-label="Move ${e(r.title)} earlier" ${position === 0 ? 'disabled' : ''}>↑</button><button data-move="1" data-index="${position}" aria-label="Move ${e(r.title)} later" ${position === count-1 ? 'disabled' : ''}>↓</button></div></div>` : ''}</div></article>`;
}
function weekView() {
  const w=current(), isCurrent=w.id===plans.current;
  return `<section class="hero"><div class="hero-copy"><h1>The Patto<br><em>Dinner Club.</em></h1><p class="hero-description">Less dinner drama. More happy plates.</p><a class="button" href="#groceries">Get the shopping list <span aria-hidden="true">↗</span></a><div class="hero-footnote"><span class="mini-p-logo" aria-hidden="true">P</span> Five dinners. Five Patto opinions. Zero boring plates.</div></div><div class="hero-visual patto-chefs"><div class="hero-circle"></div><img src="./assets/patto-chefs.webp" data-fallback="${photoSources.mediterranean}" alt="Cartoon Kym and Anthony cooking together in the Patto kitchen" width="1536" height="1024" fetchpriority="high"><p class="handwritten">Kym cooks.<br>Anthony taste-tests.</p></div></section><section aria-labelledby="week-title"><div class="section-heading"><div><p class="eyebrow">${isCurrent?'ON THE MENU':'ARCHIVED MENU · NOT THIS WEEK'} · WEEK OF ${e(weekLabel(w.id).toUpperCase())}</p><h2 id="week-title">${e(w.title)}</h2></div><a class="text-link" href="#archive">Browse weeks <span aria-hidden="true">↗</span></a></div><p class="section-description">${e(w.note)}</p><div class="week-share-tools"><p class="reorder-hint">↕ Rearrange the meals below, then share your week. The link shares dinner order and guest numbers — not anybody’s shopping ticks.</p><button class="outline-button share-week-button" id="share-week" type="button" aria-label="Share this week’s dinner order">↗ Share our week</button></div>${!isCurrent?'<div class="notice"><strong>This is a previous week.</strong> <button class="text-button" data-current>↖ Return to this week’s dinners</button></div>':''}<div class="meal-grid">${orderedMeals(w).map((m,i,items)=>card(getRecipe(book,w,m.recipe),m.day,i,items.length)).join('')}<aside class="shopping-card"><span class="mini-p-logo mini-p-logo--large shopping-flower" aria-hidden="true">P</span><p class="eyebrow">THE OTHER HALF OF THE PLAN</p><h3>One shop.<br>Five happy<br>dinners.</h3><p>Everything you need, added up and sorted for an Aldi-style shop.</p><a class="button button-cream" href="#groceries">Let’s shop <span aria-hidden="true">↗</span></a><small>Tick it. Tweak it. Get dinner sorted.</small></aside></div></section><section class="family-strip"><span class="mini-p-logo" aria-hidden="true">P</span><div><h2>The Patto sous-chef squad.</h2><p>Leila, Phoebe and Tobias: kitchen jobs are officially on the menu. Kym's not running a restaurant, you know.</p></div><a class="text-link" href="#recipes">Find your next kitchen job ↗</a></section>`;
}
function cookbookView() {
  return `<section class="page-intro"><p class="eyebrow">GOOD THINGS, WORTH KEEPING</p><h1>The family<br><em>cookbook.</em></h1><p>Our dinner rotation, all in one delicious place.</p></section><div class="cookbook-tools"><label class="search-label"><span class="sr-only">Search recipes</span><input type="search" id="recipe-search" placeholder="Find a dish, ingredient or flavour…" value="${e(search)}"></label><div class="filters" aria-label="Recipe filters">${[['all','All recipes'],['quick','30 minutes'],['favourites','Favourites']].map(([id,label])=>`<button data-filter="${id}" aria-pressed="${filter===id}" class="${filter===id?'active':''}">${label}</button>`).join('')}</div></div><div id="recipe-results"></div>`;
}
function allRecipes() {
  const found=new Map(book.recipes.map(r=>[r.id,r]));
  for(const w of plans.weeks) for(const r of Object.values(w.recipeSnapshots||{})) if(!found.has(r.id)) found.set(r.id,r);
  return [...found.values()];
}
function renderResults() {
  const recipes=allRecipes().filter(r=>{
    const ingredients=[...r.ingredients,...Object.values(r.proteins||{}).flat()].map(([id])=>book.ingredients[id].name).join(' ');
    return `${r.title} ${r.cuisine} ${ingredients}`.toLowerCase().includes(search.trim().toLowerCase()) && (filter!=='quick'||r.time<=30) && (filter!=='favourites'||favourites.includes(r.id));
  });
  document.querySelector('#recipe-results').innerHTML=`<p class="results-count">${recipes.length} recipe${recipes.length===1?'':'s'} for our table</p>${recipes.length?`<div class="meal-grid">${recipes.map(r=>card(r)).join('')}</div>`:`<div class="empty-state"><h2>${filter==='favourites'?'Your favourites start here.':'No plates found.'}</h2><p>${filter==='favourites'?'Tap the heart on any recipe to save it here.':'Try another ingredient or clear the filters.'}</p><button class="button" data-clear-search>Show all recipes</button></div>`}`;
}
function groceryView() {
  loadList();
  return `<section class="page-intro grocery-intro"><div><p class="eyebrow">ONE SHOP, THEN YOU’RE SORTED</p><h1>The shopping<br><em>list.</em></h1><p>Week of ${e(weekLabel(selectedWeek))} · Five nights at our table.</p></div><div class="shopping-actions"><button class="button" id="download-list">Export list ↓</button><button class="outline-button" id="print-list">Print list</button></div></section><p class="local-note">Dinner guest counts and protein choices are set on each meal card under This week. Edits and ticks save on this device. Export to share with the family. Aisle order varies by store; round recipe amounts up to whole produce and packs.</p><div id="grocery-progress"></div><div class="grocery-toolbar"><label><input type="checkbox" id="hide-checked"> Hide ticked items</label><button class="text-button" id="reset-list">Reset this list</button></div><div id="aisles"></div><form class="add-form" id="add-item"><h2>Anything else?</h2><div class="add-fields"><label>Item<input name="item" required maxlength="80" placeholder="Lunchbox apples, perhaps?"></label><label>Amount<input name="amount" maxlength="40" placeholder="1 bag"></label><label>Aisle<select name="aisle">${book.aisles.map(a=>`<option>${e(a)}</option>`).join('')}</select></label><button class="button" type="submit">Add to list +</button></div></form><p class="local-note">Pantry staples are included so nothing gets missed. Tick the things you already have. Ingredient quantities follow each dinner's guest count.</p>`;
}
const mealTags = {
  'mediterranean-beef':'Beef bowls',
  'pork-tonkatsu':'Tonkatsu',
  'burrito-bowls':'Burrito',
  'italian-chicken-pasta':'Pasta',
  'sweet-chilli-bowls':'Salmon / chicken'
};
function ingredientUses() {
  const uses = new Map();
  for (const meal of orderedMeals(current())) {
    const recipe = getRecipe(book, current(), meal.recipe);
    for (const [id] of recipeIngredients(recipe, mealChoice(recipe.id).servings, mealChoice(recipe.id).protein)) {
      const entries = uses.get(id) || [];
      if (!entries.some(entry => entry.id === recipe.id)) entries.push({id:recipe.id, title:recipe.title, label:mealTags[recipe.id] || recipe.title, day:meal.day});
      uses.set(id, entries);
    }
  }
  return uses;
}
function renderGroceries() {
  const items=listItems(), checked=items.filter(i=>list.checks[i.id]).length, hide=document.querySelector('#hide-checked').checked, uses=ingredientUses();
  document.querySelector('#grocery-progress').innerHTML=`<div class="progress-label"><strong>${checked===items.length&&items.length?'Shop sorted. Nice one!':`${checked} of ${items.length} items sorted`}</strong><span>${items.length?Math.round(checked/items.length*100):0}%</span></div><progress value="${checked}" max="${items.length||1}" aria-label="Shopping items sorted"></progress>`;
  document.querySelector('#aisles').innerHTML=book.aisles.map((aisle,n)=>{
    const group=items.filter(i=>i.aisle===aisle), visible=group.filter(i=>!hide||!list.checks[i.id]);
    if(!group.length) return '';
    return `<section class="aisle"><div class="aisle-heading"><span class="aisle-number">0${n+1}</span><h2>${e(aisle)}</h2><span>${group.filter(i=>list.checks[i.id]).length}/${group.length}</span></div>${visible.length?visible.map(i=>`<div class="grocery-row ${list.checks[i.id]?'checked':''}" data-item="${e(i.id)}"><div class="grocery-main"><label class="grocery-check"><input type="checkbox" data-check="${e(i.id)}" ${list.checks[i.id]?'checked':''}><span>${e(i.name)}</span></label>${uses.has(i.id)?`<button type="button" class="used-trigger" data-used="${e(i.id)}" aria-label="Show which dinner uses ${e(i.name)}" aria-expanded="false" title="See which dinner uses this">${e(uses.get(i.id).length===1?uses.get(i.id)[0].label:`${uses.get(i.id).length} meals`)}</button>`:''}</div><span class="grocery-amount">${e(i.amount)}</span><button class="item-edit" data-edit="${e(i.id)}" aria-label="Edit ${e(i.name)}">Edit</button><button class="item-remove" data-remove="${e(i.id)}" aria-label="Remove ${e(i.name)}">×</button>${uses.has(i.id)?`<div class="used-popover" hidden><strong>Needed for</strong>${uses.get(i.id).map(u=>`<div>${e(u.title)}</div>`).join('')}</div>`:''}</div>`).join(''):'<p class="aisle-done">All sorted in this aisle ✓</p>'}</section>`;
  }).join('');
}
function archiveView() {
  const weeks=[...plans.weeks].sort((a,b)=>b.id.localeCompare(a.id)), older=weeks.filter(w=>w.id!==plans.current);
  return `<section class="page-intro"><p class="eyebrow">KEEP THE GOOD WEEKS CLOSE</p><h1>Our dinner<br><em>scrapbook.</em></h1><p>A home for every weekly plan, and the recipes we’ll come back to.</p></section><div class="archive-grid">${weeks.map(w=>`<article class="archive-card"><p class="eyebrow">${w.id===plans.current?'THE CURRENT LINEUP':'FROM OUR TABLE'} · ${e(weekLabel(w.id))}</p><h2>${e(w.title)}</h2><ul>${orderedMeals(w).map(m=>`<li><span class="archive-weekday">${e(m.day.slice(0,3))}</span><img class="archive-meal-photo" src="${e(imageFor(getRecipe(book,w,m.recipe)))}" data-fallback="${e(fallbackFor(getRecipe(book,w,m.recipe)))}" alt="" loading="lazy" decoding="async" width="58" height="58"><span class="archive-meal-name">${e(getRecipe(book,w,m.recipe).title)}</span></li>`).join('')}</ul><button class="button" data-week="${e(w.id)}">${w.id===plans.current?'Open current week':'View archived menu'} ↗</button></article>`).join('')}${!older.length?'<aside class="archive-empty"><span class="mini-p-logo" aria-hidden="true">P</span><h2>The first page<br>of a good thing.</h2><p>This is our first saved weekly plan. Earlier full plans weren’t available in the conversation, so this scrapbook will grow from here.</p><p>New weeks appear here when the cookbook’s plan file is updated.</p></aside>':''}</div>`;
}
function render() {
  const page=route();
  document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===(page==='archived'?'archive':page))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  main.innerHTML=({week:weekView,archived:weekView,recipes:cookbookView,groceries:groceryView,archive:archiveView}[page])();
  if(page==='recipes')renderResults(); if(page==='groceries')renderGroceries();
  document.title=`${{week:'This week',archived:'Archived dinner week',recipes:'The cookbook',groceries:'Shopping list',archive:'Weekly archive'}[page]} · The Patto Family Social`;
}
function openRecipe(id) {
  const r=route()==='recipes'?allRecipes().find(r=>r.id===id):getRecipe(book,current(),id); if(!r)return;
  openedRecipe=r;
  const choice=mealChoice(r.id);
  const nutrition=r.proteinNutrition?.[choice.protein]||r.nutrition;
  recipeDialog.innerHTML=`<button class="dialog-close" data-close="recipe-dialog" aria-label="Close recipe">×</button><div class="recipe-banner" style="--meal-colour:${r.colour}"><img src="${e(imageFor(r))}" data-fallback="${e(fallbackFor(r))}" alt="${e(r.title)} served and ready to eat" width="240" height="230"><div><p class="eyebrow">${e(r.cuisine)} · ${r.time} MINUTES</p><h2 id="recipe-title">${e(r.title)}</h2><p>${e(r.subtitle)}</p></div></div><div class="recipe-body"><div class="recipe-actions"><div class="recipe-edit-controls">${dinnerSettings(r).replaceAll('data-dinner-servings=', 'data-recipe-servings=').replaceAll('data-dinner-protein=', 'data-recipe-protein=')}</div><button class="outline-button" id="print-recipe">Print recipe</button></div><p class="small-note">Adjust guests${r.proteins?' or protein':''} here. Ingredients, the weekly meal card and Aldi list update together.</p><div class="recipe-columns"><section><h3>The ingredients</h3><p class="small-note">Tick as you cook. Quantities are rounded to useful kitchen measures.</p><ul class="ingredient-list">${recipeIngredients(r,choice.servings,choice.protein).map(([id,qty])=>`<li><label><input type="checkbox" data-ingredient="${e(id)}"><span><strong>${e(quantity(qty,book.ingredients[id].unit))}</strong> ${e(book.ingredients[id].name)}</span></label></li>`).join('')}</ul></section><section><h3>Let’s make dinner</h3><ol class="method">${r.steps.map(([title,body])=>`<li><h4>${e(title)}</h4><p>${e(body)}</p></li>`).join('')}</ol></section></div><div class="family-notes"><section><p class="eyebrow">MAKE IT YOURS</p><h3>Everyone gets a happy plate.</h3><p>${e(r.family)}</p><p>${e(r.variation)}</p></section><section><p class="eyebrow">LITTLE HANDS, BIG HELP</p><h3>A job for the kids.</h3><p>${e(r.kidJob)}</p><p><strong>Get ahead:</strong> ${e(r.prepTip)}</p></section></div><section class="nutrition"><h3>A little nourishment.</h3><div class="nutrition-values"><span><strong>~${nutrition.kcal}</strong> kcal</span><span><strong>~${nutrition.protein} g</strong> protein</span><span><strong>~${nutrition.fibre} g</strong> fibre</span></div><p>${e(r.nutrition.note)}</p><p class="small-note">Rough estimates per equal serving, based on original recipe yield (${r.serves}); not lab-verified or personalised for children. Scaling the whole recipe keeps the estimate per serving similar. Swaps and brands change it.${choice.protein==='mixed'&&r.proteins?' Mixed values average both proteins; individual bowls differ.':''}</p><p><strong>Allergen check:</strong> ${e(r.allergens)}</p><p class="small-note">Cook chicken and mince to at least 75°C in the centre. Keep raw and ready-to-eat food separate. Refrigerate leftovers promptly. <a href="https://www.foodstandards.gov.au/consumer/prevention-of-foodborne-illness/food-safety-basics" target="_blank" rel="noreferrer">FSANZ food safety guidance ↗</a></p></section></div>`;
  if(!recipeDialog.open)recipeDialog.showModal();
  recipeDialog.scrollTop=0;
}
function download(name, content) { const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function exportList() {
  const items=listItems(); let text=`THE PATTO DINNER CLUB\nWeek of ${weekLabel(selectedWeek)}\n${current().meals.map(m=>`${m.day}: ${mealChoice(m.recipe).servings} people`).join(' · ')}\n\n`;
  for(const aisle of book.aisles) {const group=items.filter(i=>i.aisle===aisle);if(group.length)text+=`${aisle.toUpperCase()}\n${group.map(i=>`[${list.checks[i.id]?'x':' '}] ${i.name} — ${i.amount}`).join('\n')}\n\n`;}
  download(`patto-shopping-${selectedWeek}.txt`,text);toast('Shopping list exported. Ready to share.');
}
function editItem(id) {
  const item=listItems().find(i=>i.id===id), row=[...document.querySelectorAll('[data-item]')].find(r=>r.dataset.item===id);
  row.innerHTML=`<form class="edit-form" data-edit-form="${e(id)}"><label>Item<input name="name" required maxlength="80" value="${e(item.name)}"></label><label>Amount<input name="amount" required maxlength="40" value="${e(item.amount)}"></label><button class="button" type="submit">Save</button><button type="button" class="text-button" data-cancel-edit>Cancel</button></form>`;
  row.querySelector('input').focus();
}

document.addEventListener('error',event=>{const img=event.target;if(img instanceof HTMLImageElement && img.dataset.fallback && img.src!==new URL(img.dataset.fallback,location.href).href){img.src=img.dataset.fallback;img.removeAttribute('data-fallback');}},true);
document.addEventListener('click',event=>{
  const target=event.target.closest('button, a'); if(!target)return;
  // This week always means the published current week, even after browsing history.
  if(target.matches('[data-nav="week"]') || target.matches('.brand')) {
    selectedWeek=plans.current;loadMealSettings();
    if(route()==='week' && location.hash==='#week') render();
  }
  if(target.dataset.recipe)openRecipe(target.dataset.recipe);
  if(target.id==='share-week')shareWeek();
  if(target.dataset.move !== undefined) moveDinner(Number(target.dataset.index),Number(target.dataset.move));
  if(target.dataset.close)document.getElementById(target.dataset.close).close();
  if(target.dataset.favourite){const id=target.dataset.favourite;favourites=favourites.includes(id)?favourites.filter(v=>v!==id):[...favourites,id];write('favourites',favourites);const y=scrollY;render();window.scrollTo(0,y);toast(favourites.includes(id)?'Saved to family favourites.':'Removed from favourites.');}
  if(target.dataset.filter){filter=target.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',b.dataset.filter===filter);});renderResults();}
  if(target.hasAttribute('data-clear-search')){search='';filter='all';render();}
  if(target.dataset.week){const id=target.dataset.week;selectedWeek=id;loadMealSettings();const destination=id===plans.current?'week':`archived-${id}`;if(location.hash.slice(1)===destination)render();else location.hash=destination;window.scrollTo(0,0);}
  if(target.hasAttribute('data-current')){selectedWeek=plans.current;loadMealSettings();if(location.hash==='#week')render();else location.hash='week';}
  if(target.dataset.used) {
    const row=target.closest('.grocery-row'), pop=row?.querySelector('.used-popover');
    if(pop) {
      const willOpen=pop.hidden;
      document.querySelectorAll('.used-popover:not([hidden])').forEach(p=>{p.hidden=true;p.closest('.grocery-row')?.querySelector('.used-trigger')?.setAttribute('aria-expanded','false');});
      pop.hidden=!willOpen;
      target.setAttribute('aria-expanded',String(willOpen));
    }
  }
  if(target.dataset.edit)editItem(target.dataset.edit);
  if(target.hasAttribute('data-cancel-edit'))renderGroceries();
  if(target.dataset.remove){const id=target.dataset.remove;list.removed.push(id);saveList();renderGroceries();toast('Removed. Reset this list to restore all items.');}
  if(target.id==='download-list')exportList();
  if(target.id==='print-list'){document.body.dataset.print='list';window.print();}
  if(target.id==='print-recipe'){document.body.dataset.print='recipe';window.print();}
  if(target.id==='reset-list'&&confirm('Reset this list? This clears your edits, ticks and extra items for this week, portion count and Friday choice.')){list={checks:{},edits:{},removed:[],extras:[],revision:list.revision,fingerprint:list.fingerprint};saveList();renderGroceries();toast('Fresh list. Ready when you are.');}
  if(target.id==='about-button')document.querySelector('#about-dialog').showModal();
});
document.addEventListener('input',event=>{if(event.target.id==='recipe-search'){search=event.target.value;renderResults();}});
document.addEventListener('change',event=>{
  const t=event.target;
  if(t.dataset.recipeServings) {
    updateMealChoice(t.dataset.recipeServings,'servings',Number(t.value));
    return;
  }
  if(t.dataset.recipeProtein) {
    updateMealChoice(t.dataset.recipeProtein,'protein',t.value);
    return;
  }
  if(t.dataset.dinnerServings) {
    updateMealChoice(t.dataset.dinnerServings,'servings',Number(t.value));
    return;
  }
  if(t.dataset.dinnerProtein) {
    updateMealChoice(t.dataset.dinnerProtein,'protein',t.value);
    return;
  }
  if(t.dataset.check){list.checks[t.dataset.check]=t.checked;saveList();const id=t.dataset.check;renderGroceries();document.querySelector(`[data-check="${CSS.escape(id)}"]`)?.focus({preventScroll:true});}
  if(t.id==='hide-checked')renderGroceries();
});
document.addEventListener('submit',event=>{
  const form=event.target; if(form.id!=='add-item'&&!form.dataset.editForm)return;event.preventDefault();const data=new FormData(form);
  if(form.id==='add-item'){const name=String(data.get('item')).trim();if(!name)return;list.extras.push({id:`extra-${crypto.randomUUID()}`,name,amount:String(data.get('amount')).trim()||'As needed',aisle:String(data.get('aisle'))});form.reset();toast('Added to the shopping list.');}
  else{const name=String(data.get('name')).trim(),amount=String(data.get('amount')).trim();if(!name||!amount)return;list.edits[form.dataset.editForm]={name,amount};toast('Shopping item updated.');}
  saveList();renderGroceries();
});
window.addEventListener('hashchange',()=>{if(book&&plans){if(recipeDialog.open)recipeDialog.close();const imported=applySharedLink();syncWeekWithRoute();render();window.scrollTo(0,0);main.focus({preventScroll:true});if(imported)toast('Shared dinner plan saved on this phone. Shopping ticks untouched.');}});
window.addEventListener('afterprint',()=>delete document.body.dataset.print);
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});

async function start() {
  try {
    [book,plans]=await Promise.all(['recipes','plans'].map(async name=>{const response=await fetch(`./data/${name}.json`,{cache:'no-cache'});if(!response.ok)throw new Error(`Could not load ${name}.json (${response.status}).`);return response.json();}));
    validateData(book,plans);selectedWeek=plans.current;loadMealSettings();
    const imported=applySharedLink();syncWeekWithRoute();
    document.querySelector('#provenance').textContent=plans.provenance;
    render();if(imported)toast('Shared dinner order saved on this phone. Shopping list untouched.');if(!storageOK)toast('Browser storage is unavailable. Export your shopping list to keep it.');
  } catch(error) {
    main.innerHTML=`<section class="empty-state"><p class="eyebrow">A LITTLE KITCHEN HICCUP</p><h1>Dinner’s not<br>loading yet.</h1><p>${e(error.message)}</p><p>Try reloading. If you opened this as a file, use the preview server or GitHub Pages instead.</p><button class="button" id="retry">Try again ↗</button></section>`;document.querySelector('#retry').onclick=()=>location.reload();
  }
}
start();
