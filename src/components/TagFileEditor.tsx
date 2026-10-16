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
import { X, FilePlus2, FolderOpen, Save, Tag as TagIcon, ListPlus, FileX2 } from 'lucide-react';
import { getTagCategory, getActiveCategoryColor } from '../utils/tagCategorization';
import { translateTag } from '../utils/tagTranslation';
import { soundManager } from '../utils/soundManager';
import { uniqueTagsIgnoringCase, hasTagIgnoringCase } from '../utils/tagCase';
import { leggiTestoSidecar } from '../utils/sidecarTags';

// ITALIANO: Legge i tag da un testo. Il .json accetta sia il formato esportato
//           dall'app ({tags: [...]}) sia un semplice elenco ["a","b"]. Il .txt usa
//           virgole o a capo come separatori, come i sidecar delle foto.
// ENGLISH: Reads tags out of a text. JSON accepts both the app's exported shape
//          ({tags: [...]}) and a plain list ["a","b"]. TXT uses commas or newlines,
//          like the photo sidecars.
// ITALIANO: tetto di dimensione per i file aperti nell'editor (come i sidecar delle foto).
// ENGLISH: size cap for files opened in the editor (same as the photo sidecars).
const EDITOR_MAX_BYTES = 1024 * 1024;

// ITALIANO: un testo che comincia come un JSON vero: un oggetto ({ seguito da " o }) o un elenco di
//           testi (["... oppure []). Serve a distinguere un JSON rotto da un .txt di tag che inizia
//           con una parentesi, come "[artist name], 1girl," o "{best quality}, 1girl,".
// ENGLISH: a text that starts like real JSON: an object ({ followed by " or }) or a list of strings
//          (["... or []). Tells broken JSON apart from a tag .txt that starts with a bracket, such
//          as "[artist name], 1girl," or "{best quality}, 1girl,".
const SEMBRA_JSON = /^\s*(\{\s*["}]|\[\s*["\]])/;

