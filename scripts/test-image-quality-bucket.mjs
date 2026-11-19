/* ITALIANO: PROVA DELLA SOGLIA DEL MEGAPIXEL NELL'AVVISO GIALLO «FOTO PICCOLA»
   La soglia era 1.048.576 pixel (1024x1024), ma il testo dice «almeno 1 megapixel» e i megapixel
   mostrati sono pixel / 1.000.000: le misure standard dei bucket SDXL (896x1152, 832x1216, 768x1344,
   1,01-1,03 MP) ricevevano il triangolo giallo con scritto «almeno 1 megapixel ... (1,03 MP)».
   Ora la soglia e' 1.000.000 di pixel e una foto segnalata non mostra mai «1,00 MP» o piu'.
   Si esegue la regola VERA di src/utils/imageQuality.ts con i testi veri di src/constants.ts.
   Uso:  node scripts/test-image-quality-bucket.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE MEGAPIXEL THRESHOLD IN THE YELLOW "SMALL PHOTO" WARNING
   The threshold was 1,048,576 pixels (1024x1024), but the text says "at least 1 megapixel" and the
   megapixels shown are pixels / 1,000,000: the standard SDXL bucket sizes (896x1152, 832x1216,
   768x1344, 1.01-1.03 MP) got the yellow triangle reading "at least 1 megapixel ... (1.03 MP)".
   Now the threshold is 1,000,000 pixels and a flagged photo never shows "1.00 MP" or more.
   The REAL rule of src/utils/imageQuality.ts is run with the real strings of src/constants.ts.
   Usage:  node scripts/test-image-quality-bucket.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const lingue = (await carica('src/constants.ts')).translations;
const Q = await carica('src/utils/imageQuality.ts');
const { dice, esito } = creaControlli();

console.log('\n--- misure dei bucket SDXL (piu\' di 1 megapixel): nessun avviso ---');
for (const [w, h] of [[896, 1152], [1152, 896], [832, 1216], [768, 1344], [1024, 1000], [1000, 1000]]) {
    dice(`${w}x${h} (${(w * h).toLocaleString('it')} pixel): stato ok`, 'ok', Q.qualityState(w, h));
    dice(`${w}x${h}: nessun avviso`, null, Q.qualityWarningText(lingue.it, w, h, 'it'));
}

console.log('\n--- una foto segnalata mostra sempre meno di 1 MP ---');
for (const [w, h] of [[999, 1000], [1000, 999], [999, 1001], [800, 600], [512, 768]]) {
    const testo = String(Q.qualityWarningText(lingue.en, w, h, 'en'));
    const mp = Number((testo.match(/\((\d+\.\d+) MP\)/) || [])[1]);
    dice(`${w}x${h}: stato low`, 'low', Q.qualityState(w, h));
    dice(`${w}x${h}: il numero mostrato (${mp}) e' sotto 1`, true, mp < 1);
}

console.log('\n--- quello che NON deve cambiare ---');
dice('800x600 in italiano: «0,48 MP»', true, String(Q.qualityWarningText(lingue.it, 800, 600, 'it')).includes('800x600 (0,48 MP)'));
dice('512x768 in italiano: «0,39 MP»', true, String(Q.qualityWarningText(lingue.it, 512, 768, 'it')).includes('(0,39 MP)'));
dice('foto illeggibile (0x0): la frase di sempre', lingue.it.imageUnreadable, Q.qualityWarningText(lingue.it, 0, 0, 'it'));
dice('1024x1024: nessun avviso', null, Q.qualityWarningText(lingue.it, 1024, 1024, 'it'));

process.exit(esito());
