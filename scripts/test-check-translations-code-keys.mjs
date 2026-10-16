/* ITALIANO: PROVA CHE IL CONTROLLO DELLE LINGUE GUARDI ANCHE LE CHIAVI LETTE DAL CODICE
   scripts/check-translations.mjs confrontava le nove lingue tra loro, ma non leggeva mai il codice
   che usa le chiavi. I componenti (Lightbox, TagFileEditor, i dialoghi di ui.tsx...) ricevono `t`
   senza tipo, quindi una chiave scritta male (t.tagsAlreadyInsertd) o aggiunta al codice ma mai a
   src/constants.ts passava il controllo dei tipi, questo controllo, le prove e la build, e la
   scritta usciva vuota in tutte e nove le lingue.
   La regola: ogni `t.<chiave>` (o `tPending.<chiave>`) letto dove `t` non ha tipo deve essere una
   chiave del blocco inglese. Dove `t` e' qualcos'altro con un tipo (es. `(t: string) => t.trim()`)
   non si segnala niente: li' controlla gia' il compilatore. Si esegue lo script VERO su copie
   modificate dei file in una cartella temporanea (poi cancellata), e sul progetto vero.
   Uso:  node scripts/test-check-translations-code-keys.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT THE LANGUAGE CHECK ALSO LOOKS AT THE KEYS THE CODE READS
   scripts/check-translations.mjs compared the nine languages with each other, but never read the
   code that uses the keys. The components (Lightbox, TagFileEditor, the ui.tsx dialogs...) receive
   `t` untyped, so a misspelled key (t.tagsAlreadyInsertd), or one added to the code but never to
   src/constants.ts, passed the type check, this check, the tests and the build, and the label
   came out blank in all nine languages.
   The rule: every `t.<key>` (or `tPending.<key>`) read where `t` is untyped must be a key of the
   English block. Where `t` is something else with a type (e.g. `(t: string) => t.trim()`) nothing
   is reported: the compiler already checks there. The REAL script runs on modified copies of the
   files in a temporary folder (deleted afterwards), and on the real project.
   Usage:  node scripts/test-check-translations-code-keys.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(radice, 'scripts', 'check-translations.mjs');
const { dice, esito } = creaControlli();
const lancia = (cwd) => {
    const r = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' });
    return { codice: r.status, testo: String(r.stdout || '') + String(r.stderr || '') };
};
const vero = (rel) => fs.readFileSync(path.join(radice, rel), 'utf8');

// ITALIANO: prepara una cartella con src/constants.ts e i file dati (percorso relativo -> testo).
// ENGLISH: prepares a folder with src/constants.ts and the given files (relative path -> text).
const cartelle = [];
const prepara = (file) => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-keys-'));
    cartelle.push(temp);
    for (const [rel, testo] of Object.entries({ 'src/constants.ts': vero('src/constants.ts'), ...file })) {
        fs.mkdirSync(path.dirname(path.join(temp, rel)), { recursive: true });
        fs.writeFileSync(path.join(temp, rel), testo);
    }
    return temp;
};

const lightbox = vero('src/components/Lightbox.tsx');
const ui = vero('src/components/ui.tsx');
const traduzione = vero('src/utils/tagTranslation.ts');
try {
    dice('premessa: Lightbox legge t.tagsAlreadyInserted', true, lightbox.includes('{t.tagsAlreadyInserted}'));
    dice('premessa: ui.tsx ha una t locale di tipo string (t.trim)', true, /\(t: string\) => t\.trim\(\)/.test(ui));
    dice('premessa: tagTranslation.ts legge t?.catColors', true, traduzione.includes('t?.catColors'));

    console.log('\n--- una chiave scritta male in un componente senza tipo ---');
    const r1 = lancia(prepara({
        'src/components/Lightbox.tsx': lightbox.replace('{t.tagsAlreadyInserted}', '{t.tagsAlreadyInsertd}'),
        'src/components/ui.tsx': ui,
    }));
    dice('il controllo fallisce (codice 1)', 1, r1.codice);
    dice('e non dice "nessun problema meccanico"', false, r1.testo.includes('nessun problema meccanico'));
    dice('e nomina la chiave e il file', true, r1.testo.includes('tagsAlreadyInsertd') && r1.testo.includes('Lightbox.tsx'));

    console.log('\n--- una chiave scritta male letta con t?. in un modulo di utilita\' ---');
    const r2 = lancia(prepara({ 'src/utils/tagTranslation.ts': traduzione.replace('t?.catColors', 't?.catColorz') }));
    dice('il controllo fallisce (codice 1)', 1, r2.codice);
    dice('e nomina la chiave', true, r2.testo.includes('catColorz'));

    console.log('\n--- una chiave usata dal codice ma assente in tutte e nove le lingue ---');
    const senzaChiave = vero('src/constants.ts').split('\n').filter(r => !/^        tagsAlreadyInserted:/.test(r)).join('\n');
    dice('premessa: la chiave era in nove blocchi', 9, vero('src/constants.ts').split('\n').filter(r => /^        tagsAlreadyInserted:/.test(r)).length);
    const r3 = lancia(prepara({ 'src/constants.ts': senzaChiave, 'src/components/Lightbox.tsx': lightbox }));
    dice('il controllo fallisce (codice 1)', 1, r3.codice);
    dice('e nomina la chiave', true, r3.testo.includes('tagsAlreadyInserted'));

    console.log('\n--- quello che NON deve cambiare ---');
    const r4 = lancia(prepara({ 'src/components/Lightbox.tsx': lightbox, 'src/components/ui.tsx': ui, 'src/utils/tagTranslation.ts': traduzione }));
    dice('copie senza modifiche (con la t.trim locale): passa', [0, true], [r4.codice, r4.testo.includes('ESITO: nessun problema meccanico')]);
    const r5 = lancia(radice);
    dice('il progetto vero: passa', [0, true], [r5.codice, r5.testo.includes('ESITO: nessun problema meccanico')]);
} finally {
    for (const c of cartelle) fs.rmSync(c, { recursive: true, force: true });
}

process.exit(esito());
