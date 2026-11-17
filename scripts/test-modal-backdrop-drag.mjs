// ITALIANO: Pannello dei tag del progetto, Statistiche e visualizzatore si chiudevano se si premeva
//           il mouse DENTRO (per esempio selezionando il testo di una casella) e lo si rilasciava
//           sullo sfondo scuro: Chromium manda il click all'antenato comune, cioe' allo sfondo, e il
//           suo onClick chiudeva la finestra (il testo scritto andava perso).
//           Ora lo sfondo chiude solo se ANCHE la pressione e' partita dallo sfondo.
//           Prova: (1) la logica vera (src/utils/backdropClose.ts) con eventi finti che imitano
//           Chromium; (2) i tre sfondi veri (App.tsx e Lightbox.tsx) la usano e non chiudono piu'
//           con un onClick senza condizioni; i tasti X restano.
// ENGLISH: The project tags panel, Statistics and the viewer closed when the mouse was pressed
//          INSIDE (e.g. selecting the text of a field) and released on the dark backdrop: Chromium
//          sends the click to the common ancestor, the backdrop, whose onClick closed the window.
//          Now the backdrop closes only if the press ALSO started on the backdrop.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let errori = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK' : 'NO'}  ${msg}`); if (!cond) errori++; };

// ---------------------------------------------------------------------------------------------
// 1. Logica (modulo vero, Node toglie i tipi da solo)
// ---------------------------------------------------------------------------------------------
let gestoriSfondo = null;
try {
    ({ gestoriSfondo } = await import(pathToFileURL(path.join(radice, 'src/utils/backdropClose.ts')).href));
} catch (e) {
    console.log('     modulo non caricato: ' + (e && e.code ? e.code : e));
}
ok(typeof gestoriSfondo === 'function', 'src/utils/backdropClose.ts esporta gestoriSfondo');

if (typeof gestoriSfondo === 'function') {
    const sfondo = { nome: 'sfondo' };
    const riquadro = { nome: 'riquadro' };
    const casella = { nome: 'casella' };
    const prova = (descrizione, sequenza, attesa) => {
        let chiusure = 0;
        const premuto = { current: false };
        const g = gestoriSfondo(premuto, () => { chiusure++; });
        // ITALIANO: i gestori vengono rifatti a ogni disegno (come in React): usa sempre gli ultimi.
        // ENGLISH: handlers are rebuilt at every render (as in React): always use the latest.
        let attuali = g;
        for (const [tipo, bersaglio] of sequenza) {
            if (tipo === 'disegno') { attuali = gestoriSfondo(premuto, () => { chiusure++; }); continue; }
            const e = { target: bersaglio, currentTarget: sfondo };
            if (tipo === 'giu') attuali.onMouseDownCapture(e);
            else attuali.onClick(e);
        }
        ok(chiusure === attesa, `${descrizione}: chiusure ${chiusure}, attese ${attesa}`);
    };
    // ITALIANO: Chromium: premuto in A e rilasciato in B -> click sull'antenato comune.
    //           Premuto nella casella, rilasciato sullo sfondo -> click con target = sfondo.
    prova('premuto nella casella, rilasciato sullo sfondo (selezione del testo)', [['giu', casella], ['click', sfondo]], 0);
    prova('premuto sul riquadro, rilasciato sullo sfondo', [['giu', riquadro], ['click', sfondo]], 0);
    prova('premuto e rilasciato sullo sfondo (clic fuori vero)', [['giu', sfondo], ['click', sfondo]], 1);
    prova('premuto sullo sfondo, disegno in mezzo, rilasciato sullo sfondo', [['giu', sfondo], ['disegno'], ['click', sfondo]], 1);
    prova('trascinamento interno, poi un clic fuori vero', [['giu', casella], ['click', sfondo], ['giu', sfondo], ['click', sfondo]], 1);
    prova('clic fuori vero, poi trascinamento dall\'interno', [['giu', sfondo], ['click', sfondo], ['giu', casella], ['click', sfondo]], 1);
    // ITALIANO: un click senza pressione registrata (per esempio dopo una pressione fermata altrove)
    //           non chiude: meglio una finestra che resta aperta di un testo perso.
    prova('click sullo sfondo senza pressione prima', [['click', sfondo]], 0);
    prova('pressione sullo sfondo, click che arriva da dentro (target diverso)', [['giu', sfondo], ['click', casella]], 0);
}

