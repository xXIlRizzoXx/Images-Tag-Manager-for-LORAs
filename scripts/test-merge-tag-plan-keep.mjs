/* ITALIANO: PROVA CHE RILANCIARE IL PASSO 1 DI merge-tag-suggestions NON CANCELLI IL PIANO GIA' RIEMPITO
   Il passo 1 con --out piano.json scrive un piano con "categoria" e "it" vuoti, che si riempiono a
   mano (anche centinaia di voci). Rilanciando il passo 1 con lo stesso --out (arriva un altro file
   di tag, o si vuole solo rivedere il rapporto) lo script riscriveva il piano da zero: tutte le
   categorie e le traduzioni gia' scritte sparivano, senza un avviso. Ora il piano esistente si
   unisce: le voci gia' riempite restano (anche scritte con un'altra grafia, o con il BOM del Blocco
   note), i tag nuovi si aggiungono vuoti, le voci che non sono nei file di adesso restano, quelle
   finite nel frattempo nel dizionario si tolgono dicendolo. Un --out che esiste ma non e' un piano
   leggibile ferma tutto con codice 1 e non viene toccato (anche un JSON di soli oggetti che non e' un
   piano, come un file di configurazione: una voce oggetto senza ne' «categoria» ne' «it»). Si lancia lo script VERO su una copia del
   dizionario VERO in una cartella temporanea.
   Uso:  node scripts/test-merge-tag-plan-keep.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT RE-RUNNING STEP 1 OF merge-tag-suggestions DOES NOT WIPE THE PLAN ALREADY FILLED IN
   Step 1 with --out piano.json writes a plan with empty "categoria" and "it", filled in by hand
   (even hundreds of entries). Re-running step 1 with the same --out (another tag file arrives, or
   one just wants to see the report again) rewrote the plan from scratch: every category and
   translation already written was gone, without a warning. Now the existing plan is merged: the
   entries already filled stay (also when written with another spelling, or with Notepad's BOM),
   new tags are added empty, entries that are not in the current files stay, entries that reached
   the dictionary in the meantime are removed and the script says so. An --out that exists but is
   not a readable plan stops everything with exit code 1 and is not touched (also a JSON of objects only
   that is not a plan, like a configuration file: an object entry with neither "categoria" nor "it"). The REAL script runs on
   a copy of the REAL dictionary in a temporary folder.
   Usage:  node scripts/test-merge-tag-plan-keep.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

const prova = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-merge-plan-keep-'));
try {
    fs.mkdirSync(path.join(prova, 'scripts'));
    fs.mkdirSync(path.join(prova, 'src', 'constants'), { recursive: true });
    const script = path.join(prova, 'scripts', 'merge-tag-suggestions.mjs');
    const copiaDizionario = path.join(prova, 'src', 'constants', 'tagSuggestions.ts');
    fs.copyFileSync(path.join(radice, 'scripts', 'merge-tag-suggestions.mjs'), script);
    fs.copyFileSync(path.join(radice, 'src', 'constants', 'tagSuggestions.ts'), copiaDizionario);
    const dizionarioPrima = fs.readFileSync(copiaDizionario, 'utf8');
    const lancia = (...arg) => {
        const r = spawnSync(process.execPath, [script, ...arg], { cwd: prova, encoding: 'utf8' });
        return { codice: r.status, testo: (r.stdout || '') + (r.stderr || ''), errore: r.stderr || '' };
    };
    const scrivi = (nome, testo) => fs.writeFileSync(path.join(prova, nome), testo);
    const leggiPiano = (nome) => JSON.parse(fs.readFileSync(path.join(prova, nome), 'utf8'));
    const riempi = (nome, voci) => { const p = leggiPiano(nome); Object.assign(p, voci); scrivi(nome, JSON.stringify(p, null, 1)); };
    const VUOTA = { categoria: '', it: '' };

    scrivi('lista1.txt', 'close-up, zzqx alfa, zzqx beta\n');
    scrivi('lista2.txt', 'hat, zzqx gamma\n');

    // ITALIANO: caso vicino che non deve cambiare: senza un piano di prima si scrive come sempre.
    // ENGLISH: neighbouring case that must not change: with no earlier plan it is written as always.
    {
        const r = lancia('lista1.txt', '--out', 'piano.json');
        dice('piano nuovo: codice 0', 0, r.codice);
        dice('piano nuovo: i due tag nuovi, vuoti', { 'zzqx alfa': VUOTA, 'zzqx beta': VUOTA }, leggiPiano('piano.json'));
        dice('piano nuovo: il solito messaggio', true, /scritto piano\.json — riempi "categoria" e "it"/.test(r.testo));
    }

    // ITALIANO: si riempiono due voci a mano (una con un'altra grafia della chiave), poi si rilancia con un file in piu'.
    // ENGLISH: two entries are filled in by hand (one under another spelling of the key), then it is re-run with one more file.
    {
        const p = leggiPiano('piano.json');
        delete p['zzqx beta'];
        p['zzqx alfa'] = { categoria: 'framing', it: 'zzqx alfa it' };
        p['ZZQX_Beta'] = { categoria: 'framing', it: 'zzqx beta it' };
        scrivi('piano.json', JSON.stringify(p, null, 1));
        const r = lancia('lista1.txt', 'lista2.txt', '--out', 'piano.json');
        dice('rilancio: codice 0', 0, r.codice);
        dice('rilancio: le voci riempite restano, il tag nuovo entra vuoto, nessun doppione per la grafia diversa', {
            'zzqx alfa': { categoria: 'framing', it: 'zzqx alfa it' },
            'zzqx beta': { categoria: 'framing', it: 'zzqx beta it' },
            'zzqx gamma': VUOTA,
        }, leggiPiano('piano.json'));
        dice('rilancio: il messaggio dice quante voci riempite sono state tenute', true, /tenute 2 voci gia' riempite/.test(r.testo));
    }

    // ITALIANO: rilancio con il solo secondo file: le voci del primo restano nel piano, e lo si dice.
    // ENGLISH: re-run with the second file only: the entries of the first stay in the plan, and the script says so.
    {
        const r = lancia('lista2.txt', '--out', 'piano.json');
        dice('solo lista2: codice 0', 0, r.codice);
        dice('solo lista2: nessuna voce persa', {
            'zzqx alfa': { categoria: 'framing', it: 'zzqx alfa it' },
            'zzqx beta': { categoria: 'framing', it: 'zzqx beta it' },
            'zzqx gamma': VUOTA,
        }, leggiPiano('piano.json'));
        dice('solo lista2: il messaggio dice che due voci non sono nei file di adesso', true, /2 voci del piano non sono nei file di adesso: restano/.test(r.testo));
    }

    // ITALIANO: una voce del piano che nel frattempo e' nel dizionario (hat) si toglie, dicendolo.
    // ENGLISH: a plan entry that meanwhile is in the dictionary (hat) is removed, and the script says so.
    {
        riempi('piano.json', { hat: { categoria: 'framing', it: 'cappello' } });
        const r = lancia('lista2.txt', '--out', 'piano.json');
        dice('voce gia\' nel dizionario: tolta dal piano', false, 'hat' in leggiPiano('piano.json'));
        dice('voce gia\' nel dizionario: il messaggio lo dice', true, /1 voce del piano e' gia' nel dizionario: tolta/.test(r.testo));
        dice('voce gia\' nel dizionario: le altre restano', ['zzqx alfa', 'zzqx beta', 'zzqx gamma'], Object.keys(leggiPiano('piano.json')).sort());
    }

    // ITALIANO: un piano risalvato con il Blocco note (BOM UTF-8) si legge e si unisce.
    // ENGLISH: a plan saved again with Notepad (UTF-8 BOM) is read and merged.
    {
        scrivi('piano-bom.json', '﻿' + JSON.stringify({ 'zzqx alfa': { categoria: 'framing', it: 'alfa bom' } }));
        const r = lancia('lista1.txt', '--out', 'piano-bom.json');
        dice('piano con BOM: codice 0', 0, r.codice);
        dice('piano con BOM: la voce riempita resta', { categoria: 'framing', it: 'alfa bom' }, leggiPiano('piano-bom.json')['zzqx alfa']);
    }

    // ITALIANO: un --out che esiste ma non e' un piano leggibile: codice 1, il nome del file, file intatto.
    // ENGLISH: an --out that exists but is not a readable plan: exit code 1, the file name, file untouched.
    for (const [nome, contenuto] of [['rotto.json', '{"zzqx alfa": {"categoria": "framing",'], ['elenco.json', '["zzqx alfa"]'], ['nullo.json', 'null'],
        ['utf16-rotto.json', Buffer.from([0xff, 0xfe, 0x41])]]) {
        scrivi(nome, contenuto);
        const prima = fs.readFileSync(path.join(prova, nome));
        const r = lancia('lista1.txt', '--out', nome);
        dice(nome + ': codice 1', 1, r.codice);
        dice(nome + ': il messaggio nomina il file e dice che non lo sovrascrive', true, r.errore.includes(nome) && /non lo sovrascrivo/.test(r.errore));
        dice(nome + ': nessuno stack trace', false, /\n\s+at /.test(r.testo));
        dice(nome + ': file intatto', true, prima.equals(fs.readFileSync(path.join(prova, nome))));
    }

    // ITALIANO: un piano con voci scritte a mano in un'altra forma (testo, elenco, numero, null) tornava
    //           con quelle voci vuote e codice 0; un JSON che non e' un piano (l'esportazione dei tag del
    //           progetto) veniva riscritto con le sue chiavi come tag. Ora: codice 1, file intatto.
    // ENGLISH: a plan with entries hand-written in another form (string, list, number, null) came back with
    //          those entries empty and exit code 0; a JSON that is not a plan (the project tags export)
    //          was rewritten with its keys as tags. Now: exit code 1, file untouched.
    const esportazione = JSON.stringify({ app: 'Images Tag Manager for LORAs', type: 'project-tags', version: 1, globalTriggers: ['ohwx'], tags: ['zzqx alfa'] }, null, 2);
    for (const [nome, contenuto] of [
        ['voci-a-mano.json', JSON.stringify({ 'zzqx alfa': 'framing, alfa italiano', 'zzqx beta': ['framing', 'beta it'] }, null, 1)],
        ['voce-nulla.json', JSON.stringify({ 'zzqx alfa': { categoria: 'framing', it: 'alfa it' }, 'zzqx beta': null })],
        ['voce-numero.json', JSON.stringify({ 'zzqx alfa': 5 })],
        ['esportazione-progetto.json', esportazione],
    ]) {
        scrivi(nome, contenuto);
        const prima = fs.readFileSync(path.join(prova, nome));
        const r = lancia('lista1.txt', '--out', nome);
        dice(nome + ': codice 1, il messaggio nomina il file e dice che non lo sovrascrive', [1, true],
            [r.codice, r.errore.includes(nome) && /non lo sovrascrivo/.test(r.errore)]);
        dice(nome + ': file intatto, nessuno stack trace', [true, false], [prima.equals(fs.readFileSync(path.join(prova, nome))), /\n\s+at /.test(r.testo)]);
    }
    // ITALIANO: un JSON che non e' un piano ma contiene solo oggetti (un file di configurazione, un file di
    //           traduzioni) passato per sbaglio come --out veniva riscritto con i tag nuovi aggiunti. Ora una
    //           voce oggetto senza ne' «categoria» ne' «it» (e non vuota) ferma tutto: codice 1, file intatto.
    // ENGLISH: a JSON that is not a plan but holds only objects (a configuration file, a translations file)
    //          passed by mistake as --out was rewritten with the new tags added. Now an object entry with
    //          neither "categoria" nor "it" (and not empty) stops everything: exit code 1, file untouched.
    for (const [nome, contenuto] of [
        ['configurazione.json', JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022' }, watchOptions: { watchFile: 'useFsEvents' } }, null, 2)],
        ['traduzioni.json', JSON.stringify({ en: { hello: 'Hello' }, it: { hello: 'Ciao' } }, null, 2)],
        ['piano-e-altro.json', JSON.stringify({ 'zzqx alfa': { categoria: 'framing', it: 'alfa it' }, impostazioni: { tema: 'scuro' } }, null, 2)],
    ]) {
        scrivi(nome, contenuto);
        const prima = fs.readFileSync(path.join(prova, nome));
        const r = lancia('lista1.txt', '--out', nome);
        dice(nome + ': codice 1, il messaggio nomina il file e dice che non lo sovrascrive', [1, true],
            [r.codice, r.errore.includes(nome) && /non lo sovrascrivo/.test(r.errore)]);
        dice(nome + ': file intatto, nessuno stack trace', [true, false], [prima.equals(fs.readFileSync(path.join(prova, nome))), /\n\s+at /.test(r.testo)]);
    }
    // ITALIANO: casi vicini che restano come prima: voci con la sola «categoria» o il solo «it», voci vuote {},
    //           un piano col BOM e gli a capo di Windows.
    // ENGLISH: neighbouring cases that stay as before: entries with only "categoria" or only "it", empty {}
    //          entries, a plan with the BOM and Windows line breaks.
    {
        scrivi('piano-mezzo.json', JSON.stringify({ 'zzqx alfa': { categoria: 'framing' }, 'zzqx beta': { it: 'beta it' }, 'zzqx gamma': {} }));
        const r = lancia('lista1.txt', '--out', 'piano-mezzo.json');
        dice('voci con la sola categoria, il solo it o vuote: codice 0 e voci tenute', [0, { categoria: 'framing' }, { it: 'beta it' }],
            [r.codice, leggiPiano('piano-mezzo.json')['zzqx alfa'], leggiPiano('piano-mezzo.json')['zzqx beta']]);
        scrivi('piano-crlf.json', '﻿' + JSON.stringify({ 'zzqx alfa': { categoria: 'framing', it: 'alfa crlf' } }, null, 2).replace(/\n/g, '\r\n'));
        const s = lancia('lista1.txt', '--out', 'piano-crlf.json');
        dice('piano con BOM e a capo di Windows: codice 0, la voce riempita resta', [0, { categoria: 'framing', it: 'alfa crlf' }],
            [s.codice, leggiPiano('piano-crlf.json')['zzqx alfa']]);
    }
    // ITALIANO: casi vicini: un piano vuoto {} e un piano con voci oggetto (anche con campi in piu') si uniscono come prima.
    // ENGLISH: neighbouring cases: an empty plan {} and a plan with object entries (extra fields too) are merged as before.
    {
        scrivi('piano-vuoto.json', '{}');
        const r = lancia('lista1.txt', '--out', 'piano-vuoto.json');
        dice('piano {}: codice 0 e i tag nuovi entrano', [0, { 'zzqx alfa': VUOTA, 'zzqx beta': VUOTA }], [r.codice, leggiPiano('piano-vuoto.json')]);
        scrivi('piano-campi.json', JSON.stringify({ 'zzqx alfa': { categoria: 'framing', it: 'alfa it', nota: 'mia' } }));
        const s = lancia('lista1.txt', '--out', 'piano-campi.json');
        dice('voce con un campo in piu\': codice 0 e la voce resta com\'e\'', [0, { categoria: 'framing', it: 'alfa it', nota: 'mia' }], [s.codice, leggiPiano('piano-campi.json')['zzqx alfa']]);
    }
    // ITALIANO: --apply con voci non valide le salta come prima, senza fermarsi.
    // ENGLISH: --apply with invalid entries skips them as before, without stopping.
    {
        const r = lancia('--apply', 'voci-a-mano.json');
        dice('--apply su un piano con voci testo/elenco: codice 0, voci saltate come non valide', [0, true], [r.codice, /voce non valida/.test(r.testo)]);
    }

    // ITALIANO: un --out vuoto (o solo spazi) non contiene lavoro: si scrive come un piano nuovo.
    // ENGLISH: an empty --out (or spaces only) holds no work: it is written as a new plan.
    {
        scrivi('vuoto.json', '  \n');
        const r = lancia('lista1.txt', '--out', 'vuoto.json');
        dice('--out vuoto: codice 0 e piano scritto', [0, { 'zzqx alfa': VUOTA, 'zzqx beta': VUOTA }], [r.codice, leggiPiano('vuoto.json')]);
    }

    // ITALIANO: il piano unito va bene per --apply: le voci riempite entrano nel dizionario con la loro traduzione.
    // ENGLISH: the merged plan works with --apply: the filled entries enter the dictionary with their translation.
    {
        dice('prima di --apply il dizionario non e\' cambiato', true, fs.readFileSync(copiaDizionario, 'utf8') === dizionarioPrima);
        const r = lancia('--apply', 'piano.json');
        const diz = fs.readFileSync(copiaDizionario, 'utf8');
        dice('--apply: codice 0', 0, r.codice);
        dice('--apply: le due voci riempite sono nel dizionario', [true, true],
            [diz.includes("{ tag: 'zzqx alfa', translations: { it: 'zzqx alfa it'"), diz.includes("{ tag: 'zzqx beta', translations: { it: 'zzqx beta it'")]);
        dice('--apply: la voce vuota e\' saltata', true, /zzqx gamma -> categoria sconosciuta ""/.test(r.testo));
    }
} finally {
    fs.rmSync(prova, { recursive: true, force: true });
}

process.exit(esito());
