/* ITALIANO: PROVA CHE merge-tag-suggestions LEGGA I FILE DI TAG UTF-16
   Lo script leggeva ogni file di tag come UTF-8. Un .txt salvato in UTF-16 (Blocco note "Unicode",
   oppure ">" di Windows PowerShell 5.1) diventava un testo con un carattere NUL fra una lettera e
   l'altra: "hat", che nel dizionario c'e' gia', non veniva riconosciuto, il rapporto diceva "gia' nel
   dizionario: 0" e proponeva come nuovi dei tag pieni di NUL, che con --out e --apply sarebbero
   entrati nel dizionario come doppioni. La regola e' quella di decodificaSidecar dell'app: BOM FF FE
   o FE FF -> UTF-16, altrimenti UTF-8 valido senza NUL (un BOM UTF-8 si toglie); un file che non si
   decodifica ferma lo script con un messaggio che nomina il file, invece di proporre tag storpiati.
   Vale anche per i .json. Si lancia lo script VERO su una copia del dizionario VERO in una cartella
   temporanea: il dizionario del progetto non si tocca.
   Uso:  node scripts/test-merge-tag-encoding.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT merge-tag-suggestions READS UTF-16 TAG FILES
   The script read every tag file as UTF-8. A .txt saved as UTF-16 (Notepad "Unicode", or ">" in
   Windows PowerShell 5.1) became a text with a NUL character between letters: "hat", already in
   the dictionary, was not recognised, the report said "already in the dictionary: 0" and offered
   NUL-filled tags as new, which --out and --apply would have filed as duplicates. The rule is the
   app's decodificaSidecar: BOM FF FE or FE FF -> UTF-16, otherwise valid UTF-8 with no NUL (a UTF-8
   BOM is dropped); a file that cannot be decoded stops the script with a message naming the file,
   instead of offering mangled tags. The same holds for .json files. The REAL script runs on a copy
   of the REAL dictionary in a temporary folder: the project dictionary is not touched.
   Usage:  node scripts/test-merge-tag-encoding.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

const prova = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-merge-enc-'));
try {
    fs.mkdirSync(path.join(prova, 'scripts'));
    fs.mkdirSync(path.join(prova, 'src', 'constants'), { recursive: true });
    const script = path.join(prova, 'scripts', 'merge-tag-suggestions.mjs');
    const dizionario = path.join(prova, 'src', 'constants', 'tagSuggestions.ts');
    fs.copyFileSync(path.join(radice, 'scripts', 'merge-tag-suggestions.mjs'), script);
    fs.copyFileSync(path.join(radice, 'src', 'constants', 'tagSuggestions.ts'), dizionario);
    const lancia = (...arg) => {
        const r = spawnSync(process.execPath, [script, ...arg], { cwd: prova, encoding: 'utf8' });
        return { codice: r.status, testo: (r.stdout || '') + (r.stderr || ''), errore: r.stderr || '' };
    };
    const conteggi = (testo) => ({
        gia: (/gia' nel dizionario\s*: (\d+)/.exec(testo) || [])[1] || null,
        nuovi: (/da aggiungere\s*: (\d+)/.exec(testo) || [])[1] || null,
    });
    const scrivi = (nome, byte) => fs.writeFileSync(path.join(prova, nome), byte);

    const dizionarioPrima = fs.readFileSync(dizionario, 'utf8');
    const tags = [...dizionarioPrima.matchAll(/\{ tag: '((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
    dice('premessa: il dizionario vero ha "hat" e non ha "zzqx" ne\' "qqzw"', [true, false, false], [tags.includes('hat'), tags.includes('zzqx'), tags.includes('qqzw')]);

    const TESTO = 'zzqx, hat, qqzw\n';
    const utf16le = (s) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(s, 'utf16le')]);
    const utf16be = (s) => Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(s, 'utf16le').swap16()]);
    const utf8bom = (s) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(s, 'utf8')]);

    // ITALIANO: il caso di riferimento, UTF-8 semplice: hat c'e' gia', zzqx e qqzw sono nuovi.
    // ENGLISH: the reference case, plain UTF-8: hat is already there, zzqx and qqzw are new.
    scrivi('u8.txt', Buffer.from(TESTO, 'utf8'));
    const u8 = lancia('u8.txt', '--out', 'piano-u8.json');
    dice('UTF-8: 1 gia\' nel dizionario (hat), 2 da aggiungere', { gia: '1', nuovi: '2' }, conteggi(u8.testo));
    const pianoU8 = JSON.parse(fs.readFileSync(path.join(prova, 'piano-u8.json'), 'utf8'));
    dice('UTF-8: il piano propone zzqx e qqzw', ['qqzw', 'zzqx'], Object.keys(pianoU8).sort());

    // ITALIANO: gli stessi tag in UTF-16 LE, UTF-16 BE e UTF-8 con BOM danno lo stesso rapporto e lo
    //           stesso piano, senza nessun carattere NUL o di sostituzione.
    // ENGLISH: the same tags in UTF-16 LE, UTF-16 BE and UTF-8 with BOM give the same report and the
    //          same plan, without any NUL or replacement character.
    for (const [nome, byte] of [['u16le.txt', utf16le(TESTO)], ['u16be.txt', utf16be(TESTO)], ['u8bom.txt', utf8bom(TESTO)]]) {
        scrivi(nome, byte);
        const r = lancia(nome, '--out', 'piano-' + nome + '.json');
        dice(nome + ': lo script finisce senza errori', 0, r.codice);
        dice(nome + ': 1 gia\' nel dizionario (hat), 2 da aggiungere', { gia: '1', nuovi: '2' }, conteggi(r.testo));
        dice(nome + ': nessun NUL o carattere di sostituzione nel rapporto', false, /[\u0000�﻿]/.test(r.testo));
        let piano = {};
        try { piano = JSON.parse(fs.readFileSync(path.join(prova, 'piano-' + nome + '.json'), 'utf8')); } catch (_) { /* resta vuoto */ }
        dice(nome + ': il piano e\' uguale a quello del file UTF-8', Object.keys(pianoU8).sort(), Object.keys(piano).sort());
    }

    // ITALIANO: un .json salvato in UTF-16 o con il BOM UTF-8 si legge come gli altri (prima
    //           JSON.parse si fermava sul primo carattere).
    // ENGLISH: a .json saved as UTF-16 or with the UTF-8 BOM is read like the others (JSON.parse
    //          used to stop at the first character).
    const JSONTAG = JSON.stringify({ tags: ['zzqx', 'hat', 'qqzw'] });
    for (const [nome, byte] of [['tag16.json', utf16le(JSONTAG)], ['tagbom.json', utf8bom(JSONTAG)]]) {
        scrivi(nome, byte);
        const r = lancia(nome);
        dice(nome + ': 1 gia\' nel dizionario (hat), 2 da aggiungere', { codice: 0, gia: '1', nuovi: '2' }, { codice: r.codice, ...conteggi(r.testo) });
    }

    // ITALIANO: un file che non e' ne' UTF-8 ne' UTF-16 con BOM (qui ANSI con una lettera accentata),
    //           un UTF-16 BE con un byte di troppo e un UTF-8 con un NUL: lo script si ferma, nomina il
    //           file e non scrive nessun piano.
    // ENGLISH: a file that is neither UTF-8 nor UTF-16 with a BOM (here ANSI with an accented
    //          letter), a UTF-16 BE with one byte too many and a UTF-8 with a NUL: the script stops,
    //          names the file and writes no plan.
    const guasti = [
        ['ansi.txt', Buffer.from([0x63, 0x61, 0x66, 0x66, 0xe8, 0x2c, 0x20, 0x68, 0x61, 0x74])],
        ['dispari.txt', Buffer.concat([utf16be('hat'), Buffer.from([0x00])])],
        ['nul.txt', Buffer.from('hat,\u0000zzqx', 'utf8')],
    ];
    for (const [nome, byte] of guasti) {
        scrivi(nome, byte);
        const r = lancia(nome, '--out', 'piano-' + nome + '.json');
        dice(nome + ': lo script esce con codice 1', 1, r.codice);
        dice(nome + ': il messaggio di errore nomina il file', true, r.errore.includes(nome));
        dice(nome + ': nessun rapporto e nessun piano', [null, false], [conteggi(r.testo).nuovi, fs.existsSync(path.join(prova, 'piano-' + nome + '.json'))]);
    }

    dice('il dizionario della copia non e\' cambiato (il rapporto non scrive)', true, fs.readFileSync(dizionario, 'utf8') === dizionarioPrima);
} finally {
    fs.rmSync(prova, { recursive: true, force: true });
}

process.exit(esito());
