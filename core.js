export function validateData(book, plans) {
  const fail = message => { throw new Error(message); };
  if (!Array.isArray(book.aisles) || !book.aisles.length || !book.ingredients || !Array.isArray(book.recipes) || !book.recipes.length) fail('Recipe data is incomplete.');
  if (!Array.isArray(plans.weeks) || !plans.weeks.length) fail('Add at least one weekly plan.');
  const ids = new Set();
  const validateRecipe = r => {
    if (!r || typeof r.id !== 'string' || !/^[a-z0-9-]+$/.test(r.id)) fail('Recipe IDs need lowercase letters, numbers and hyphens.');
    for (const key of ['title','shortTitle','subtitle','cuisine','art','colour','family','kidJob','allergens','variation','prepTip']) if (typeof r[key] !== 'string' || !r[key]) fail(`Missing ${key} in ${r.id}.`);
    if (!/^#[a-f0-9]{6}$/i.test(r.colour) || !/^[a-z-]+$/.test(r.art)) fail(`Invalid artwork in ${r.id}.`);
    if (!Number.isFinite(r.serves) || r.serves <= 0 || !Number.isFinite(r.time) || r.time <= 0) fail(`Invalid portions or time in ${r.id}.`);
    if (!Array.isArray(r.ingredients) || !r.ingredients.length || !Array.isArray(r.steps) || !r.steps.length || r.steps.some(s => !Array.isArray(s) || s.length !== 2 || s.some(v => typeof v !== 'string'))) fail(`Incomplete ingredients or method in ${r.id}.`);
    if (!r.nutrition || ['kcal','protein','fibre'].some(k => !Number.isFinite(r.nutrition[k]) || r.nutrition[k] < 0) || typeof r.nutrition.note !== 'string') fail(`Missing nutrition in ${r.id}.`);
    for (const [id, qty] of [...r.ingredients, ...Object.values(r.proteins || {}).flat()]) {
      if (!book.ingredients[id] || !Number.isFinite(qty) || qty <= 0) fail(`Invalid ingredient ${id} in ${r.id}.`);
    }
    if (r.proteins && ['salmon','chicken','mixed'].some(k => !Array.isArray(r.proteins[k]))) fail(`Missing protein choices in ${r.id}.`);
  };
  for (const item of Object.values(book.ingredients)) if (typeof item.name !== 'string' || typeof item.unit !== 'string' || !book.aisles.includes(item.aisle)) fail('Invalid grocery aisle or ingredient.');
  for (const r of book.recipes) { validateRecipe(r); if (ids.has(r.id)) fail(`Duplicate recipe ${r.id}.`); ids.add(r.id); }
  const weeks = new Set();
  for (const w of plans.weeks) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(w.id) || Number.isNaN(Date.parse(w.id)) || new Date(`${w.id}T12:00:00Z`).toISOString().slice(0,10) !== w.id || weeks.has(w.id)) fail('Week IDs must be unique valid ISO dates.');
    weeks.add(w.id);
    if (typeof w.title !== 'string' || typeof w.note !== 'string' || !Array.isArray(w.meals) || !w.meals.length) fail(`Incomplete week ${w.id}.`);
    for (const r of Object.values(w.recipeSnapshots || {})) validateRecipe(r);
    for (const m of w.meals) if (typeof m.day !== 'string' || !getRecipe(book,w,m.recipe)) fail(`Unknown meal in ${w.id}.`);
    if (w.meals.length !== new Set(w.meals.map(m=>m.recipe)).size) fail(`Duplicate meal in ${w.id}.`);
    if (w.id !== plans.current && (!w.recipeSnapshots || w.meals.some(m=>!w.recipeSnapshots[m.recipe]))) fail(`Archived week ${w.id} must contain frozen recipe snapshots.`);
  }
  if (!weeks.has(plans.current)) fail('The current week does not exist.');
  return true;
}

