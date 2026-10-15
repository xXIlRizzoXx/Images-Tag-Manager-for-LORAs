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

console.log('\n--- quello che NON deve cambiare: dentro la colonna ci sono ancora ---');
dice('"Genera tag con AI" (handleAITagClick)', true, corpo.includes('onClick={handleAITagClick}'));
dice('i tag della foto e gli altri del progetto', true, corpo.includes('t.lbAppliedTitle') && corpo.includes('t.lbAvailableTitle'));
dice('"Salva file .txt" (handleSaveSingleTxt)', true, corpo.includes('onClick={handleSaveSingleTxt}'));
dice('nessun altro contenitore nascosto con "hidden" dentro la colonna', [],
    (corpo.slice(rigaColonna.length).match(/className=\{?[`"][^`"]*[`"]/g) || [])
        .filter(c => /(^|[\s`"])(hidden|(sm|md|max-lg|max-md):hidden)(?=[\s`"])/.test(c)));

process.exit(esito());
