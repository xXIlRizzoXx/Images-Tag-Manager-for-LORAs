/* ITALIANO: PROVA CHE IL CONTROLLO DELLE LINGUE NON PASSI A VUOTO
   scripts/check-translations.mjs riconosce un blocco lingua solo se la riga d'apertura e' scritta
   esattamente "    pt: {". Bastava un commento in fondo ("    pt: { // Portugues") perche' tutto il
   blocco portoghese sparisse dal controllo: una chiave mancante li' passava, e il controllo diceva
   "nessun problema meccanico" con otto lingue su nove. Lo stesso con una lingua scritta male sulla
   riga di comando ("pt-BR"): non controllava niente e passava.
   La regola: le lingue trovate devono essere esattamente le nove attese, e una lingua chiesta che
   non esiste e' un errore. Si esegue lo script VERO su una copia modificata di src/constants.ts in
   una cartella temporanea (poi cancellata), e sul file vero.
   Uso:  node scripts/test-check-translations-languages.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT THE LANGUAGE CHECK DOES NOT PASS ON NOTHING
   scripts/check-translations.mjs recognises a language block only when its opening line reads
   exactly "    pt: {". A trailing comment ("    pt: { // Portugues") was enough for the whole
   Portuguese block to drop out of the check: a key missing there passed, and the check said "no
   mechanical problem" with eight languages out of nine. The same with a mistyped language on the
   command line ("pt-BR"): it checked nothing and passed.
   The rule: the languages found must be exactly the nine expected, and a requested language that
   does not exist is an error. The REAL script runs on a modified copy of src/constants.ts in a
   temporary folder (deleted afterwards), and on the real file.
   Usage:  node scripts/test-check-translations-languages.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(radice, 'scripts', 'check-translations.mjs');
const { dice, esito } = creaControlli();
const lancia = (cwd, ...argomenti) => {
    const r = spawnSync(process.execPath, [script, ...argomenti], { cwd, encoding: 'utf8' });
    return { codice: r.status, testo: String(r.stdout || '') + String(r.stderr || '') };
};

const vero = fs.readFileSync(path.join(radice, 'src/constants.ts'), 'utf8');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-lng-'));
try {
    // ITALIANO: la copia: apertura del portoghese con un commento, e una chiave tolta da quel blocco.
    // ENGLISH: the copy: Portuguese opening with a comment, and one key removed from that block.
    const righe = vero.split('\n');
    const apre = righe.findIndex(r => /^    pt: \{\s*$/.test(r));
    dice('premessa: il blocco portoghese si apre con "    pt: {"', true, apre >= 0);
    righe[apre] = '    pt: { // Portugues (Brasil)';
    const chiave = righe.findIndex((r, i) => i > apre && /^        errorBoundaryRetry:/.test(r));
    dice('premessa: il blocco portoghese ha errorBoundaryRetry', true, chiave > apre);
    righe.splice(chiave, 1);
    fs.mkdirSync(path.join(temp, 'src'));
    fs.writeFileSync(path.join(temp, 'src', 'constants.ts'), righe.join('\n'));

    console.log('\n--- un blocco lingua non riconosciuto ---');
    const r1 = lancia(temp);
    dice('il controllo fallisce (codice 1)', 1, r1.codice);
    dice('e non dice "nessun problema meccanico"', false, r1.testo.includes('nessun problema meccanico'));
    dice('e nomina la lingua che manca', true, /\bpt\b/.test(r1.testo.split('\n').filter(r => /ERRORE/.test(r)).join(' ')));

    console.log('\n--- una lingua che non esiste sulla riga di comando ---');
    const r2 = lancia(radice, 'pt-BR');
    dice('"pt-BR": il controllo fallisce (codice 1)', 1, r2.codice);
    dice('"pt-BR": non dice "nessun problema meccanico"', false, r2.testo.includes('nessun problema meccanico'));

    console.log('\n--- quello che NON deve cambiare ---');
    const r3 = lancia(radice);
    dice('il file vero, nessuna lingua chiesta: passa', [0, true], [r3.codice, r3.testo.includes('ESITO: nessun problema meccanico')]);
    const r4 = lancia(radice, 'pt');
    dice('il file vero, solo "pt": passa', [0, true], [r4.codice, r4.testo.includes('ESITO: nessun problema meccanico')]);
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}

process.exit(esito());
