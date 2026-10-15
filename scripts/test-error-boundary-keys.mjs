/* ITALIANO: PROVA CHE LE CHIAVI DELLA SCHERMATA D'ERRORE SIANO CONTROLLATE
   La schermata che compare quando l'app va in errore (src/components/ErrorBoundary.tsx) legge i suoi
   quattro testi da `s = getStrings()`, e getStrings rendeva un valore senza tipo (any). Una chiave
   scritta male (s.errorBoundaryTitel) o mai aggiunta a src/constants.ts passava il controllo dei
   tipi e anche scripts/check-translations.mjs (che guarda solo `t` e `tPending`): il titolo della
   schermata d'errore usciva vuoto in tutte e nove le lingue. Ora getStrings ha il tipo del blocco
   inglese e il compilatore segnala la chiave sbagliata.
   Si compila con il compilatore TypeScript del progetto il file VERO e una sua copia in memoria con
   la chiave scritta male (niente file scritti su disco).
   Uso:  node scripts/test-error-boundary-keys.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT THE ERROR SCREEN'S KEYS ARE CHECKED
   The screen shown when the app crashes (src/components/ErrorBoundary.tsx) reads its four texts
   from `s = getStrings()`, and getStrings returned an untyped value (any). A misspelled key
   (s.errorBoundaryTitel), or one never added to src/constants.ts, passed the type check and also
   scripts/check-translations.mjs (which only looks at `t` and `tPending`): the error screen's title
   came out blank in all nine languages. Now getStrings has the English block's type and the
   compiler reports the wrong key.
   The REAL file and an in-memory copy of it with the misspelled key are compiled with the project's
   TypeScript compiler (no file written to disk).
   Usage:  node scripts/test-error-boundary-keys.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ts = createRequire(path.join(radice, 'package.json'))('typescript');
const { dice, esito } = creaControlli();
const FILE = path.join(radice, 'src/components/ErrorBoundary.tsx');
const vero = fs.readFileSync(FILE, 'utf8');

// ITALIANO: le opzioni del progetto (tsconfig.json), e il file sostituito in memoria con `testo`.
// ENGLISH: the project's options (tsconfig.json), and the file replaced in memory with `testo`.
const config = ts.getParsedCommandLineOfConfigFile(path.join(radice, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => { } });
const errori = (testo) => {
    const ospite = ts.createCompilerHost(config.options);
    const leggi = ospite.getSourceFile;
    ospite.getSourceFile = (nome, versione, ...resto) => (path.resolve(nome) === path.resolve(FILE)
        ? ts.createSourceFile(nome, testo, versione)
        : leggi.call(ospite, nome, versione, ...resto));
    const programma = ts.createProgram([FILE], config.options, ospite);
    return ts.getPreEmitDiagnostics(programma)
        .filter(d => d.file && path.resolve(d.file.fileName) === path.resolve(FILE))
        .map(d => ({ codice: d.code, testo: ts.flattenDiagnosticMessageText(d.messageText, ' ') }));
};

dice('premessa: la schermata legge s.errorBoundaryTitle', true, vero.includes('{s.errorBoundaryTitle}'));

console.log('\n--- una chiave scritta male nella schermata d\'errore ---');
const sbagliata = errori(vero.replace('{s.errorBoundaryTitle}', '{s.errorBoundaryTitel}'));
dice('il compilatore la segnala (proprieta\' inesistente, codice 2339 o 2551)', true,
    sbagliata.some(d => (d.codice === 2339 || d.codice === 2551) && d.testo.includes('errorBoundaryTitel')));

console.log('\n--- quello che NON deve cambiare ---');
dice('il file vero si compila senza errori', [], errori(vero));
// ITALIANO: la lingua salvata sceglie ancora il suo blocco, e una lingua sconosciuta l'inglese.
// ENGLISH: the saved language still picks its block, and an unknown language English.
dice('getStrings legge ancora la lingua salvata, con l\'inglese di riserva', true,
    /localStorage\.getItem\('lang'\)/.test(vero) && /\|\| translations\.en/.test(vero));

process.exit(esito());
