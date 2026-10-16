import {mkdir,rm,cp,readFile} from 'node:fs/promises';
import {validateData} from '../core.js';
const root=new URL('../',import.meta.url),dist=new URL('../dist/',import.meta.url);
const book=JSON.parse(await readFile(new URL('data/recipes.json',root),'utf8'));
const plans=JSON.parse(await readFile(new URL('data/plans.json',root),'utf8'));
validateData(book,plans);
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const file of ['index.html','styles.css','app.js','core.js','assets','data','.nojekyll']) await cp(new URL(file,root),new URL(file,dist),{recursive:true});
console.log('Validated data. Static GitHub Pages site built in dist/.');
