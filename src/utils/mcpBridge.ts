// ITALIANO: GLI STRUMENTI MCP, DAL LATO DELLA FINESTRA.
//   Il server MCP (electron/mcp-server.src.mjs) non ha le foto: gira ogni domanda di un'AI
//   esterna alla finestra, e qui si risponde con i dati che l'app ha in memoria. Le modifiche ai
//   tag passano dalla stessa strada di quelle fatte a mano: entrano nella cronologia (Ctrl+Z) e
//   restano "da salvare" finche' l'utente non preme Salva Modifiche. Non c'e' niente che scriva
//   sul disco (decisione del proprietario, 15/10/2026).
//   Le regole sono quelle di sempre: trigger word prima e mai tolte da qui, poi ordine
//   alfabetico; tag che differiscono solo per le maiuscole uniti tenendo la grafia gia' presente;
//   una virgola dentro un tag lo divide in due (nel .txt la virgola separa i tag).
// ENGLISH: THE MCP TOOLS, ON THE WINDOW'S SIDE.
//   The MCP server holds no photos: it forwards every question from an external AI to the window,
//   and here the answer comes from what the app holds in memory. Tag changes go the same way as
//   hand-made ones: they enter the history (Ctrl+Z) and stay "unsaved" until the user presses
//   Save Changes. Nothing here writes to disk (owner's decision, 15/10/2026). The usual rules
//   apply: trigger words first and never removed from here, then alphabetical; tags differing only
//   in case merged, keeping the spelling already there; a comma inside a tag splits it in two (in
//   the .txt the comma separates tags).
import { uniqueTagsIgnoringCase } from './tagCase';
import { txtNonLettoInVigore } from './sidecarTags';

export type FotoMcp = {
    id: string;
    file?: { name?: string } | null;
    tags: string[];
    originalTags?: string[];
    baseTxtNonLetto?: string[];
    isTrashed?: boolean;
    cartellaImport?: string;
    cartellaRel?: string;
};
export type ContestoMcp = {
    foto: () => FotoMcp[];
    trigger: () => string[];
    // ITALIANO: scrive i nuovi tag (gia' puliti e ordinati) delle foto indicate, nel programma.
    // ENGLISH: writes the new tags (already cleaned and ordered) of the given photos, in the program.
    applica: (nuovi: Map<string, string[]>) => void;
    immagine: (id: string) => Promise<{ data: string; mimeType: string } | null>;
};
export type RispostaMcp = {
    risultato?: unknown;
    errore?: string;
    immagine?: { data: string; mimeType: string };
    info?: unknown;
    // ITALIANO: quante foto hanno cambiato tag (per l'avviso nella finestra).
    // ENGLISH: how many photos changed tags (for the notice in the window).
    cambiate?: number;
};

const TAG_MAX = 200;
const LIMITE_STANDARD = 100;
const LIMITE_MAX = 500;
const NOTA_SALVA = 'Changed in the program only, not saved to disk yet: the user reviews them and presses "Save Changes".';

export const pulisciTag = (tags: unknown): string[] => {
    if (!Array.isArray(tags)) return [];
    const fuori: string[] = [];
    for (const t of tags) {
        for (const pezzo of String(t ?? '').split(',')) {
            const pulito = pezzo.replace(/\s+/g, ' ').trim().slice(0, TAG_MAX);
            if (pulito) fuori.push(pulito);
        }
    }
    return fuori;
};

export const ordinaTag = (tags: string[], trigger: string[]): string[] => {
    const unici = uniqueTagsIgnoringCase(tags, trigger);
    return [
        ...trigger.filter(t => unici.includes(t)),
        ...unici.filter(t => !trigger.includes(t)).sort((a, b) => a.localeCompare(b)),
    ];
};

