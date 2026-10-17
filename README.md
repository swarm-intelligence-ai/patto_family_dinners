# The Patto Family Social — Dinner Club

A colourful family cookbook for Anthony, Kym and the kids. Five dinners, complete recipes, one consolidated shop and a weekly scrapbook.

## Open the website

After GitHub Pages is enabled and the deployment succeeds:

https://swarm-intelligence-ai.github.io/patto_family_dinners/

## What’s included

- All five locked-in dishes, full methods, family variations and supervised kitchen jobs for the kids.
- Independent guest counts for every dinner (1–10 people); salmon/chicken choice appears only on that particular meal. Both settings update its recipe and the weekly Aldi totals.
- Aldi-style grocery aisle groups, pantry staples, checkboxes, editable names/amounts, added items, removal, export and print.
- Search by dish or ingredient, quick-recipe filter and saved favourites.
- Weekly archive with recipe snapshots when you roll to a new week.
- Responsive layout, keyboard navigation, accessible recipe dialogs and reduced-motion support.
- Local fallback SVG illustrations and linked meal photography; no login or backend. External images may be served by third parties.

Shopping changes, favourites and portions are saved **in each browser only**. They do not sync between Kym’s and Anthony’s phones. Use **Export list** to share a text checklist. Recipe ingredient ticks are temporary cooking aids and reset when the recipe is reopened. Clearing browser data clears saved preferences and lists.

## Preview and check

Install Node.js 22 or newer. No `npm install` is needed.

```sh
npm run dev
```

Open http://127.0.0.1:4173 in a browser. Opening `index.html` directly as a file will not load the JSON data.

```sh
npm test
npm run build
```

The build validates recipe/plan references and writes the public website files to `dist/`. Only that directory is deployed; source, tests and instructions are not part of the Pages artifact. All website links use relative paths and hash navigation so the repository subpath works without rewrite rules.

## Publish on GitHub Pages

1. Put the contents of this project at the root of `swarm-intelligence-ai/patto_family_dinners` on `main`.
2. Open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. The included **Test and publish the Dinner Club** workflow tests, builds and deploys pushes to `main`. If you enable Pages after the initial push, open **Actions**, select the workflow and choose **Run workflow**.
4. Open the URL shown by the successful `github-pages` deployment.

The repository was initially private. Anthony subsequently authorised making it public so Pages can work on the current GitHub plan. A public repository exposes its complete source and history. All deployed HTML, scripts, images and recipe JSON are also public. Add family portraits only after Anthony and Kym supply and approve the images for public use. Never add tokens or other secrets.

