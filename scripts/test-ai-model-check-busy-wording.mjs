/* ITALIANO: PROVA DEL TESTO "GOOGLE OCCUPATO" NEL CONTROLLO DEL MODELLO
   Il controllo del modello ("Controlla ora" o "Automatico") mostra aiModelCheckBusy quando Google
   risponde con troppe richieste (429), ma anche quando e' sovraccarico (503 "The model is
   overloaded") o quando il modello non risponde entro il tempo della prova. La frase diceva solo
   "Google chiede di rallentare" in tutte e nove le lingue: falsa nei casi del sovraccarico, in cui
   l'utente non e' andato troppo veloce. Ora dice "sovraccarico o chiede di rallentare", come la
   frase gemella della prova dei modelli (aiProbeBusy), e promette ancora che il controllo si ripete.
   Uso:  node scripts/test-ai-model-check-busy-wording.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "GOOGLE BUSY" TEXT IN THE MODEL CHECK
   The model check ("Check now" or "Automatic") shows aiModelCheckBusy when Google answers with too
   many requests (429), but also when it is overloaded (503 "The model is overloaded") or when the
   model does not answer within the probe time. The sentence only said "Google asks to slow down" in
   all nine languages: false in the overload cases, where the user did not go too fast. It now says
   "overloaded or asking to slow down", like the twin sentence of the model test (aiProbeBusy), and
   still promises that the check is repeated.
   Usage:  node scripts/test-ai-model-check-busy-wording.mjs      (exits with code 1 if anything is off) */

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

// ITALIANO: in ogni lingua la parola del sovraccarico, quella del rallentare e quella della
//           ripetizione (la stessa della tabella PROMESSA di test-ai-probe-busy-message.mjs).
// ENGLISH: in every language the word for overload, the one for slowing down and the one for the
//          repetition (the same as the PROMESSA table of test-ai-probe-busy-message.mjs).
const parole = {
    it: [/sovraccaric/i, /rallentare/i, 'ripet'], en: [/overload/i, /slow down/i, 'repeat'],
    fr: [/surcharg/i, /ralentir/i, 'refaite'], es: [/sobrecarg/i, /despacio/i, 'repetir'],
    de: [/überlast/i, /langsamer/i, 'wiederholt'], zh: [/过载/, /放慢/, '再次检查'],
    ja: [/混み合/, /速度を落とす/, 'もう一度行います'], pt: [/sobrecarregad/i, /devagar/i, 'repetid'],
    ru: [/перегруж/i, /сбавить темп/i, 'повтор'],
};

console.log('\n--- le nove lingue ---');
for (const [codice, [sovraccarico, rallentare, ripete]] of Object.entries(parole)) {
    const testo = lingue[codice].aiModelCheckBusy || '';
    dice(`${codice}: "${testo}" dice sovraccarico, rallentare e che il controllo si ripete`, [true, true, true],
        [sovraccarico.test(testo), rallentare.test(testo), testo.toLowerCase().includes(ripete)]);
    dice(`${codice}: resta diversa dalla frase della prova dei modelli`, true, testo !== lingue[codice].aiProbeBusy);
}

console.log('\n--- App.tsx ---');
dice('l\'esito "occupato" del controllo mostra aiModelCheckBusy', true, app.includes("esito.esito === 'occupato') showNotification(t.aiModelCheckBusy, 'info')"));
dice('anche un errore "busy" (503) o "rate_limit" (429) nel ramo catch', true, app.includes("kind === 'rate_limit' || kind === 'busy') showNotification(t.aiModelCheckBusy, 'info')"));

process.exit(esito());
