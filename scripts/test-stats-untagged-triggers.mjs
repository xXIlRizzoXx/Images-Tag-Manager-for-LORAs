/* ITALIANO: PROVA DI "IMMAGINI SENZA TAG" NELLE STATISTICHE CON UNA TRIGGER WORD
   Con la trigger "ohwx" impostata, l'import e il riquadro delle trigger la mettono su ogni foto,
   anche su quelle senza .txt. Le statistiche contavano "con tag" ogni foto con almeno un tag:
   200 foto, 150 senza descrizione, e il pannello diceva "Immagini con tag 200 (100%)" e
   "Immagini senza tag 0". Il resto dell'app ("Salta foto gia' taggate") non conta le trigger:
   ora nemmeno le statistiche, senza badare alle maiuscole.
   Si esegue la riga VERA del conteggio presa da src/App.tsx (compilata con esbuild), con la regola
   vera di src/utils/tagCase.ts.
   Uso:  node scripts/test-stats-untagged-triggers.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "UNTAGGED IMAGES" IN THE STATISTICS WITH A TRIGGER WORD
   With the trigger "ohwx" set, the import and the trigger box put it on every photo, also on those
   with no .txt. The statistics counted as "tagged" every photo with at least one tag: 200 photos,
   150 with no description, and the panel said "Tagged images 200 (100%)" and "Untagged images 0".
   The rest of the app ("Skip already-tagged photos") does not count triggers: now neither do the
   statistics, regardless of case.
   The REAL counting line taken from src/App.tsx is run (compiled with esbuild), with the real rule
   of src/utils/tagCase.ts.
   Usage:  node scripts/test-stats-untagged-triggers.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const C = await carica('src/utils/tagCase.ts');
const righe = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8').split(/\r?\n/);
const riga = righe.find(r => /^\s*const taggedImages = /.test(r)) || '';
if (!riga) { console.log('NO  "const taggedImages = ..." non trovato in src/App.tsx'); console.log('\nPROBLEMI: 1 (1 controlli)'); process.exit(1); }
const codice = (await esbuild.transform(riga.trim(), { loader: 'ts' })).code;
const fabbrica = new Function('statsImages', 'globalTriggers', 'hasTagsBeyondTriggers', codice + '\nreturn taggedImages;');
// ITALIANO: "con tag" e "senza tag" come li mostra il pannello (senza = totale - con).
// ENGLISH: "tagged" and "untagged" as the panel shows them (untagged = total - tagged).
const conta = (foto, trigger) => {
    const con = fabbrica(foto, trigger, C.hasTagsBeyondTriggers);
    return { con, senza: foto.length - con };
};
const foto = (...tags) => ({ tags });

console.log('\n--- trigger "ohwx" su ogni foto, una sola foto con una descrizione ---');
{
    const elenco = [foto('ohwx'), foto('ohwx'), foto('ohwx'), foto('ohwx', 'smile')];
    dice('con tag 1, senza tag 3 (prima: 4 e 0)', { con: 1, senza: 3 }, conta(elenco, ['ohwx']));
    dice('la trigger scritta con altre maiuscole conta lo stesso come trigger', { con: 1, senza: 3 },
        conta([foto('OHWX'), foto('Ohwx'), foto('ohwx'), foto('OHWX', 'smile')], ['ohwx']));
    dice('due trigger: una foto con solo le trigger e\' senza tag', { con: 1, senza: 1 },
        conta([foto('ohwx', 'style1'), foto('ohwx', 'style1', 'smile')], ['ohwx', 'style1']));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    dice('senza trigger: con tag = foto con almeno un tag', { con: 2, senza: 1 }, conta([foto('a'), foto(), foto('b', 'c')], []));
    dice('foto con tags non valido: senza tag, nessun errore', { con: 1, senza: 1 }, conta([{ tags: undefined }, foto('x')], ['ohwx']));
    dice('nessuna foto: 0 e 0', { con: 0, senza: 0 }, conta([], ['ohwx']));
}

process.exit(esito());
