/* ITALIANO: PROVA DELLA RILETTURA DEI .txt PRIMA DI SALVARE: IN PARALLELO E CON LA BARRA CHE AVANZA
   Prima di scrivere, «Salva Modifiche» rilegge i .txt delle foto da salvare per vedere se un altro
   programma li ha cambiati (confermaSovrascrittura). La rilettura era in serie, un file alla volta,
   con la barra «Salvataggio in corso...» ferma a 0%: con migliaia di foto o una cartella di rete
   potevano passare decine di secondi senza nessun avanzamento, e il programma sembrava bloccato. Ora
   si rilegge a gruppi di 6 in parallelo e la barra avanza durante la rilettura (prima meta'), poi la
   scrittura la porta da meta' a 100%.
   Casi vicini che non devono cambiare: i nomi nella domanda «Sovrascrivere?» restano nell'ordine
   delle foto anche se le letture finiscono in un altro ordine; durante la rilettura la barra non
   arriva mai a 100% (sarebbe «Completato»); il visualizzatore («Salva file .txt») usa lo stesso
   controllo senza toccare la barra (che durante un import e' quella dell'import); tutti i .txt si
   scrivono.
   Si eseguono i testi VERI di handleSaveChanges, performSave e confermaSovrascrittura (undo-harness.mjs)
   con una cartella finta lenta.
   Uso:  node scripts/test-save-reread-progress.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE .txt RE-READ BEFORE SAVING: IN PARALLEL AND WITH THE BAR MOVING
   Before writing, "Save Changes" reads back the .txt files of the photos to save to see whether
   another program changed them (confermaSovrascrittura). The re-read was serial, one file at a time,
   with the "Saving..." bar stuck at 0%: with thousands of photos or a network folder tens of seconds
   could pass with no progress, and the program looked frozen. Now it reads in groups of 6 in
   parallel and the bar moves during the re-read (first half), then the write takes it from half to
   100%.
   Neighbouring cases that must not change: the names in the "Overwrite?" question stay in photo order
   even when the reads finish in another order; during the re-read the bar never reaches 100% (that
   would be "Completed"); the viewer ("Save .txt file") uses the same check without touching the bar
   (which during an import belongs to the import); every .txt is written.
   The REAL texts of handleSaveChanges, performSave and confermaSovrascrittura (undo-harness.mjs) run
   with a slow fake folder.
   Usage:  node scripts/test-save-reread-progress.mjs      (exits with code 1 if anything is off) */

import { creaApp, t } from './undo-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const dorme = (ms) => new Promise(ok => setTimeout(ok, ms));

// ITALIANO: una cartella che si rilegge con calma: ogni lettura dura `ritardo(nome)` ms; conta quante
//           letture sono in volo insieme e annota le scritture in `log` (lo stesso elenco della barra).
// ENGLISH: a folder that is read back slowly: each read lasts `ritardo(nome)` ms; it counts how many
//          reads are in flight together and records the writes in `log` (the same list as the bar).
const cartellaLenta = (voci, ritardo) => {
    const disco = new Map(Object.entries(voci));
    const nonCe = () => new DOMException('not found', 'NotFoundError');
    const c = { disco, name: 'dataset', inVolo: 0, massimo: 0, log: [] };
    c.getFileHandle = async (nome, o) => {
        if (!disco.has(nome) && !(o && o.create)) throw nonCe();
        return {
            getFile: async () => {
                c.inVolo++; c.massimo = Math.max(c.massimo, c.inVolo);
                await dorme(ritardo(nome));
                c.inVolo--;
                if (!disco.has(nome)) throw nonCe();
                return new File([disco.get(nome)], nome, { type: 'text/plain' });
            },
            createWritable: async () => { let s = ''; return { write: async (x) => { s += x; }, close: async () => { disco.set(nome, s); c.log.push(['scrive', nome]); } }; },
        };
    };
    return c;
};
const N = 20;
const nome = (i) => 'p' + String(i).padStart(2, '0');
const prepara = (ritardo) => {
    const voci = {};
    for (let i = 0; i < N; i++) { voci[nome(i) + '.png'] = 'x'; voci[nome(i) + '.txt'] = 'cat,'; }
    const c = cartellaLenta(voci, ritardo);
    const app = creaApp(Array.from({ length: N }, (_, i) => ({
        id: nome(i), file: { name: nome(i) + '.png' }, thumb: 'blob:' + i, tags: ['cat'], originalTags: ['cat'], isTrashed: false, dirHandle: c,
    })), { trigger: ['ohwx'] });
    c.log = app.eventi;
    return { c, app };
};
const conTrigger = (app) => app.modifica(prev => prev.map(i => ({ ...i, tags: ['ohwx', ...i.tags] })));

