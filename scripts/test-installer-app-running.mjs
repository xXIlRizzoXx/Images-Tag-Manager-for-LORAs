/* ITALIANO: PROVA CHE L'INSTALLER VEDE ANCHE LA VERSIONE PORTABLE APERTA
   Prima di installare, electron-builder cerca il programma aperto per chiuderlo (CHECK_APP_RUNNING).
   Su Windows 11 lo cerca con PowerShell, ma SOLO fra i processi il cui percorso comincia con la
   cartella di installazione. La portable gira invece da %TEMP%\<codice>\, con la stessa cartella dati
   e lo stesso blocco "una sola istanza": l'installer non la vedeva e non la chiudeva. Alla fine
   "Esegui" avviava l'exe nuovo, che si chiudeva subito e rimetteva davanti la finestra VECCHIA; con
   "installazione pulita" la cartella dati veniva cancellata sotto un programma aperto.
   La regola: build/installer.nsh definisce customCheckAppRunning, che riusa il flusso standard di
   electron-builder (messaggio, chiusura gentile, poi forzata, nuovo tentativo) ma con la ricerca per
   NOME dell'exe fra i processi dell'utente, in qualunque cartella (il ramo tasklist/taskkill del
   modello). L'installer non si puo' compilare ne' avviare qui: la prova legge i file. Controlla
   anche le premesse sul modello di electron-builder installato, cosi' un suo aggiornamento che le
   cambia fa fallire la prova invece di rompere l'installer in silenzio.
   Uso:  node scripts/test-installer-app-running.mjs   (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT THE INSTALLER ALSO SEES THE PORTABLE VERSION WHEN IT IS OPEN
   Before installing, electron-builder looks for the running program to close it (CHECK_APP_RUNNING).
   On Windows 11 it does so with PowerShell, but ONLY among processes whose path starts with the
   install folder. The portable runs from %TEMP%\<id>\ instead, with the same data folder and the
   same single-instance lock: the installer did not see it and did not close it. At the end "Run"
   started the new exe, which quit at once and brought the OLD window to the front; with "clean
   install" the data folder was deleted under a running program.
   The rule: build/installer.nsh defines customCheckAppRunning, which reuses electron-builder's
   standard flow (message, graceful close, then forced, retry) but searches by the exe NAME among the
   user's processes, in any folder (the template's tasklist/taskkill branch). The installer cannot
   be compiled or run here: the test reads the files. It also checks the premises on the installed
   electron-builder template, so an upgrade that changes them fails the test instead of silently
   breaking the installer.
   Usage:  node scripts/test-installer-app-running.mjs   (exits with code 1 if anything is off) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const leggi = (rel) => fs.readFileSync(path.join(radice, rel), 'utf8');

const modelli = 'node_modules/app-builder-lib/templates/nsis';
const unico = leggi(`${modelli}/include/allowOnlyOneInstallerInstance.nsh`);
const target = leggi('node_modules/app-builder-lib/out/targets/nsis/NsisTarget.js');
const byteInstaller = fs.readFileSync(path.join(radice, 'build/installer.nsh'));
const installer = byteInstaller.toString('latin1').replace(/\r\n/g, '\n');

// ITALIANO: il corpo di una macro NSIS (fra "!macro <nome>" e il primo "!macroend").
// ENGLISH: the body of an NSIS macro (between "!macro <name>" and the first "!macroend").
const corpo = (testo, nome) => {
    const m = testo.match(new RegExp(`^\\s*!macro ${nome}\\b[^\\n]*\\n([\\s\\S]*?)^\\s*!macroend`, 'm'));
    return m ? m[1] : null;
};
// ITALIANO: righe di codice al livello principale (fuori da ogni !ifdef/!ifndef/!if e da ogni
//           macro), senza commenti: devono valere in tutte e due le passate (installer e
//           disinstallatore).
// ENGLISH: code lines at top level (outside every !ifdef/!ifndef/!if and every macro), without
//          comments: they must hold in both passes (installer and uninstaller).
const livelloPrincipale = (testo) => {
    const fuori = [];
    let condizioni = 0, inMacro = false;
    for (const grezza of testo.split('\n')) {
        const riga = grezza.replace(/;.*$/, '').trim();
        if (!riga) continue;
        if (/^!macro\b/.test(riga)) { inMacro = true; if (condizioni === 0) fuori.push(riga); continue; }
        if (/^!macroend\b/.test(riga)) { inMacro = false; continue; }
        if (inMacro) continue;
        if (/^!if(n?def|macrodef|macrondef)?\b/.test(riga)) { condizioni++; continue; }
        if (/^!endif\b/.test(riga)) { condizioni--; continue; }
        if (condizioni === 0) fuori.push(riga);
    }
    return fuori;
};

console.log('--- premesse sul modello di electron-builder ---');
const controlloStandard = corpo(unico, 'CHECK_APP_RUNNING') || '';
dice('CHECK_APP_RUNNING usa customCheckAppRunning al posto del controllo standard, se esiste', true,
    /!ifmacrodef customCheckAppRunning\s*\n\s*!insertmacro customCheckAppRunning\s*\n\s*!else/.test(controlloStandard));
dice('CHECK_APP_RUNNING imposta CmdPath e FindPath prima di chiamarla', true,
    /StrCpy \$CmdPath "\$SYSDIR\\cmd\.exe"[\s\S]*StrCpy \$FindPath "\$SYSDIR\\find\.exe"[\s\S]*!ifmacrodef customCheckAppRunning/.test(controlloStandard));
dice('con customCheckAppRunning il modello NON include getProcessInfo.nsh e NON dichiara $pid (tocca a noi)', true,
    /!ifmacrondef customCheckAppRunning\s*\n\s*!include "getProcessInfo\.nsh"\s*\n\s*Var pid\s*\n\s*!endif/.test(unico));
const trova = corpo(unico, 'FIND_PROCESS') || '';
dice('il ramo PowerShell cerca solo sotto $INSTDIR (il motivo del difetto)', true,
    /\$IsPowerShellAvailable == 0[\s\S]*StartsWith\('\$INSTDIR'/.test(trova));
dice('l\'altro ramo cerca per nome fra i processi dell\'utente (tasklist IMAGENAME)', true,
    /\$\{else\}[\s\S]*tasklist \/FI "USERNAME eq %USERNAME%" \/FI "IMAGENAME eq \$\{_FILE\}"/.test(trova));
dice('anche la chiusura ha il ramo per nome (taskkill /IM, tranne l\'installer stesso)', true,
    /\$\{else\}[\s\S]*taskkill \$0 \/IM "\$\{_FILE\}" \/FI "PID ne \$pid"/.test(corpo(unico, 'KILL_PROCESS') || ''));
dice('_CHECK_APP_RUNNING usa ${GetProcessInfo} e $pid', true,
    /\$\{GetProcessInfo\} 0 \$pid/.test(corpo(unico, '_CHECK_APP_RUNNING') || ''));
dice('build/installer.nsh entra nell\'intestazione comune, cioe\' PRIMA di allowOnlyOneInstallerInstance.nsh', [true, true],
    [/computeCommonInstallerScriptHeader\(\)\s*\{[\s\S]*?scriptGenerator\.include\(customInclude\)[\s\S]*?\n {4}\}/.test(target),
        /sharedHeader \+ \(await this\.computeFinalScript\(script, true/.test(target)]);
dice('getProcessInfo.nsh sta nella cartella degli include del modello', true, fs.existsSync(path.join(radice, modelli, 'include/getProcessInfo.nsh')));

console.log('\n--- build/installer.nsh ---');
const nostro = corpo(installer, 'customCheckAppRunning');
dice('customCheckAppRunning e\' definita', true, nostro !== null);
const sopra = livelloPrincipale(installer);
dice('customCheckAppRunning vale in tutte e due le passate (fuori da ogni !ifdef)', true, sopra.includes('!macro customCheckAppRunning'));
dice('getProcessInfo.nsh incluso e $pid dichiarata al livello principale, in tutte e due le passate', [true, true],
    [sopra.includes('!include "getProcessInfo.nsh"'), sopra.includes('Var pid')]);
const righe = (nostro || '').split('\n').map((r) => r.replace(/;.*$/, '').trim()).filter(Boolean);
dice('la macro forza la ricerca per nome e poi riusa il flusso standard, in quest\'ordine', [
    'Var /GLOBAL IsPowerShellAvailable',
    'StrCpy $IsPowerShellAvailable 1',
    '!insertmacro _CHECK_APP_RUNNING',
], righe);
dice('build/installer.nsh resta solo ASCII', true, byteInstaller.every((b) => b < 0x80));
dice('il commento di customInstall non dice piu\' che il programma e\' gia\' stato chiuso senza dire come', true,
    /CHECK_APP_RUNNING[\s\S]{0,200}(customCheckAppRunning|per nome|by name)/.test(installer.slice(installer.indexOf('La cancellazione vera'))));

process.exit(esito());