GitHub Free supports Pages with public repositories; private-repository Pages requires an eligible paid plan. See [GitHub’s setup guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) and [publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Weekly publishing — draft, review, then go live

The website's current dinner plan is set by `data/plans.json` → `current`. **Do not change that pointer while planning.**

1. Agree the five dinners with the family (Anthony can do this with Max in ChatGPT).
2. Run `npm run new-week -- YYYY-MM-DD`, using the next Monday's date, **after** the previous menu and recipes have been finalised. This captures frozen copies of the outgoing recipes in a private-to-source draft, without changing the live plan.
3. Edit `drafts/next-week.json`: update `nextWeek.title`, `nextWeek.note` and its five `meals` (each has a weekday and recipe ID). Create or edit recipes in `data/recipes.json`. If a recipe needs a new historical version in the searchable cookbook, give it a new recipe ID.
4. Review meal titles, ingredients, real-life five-person quantities, allergies, cooking steps and dinner images. Nothing is live yet.
5. Run `npm run publish-week`. The helper checks for five valid recipes, freezes the outgoing week into `recipeSnapshots`, appends the new week and moves the `current` pointer. It rejects stale drafts and doesn't delete historical weeks.
6. Run `npm test && npm run build`. **Only push to `main` after both succeed.** GitHub Actions tests and publishes the static site again on push.

Example:

```sh
npm run new-week -- 2026-10-19
# edit drafts/next-week.json and data/recipes.json
npm run publish-week
npm test && npm run build
git add data/plans.json data/recipes.json
git commit -m "Publish five dinners for 19 October"
git push
```

`drafts/next-week.json` is removed when published. It is never copied into the GitHub Pages build, so unfinished menus do not appear on the live site. If a draft exists already, finish or intentionally discard it before starting another. Never modify archived `recipeSnapshots` in ordinary weekly updates.

**Chat workflow:** Once Anthony approves a week's meals, Max can edit the data, add recipes and pictures, commit the new week and verify the GitHub Actions deployment. We should never publish placeholder dinners from the draft.

## Share our week (no account or server)

On **This week**, reorder dinners with the ↑/↓ buttons, then tap **Share our week**. On an iPhone this opens the native share sheet for Messenger or Messages. In other browsers, it copies the URL where supported.

The link contains the week ID, ordered recipe IDs, per-dinner guest counts and the optional salmon/chicken selection, for example:

```text
https://swarm-intelligence-ai.github.io/patto_family_dinners/#week?week=2026-10-12&order=mediterranean-beef,pork-tonkatsu,burrito-bowls,italian-chicken-pasta,sweet-chilli-bowls
```

On opening a valid link, the site selects that archived/current week and saves the supplied order and meal choices **on the recipient's device**. Weekday labels follow the slots. The link does **not** import shopping-list edits, checks, removed items, extra items or favourites. It **does** import guest counts and the selected protein for the salmon/chicken meal. Invalid or outdated orders are ignored. There is no live two-way sync: if Kym later changes her order, she can send an updated link back.

Shopping-list state retains its original legacy browser key for backward compatibility, so moving to per-dinner servings does not wipe Kym's existing checks or removals. Each week's guest counts are saved separately as `meal-settings:<week>` and affect ingredient totals without resetting a list. Adding a new week starts its own list while keeping old lists in that browser. Browsers are independent; clearing site storage removes local edits.

### Browser-only editing

To make a small fix, edit a recipe in `data/recipes.json` and let GitHub Actions validate the push. For a **new week**, use the draft/publish commands in a local checkout or ask Max to operate on the repo through GitHub. Editing `data/plans.json` directly to publish is possible, but is not the recommended way: forgetting snapshots can corrupt historical recipes, and archived plans without snapshots now fail validation.

### Add a recipe

Copy an existing recipe object to retain the required fields. Use a unique lowercase-hyphenated ID. Quantities refer to the recipe’s original `serves` value. Ingredients are pairs such as `["chicken", 600]`; ingredient units and aisle names live in the shared `ingredients` dictionary. The Friday recipe demonstrates optional protein choices. Every recipe needs full method steps, family and child notes, allergens, preparation advice and labelled approximate nutrition. Use an existing artwork name or add a local SVG under `assets/`. `npm test` validates the data before publishing.

## Content boundaries

- Dish choices come from Anthony’s locked-in list. The accessible source chat contained user messages but no recoverable assistant recipe text or complete historical plans. The recipes were authored for this cookbook and have not been kitchen-tested. Historical weeks have not been invented.
- The initial plan is dated to the source conversation’s week, **12 October 2026**. Weekday assignments are suggested; change them in `data/plans.json` if needed. “This week” means the plan explicitly selected by `current`, not an automatically advancing calendar.
- Default household target is five portions; each recipe records its own yield. Quantities are recipe amounts, not rounded supermarket packs. Displayed quantities use practical kitchen rounding for whole produce, tins and eggs. Aldi aisle order is indicative and varies by store.
- Recipe cooking times are estimates; larger batches may need extra pans or time. Scaling ingredients does not replace checking doneness.
- Nutrition is a rough recipe-level estimate per original equal serving, not a clinical calculation or a target for children. Brands, oil absorption, appetite and substitutions matter. The mixed-protein estimate is an average across the recipe, not every individual bowl.
- Allergen notes do not replace checking product labels. Worcestershire can contain fish. Mixed salmon/chicken preparation does not avoid fish cross-contact.
- Chicken and mince should reach at least 75°C in the centre. Use separate raw/ready-to-eat utensils, check salmon for bones and refrigerate leftovers promptly. See [FSANZ food safety basics](https://www.foodstandards.gov.au/consumer/prevention-of-foodborne-illness/food-safety-basics).
- The approved homepage chef artwork depicts Anthony and Kym. This public site should only contain family imagery they have approved.

## Files

| File | Purpose |
| --- | --- |
| `data/plans.json` | Current week pointer, weekly lineups and archived recipe snapshots |
| `data/recipes.json` | Shared ingredient dictionary and recipe library |
| `app.js`, `core.js` | Browser screens, local saving and grocery calculations |
| `styles.css` | Responsive, reduced-motion and print layouts |
| `assets/` | Original food illustrations and favicon |
| `scripts/new-week.mjs` | Prepare an unpublished week and freeze the outgoing recipes |\n| `scripts/publish-week.mjs` | Validate and publish the approved draft safely |\n| `drafts/next-week.json` | Temporary working draft, outside the public site build |
| `.github/workflows/pages.yml` | Check, build and deploy to GitHub Pages |

To regenerate the food illustrations: `node scripts/art.mjs`.
