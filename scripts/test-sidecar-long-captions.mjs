/* ITALIANO: PROVA DELLE DIDASCALIE LUNGHE NEI .txt
   All'import ogni tag veniva tagliato a 100 caratteri e ogni .txt a 200 tag, senza dirlo. Le
   didascalie in frase dei dataset Flux/SDXL (120-300 caratteri senza virgole) arrivavano monche,
   e al primo salvataggio (basta aggiungere una trigger word) la frase monca finiva su disco.
   Lo stesso taglio valeva per il backup anti-crash.
   Si provano le regole VERE di src/utils/sidecarTags.ts e src/utils/tagBackup.ts (compilate al
   volo con esbuild).
   Uso:  node scripts/test-sidecar-long-captions.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF LONG CAPTIONS IN THE .txt FILES
   At import every tag was cut at 100 characters and every .txt at 200 tags, silently. Sentence
   captions from Flux/SDXL datasets (120-300 characters with no commas) arrived truncated, and on
   the first save (adding a trigger word is enough) the truncated sentence went to disk. The same
   cut applied to the crash backup.
   The REAL rules of src/utils/sidecarTags.ts and src/utils/tagBackup.ts are tested (compiled on the
   fly with esbuild).
   Usage:  node scripts/test-sidecar-long-captions.mjs      (exits with code 1 if anything is off) */

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
const S = await carica('src/utils/sidecarTags.ts');
const B = await carica('src/utils/tagBackup.ts');
const { dice, esito } = creaControlli();

const fraseLunga = 'a photograph of a young woman with long brown hair wearing a red dress standing in front of an old stone wall at sunset with warm golden light';
const frase300 = (fraseLunga + ' ' + fraseLunga).slice(0, 300);
const molti = Array.from({ length: 250 }, (_, i) => 'tag' + (i + 1));

console.log('\n--- didascalie in frase ---');
{
    const r = S.parseSidecarText(fraseLunga + ',');
    dice(`una frase di ${fraseLunga.length} caratteri resta intera`, [fraseLunga], r.tags);
    dice('...e non risulta accorciata', false, r.truncated);
    const r2 = S.parseSidecarText('mychar, ' + frase300);
    dice('una frase di 300 caratteri dopo la trigger resta intera', ['mychar', frase300], r2.tags);
}

console.log('\n--- tanti tag in un .txt ---');
{
    const r = S.parseSidecarText(molti.join(', ') + ',');
    dice('250 tag restano 250', 250, r.tags.length);
    dice('l\'ultimo c\'e\'', 'tag250', r.tags[r.tags.length - 1]);
    dice('...e non risulta accorciato', false, r.truncated);
}

console.log('\n--- un file fuori misura si accorcia, ma lo dice ---');
{
    const r = S.parseSidecarText('x'.repeat(50_000));
    dice('un "tag" di 50.000 caratteri risulta accorciato', true, r.truncated);
    dice('...a una lunghezza che la galleria regge', true, r.tags.length === 1 && r.tags[0].length < 50_000);
    const tanti = S.parseSidecarText(Array.from({ length: 5000 }, (_, i) => 't' + i).join(','));
    dice('5000 tag in un file risultano accorciati', true, tanti.truncated);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = S.parseSidecarText('1girl,\r\n smile ,, smile,\tred\x07dress ,\n');
    dice('virgole e a capo separano, spazi tolti, vuoti e doppioni via, controlli sostituiti', ['1girl', 'smile', 'red dress'], r.tags);
    dice('...e niente risulta accorciato', false, r.truncated);
}

console.log('\n--- il backup anti-crash non accorcia i tag che rimette ---');
{
    const voce = { tags: ['mychar', fraseLunga] };
    dice('una frase lunga torna intera dal backup', ['mychar', fraseLunga], B.tagDaRipristinare(voce, ['mychar'], ['mychar'], [], undefined, null));
    const tanti = { tags: Array.from({ length: 600 }, (_, i) => 'b' + i) };
    const r = B.tagDaRipristinare(tanti, ['b0'], ['b0'], [], undefined, null);
    dice('600 tag tornano tutti dal backup', 600, r ? r.length : 0);
}

process.exit(esito());
