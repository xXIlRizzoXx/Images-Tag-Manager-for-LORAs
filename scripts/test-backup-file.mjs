/* ITALIANO: PROVA: IL BACKUP ANTI-CRASH SOPRAVVIVE A UN'USCITA BRUSCA
   Il backup stava solo nel localStorage, che Chromium scrive sul disco qualche secondo dopo. Provato
   sull'exe vero il 20/10/2026: tag aggiunto senza salvare, processo ucciso dopo pochi secondi, al
   riavvio il backup non c'era e la modifica era persa; dopo 16 secondi invece c'era. Ora ogni
   scrittura del backup va anche in un file di userData, scritto subito dal processo principale (con
   fsync e rinomina); all'avvio, prima che l'app parta, il file torna nel localStorage se e' piu'
   recente. Togliere il backup (Reset) scrive una "lapide" datata, cosi' un backup vecchio rimasto nel
   localStorage non torna.
   Si eseguono src/utils/backupFile.ts, closeGuard.ts e tagBackup.ts veri, e i canali backup:read e
   backup:write veri di electron/main.cjs (vedi main-harness.mjs) su una cartella temporanea.
   Uso:  node scripts/test-backup-file.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: THE CRASH BACKUP SURVIVES A SUDDEN EXIT
   The backup lived only in localStorage, which Chromium writes to disk a few seconds later. Tried on
   the real exe on 20/10/2026: a tag added without saving, the process killed after a few seconds, on
   restart the backup was not there and the edit was lost; after 16 seconds it was there. Now every
   backup write also goes to a userData file, written at once by the main process (with fsync and
   rename); at start-up, before the app starts, the file goes back into localStorage when it is newer.
   Removing the backup (Reset) writes a dated "tombstone", so an old backup left in localStorage does
   not come back.
   The REAL src/utils/backupFile.ts, closeGuard.ts and tagBackup.ts run, and the REAL backup:read and
   backup:write channels of electron/main.cjs (see main-harness.mjs) on a temporary folder.
   Usage:  node scripts/test-backup-file.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { caricaMain, creaControlli } from './main-harness.mjs';
import { creaApp, cartella, riepilogo } from './import-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'));
const F = await carica('src/utils/backupFile.ts');
const G = await carica('src/utils/closeGuard.ts');
const B = await carica('src/utils/tagBackup.ts');
const { dice, esito } = creaControlli();

const cartellaDati = fs.mkdtempSync(path.join(os.tmpdir(), 'itm-backup-file-'));
const { handlers } = caricaMain({ userData: cartellaDati });
const fileBackup = path.join(cartellaDati, 'crash-backup.json');
const api = {
    readCrashBackup: async () => handlers.get('backup:read')({}),
    writeCrashBackup: async (v) => handlers.get('backup:write')({}, v),
};
// ITALIANO: un localStorage finto in memoria (quello che Chromium ha davvero scritto sul disco).
// ENGLISH: a fake in-memory localStorage (what Chromium has really written to disk).
const memoria = (iniziale = {}) => {
    const m = new Map(Object.entries(iniziale));
    return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, clear: () => m.clear(),
        getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const pausa = () => new Promise(ok => setTimeout(ok, 0));
const NOMI = ['a.png', 'b.png', 'c.png'];

try {
    console.log('\n--- i canali del processo principale ---');
    dice('senza file: backup:read risponde null', null, await api.readCrashBackup());
    dice('backup:write scrive il testo', true, await api.writeCrashBackup('{"ts":5}'));
    dice('...e backup:read lo rilegge', '{"ts":5}', await api.readCrashBackup());
    dice('nessun file temporaneo rimasto', false, fs.existsSync(fileBackup + '.tmp'));
    dice('un valore che non e\' testo non scrive niente', [false, '{"ts":5}'], [await api.writeCrashBackup({ ts: 9 }), await api.readCrashBackup()]);
    dice('un testo vuoto non scrive niente', false, await api.writeCrashBackup(''));
    dice('oltre 16 MB non scrive niente', false, await api.writeCrashBackup('x'.repeat(16 * 1024 * 1024 + 1)));
    fs.writeFileSync(fileBackup, Buffer.alloc(16 * 1024 * 1024 + 10, 0x20));
    dice('un file oltre 16 MB non si legge', null, await api.readCrashBackup());
    fs.rmSync(fileBackup);

    console.log('\n--- l\'involucro del localStorage ---');
    {
        const vero = memoria({ lingua: 'it' });
        const scritti = [];
        const ls = F.archivioConCopiaSuFile(() => vero, { writeCrashBackup: async (v) => { scritti.push(v); return true; } });
        ls.setItem('lingua', 'en');
        dice('le altre chiavi vanno solo al localStorage vero', [['en'], []], [[vero.getItem('lingua')], scritti]);
        ls.setItem('tagBackup', '{"ts":7}');
        dice('il backup va al localStorage E al file', ['{"ts":7}', ['{"ts":7}']], [vero.getItem('tagBackup'), scritti]);
        ls.removeItem('tagBackup');
        const lapide = JSON.parse(scritti[1] || '{}');
        dice('togliere il backup scrive una lapide datata nel file', [null, true, true], [vero.getItem('tagBackup'), lapide.vuoto === true, lapide.ts > 0]);
        ls.removeItem('tagBackup');
        ls.removeItem('tagBackup');
        dice('togliere un backup che non c\'e\' (riscrittura senza modifiche) non riscrive il file', 2, scritti.length);
        dice('getItem, length e key leggono il vero', ['en', 1, 'lingua'], [ls.getItem('lingua'), ls.length, ls.key(0)]);
        const pieno = { ...memoria(), setItem() { throw new Error('QuotaExceededError'); } };
        const scritti2 = [];
        const ls2 = F.archivioConCopiaSuFile(pieno, { writeCrashBackup: async (v) => { scritti2.push(v); return true; } });
        let errore = null;
        try { ls2.setItem('tagBackup', '{"ts":8}'); } catch (e) { errore = e.message; }
        dice('localStorage pieno: l\'errore arriva a chi scrive (che lo gestisce) e il file non si tocca', ['QuotaExceededError', []], [errore, scritti2]);
        const ls3 = F.archivioConCopiaSuFile(memoria(), { writeCrashBackup: () => { throw new Error('rotto'); } });
        let ok = true;
        try { ls3.setItem('tagBackup', '{"ts":9}'); } catch (_) { ok = false; }
        dice('un canale rotto non rompe la scrittura nel localStorage', true, ok);
        const ls4 = F.archivioConCopiaSuFile(memoria(), null);
        ls4.setItem('tagBackup', '{"ts":1}');
        dice('nel browser (niente electronAPI) fa solo il localStorage', '{"ts":1}', ls4.getItem('tagBackup'));
        let chiesto = 0;
        F.archivioConCopiaSuFile(() => { chiesto++; throw new Error('SecurityError'); }, null);
        dice('il localStorage vero non si legge al caricamento (un SecurityError resta dentro le chiamate)', 0, chiesto);
    }

    console.log('\n--- all\'avvio vince il piu\' recente ---');
    {
        const conFile = (testo) => ({ readCrashBackup: async () => testo });
        let v = memoria();
        dice('localStorage vuoto, file con il backup: torna dal file', ['file', '{"ts":10}'], [await F.allineaBackupDaFile(v, conFile('{"ts":10}')), v.getItem('tagBackup')]);
        v = memoria({ tagBackup: '{"ts":20}' });
        dice('localStorage piu\' recente: resta il suo', ['invariato', '{"ts":20}'], [await F.allineaBackupDaFile(v, conFile('{"ts":10}')), v.getItem('tagBackup')]);
        v = memoria({ tagBackup: '{"ts":10}' });
        dice('file piu\' recente: vince il file', ['file', '{"ts":30}'], [await F.allineaBackupDaFile(v, conFile('{"ts":30}')), v.getItem('tagBackup')]);
        v = memoria({ tagBackup: '{"ts":10}' });
        dice('lapide piu\' recente (Reset non ancora scritto da Chromium): il backup vecchio sparisce', ['tolto', null],
            [await F.allineaBackupDaFile(v, conFile('{"ts":40,"vuoto":true}')), v.getItem('tagBackup')]);
        v = memoria({ tagBackup: '{"ts":50}' });
        dice('lapide piu\' vecchia: il backup resta', ['invariato', '{"ts":50}'], [await F.allineaBackupDaFile(v, conFile('{"ts":40,"vuoto":true}')), v.getItem('tagBackup')]);
        v = memoria({ tagBackup: '{"ts":10}' });
        dice('file illeggibile: niente cambia', ['invariato', '{"ts":10}'], [await F.allineaBackupDaFile(v, conFile('{rotto')), v.getItem('tagBackup')]);
        v = memoria();
        dice('nessun file: niente cambia', ['invariato', null], [await F.allineaBackupDaFile(v, conFile(null)), v.getItem('tagBackup')]);
        dice('nel browser: niente cambia', 'invariato', await F.allineaBackupDaFile(memoria(), undefined));
        dice('un canale che fallisce: niente cambia', 'invariato', await F.allineaBackupDaFile(memoria(), { readCrashBackup: async () => { throw new Error('x'); } }));
    }

    console.log('\n--- il caso dell\'exe: modifica, processo ucciso prima che Chromium scriva, riavvio ---');
    {
        const h = cartella('disco1', 'ds');
        const prima = creaApp();
        await prima.conferma(riepilogo(h, NOMI));
        const modificate = prima.images.map(i => i.file.name === 'b.png' ? { ...i, tags: [...i.tags, 'nuovo'] } : i);
        // ITALIANO: la sessione: il backup si scrive con la funzione vera, attraverso l'involucro.
        // ENGLISH: the session: the backup is written with the real function, through the wrapper.
        const inMemoria = memoria();
        G.scriviBackupSubito(F.archivioConCopiaSuFile(() => inMemoria, api), modificate, [], 'ds');
        await pausa();
        dice('premessa: il backup c\'e\' nel localStorage della sessione', true, inMemoria.getItem('tagBackup') !== null);
        // ITALIANO: il processo muore: Chromium non ha ancora scritto niente, il localStorage al riavvio e' vuoto.
        // ENGLISH: the process dies: Chromium has not written anything yet, localStorage on restart is empty.
        const dopoCrash = memoria();
        dice('al riavvio il backup torna dal file', 'file', await F.allineaBackupDaFile(dopoCrash, api));
        const d = riepilogo(h, NOMI);
        dice('...e il riepilogo lo annuncia (1 foto)', 1, (B.recuperoDellImport(dopoCrash.getItem('tagBackup'), d.handle, d.imgFiles) || {}).n);
        const dopo = creaApp({ backup: dopoCrash.getItem('tagBackup') });
        await dopo.conferma(riepilogo(h, NOMI), true);
        dice('...e con la spunta b.png riprende il tag non salvato', ['nuovo'], (dopo.images.find(i => i.file.name === 'b.png') || {}).tags);
    }

    console.log('\n--- Reset: il backup tolto non torna ---');
    {
        const vecchio = JSON.stringify({ ts: Date.now() - 1000, folder: 'ds', sources: [] });
        await api.writeCrashBackup(vecchio);
        const sessione = memoria({ tagBackup: vecchio });
        F.archivioConCopiaSuFile(() => sessione, api).removeItem('tagBackup');
        await pausa();
        // ITALIANO: Chromium non ha scritto la rimozione: al riavvio il localStorage ha ancora il vecchio.
        // ENGLISH: Chromium did not write the removal: on restart localStorage still has the old one.
        const riavvio = memoria({ tagBackup: vecchio });
        dice('al riavvio la lapide toglie il backup vecchio', ['tolto', null], [await F.allineaBackupDaFile(riavvio, api), riavvio.getItem('tagBackup')]);
    }

    console.log('\n--- il programma usa davvero l\'involucro e l\'allineamento ---');
    {
        const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
        const avvio = fs.readFileSync(path.join(radice, 'src/main.tsx'), 'utf8');
        const dich = app.indexOf('const localStorage = archivioConCopiaSuFile(() => window.localStorage, (window as any).electronAPI);');
        dice('App.tsx: "localStorage" e\' l\'involucro, dichiarato prima del componente', true, dich > 0 && dich < app.indexOf('export default function App'));
        dice('App.tsx: i backup passano dall\'involucro (scriviBackupSubito e backupDopoChiusura ricevono "localStorage")', true,
            /scriviBackupSubito\(localStorage,/.test(app) && /backupDopoChiusura\(localStorage,/.test(app) && !/window\.localStorage\.(setItem|removeItem)/.test(app));
        dice('main.tsx: l\'app parte dopo allineaBackupDaFile, con un tempo massimo', true,
            /allineaBackupDaFile\(/.test(avvio) && /\.finally\(\(\) => \{ clearTimeout\(attesa\); parti\(\); \}\)/.test(avvio) && /setTimeout\(parti, \d+\)/.test(avvio));
    }
} finally {
    fs.rmSync(cartellaDati, { recursive: true, force: true });
}

process.exit(esito());
