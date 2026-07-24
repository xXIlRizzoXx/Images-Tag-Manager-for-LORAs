/******************************************************************************
**  ITALIANO: EDITOR DI TAG                                                   **
**  Apre, modifica e salva file di tag, sia .txt sia .json. Si puo' partire   **
**  da un file esistente (compreso il .txt di una singola foto) oppure da     **
**  zero. I tag si vedono tutti insieme come pillole: si aggiungono           **
**  scrivendoli e si tolgono con la X.                                        **
**                                                                            **
**  ENGLISH: TAG EDITOR                                                       **
**  Opens, edits and saves tag files, both .txt and .json. You can start from **
**  an existing file (including a single photo's .txt) or from scratch. Every **
**  tag is shown as a pill: type to add one, click the X to remove it.        **
******************************************************************************/
import { useState, useRef, useEffect } from 'react';
import { X, FilePlus2, FolderOpen, Save, Tag as TagIcon } from 'lucide-react';
import { getTagCategory, getActiveCategoryColor } from '../utils/tagCategorization';
import { translateTag } from '../utils/tagTranslation';
import { soundManager } from '../utils/soundManager';

// ITALIANO: Legge i tag da un testo. Il .json accetta sia il formato esportato
//           dall'app ({tags: [...]}) sia un semplice elenco ["a","b"]. Il .txt usa
//           virgole o a capo come separatori, come i sidecar delle foto.
// ENGLISH: Reads tags out of a text. JSON accepts both the app's exported shape
//          ({tags: [...]}) and a plain list ["a","b"]. TXT uses commas or newlines,
//          like the photo sidecars.
export const parseTagFile = (text: string, fileName: string): string[] => {
    const isJson = fileName.toLowerCase().endsWith('.json') || /^\s*[[{]/.test(text);
    let raw: unknown[] = [];
    if (isJson) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) raw = parsed;
        else if (parsed && Array.isArray(parsed.tags)) raw = [...(parsed.globalTriggers || []), ...parsed.tags];
        else throw new Error('JSON senza elenco di tag');
        // ITALIANO: i tag devono essere testo (o numeri), non oggetti/array. Senza questo controllo
        //           un elenco di oggetti diventava un unico tag "[object Object]" e, salvando, il
        //           file originale veniva distrutto senza alcun avviso.
        // ENGLISH: tags must be text (or numbers), not objects/arrays. Without this check a list of
        //          objects became a single "[object Object]" tag and, on save, the original file was
        //          destroyed with no warning.
        if (raw.some(x => x !== null && typeof x === 'object')) {
            throw new Error('JSON senza elenco di tag');
        }
    } else {
        raw = text.split(/[,\n\r]+/);
    }
    return [...new Set(
        raw.map(x => String(x).replace(/[\x00-\x1F\x7F]/g, ' ').trim()).filter(Boolean)
    )];
};

// ITALIANO: le trigger word eventualmente presenti nel formato progetto ({globalTriggers, tags}).
//           Servono a RISCRIVERLE tali e quali al salvataggio, invece di appiattirle tra i tag.
// ENGLISH: the trigger words possibly present in the project shape ({globalTriggers, tags}). Used to
//          WRITE THEM BACK unchanged on save, instead of flattening them into the plain tag list.
export const parseTagTriggers = (text: string, fileName: string): string[] => {
    const isJson = fileName.toLowerCase().endsWith('.json') || /^\s*[[{]/.test(text);
    if (!isJson) return [];
    try {
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.globalTriggers)) {
            const puliti = (parsed.globalTriggers as unknown[]).map(x => String(x).trim()).filter(Boolean);
            return [...new Set(puliti)];
        }
    } catch (_) { /* ITALIANO: gestito da parseTagFile — ENGLISH: handled by parseTagFile */ }
    return [];
};

