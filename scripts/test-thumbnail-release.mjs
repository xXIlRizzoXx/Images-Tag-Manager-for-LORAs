/* ITALIANO: PROVA CHE LE ANTEPRIME DEL PROGETTO VENGONO LIBERATE TUTTE ALLA CHIUSURA
   Le anteprime della galleria sono immagini in memoria (blob:) che restano occupate finche' non le
   si libera. "Chiudi progetto" e "Reset" liberavano solo quelle delle foto ancora nell'elenco: le
   foto chiuse con la X o cancellate per sempre non c'erano piu', quindi le loro anteprime restavano
   in memoria per tutta la sessione (1500 foto chiuse = decine di MB, a ogni progetto), mentre il
   commento di handleCloseImage prometteva che venivano liberate in blocco alla chiusura. Non si
   possono liberare subito: Ctrl+Z riporta la foto chiusa, e deve tornare con la sua immagine.
   La regola: ogni anteprima creata per il progetto (import e ricarico dopo un ritocco esterno) si
   annota, e Chiudi progetto e Reset le liberano TUTTE; l'elenco riparte vuoto per il progetto dopo.
   Si eseguono i testi VERI di releaseThumbnails, handleCloseImage, closeProjectNow e
   handleResetProject presi da src/App.tsx (compilati con esbuild); dove si annotano le anteprime
   (dentro l'import e il ricarico, troppo grandi da eseguire qui) lo si controlla sul sorgente.
   Uso:  node scripts/test-thumbnail-release.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST THAT EVERY PROJECT THUMBNAIL IS RELEASED ON CLOSE
   Gallery thumbnails are in-memory images (blob:) that stay allocated until released. "Close
   project" and "Reset" released only those of the photos still in the list: photos closed with the
   X or deleted for good were gone from it, so their thumbnails stayed in memory for the whole
   session (1500 closed photos = tens of MB, per project), while handleCloseImage's comment promised
   they were freed in bulk on close. They cannot be released at once: Ctrl+Z brings a closed photo
   back, and it must come back with its image.
   The rule: every thumbnail made for the project (import and reload after an outside retouch) is
   recorded, and Close project and Reset release ALL of them; the record starts empty for the next
   project.
   The REAL text of releaseThumbnails, handleCloseImage, closeProjectNow and handleResetProject
   taken from src/App.tsx is run (compiled with esbuild); where the thumbnails are recorded (inside
   the import and the reload, too big to run here) is checked on the source.
   Usage:  node scripts/test-thumbnail-release.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');

const ritaglia = (intestazione, obbligatoria = true) => {
    const inizio = sorgente.indexOf(intestazione);
    const chiusura = /\r?\n    \}(?:, \[t\]\))?;\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) {
        if (!obbligatoria) return '';
        console.log('NO  non trovato in src/App.tsx: ' + intestazione.trim());
        process.exit(1);
    }
    return sorgente.slice(inizio, fine.index + fine[0].length);
};
const PEZZI = ['releaseThumbnails', 'handleCloseImage', 'closeProjectNow', 'handleResetProject'];
// ITALIANO: una funzione che il codice di prima non aveva: se manca si va avanti senza.
// ENGLISH: a function the previous code did not have: when missing, carry on without it.
const FACOLTATIVE = ['liberaAnteprimeProgetto'];
const testi = PEZZI.map(n => ritaglia(`    const ${n} = `));
const facoltative = FACOLTATIVE.filter(n => { const x = ritaglia(`    const ${n} = `, false); if (x) testi.push(x); return Boolean(x); });
const js = (await esbuild.transform(testi.join('\n'), { loader: 'ts' })).code;
const NOMI = ['images', 'ultimoSvuotamento', 'imagesRef', 'fotoChiuseRef', 'anteprimeProgettoRef', 'aiCancelRequestedRef', 'aiAbortControllerRef',
    'setImages', 'setUltimoSvuotamento', 'setGlobalTriggers', 'setSelectedForBulk', 'setStagedBulkTags', 'setCustomProjectTags', 'setDirHandle',
    'setSelectedImageId', 'setCopiedTags', 'setHistory', 'setHistoryIndex', 'setAiCancelRequested', 'setConfirmDialog',
    'showNotification', 'soundManager', 't', 'useCallback', 'localStorage', 'URL'];
const fabbrica = new Function(...NOMI, js + '\nreturn { ' + [...PEZZI, ...facoltative].join(', ') + ' };');

/* ITALIANO: un progetto finto con `n` foto importate. L'import vero annota ogni anteprima
   nell'elenco del progetto: qui lo si fa a mano (che l'import lo faccia davvero lo dice il
   controllo sul sorgente in fondo). `vive()` = anteprime create e non ancora liberate.
   ENGLISH: a fake project with `n` imported photos. The real import records every thumbnail in the
   project's list: here it is done by hand (that the import really does it is what the source check
   at the bottom says). `vive()` = thumbnails created and not released yet. */
