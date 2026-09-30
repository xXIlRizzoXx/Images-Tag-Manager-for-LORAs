/* ITALIANO: PROVA DEL BACKUP ANTI-CRASH: SOLO LE MODIFICHE NON SALVATE, E IL DISCO PIU' NUOVO VINCE
   Il backup automatico dei tag si scriveva con TUTTE le foto, anche quelle senza modifiche, e
   restava dopo una chiusura normale con la X. Se poi i .txt cambiavano fuori dal programma (un
   altro programma di tag, Blocco note), riaprendo la cartella i tag VECCHI del backup tornavano
   sopra quelli nuovi, la foto risultava modificata e il primo "Salva" li scriveva su disco: il
   lavoro fatto fuori spariva senza un avviso.
   Si provano le regole VERE di src/utils/tagBackup.ts (compilato al volo con esbuild), con lo
   stesso giro del programma: effetto che scrive il backup -> chiusura -> .txt cambiato -> import.
   Uso:  node scripts/test-backup-unsaved-only.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE CRASH BACKUP: ONLY UNSAVED EDITS, AND THE NEWER DISK WINS
   The automatic tag backup was written with EVERY photo, unedited ones too, and it survived a
   normal quit with the X. If the .txt files then changed outside the program (another tagging
   tool, Notepad), reopening the folder put the backup's OLD tags back over the new ones, the
   photo counted as modified and the first "Save" wrote them to disk: the work done elsewhere was
   gone without a warning.
   The REAL rules of src/utils/tagBackup.ts are tested (compiled on the fly with esbuild), along
   the program's own loop: effect writing the backup -> quit -> .txt changed -> import.
   Usage:  node scripts/test-backup-unsaved-only.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
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
const B = await carica('src/utils/tagBackup.ts');
const { dice, esito } = creaControlli();

const SEP = '\x1f';
const T = 1_700_000_000_000;
// ITALIANO: una foto come la crea l'import (cartella "dataset", un solo lotto di import).
// ENGLISH: a photo as the import creates it (folder "dataset", a single import batch).
const foto = (nome, tags, originalTags, extra = {}) => ({
    id: nome, file: { name: nome }, tags, originalTags, backupKey: 'dataset' + SEP + nome,
    lottoImport: 'L1', cartellaImport: 'dataset', ...extra,
});
// ITALIANO: quello che fa l'effetto di App.tsx: niente da salvare = chiave tolta, altrimenti { ts, ...backup }.
// ENGLISH: what App.tsx's effect does: nothing to keep = key removed, otherwise { ts, ...backup }.
const scriviBackup = (images, ts = T) => {
    const b = B.costruisciBackup(images, [], 'dataset');
    return b ? JSON.stringify({ ts, ...b }) : null;
};
// ITALIANO: quello che fa l'import per UNA foto: trova la sua voce e decide se rimetterla.
// ENGLISH: what the import does for ONE photo: finds its entry and decides whether to put it back.
const riapri = (salvato, nomi, nome, sidecar, mtime) => {
    const letto = B.backupDellImport(salvato, 'dataset', B.folderSignature('dataset', nomi));
    const voce = letto ? letto.voci['dataset' + SEP + nome] : undefined;
    return B.tagDaRipristinare(voce, sidecar, sidecar, [], mtime, letto ? letto.ts : null);
};
const nomi = ['a.png', 'b.png'];

console.log('\n--- sessione senza modifiche, chiusa con la X ---');
{
    const images = [foto('a.png', ['1girl', 'smile'], ['1girl', 'smile']), foto('b.png', ['cat'], ['cat'])];
    const salvato = scriviBackup(images);
    dice('niente da salvare: nessun backup resta dopo la chiusura', null, salvato);
    // ITALIANO: poi un altro programma riscrive a.txt, un minuto dopo.
    // ENGLISH: then another program rewrites a.txt, one minute later.
    const r = riapri(salvato, nomi, 'a.png', ['1girl', 'smile', 'red dress'], T + 60_000);
    dice('riaprendo, restano i tag nuovi del .txt (nessun ripristino)', null, r);
}

console.log('\n--- tutto salvato, poi chiuso con la X ---');
{
    // ITALIANO: dopo "Salva" originalTags = i tag scritti: la foto non ha piu' niente di non salvato.
    // ENGLISH: after "Save" originalTags = the tags written: nothing is unsaved any more.
    const images = [foto('a.png', ['1girl', 'hat'], ['1girl', 'hat']), foto('b.png', ['cat', 'dog'], ['cat', 'dog'])];
    dice('dopo il salvataggio il backup si cancella', null, scriviBackup(images));
}

console.log('\n--- solo le foto con modifiche non salvate entrano nel backup ---');
{
    const images = [foto('a.png', ['1girl', 'hat'], ['1girl']), foto('b.png', ['cat'], ['cat'])];
    const salvato = scriviBackup(images);
    const letto = B.backupDellImport(salvato, 'dataset', B.folderSignature('dataset', nomi));
    dice('nel backup c\'e\' solo a.png', ['dataset' + SEP + 'a.png'], letto ? Object.keys(letto.voci) : null);
}

console.log('\n--- crash vero: la modifica non salvata torna (NON deve cambiare) ---');
{
    const images = [foto('a.png', ['1girl', 'smile', 'hat'], ['1girl', 'smile']), foto('b.png', ['cat'], ['cat'])];
    const salvato = scriviBackup(images);
    const r = riapri(salvato, nomi, 'a.png', ['1girl', 'smile'], T - 3_600_000);
    dice('a.png riprende i tag non salvati', ['1girl', 'smile', 'hat'], r);
    dice('b.png resta com\'e\'', null, riapri(salvato, nomi, 'b.png', ['cat'], T - 3_600_000));
}

console.log('\n--- crash, ma nel frattempo il .txt e\' stato riscritto da un altro programma ---');
{
    const images = [foto('a.png', ['1girl', 'smile', 'hat'], ['1girl', 'smile']), foto('b.png', ['cat'], ['cat'])];
    const salvato = scriviBackup(images);
    // ITALIANO: la data del file non aiuta (copia che conserva le date, orologio del NAS): decide il contenuto.
    // ENGLISH: the file date does not help (a copy that keeps dates, a NAS clock): the content decides.
    const r = riapri(salvato, nomi, 'a.png', ['1girl', 'smile', 'red dress'], T - 3_600_000);
    dice('vince il .txt piu\' nuovo: nessun ripristino', null, r);
}

console.log('\n--- una foto nel cestino non entra nel backup (NON deve cambiare) ---');
{
    const images = [foto('a.png', ['1girl', 'hat'], ['1girl'], { isTrashed: true }), foto('b.png', ['cat', 'dog'], ['cat'])];
    const salvato = scriviBackup(images);
    const letto = B.backupDellImport(salvato, 'dataset', B.folderSignature('dataset', nomi));
    dice('solo b.png', ['dataset' + SEP + 'b.png'], letto ? Object.keys(letto.voci) : null);
}

console.log('\n--- backup scritto dalla versione precedente (tutte le foto, senza impronta dei tag) ---');
{
    const vecchio = JSON.stringify({
        ts: T, folder: 'dataset', signature: B.folderSignature('dataset', nomi),
        data: { ['dataset' + SEP + 'a.png']: { tags: ['1girl', 'smile'] }, ['dataset' + SEP + 'b.png']: { tags: ['cat', 'hat'] } },
    });
    dice('.txt riscritto DOPO il backup: vince il .txt', null, riapri(vecchio, nomi, 'a.png', ['1girl', 'smile', 'red dress'], T + 60_000));
    dice('.txt piu\' vecchio del backup: il recupero funziona ancora', ['cat', 'hat'], riapri(vecchio, nomi, 'b.png', ['cat'], T - 60_000));
    dice('entro 2 secondi (dischi FAT e di rete) conta come piu\' vecchio', ['cat', 'hat'], riapri(vecchio, nomi, 'b.png', ['cat'], T + 1_500));
}

process.exit(esito());
