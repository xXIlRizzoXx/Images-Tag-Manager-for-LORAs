/* ITALIANO: PROVA DEL DECIMALE DEI MEGAPIXEL NELL'AVVISO GIALLO «FOTO PICCOLA»
   I megapixel erano scritti con toFixed(2), quindi con il punto in tutte le lingue («0.39 MP» anche
   in italiano), mentre le Statistiche e il peso dell'esportazione usano la virgola fuori da inglese,
   cinese e giapponese. La riga era anche incollata in codice (etichetta + ": " + numeri): in
   francese mancava lo spazio prima dei due punti. Ora la riga e' una frase intera con i segnaposto
   {w}, {h}, {mp} nelle nove lingue, e il decimale segue la lingua.
   Si esegue la regola VERA di src/utils/imageQuality.ts con i testi veri di src/constants.ts.
   Uso:  node scripts/test-image-quality-decimal.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE MEGAPIXEL DECIMAL IN THE YELLOW "SMALL PHOTO" WARNING
   The megapixels were written with toFixed(2), so with a point in every language ("0.39 MP" in
   Italian too), while the Statistics and the export size use a comma outside English, Chinese and
   Japanese. The line was also glued in code (label + ": " + numbers): in French the space before the
   colon was missing. Now the line is a whole sentence with the {w}, {h}, {mp} placeholders in the
   nine languages, and the decimal follows the language.
   The REAL rule of src/utils/imageQuality.ts is run with the real strings of src/constants.ts.
   Usage:  node scripts/test-image-quality-decimal.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
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

console.log('\n--- 512x768 (0,39 megapixel) nelle nove lingue ---');
for (const lang of ['it', 'fr', 'es', 'de', 'pt', 'ru', 'en', 'zh', 'ja']) {
    const t = lingue[lang];
    const testo = String(Q.qualityWarningText(t, 512, 768, lang));
    const atteso = (lang === 'en' || lang === 'zh' || lang === 'ja') ? '0.39' : '0,39';
    dice(`${lang}: «${atteso} MP», la misura 512x768 e nessun segnaposto avanzato`, [true, true, false],
        [testo.includes(atteso + ' MP'), testo.includes('512x768'), /\{\w+\}/.test(testo)]);
    dice(`${lang}: la prima riga e' sempre minQualityWarning`, t.minQualityWarning, testo.split('\n')[0]);
}
dice('fr: lo spazio prima dei due punti', true, String(Q.qualityWarningText(lingue.fr, 512, 768, 'fr')).includes('image : 512x768'));

console.log('\n--- le tre schede passano la lingua ---');
{
    const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
    const visore = fs.readFileSync(path.join(radice, 'src/components/Lightbox.tsx'), 'utf8');
    dice('App.tsx: galleria e cestino (quattro chiamate) con la lingua', 4, (app.match(/qualityWarningText\(t, img\.width, img\.height, lang\)/g) || []).length);
    dice('App.tsx: nessuna chiamata senza la lingua', 0, (app.match(/qualityWarningText\(t, img\.width, img\.height\)/g) || []).length);
    dice('Lightbox.tsx: il visualizzatore (due chiamate) con la lingua', 2, (visore.match(/qualityWarningText\(t, image\.width, image\.height, lang\)/g) || []).length);
}

console.log('\n--- quello che NON deve cambiare ---');
dice('foto illeggibile (0x0): la frase di sempre', lingue.it.imageUnreadable, Q.qualityWarningText(lingue.it, 0, 0, 'it'));
dice('foto da 1024x1024: nessun avviso', null, Q.qualityWarningText(lingue.it, 1024, 1024, 'it'));
dice('senza lingua: il punto, come in inglese', true, String(Q.qualityWarningText(lingue.en, 800, 600)).includes('800x600 (0.48 MP)'));

process.exit(esito());
