/* ITALIANO: PROVA CHE IL PASSO 1 DI merge-tag-suggestions FERMI UN .json DI TAG ROTTO CON UN MESSAGGIO
   Al passo 1 (il rapporto) si passano i file di tag ricevuti. Un .json con una virgola in fondo
   all'elenco ({"tags": ["1girl", "smile",]}) faceva uscire lo script con "SyntaxError" e lo stack
   trace di Node, senza dire quale dei file era rotto. --apply ha gia' un messaggio chiaro; ora anche
   il passo 1: codice 1, il nome del file, niente stack trace e nessun piano scritto con --out. Un
   .json valido (con tags/globalTriggers, o un elenco qualsiasi) e un .txt continuano a funzionare.
   Si lancia lo script VERO su una copia del dizionario VERO in una cartella temporanea.
   Uso:  node scripts/test-merge-tag-json-rotto.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT STEP 1 OF merge-tag-suggestions STOPS A BROKEN TAG .json WITH A MESSAGE
   Step 1 (the report) takes the tag files received. A .json with a trailing comma in the list
   ({"tags": ["1girl", "smile",]}) made the script exit with "SyntaxError" and the Node stack trace,
   without saying which of the files was broken. --apply already has a clear message; now step 1 too:
   exit code 1, the file name, no stack trace and no plan written with --out. A valid .json (with
   tags/globalTriggers, or any list) and a .txt keep working. The REAL script runs on a copy of the
   REAL dictionary in a temporary folder.
   Usage:  node scripts/test-merge-tag-json-rotto.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

const prova = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-merge-json-rotto-'));
try {
    fs.mkdirSync(path.join(prova, 'scripts'));
    fs.mkdirSync(path.join(prova, 'src', 'constants'), { recursive: true });
    const script = path.join(prova, 'scripts', 'merge-tag-suggestions.mjs');
    const originale = path.join(radice, 'src', 'constants', 'tagSuggestions.ts');
    fs.copyFileSync(path.join(radice, 'scripts', 'merge-tag-suggestions.mjs'), script);
    fs.copyFileSync(originale, path.join(prova, 'src', 'constants', 'tagSuggestions.ts'));
    const lancia = (...arg) => {
        const r = spawnSync(process.execPath, [script, ...arg], { cwd: prova, encoding: 'utf8' });
        return { codice: r.status, testo: (r.stdout || '') + (r.stderr || ''), errore: r.stderr || '' };
    };
    const scrivi = (nome, testo) => fs.writeFileSync(path.join(prova, nome), testo);

    scrivi('ok.txt', '1girl, zzqx nastro\n');
    scrivi('valido.json', JSON.stringify({ app: 'Images Tag Manager for LORAs', globalTriggers: ['zzqx trigger'], tags: ['smile', 'zzqx nastro'] }));
    scrivi('elenco.json', JSON.stringify(['smile', 'zzqx elenco']));

    // ITALIANO: casi vicini che non devono cambiare: .txt e .json validi finiscono con codice 0.
    // ENGLISH: neighbouring cases that must not change: valid .txt and .json end with code 0.
    {
        const r = lancia('ok.txt', 'valido.json', 'elenco.json', '--out', 'piano-ok.json');
        dice('file validi: il rapporto finisce con codice 0', 0, r.codice);
        dice('file validi: valido.json legge trigger e tag, non il nome dell\'app', true, /valido\.json: 3 tag letti/.test(r.testo));
        dice('file validi: elenco.json letto', true, /elenco\.json: 2 tag letti/.test(r.testo));
        const piano = JSON.parse(fs.readFileSync(path.join(prova, 'piano-ok.json'), 'utf8'));
        dice('file validi: il piano propone i tre tag nuovi di prova', ['zzqx elenco', 'zzqx nastro', 'zzqx trigger'],
            Object.keys(piano).filter((t) => t.startsWith('zzqx')).sort());
    }

    // ITALIANO: .json rotti (virgola in fondo, parentesi non chiusa, con il BOM): codice 1, il nome del
    //           file, niente SyntaxError ne' stack trace, nessun piano scritto.
    // ENGLISH: broken .json (trailing comma, unclosed bracket, with the BOM): exit code 1, the file
    //          name, no SyntaxError nor stack trace, no plan written.
    const rotti = [
        ['tags.json', '{"tags": ["1girl", "smile",]}'],
        ['aperto.json', '{"tags": ["1girl", "smile"'],
        ['con-bom.json', '﻿{"tags": ["1girl",, "smile"]}'],
    ];
    for (const [nome, testo] of rotti) {
        scrivi(nome, testo);
        const pianoOut = 'piano-' + nome;
        const r = lancia('ok.txt', nome, '--out', pianoOut);
        dice(nome + ': lo script esce con codice 1', 1, r.codice);
        dice(nome + ': il messaggio di errore nomina il file', true, r.errore.includes(nome));
        dice(nome + ': il messaggio dice che non e\' un JSON valido', true, /non e' un JSON valido/.test(r.errore));
        dice(nome + ': nessun SyntaxError e nessuno stack trace', [false, false], [/SyntaxError/.test(r.testo), /\n\s+at /.test(r.testo)]);
        dice(nome + ': nessun piano scritto', false, fs.existsSync(path.join(prova, pianoOut)));
    }

    dice('il dizionario del progetto non e\' cambiato', true,
        fs.readFileSync(originale, 'utf8') === fs.readFileSync(path.join(prova, 'src', 'constants', 'tagSuggestions.ts'), 'utf8'));
} finally {
    fs.rmSync(prova, { recursive: true, force: true });
}

process.exit(esito());