const progetto = (n) => {
    const create = new Set(), liberate = new Set();
    const nuova = (id) => { const u = 'blob:finto/' + id; create.add(u); return u; };
    const immagini = Array.from({ length: n }, (_, i) => ({ id: 'f' + i, file: { name: 'f' + i + '.png' }, thumb: nuova('f' + i), tags: ['x'], originalTags: ['x'] }));
    const s = { images: immagini, ultimoSvuotamento: null, dialogo: null };
    const refs = {
        imagesRef: { current: immagini }, fotoChiuseRef: { current: new Map() }, anteprimeProgettoRef: { current: new Set(immagini.map(i => i.thumb)) },
        aiCancelRequestedRef: { current: false }, aiAbortControllerRef: { current: null },
    };
    const nulla = () => { };
    const render = () => fabbrica(s.images, s.ultimoSvuotamento, refs.imagesRef, refs.fotoChiuseRef, refs.anteprimeProgettoRef,
        refs.aiCancelRequestedRef, refs.aiAbortControllerRef,
        (f) => { s.images = typeof f === 'function' ? f(s.images) : f; refs.imagesRef.current = s.images; },
        (v) => { s.ultimoSvuotamento = v; }, nulla, nulla, nulla, nulla, nulla, nulla, nulla, nulla, nulla, nulla,
        (d) => { s.dialogo = d; }, nulla, { pop() { }, chime() { }, click() { } }, {}, (f) => f,
        { removeItem() { } }, { revokeObjectURL: (u) => liberate.add(u) });
    return { s, refs, render, nuova, vive: () => [...create].filter(u => !liberate.has(u)).length, liberate };
};

console.log('\n--- 20 foto, 15 chiuse con la X, poi "Chiudi progetto" ---');
{
    const p = progetto(20);
    for (let i = 0; i < 15; i++) p.render().handleCloseImage('f' + i);
    dice('la X non libera l\'anteprima (Ctrl+Z deve poter riportare la foto con la sua immagine)', 20, p.vive());
    p.render().closeProjectNow();
    dice('chiuso il progetto non resta nessuna anteprima in memoria', 0, p.vive());
    // ITALIANO: il progetto dopo parte con l'elenco vuoto: chiudere quello vecchio non tocca il nuovo.
    // ENGLISH: the next project starts with an empty list: closing the old one does not touch the new.
    dice('l\'elenco delle anteprime riparte vuoto per il progetto dopo', 0, p.refs.anteprimeProgettoRef.current.size);
}

console.log('\n--- 10 foto, 3 cancellate per sempre, poi "Reset" ---');
{
    const p = progetto(10);
    // ITALIANO: la cancellazione definitiva le toglie dall'elenco senza liberarne l'anteprima.
    // ENGLISH: the permanent delete drops them from the list without releasing their thumbnail.
    p.s.images = p.s.images.slice(3);
    p.refs.imagesRef.current = p.s.images;
    p.render().handleResetProject();
    p.s.dialogo.onConfirm();
    dice('dopo il Reset non resta nessuna anteprima in memoria', 0, p.vive());
}

console.log('\n--- src/App.tsx: dove nascono le anteprime ---');
{
    const iNuove = sorgente.indexOf('const newImages = [];');
    const iConsegna = iNuove < 0 ? -1 : sorgente.indexOf('setImages(prev =>', iNuove);
    const tratto = iConsegna < 0 ? '' : sorgente.slice(iNuove, iConsegna);
    dice('l\'import annota le anteprime delle foto nuove prima di consegnarle', true, /anteprimeProgettoRef\.current\.add\(/.test(tratto));
    const iRicarico = sorgente.indexOf('thumbData = await generateThumbnail(fresh)');
    const ricarico = iRicarico < 0 ? '' : sorgente.slice(iRicarico, sorgente.indexOf('showNotification(t.imageReloaded', iRicarico));
    dice('il ricarico dopo un ritocco esterno annota la nuova anteprima', true, /anteprimeProgettoRef\.current\.add\(thumbData\.url\)/.test(ricarico));
    dice('generateThumbnail si chiama solo in quei due punti', 2, (sorgente.match(/generateThumbnail\(/g) || []).length);
}

process.exit(esito());
