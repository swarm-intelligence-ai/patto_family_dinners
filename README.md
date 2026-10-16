# The Patto Dinner Club

A colourful family cookbook for Anthony, Kym and the kids. Five dinners, complete recipes, one consolidated shop and a weekly scrapbook.

## Open the website

After GitHub Pages is enabled and the deployment succeeds:

https://swarm-intelligence-ai.github.io/patto_family_dinners/

## What’s included

- All five locked-in dishes, full methods, family variations and supervised kitchen jobs for the kids.
- Portions for 2–10 people; Friday’s salmon, chicken or half-and-half choice updates both recipe ingredients and grocery totals.
- Aldi-style grocery aisle groups, pantry staples, checkboxes, editable names/amounts, added items, removal, export and print.
- Search by dish or ingredient, quick-recipe filter and saved favourites.
- Weekly archive with recipe snapshots when you roll to a new week.
- Responsive layout, keyboard navigation, accessible recipe dialogs and reduced-motion support.
- Original local SVG food illustrations. No tracking, third-party fonts, image services, login, backend or runtime packages.

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

## Add the next week (recommended)

```sh
npm run new-week -- 2026-10-19
```

Use the next Monday’s actual date. This command:

1. Freezes the outgoing week’s recipes into `recipeSnapshots` inside `data/plans.json`.
2. Adds a new week copied from the old lineup, ready for you to change.
3. Sets `current` to the new week. Older weeks remain browsable.

Then edit the new week’s title, note and meals in `data/plans.json`. Each meal has a day label and a recipe ID:

```json
{"day": "Monday", "recipe": "mediterranean-beef"}
```

Edit or add recipes in `data/recipes.json`, run the tests and build, then commit/push the changed data files. Pages updates automatically. Roll over the week **before** changing recipes if you want the outgoing version frozen. Existing historical ingredient IDs must remain in the shared ingredient dictionary; add new IDs rather than deleting old ones. To preserve two different recipe versions in cookbook search as well, give the revised recipe a new ID.

### Browser-only GitHub editing

You can edit JSON with GitHub’s pencil button without running the helper: copy the current week object, assign a new unique ISO date, edit its meals, append it to `weeks` and change `current`. Keep older weeks. If changing an existing recipe, copy its original object into the outgoing week’s `recipeSnapshots` keyed by recipe ID, or create a new recipe ID for the new version. Run the helper locally for an easier snapshot workflow. JSON needs double quotes and no trailing commas; deployment checks reject broken references and incomplete recipes.

### Add a recipe

Copy an existing recipe object to retain the required fields. Use a unique lowercase-hyphenated ID. Quantities refer to the recipe’s original `serves` value. Ingredients are pairs such as `["chicken", 600]`; ingredient units and aisle names live in the shared `ingredients` dictionary. The Friday recipe demonstrates optional protein choices. Every recipe needs full method steps, family and child notes, allergens, preparation advice and labelled approximate nutrition. Use an existing artwork name or add a local SVG under `assets/`. `npm test` validates the data before publishing.

## Content boundaries

- Dish choices come from Anthony’s locked-in list. The accessible source chat contained user messages but no recoverable assistant recipe text or complete historical plans. The recipes were authored for this cookbook and have not been kitchen-tested. Historical weeks have not been invented.
- The initial plan is dated to the source conversation’s week, **12 October 2026**. Weekday assignments are suggested; change them in `data/plans.json` if needed. “This week” means the plan explicitly selected by `current`, not an automatically advancing calendar.
- Default yield is four equal servings, an editable starting assumption. Quantities are recipe amounts, not rounded supermarket packs. Fractional produce, tins and eggs should be rounded up when buying; use the measured recipe amount when cooking. Aldi aisle order is indicative and varies by store.
- Recipe cooking times are estimates; larger batches may need extra pans or time. Scaling ingredients does not replace checking doneness.
- Nutrition is a rough recipe-level estimate per original equal serving, not a clinical calculation or a target for children. Brands, oil absorption, appetite and substitutions matter. The mixed-protein estimate is an average across the recipe, not every individual bowl.
- Allergen notes do not replace checking product labels. Worcestershire can contain fish. Mixed salmon/chicken preparation does not avoid fish cross-contact.
- Chicken and mince should reach at least 75°C in the centre. Use separate raw/ready-to-eat utensils, check salmon for bones and refrigerate leftovers promptly. See [FSANZ food safety basics](https://www.foodstandards.gov.au/consumer/prevention-of-foodborne-illness/food-safety-basics).
- No real faces are included. Ask Anthony and Kym for approved photos before adding them, particularly to a public site.

## Files

| File | Purpose |
| --- | --- |
| `data/plans.json` | Current week pointer, weekly lineups and archived recipe snapshots |
| `data/recipes.json` | Shared ingredient dictionary and recipe library |
| `app.js`, `core.js` | Browser screens, local saving and grocery calculations |
| `styles.css` | Responsive, reduced-motion and print layouts |
| `assets/` | Original food illustrations and favicon |
| `scripts/new-week.mjs` | Archive recipes and start a new week |
| `.github/workflows/pages.yml` | Check, build and deploy to GitHub Pages |

To regenerate the food illustrations: `node scripts/art.mjs`.
