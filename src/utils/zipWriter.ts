/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: SCRITTURA DI UN ARCHIVIO .zip UN PEZZO ALLA VOLTA               **
**  Senza compressione (le foto sono gia' compresse), direttamente verso      **
**  il file scelto: in memoria c'e' un pezzo per volta, non il dataset.       **
**  Regole pure, senza React: le prove le eseguono da sole.                   **
**                                                                            **
**  ENGLISH: WRITING A .zip ARCHIVE ONE CHUNK AT A TIME                       **
**  No compression (photos are already compressed), straight to the chosen   **
**  file: memory holds one chunk at a time, not the dataset.                  **
**  Pure rules, no React: the tests run them on their own.                    **
**                                                                            **
*******************************************************************************
*******************************************************************************/

// ITALIANO: PERCHE' NON JSZip. JSZip, ricevuto un file, lo legge SUBITO per intero in memoria
//   (FileReader.readAsArrayBuffer, al primo await dopo zip.file) e lo tiene finche' l'archivio
//   esiste: con le foto dentro, tutto il dataset finiva in RAM prima ancora che la finestra di
//   salvataggio si chiudesse, e con qualche migliaio di foto la finestra moriva. La pausa sul
//   flusso d'uscita frenava solo la scrittura. In piu' JSZip non scrive lo ZIP64: oltre i 4 GB
//   l'archivio usciva rovinato. Qui ogni file si legge a pezzi, solo quando tocca a lui, e ogni
//   pezzo va sul disco prima di leggere il successivo.
//   Formato: ogni voce ha l'intestazione locale col bit 3 (CRC e dimensioni nel "data
//   descriptor" DOPO i dati, cosi' non serve tornare indietro nel file) e il bit 11 (nome in
//   UTF-8) quando il nome non e' ASCII; metodo 0 (nessuna compressione), come faceva JSZip con
//   streamFiles. In fondo la directory centrale; i record ZIP64 si aggiungono solo quando una
//   dimensione, una posizione o il numero delle voci non stanno nei campi da 32/16 bit.
// ENGLISH: WHY NOT JSZip. Given a file, JSZip reads it WHOLE into memory RIGHT AWAY
//   (FileReader.readAsArrayBuffer, at the first await after zip.file) and keeps it for as long as
//   the archive exists: with the photos in, the whole dataset went into RAM before the save dialog
//   had even closed, and with a few thousand photos the window died. The pause on the output
//   stream only slowed down the writing. JSZip also does not write ZIP64: past 4 GB the archive
//   came out broken. Here each file is read in chunks, only when its turn comes, and each chunk
//   goes to disk before the next one is read.
//   Format: every entry has its local header with bit 3 (CRC and sizes in the "data descriptor"
//   AFTER the data, so the file never needs rewinding) and bit 11 (UTF-8 name) when the name is not
//   ASCII; method 0 (no compression), as JSZip did with streamFiles. The central directory comes
//   last; the ZIP64 records are added only when a size, an offset or the entry count do not fit
//   the 32/16-bit fields.

export type VoceZip = {
    // ITALIANO: il percorso dentro l'archivio ("0001.png", "10_viso/img.txt").
    // ENGLISH: the path inside the archive ("0001.png", "10_face/img.txt").
    nome: string;
    // ITALIANO: un testo, un file, o una funzione che dara' il file solo quando tocca a lui.
    // ENGLISH: a text, a file, or a function that gives the file only when its turn comes.
    dati: string | Blob | (() => Promise<Blob>);
    // ITALIANO: il nome da dire all'utente se il file non si legge (quello della sua foto).
    // ENGLISH: the name to tell the user if the file cannot be read (its photo's own name).
    etichetta?: string;
};

// ITALIANO: dove vanno i byte: la destinazione aspetta ogni pezzo prima di chiedere il successivo.
// ENGLISH: where the bytes go: the destination awaits each chunk before the next one is asked for.
export type PozzoZip = { write: (pezzo: Uint8Array) => Promise<unknown> };

export type OpzioniZip = {
    // ITALIANO: byte gia' messi nell'archivio dai dati delle voci (per la barra di avanzamento).
    // ENGLISH: bytes of entry data already put into the archive (for the progress bar).
    onAvanzamento?: (byteDati: number) => void;
    // ITALIANO: solo per le prove: quanto leggere per volta, e da dove scatta lo ZIP64.
    // ENGLISH: tests only: how much to read at a time, and where ZIP64 kicks in.
    pezzo?: number;
    limite32?: number;
    limite16?: number;
    data?: Date;
};

// ITALIANO: il nome dell'errore quando il file di una voce non si legge; porta `voce` = etichetta.
// ENGLISH: the error name when an entry's file cannot be read; it carries `voce` = the label.
export const ERRORE_LETTURA_ZIP = 'ZipReadError';

const PEZZO = 4 * 1024 * 1024;
const RACCOLTA = 1024 * 1024;
const PICCOLO = 64 * 1024;

const TABELLA_CRC = (() => {
    const tab = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        tab[n] = c >>> 0;
    }
    return tab;
})();