const stessi = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
// ITALIANO: toLowerCase e non toLocaleLowerCase, come chiave in tagCase.ts: con Windows in turco o azero
//           la I maiuscola diventerebbe una i senza punto e "Indoor" non sarebbe piu' "indoor".
// ENGLISH: toLowerCase, not toLocaleLowerCase, like chiave in tagCase.ts: with Windows in Turkish or
//          Azeri the capital I would become a dotless i and "Indoor" would no longer be "indoor".
const minuscolo = (s: string) => s.toLowerCase();
const nomeDi = (f: FotoMcp) => String((f.file && f.file.name) || f.id);
const cartellaDi = (f: FotoMcp) => [f.cartellaImport, f.cartellaRel].filter(Boolean).join('/');
const intero = (v: unknown, base: number, min: number, max: number) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : base;
    return Math.min(max, Math.max(min, n));
};
const elencoId = (v: unknown): string[] => (Array.isArray(v) ? v.map(x => String(x ?? '')).filter(Boolean) : []);

export const eseguiStrumentoMcp = async (strumento: string, argomenti: Record<string, unknown>, ctx: ContestoMcp): Promise<RispostaMcp> => {
    const args = argomenti && typeof argomenti === 'object' ? argomenti : {};
    const visibili = ctx.foto().filter(f => !f.isTrashed);
    const trigger = ctx.trigger();
    const perId = new Map(visibili.map(f => [f.id, f] as const));

    if (strumento === 'list_photos') {
        const richiesti = pulisciTag(args.tags).map(minuscolo);
        const soloSenza = args.untagged_only === true;
        const scelte = visibili.filter(f => {
            const tag = f.tags.map(minuscolo);
            if (richiesti.some(r => !tag.includes(r))) return false;
            // ITALIANO: "senza tag" = nessun tag oltre alle trigger word (che hanno tutte). Una foto il cui
            //           .txt non si e' potuto leggere all'import non conta come senza tag, come per "Salta foto
            //           gia' taggate": Salva non ci scrive sopra, quindi il lavoro dell'AI andrebbe perso.
            // ENGLISH: "untagged" = no tag besides the trigger words (which all photos have). A photo whose
            //          .txt could not be read at import does not count as untagged, as for "Skip already-tagged
            //          photos": Save does not write over it, so the AI's work would be lost.
            if (soloSenza && (txtNonLettoInVigore(f) || f.tags.some(t => !trigger.includes(t)))) return false;
            return true;
        });
        const offset = intero(args.offset, 0, 0, Number.MAX_SAFE_INTEGER);
        const limit = intero(args.limit, LIMITE_STANDARD, 1, LIMITE_MAX);
        return {
            risultato: {
                total: scelte.length,
                offset,
                photos: scelte.slice(offset, offset + limit).map(f => ({
                    id: f.id,
                    name: nomeDi(f),
                    folder: cartellaDi(f),
                    tags: f.tags,
                    unsaved: !stessi(f.tags, f.originalTags || []),
                })),
                trigger_words: trigger,
            },
        };
    }

    if (strumento === 'list_project_tags') {
        const conteggi = new Map<string, number>();
        for (const f of visibili) for (const t of f.tags) conteggi.set(t, (conteggi.get(t) || 0) + 1);
        return {
            risultato: {
                photos: visibili.length,
                trigger_words: trigger,
                tags: [...conteggi.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count })),
            },
        };
    }

    if (strumento === 'get_photo') {
        const f = perId.get(String(args.id ?? ''));
        if (!f) return { errore: `No open photo has id "${String(args.id ?? '')}". Use list_photos to get the ids.` };
        const info = { id: f.id, name: nomeDi(f), folder: cartellaDi(f), tags: f.tags };
        let immagine: { data: string; mimeType: string } | null = null;
        try { immagine = await ctx.immagine(f.id); } catch (_) { immagine = null; }
        if (!immagine) return { errore: `The photo "${nomeDi(f)}" cannot be shown (format not supported, such as TIFF or HEIC, or file no longer readable). Its tags: ${f.tags.join(', ') || '(none)'}.` };
        return { immagine, info };
    }

    if (strumento === 'set_tags' || strumento === 'add_tags' || strumento === 'remove_tags') {
        const ids = strumento === 'set_tags' ? elencoId([args.id]) : elencoId(args.ids);
        const tags = pulisciTag(args.tags);
        if (ids.length === 0) return { errore: 'No photo id given.' };
        if (strumento !== 'set_tags' && tags.length === 0) return { errore: 'No tag given.' };
        const nonTrovate = ids.filter(id => !perId.has(id));
        const nuovi = new Map<string, string[]>();
        const triggerNonTolte = new Set<string>();
        for (const id of ids) {
            const f = perId.get(id);
            if (!f || nuovi.has(id)) continue;
            let prossimi: string[];
            if (strumento === 'set_tags') {
                // ITALIANO: le trigger word che la foto ha restano anche se l'AI non le ripete.
                // ENGLISH: the trigger words the photo has stay even if the AI does not repeat them.
                prossimi = [...f.tags.filter(t => trigger.includes(t)), ...tags];
            } else if (strumento === 'add_tags') {
                prossimi = [...f.tags, ...tags];
            } else {
                const via = new Set(tags.map(minuscolo));
                prossimi = f.tags.filter(t => {
                    if (!via.has(minuscolo(t))) return true;
                    if (trigger.includes(t)) { triggerNonTolte.add(t); return true; }
                    return false;
                });
            }
            const ordinati = ordinaTag(prossimi, trigger);
            if (!stessi(ordinati, f.tags)) nuovi.set(id, ordinati);
        }
        if (nuovi.size > 0) ctx.applica(nuovi);
        return {
            cambiate: nuovi.size,
            risultato: {
                changed: nuovi.size,
                unchanged: ids.length - nonTrovate.length - nuovi.size,
                ...(nonTrovate.length ? { not_found: nonTrovate } : {}),
                ...(triggerNonTolte.size ? { trigger_words_kept: [...triggerNonTolte] } : {}),
                ...(strumento === 'set_tags' && nuovi.size ? { tags: nuovi.get(ids[0]) } : {}),
                note: NOTA_SALVA,
            },
        };
    }

    return { errore: `Unknown tool "${strumento}".` };
};

