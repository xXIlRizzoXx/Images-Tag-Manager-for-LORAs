/* ITALIANO: PROVA DELLA COLONNA DEI TAG DEL VISUALIZZATORE CON LA FINESTRA STRETTA
   La colonna con i tag della foto, "Altri tag del progetto", "Genera tag con AI" e "Salva file
   .txt" aveva la classe "hidden lg:flex": sotto i 1024 px di larghezza (finestra affiancata a
   meta' schermo, schermo al 125%) spariva del tutto e il visualizzatore mostrava solo la foto e le
   frecce, senza dire perche'. Ora la colonna c'e' a ogni larghezza (piu' stretta sotto i 1024 px).
   Si leggono le classi vere da src/components/Lightbox.tsx (qui non si apre nessuna finestra: il
   colpo d'occhio a 750-900 px resta una verifica a mano).
   Uso:  node scripts/test-lightbox-narrow.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE VIEWER'S TAG COLUMN WITH A NARROW WINDOW
   The column with the photo's tags, "Other tags in the project", "Generate tags with AI" and "Save
   .txt file" had the class "hidden lg:flex": below 1024 px of width (window snapped to half the
   screen, screen at 125%) it vanished entirely and the viewer showed only the photo and the arrows,
   without saying why. Now the column is there at every width (narrower below 1024 px).
   The real classes are read from src/components/Lightbox.tsx (no window is opened here: the look
   at 750-900 px stays a check by hand).
   Usage:  node scripts/test-lightbox-narrow.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(path.join(radice, 'src/components/Lightbox.tsx'), 'utf8');

// ITALIANO: la colonna e' il <div> che apre l'intestazione {t.tagsAlreadyInserted}; finisce dove
//           comincia il pannello dei tag suggeriti, suo fratello.
// ENGLISH: the column is the <div> opening the {t.tagsAlreadyInserted} header; it ends where the
//          suggested tags panel, its sibling, starts.
const iTitolo = sorgente.indexOf('{t.tagsAlreadyInserted}');
const iFine = sorgente.indexOf('<TagSuggestionsPanel', iTitolo);
let iColonna = -1;
for (let i = sorgente.lastIndexOf('<div className={`', iTitolo); i >= 0; i = sorgente.lastIndexOf('<div className={`', i - 1)) {
    const riga = sorgente.slice(i, sorgente.indexOf('\n', i));
    if (/\bw-80\b/.test(riga)) { iColonna = i; break; }
}
dice('la colonna dei tag e la sua fine si trovano', true, iTitolo > 0 && iFine > iTitolo && iColonna > 0);
if (!(iTitolo > 0 && iFine > iTitolo && iColonna > 0)) process.exit(esito());
const rigaColonna = sorgente.slice(iColonna, sorgente.indexOf('\n', iColonna));
// ITALIANO: le classi fisse (fuori da ${...}), una per una.
// ENGLISH: the fixed classes (outside ${...}), one by one.
const classi = rigaColonna.replace(/\$\{[^}]*\}/g, ' ').replace(/^<div className=\{`/, '').replace(/`\}>.*$/, '').split(/\s+/).filter(Boolean);
const corpo = sorgente.slice(iColonna, iFine);

console.log('\n--- la colonna sotto i 1024 px ---');
dice('nessuna classe "hidden" che la nasconda (prima: "hidden lg:flex")', [],
    classi.filter(c => c === 'hidden' || /^(sm|md|max-[a-z0-9]+):hidden$/.test(c)));
dice('si mostra a ogni larghezza (classe "flex" senza prefisso)', true, classi.includes('flex'));
dice('ha una larghezza anche sotto i 1024 px, piu\' stretta di quella grande', true,
    classi.some(c => /^w-(48|52|56|60|64|72)$/.test(c)) && classi.includes('lg:w-80'));

// ITALIANO: il pannello dei tag suggeriti, aperto sotto i 1024 px, era una terza colonna larga
//           320 px (fino a 900 se allargato in galleria): con la finestra a meta' di uno schermo da
//           1366 px alla foto restavano 43 px (o zero) e i suoi pulsanti X, cestino e contatore
//           finivano sopra la colonna dei tag. Sotto i 1024 px ora sta SOPRA la foto, appoggiato alla
//           colonna dei tag, e non arriva al bordo sinistro (la X della foto resta libera).
// ENGLISH: the suggested tags panel, opened below 1024 px, was a third column 320 px wide (up to 900
//          if widened in the gallery): with the window at half of a 1366 px screen the photo got
//          43 px (or zero) and its X, trash and counter buttons ended up over the tag column. Below
//          1024 px it now sits OVER the photo, against the tag column, and stops short of the left
//          edge (the photo's X stays free).
console.log('\n--- i tag suggeriti aperti sotto i 1024 px ---');
const pannello = fs.readFileSync(path.join(radice, 'src/components/TagSuggestionsPanel.tsx'), 'utf8');
const iRadice = pannello.indexOf('ref={panelRef}');
const rigaRadice = iRadice < 0 ? '' : pannello.slice(iRadice, pannello.indexOf('>', pannello.indexOf('className=', iRadice)));
// ITALIANO: le classi che il pannello ha SOLO nel visualizzatore (il ramo `isLightbox ? '...'`).
// ENGLISH: the classes the panel has ONLY in the viewer (the `isLightbox ? '...'` branch).
const soloVisualizzatore = [...rigaRadice.matchAll(/isLightbox \? '([^']*)'/g)].map(m => m[1]).join(' ').split(/\s+/).filter(Boolean);
const rigaContenitore = sorgente.split('\n').find(r => r.includes('<div className="w-full h-full mx-auto flex')) || '';
const classiContenitore = (rigaContenitore.match(/className="([^"]*)"/) || ['', ''])[1].split(/\s+/);
dice('sotto i 1024 px il pannello del visualizzatore esce dalla fila (max-lg:absolute) e copre l\'altezza', true,
    soloVisualizzatore.includes('max-lg:absolute') && soloVisualizzatore.includes('max-lg:inset-y-0'));
dice('...dentro il contenitore del visualizzatore (relative)', true, classiContenitore.includes('relative'));
// ITALIANO: si appoggia alla colonna dei tag: distanza da destra = larghezza della colonna (w-64)
//           + lo spazio fra le colonne (gap-4), in rem (1 unita' Tailwind = 0.25rem).
// ENGLISH: it rests against the tag column: distance from the right = the column's width (w-64) +
//          the gap between columns (gap-4), in rem (1 Tailwind unit = 0.25rem).
const unita = (re, lista) => { const c = lista.find(x => re.test(x)); return c ? Number(re.exec(c)[1]) * 0.25 : NaN; };
const attesa = unita(/^w-(\d+)$/, classi) + unita(/^gap-(\d+)$/, classiContenitore);
dice(`...accanto alla colonna dei tag (max-lg:right-[${attesa}rem])`, true, soloVisualizzatore.includes(`max-lg:right-[${attesa}rem]`));
const tetto = soloVisualizzatore.find(c => /^max-lg:max-w-\[calc\(100%_-_[\d.]+rem\)\]$/.test(c)) || '';
const margine = Number((/_-_([\d.]+)rem/.exec(tetto) || [])[1]);
dice('...e non arriva al bordo sinistro: resta posto per la X della foto (almeno 3 rem)', true, margine - attesa >= 3);
dice('...e il contenuto del pannello si stringe con lui (la sua X resta visibile)', true,
    /isLightbox \? 'max-lg:max-w-full'/.test(pannello.slice(pannello.indexOf('style={{ width: `${panelWidth}px` }}') - 10, pannello.indexOf('style={{ width: `${panelWidth}px` }}') + 200)));
// ITALIANO: la foto, con il pannello aperto, a 683 px (meta' di 1366): prima 651 - 16 - 256 - 16 - 320 = 43 px.
// ENGLISH: the photo, with the panel open, at 683 px (half of 1366): before 651 - 16 - 256 - 16 - 320 = 43 px.
const fotoA683 = 683 - 32 - attesa * 16 - (soloVisualizzatore.includes('max-lg:absolute') ? 0 : 16 + 320);
dice('a 683 px con il pannello aperto la foto tiene almeno 300 px', true, fotoA683 >= 300);
// ITALIANO: in galleria (isLightbox falso) il pannello resta una colonna come prima.
// ENGLISH: in the gallery (isLightbox false) the panel stays a column as before.
dice('in galleria nessuna classe max-lg: (resta una colonna)', [], [...rigaRadice.matchAll(/: '([^']*)'/g)].map(m => m[1]).join(' ').split(/\s+/).filter(c => c.startsWith('max-lg:')));

console.log('\n--- quello che NON deve cambiare: dentro la colonna ci sono ancora ---');
dice('"Genera tag con AI" (handleAITagClick)', true, corpo.includes('onClick={handleAITagClick}'));
dice('i tag della foto e gli altri del progetto', true, corpo.includes('t.lbAppliedTitle') && corpo.includes('t.lbAvailableTitle'));
dice('"Salva file .txt" (handleSaveSingleTxt)', true, corpo.includes('onClick={handleSaveSingleTxt}'));
dice('nessun altro contenitore nascosto con "hidden" dentro la colonna', [],
    (corpo.slice(rigaColonna.length).match(/className=\{?[`"][^`"]*[`"]/g) || [])
        .filter(c => /(^|[\s`"])(hidden|(sm|md|max-lg|max-md):hidden)(?=[\s`"])/.test(c)));

process.exit(esito());