const crc32 = (crc: number, dati: Uint8Array): number => {
    let c = (crc ^ 0xFFFFFFFF) >>> 0;
    for (let i = 0; i < dati.length; i++) c = TABELLA_CRC[(c ^ dati[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
};

// ITALIANO: un piccolo scrittore di campi little-endian; i numeri da 64 bit passano per BigInt.
// ENGLISH: a small little-endian field writer; 64-bit numbers go through BigInt.
const campi = (lunghezza: number) => {
    const byte = new Uint8Array(lunghezza);
    const vista = new DataView(byte.buffer);
    let p = 0;
    const w = {
        u16: (v: number) => { vista.setUint16(p, v, true); p += 2; return w; },
        u32: (v: number) => { vista.setUint32(p, v >>> 0, true); p += 4; return w; },
        u64: (v: number) => { vista.setBigUint64(p, BigInt(v), true); p += 8; return w; },
        byte: (b: Uint8Array) => { byte.set(b, p); p += b.length; return w; },
        fine: () => byte,
    };
    return w;
};

const orarioDos = (d: Date): { ora: number; giorno: number } => {
    const anno = Math.min(Math.max(d.getFullYear(), 1980), 2107);
    return {
        ora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
        giorno: ((anno - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
};

const erroreLettura = (voce: VoceZip, causa: unknown): Error => Object.assign(
    new Error(`Cannot read ${voce.etichetta || voce.nome}: ${String((causa as any)?.message || causa)}`),
    { name: ERRORE_LETTURA_ZIP, voce: voce.etichetta || voce.nome, causa },
);

export const scriviZip = async (voci: VoceZip[], pozzo: PozzoZip, opzioni: OpzioniZip = {}): Promise<void> => {
    const pezzo = opzioni.pezzo || PEZZO;
    const L32 = opzioni.limite32 ?? 0xFFFFFFFF;
    const L16 = opzioni.limite16 ?? 0xFFFF;
    const { ora, giorno } = orarioDos(opzioni.data || new Date());
    const utf8 = new TextEncoder();

    // ITALIANO: i pezzi piccoli (intestazioni, .txt) si raccolgono e partono insieme: migliaia di
    //           scritture da pochi byte costerebbero ognuna un giro fino al disco. Quelli grandi
    //           partono subito, dopo i piccoli, cosi' l'ordine resta quello giusto.
    // ENGLISH: small pieces (headers, .txt) are gathered and sent together: thousands of writes of a
    //          few bytes would each cost a round trip to the disk. Large ones go at once, after the
    //          small ones, so the order stays right.
    let raccolti: Uint8Array[] = [];
    let inRaccolta = 0;
    let posizione = 0;
    const svuota = async () => {
        if (inRaccolta === 0) return;
        const tutto = new Uint8Array(inRaccolta);
        let p = 0;
        for (const r of raccolti) { tutto.set(r, p); p += r.length; }
        raccolti = [];
        inRaccolta = 0;
        await pozzo.write(tutto);
    };
    const emetti = async (b: Uint8Array) => {
        posizione += b.length;
        if (b.length >= PICCOLO) {
            await svuota();
            await pozzo.write(b);
            return;
        }
        raccolti.push(b);
        inRaccolta += b.length;
        if (inRaccolta >= RACCOLTA) await svuota();
    };

    const centrale: { nome: Uint8Array; flag: number; crc: number; dimensione: number; inizio: number; zip64: boolean }[] = [];

    for (const voce of voci) {
        const nome = utf8.encode(voce.nome);
        const flag = 0x0008 | (/^[\x20-\x7E]*$/.test(voce.nome) ? 0 : 0x0800);
        let testo: Uint8Array | null = null;
        let file: Blob | null = null;
        if (typeof voce.dati === 'string') testo = utf8.encode(voce.dati);
        else {
            try { file = typeof voce.dati === 'function' ? await voce.dati() : voce.dati; }
            catch (e) { throw erroreLettura(voce, e); }
        }
        const attesa = testo ? testo.length : (file as Blob).size;
        const zip64 = attesa >= L32;
        const inizio = posizione;

        const intestazione = campi(30 + nome.length + (zip64 ? 20 : 0))
            .u32(0x04034b50).u16(zip64 ? 45 : 20).u16(flag).u16(0).u16(ora).u16(giorno)
            .u32(0).u32(zip64 ? 0xFFFFFFFF : 0).u32(zip64 ? 0xFFFFFFFF : 0)
            .u16(nome.length).u16(zip64 ? 20 : 0).byte(nome);
        if (zip64) intestazione.u16(0x0001).u16(16).u64(0).u64(0);
        await emetti(intestazione.fine());

        let crc = 0;
        let letti = 0;
        if (testo) {
            crc = crc32(0, testo);
            letti = testo.length;
            await emetti(testo);
            if (opzioni.onAvanzamento) opzioni.onAvanzamento(testo.length);
        } else {
            const f = file as Blob;
            for (let da = 0; da < attesa; da += pezzo) {
                let dati: Uint8Array;
                try { dati = new Uint8Array(await f.slice(da, Math.min(da + pezzo, attesa)).arrayBuffer()); }
                catch (e) { throw erroreLettura(voce, e); }
                if (dati.length === 0) break;
                crc = crc32(crc, dati);
                letti += dati.length;
                await emetti(dati);
                if (opzioni.onAvanzamento) opzioni.onAvanzamento(dati.length);
            }
            // ITALIANO: meno byte del previsto = il file e' cambiato mentre lo si leggeva.
            // ENGLISH: fewer bytes than expected = the file changed while being read.
            if (letti !== attesa) throw erroreLettura(voce, new Error('size changed while reading'));
        }

        const descrittore = zip64
            ? campi(24).u32(0x08074b50).u32(crc).u64(letti).u64(letti)
            : campi(16).u32(0x08074b50).u32(crc).u32(letti).u32(letti);
        await emetti(descrittore.fine());
        centrale.push({ nome, flag, crc, dimensione: letti, inizio, zip64 });
    }

    const inizioCentrale = posizione;
    for (const c of centrale) {
        const grande = c.zip64 || c.dimensione >= L32;
        const lontano = c.inizio >= L32;
        const extra = (grande ? 16 : 0) + (lontano ? 8 : 0);
        const w = campi(46 + c.nome.length + (extra ? 4 + extra : 0))
            .u32(0x02014b50).u16(45).u16(grande || lontano ? 45 : 20).u16(c.flag).u16(0).u16(ora).u16(giorno)
            .u32(c.crc).u32(grande ? 0xFFFFFFFF : c.dimensione).u32(grande ? 0xFFFFFFFF : c.dimensione)
            .u16(c.nome.length).u16(extra ? 4 + extra : 0).u16(0).u16(0).u16(0).u32(0)
            .u32(lontano ? 0xFFFFFFFF : c.inizio).byte(c.nome);
        if (extra) {
            w.u16(0x0001).u16(extra);
            if (grande) w.u64(c.dimensione).u64(c.dimensione);
            if (lontano) w.u64(c.inizio);
        }
        await emetti(w.fine());
    }
    const dimensioneCentrale = posizione - inizioCentrale;
    const tante = centrale.length >= L16;
    const zip64Fine = tante || dimensioneCentrale >= L32 || inizioCentrale >= L32;
    if (zip64Fine) {
        const inizioFine64 = posizione;
        await emetti(campi(56).u32(0x06064b50).u64(44).u16(45).u16(45).u32(0).u32(0)
            .u64(centrale.length).u64(centrale.length).u64(dimensioneCentrale).u64(inizioCentrale).fine());
        await emetti(campi(20).u32(0x07064b50).u32(0).u64(inizioFine64).u32(1).fine());
    }
    await emetti(campi(22).u32(0x06054b50).u16(0).u16(0)
        .u16(tante ? 0xFFFF : centrale.length).u16(tante ? 0xFFFF : centrale.length)
        .u32(dimensioneCentrale >= L32 ? 0xFFFFFFFF : dimensioneCentrale)
        .u32(inizioCentrale >= L32 ? 0xFFFFFFFF : inizioCentrale).u16(0).fine());
    await svuota();
};
