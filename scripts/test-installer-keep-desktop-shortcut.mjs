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

process.exit(esito());
