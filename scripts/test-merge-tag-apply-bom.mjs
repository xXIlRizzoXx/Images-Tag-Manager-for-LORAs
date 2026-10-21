/* ITALIANO: PROVA CHE merge-tag-suggestions --apply LEGGA UN PIANO SALVATO CON IL BOM O IN UTF-16
   Il piano scritto da --out si riempie a mano. Se lo si risalva con Windows PowerShell 5.1
   (Set-Content -Encoding UTF8, Out-File) o con il Blocco note ("UTF-8 con BOM", "Unicode"), il file
   comincia con un BOM. --apply lo leggeva in UTF-8 senza toglierlo e si fermava con
   "SyntaxError: Unexpected token" e lo stack trace, mentre i file di tag del passo 1 accettano BOM e
   UTF-16. Ora il piano passa dalla stessa decodifica: UTF-8 (con o senza BOM), UTF-16 LE e BE con BOM
   inseriscono il tag; un piano illeggibile o con un JSON rotto ferma lo script con un messaggio che
   nomina il file, senza stack trace e senza toccare il dizionario. Si lancia lo script VERO su una
   copia del dizionario VERO in una cartella temporanea: il dizionario del progetto non si tocca.
   Uso:  node scripts/test-merge-tag-apply-bom.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT merge-tag-suggestions --apply READS A PLAN SAVED WITH A BOM OR AS UTF-16
   The plan written by --out is filled in by hand. Saved again with Windows PowerShell 5.1
   (Set-Content -Encoding UTF8, Out-File) or Notepad ("UTF-8 with BOM", "Unicode"), the file starts
   with a BOM. --apply read it as UTF-8 without dropping it and stopped with "SyntaxError: Unexpected
   token" and the stack trace, while the step 1 tag files accept a BOM and UTF-16. The plan now goes
   through the same decoding: UTF-8 (with or without BOM), UTF-16 LE and BE with a BOM insert the tag;
   an unreadable plan or broken JSON stops the script with a message naming the file, no stack trace,
   and the dictionary untouched. The REAL script runs on a copy of the REAL dictionary in a temporary
   folder: the project dictionary is not touched.
   Usage:  node scripts/test-merge-tag-apply-bom.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

const prova = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-merge-apply-bom-'));
try {
    fs.mkdirSync(path.join(prova, 'scripts'));
    fs.mkdirSync(path.join(prova, 'src', 'constants'), { recursive: true });
    const script = path.join(prova, 'scripts', 'merge-tag-suggestions.mjs');
    const dizionario = path.join(prova, 'src', 'constants', 'tagSuggestions.ts');
    const originale = path.join(radice, 'src', 'constants', 'tagSuggestions.ts');
    fs.copyFileSync(path.join(radice, 'scripts', 'merge-tag-suggestions.mjs'), script);
    const dizionarioPrima = fs.readFileSync(originale, 'utf8');
    const lancia = (...arg) => {
        const r = spawnSync(process.execPath, [script, ...arg], { cwd: prova, encoding: 'utf8' });
        return { codice: r.status, testo: (r.stdout || '') + (r.stderr || ''), errore: r.stderr || '' };
    };
    const scrivi = (nome, byte) => fs.writeFileSync(path.join(prova, nome), byte);

    const categoria = (/id: '([^']+)'/.exec(dizionarioPrima) || [])[1];
    dice('premessa: il dizionario ha una categoria e non ha "zzqx nastro"', [true, false], [!!categoria, dizionarioPrima.includes("'zzqx nastro'")]);
    const PIANO = JSON.stringify({ zzqx_nastro: { categoria, it: 'nastro di prova' } }, null, 1);
    const RIGA = "{ tag: 'zzqx nastro', translations: { it: 'nastro di prova', en: 'zzqx nastro' } },";

    const utf16le = (s) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(s, 'utf16le')]);
    const utf16be = (s) => Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(s, 'utf16le').swap16()]);
    const utf8bom = (s) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(s, 'utf8')]);

    // ITALIANO: il piano come lo scrive --out (UTF-8 senza BOM) deve continuare a funzionare, e quelli
    //           risalvati con il BOM UTF-8 o in UTF-16 LE / BE devono dare lo stesso risultato.
    // ENGLISH: the plan as --out writes it (UTF-8 without BOM) must keep working, and the ones saved
    //          again with the UTF-8 BOM or as UTF-16 LE / BE must give the same result.
    for (const [nome, byte] of [['piano-u8.json', Buffer.from(PIANO, 'utf8')], ['piano-u8bom.json', utf8bom(PIANO)], ['piano-u16le.json', utf16le(PIANO)], ['piano-u16be.json', utf16be(PIANO)]]) {
        fs.writeFileSync(dizionario, dizionarioPrima);
        scrivi(nome, byte);
        const r = lancia('--apply', nome);
        dice(nome + ': --apply finisce senza errori', 0, r.codice);
        dice(nome + ': nessun SyntaxError', false, /SyntaxError/.test(r.testo));
        const dopo = fs.readFileSync(dizionario, 'utf8');
        dice(nome + ': il tag entra una volta nel dizionario della copia', 1, dopo.split(RIGA).length - 1);
        dice(nome + ': il rapporto dice "aggiunti 1 tag"', true, /aggiunti 1 tag a 1 categorie/.test(r.testo));
    }

    // ITALIANO: un piano che non si decodifica (ANSI con una lettera accentata) e uno con un JSON rotto:
    //           lo script esce con codice 1, nomina il file, niente stack trace, dizionario intatto.
    // ENGLISH: a plan that cannot be decoded (ANSI with an accented letter) and one with broken JSON:
    //          the script exits with code 1, names the file, no stack trace, dictionary untouched.
    const guasti = [
        ['piano-ansi.json', Buffer.concat([Buffer.from('{"zzqx_nastro": {"categoria": "' + categoria + '", "it": "caff', 'latin1'), Buffer.from([0xe8]), Buffer.from('"}}', 'latin1')])],
        ['piano-rotto.json', utf8bom('{"zzqx_nastro": {"categoria": "' + categoria + '", "it": "nastro"')],
    ];
    for (const [nome, byte] of guasti) {
        fs.writeFileSync(dizionario, dizionarioPrima);
        scrivi(nome, byte);
        const r = lancia('--apply', nome);
        dice(nome + ': lo script esce con codice 1', 1, r.codice);
        dice(nome + ': il messaggio di errore nomina il file', true, r.errore.includes(nome));
        dice(nome + ': nessun SyntaxError e nessuno stack trace', [false, false], [/SyntaxError/.test(r.testo), /\n\s+at /.test(r.testo)]);
        dice(nome + ': il dizionario della copia non cambia', true, fs.readFileSync(dizionario, 'utf8') === dizionarioPrima);
    }

    dice('il dizionario del progetto non e\' cambiato', true, fs.readFileSync(originale, 'utf8') === dizionarioPrima);
} finally {
    fs.rmSync(prova, { recursive: true, force: true });
}

process.exit(esito());
