import {mkdir,rm,cp,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateData} from '../core.js';
const root=new URL('../',import.meta.url),dist=new URL('../dist/',import.meta.url);
const book=JSON.parse(await readFile(new URL('data/recipes.json',root),'utf8'));
const plans=JSON.parse(await readFile(new URL('data/plans.json',root),'utf8'));
validateData(book,plans);
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const file of ['index.html','styles.css','app.js','core.js','assets','data','workshop','.nojekyll']) await cp(new URL(file,root),new URL(file,dist),{recursive:true});
console.log('Validated data. Static GitHub Pages site built in dist/.');

const files=await Promise.all(['app.js','core.js','styles.css','data/recipes.json','data/plans.json'].map(name=>readFile(new URL(name,root))));
const version=process.env.GITHUB_SHA?.slice(0,12)||createHash('sha256').update(Buffer.concat(files)).digest('hex').slice(0,12);
const pagePath=new URL('index.html',dist);
let html=await readFile(pagePath,'utf8');
// Use new physical filenames, not merely query strings. This defeats sticky
// iOS Safari / in-app browser resource caches that survived previous deployments.
const [appSource,coreSource,cssSource]=await Promise.all(['app.js','core.js','styles.css'].map(name=>readFile(new URL(name,root),'utf8')));
const coreName='core-'+version+'.js',appName='app-'+version+'.js',styleName='styles-'+version+'.css';
const appVersion=appSource.replace("from './core.js'","from './"+coreName+"'");
await writeFile(new URL(coreName,dist),coreSource);
await writeFile(new URL(appName,dist),appVersion);
await writeFile(new URL(styleName,dist),cssSource);
html=html.replace(/href="\.\/styles\.css(?:\?[^"]*)?"/,'href="./'+styleName+'"')
         .replace(/src="\.\/app\.js(?:\?[^"]*)?"/,'src="./'+appName+'"');
await writeFile(pagePath,html);
console.log('Cache-busted site JS/CSS version:',version);
