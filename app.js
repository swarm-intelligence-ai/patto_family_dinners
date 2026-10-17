import {validateData, getRecipe, recipeIngredients, consolidate, quantity, weekLabel, escapeHTML as e} from './core.js';

const photoSources = {
  "mediterranean": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=82",
  "tonkatsu": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=82",
  "burrito": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=82",
  "pasta": "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=82",
  "salmon": "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=900&q=82"
};
const imageFor = r => photoSources[r.art] || `./assets/${r.art}.svg`;
const fallbackFor = r => `./assets/${r.art}.svg`;

const main = document.querySelector('main');
const recipeDialog = document.querySelector('#recipe-dialog');
let book, plans, selectedWeek, openedRecipe, storageOK = true;
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(`patto:${key}`)) ?? fallback; } catch { storageOK = false; return fallback; } };
const write = (key, value) => { try { localStorage.setItem(`patto:${key}`, JSON.stringify(value)); } catch { storageOK = false; toast('Browser storage is unavailable. Keep this tab open or export your list.'); } };
const prefs = read('preferences', {});
let servings = Number.isInteger(prefs.servings) && prefs.servings >= 2 && prefs.servings <= 10 ? prefs.servings : 5;
let protein = ['salmon','chicken','mixed'].includes(prefs.protein) ? prefs.protein : 'mixed';
let favourites = read('favourites', []); if (!Array.isArray(favourites)) favourites = [];
let search = '', filter = 'all', list, toastTimer;
const icon = (name) => ({clock:'◷',arrow:'↗',heart:'♡',check:'✓',star:'✳'}[name]);
const savePrefs = () => write('preferences', {servings,protein});
const current = () => plans.weeks.find(w => w.id === selectedWeek);
function orderedMeals(week) {
  const original=week.meals;
  const ids=read(`meal-order:${week.id}`, []);
  if (!Array.isArray(ids) || ids.length !== original.length || new Set(ids).size !== ids.length || !original.every(m=>ids.includes(m.recipe))) return original;
  return ids.map((id,i)=>({...original.find(m=>m.recipe===id),day:original[i].day}));
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

const route = () => ['week','recipes','groceries','archive'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'week';
function toast(message) { clearTimeout(toastTimer); const t=document.querySelector('#toast'); t.textContent=message;t.classList.add('show');toastTimer=setTimeout(()=>t.classList.remove('show'),4000); }
function storageKey() { return `list:${selectedWeek}:${servings}:${protein}`; }
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
  return [...consolidate(book,current(),servings,protein).map(i=>({...i,amount:quantity(i.qty,i.unit)})),...list.extras].filter(i=>!list.removed.includes(i.id)).map(i=>({...i,...list.edits[i.id]}));
}
function controls() {
  return `<div class="plan-controls"><label class="portion-control">At the table <select id="servings" aria-label="Number of servings">${Array.from({length:9},(_,i)=>`<option ${servings===i+2?'selected':''}>${i+2}</option>`).join('')}</select> <span>servings</span></label><div class="protein-control"><label for="protein">Friday’s pick</label><select id="protein"><option value="salmon" ${protein==='salmon'?'selected':''}>Salmon</option><option value="chicken" ${protein==='chicken'?'selected':''}>Chicken</option><option value="mixed" ${protein==='mixed'?'selected':''}>Half & half</option></select></div></div>`;
}
function card(r, day, position = -1, count = 0) {
  const liked=favourites.includes(r.id);
  return `<article class="meal-card"><div class="meal-art" style="--meal-colour:${r.colour}"><button class="art-open" data-recipe="${e(r.id)}" aria-label="Open ${e(r.title)}"><img src="${e(imageFor(r))}" data-fallback="${e(fallbackFor(r))}" alt="${e(r.title)} plated for dinner" loading="lazy" decoding="async" width="430" height="410"></button><span class="meal-day">${e(day||r.cuisine)}</span><button class="favourite ${liked?'is-liked':''}" data-favourite="${e(r.id)}" aria-label="${liked?'Remove':'Add'} ${e(r.title)} ${liked?'from':'to'} favourites" aria-pressed="${liked}">${liked?'♥':'♡'}</button></div><div class="meal-copy"><p class="meal-meta">${e(r.cuisine)} <span>${icon('clock')} ${r.time} min</span></p><h3><button data-recipe="${e(r.id)}">${e(r.title)}</button></h3><p>${e(r.subtitle)}</p><button class="recipe-link" data-recipe="${e(r.id)}">Let’s get cooking <span aria-hidden="true">↗</span></button>${position >= 0 ? `<div class="meal-reorder"><span>Change dinner night</span><div><button data-move="-1" data-index="${position}" data-dinner-position="${position}" aria-label="Move ${e(r.title)} earlier" ${position === 0 ? 'disabled' : ''}>↑</button><button data-move="1" data-index="${position}" aria-label="Move ${e(r.title)} later" ${position === count-1 ? 'disabled' : ''}>↓</button></div></div>` : ''}</div></article>`;
}
function weekView() {
  const w=current(), isCurrent=w.id===plans.current;
  return `<section class="hero"><div class="hero-copy"><p class="eyebrow">KYM & ANTHONY PRESENT</p><h1>What’s<br><em>cookin’, Pattos?</em></h1><p class="hero-description">Less “what’s for dinner?”<br>More “who nicked the last potato?”</p><a class="button" href="#groceries">Get the shopping list <span aria-hidden="true">↗</span></a><div class="hero-footnote"><span class="tiny-flower" aria-hidden="true">✳</span> Five dinners. Five Patto opinions. Zero boring plates.</div></div><div class="hero-visual patto-chefs"><div class="hero-circle"></div><img src="./assets/patto-chefs.webp" data-fallback="${photoSources.mediterranean}" alt="Cartoon Kym and Anthony cooking together in the Patto kitchen" width="1536" height="1024" fetchpriority="high"><p class="handwritten">Kym cooks.<br>Anthony taste-tests.</p></div></section><section aria-labelledby="week-title"><div class="section-heading"><div><p class="eyebrow">${isCurrent?'ON THE MENU':'FROM THE ARCHIVE'} · WEEK OF ${e(weekLabel(w.id).toUpperCase())}</p><h2 id="week-title">${e(w.title)}</h2></div><a class="text-link" href="#archive">Browse weeks <span aria-hidden="true">↗</span></a></div><p class="section-description">${e(w.note)}</p><p class="reorder-hint">↕ Swap your dinner nights with the arrows on each meal. Your choices stay saved on this phone.</p>${!isCurrent?'<div class="notice">You’re browsing an older plan. <button class="text-button" data-current>Back to the current week ↗</button></div>':''}${controls()}<div class="meal-grid">${orderedMeals(w).map((m,i,items)=>card(getRecipe(book,w,m.recipe),m.day,i,items.length)).join('')}<aside class="shopping-card"><span class="shopping-flower" aria-hidden="true">✳</span><p class="eyebrow">THE OTHER HALF OF THE PLAN</p><h3>One shop.<br>Five happy<br>dinners.</h3><p>Everything you need, added up and sorted for an Aldi-style shop.</p><a class="button button-cream" href="#groceries">Let’s shop <span aria-hidden="true">↗</span></a><small>Tick it. Tweak it. Get dinner sorted.</small></aside></div></section><section class="family-strip"><span aria-hidden="true">✳</span><div><h2>The Patto sous-chef squad.</h2><p>Leila, Phoebe and Tobias: kitchen jobs are officially on the menu. Kym's not running a restaurant, you know.</p></div><a class="text-link" href="#recipes">Find your next kitchen job ↗</a></section>`;
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
  return `<section class="page-intro grocery-intro"><div><p class="eyebrow">ONE SHOP, THEN YOU’RE SORTED</p><h1>The shopping<br><em>list.</em></h1><p>Week of ${e(weekLabel(selectedWeek))} · Five nights at our table.</p></div><div class="shopping-actions"><button class="button" id="download-list">Export list ↓</button><button class="outline-button" id="print-list">Print list</button></div></section>${controls()}<p class="local-note">Edits and ticks save on this device. Export to share with the family. Aisle order varies by store; round recipe amounts up to whole produce and packs.</p><div id="grocery-progress"></div><div class="grocery-toolbar"><label><input type="checkbox" id="hide-checked"> Hide ticked items</label><button class="text-button" id="reset-list">Reset this list</button></div><div id="aisles"></div><form class="add-form" id="add-item"><h2>Anything else?</h2><div class="add-fields"><label>Item<input name="item" required maxlength="80" placeholder="Lunchbox apples, perhaps?"></label><label>Amount<input name="amount" maxlength="40" placeholder="1 bag"></label><label>Aisle<select name="aisle">${book.aisles.map(a=>`<option>${e(a)}</option>`).join('')}</select></label><button class="button" type="submit">Add to list +</button></div></form><p class="local-note">Pantry staples are included so nothing gets missed. Tick the things you already have. Changing servings or Friday’s protein opens a separate saved list.</p>`;
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
    for (const [id] of recipeIngredients(recipe, servings, protein)) {
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
  return `<section class="page-intro"><p class="eyebrow">KEEP THE GOOD WEEKS CLOSE</p><h1>Our dinner<br><em>scrapbook.</em></h1><p>A home for every weekly plan, and the recipes we’ll come back to.</p></section><div class="archive-grid">${weeks.map(w=>`<article class="archive-card"><p class="eyebrow">${w.id===plans.current?'THE CURRENT LINEUP':'FROM OUR TABLE'} · ${e(weekLabel(w.id))}</p><h2>${e(w.title)}</h2><ul>${orderedMeals(w).map(m=>`<li><span>${e(m.day.slice(0,3))}</span>${e(getRecipe(book,w,m.recipe).title)}</li>`).join('')}</ul><button class="button" data-week="${e(w.id)}">Open this week ↗</button></article>`).join('')}${!older.length?'<aside class="archive-empty"><span aria-hidden="true">✳</span><h2>The first page<br>of a good thing.</h2><p>This is our first saved weekly plan. Earlier full plans weren’t available in the conversation, so this scrapbook will grow from here.</p><p>New weeks appear here when the cookbook’s plan file is updated.</p></aside>':''}</div>`;
}
function render() {
  const page=route();
  document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  main.innerHTML=({week:weekView,recipes:cookbookView,groceries:groceryView,archive:archiveView}[page])();
  if(page==='recipes')renderResults(); if(page==='groceries')renderGroceries();
  document.title=`${{week:'This week',recipes:'The cookbook',groceries:'Shopping list',archive:'Weekly archive'}[page]} · The Patto Dinner Club`;
}
function openRecipe(id) {
  const r=route()==='recipes'?allRecipes().find(r=>r.id===id):getRecipe(book,current(),id); if(!r)return;
  openedRecipe=r;
  const nutrition=r.proteinNutrition?.[protein]||r.nutrition;
  recipeDialog.innerHTML=`<button class="dialog-close" data-close="recipe-dialog" aria-label="Close recipe">×</button><div class="recipe-banner" style="--meal-colour:${r.colour}"><img src="${e(imageFor(r))}" data-fallback="${e(fallbackFor(r))}" alt="${e(r.title)} served and ready to eat" width="240" height="230"><div><p class="eyebrow">${e(r.cuisine)} · ${r.time} MINUTES</p><h2 id="recipe-title">${e(r.title)}</h2><p>${e(r.subtitle)}</p></div></div><div class="recipe-body"><div class="recipe-actions"><span>Cooking for <strong>${servings}</strong> · ${r.proteins?e({salmon:'Salmon',chicken:'Chicken',mixed:'Half salmon, half chicken'}[protein]):'Family portions'}</span><button class="outline-button" id="print-recipe">Print recipe</button></div><p class="small-note">Adjust servings${r.proteins?' and Friday’s protein':''} on the weekly plan or shopping list. Ingredient amounts below scale with your choice.</p><div class="recipe-columns"><section><h3>The ingredients</h3><p class="small-note">Tick as you cook. Quantities are rounded to useful kitchen measures.</p><ul class="ingredient-list">${recipeIngredients(r,servings,protein).map(([id,qty])=>`<li><label><input type="checkbox"><span><strong>${e(quantity(qty,book.ingredients[id].unit))}</strong> ${e(book.ingredients[id].name)}</span></label></li>`).join('')}</ul></section><section><h3>Let’s make dinner</h3><ol class="method">${r.steps.map(([title,body])=>`<li><h4>${e(title)}</h4><p>${e(body)}</p></li>`).join('')}</ol></section></div><div class="family-notes"><section><p class="eyebrow">MAKE IT YOURS</p><h3>Everyone gets a happy plate.</h3><p>${e(r.family)}</p><p>${e(r.variation)}</p></section><section><p class="eyebrow">LITTLE HANDS, BIG HELP</p><h3>A job for the kids.</h3><p>${e(r.kidJob)}</p><p><strong>Get ahead:</strong> ${e(r.prepTip)}</p></section></div><section class="nutrition"><h3>A little nourishment.</h3><div class="nutrition-values"><span><strong>~${nutrition.kcal}</strong> kcal</span><span><strong>~${nutrition.protein} g</strong> protein</span><span><strong>~${nutrition.fibre} g</strong> fibre</span></div><p>${e(r.nutrition.note)}</p><p class="small-note">Rough estimates per equal serving, based on original recipe yield (${r.serves}); not lab-verified or personalised for children. Scaling the whole recipe keeps the estimate per serving similar. Swaps and brands change it.${protein==='mixed'&&r.proteins?' Mixed values average both proteins; individual bowls differ.':''}</p><p><strong>Allergen check:</strong> ${e(r.allergens)}</p><p class="small-note">Cook chicken and mince to at least 75°C in the centre. Keep raw and ready-to-eat food separate. Refrigerate leftovers promptly. <a href="https://www.foodstandards.gov.au/consumer/prevention-of-foodborne-illness/food-safety-basics" target="_blank" rel="noreferrer">FSANZ food safety guidance ↗</a></p></section></div>`;
  if(!recipeDialog.open)recipeDialog.showModal();
  recipeDialog.scrollTop=0;
}
function download(name, content) { const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function exportList() {
  const items=listItems(); let text=`THE PATTO DINNER CLUB\nWeek of ${weekLabel(selectedWeek)}\n${servings} servings · Friday: ${protein}\n\n`;
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
  if(target.dataset.recipe)openRecipe(target.dataset.recipe);
  if(target.dataset.move !== undefined) moveDinner(Number(target.dataset.index),Number(target.dataset.move));
  if(target.dataset.close)document.getElementById(target.dataset.close).close();
  if(target.dataset.favourite){const id=target.dataset.favourite;favourites=favourites.includes(id)?favourites.filter(v=>v!==id):[...favourites,id];write('favourites',favourites);const y=scrollY;render();window.scrollTo(0,y);toast(favourites.includes(id)?'Saved to family favourites.':'Removed from favourites.');}
  if(target.dataset.filter){filter=target.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',b.dataset.filter===filter);});renderResults();}
  if(target.hasAttribute('data-clear-search')){search='';filter='all';render();}
  if(target.dataset.week){selectedWeek=target.dataset.week;if(route()==='week')render();else location.hash='week';window.scrollTo(0,0);}
  if(target.hasAttribute('data-current')){selectedWeek=plans.current;render();}
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
  if(t.id==='servings'||t.id==='protein'){if(t.id==='servings')servings=Number(t.value);else protein=t.value;savePrefs();const y=scrollY;render();window.scrollTo(0,y);toast('Ingredients and shopping quantities updated.');}
  if(t.dataset.check){list.checks[t.dataset.check]=t.checked;saveList();const id=t.dataset.check;renderGroceries();document.querySelector(`[data-check="${CSS.escape(id)}"]`)?.focus({preventScroll:true});}
  if(t.id==='hide-checked')renderGroceries();
});
document.addEventListener('submit',event=>{
  const form=event.target; if(form.id!=='add-item'&&!form.dataset.editForm)return;event.preventDefault();const data=new FormData(form);
  if(form.id==='add-item'){const name=String(data.get('item')).trim();if(!name)return;list.extras.push({id:`extra-${crypto.randomUUID()}`,name,amount:String(data.get('amount')).trim()||'As needed',aisle:String(data.get('aisle'))});form.reset();toast('Added to the shopping list.');}
  else{const name=String(data.get('name')).trim(),amount=String(data.get('amount')).trim();if(!name||!amount)return;list.edits[form.dataset.editForm]={name,amount};toast('Shopping item updated.');}
  saveList();renderGroceries();
});
window.addEventListener('hashchange',()=>{if(book&&plans){if(recipeDialog.open)recipeDialog.close();render();window.scrollTo(0,0);main.focus({preventScroll:true});}});
window.addEventListener('afterprint',()=>delete document.body.dataset.print);
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});

async function start() {
  try {
    [book,plans]=await Promise.all(['recipes','plans'].map(async name=>{const response=await fetch(`./data/${name}.json`,{cache:'no-cache'});if(!response.ok)throw new Error(`Could not load ${name}.json (${response.status}).`);return response.json();}));
    validateData(book,plans);selectedWeek=plans.current;
    document.querySelector('#provenance').textContent=plans.provenance;
    render();if(!storageOK)toast('Browser storage is unavailable. Export your shopping list to keep it.');
  } catch(error) {
    main.innerHTML=`<section class="empty-state"><p class="eyebrow">A LITTLE KITCHEN HICCUP</p><h1>Dinner’s not<br>loading yet.</h1><p>${e(error.message)}</p><p>Try reloading. If you opened this as a file, use the preview server or GitHub Pages instead.</p><button class="button" id="retry">Try again ↗</button></section>`;document.querySelector('#retry').onclick=()=>location.reload();
  }
}
start();