export const serializeTagFile = (tags: string[], fileName: string, triggers: string[] = []): string => {
    if (fileName.toLowerCase().endsWith('.json')) {
        // ITALIANO: conservo la distinzione trigger/tag: le trigger ancora presenti nell'elenco
        //           restano in globalTriggers, il resto va in tags. Prima globalTriggers era sempre
        //           vuoto, quindi ri-salvare un file di progetto ne cancellava le trigger word.
        // ENGLISH: keep the trigger/tag split: triggers still present in the list stay in
        //          globalTriggers, the rest go to tags. globalTriggers used to be always empty, so
        //          re-saving a project file wiped its trigger words.
        const trig = triggers.filter(x => tags.includes(x));
        const rest = tags.filter(x => !trig.includes(x));
        return JSON.stringify({ app: 'Images Tag Manager for LORAs', type: 'project-tags', version: 1, globalTriggers: trig, tags: rest }, null, 2);
    }
    return tags.length > 0 ? tags.join(', ') + ',' : '';
};

export const TagFileEditor = ({ isOpen, onClose, t, isDarkMode, lang = 'it', showNotification, onFileSaved }: any) => {
    const [tags, setTags] = useState<string[]>([]);
    const [fileName, setFileName] = useState<string>('');
    const [inputValue, setInputValue] = useState('');
    const [dirty, setDirty] = useState(false);
    const handleRef = useRef<any>(null);
    const triggersRef = useRef<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const fallbackInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (isOpen) setTimeout(() => inputRef.current?.focus(), 100); }, [isOpen]);

    if (!isOpen) return null;

    // ITALIANO: chiede conferma se ci sono modifiche non salvate, prima di buttarle via.
    // ENGLISH: asks for confirmation when there are unsaved edits, before discarding them.
    const confermaScarta = (): boolean =>
        !dirty || window.confirm(t.tagEditorDiscardConfirm || 'Discard unsaved changes?');

    const nuovo = () => {
        if (!confermaScarta()) return;
        setTags([]); setFileName(''); handleRef.current = null; triggersRef.current = []; setDirty(false);
        soundManager.pop();
    };

    // ITALIANO: fa il parsing PRIMA di toccare qualsiasi stato: se il file e' illeggibile lancia,
    //           e chi chiama NON aggiorna l'handle di scrittura. Cosi' contenuto mostrato e file di
    //           destinazione restano sempre lo stesso file (prima potevano divergere: un file
    //           illeggibile lasciava l'handle sul nuovo file e i tag sul vecchio, e "Salva"
    //           sovrascriveva il file nuovo coi tag vecchi).
    // ENGLISH: parse BEFORE touching any state: an unreadable file throws, and the caller does NOT
    //          update the write handle. Shown content and save target thus always stay the same file
    //          (they could diverge before: an unreadable file left the handle on the new file and the
    //          tags on the old one, and "Save" overwrote the new file with the old tags).
    const caricaTesto = (testo: string, nome: string) => {
        const nuoviTag = parseTagFile(testo, nome);       // ITALIANO: puo' lanciare — ENGLISH: may throw
        triggersRef.current = parseTagTriggers(testo, nome);
        setTags(nuoviTag);
        setFileName(nome);
        setDirty(false);
        soundManager.chime();
    };

    const apri = async () => {
        if (!confermaScarta()) return;
        // ITALIANO: selettore moderno se disponibile: cosi' possiamo anche RISALVARE
        //           sullo stesso file senza richiedere di nuovo dove metterlo.
        // ENGLISH: modern picker when available: it also lets us SAVE BACK into the same
        //          file without asking again where to put it.
        if ('showOpenFilePicker' in window) {
            try {
                const [handle] = await (window as any).showOpenFilePicker({
                    id: 'itm-tag-editor',
                    types: [{ description: `${t.tagEditor} (.txt, .json)`, accept: { 'text/plain': ['.txt'], 'application/json': ['.json'] } }],
                });
                const file = await handle.getFile();
                // ITALIANO: prima il parse (puo' lanciare), poi affido l'handle: se il file non e'
                //           leggibile l'handle di scrittura NON cambia.
                // ENGLISH: parse first (may throw), then adopt the handle: if the file is unreadable
                //          the write handle does NOT change.
                caricaTesto(await file.text(), file.name);
                handleRef.current = handle;
            } catch (err: any) {
                if (err && err.name !== 'AbortError') {
                    console.error('[Editor tag] file illeggibile', err);
                    showNotification(t.tagEditorOpenError, 'error');
                }
            }
            return;
        }
        fallbackInputRef.current?.click();
    };

    const apriDaInput = async (e: any) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const testo = await file.text();
            caricaTesto(testo, file.name);
            handleRef.current = null; // ITALIANO: senza handle si salva con "Salva come" — ENGLISH: no handle: saving goes through "Save as"
        } catch (err) {
            console.error('[Editor tag] file illeggibile', err);
            showNotification(t.tagEditorOpenError, 'error');
        }
    };

    const salva = async (forzaNuovoFile = false) => {
        const nome = fileName || 'tags.txt';
        const contenuto = serializeTagFile(tags, nome, triggersRef.current);

        if (!forzaNuovoFile && handleRef.current) {
            try {
                const writable = await handleRef.current.createWritable();
                await writable.write(contenuto);
                await writable.close();
                setDirty(false);
                soundManager.chime();
                showNotification(`${t.tagEditorSaved}: ${nome}`, 'success');
                // ITALIANO: se il file appena scritto e' il .txt di una foto aperta nel progetto,
                //           allineo i suoi tag in memoria: altrimenti un successivo salvataggio del
                //           progetto lo riscriverebbe coi tag vecchi, annullando questa modifica.
                // ENGLISH: if the file just written is a photo's .txt open in the project, sync its
                //          in-memory tags: otherwise a later project save would rewrite it with the
                //          old tags, undoing this edit.
                if (onFileSaved) onFileSaved(nome, tags);
                return;
            } catch (err) {
                console.error('[Editor tag] salvataggio fallito', err);
                showNotification(t.tagEditorSaveError, 'error');
                return;
            }
        }

        if ('showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    id: 'itm-tag-editor',
                    suggestedName: nome,
                    types: [
                        { description: 'TXT', accept: { 'text/plain': ['.txt'] } },
                        { description: 'JSON', accept: { 'application/json': ['.json'] } },
                    ],
                });
                // ITALIANO: il formato lo decide l'estensione scelta nella finestra di salvataggio
                // ENGLISH: the format follows the extension chosen in the save dialog
                const writable = await handle.createWritable();
                await writable.write(serializeTagFile(tags, handle.name, triggersRef.current));
                await writable.close();
                handleRef.current = handle;
                setFileName(handle.name);
                setDirty(false);
                soundManager.chime();
                showNotification(`${t.tagEditorSaved}: ${handle.name}`, 'success');
                if (onFileSaved) onFileSaved(handle.name, tags);
            } catch (err: any) {
                if (err && err.name !== 'AbortError') {
                    console.error(err);
                    showNotification(t.tagEditorSaveError, 'error');
                }
            }
            return;
        }

        // ITALIANO: riserva per browser senza selettore di salvataggio
        // ENGLISH: fallback for browsers without a save picker
        const blob = new Blob([contenuto], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        try {
            const a = document.createElement('a');
            a.href = url; a.download = nome;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setDirty(false);
            showNotification(`${t.tagEditorSaved}: ${nome}`, 'success');
        } finally { URL.revokeObjectURL(url); }
    };

    // ITALIANO: chiusura con avviso se ci sono modifiche non salvate (tasto X e sfondo).
    // ENGLISH: close with a warning when there are unsaved edits (X button and backdrop).
    const chiudi = () => { if (confermaScarta()) onClose(); };

    const aggiungiTag = () => {
        const nuovi = inputValue.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
        if (!nuovi.length) return;
        setTags(prev => [...new Set([...prev, ...nuovi])]);
        setInputValue('');
        setDirty(true);
        soundManager.pop();
    };

    const togliTag = (tag: string) => {
        setTags(prev => prev.filter(x => x !== tag));
        setDirty(true);
        soundManager.click();
    };

    const bordo = isDarkMode ? 'border-gray-700' : 'border-gray-200';
    const testo = isDarkMode ? 'text-gray-200' : 'text-gray-800';

    const tastoBase = `flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed`;

    return (
        // ITALIANO: La finestra riempie lo schermo lasciando su OGNI lato il DOPPIO del rientro
        //           dell'app (l'app usa p-4 md:p-6 = 16/24 px, qui 32/48 px): serve spazio per
        //           vedere molti tag insieme, e resta comunque incorniciata come una finestra.
        // ENGLISH: The window fills the screen leaving on EVERY side DOUBLE the app's own inset
        //          (the app uses p-4 md:p-6 = 16/24 px, here 32/48 px): room is needed to see many
        //          tags at once, while still reading as a framed window.
        <div className="fixed inset-0 z-[320] bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className={`absolute inset-8 md:inset-12 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl shadow-2xl border overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col`}>

                <div className={`p-5 border-b ${bordo} flex items-center justify-between shrink-0`}>
                    <div className="flex items-center gap-3 min-w-0">
                        <TagIcon size={22} className="text-indigo-500 shrink-0" />
                        <div className="min-w-0">
                            <h3 className={`text-lg font-bold ${testo} leading-tight`}>{t.tagEditor}</h3>
                            <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {fileName || t.tagEditorNoFile}{dirty ? ' •' : ''}
                            </p>
                        </div>
                    </div>
                    <button onClick={chiudi} className={`p-1.5 rounded-full transition-colors shrink-0 ${isDarkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}>
                        <X size={18} />
                    </button>
                </div>

                <div className={`px-5 py-3 border-b ${bordo} flex flex-wrap gap-2 shrink-0`}>
                    <button onClick={nuovo} className={`${tastoBase} ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                        <FilePlus2 size={14} /> {t.tagEditorNew}
                    </button>
                    <button onClick={apri} className={`${tastoBase} bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 text-white shadow-md`}>
                        <FolderOpen size={14} /> {t.tagEditorOpen}
                    </button>
                    <div className="flex-1" />
                    <button onClick={() => salva(false)} disabled={tags.length === 0} className={`${tastoBase} bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 text-white shadow-md`}>
                        <Save size={14} /> {t.tagEditorSave}
                    </button>
                    <button onClick={() => salva(true)} disabled={tags.length === 0} className={`${tastoBase} ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                        {t.tagEditorSaveAs}
                    </button>
                </div>

                <div className="p-5 flex-1 overflow-y-auto lightbox-scroll min-h-0">
                    {tags.length === 0 ? (
                        <p className={`text-sm italic text-center py-10 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{t.tagEditorEmpty}</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {tags.map(tag => {
                                const traduzione = translateTag(tag, lang);
                                return (
                                    <span key={tag} title={traduzione ? `${tag} — ${traduzione}` : tag}
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] leading-tight font-medium ${getActiveCategoryColor(getTagCategory(tag))}`}>
                                        {tag}
                                        <button onClick={() => togliTag(tag)} className="hover:bg-black/20 rounded-full p-0.5 transition-colors">
                                            <X size={10} />
                                        </button>
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className={`p-4 border-t ${bordo} shrink-0 flex items-center gap-2`}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); aggiungiTag(); } }}
                        placeholder={t.tagEditorPlaceholder}
                        className={`flex-1 px-3 py-2 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                    />
                    <span className={`text-xs font-bold tabular-nums shrink-0 px-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {tags.length}
                    </span>
                </div>

                <input ref={fallbackInputRef} type="file" accept=".txt,.json,text/plain,application/json" className="hidden" onChange={apriDaInput} />
            </div>
        </div>
    );
};