export function getRecipe(book, week, id) { return week?.recipeSnapshots?.[id] || book.recipes.find(r => r.id === id); }
export function recipeIngredients(recipe, servings, protein = 'salmon') {
  const source = [...recipe.ingredients, ...(recipe.proteins?.[protein] || [])];
  return source.map(([id, qty]) => [id, Math.round(qty * servings / recipe.serves * 1000) / 1000]);
}
export function consolidate(book, week, servings, protein) {
  const totals = new Map();
  for (const meal of week.meals) for (const [id, qty] of recipeIngredients(getRecipe(book, week, meal.recipe), servings, protein)) totals.set(id, (totals.get(id) || 0) + qty);
  return [...totals].map(([id, qty]) => ({id, ...book.ingredients[id], qty: Math.round(qty * 1000) / 1000})).sort((a,b) => book.aisles.indexOf(a.aisle) - book.aisles.indexOf(b.aisle) || a.name.localeCompare(b.name));
}
/** Build a shopping list using each dinner's own guest count and protein choice. */
export function consolidateMealSettings(book,week,settings={}) {
  const totals=new Map();
  for (const meal of week.meals) {
    const recipe=getRecipe(book,week,meal.recipe);
    const setting=settings[meal.recipe]||{};
    const servings=Number.isInteger(setting.servings)&&setting.servings>=1&&setting.servings<=20?setting.servings:5;
    const protein=recipe.proteins&&['salmon','chicken','mixed'].includes(setting.protein)?setting.protein:'mixed';
    for(const [id,qty] of recipeIngredients(recipe,servings,protein)){
      totals.set(id,(totals.get(id)||0)+qty);
    }
  }
  return [...totals].map(([id,qty])=>({id,...book.ingredients[id],qty:Math.round(qty*1000)/1000}))
    .sort((a,b)=>book.aisles.indexOf(a.aisle)-book.aisles.indexOf(b.aisle)||a.name.localeCompare(b.name));
}
// Australian tablespoons are 20 mL; teaspoons are 5 mL.
// Keep stored quantities in mL so shopping totals and serving scaling remain exact.
const spoonMeasuredIngredients = new Set([
  'soy','sweet-chilli','sweet-chilli-sauce','bbq','worcestershire',
  'oil','vinegar','dijon','wholegrain-mustard','honey','oyster',
  'sesame-oil','ketchup','burger-sauce'
]);
function spoonMeasure(ml) {
  // Round only the display to a realistic measuring spoon, not the stored recipe.
  const teaspoons = Math.max(0.25, Math.round(ml / 1.25) * 0.25);
  // For 10 mL and up, use AU tablespoons plus any remaining teaspoons.
  if (teaspoons >= 2) {
    const halfTablespoons = Math.floor((teaspoons + 1e-8) / 2);
    const remainder = Math.round((teaspoons - halfTablespoons * 2) * 4) / 4;
    const wholeTablespoons = Math.floor(halfTablespoons / 2);
    const half = halfTablespoons % 2;
    const tbsp = wholeTablespoons ? `${wholeTablespoons}${half ? '½' : ''} tbsp` : half ? '½ tbsp' : '';
    if (remainder === 0) return tbsp;
    // A teaspoon is often easier to find than a quarter tablespoon.
    const tsp = `${remainder === 0.25 ? '¼' : remainder === 0.5 ? '½' : remainder === 0.75 ? '¾' : remainder} tsp`;
    return tbsp ? `${tbsp} + ${tsp}` : tsp;
  }
  const whole = Math.floor(teaspoons);
  const part = Math.round((teaspoons-whole)*4)/4;
  const frac = {0:'',0.25:'¼',0.5:'½',0.75:'¾'}[part];
  return `${whole||''}${frac} tsp`;
}
export function quantity(qty, unit, ingredientId = '') {
  // These numbers are instructions for humans shopping and cooking, not a lab balance.
  const n = Math.max(0, Number(qty));
  if (!Number.isFinite(n)) return '';
  const whole = !unit || unit.includes('tin') || unit === 'bunch';
  if (whole) return `${Math.ceil(n - 1e-8)}${unit ? ` ${unit}` : ''}`;
  if (unit === 'tsp') {
    const rounded = Math.max(0.25, Math.round(n * 4) / 4);
    const integer = Math.floor(rounded);
    const fractions = {0:'',0.25:'¼',0.5:'½',0.75:'¾'};
    const fractional = fractions[Number((rounded - integer).toFixed(2))] || '';
    return `${integer || ''}${fractional} tsp`;
  }
  if (unit === 'ml') {
    if (spoonMeasuredIngredients.has(ingredientId)) return spoonMeasure(n);
    const rounded = n < 10 ? Math.round(n) : Math.round(n / 5) * 5;
    return `${rounded} ml`;
  }
  if (unit === 'g') {
    const step = n < 25 ? 1 : n < 100 ? 5 : n < 250 ? 10 : 25;
    return `${Math.round(n / step) * step} g`;
  }
  return `${Number(n.toFixed(1))} ${unit}`;
}
export function weekLabel(id) { return new Intl.DateTimeFormat('en-AU', {day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${id}T12:00:00Z`)); }
export function escapeHTML(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/** Check a shared meal order against a published week; never trust URL content blindly. */
export function validMealOrder(week, ids) {
  if (!week || !Array.isArray(week.meals) || !Array.isArray(ids)) return false;
  const expected=week.meals.map(m=>m.recipe);
  return ids.length===expected.length && new Set(ids).size===ids.length &&
    expected.length===new Set(expected).size && ids.every(id=>expected.includes(id));
}

/** Keep weekday labels attached to slots, not to recipes. */
export function mealsInOrder(week, ids) {
  if (!validMealOrder(week,ids)) return week.meals;
  return ids.map((id,index)=>({...week.meals.find(m=>m.recipe===id),day:week.meals[index].day}));
}

/** Prepare a new week without touching the live site. Frozen recipes are captured now. */
export function createWeekDraft(book, plans, id) {
  validateData(book,plans);
  const source=plans.weeks.find(w=>w.id===plans.current);
  const date=new Date(`${id}T12:00:00Z`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(id) || Number.isNaN(date.valueOf()) ||
     date.toISOString().slice(0,10)!==id || date.getUTCDay()!==1 ||
     id<=plans.current || plans.weeks.some(w=>w.id===id)) throw new Error('Choose a new Monday after the published week.');
  return {
    sourceWeek:structuredClone(source),
    outgoingRecipeSnapshots:Object.fromEntries(source.meals.map(m=>[m.recipe,structuredClone(getRecipe(book,source,m.recipe))])),
    nextWeek:{id,title:'New dinners. Coming right up.',note:'Choose and approve the meals before publishing.',meals:structuredClone(source.meals)}
  };
}

/** Publish an approved draft atomically in memory. Old recipe versions are preserved. */
export function publishWeekDraft(book, plans, draft) {
  validateData(book,plans);
  const source=plans.weeks.find(w=>w.id===plans.current);
  if(!draft || JSON.stringify(draft.sourceWeek)!==JSON.stringify(source)) throw new Error('Published week changed after the draft was created. Recreate the draft.');
  const next=draft.nextWeek;
  if(!next || typeof next.id!=='string' || next.id<=plans.current ||
     plans.weeks.some(w=>w.id===next.id) ||
     !/^\d{4}-\d{2}-\d{2}$/.test(next.id) ||
     Number.isNaN(Date.parse(next.id)) ||
     new Date(`${next.id}T12:00:00Z`).getUTCDay()!==1 ||
     !Array.isArray(next.meals) || ![5,6].includes(next.meals.length)) throw new Error('Draft must contain five or six dinners for a new Monday.');
  if(!draft.outgoingRecipeSnapshots ||
     source.meals.some(m=>!draft.outgoingRecipeSnapshots[m.recipe])) throw new Error('Missing archived recipe snapshots.');
  const result=structuredClone(plans);
  const old=result.weeks.find(w=>w.id===result.current);
  old.recipeSnapshots=structuredClone(draft.outgoingRecipeSnapshots);
  result.weeks.push(structuredClone(next));
  result.current=next.id;
  validateData(book,result);
  return result;
}
