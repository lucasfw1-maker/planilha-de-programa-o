import {mkdirSync,copyFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
mkdirSync(resolve(root,'public/vendor'),{recursive:true});
for(const [source,target] of [
 ['html-to-image/dist/html-to-image.js','html-to-image.js'],
 ['html-to-image/LICENSE','html-to-image.LICENSE'],
 ['jspdf/dist/jspdf.umd.min.js','jspdf.umd.min.js'],
 ['jspdf/LICENSE','jspdf.LICENSE'],
 ['pdfjs-dist/build/pdf.min.mjs','pdf.mjs'],
 ['pdfjs-dist/build/pdf.worker.min.mjs','pdf.worker.mjs'],
 ['pdfjs-dist/LICENSE','pdfjs.LICENSE']
])copyFileSync(resolve(root,'node_modules',source),resolve(root,'public/vendor',target));

// OCR is self-hosted and loaded only when the user imports a screenshot.
mkdirSync(resolve(root,'public/vendor/ocr'),{recursive:true});
for(const [source,target] of [
 ['tesseract.js/dist/tesseract.min.js','tesseract.min.js'],
 ['tesseract.js/dist/worker.min.js','worker.min.js'],
 ['tesseract.js/LICENSE.md','tesseract.LICENSE'],
 ['tesseract.js-core/LICENSE','tesseract-core.LICENSE'],
 ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz','eng.traineddata.gz'],
 ...['','simd-','relaxedsimd-'].map(kind=>[`tesseract.js-core/tesseract-core-${kind}lstm.wasm.js`,`tesseract-core-${kind}lstm.wasm.js`])
])copyFileSync(resolve(root,'node_modules',source),resolve(root,'public/vendor/ocr',target));
