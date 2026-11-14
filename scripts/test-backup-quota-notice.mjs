/* ITALIANO: PROVA DELL'AVVISO QUANDO IL BACKUP ANTI-CRASH NON ENTRA NEL localStorage
   Con un dataset molto grande tutto da salvare (per esempio 10.000 foto con 40 tag dopo una trigger
   word) il backup supera il tetto del localStorage di Chromium (10 MiB, circa 5,2 milioni di
   caratteri). La scrittura lanciava QuotaExceededError e scriviBackupSubito lo inghiottiva: nel
   localStorage restava il backup di prima, la copia su file non partiva, e nessuno lo diceva. Dopo un
   crash il lavoro non salvato era perso. Ora l'errore di spazio arriva ad App.tsx, che chiede di
   premere «Salva Modifiche» (backupTooBig, nelle nove lingue), una volta finche' il backup non torna
   a entrare.
   Si eseguono le regole vere di src/utils/closeGuard.ts e src/utils/backupFile.ts con un localStorage
   finto che ha il tetto di Chromium, e il testo VERO dell'effetto del backup preso da src/App.tsx.
   Uso:  node scripts/test-backup-quota-notice.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE NOTICE WHEN THE CRASH BACKUP DOES NOT FIT IN localStorage
   With a very large dataset all unsaved (for example 10,000 photos with 40 tags after a trigger
   word) the backup exceeds Chromium's localStorage cap (10 MiB, about 5.2 million characters). The
   write threw QuotaExceededError and scriviBackupSubito swallowed it: localStorage kept the previous
   backup, the file copy did not start, and nobody said so. After a crash the unsaved work was lost.
   Now the out-of-space error reaches App.tsx, which asks to press "Save Changes" (backupTooBig, in
   the nine languages), once until the backup fits again.
   The real rules of src/utils/closeGuard.ts and src/utils/backupFile.ts are run with a fake
   localStorage holding Chromium's cap, and the REAL text of the backup effect taken from src/App.tsx.
   Usage:  node scripts/test-backup-quota-notice.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const G = await carica('src/utils/closeGuard.ts');
const F = await carica('src/utils/backupFile.ts');
const lingue = (await carica('src/constants.ts')).translations;
const { dice, esito } = creaControlli();

// ITALIANO: il localStorage di Chromium: 10 MiB per origine, 2 byte per carattere (chiave + valore).
// ENGLISH: Chromium's localStorage: 10 MiB per origin, 2 bytes per character (key + value).
const TETTO = 5242880;
const memoriaConTetto = (errore = () => new DOMException('The quota has been exceeded.', 'QuotaExceededError')) => {
    const m = new Map();
    const usati = () => [...m.entries()].reduce((n, [k, v]) => n + k.length + v.length, 0);
    return {
        get length() { return m.size; },
        key: (i) => [...m.keys()][i] ?? null,
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => {
            const prima = m.has(k) ? k.length + m.get(k).length : 0;
            if (usati() - prima + k.length + String(v).length > TETTO) throw errore();
            m.set(k, String(v));
        },
        removeItem: (k) => { m.delete(k); },
        clear: () => m.clear(),
    };
};
const SEP = '\x1f';
const TAG = Array.from({ length: 40 }, (_, i) => 'tag numero ' + i);
const progetto = (n) => Array.from({ length: n }, (_, i) => ({
    id: 'f' + i, file: { name: 'foto' + i + '.png' }, tags: ['ohwx', ...TAG], originalTags: TAG,
    backupKey: 'D:\\dataset' + SEP + 'foto' + i + '.png', lottoImport: 'L1', cartellaImport: 'dataset',
}));

console.log('\n--- 10.000 foto con 40 tag, tutte da salvare: il backup non entra ---');
{
    const memoria = memoriaConTetto();
    const scritti = [];
    const ls = F.archivioConCopiaSuFile(() => memoria, { writeCrashBackup: async (v) => { scritti.push(v); return true; } });
    let avvisi = 0;
    G.scriviBackupSubito(ls, progetto(10000), [], 'dataset', [], null, () => { avvisi++; });
    dice('premessa: il backup non e\' entrato nel localStorage', null, memoria.getItem('tagBackup'));
    dice('l\'errore di spazio arriva a chi scrive il backup (una volta)', 1, avvisi);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const memoria = memoriaConTetto();
    let avvisi = 0;
    G.scriviBackupSubito(F.archivioConCopiaSuFile(() => memoria, null), progetto(100), [], 'dataset', [], null, () => { avvisi++; });
    dice('100 foto: il backup entra e nessun avviso', [true, 0], [memoria.getItem('tagBackup') !== null, avvisi]);
}
{
    const memoria = memoriaConTetto(() => new DOMException('denied', 'SecurityError'));
    let avvisi = 0;
    G.scriviBackupSubito(memoria, progetto(10000), [], 'dataset', [], null, () => { avvisi++; });
    dice('un altro errore (non di spazio): nessun avviso di spazio, l\'app non si rompe', 0, avvisi);
}
{
    const memoria = memoriaConTetto();
    let lancia = null;
    try { G.scriviBackupSubito(memoria, progetto(10000), [], 'dataset'); } catch (e) { lancia = e; }
    dice('senza chi ascolta (chiusura della finestra, Chiudi progetto): nessun errore, come prima', null, lancia);
}

// ITALIANO: l'effetto vero di App.tsx che scrive il backup un secondo dopo l'ultima modifica.
// ENGLISH: App.tsx's real effect writing the backup one second after the last edit.
console.log('\n--- App.tsx: l\'effetto del backup passa l\'errore all\'avviso ---');
{
    const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
    const iScrive = sorgente.indexOf('scriviBackupSubito(localStorage, images, fotoChiuseRef.current.values(), folder, globalTriggersRef.current');
    const iInizio = iScrive < 0 ? -1 : sorgente.lastIndexOf('    useEffect(() => {', iScrive);
    const iFine = iScrive < 0 ? -1 : sorgente.indexOf('    }, [images, dirHandle]);', iScrive);
    if (iInizio < 0 || iFine < 0) { console.log('NO  l\'effetto del backup non trovato in src/App.tsx'); process.exit(1); }
    const testo = sorgente.slice(iInizio + '    useEffect('.length, iFine + '    }'.length);
    const js = (await esbuild.transform('const effettoBackup = ' + testo + ';', { loader: 'ts' })).code;
    const altriRef = [...new Set(testo.match(/\b\w+Ref\b/g) || [])].filter(n => n !== 'fotoChiuseRef');
    const effetto = new Function('images', 'dirHandle', 'localStorage', 'fotoChiuseRef', 'scriviBackupSubito', 'setTimeout', 'clearTimeout', ...altriRef,
        js + '\nreturn effettoBackup;');
    let avvisi = 0;
    const refs = Object.fromEntries(altriRef.map(n => [n, { current: n === 'lottiSessioneRef' ? new Set() : (n === 'globalTriggersRef' ? [] : false) }]));
    if (refs.avvisoBackupPienoRef) refs.avvisoBackupPienoRef.current = () => { avvisi++; };
    effetto(progetto(10000), { name: 'dataset' }, memoriaConTetto(), { current: new Map() }, G.scriviBackupSubito, (f) => { f(); return 0; }, () => { },
        ...altriRef.map(n => refs[n]))();
    dice('con il backup troppo grande l\'avviso della pagina viene chiamato', 1, avvisi);
    // ITALIANO: l'avviso vero: una volta sola finche' il backup non torna a entrare (vedi sotto), con la frase backupTooBig.
    // ENGLISH: the real notice: once until the backup fits again (see below), with the backupTooBig sentence.
    dice('App.tsx: l\'avviso mostra t.backupTooBig una volta sola finche\' il backup non torna a entrare', true,
        /avvisoBackupPienoRef\.current = \(\) => \{ if \(backupPienoDettoRef\.current\) return; backupPienoDettoRef\.current = true; showNotification\(t\.backupTooBig, 'error'\); \};/.test(sorgente));
}

// ITALIANO: l'avviso compariva una volta per tutta la sessione: dopo il primo, un secondo dataset
//           grande (o un'altra modifica in blocco) tornava a non entrare nel backup in silenzio. Ora
//           ricompare a ogni nuovo passaggio da «entra» a «non entra», ma non a ogni scrittura rifiutata
//           di fila. Si eseguono le righe VERE dell'avviso e dell'effetto (con un useRef finto che tiene
//           i ref fra un render e l'altro) su un localStorage finto con il tetto di Chromium.
// ENGLISH: the notice showed once for the whole session: after the first one, a second large dataset
//          (or another bulk edit) silently failed to fit in the backup again. Now it shows again on
//          every new passage from "fits" to "does not fit", but not on every refused write in a row.
//          The REAL lines of the notice and of the effect run (with a fake useRef keeping the refs
//          between renders) on a fake localStorage with Chromium's cap.
console.log('\n--- l\'avviso ricompare dopo che il backup e\' tornato a entrare ---');
{
    const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
    const iInizio = sorgente.indexOf('    const backupPienoDettoRef = useRef(false);');
    const iFine = iInizio < 0 ? -1 : sorgente.indexOf('    }, [images, dirHandle]);', iInizio);
    if (iInizio < 0 || iFine < 0) { console.log('NO  l\'avviso e l\'effetto del backup non trovati in src/App.tsx'); process.exit(1); }
    const testo = sorgente.slice(iInizio, iFine + '    }, [images, dirHandle]);'.length);
    const js = (await esbuild.transform(testo, { loader: 'ts' })).code;
    const nomiRef = [...new Set(testo.match(/\b\w+Ref\b/g) || [])].filter(n => !/^(backupPienoDettoRef|avvisoBackupPienoRef|useRef)$/.test(n));
    const render = new Function('useRef', 'useEffect', 'images', 'dirHandle', 'localStorage', 'scriviBackupSubito', 'setTimeout', 'clearTimeout', 'showNotification', 't', ...nomiRef, js);
    const memoria = memoriaConTetto();
    const avvisi = [];
    const slot = [];
    const refs = Object.fromEntries(nomiRef.map(n => [n, { current: n === 'lottiSessioneRef' ? new Set() : (n === 'globalTriggersRef' ? [] : (n === 'fotoChiuseRef' ? new Map() : false)) }]));
    // ITALIANO: un render di App con queste foto: i useRef tengono il loro oggetto, l'effetto gira subito.
    // ENGLISH: an App render with these photos: the useRefs keep their object, the effect runs at once.
    const giro = (immagini) => {
        let i = 0;
        render((v) => (slot[i] = slot[i] || { current: v }, slot[i++]), (f) => { f(); }, immagini, { name: 'dataset' }, memoria, G.scriviBackupSubito,
            (f) => { f(); return 0; }, () => { }, (m, tipo) => avvisi.push([m, tipo]), lingue.en, ...nomiRef.map(n => refs[n]));
    };
    giro(progetto(10000));
    dice('premessa: 10.000 foto da salvare, il backup non entra: un avviso', 1, avvisi.length);
    giro(progetto(10000));
    dice('una seconda scrittura rifiutata di fila: nessun avviso in piu\'', 1, avvisi.length);
    giro(progetto(100));
    dice('dopo il salvataggio il backup torna a entrare (100 foto): nessun avviso', [1, true], [avvisi.length, memoria.getItem('tagBackup') !== null]);
    giro(progetto(10000));
    dice('un\'altra modifica in blocco non entra di nuovo: l\'avviso ricompare', 2, avvisi.length);
    dice('...con la frase backupTooBig, come rosso', [lingue.en.backupTooBig, 'error'], avvisi[1] || null);
    giro([]);
    giro(progetto(10000));
    dice('backup tolto (niente da salvare) e poi di nuovo troppo grande: l\'avviso ricompare ancora', 3, avvisi.length);
}

console.log('\n--- la frase nelle nove lingue, col nome vero del tasto ---');
for (const [lingua, t] of Object.entries(lingue)) {
    dice(`${lingua}: backupTooBig nomina «${t.saveChanges}»`, true, typeof t.backupTooBig === 'string' && t.backupTooBig.includes(t.saveChanges));
}

process.exit(esito());
