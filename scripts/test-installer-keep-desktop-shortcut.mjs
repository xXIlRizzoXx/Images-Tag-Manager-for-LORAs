/* ITALIANO: PROVA CHE L'AGGIORNAMENTO NON CANCELLA IL COLLEGAMENTO SUL DESKTOP
   A ogni installazione l'installer nuovo fa girare in silenzio il disinstallatore della versione gia'
   installata (uninstallOldVersion) passandogli --updated. electron-builder inserisce la nostra macro
   customUnInstall nella sezione di disinstallazione PRIMA e FUORI da ogni controllo ${isUpdated}: se la
   macro cancella "$DESKTOP\Images Tag Manager for LORAs.lnk" senza condizioni, l'aggiornamento toglie il
   collegamento, che torna solo se nella pagina finale resta la spunta (con /S mai) e comunque perde il
   suo posto sul desktop.
   La regola: in customUnInstall ogni Delete del collegamento sta dentro "${ifNot} ${isUpdated}" ...
   "${endIf}". La disinstallazione vera da Windows (UninstallString con /currentuser, senza --updated)
   lo toglie come prima. L'installer non si puo' compilare ne' avviare qui: la prova legge i file e
   controlla anche le premesse sul modello di electron-builder installato.
   Uso:  node scripts/test-installer-keep-desktop-shortcut.mjs   (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT AN UPDATE DOES NOT DELETE THE DESKTOP SHORTCUT
   On every install the new installer silently runs the uninstaller of the version already installed
   (uninstallOldVersion), passing --updated. electron-builder inserts our customUnInstall macro in the
   uninstall section BEFORE and OUTSIDE every ${isUpdated} check: if the macro deletes
   "$DESKTOP\Images Tag Manager for LORAs.lnk" unconditionally, the update removes the shortcut, which
   comes back only if the finish-page box stays ticked (never with /S) and loses its place anyway.
   The rule: in customUnInstall every Delete of the shortcut sits inside "${ifNot} ${isUpdated}" ...
   "${endIf}". A real uninstall from Windows (UninstallString with /currentuser, no --updated) still
   removes it. The installer cannot be compiled or run here: the test reads the files and also checks
   the premises on the installed electron-builder template.
   Usage:  node scripts/test-installer-keep-desktop-shortcut.mjs   (exits with code 1 if anything is off) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const leggi = (rel) => fs.readFileSync(path.join(radice, rel), 'utf8').replace(/\r\n/g, '\n');

const modelli = 'node_modules/app-builder-lib/templates/nsis';
const disinstallatore = leggi(`${modelli}/uninstaller.nsh`);
const utili = leggi(`${modelli}/include/installUtil.nsh`);
const sezioneInstall = leggi(`${modelli}/installSection.nsh`);
const installaModello = leggi(`${modelli}/include/installer.nsh`);
const target = leggi('node_modules/app-builder-lib/out/targets/nsis/NsisTarget.js');
const byteInstaller = fs.readFileSync(path.join(radice, 'build/installer.nsh'));
const installer = byteInstaller.toString('latin1').replace(/\r\n/g, '\n');

// ITALIANO: il corpo di una macro NSIS (fra "!macro <nome>" e il primo "!macroend").
// ENGLISH: the body of an NSIS macro (between "!macro <name>" and the first "!macroend").
const corpo = (testo, nome) => {
    const m = testo.match(new RegExp(`^\\s*!macro ${nome}\\b[^\\n]*\\n([\\s\\S]*?)^\\s*!macroend`, 'm'));
    return m ? m[1] : null;
};

console.log('--- premesse sul modello di electron-builder ---');
const sezioneUn = (disinstallatore.match(/Section "un\.\$\{UNINSTALL_SECTION_NAME\}"([\s\S]*?)SectionEnd/) || [])[1] || '';
const posMacro = sezioneUn.indexOf('!insertmacro customUnInstall');
const posUpdated = sezioneUn.indexOf('${if} ${isUpdated}');
dice('la sezione di disinstallazione inserisce customUnInstall prima di ogni controllo ${isUpdated}', true,
    posMacro >= 0 && posUpdated > posMacro);
dice('a ogni installazione gira il disinstallatore vecchio (uninstallOldVersion)', true,
    /!insertmacro uninstallOldVersion SHELL_CONTEXT/.test(sezioneInstall));
dice('il disinstallatore vecchio parte con /S e riceve --updated', [true, true],
    [/StrCpy \$0 "\$0 --updated"/.test(utili), /ExecWait '"\$uninstallerFileNameTemp" \/S \/KEEP_APP_DATA \$0 _\?=\$installationDir'/.test(utili)]);
dice('la disinstallazione da Windows NON passa --updated (UninstallString con /currentuser o /allusers)', true,
    /StrCpy \$0 "\/currentuser"/.test(installaModello) && /UninstallString '"\$2" \$0'/.test(installaModello) && !/UninstallString[^\n]*--updated/.test(installaModello));
dice('il flag "updated" (${isUpdated}) nasce nell\'intestazione comune, quindi vale anche nel disinstallatore', true,
    /computeCommonInstallerScriptHeader\(\)\s*\{[\s\S]*?scriptGenerator\.flags\(\[[^\]]*"updated"/.test(target));

console.log('\n--- build/installer.nsh ---');
const nostro = corpo(installer, 'customUnInstall');
dice('customUnInstall e\' definita', true, nostro !== null);

// ITALIANO: scorre il corpo contando i blocchi ${if}/${ifNot} aperti; per ogni Delete del collegamento
//           sul desktop annota se uno dei blocchi aperti e' "${ifNot} ${isUpdated}".
// ENGLISH: walks the body counting the open ${if}/${ifNot} blocks; for every Delete of the desktop
//          shortcut it records whether one of the open blocks is "${ifNot} ${isUpdated}".
const cancellazioni = [];
const aperti = [];
let equilibrio = true;
for (const grezza of (nostro || '').split('\n')) {
    const riga = grezza.replace(/;.*$/, '').trim();
    if (!riga) continue;
    if (/^\$\{(if|ifNot|unless)\}/i.test(riga)) { aperti.push(riga); continue; }
    if (/^\$\{(else|elseIf|elseIfNot)\}/i.test(riga)) {
        // ITALIANO: dopo ${else} il blocco vale al contrario: non conta piu' come guardia.
        // ENGLISH: after ${else} the block means the opposite: it no longer counts as a guard.
        if (aperti.length) aperti[aperti.length - 1] = riga;
        continue;
    }
    if (/^\$\{end(if|unless)\}/i.test(riga)) { if (!aperti.pop()) equilibrio = false; continue; }
    if (/^Delete\b[^\n]*\$DESKTOP\\[^\n]*\.lnk/i.test(riga)) {
        cancellazioni.push(aperti.some((a) => /^\$\{ifNot\}\s+\$\{isUpdated\}$/i.test(a)));
    }
}
dice('customUnInstall toglie ancora il collegamento sul desktop (disinstallazione vera)', true, cancellazioni.length > 0);
dice('ogni Delete del collegamento sta dentro ${ifNot} ${isUpdated}', true,
    cancellazioni.length > 0 && cancellazioni.every(Boolean));
dice('i blocchi ${if}/${endIf} di customUnInstall sono chiusi tutti', [true, 0], [equilibrio, aperti.length]);
dice('il nome del collegamento e\' lo stesso che crea CreateDesktopShortcutNow', true,
    /Delete "\$DESKTOP\\Images Tag Manager for LORAs\.lnk"/.test(nostro || '')
    && /CreateShortCut "\$DESKTOP\\Images Tag Manager for LORAs\.lnk"/.test(corpo(installer, 'customHeader') || installer));
dice('build/installer.nsh resta solo ASCII', true, byteInstaller.every((b) => b < 0x80));

// =============================================================================================
// ITALIANO: GIRO 3, REVISIONE. La guardia su --updated non basta da sola:
//           (1) aggiornando si puo' scegliere un'altra cartella (allowToChangeInstallationDirectory):
//               il disinstallatore vecchio cancella la cartella vecchia e il collegamento rimasto
//               punta a un programma che non c'e' piu';
//           (2) chi ha la 2.0.2 o piu' vecchia fa girare il SUO disinstallatore, che cancella il
//               collegamento senza guardare --updated.
//           Il rimedio sta tutto nell'installer nuovo: customInit (in .onInit) ricorda se il
//           collegamento c'era, customInstall (dopo il disinstallatore vecchio) lo ricrea verso la
//           cartella nuova. Qui un piccolo interprete esegue le macro VERE di build/installer.nsh
//           (solo i comandi che usano: un comando nuovo fa fallire la prova) negli scenari possibili.
// ENGLISH: ROUND 3, REVIEW. The --updated guard is not enough on its own:
//          (1) an update can pick another folder (allowToChangeInstallationDirectory): the old
//              uninstaller deletes the old folder and the shortcut left behind points at a program
//              that is no longer there;
//          (2) whoever has 2.0.2 or older runs ITS uninstaller, which deletes the shortcut without
//              looking at --updated.
//          The remedy lives entirely in the new installer: customInit (in .onInit) remembers whether
//          the shortcut was there, customInstall (after the old uninstaller) creates it again towards
//          the new folder. Here a tiny interpreter runs the REAL macros of build/installer.nsh (only
//          the commands they use: a new command makes the test fail) in the possible scenarios.
console.log('\n--- premesse: dove electron-builder inserisce customInit e customInstall ---');
const installerNsi = leggi(`${modelli}/installer.nsi`);
const onInit = (installerNsi.match(/Function \.onInit([\s\S]*?)FunctionEnd/) || [])[1] || '';
// ITALIANO: dopo "!ifdef BUILD_UNINSTALLER" il primo !else apre il ramo dell'installer (fino alla fine di .onInit).
// ENGLISH: after "!ifdef BUILD_UNINSTALLER" the first !else opens the installer branch (up to the end of .onInit).
const ramoInstaller = onInit.split(/!ifdef BUILD_UNINSTALLER/)[1] || '';
const primoElse = ramoInstaller.search(/^\s*!else\b/m);
const dopoElse = primoElse >= 0 && !/WriteUninstaller/.test(ramoInstaller.slice(primoElse)) ? ramoInstaller.slice(primoElse) : '';
dice('customInit e\' inserita in .onInit solo nel ramo dell\'installer, dopo initMultiUser', true,
    dopoElse.indexOf('!insertmacro initMultiUser') >= 0 && dopoElse.indexOf('!insertmacro customInit') > dopoElse.indexOf('!insertmacro initMultiUser'));
dice('customInit non e\' inserita in nessun altro punto del modello', 1, (installerNsi.match(/!insertmacro customInit\b/g) || []).length);
dice('customInstall viene dopo il disinstallatore vecchio (uninstallOldVersion) e dopo i file nuovi', true,
    sezioneInstall.indexOf('!insertmacro customInstall') > sezioneInstall.indexOf('!insertmacro installApplicationFiles')
    && sezioneInstall.indexOf('!insertmacro installApplicationFiles') > sezioneInstall.indexOf('!insertmacro uninstallOldVersion SHELL_CONTEXT'));
dice('la sezione di installazione esiste solo nella passata dell\'installer', true,
    /!ifndef BUILD_UNINSTALLER[\s\S]*?!include "installSection\.nsh"[\s\S]*?!endif/.test(installerNsi));
dice('il disinstallatore vecchio cancella la cartella su cui gira (RMDir /r $INSTDIR, con _?= cartella vecchia)', [true, true],
    [/RMDir \/r \$INSTDIR/.test(disinstallatore), /_\?=\$installationDir/.test(utili)]);
const pacchetto = JSON.parse(fs.readFileSync(path.join(radice, 'package.json'), 'utf8')).build.nsis;
dice('package.json: la cartella si puo\' cambiare e electron-builder non gestisce il collegamento sul desktop', [true, false],
    [pacchetto.allowToChangeInstallationDirectory, pacchetto.createDesktopShortcut]);

console.log('\n--- build/installer.nsh: la variabile e le due macro ---');
// ITALIANO: la Var sta solo nella passata dell'installer: nel disinstallatore sarebbe dichiarata e mai
//           usata (avviso 6001, che warningsAsErrors trasforma in errore).
// ENGLISH: the Var lives only in the installer pass: in the uninstaller it would be declared and never
//          used (warning 6001, which warningsAsErrors turns into an error).
const blocchiInstaller = [...installer.matchAll(/^!ifndef BUILD_UNINSTALLER\n([\s\S]*?)^!endif/gm)].map((m) => m[1]);
dice('Var DesktopShortcutWasThere dichiarata una volta, dentro !ifndef BUILD_UNINSTALLER', [1, 1],
    [(installer.match(/^\s*Var\s+DesktopShortcutWasThere\b/gm) || []).length,
        blocchiInstaller.filter((b) => /^\s*Var\s+DesktopShortcutWasThere\b/m.test(b)).length]);
const usi = installer.split('\n').filter((r) => !/^\s*;/.test(r) && /\$DesktopShortcutWasThere\b/.test(r)).length;
const nelleMacro = ['customInit', 'customInstall'].map((n) => (corpo(installer, n) || '').split('\n').filter((r) => /\$DesktopShortcutWasThere\b/.test(r.replace(/;.*$/, ''))).length);
dice('la variabile si usa solo in customInit e customInstall (inserite solo nell\'installer)', [true, true, usi],
    [nelleMacro[0] > 0, nelleMacro[1] > 0, nelleMacro[0] + nelleMacro[1]]);
dice('customUnInstall non la usa', false, /DesktopShortcutWasThere/.test(nostro || ''));

// ITALIANO: l'interprete. Stato: i file che esistono, a che cosa punta ogni collegamento, le variabili.
// ENGLISH: the interpreter. State: the files that exist, what each shortcut points at, the variables.
const EXE = 'Images Tag Manager for LORAs.exe';
const DESKTOP = 'C:\\Users\\prova\\Desktop';
const LNK = `${DESKTOP}\\Images Tag Manager for LORAs.lnk`;
const funzioni = {};
for (const m of (corpo(installer, 'customHeader') || '').matchAll(/^\s*Function\s+(\S+)\s*\n([\s\S]*?)^\s*FunctionEnd/gm)) funzioni[m[1]] = m[2];
const parole = (riga) => (riga.match(/"[^"]*"|\S+/g) || []);
const espandi = (s, st) => s.replace(/^"|"$/g, '')
    .replace(/\$\{APP_EXECUTABLE_FILENAME\}/g, EXE).replace(/\$\{APP_PACKAGE_NAME\}/g, 'images-tag-manager')
    .replace(/\$DESKTOP\b/g, DESKTOP).replace(/\$INSTDIR\b/g, st.instdir).replace(/\$APPDATA\b/g, 'C:\\Users\\prova\\AppData\\Roaming')
    .replace(/\$([A-Za-z_]\w*)/g, (x, v) => (v in st.var ? st.var[v] : x));
const condizione = (p, st) => {
    if (p.length === 1 && p[0] === '${isUpdated}') return st.aggiornamento;
    if (p.length === 2 && p[0] === '${FileExists}') return st.file.has(espandi(p[1], st));
    if (p.length === 3 && p[1] === '==') return espandi(p[0], st) === espandi(p[2], st).replace('${BST_CHECKED}', '1');
    throw new Error('condizione non prevista: ' + p.join(' '));
};
const esegui = (testo, st) => {
    const pila = [];
    for (const grezza of testo.split('\n')) {
        const riga = grezza.replace(/;.*$/, '').trim();
        if (!riga) continue;
        const p = parole(riga);
        const c = p[0];
        if (/^\$\{(If|ifNot)\}$/i.test(c)) { const v = condizione(p.slice(1), st); pila.push(/ifNot/i.test(c) ? !v : v); continue; }
        if (/^\$\{EndIf\}$/i.test(c)) { if (!pila.length) throw new Error('${EndIf} di troppo'); pila.pop(); continue; }
        if (c === '!ifdef' && p[1] === 'APP_PACKAGE_NAME') { pila.push(true); continue; }
        if (c === '!endif') { pila.pop(); continue; }
        if (!pila.every(Boolean)) continue;
        if (c === 'StrCpy') st.var[p[1].replace(/^\$/, '')] = espandi(p[2], st);
        else if (c === 'Delete') { st.file.delete(espandi(p[1], st)); st.coll.delete(espandi(p[1], st)); }
        else if (c === 'CreateShortCut') { st.file.add(espandi(p[1], st)); st.coll.set(espandi(p[1], st), espandi(p[2], st)); }
        else if (c === 'Call') { if (!(p[1] in funzioni)) throw new Error('funzione mancante: ' + p[1]); esegui(funzioni[p[1]], st); }
        else if (c === 'RMDir' && p[1] === '/r') { const d = espandi(p[2], st); for (const f of [...st.file]) if (f.startsWith(d + '\\')) st.file.delete(f); }
        else throw new Error('comando non previsto: ' + riga);
    }
    if (pila.length) throw new Error('blocco ${If} non chiuso');
};
// ITALIANO: il disinstallatore della 2.0.2 (32dc7a4~1:build/installer.nsh), cosi' com'era pubblicato.
// ENGLISH: the 2.0.2 uninstaller (32dc7a4~1:build/installer.nsh), as it was published.
const DISINSTALLA_202 = 'Delete "$DESKTOP\\Images Tag Manager for LORAs.lnk"';
const simula = ({ vecchio, cartellaVecchia, cartellaNuova, collegamentoPrima, spunta }) => {
    const st = { var: {}, file: new Set([`${cartellaVecchia}\\${EXE}`]), coll: new Map(), aggiornamento: false, instdir: cartellaNuova };
    if (collegamentoPrima) { st.file.add(LNK); st.coll.set(LNK, `${cartellaVecchia}\\${EXE}`); }
    esegui(corpo(installer, 'customInit') || '', st);                           // .onInit
    st.aggiornamento = true; st.instdir = cartellaVecchia;                        // uninstallOldVersion: /S --updated _?=cartella vecchia
    esegui(vecchio, st);
    for (const f of [...st.file]) if (f.startsWith(cartellaVecchia + '\\')) st.file.delete(f); // RMDir /r $INSTDIR
    st.aggiornamento = false; st.instdir = cartellaNuova;
    st.file.add(`${cartellaNuova}\\${EXE}`);                                      // installApplicationFiles
    esegui(nostroInstall, st);                                                    // customInstall
    if (spunta === 'spuntata') esegui('Call CreateDesktopShortcutNow', st);       // pagina finale / finish page
    const punta = st.coll.get(LNK);
    return { collegamento: st.file.has(LNK), puntaAllaCartellaNuova: punta === `${cartellaNuova}\\${EXE}`, programmaEsiste: punta !== undefined && st.file.has(punta) };
};
const nostroInstall = corpo(installer, 'customInstall') || '';
const STESSA = 'C:\\Users\\prova\\AppData\\Local\\Programs\\images-tag-manager';
const ALTRA = 'D:\\Programmi\\Images Tag Manager';
const vecchi = { 'dalla 2.0.3 o piu\' nuova': nostro || '', 'dalla 2.0.2': DISINSTALLA_202 };
const atteso = (prima, spunta) => (prima || spunta === 'spuntata')
    ? { collegamento: true, puntaAllaCartellaNuova: true, programmaEsiste: true }
    : { collegamento: false, puntaAllaCartellaNuova: false, programmaEsiste: false };
for (const [chi, vecchio] of Object.entries(vecchi)) {
    for (const [dove, cartellaNuova] of [['stessa cartella', STESSA], ['altra cartella', ALTRA]]) {
        for (const collegamentoPrima of [true, false]) {
            for (const spunta of ['spuntata', 'tolta', '/S (pagina finale saltata)']) {
                let avuto;
                try { avuto = simula({ vecchio, cartellaVecchia: STESSA, cartellaNuova, collegamentoPrima, spunta }); } catch (e) { avuto = String(e.message); }
                dice(`aggiornamento ${chi}, ${dove}, collegamento ${collegamentoPrima ? 'c\'era' : 'non c\'era'}, spunta ${spunta}`,
                    atteso(collegamentoPrima, spunta), avuto);
            }
        }
    }
}
{
    // ITALIANO: la disinstallazione vera (da Windows, senza --updated) toglie ancora il collegamento.
    // ENGLISH: a real uninstall (from Windows, no --updated) still removes the shortcut.
    const st = { var: {}, file: new Set([LNK]), coll: new Map([[LNK, `${STESSA}\\${EXE}`]]), aggiornamento: false, instdir: STESSA };
    esegui(nostro || '', st);
    dice('disinstallazione vera: il collegamento sparisce', false, st.file.has(LNK));
}

process.exit(esito());