// ITALIANO: la foto per l'AI esterna: ridisegnata su una tela (lato massimo 1024 px, JPEG), cosi'
//           NON porta con se' i dati nascosti del file (GPS, autore, numero di serie). Chromium
//           raddrizza la foto secondo l'orientamento EXIF prima di disegnarla. null se il formato
//           non si puo' leggere (TIFF, HEIC) o il file non c'e' piu'.
// ENGLISH: the photo for the external AI: redrawn on a canvas (longest side 1024 px, JPEG), so it
//          does NOT carry the file's hidden data (GPS, author, serial number). Chromium turns the
//          photo upright from its EXIF orientation before drawing. null when the format cannot be
//          read (TIFF, HEIC) or the file is gone.
export const fotoPerMcp = async (file: Blob | null | undefined, lato: number = 1024): Promise<{ data: string; mimeType: string } | null> => {
    if (!file || typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
    let bitmap: ImageBitmap;
    try { bitmap = await createImageBitmap(file); } catch (_) { return null; }
    try {
        const scala = Math.min(1, lato / Math.max(bitmap.width, bitmap.height, 1));
        const w = Math.max(1, Math.round(bitmap.width * scala));
        const h = Math.max(1, Math.round(bitmap.height * scala));
        const tela = document.createElement('canvas');
        tela.width = w;
        tela.height = h;
        const c = tela.getContext('2d');
        if (!c) return null;
        c.fillStyle = '#ffffff';
        c.fillRect(0, 0, w, h);
        c.drawImage(bitmap, 0, 0, w, h);
        const blob = await new Promise<Blob | null>(fatto => tela.toBlob(fatto, 'image/jpeg', 0.85));
        if (!blob) return null;
        const byte = new Uint8Array(await blob.arrayBuffer());
        let binario = '';
        for (let i = 0; i < byte.length; i += 0x8000) binario += String.fromCharCode(...byte.subarray(i, i + 0x8000));
        return { data: btoa(binario), mimeType: 'image/jpeg' };
    } catch (_) {
        return null;
    } finally {
        try { bitmap.close(); } catch (_) { }
    }
};
