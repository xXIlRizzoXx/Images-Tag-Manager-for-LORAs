/* ITALIANO: PROVA CHE `npm run clean` NON CANCELLI GLI INSTALLER GIA' PUBBLICATI
   Lo script "clean" era `npx rimraf dist release`. La cartella dove electron-builder scrive i .exe
   (release) e' la stessa, su Windows che non distingue le maiuscole, dove si tengono gli installer
   e i portable delle versioni pubblicate: rimraf la cancellava per sempre (niente Cestino), e dove
   rimraf non e' installato npx lo scaricava prima dalla rete. La regola: "clean" non usa npx ne'
   rimraf, non nomina la cartella release intera e toglie solo i file intermedi (dist e
   release/win-unpacked). Si legge il package.json VERO; il comando si prova in una cartella
   temporanea con un finto installer, e solo se e' un `node -e` (mai npx).
   Uso:  node scripts/test-clean-script.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT `npm run clean` DOES NOT DELETE THE PUBLISHED INSTALLERS
   The "clean" script was `npx rimraf dist release`. The folder where electron-builder writes the
   .exe files (release) is the same folder, on case-insensitive Windows, where the installers and
   portables of the published versions are kept: rimraf deleted it for good (no Recycle Bin), and
   where rimraf is not installed npx first downloaded it from the network. The rule: "clean" uses
   neither npx nor rimraf, does not name the whole release folder and removes only the
   intermediates (dist and release/win-unpacked). The REAL package.json is read; the command is
   tried in a temporary folder with a fake installer, and only if it is a `node -e` (never npx).
   Usage:  node scripts/test-clean-script.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

const pulizia = String((JSON.parse(fs.readFileSync(path.join(radice, 'package.json'), 'utf8')).scripts || {}).clean || '');

if (!pulizia) {
    // ITALIANO: niente script "clean": niente da cancellare per sbaglio.
    // ENGLISH: no "clean" script: nothing to delete by mistake.
    dice('nessuno script "clean"', true, true);
    process.exit(esito());
}

dice('"clean" non usa npx (niente download)', false, /\bnpx\b/.test(pulizia));
dice('"clean" non usa rimraf', false, /\brimraf\b/i.test(pulizia));
// ITALIANO: un bersaglio che e' la cartella release intera: release, release/ o Release, da solo
//           fra virgolette o spazi (release/win-unpacked invece va bene).
// ENGLISH: a target that is the whole release folder: release, release/ or Release, alone between
//          quotes or spaces (release/win-unpacked is fine).
dice('"clean" non nomina la cartella release intera', false, /(^|['"\s,[])release\/?(?=['"\s,\]]|$)/i.test(pulizia));

const corpo = (pulizia.match(/^node -e "([\s\S]*)"$/) || [])[1];
dice('"clean" e\' un comando `node -e` che si puo\' provare', true, Boolean(corpo));

if (corpo) {
    const prova = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-clean-'));
    try {
        const installer = path.join(prova, 'release', 'Images Tag Manager for LORAs Setup 1.2.0.exe');
        fs.mkdirSync(path.join(prova, 'dist', 'assets'), { recursive: true });
        fs.writeFileSync(path.join(prova, 'dist', 'assets', 'a.js'), 'x');
        fs.mkdirSync(path.join(prova, 'release', 'win-unpacked'), { recursive: true });
        fs.writeFileSync(path.join(prova, 'release', 'win-unpacked', 'x.dll'), 'x');
        fs.writeFileSync(installer, 'x');
        execFileSync(process.execPath, ['-e', corpo], { cwd: prova, stdio: 'pipe' });
        dice('dist e\' stata tolta', false, fs.existsSync(path.join(prova, 'dist')));
        dice('release/win-unpacked e\' stata tolta', false, fs.existsSync(path.join(prova, 'release', 'win-unpacked')));
        dice('l\'installer pubblicato in release e\' ancora li\'', true, fs.existsSync(installer));
    } finally {
        fs.rmSync(prova, { recursive: true, force: true });
    }
}

process.exit(esito());
