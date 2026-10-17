import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createWeekDraft} from '../core.js';

const root=new URL('../',import.meta.url);
const draftFile=new URL('drafts/next-week.json',root);
const id=process.argv[2];
if(!id){console.error('Usage: npm run new-week -- YYYY-MM-DD (next Monday)');process.exit(1);}
try{await access(draftFile);throw new Error('An unfinished draft already exists: drafts/next-week.json');}
catch(e){if(e.code!=='ENOENT')throw e;}
const book=JSON.parse(await readFile(new URL('data/recipes.json',root),'utf8'));
const plans=JSON.parse(await readFile(new URL('data/plans.json',root),'utf8'));
const draft=createWeekDraft(book,plans,id);
await mkdir(new URL('drafts/',root),{recursive:true});
await writeFile(draftFile,JSON.stringify(draft,null,2)+'\n');
console.log(`Draft created for ${id}. Edit drafts/next-week.json, update recipes if needed, then run npm run publish-week. Live week is unchanged.`);