export const parseTagFile = (text: string, fileName: string): string[] => {
    // ITALIANO: un .json e' sempre JSON. Un altro nome lo e' solo se il testo si legge come JSON:
    //           Salva ordina i tag e mette "[artist name]" o "{best quality}" in testa, e quel .txt
    //           finiva in JSON.parse e non si apriva piu'. Un JSON chiaramente rotto resta un errore.
    // ENGLISH: a .json is always JSON. Any other name is JSON only when the text parses as JSON:
    //          Save sorts the tags and puts "[artist name]" or "{best quality}" first, and that .txt
    //          went to JSON.parse and could not be opened. Clearly broken JSON stays an error.
    let isJson = fileName.toLowerCase().endsWith('.json');
    let parsed: any = undefined;
    if (isJson) {
        parsed = JSON.parse(text);
    } else if (/^\s*[[{]/.test(text)) {
        try { parsed = JSON.parse(text); isJson = true; }
        catch (err) { if (SEMBRA_JSON.test(text)) throw err; }
    }
    let raw: unknown[] = [];
    if (isJson) {
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

export const TagFileEditor = ({ isOpen, onClose, t, isDarkMode, lang = 'it', showNotification, onFileSaved, projectTags = [], onImportTagsToProject, onDirtyChange }: any) => {
    const [tags, setTags] = useState<string[]>([]);
    const [fileName, setFileName] = useState<string>('');
    const [inputValue, setInputValue] = useState('');
    const [dirty, setDirty] = useState(false);
    // ITALIANO: azione in sospeso quando ci sono modifiche non salvate: se != null mostro la finestra
    //           di conferma A TEMA (non piu' il window.confirm di sistema, che stonava con l'app).
    // ENGLISH: pending action when there are unsaved edits: if != null I show the THEMED confirm
    //          dialog (no longer the system window.confirm, which clashed with the app).
    const [discardAction, setDiscardAction] = useState<null | (() => void)>(null);
    // ITALIANO: e' aperta la domanda "chiudo il file: salvo prima?" — ENGLISH: the "closing the file: save first?" question is open
    const [chiusuraFile, setChiusuraFile] = useState(false);
    const handleRef = useRef<any>(null);
    // ITALIANO: i tag COME STANNO NEL FILE (ultima apertura o ultimo salvataggio riuscito). Servono
    //           a "Scarta modifiche": si torna a questi, senza chiudere il file.
    // ENGLISH: the tags AS THEY ARE IN THE FILE (last open or last successful save). Used by
    //          "Discard changes": we go back to these, without closing the file.
    const savedTagsRef = useRef<string[]>([]);
    // ITALIANO: specchio SEMPRE aggiornato di `tags`, assegnato durante il render. Serve al
    //           salvataggio per sapere, a scrittura finita, se nel frattempo la lista e' cambiata:
    //           dentro una funzione asincrona `tags` resta congelato al render in cui e' partita.
    // ENGLISH: an ALWAYS-current mirror of `tags`, assigned during render. Saving needs it to tell,
    //          once the write is done, whether the list changed meanwhile: inside an async function
    //          `tags` stays frozen at the render it started from.
    const tagsRef = useRef<string[]>(tags);
    tagsRef.current = tags;
    // ITALIANO: stesso specchio per "modificato": serve alla rilettura asincrona per sapere se
    //           l'utente ha gia' toccato qualcosa mentre leggeva.
    // ENGLISH: the same mirror for "modified": the async re-read needs it to know whether the user
    //          has already touched something while it was reading.
    const dirtyRef = useRef<boolean>(false);
    dirtyRef.current = dirty;
    const triggersRef = useRef<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const fallbackInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (isOpen) setTimeout(() => inputRef.current?.focus(), 100); }, [isOpen]);

    // ITALIANO: dice ad App se ci sono modifiche non salvate: la X della finestra (e Alt+F4) le
    //           chiudeva senza chiedere, mentre la X dell'editor chiede. Smontato = niente bozza.
    // ENGLISH: tells App whether there are unsaved edits: the window's X (and Alt+F4) closed them
    //          without asking, while the editor's X asks. Unmounted = no draft.
    useEffect(() => {
        if (onDirtyChange) onDirtyChange(dirty || inputValue.trim() !== '');
        return () => { if (onDirtyChange) onDirtyChange(false); };
    }, [dirty, inputValue, onDirtyChange]);

    // ITALIANO: RIAPERTURA — il file aperto resta aperto anche dopo aver chiuso la finestra, ma nel
    //           frattempo quel .txt puo' essere cambiato sul disco (per esempio l'hai modificato dai
    //           tag della foto nel progetto, o con un altro programma). Allora, riaprendo l'editor,
    //           lo RILEGGO dal disco: cosi' vedi la versione vera e un "Salva" non riscrive sopra
    //           alle modifiche piu' recenti con quelle vecchie rimaste in memoria. Se il file non e'
    //           piu' leggibile (spostato, permessi persi) tengo quello che c'e' senza disturbare.
    // ENGLISH: REOPEN — the open file stays open after the window is closed, but meanwhile that .txt
    //          may have changed on disk (e.g. edited from the photo's tags in the project, or by
    //          another program). So, on reopening the editor, I RE-READ it from disk: you see the
    //          real version and a "Save" does not overwrite newer changes with stale in-memory ones.
    //          If the file is no longer readable (moved, permission lost) I keep what is there.
    // ITALIANO: true mentre la rilettura dal disco e' in corso. Serve a due cose: disabilitare Salva
    //           (altrimenti si potrebbe scrivere la versione vecchia in memoria SOPRA quella piu'
    //           recente sul disco, cioe' esattamente cio' che la rilettura deve impedire) e far
    //           uscire subito salva() se viene invocata lo stesso.
    // ENGLISH: true while the re-read from disk is running. It serves two purposes: disabling Save
    //          (otherwise the stale in-memory version could be written OVER the newer one on disk —
    //          exactly what the re-read is meant to prevent) and making salva() bail out at once if
    //          it gets invoked anyway.
    const [rileggendo, setRileggendo] = useState(false);

    useEffect(() => {
        if (!isOpen) return undefined;
        const handle = handleRef.current;
        if (!handle || typeof handle.getFile !== 'function') return undefined;
        let annullato = false;
        setRileggendo(true);
        (async () => {
            try {
                const file = await handle.getFile();
                // ITALIANO: dopo OGNI attesa controllo anche che il bersaglio non sia cambiato. Il
                //           solo flag `annullato` scatta quando la finestra si chiude, ma NON quando
                //           l'utente preme Nuovo o apre un altro file mentre la lettura e' in corso:
                //           una lettura lenta (cartella di rete, OneDrive, antivirus che scansiona)
                //           avrebbe sovrascritto il file appena aperto coi tag di quello vecchio.
                // ENGLISH: after EVERY await I also check that the target has not changed. The
                //          `annullato` flag alone fires when the window closes, but NOT when the user
                //          hits New or opens another file mid-read: a slow read (network folder,
                //          OneDrive, antivirus scanning) would have overwritten the just-opened file
                //          with the old one's tags.
                if (annullato || handleRef.current !== handle || file.size > EDITOR_MAX_BYTES) return;
                const testo = await leggiTestoSidecar(file);
                if (annullato || handleRef.current !== handle) return;
                const nuoviTag = parseTagFile(testo, file.name);
                triggersRef.current = parseTagTriggers(testo, file.name);
                savedTagsRef.current = [...nuoviTag];
                setFileName(file.name);
                // ITALIANO: se nel frattempo l'utente ha gia' aggiunto qualcosa (tipicamente col tasto
                //           "Aggiungi tag del progetto", che non e' disabilitato durante la lettura),
                //           il suo lavoro NON si butta: tengo i suoi tag e lascio acceso "modificato".
                //           Il contenuto del disco diventa comunque il punto di ritorno per lo scarto,
                //           perche' savedTagsRef qui sopra e' gia' stato aggiornato.
                // ENGLISH: if the user has already added something meanwhile (typically via the "Add
                //          project tags" button, which is not disabled during the read), their work is
                //          NOT thrown away: I keep their tags and leave "modified" on. The disk content
                //          still becomes the discard baseline, since savedTagsRef above is updated.
                if (dirtyRef.current) return;
                setTags(nuoviTag);
                setDirty(false);
            } catch (_) { /* file non piu' leggibile: tengo il contenuto in memoria */ }
            finally { if (!annullato) setRileggendo(false); }
        })();
        return () => { annullato = true; setRileggendo(false); };
    }, [isOpen]);

    if (!isOpen) return null;

    // ITALIANO: esegue l'azione subito se non ci sono modifiche non salvate; altrimenti chiede prima
    //           conferma con la finestra a tema. Sostituisce il vecchio window.confirm sincrono.
    // ENGLISH: runs the action immediately when there are no unsaved edits; otherwise asks for
    //          confirmation first with the themed dialog. Replaces the old synchronous window.confirm.
    // ITALIANO: il testo scritto nella casella e non ancora confermato con Invio e' una modifica
    //           anche lui: prima chiudere, aprire un altro file o "Nuovo" lo buttavano senza chiedere.
    // ENGLISH: the text typed in the box and not yet confirmed with Enter is an edit too: closing,
    //          opening another file or "New" used to throw it away without asking.
    const inAttesa = (): string[] => inputValue.split(/[,\n]+/).map(x => x.trim()).filter(Boolean);
    const modificato = dirty || inAttesa().length > 0;
    const guardDiscard = (action: () => void) => {
        if (!modificato) { action(); return; }
        setDiscardAction(() => action);
    };

    // ITALIANO: riporta l'editor a foglio bianco: tag, nome file, casella di scrittura, stato
    //           "modificato" e soprattutto l'handle del file di destinazione.
    // ENGLISH: brings the editor back to a blank sheet: tags, file name, input box, "modified"
    //          flag and above all the target file handle.
    const azzera = () => {
        setTags([]); setFileName(''); setInputValue(''); setDirty(false);
        handleRef.current = null; triggersRef.current = []; savedTagsRef.current = [];
    };

    const nuovo = () => guardDiscard(() => {
        azzera();
        soundManager.pop();
    });

    // ITALIANO: CHIUDI FILE. Con modifiche non salvate chiede prima cosa farne (salvare, buttare,
    //           lasciar perdere); senza modifiche chiude subito. Diverso dalla X in alto a destra,
    //           che mette via la finestra ma tiene il file aperto per quando la si riapre.
    // ENGLISH: CLOSE FILE. With unsaved edits it asks what to do with them first (save, throw away,
    //          never mind); with nothing pending it closes straight away. Different from the X in
    //          the corner, which only puts the window away and keeps the file open for next time.
    const chiudiFile = () => {
        if (!modificato) { azzera(); soundManager.pop(); return; }
        setChiusuraFile(true);
    };

    const salvaEChiudiFile = async () => {
        setChiusuraFile(false);
        // ITALIANO: chiudo SOLO se il salvataggio e' andato a buon fine.
        // ENGLISH: close ONLY if the save actually succeeded.
        const scritto = await salva(false);
        if (scritto) { azzera(); soundManager.pop(); }
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
        savedTagsRef.current = [...nuoviTag];
        setTags(nuoviTag);
        setFileName(nome);
        setDirty(false);
        // ITALIANO: il file nuovo parte con la casella vuota: il testo in attesa del file di prima e'
        //           gia' stato scartato (domanda "Chiudi senza salvare"); prima restava li' e il primo
        //           Salva lo scriveva DENTRO questo file.
        // ENGLISH: the new file starts with an empty box: the previous file's pending text has already
        //          been discarded ("Close without saving" question); it used to stay there and the
        //          first Save wrote it INTO this file.
        setInputValue('');
        // ITALIANO: rendo questi tag disponibili anche nel pannello di selezione in blocco del progetto.
        // ENGLISH: also make these tags available in the project's bulk-selection panel.
        if (onImportTagsToProject) onImportTagsToProject(nuoviTag);
        soundManager.chime();
    };

    const apri = () => guardDiscard(async () => {
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
                // ITALIANO: un file di tag legittimo pesa pochi KB. Oltre 1 MB e' sospetto (file
                //           enorme/sbagliato) e leggerlo tutto potrebbe bloccare l'app: lo rifiuto.
                // ENGLISH: a legit tag file weighs a few KB. Over 1 MB is suspicious (huge/wrong
                //          file) and reading it all could freeze the app: reject it.
                if (file.size > EDITOR_MAX_BYTES) { showNotification(t.tagEditorOpenError, 'error'); return; }
                // ITALIANO: prima il parse (puo' lanciare), poi affido l'handle: se il file non e'
                //           leggibile l'handle di scrittura NON cambia.
                // ENGLISH: parse first (may throw), then adopt the handle: if the file is unreadable
                //          the write handle does NOT change.
                caricaTesto(await leggiTestoSidecar(file), file.name);
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
    });

    const apriDaInput = async (e: any) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            // ITALIANO: stesso limite dell'altra via: niente file oltre 1 MB.
            // ENGLISH: same cap as the other path: no files over 1 MB.
            if (file.size > EDITOR_MAX_BYTES) { showNotification(t.tagEditorOpenError, 'error'); return; }
            const testo = await leggiTestoSidecar(file);
            caricaTesto(testo, file.name);
            handleRef.current = null; // ITALIANO: senza handle si salva con "Salva come" — ENGLISH: no handle: saving goes through "Save as"
        } catch (err) {
            console.error('[Editor tag] file illeggibile', err);
            showNotification(t.tagEditorOpenError, 'error');
        }
    };

    // ITALIANO: restituisce true SOLO se il file e' stato scritto davvero. Serve a "Salva e chiudi":
    //           se la scrittura fallisce o l'utente annulla la finestra di salvataggio, il file NON
    //           va chiuso, altrimenti il lavoro sparirebbe in silenzio.
    // ENGLISH: returns true ONLY if the file was really written. "Save and close" needs it: if the
    //          write fails or the user cancels the save dialog, the file must NOT be closed,
    //          otherwise the work would vanish silently.
    const salva = async (forzaNuovoFile = false): Promise<boolean> => {
        // ITALIANO: se una rilettura dal disco e' ancora in corso NON si salva: si scriverebbe la
        //           versione vecchia in memoria sopra quella piu' recente.
        // ENGLISH: if a re-read from disk is still running do NOT save: it would write the stale
        //          in-memory version over the newer one.
        if (rileggendo) return false;
        const nome = fileName || 'tags.txt';
        // ITALIANO: FOTOGRAFIA dei tag al momento del salvataggio. La scrittura e' asincrona e puo'
        //           durare (OneDrive, cartella di rete, antivirus che scansiona): se nel frattempo
        //           l'utente aggiunge un tag, a fine scrittura NON devo dichiarare "tutto salvato"
        //           sulla base della lista vecchia. Prima lo facevo, e siccome adesso la chiusura
        //           riporta i tag a savedTagsRef, quella modifica spariva in silenzio.
        // ENGLISH: SNAPSHOT of the tags at save time. Writing is asynchronous and can take a while
        //          (OneDrive, network folder, antivirus scanning): if the user adds a tag meanwhile,
        //          I must NOT declare "all saved" based on the old list once the write ends. It used
        //          to, and since closing now restores tags from savedTagsRef, that edit vanished
        //          silently.
        // ITALIANO: con dentro il testo scritto e non confermato con Invio: prima "Salva e chiudi" lo
        //           buttava (si salvava senza e poi la casella si svuotava chiudendo il file).
        // ENGLISH: including the text typed and not confirmed with Enter: "Save and close" used to drop
        //          it (it saved without it, then closing the file emptied the box).
        const pendenti = inAttesa();
        const istantanea = pendenti.length === 0 ? tags
            : [...tags, ...uniqueTagsIgnoringCase(pendenti).filter(n => !hasTagIgnoringCase(tags, n))];
        if (pendenti.length > 0) {
            tagsRef.current = istantanea;
            setTags(istantanea);
            setInputValue('');
            setDirty(true);
        }
        // ITALIANO: un elenco vuoto non si scrive mai (Salva e Salva come sono spenti, e ora anche
        //           "Salva e chiudi"): prima quest'ultimo scriveva un .txt vuoto sopra quello della
        //           foto, con l'avviso verde, e Kohya si ferma su un .txt vuoto.
        // ENGLISH: an empty list is never written (Save and Save as are off, and now "Save and
        //          close" too): the latter used to write an empty .txt over the photo's one, with the
        //          green notice, and Kohya stops on an empty .txt.
        if (istantanea.length === 0) return false;
        const contenuto =serializeTagFile(istantanea, nome, triggersRef.current);
        // ITALIANO: "modificato" si spegne solo se nel frattempo nulla e' cambiato.
        // ENGLISH: the "modified" flag clears only if nothing changed meanwhile.
        const concludiSalvataggio = () => {
            savedTagsRef.current = [...istantanea];
            setDirty(tagsRef.current !== istantanea);
        };

        if (!forzaNuovoFile && handleRef.current) {
            // ITALIANO: congelo anche il BERSAGLIO, non solo i tag. Prima l'avviso al progetto
            //           (onFileSaved) rileggeva handleRef.current DOPO la scrittura: se nel frattempo
            //           l'utente apriva un altro file, il progetto riceveva i tag del PRIMO file
            //           abbinati al SECONDO. Con un .txt omonimo di un'altra sottocartella — normale
            //           nei dataset LoRA — la foto sbagliata prendeva in memoria quei tag e al primo
            //           salvataggio del progetto il suo .txt vero veniva sovrascritto.
            // ENGLISH: freeze the TARGET too, not just the tags. The project notification
            //          (onFileSaved) used to re-read handleRef.current AFTER the write: if the user
            //          opened another file meanwhile, the project got the FIRST file's tags paired
            //          with the SECOND one. With a .txt of the same name from another subfolder —
            //          routine in LoRA datasets — the wrong photo took those tags in memory and the
            //          next project save overwrote its real .txt.
            const bersaglio = handleRef.current;
            try {
                const writable = await bersaglio.createWritable();
                await writable.write(contenuto);
                await writable.close();
                concludiSalvataggio();
                soundManager.chime();
                showNotification(`${t.tagEditorSaved}: ${nome}`, 'success');
                // ITALIANO: se il file appena scritto e' il .txt di una foto aperta nel progetto,
                //           allineo i suoi tag in memoria: altrimenti un successivo salvataggio del
                //           progetto lo riscriverebbe coi tag vecchi, annullando questa modifica.
                //           Passo l'handle del file: cosi' App verifica l'IDENTITA' vera (stessa
                //           cartella), non solo il nome, e un file omonimo non dirotta la foto.
                // ENGLISH: if the file just written is a photo's .txt open in the project, sync its
                //          in-memory tags: otherwise a later project save would rewrite it with the
                //          old tags, undoing this edit. I pass the file handle so App can verify the
                //          real IDENTITY (same folder), not just the name, so a same-named file
                //          can't hijack the photo.
                if (onFileSaved) onFileSaved(nome, istantanea, bersaglio);
                return true;
            } catch (err) {
                console.error('[Editor tag] salvataggio fallito', err);
                showNotification(t.tagEditorSaveError, 'error');
                return false;
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
                await writable.write(serializeTagFile(istantanea, handle.name, triggersRef.current));
                await writable.close();
                handleRef.current = handle;
                setFileName(handle.name);
                concludiSalvataggio();
                soundManager.chime();
                showNotification(`${t.tagEditorSaved}: ${handle.name}`, 'success');
                if (onFileSaved) onFileSaved(handle.name, istantanea, handle);
                return true;
            } catch (err: any) {
                if (err && err.name !== 'AbortError') {
                    console.error(err);
                    showNotification(t.tagEditorSaveError, 'error');
                }
                return false;
            }
        }

        // ITALIANO: riserva per browser senza selettore di salvataggio
        // ENGLISH: fallback for browsers without a save picker
        const blob = new Blob([contenuto], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        try {
            const a = document.createElement('a');
            a.href = url; a.download = nome;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            // ITALIANO: e' un download, non un salvataggio: il file aperto non e' cambiato, quindi le
            //           modifiche restano da salvare e "Salva e chiudi" non chiude. Prima diceva "Salvato".
            // ENGLISH: it is a download, not a save: the open file did not change, so the edits stay
            //          unsaved and "Save and close" does not close. It used to say "Saved".
            showNotification(t.tagEditorDownloaded.replace('{name}', nome), 'info');
            return false;
        } finally { URL.revokeObjectURL(url); }
    };

    // ITALIANO: chiusura con avviso a tema se ci sono modifiche non salvate (tasto X e sfondo).
    //           Il FILE RESTA APERTO: chiudendo la finestra lo si mette solo via, e riaprendola si
    //           ritrova. A chiudere il file davvero e' il tasto "Nuovo". Quello che invece NON
    //           sopravvive sono le modifiche che si e' scelto di SCARTARE: prima restavano in
    //           memoria, ricomparivano alla riapertura e un "Salva" le rimetteva nel file — cioe'
    //           lo scarto era una bugia. Ora si torna al contenuto vero del file.
    // ENGLISH: close with a themed warning when there are unsaved edits (X button and backdrop).
    //          The FILE STAYS OPEN: closing the window merely puts it away, reopening brings it
    //          back. The "New" button is what actually closes the file. What does NOT survive are
    //          the edits the user chose to DISCARD: they used to stay in memory, reappear on reopen
    //          and a "Save" put them into the file — the discard was a lie. Now the editor goes
    //          back to the file's real content.
    const chiudi = () => guardDiscard(() => {
        setTags([...savedTagsRef.current]);
        setInputValue('');
        setDirty(false);
        onClose();
    });

    const aggiungiTag = () => {
        const nuovi = inputValue.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
        if (!nuovi.length) return;
        // ITALIANO: "Smile" su un file con "smile" non entra: come nel resto dell'app, i tag che
        //           differiscono solo per le maiuscole sono uno, e resta la grafia gia' presente.
        //           Prima Salva scriveva "smile, Smile,". I tag gia' nel file non si toccano.
        // ENGLISH: "Smile" on a file with "smile" does not go in: as in the rest of the app, tags
        //          that differ only in case are one, and the spelling already there stays. Save
        //          used to write "smile, Smile,". The tags already in the file are not touched.
        setTags(prev => [...prev, ...uniqueTagsIgnoringCase(nuovi).filter(n => !hasTagIgnoringCase(prev, n))]);
        setInputValue('');
        setDirty(true);
        soundManager.pop();
    };

    // ITALIANO: inserisce nell'editor TUTTI i tag conosciuti del progetto attuale (senza doppioni).
    // ENGLISH: inserts ALL the current project's known tags into the editor (without duplicates).
    const aggiungiTagProgetto = () => {
        const nuovi = [...new Set((projectTags as any[]).map(s => String(s).trim()).filter(Boolean))];
        if (!nuovi.length) { showNotification(t.noTagsInProject, 'info'); return; }
        // ITALIANO: stessa regola di aggiungiTag: niente seconda grafia di un tag gia' presente.
        // ENGLISH: same rule as aggiungiTag: no second spelling of a tag already there.
        setTags(prev => [...prev, ...uniqueTagsIgnoringCase(nuovi).filter(n => !hasTagIgnoringCase(prev, n))]);
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
                    {/* ITALIANO: inserisce tutti i tag conosciuti del progetto attuale */}
                    {/* ENGLISH: inserts all known tags of the current project */}
                    <button onClick={aggiungiTagProgetto} className={`${tastoBase} ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                        <ListPlus size={14} /> {t.tagEditorAddProjectTags}
                    </button>
                    <div className="flex-1" />
                    {/* ITALIANO: chiude il file aperto. Spento quando l'editor e' gia' un foglio bianco. */}
                    {/* ENGLISH: closes the open file. Off when the editor is already a blank sheet. */}
                    <button onClick={chiudiFile} disabled={!fileName && tags.length === 0} className={`${tastoBase} bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 text-white shadow-md`}>
                        <FileX2 size={14} /> {t.tagEditorCloseFile}
                    </button>
                    <button onClick={() => salva(false)} disabled={(tags.length === 0 && inputValue.trim() === '') || rileggendo} className={`${tastoBase} bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 text-white shadow-md`}>
                        <Save size={14} /> {t.tagEditorSave}
                    </button>
                    <button onClick={() => salva(true)} disabled={(tags.length === 0 && inputValue.trim() === '') || rileggendo} className={`${tastoBase} ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
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
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aggiungiTag(); } }}
                        placeholder={t.tagEditorPlaceholder}
                        className={`flex-1 px-3 py-2 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                    />
                    <span className={`text-xs font-bold tabular-nums shrink-0 px-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {tags.length}
                    </span>
                </div>

                <input ref={fallbackInputRef} type="file" accept=".txt,.json,text/plain,application/json" className="hidden" onChange={apriDaInput} />
            </div>

            {/* ITALIANO: conferma "scarta modifiche" A TEMA (prima era il window.confirm di sistema). */}
            {/* ENGLISH: THEMED "discard changes" confirm (used to be the system window.confirm). */}
            {discardAction && (
                <div className="fixed inset-0 z-[340] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setDiscardAction(null)}>
                    <div className={`w-[90%] max-w-sm rounded-2xl shadow-2xl border p-5 flex flex-col gap-4 animate-in zoom-in-95 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`} onClick={e => e.stopPropagation()}>
                        <p className={`text-sm ${testo}`}>{t.tagEditorDiscardConfirm}</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setDiscardAction(null)} className={`${tastoBase} ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>{t.cancel}</button>
                            <button onClick={() => { const a = discardAction; setDiscardAction(null); if (a) a(); }} className={`${tastoBase} bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 text-white shadow-md`}>{t.closeWithoutSaving}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ITALIANO: chiusura del FILE con modifiche in sospeso: tre strade, come per il progetto. */}
            {/* ENGLISH: closing the FILE with pending edits: three ways out, as for the project. */}
            {chiusuraFile && (
                <div className="fixed inset-0 z-[340] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setChiusuraFile(false)}>
                    <div className={`w-[90%] max-w-md rounded-2xl shadow-2xl border p-5 flex flex-col gap-4 animate-in zoom-in-95 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`} onClick={e => e.stopPropagation()}>
                        <p className={`text-sm ${testo}`}>{t.tagEditorCloseConfirm}</p>
                        <div className="flex flex-wrap justify-end gap-2">
                            <button onClick={() => setChiusuraFile(false)} className={`${tastoBase} ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>{t.cancel}</button>
                            <button onClick={() => { setChiusuraFile(false); azzera(); soundManager.pop(); }} className={`${tastoBase} bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 text-white shadow-md`}>{t.closeWithoutSaving}</button>
                            <button onClick={salvaEChiudiFile} disabled={(tags.length === 0 && inputValue.trim() === '') || rileggendo} className={`${tastoBase} bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 text-white shadow-md`}>
                                <Save size={14} /> {t.saveAndClose}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