console.log('\n--- 20 foto da salvare, nessun .txt cambiato da fuori ---');
{
    const { c, app } = prepara(() => 10);
    app.importa(); await app.attendi();
    conTrigger(app); await app.attendi();
    const ok = await app.render().handleSaveChanges();
    await dorme(20);
    const iScrive = app.eventi.findIndex(([k]) => k === 'scrive');
    const barraPrima = app.eventi.slice(0, iScrive < 0 ? app.eventi.length : iScrive).filter(([k]) => k === 'barra').map(([, v]) => v);
    const barra = app.eventi.filter(([k]) => k === 'barra').map(([, v]) => v);
    dice('le letture vanno in parallelo (piu\' di 1 insieme, al massimo 6)', true, c.massimo > 1 && c.massimo <= 6, `in volo insieme: ${c.massimo}`);
    dice('la barra avanza gia\' durante la rilettura (valori sopra 0 prima della prima scrittura)', true, barraPrima.some(v => v > 0), JSON.stringify(barraPrima));
    dice('...senza mai tornare indietro e senza arrivare a 100% («Completato») prima di scrivere', true,
        barraPrima.every((v, i) => i === 0 || v >= barraPrima[i - 1]) && barraPrima.every(v => v < 100), JSON.stringify(barraPrima));
    dice('...e la scrittura non la riporta a 0: riparte da dove era arrivata', true,
        barra.length > 0 && barra.every((v, i) => i === 0 || v >= barra[i - 1]), JSON.stringify(barra));
    dice('la barra finisce a 100% e Salva torna true', [100, true], [barra[barra.length - 1], ok]);
    dice('tutti i 20 .txt scritti', N, [...c.disco.entries()].filter(([k, v]) => k.endsWith('.txt') && v === 'ohwx, cat,').length);
}

console.log('\n--- due .txt cambiati da fuori, letture che finiscono in un altro ordine ---');
{
    // ITALIANO: le foto dopo leggono piu' in fretta: l'ordine di fine e' rovesciato.
    // ENGLISH: later photos read faster: the finishing order is reversed.
    const { c, app } = prepara((n) => 30 - Number(n.slice(1, 3)));
    app.importa(); await app.attendi();
    c.disco.set('p03.txt', '1girl, outdoors,');
    c.disco.set('p17.txt', 'dog,');
    conTrigger(app); await app.attendi();
    const promessa = app.render().handleSaveChanges();
    let domanda = null;
    for (let i = 0; i < 200 && !domanda; i++) {
        await dorme(2);
        if (app.stato.confirmDialog && app.stato.confirmDialog.isOpen) domanda = app.stato.confirmDialog;
    }
    dice('la domanda nomina le due foto nell\'ordine della galleria', t.saveTxtChangedAskMany.replace('{n}', '2').replace('{names}', 'p03.png, p17.png'), domanda && domanda.message);
    if (domanda) domanda.onCancel();
    await promessa;
    await dorme(20);
    dice('con Annulla i due .txt restano quelli di fuori, gli altri 18 si scrivono', [true, 18],
        [c.disco.get('p03.txt') === '1girl, outdoors,' && c.disco.get('p17.txt') === 'dog,', [...c.disco.values()].filter(v => v === 'ohwx, cat,').length]);
}

console.log('\n--- il visualizzatore usa lo stesso controllo senza toccare la barra ---');
{
    const { c, app } = prepara(() => 5);
    app.importa(); await app.attendi();
    c.disco.set('p01.txt', 'dog,');
    const prima = app.eventi.length;
    const p = app.render().confermaSovrascrittura([app.fotoCon('p00'), app.fotoCon('p01')]);
    let domanda = null;
    for (let i = 0; i < 100 && !domanda; i++) {
        await dorme(2);
        if (app.stato.confirmDialog && app.stato.confirmDialog.isOpen) domanda = app.stato.confirmDialog;
    }
    if (domanda) domanda.onCancel();
    const esclusi = await p;
    dice('trova il .txt cambiato (p01) e nessun valore dato alla barra', [['p01'], []],
        [[...esclusi], app.eventi.slice(prima).filter(([k]) => k === 'barra')]);
}

process.exit(esito());
