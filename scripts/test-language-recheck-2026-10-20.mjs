/* ITALIANO: PROVA DEI TRE RILIEVI DEL RICONTROLLO LINGUE DEL 20/10/2026
   Dopo il ciclo di debug del 19-20/10 gli agenti di lingua hanno riletto le voci nuove. Tre rilievi:
   1. inglese, aiModelCheckBusy: "The current one stays" senza la parola "model" si legge come "il
      controllo attuale resta"; ora dice "the model check" e "The current model stays";
   2. russo, deleteAlreadyGone: l'etichetta non diceva che cosa era stato tolto (mancava "фото");
   3. cinese: "Salva e chiudi" con modifiche arrivate nel frattempo unisce closeNewChangesMeanwhile
      e l'avviso del salvataggio con uno spazio anche dopo "。"; ora, come per aiBatchHiddenData,
      niente spazio dopo la punteggiatura a larghezza piena.
   Uso:  node scripts/test-language-recheck-2026-10-20.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE THREE FINDINGS OF THE 20/10/2026 LANGUAGE RECHECK
   After the 19-20/10 debugging cycle the language agents reread the new entries. Three findings:
   1. English, aiModelCheckBusy: "The current one stays" without the word "model" reads as "the
      current check stays"; it now says "the model check" and "The current model stays";
   2. Russian, deleteAlreadyGone: the label did not say what had been removed ("фото" was missing);
   3. Chinese: "Save and close" with changes that arrived meanwhile joins closeNewChangesMeanwhile and
      the save warning with a space even after "。"; now, as for aiBatchHiddenData, no space after
      full-width punctuation.
   Usage:  node scripts/test-language-recheck-2026-10-20.mjs      (exits with code 1 if anything is off) */

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

const en = lingue.en.aiModelCheckBusy;
dice('en aiModelCheckBusy nomina "the model check"', true, /model check/i.test(en));
dice('en aiModelCheckBusy dice "The current model stays"', true, /current model/i.test(en));

const ru = lingue.ru.deleteAlreadyGone;
dice('ru deleteAlreadyGone dice nell\'etichetta che sono state tolte delle foto', true, /фото/i.test(ru.split('{n}')[0]));
dice('ru deleteAlreadyGone tiene il segnaposto {n}', true, ru.includes('{n}'));

// ITALIANO: la riga che mostra closeNewChangesMeanwhile non unisce piu' con un semplice spazio, e
//           controlla la punteggiatura a larghezza piena come la riga di aiBatchHiddenData.
// ENGLISH: the line showing closeNewChangesMeanwhile no longer joins with a plain space, and checks
//          full-width punctuation like the aiBatchHiddenData line.
const righe = app.split(/\r?\n/);
const intorno = i => righe.slice(Math.max(0, i - 3), i + 6).join('\n');
const riga = righe.findIndex((r, i) => r.includes('t.closeNewChangesMeanwhile') && intorno(i).includes('avvisoSalvataggioRef'));
const blocco = riga >= 0 ? intorno(riga) : '';
dice('App.tsx unisce ancora closeNewChangesMeanwhile all\'avviso del salvataggio', true, riga >= 0);
dice('closeNewChangesMeanwhile non e\' unita con un semplice join(\' \')', false, blocco.includes(".filter(Boolean).join(' ')"));
dice('niente spazio dopo 。！？ quando segue l\'avviso del salvataggio', true, blocco.includes('[。！？]$'));

process.exit(esito());
