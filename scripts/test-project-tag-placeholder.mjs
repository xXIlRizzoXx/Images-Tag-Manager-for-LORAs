/* ITALIANO: PROVA DEL TESTO GUIDA NEL CAMPO DEI TAG GENERICI DEL PROGETTO
   Il campo per aggiungere un tag nel pannello "Tag Generici Progetto" diceva "aggiungi ... in
   memoria" in tutte e nove le lingue (in cinese 内存, cioe' la RAM del computer). Nell'interfaccia
   non esiste nessuna "memoria": il tag finisce nell'elenco dei tag del progetto. Ora il testo dice
   "al progetto" in ogni lingua. Si controlla anche che il campo del pannello usi ancora questa chiave.
   Uso:  node scripts/test-project-tag-placeholder.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE HINT IN THE GENERIC PROJECT TAGS FIELD
   The field that adds a tag in the "Generic Project Tags" panel said "add ... to memory" in all nine
   languages (in Chinese 内存, the computer's RAM). The interface has no "memory": the tag goes into
   the project's tag list. The text now says "to the project" in every language. The panel field is
   also checked to still use this key.
   Usage:  node scripts/test-project-tag-placeholder.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const lingue = (await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'))).translations;
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');

// ITALIANO: la parola "memoria" e la parola "progetto" in ogni lingua.
// ENGLISH: the word "memory" and the word "project" in every language.
const parole = {
    it: [/memoria/i, /progetto/i], en: [/memory/i, /project/i], fr: [/mémoire/i, /projet/i],
    es: [/memoria/i, /proyecto/i], de: [/Speicher/i, /Projekt/i], zh: [/内存/, /项目/],
    ja: [/メモリ/, /プロジェクト/], pt: [/memória/i, /projeto/i], ru: [/памят/i, /проект/i],
};

console.log('\n--- le nove lingue ---');
for (const [codice, [memoria, progetto]] of Object.entries(parole)) {
    const testo = lingue[codice].addTagToProject || '';
    dice(`${codice}: "${testo}" non parla di memoria e dice dove va il tag (il progetto)`, [false, true], [memoria.test(testo), progetto.test(testo)]);
}

console.log('\n--- App.tsx ---');
const iCampo = app.indexOf('placeholder={t.addTagToProject}');
const iPannello = app.indexOf('isGlobalTagManagerOpen &&');
dice('il campo del pannello dei tag del progetto usa t.addTagToProject', true, iCampo > 0 && iPannello > 0 && iPannello < iCampo);

process.exit(esito());
