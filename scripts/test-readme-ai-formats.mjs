/* ITALIANO: PROVA DI QUELLO CHE IL README PROMETTE SUI FORMATI MANDATI ALL'AI
   Il README diceva che le foto negli altri formati "che l'app sa leggere" partono come copia PNG
   dei loro pixel, e nominava solo il TIFF come foto che non parte. Ma l'app importa anche gli SVG
   (estensioni .svg e .svgz in main.cjs) e li mostra nella galleria, mentre il codice che li manda
   a Google (redrawAsPng in geminiService.ts) non li sa ridisegnare e non manda niente: l'utente
   vedeva la foto e il README gli prometteva il tag con l'AI, che invece falliva.
   La regola: finche' l'app importa TIFF e SVG e il codice dice che non si possono ridisegnare, il
   paragrafo del README sull'AI deve nominarli entrambi in una frase che dica che non partono.
   Si leggono i file VERI, non una copia.
   Uso:  node scripts/test-readme-ai-formats.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF WHAT THE README PROMISES ABOUT THE FORMATS SENT TO THE AI
   The README said photos in the other formats "the app can read" are sent as a PNG copy of their
   pixels, and named only TIFF as a photo that is not sent. But the app also imports SVG files
   (.svg and .svgz in main.cjs) and shows them in the gallery, while the code that sends them to
   Google (redrawAsPng in geminiService.ts) cannot redraw them and sends nothing: the user saw the
   photo and the README promised AI tagging, which then failed.
   The rule: while the app imports TIFF and SVG and the code says they cannot be redrawn, the
   README's AI paragraph must name both in a sentence saying they are not sent.
   The REAL files are read, not a copy.
   Usage:  node scripts/test-readme-ai-formats.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const leggi = (f) => fs.readFileSync(path.join(radice, f), 'utf8');

const readme = leggi('README.md');
const main = leggi('electron/main.cjs');
const gemini = leggi('src/services/geminiService.ts');

// ITALIANO: premesse: l'app importa TIFF e SVG, e il codice dell'AI dice che non li ridisegna.
// ENGLISH: premises: the app imports TIFF and SVG, and the AI code says it does not redraw them.
const estensioni = (main.match(/const SIDECAR_IMAGE_EXT = new Set\(\[([\s\S]*?)\]\)/) || [])[1] || '';
dice('premessa: main.cjs importa .tif/.tiff', true, estensioni.includes("'.tif'") && estensioni.includes("'.tiff'"));
dice('premessa: main.cjs importa .svg/.svgz', true, estensioni.includes("'.svg'") && estensioni.includes("'.svgz'"));
dice('premessa: geminiService.ts dice che TIFF e SVG non si ridisegnano', true,
    /If it cannot be redrawn\s*\n?\s*\/\/\s*\(TIFF, SVG, damaged file\) nothing is sent/.test(gemini));

// ITALIANO: il paragrafo del README sull'AI (quello con Google AI Studio), diviso in frasi.
// ENGLISH: the README's AI paragraph (the one with Google AI Studio), split into sentences.
const paragrafo = readme.split(/\r?\n/).find((r) => r.includes('aistudio.google.com')) || '';
dice('premessa: il README ha il paragrafo dell\'AI', true, paragrafo.length > 0);
const frasi = paragrafo.split(/(?<=\.)\s+/);
const nonParte = (formato) => frasi.some((f) => new RegExp(`\\b${formato}\\b`).test(f) && /\b(never|not) sent\b/.test(f));
dice('il README dice che le foto TIFF non partono', true, nonParte('TIFF'));
dice('il README dice che le foto SVG non partono', true, nonParte('SVG'));
dice('il README dice che quelle foto non si possono taggare con l\'AI', true, /cannot be tagged with AI/.test(paragrafo));

// ITALIANO: quello che non deve cambiare: i formati mandati cosi' come sono e la copia PNG/JPEG.
// ENGLISH: what must not change: the formats sent as they are and the PNG/JPEG copy.
dice('restano i formati mandati come sono', true, paragrafo.includes('JPEG, PNG, WebP and HEIC photos are sent in their own format'));
dice('resta la copia PNG (JPEG se troppo grande)', true, /PNG copy of their pixels \(a JPEG copy when the PNG would be too big\)/.test(paragrafo));

process.exit(esito());
