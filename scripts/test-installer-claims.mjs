/* ITALIANO: PROVA DELLE PROMESSE DEL README SULL'INSTALLER CONTRO LA CONFIGURAZIONE VERA
   Il README dice dell'installer: «asks for a language» e «installs for your user only (no
   administrator rights)». Lo rendono vero poche righe di package.json (build.nsis) e una macro di
   build/installer.nsh, che nessuna prova leggeva: cambiandone una, l'installer pubblicato chiedeva
   i diritti di amministratore o non chiedeva piu' la lingua, il README diceva il contrario e tutte
   le prove passavano.
   - «solo per il tuo utente, senza amministratore»: oneClick false e perMachine false (con perMachine
     true electron-builder installa sempre per tutti gli utenti, come amministratore) E la macro
     customInstallMode con StrCpy $isForceCurrentInstall "1": senza, con oneClick false compare la
     pagina «Per chi installare?» e si puo' scegliere «tutti gli utenti».
   - «chiede la lingua»: multiLanguageInstaller e displayLanguageSelector true, e installerLanguages
     con una lingua per ognuna delle nove del programma.
   Ogni controllo vale finche' il README contiene la frase che lo promette.
   Uso:  node scripts/test-installer-claims.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE README'S INSTALLER PROMISES AGAINST THE REAL CONFIGURATION
   The README says of the installer: "asks for a language" and "installs for your user only (no
   administrator rights)". A few lines of package.json (build.nsis) and a macro of
   build/installer.nsh make that true, and no test read them: changing one, the published installer
   asked for administrator rights or no longer asked for the language, the README said the opposite
   and every test passed.
   - "for your user only, no administrator": oneClick false and perMachine false (with perMachine
     true electron-builder always installs for all users, as administrator) AND the
     customInstallMode macro with StrCpy $isForceCurrentInstall "1": without it, with oneClick false
     the "Who should this be installed for?" page shows up and "all users" can be chosen.
   - "asks for a language": multiLanguageInstaller and displayLanguageSelector true, and
     installerLanguages with one language for each of the program's nine.
   Each check holds while the README contains the sentence that promises it.
   Usage:  node scripts/test-installer-claims.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const leggi = (rel) => fs.readFileSync(path.join(radice, rel), 'utf8');
const readme = leggi('README.md');
const nsis = JSON.parse(leggi('package.json')).build.nsis;
const installer = leggi('build/installer.nsh');

const FRASE_UTENTE = 'installs for your user only (no administrator rights)';
const FRASE_LINGUA = 'asks for a language';
dice('il README contiene ancora le due frasi sull\'installer', [true, true], [readme.includes(FRASE_UTENTE), readme.includes(FRASE_LINGUA)]);

if (readme.includes(FRASE_UTENTE)) {
    dice(`«${FRASE_UTENTE}»: oneClick e perMachine sono false`, [false, false], [nsis.oneClick, nsis.perMachine]);
    // ITALIANO: la macro vera (riga che comincia con !macro, non un commento) e la sua riga StrCpy.
    // ENGLISH: the real macro (a line starting with !macro, not a comment) and its StrCpy line.
    const macro = /^!macro customInstallMode[ \t]*\r?\n([\s\S]*?)^!macroend/m.exec(installer);
    const righe = macro ? macro[1].split(/\r?\n/).map(r => r.trim()).filter(r => r && !r.startsWith(';')) : null;
    dice(`«${FRASE_UTENTE}»: customInstallMode forza l'installazione per l'utente`, ['StrCpy $isForceCurrentInstall "1"'], righe);
}
if (readme.includes(FRASE_LINGUA)) {
    dice(`«${FRASE_LINGUA}»: multiLanguageInstaller e displayLanguageSelector sono true`, [true, true],
        [nsis.multiLanguageInstaller, nsis.displayLanguageSelector]);
    // ITALIANO: le nove lingue del programma (blocchi di src/constants.ts), una per voce dell'installer.
    // ENGLISH: the program's nine languages (blocks of src/constants.ts), one per installer entry.
    const lingueProgramma = ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru'];
    const lingueInstaller = (Array.isArray(nsis.installerLanguages) ? nsis.installerLanguages : []).map(l => String(l).slice(0, 2)).sort();
    dice(`«${FRASE_LINGUA}»: installerLanguages ha una lingua per ognuna delle nove del programma`, [...lingueProgramma].sort(), lingueInstaller);
}

process.exit(esito());
