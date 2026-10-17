import {readFile,writeFile,unlink} from 'node:fs/promises';
import {publishWeekDraft} from '../core.js';

const root=new URL('../',import.meta.url);
const plansFile=new URL('data/plans.json',root);
const draftFile=new URL('drafts/next-week.json',root);
const book=JSON.parse(await readFile(new URL('data/recipes.json',root),'utf8'));
const plans=JSON.parse(await readFile(plansFile,'utf8'));
const draft=JSON.parse(await readFile(draftFile,'utf8'));
const result=publishWeekDraft(book,plans,draft);
await writeFile(plansFile,JSON.stringify(result,null,2)+'\n');
await unlink(draftFile);
console.log(`Published ${result.current}. Frozen ${plans.current} in the archive. Run npm test && npm run build before pushing to GitHub.`);
