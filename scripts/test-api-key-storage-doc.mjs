/* ITALIANO: PROVA DI DOVE IL README DICE CHE STA LA CHIAVE API
   Il README (e il testo della scheda illustrata del README) diceva che la chiave Gemini sta
   "cifrata nel portachiavi di Windows" (keychain). Il codice invece la cifra con safeStorage
   (su Windows e' la protezione dati DPAPI, legata all'account) e la scrive come testo base64 in
   secrets.json, nella cartella dei dati del programma (userData, sotto %APPDATA%). Chi la cerca
   in Gestione credenziali di Windows non la trova.
   La regola: finche' il codice scrive la chiave cifrata in un file della cartella userData, il
   README non deve parlare di keychain e deve nominare la protezione dati di Windows e %APPDATA%.
   Lo stesso vale per i commenti di main.cjs, .env.example e src/utils/secureStorage.ts.
   Si legge il codice VERO, non una copia.
   Uso:  node scripts/test-api-key-storage-doc.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF WHERE THE README SAYS THE API KEY IS KEPT
   The README (and the text of the README's illustrated card) said the Gemini key is kept
   "encrypted in the Windows keychain". The code instead encrypts it with safeStorage (on Windows
   that is DPAPI data protection, tied to the account) and writes it as base64 text in
   secrets.json, in the app's data folder (userData, under %APPDATA%). Whoever looks for it in
   Windows Credential Manager finds nothing.
   The rule: while the code writes the encrypted key to a file in the userData folder, the README
   must not talk about a keychain and must name Windows data protection and %APPDATA%.
   The same holds for the comments of main.cjs, .env.example and src/utils/secureStorage.ts.
   The REAL code is read, not a copy.
   Usage:  node scripts/test-api-key-storage-doc.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const leggi = (f) => fs.readFileSync(path.join(radice, f), 'utf8');

const readme = leggi('README.md');
const main = leggi('electron/main.cjs');
const schede = leggi('scripts/make-feature-cards.mjs');

// ITALIANO: premessa: la chiave sta davvero in un file JSON di userData, cifrata con safeStorage.
// ENGLISH: premise: the key really sits in a JSON file in userData, encrypted with safeStorage.
const inUnFile = /path\.join\(app\.getPath\('userData'\), 'secrets\.json'\)/.test(main)
    && /fs\.writeFileSync\(getSecretsPath\(\), JSON\.stringify/.test(main)
    && /safeStorage\.encryptString\(value\)/.test(main);
dice('premessa: main.cjs scrive la chiave cifrata in userData/secrets.json', true, inUnFile);

if (inUnFile) {
    // ITALIANO: il paragrafo del README che parla della chiave (quello con Google AI Studio).
    // ENGLISH: the README paragraph about the key (the one with Google AI Studio).
    const paragrafo = readme.split(/\r?\n/).find((r) => r.includes('aistudio.google.com')) || '';
    dice('premessa: il README ha il paragrafo della chiave', true, paragrafo.length > 0);
    dice('il README non parla di keychain', false, /keychain/i.test(readme));
    dice('il paragrafo nomina la protezione dati di Windows', true, /Windows' own data protection/.test(paragrafo));
    dice('il paragrafo dice che sta sotto %APPDATA%', true, paragrafo.includes('%APPDATA%'));
    dice('il paragrafo dice che non e\' mai in chiaro', true, /never stored in plain text/.test(paragrafo));
    dice('la scheda illustrata non parla di keychain', false, /keychain/i.test(schede));
    dice('il commento di main.cjs non parla di keychain', false, /keychain/i.test(main));
    // ITALIANO: anche .env.example (pubblico) e l'intestazione di secureStorage.ts dicevano "OS keychain".
    // ENGLISH: .env.example (public) and the secureStorage.ts header also said "OS keychain".
    const env = leggi('.env.example');
    const archivio = leggi('src/utils/secureStorage.ts');
    dice('.env.example non parla di keychain', false, /keychain/i.test(env));
    dice('.env.example nomina safeStorage e secrets.json', true, env.includes('safeStorage') && env.includes('secrets.json'));
    dice('l\'intestazione di secureStorage.ts non parla di keychain', false, /keychain/i.test(archivio));
    dice('l\'intestazione di secureStorage.ts nomina DPAPI', true, /DPAPI/.test(archivio));
}

process.exit(esito());