// ---------------------------------------------------------------------------------------------
// 2. I tre sfondi veri
// ---------------------------------------------------------------------------------------------
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const lightbox = fs.readFileSync(path.join(radice, 'src/components/Lightbox.tsx'), 'utf8');

const rigaSfondo = (testo, dopo) => {
    const i = testo.indexOf(dopo);
    if (i < 0) return '';
    const j = testo.indexOf('<div', i);
    // ITALIANO: tutta la riga (dentro ci sono delle "=>": non fermarsi al primo '>').
    return testo.slice(j, testo.indexOf('\n', j));
};
const pannello = rigaSfondo(app, '{isGlobalTagManagerOpen && (');
const statistiche = rigaSfondo(app, '{isStatsOpen && (');
const visore = rigaSfondo(lightbox.slice(lightbox.indexOf('const animClass')), 'return (');

for (const [nome, riga] of [['pannello dei tag del progetto', pannello], ['Statistiche', statistiche], ['visualizzatore', visore]]) {
    ok(/fixed inset-0/.test(riga), `${nome}: trovato lo sfondo (${riga.slice(0, 60)}...)`);
    ok(!/onClick=\{\s*(\(\)\s*=>\s*set\w+\(false\)|onClose)\s*\}/.test(riga), `${nome}: lo sfondo non chiude piu' con un onClick senza condizioni`);
    ok(/\{\s*\.\.\.\s*\w+\s*\}/.test(riga), `${nome}: lo sfondo usa i gestori di gestoriSfondo/useChiusuraSfondo`);
}
ok(/useChiusuraSfondo\(\(\)\s*=>\s*setIsGlobalTagManagerOpen\(false\)\)/.test(app), 'App.tsx: il pannello dei tag chiude con useChiusuraSfondo');
ok(/useChiusuraSfondo\(\(\)\s*=>\s*setIsStatsOpen\(false\)\)/.test(app), 'App.tsx: le Statistiche chiudono con useChiusuraSfondo');
ok(/useChiusuraSfondo\(onClose\)/.test(lightbox), 'Lightbox.tsx: il visualizzatore chiude con useChiusuraSfondo');
// ITALIANO: i tasti X restano (chiudono con un clic normale).
ok(/<button onClick=\{\(\) => setIsGlobalTagManagerOpen\(false\)\}/.test(app), 'pannello dei tag: la X chiude ancora');
ok(/<button onClick=\{\(\) => setIsStatsOpen\(false\)\}/.test(app), 'Statistiche: la X chiude ancora');
ok(/onClick=\{onClose\} title=\{t\.close\}/.test(lightbox), 'visualizzatore: la X chiude ancora');
// ITALIANO: gli hook stanno in cima al componente, non dentro un ramo condizionale del JSX.
const iApp = app.indexOf('useChiusuraSfondo(() => setIsGlobalTagManagerOpen(false))');
const iReturnApp = app.indexOf('{isGlobalTagManagerOpen && (');
ok(iApp > 0 && iApp < iReturnApp && !/^\s*\{/.test(app.slice(app.lastIndexOf('\n', iApp) + 1, iApp)), 'App.tsx: hook chiamato fuori dal JSX');
const iLb = lightbox.indexOf('useChiusuraSfondo(onClose)');
ok(iLb > 0 && iLb < lightbox.indexOf('if (!image) return null;'), 'Lightbox.tsx: hook chiamato prima del primo return');

console.log(errori === 0 ? 'ESITO: tutto a posto' : `ESITO: ${errori} controlli falliti`);
process.exit(errori === 0 ? 0 : 1);
