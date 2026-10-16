/* ITALIANO: PROVA DI "CHIUDI PROGETTO" CON IL RECUPERO DI UN'ALTRA CARTELLA
   Il programma si chiude male con modifiche non salvate in due cartelle, char1 e char2. Al riavvio
   l'utente riapre solo char1: il backup anti-crash tiene ancora le modifiche di char2. Poi preme
   Chiudi progetto (o "Salva e chiudi", o "Chiudi senza salvare"): closeProjectNow cancellava tutto
   il backup, e le modifiche di char2 sparivano prima che la cartella fosse mai stata riaperta,
   senza nessun avviso. La regola: chiudendo il progetto escono dal backup le cartelle in memoria
   (con le loro modifiche, salvate o buttate via), restano quelle mai riaperte; Reset cancella tutto.
   Si esegue il testo VERO di closeProjectNow preso da src/App.tsx, con le regole vere di
   src/utils/closeGuard.ts e src/utils/tagBackup.ts (compilati con esbuild) e un localStorage finto.
   Uso:  node scripts/test-close-project-keeps-crash-backup.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "CLOSE PROJECT" WITH ANOTHER FOLDER'S RECOVERY
   The program dies with unsaved edits in two folders, char1 and char2. After the restart the user
   reopens char1 only: the crash backup still holds char2's edits. Then they press Close project (or
   "Save and close", or "Close without saving"): closeProjectNow removed the whole backup, and
   char2's edits were gone before that folder was ever reopened, with no warning. The rule: closing
   the project drops the folders in memory from the backup (with their edits, saved or thrown away),
   keeps those never reopened; Reset removes everything.
   The REAL text of closeProjectNow taken from src/App.tsx is run, with the real rules of
   src/utils/closeGuard.ts and src/utils/tagBackup.ts (compiled with esbuild) and a fake localStorage.
   Usage:  node scripts/test-close-project-keeps-crash-backup.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const carica = async (rel) => {
    const u = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
};
const B = await carica('src/utils/tagBackup.ts');
const G = await carica('src/utils/closeGuard.ts');
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const ritaglia = (intestazione) => {
    const inizio = sorgente.indexOf(intestazione);
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (!fine) { console.log('NO  non trovato in src/App.tsx: ' + intestazione.trim()); process.exit(1); }
    return sorgente.slice(inizio, fine.index + fine[0].length);
};
const js = (await esbuild.transform(ritaglia('    const closeProjectNow = '), { loader: 'ts' })).code;
const NOMI = ['progettoGenRef', 'aiCancelRequestedRef', 'setAiCancelRequested', 'aiAbortControllerRef', 'localStorage', 'backupDopoChiusura',
    'imagesRef', 'fotoChiuseRef', 'releaseThumbnails', 'images', 'liberaAnteprimeProgetto', 'ultimoSvuotamento', 'setUltimoSvuotamento',
    'setImages', 'setGlobalTriggers', 'setSelectedForBulk', 'setStagedBulkTags', 'setCustomProjectTags', 'setDirHandle', 'setSelectedImageId',
    'setCopiedTags', 'setHistory', 'setHistoryIndex', 'discoNotoRef', 'soundManager', 'showNotification', 't'];
const fabbrica = new Function(...NOMI, js + '\nreturn closeProjectNow;');

const SEP = '\x1f';
const memoriaFinta = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
};
const NOMI_FOTO = ['0001.png', '0002.png'];
const foto = (cartella, nome, tags, originalTags, lotto) => ({
    id: cartella + '/' + nome, file: { name: nome }, tags, originalTags, backupKey: 'E:\\' + cartella + SEP + nome,
    lottoImport: lotto, cartellaImport: cartella,
});
const firma = (cartella) => B.folderSignature(cartella, NOMI_FOTO);
// ITALIANO: cosa troverebbe l'import riaprendo la cartella: i tag recuperati di 0001.png, o null.
// ENGLISH: what the import would find reopening the folder: 0001.png's recovered tags, or null.
const recupero = (memoria, cartella) => {
    const letto = B.backupDellImport(memoria.getItem('tagBackup'), cartella, firma(cartella));
    const voce = letto ? letto.voci['E:\\' + cartella + SEP + '0001.png'] : undefined;
    return B.tagDaRipristinare(voce, ['disco'], ['disco'], [], undefined, letto ? letto.ts : null);
};
// ITALIANO: il crash: due cartelle aperte, ognuna con 0001.png modificata e non salvata.
// ENGLISH: the crash: two folders open, each with 0001.png edited and unsaved.
const dopoIlCrash = (cartelle = ['char1', 'char2']) => {
    const memoria = memoriaFinta();
    const lista = cartelle.flatMap((c, i) => [foto(c, '0001.png', ['disco', 'modifica ' + c], ['disco'], 'L' + i), foto(c, '0002.png', ['x'], ['x'], 'L' + i)]);
    G.scriviBackupSubito(memoria, lista, [], cartelle[cartelle.length - 1]);
    return memoria;
};
// ITALIANO: la sessione dopo il crash: char1 riaperta (le sue modifiche recuperate), poi closeProjectNow
//           e l'effetto del backup che gira con la lista vuota, come in App.tsx dopo setImages([]).
// ENGLISH: the session after the crash: char1 reopened (its edits recovered), then closeProjectNow
//          and the backup effect running with the empty list, as in App.tsx after setImages([]).
const chiudiProgetto = (memoria, aperte, chiuse = []) => {
    G.scriviBackupSubito(memoria, aperte, chiuse, 'char1');
    const fotoChiuseRef = { current: new Map(chiuse.map(c => [c.id, c])) };
    const nulla = () => { };
    const chiudi = fabbrica({ current: 0 }, { current: false }, nulla, { current: null }, memoria, G.backupDopoChiusura,
        { current: aperte }, fotoChiuseRef, nulla, aperte, nulla, null, nulla,
        nulla, nulla, nulla, nulla, nulla, nulla, nulla, nulla, nulla, nulla, { current: new Map() },
        { chime() { }, pop() { } }, nulla, { closeAllDone: 'chiuso' });
    chiudi();
    G.scriviBackupSubito(memoria, [], fotoChiuseRef.current.values(), '');
};

console.log('\n--- crash con char1 e char2, riaperta solo char1, poi Chiudi progetto ---');
{
    const memoria = dopoIlCrash();
    dice('prima di chiudere, char2 si recupera', ['disco', 'modifica char2'], recupero(memoria, 'char2'));
    chiudiProgetto(memoria, [foto('char1', '0001.png', ['disco', 'modifica char1'], ['disco'], 'n1'), foto('char1', '0002.png', ['x'], ['x'], 'n1')]);
    dice('"Chiudi senza salvare": char2 si recupera ancora', ['disco', 'modifica char2'], recupero(memoria, 'char2'));
    dice('...e le modifiche buttate via di char1 non tornano', null, recupero(memoria, 'char1'));
}
{
    const memoria = dopoIlCrash();
    chiudiProgetto(memoria, [foto('char1', '0001.png', ['disco', 'modifica char1'], ['disco', 'modifica char1'], 'n1'), foto('char1', '0002.png', ['x'], ['x'], 'n1')]);
    dice('"Salva e chiudi": char2 si recupera ancora', ['disco', 'modifica char2'], recupero(memoria, 'char2'));
    dice('...e char1, salvata, non ha niente da recuperare', null, recupero(memoria, 'char1'));
}
{
    // ITALIANO: una foto di char1 chiusa con la X: la sua impronta conta ancora le due foto.
    // ENGLISH: a char1 photo closed with the X: its fingerprint still counts both photos.
    const memoria = dopoIlCrash();
    chiudiProgetto(memoria, [foto('char1', '0002.png', ['x'], ['x'], 'n1')], [{ id: 'char1/0001.png', name: '0001.png', lotto: 'n1', cartella: 'char1' }]);
    dice('0001.png di char1 chiusa con la X, poi Chiudi progetto: char2 resta', ['disco', 'modifica char2'], recupero(memoria, 'char2'));
    dice('...e la modifica buttata via di char1 non torna', null, recupero(memoria, 'char1'));
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const memoria = dopoIlCrash(['char1']);
    chiudiProgetto(memoria, [foto('char1', '0001.png', ['disco', 'modifica char1'], ['disco'], 'n1'), foto('char1', '0002.png', ['x'], ['x'], 'n1')]);
    dice('una sola cartella nel backup: Chiudi progetto lo cancella come prima', null, memoria.getItem('tagBackup'));
}
{
    const reset = ritaglia('    const handleResetProject = ');
    dice('Reset cancella ancora tutto il backup', true, reset.includes("localStorage.removeItem('tagBackup')"));
    dice('Chiudi progetto non cancella piu\' tutto il backup', false, ritaglia('    const closeProjectNow = ').includes("localStorage.removeItem('tagBackup')"));
}

process.exit(esito());
