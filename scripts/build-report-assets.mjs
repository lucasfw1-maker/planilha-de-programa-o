import {mkdirSync,copyFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
mkdirSync(resolve(root,'public/vendor'),{recursive:true});
for(const [source,target] of [
 ['html-to-image/dist/html-to-image.js','html-to-image.js'],
 ['html-to-image/LICENSE','html-to-image.LICENSE'],
 ['jspdf/dist/jspdf.umd.min.js','jspdf.umd.min.js'],
 ['jspdf/LICENSE','jspdf.LICENSE']
])copyFileSync(resolve(root,'node_modules',source),resolve(root,'public/vendor',target));
