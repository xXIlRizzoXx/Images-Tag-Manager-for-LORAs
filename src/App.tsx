/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: COMPONENTE PRINCIPALE DELL'APP                                  **
**  Questo è il cuore del programma. Gestisce il caricamento delle immagini,  **
**  la lista dei tag e l'aspetto generale della finestra principale.          **
**                                                                            **
**  ENGLISH: MAIN APPLICATION COMPONENT                                       **
**  This is the heart of the program. It handles image loading,               **
**  the tag list, and the overall appearance of the main window.              **
**                                                                            **
*******************************************************************************
*******************************************************************************/
import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import { Folder, Trash, Trash2, RefreshCw, Tag, Tags, Save, SaveAll, ImageIcon, Settings, Volume2, VolumeX, Globe, LayoutGrid, Grid3X3, ZoomOut, ZoomIn, X, Check, ArrowDownUp, Sun, Moon, PieChart, BarChart3, AlertTriangle, Sparkles, Loader2, Wand2, KeyRound, BookOpen, ChevronUp, ChevronDown, ExternalLink, Download, Upload, Copy, ClipboardPaste, Search, Ungroup, Undo2 } from 'lucide-react';
import { getTagCategory, getCategoryColor, getActiveCategoryColor } from './utils/tagCategorization';
import { getGeminiTags, verifyGeminiApiKey, GEMINI_MODELS, normalizeModelId, getModelTier, classifyGeminiError, aggiornaModelloAutomatico, elencaModelliRemoti, confrontaVersioni, versioneDi } from './services/geminiService';
import { getSecret, setSecret, deleteSecret } from './utils/secureStorage';
import {
    PieChart as RechartsPieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    BarChart as RechartsBarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid
} from 'recharts';
import { translations } from './constants';
import { soundManager } from './utils/soundManager';
import { generateThumbnail } from './utils/imageUtils';
import { AppleToggle, TagInput, Toast, CustomConfirmDialog, SaveBeforeCloseDialog, ImportSummaryDialog, UpdateDialog, ExportChoiceDialog } from './components/ui';
import { Lightbox } from './components/Lightbox';
import { TagSuggestionsPanel } from './components/TagSuggestionsPanel';
import { sanitizeFileName, buildTagFileName, sidecarTagFileName } from './utils/pathUtils';
import { makeFolderKeyer, cartellaImmagine, cartellaTesto, fileDaSidecar, parseSidecarText, tagDiImport, tagDopoEditor, pulisciTagProgetto, txtNonLettoInVigore } from './utils/sidecarTags';
import { BACKUP_KEY_SEP, folderSignature, backupDellImport, tagDaRipristinare, type FotoChiusa } from './utils/tagBackup';
import { modificheNonSalvate, fotoDaSalvare, scriviBackupSubito, backupDopoChiusura } from './utils/closeGuard';
import { isLetterShortcut } from './utils/shortcuts';
import { qualityWarningText } from './utils/imageQuality';
import { avvisoImport } from './utils/importNotice';
import { purgeIdsFromHistory, withLiveOriginalTags, nearestDifferentStep } from './utils/historyUtils';
import { hasTagIgnoringCase, uniqueTagsIgnoringCase, countNewTagsIgnoringCase, hasTagsBeyondTriggers, splitTagInput } from './utils/tagCase';
import { scriviZip, ERRORE_LETTURA_ZIP, type VoceZip } from './utils/zipWriter';
import { scanDirectoryHandle, fileDiMac } from './utils/folderScan';
import { flagUri, flagUriForLang } from './utils/flags';
import { translateTag, translateCategory } from './utils/tagTranslation';
import { TagFileEditor } from './components/TagFileEditor';

// ITALIANO: Profilo GitHub dell'autore, aperto dal copyright della schermata di avvio.
// ENGLISH: The author's GitHub profile, opened from the splash screen's copyright line.
const GITHUB_PROFILE = 'https://github.com/xXIlRizzoXx';

// ITALIANO: Lingue dell'interfaccia — usate sia dal selettore nelle impostazioni
//           sia dalla schermata di scelta lingua al primo avvio.
// ENGLISH: UI languages — used by both the settings selector and the first-run picker.
const APP_LANGUAGES = [
    { code: 'it', label: 'Italiano', flag: 'it' },
    { code: 'en', label: 'English', flag: 'gb' },
    { code: 'fr', label: 'Français', flag: 'fr' },
    { code: 'es', label: 'Español', flag: 'es' },
    { code: 'de', label: 'Deutsch', flag: 'de' },
    { code: 'zh', label: '中文 (简体)', flag: 'cn' },
    { code: 'ja', label: '日本語', flag: 'jp' },
    { code: 'pt', label: 'Português', flag: 'br' },
    { code: 'ru', label: 'Русский', flag: 'ru' },
];
const LANG_CODES = APP_LANGUAGES.map(l => l.code);

// ITALIANO: Lingua iniziale: quella già scelta, altrimenti quella del sistema operativo,
//           altrimenti inglese (così un PC tedesco parte in tedesco).
// ENGLISH: Initial language: the saved choice, else the OS language, else English.
const detectInitialLang = (): string => {
    try {
        const saved = localStorage.getItem('lang');
        if (saved && LANG_CODES.includes(saved)) return saved;
    } catch (_) { /* ignore */ }
    try {
        const sys = (navigator.language || '').slice(0, 2).toLowerCase();
        if (LANG_CODES.includes(sys)) return sys;
    } catch (_) { /* ignore */ }
    return 'en';
};

// ITALIANO: IDENTIFICATIVO INTERNO di ogni foto importata. Prima era
//   `Math.random().toString(36).substring(7)`: una stringa di 4-6 caratteri che su un import da
//   3000 foto dava due id uguali circa una volta su 160. Due foto con lo stesso id diventano
//   gemelle: `updateImageTags` riscrive TUTTE le foto che portano quell'id, quindi un tag messo
//   su una finiva anche sull'altra e al salvataggio il .txt della seconda veniva sovrascritto —
//   in silenzio, senza nessun avviso, in un programma che serve a preparare dataset.
//   `crypto.randomUUID()` non puo' ripetersi ed e' sempre disponibile: nell'app la pagina sta su
//   file://, che Chromium considera contesto sicuro, e in sviluppo su http://localhost.
//   Il ripiego col contatore copre solo il caso limite di un contesto non sicuro, dove
//   `randomUUID` non esiste: meglio un id buono che un import che si pianta.
// ENGLISH: INTERNAL ID of every imported photo. It used to be
//   `Math.random().toString(36).substring(7)`: a 4-6 char string that produced a duplicate roughly
//   once every 160 imports of 3000 photos. Two photos sharing an id become twins: `updateImageTags`
//   rewrites EVERY photo carrying that id, so a tag typed on one landed on the other as well and
//   the save then overwrote the second photo's .txt — silently, with no warning, in a tool whose
//   whole job is preparing datasets. `crypto.randomUUID()` cannot repeat and is always there: the
//   app's page is served from file://, which Chromium treats as a secure context, and dev runs on
//   http://localhost. The counter fallback only covers the edge case of a non-secure context, where
//   `randomUUID` is missing: a good id beats an import that throws.
let contatoreIdFoto = 0;
const nuovoIdFoto = (): string => {
    try {
        return crypto.randomUUID();
    } catch (_) {
        return `img-${Date.now().toString(36)}-${(++contatoreIdFoto).toString(36)}`;
    }
};

// ITALIANO: Chiave del BACKUP anti-crash: cartella + nome del file. Deve restare identica fra
//           una sessione e l'altra (il backup si rilegge dopo un riavvio), quindi NON puo' usare
//           i numeri progressivi di makeFolderKeyer, che dipendono dall'ordine di scansione.
//           Uso il NOME della cartella (o il percorso, quando c'e'). Col solo nome del file, due
//           foto omonime in sottocartelle diverse (10_viso\img.png e 20_corpo\img.png, la tipica
//           struttura LoRA) si sovrascrivevano a vicenda nel backup: dopo un crash i tag di una
//           venivano ripristinati sull'ALTRA e al primo salvataggio finivano nel .txt sbagliato.
// ENGLISH: Crash-backup key: folder + file name. It must stay identical across sessions (the
//          backup is re-read after a restart), so it canNOT use makeFolderKeyer's running numbers,
//          which depend on scan order. I use the folder NAME (or the path, when available). With
//          the file name alone, two same-named photos in different subfolders (10_face\img.png and
//          20_body\img.png, the typical LoRA layout) overwrote each other in the backup: after a
//          crash one photo's tags were restored onto the OTHER and the first save wrote them into
//          the wrong .txt.
// ITALIANO: `relPathOf` (quando c'e') porta il percorso RELATIVO completo della sottocartella,
//           es. "anna_bea/char_anna/10_face". Serve perche' l'handle di una cartella espone solo
//           il nome FOGLIA: con quello, char_anna\10_face e char_bea\10_face davano la stessa
//           etichetta e due foto omonime tornavano a condividere la chiave di backup, cioe' il
//           difetto che si voleva chiudere, spostato di un livello di annidamento.
// ENGLISH: `relPathOf` (when present) carries the full RELATIVE subfolder path, e.g.
//          "anna_bea/char_anna/10_face". Needed because a directory handle only exposes its LEAF
//          name: with that, char_anna\10_face and char_bea\10_face produced the same label and two
//          same-named photos shared a backup key again — the very defect this was meant to close,
//          just moved one nesting level deeper.
const makeBackupKeyer = (folderOf: Map<any, any> | null | undefined, relPathOf?: Map<any, string> | null) => {
    return (file: any): string => {
        const rel = relPathOf ? relPathOf.get(file) : undefined;
        if (typeof rel === 'string' && rel !== '') return rel + BACKUP_KEY_SEP + file.name;
        const dir = folderOf ? folderOf.get(file) : null;
        let label = '';
        // ITALIANO: le altre strade (Electron e webkitdirectory) mettono in folderOf un PERCORSO
        //           gia' completo, quindi li' non c'e' ambiguita' e il ripiego va benissimo.
        // ENGLISH: the other paths (Electron and webkitdirectory) store an already COMPLETE path in
        //          folderOf, so there is no ambiguity there and this fallback is fine.
        if (typeof dir === 'string') label = dir;
        else if (dir && typeof dir.name === 'string') label = dir.name;
        return label + BACKUP_KEY_SEP + file.name;
    };
};

// ITALIANO: La cartella di un'immagine va usata come destinazione di salvataggio SOLO se e'
//           un vero handle scrivibile (ha getFileHandle). Le stringhe-percorso servono solo
//           per la chiave qui sopra: non devono mai finire in dirHandle, o il salvataggio
//           su file si romperebbe (una stringa non ha getFileHandle).
// ENGLISH: An image's folder may be used as a save target ONLY if it is a real writable
//          handle (has getFileHandle). Path strings are only for the key above: they must
//          never end up in dirHandle, or saving to file would break (a string has no
//          getFileHandle).
const asDirHandle = (dir: any): any =>
    (dir && typeof dir.getFileHandle === 'function') ? dir : null;

// ITALIANO: ordinamento condiviso da galleria, cestino e visualizzatore (ordina la lista ricevuta
//           e la restituisce). Tenerlo in un posto solo evita che le liste finiscano in ordini
//           diversi fra loro.
// ENGLISH: sorting shared by gallery, trash and viewer (sorts the given list and returns it).
//          Keeping it in one place stops the lists from drifting into different orders.
const applySort = (list: any[], order: string): any[] => {
    if (order === 'name-asc') list.sort((a, b) => a.file.name.localeCompare(b.file.name));
    else if (order === 'name-desc') list.sort((a, b) => b.file.name.localeCompare(a.file.name));
    else if (order === 'date-asc') list.sort((a, b) => a.file.lastModified - b.file.lastModified);
    else if (order === 'date-desc') list.sort((a, b) => b.file.lastModified - a.file.lastModified);
    return list;
};

// ITALIANO: PRESTAZIONI — una singola card della galleria, MEMORIZZATA con React.memo. Prima le
//           miniature erano tutte inline nel corpo di App: ogni piccola modifica (es. un tag su UNA
//           foto) ridisegnava TUTTE le card, e con migliaia di foto la galleria scattava. Ora ogni
//           card si ridisegna SOLO se cambiano le sue proprieta' (il suo oggetto `img`, la sua
//           selezione, ecc.): modificando i tag di una foto si ridisegna solo la sua card. Le
//           funzioni passate come prop sono "stabili" (useCallback in App), condizione necessaria
//           perche' il memo funzioni. content-visibility:auto evita anche di DISEGNARE le card fuori
//           schermo. Nessuna funzione cambia: e' identica alla versione inline di prima.
// ENGLISH: PERF — a single gallery card, MEMOIZED with React.memo. The thumbnails used to be all
//          inline in App's body: any small change (e.g. a tag on ONE photo) re-rendered EVERY card,
//          and with thousands of photos the gallery stuttered. Now each card re-renders ONLY when
//          its own props change (its `img` object, its selection, etc.): editing one photo's tags
//          re-renders only that card. The functions passed as props are "stable" (useCallback in
//          App), which the memo needs. content-visibility:auto also skips PAINTING off-screen cards.
//          No behavior changes: it is identical to the previous inline version.
// ITALIANO: `--card-h` e' l'altezza che il browser RISERVA a una card non ancora disegnata. Era
//           fissa a 320px per tutti e due i modi, ma in "Quadrate" una card e' alta quanto la
//           colonna piu' l'area dei tag: con lo zoom in alto il segnaposto era meno della meta'
//           del vero, quindi alla prima scorsa di una cartella grande la pagina si ricalcolava di
//           continuo e la barra di scorrimento saltava. Il valore arriva dalla griglia (vedi lo
//           stile del contenitore), non come prop: passarlo come prop farebbe ridisegnare TUTTE le
//           card memorizzate mentre si trascina il cursore dello zoom, che oggi e' solo CSS.
// ENGLISH: `--card-h` is the height the browser RESERVES for a card it has not painted yet. It was
//          a flat 320px for both modes, but in "Square" a card is as tall as the column plus the
//          tag area: at high zoom the placeholder was less than half the real thing, so the first
//          pass through a large folder kept re-laying out and the scrollbar jumped. The value comes
//          from the grid (see the container's style), not as a prop: passing it as a prop would
//          re-render EVERY memoised card while dragging the zoom slider, which today is pure CSS.
const GalleryCard = React.memo(function GalleryCard({ img, isDarkMode, viewMode, lang, t, isSelected, copiedCount, onCardClick, onSelectToggle, onTrash, onClose, onCopy, onPaste, onUpdateTags }: any) {
    // ITALIANO: foto piccola, o che il programma non sa mostrare (0x0): vedi qualityWarningText.
    // ENGLISH: a small photo, or one the program cannot display (0x0): see qualityWarningText.
    const qualityWarning = qualityWarningText(t, img.width, img.height);
    const lowQuality = qualityWarning !== null;
    return (
        <div className={`group ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all border flex flex-col h-full ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/50' : ''}`} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto var(--card-h, 320px)' }}>
            <div className={`relative ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} overflow-hidden shrink-0 flex justify-center items-center cursor-pointer ${viewMode === 'square' ? 'aspect-square' : ''}`} style={viewMode === 'original' ? { height: 'auto', minHeight: '120px' } : {}} onClick={() => onCardClick(img.id)}>
                <img src={img.thumb} alt="Preview" loading="lazy" className={`w-full ${viewMode === 'square' ? 'h-full object-cover' : 'h-auto object-contain'} group-hover:scale-[1.02] transition-transform duration-500 ${isSelected ? 'opacity-80' : ''}`} />

                {lowQuality && (
                    <div className="absolute top-2 right-2 z-30 group/alert">
                        <div className="p-1.5 bg-yellow-500 text-white rounded-lg shadow-md cursor-help">
                            <AlertTriangle size={16} strokeWidth={2.5} />
                        </div>
                        <div className="absolute right-0 top-full mt-2 w-64 p-2.5 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/alert:opacity-100 group-hover/alert:visible transition-all duration-200 pointer-events-none whitespace-pre-line border border-gray-700">
                            {qualityWarning}
                        </div>
                    </div>
                )}

                <div className="absolute top-2 left-2 z-20" onClick={(e) => { e.stopPropagation(); onSelectToggle(img.id); }}><div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shadow-sm backdrop-blur-sm ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'bg-black/30 border-white/70 hover:bg-black/50'}`}>{isSelected && <Check size={14} className="text-white" />}</div></div>
                <button onClick={(e) => { e.stopPropagation(); onTrash(img.id); }} className={`absolute top-2 ${lowQuality ? 'right-10' : 'right-2'} p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-20`} title={t.moveToTrash}><Trash2 size={14} /></button>
                {/* ITALIANO: chiude la foto (la toglie dalla vista) senza cestinarla ne' toccarla su disco */}
                {/* ENGLISH: closes the photo (removes it from view) without trashing it or touching the disk */}
                <button onClick={(e) => { e.stopPropagation(); onClose(img.id); }} className={`absolute top-2 ${lowQuality ? 'right-[4.5rem]' : 'right-10'} p-1.5 bg-black/50 hover:bg-amber-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-20`} title={t.closeImageTitle}><X size={14} /></button>
                {/* ITALIANO: Contatore tag della singola foto */}
                {/* ENGLISH: Per-photo tag count */}
                <div className={`absolute bottom-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold shadow-md backdrop-blur-sm ${(img.tags?.length || 0) > 0 ? 'bg-indigo-500/90 text-white' : 'bg-black/50 text-gray-300'}`} title={t.tagCountLabel.replace('{n}', String(img.tags?.length || 0))}>
                    <Tag size={11} />{img.tags?.length || 0}
                </div>
                {/* ITALIANO: Copia/incolla TUTTI i tag di questa foto, dalla galleria (al passaggio del mouse) */}
                {/* ENGLISH: Copy/paste ALL this photo's tags, from the gallery (on hover) */}
                <div className="absolute bottom-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={(e) => { e.stopPropagation(); onCopy(img); }} title={t.copyTags} className="p-1.5 bg-black/50 hover:bg-indigo-500 text-white rounded-full shadow-md transition-colors"><Copy size={13} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onPaste(img); }} disabled={copiedCount === 0} title={copiedCount > 0 ? `${t.pasteTags} (${copiedCount})` : t.pasteTags} className="p-1.5 bg-black/50 hover:bg-emerald-500 text-white rounded-full shadow-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-black/50"><ClipboardPaste size={13} /></button>
                </div>
            </div>
            <div className={`p-3 flex-1 flex flex-col ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                {/* ITALIANO: Area tag sotto l'anteprima, organizzata esteticamente */}
                {/* ENGLISH: Tag area under the preview, aesthetically organized */}
                <div className={`flex-1 rounded-xl border p-1 min-h-0 ${isDarkMode ? 'bg-gray-900/30 border-gray-700/50' : 'bg-gray-50 border-gray-100'}`}>
                    {/* ITALIANO: in "Intere" l'area tag RIEMPIE lo spazio libero della card (prima restava
                                  un grosso vuoto sotto); in "Quadrate" resta limitata a 180px. In entrambi
                                  i casi scorre se i tag sono tanti. */}
                    {/* ENGLISH: in "original/Intere" mode the tag area FILLS the card's free space (there
                                 used to be a big empty gap below); in "square" it stays capped at 180px.
                                 Both scroll when there are many tags. */}
                    <TagInput lang={lang} tags={img.tags} setTags={(newTags: string[]) => onUpdateTags(img.id, newTags)} placeholder={t.addTag} maxHeight={viewMode === 'original' ? 'h-full max-h-none' : 'max-h-[180px]'} isDarkMode={isDarkMode} />
                </div>
            </div>
        </div>
    );
});

export default function App() {
    const [lang, setLang] = useState<string>(detectInitialLang);
    const t = translations[lang as keyof typeof translations];
    // ITALIANO: Al primissimo avvio (nessuna scelta salvata) mostra la schermata di scelta lingua.
    // ENGLISH: On the very first launch (no saved choice) show the language picker screen.
    const [showLangPicker, setShowLangPicker] = useState<boolean>(() => {
        try { return !localStorage.getItem('langChosen'); } catch (_) { return false; }
    });
    // ITALIANO: Lingua solo EVIDENZIATA nella schermata iniziale: non si applica da sola,
    //           serve premere il tasto di conferma.
    // ENGLISH: Language only HIGHLIGHTED in the first-run screen: it is not applied on click,
    //          the user must press the confirm button.
    const [pendingLang, setPendingLang] = useState<string>(lang);
    // ITALIANO: Testi della schermata di scelta lingua: seguono la lingua EVIDENZIATA, non
    //           quella attiva, cosi' tutta la finestra cambia lingua a ogni clic (anteprima).
    // ENGLISH: First-run screen texts: they follow the HIGHLIGHTED language, not the active
    //          one, so the whole window switches language on every click (live preview).
    const tPending = translations[pendingLang as keyof typeof translations] ?? translations.en;
    // ITALIANO: La lingua scelta viene ricordata tra un avvio e l'altro (prima si perdeva).
    // ENGLISH: The chosen language is remembered across launches (it used to be lost).
    useEffect(() => {
        try { localStorage.setItem('lang', lang); } catch (_) { /* ignore */ }
        // ITALIANO: comunico la lingua al processo principale, che la usa per la schermata di avvio
        // ENGLISH: tell the main process the language, which it uses for the splash screen
        try { (window as any).electronAPI?.persistLang?.(lang); } catch (_) { /* ignore */ }
    }, [lang]);
    const [images, setImages] = useState<any[]>([]);
    const [globalTriggers, setGlobalTriggers] = useState<string[]>([]);
    // ITALIANO: Suoni e tema (piu' sotto) vengono ricordati tra un avvio e l'altro, come la lingua.
    //           Prima ripartivano sempre accesi e scuri, mentre l'installazione pulita dice di
    //           cancellarli: vuol dire che sono impostazioni salvate. Senza niente di salvato (o con
    //           localStorage non disponibile) si parte come prima: suoni accesi, tema scuro.
    // ENGLISH: Sounds and theme (below) are remembered across launches, like the language. They
    //          always came back on and dark, while the clean install says it wipes them: that makes
    //          them saved settings. With nothing saved (or localStorage unavailable) the start is as
    //          before: sounds on, dark theme.
    const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
        try { return localStorage.getItem('soundEnabled') !== 'false'; } catch (_) { return true; }
    });

    // ITALIANO: CONTROLLO DELLE VERSIONI NUOVE. Tre stati, non due: 'on', 'off', e NON ANCORA
    //           CHIESTO. Il terzo serve: finche' l'utente non ha risposto il programma non si
    //           collega, e la domanda gli viene fatta una volta sola. La risposta sta in
    //           localStorage e non nei dati cifrati perche' non e' un segreto, e perche'
    //           l'installazione pulita deve poterla azzerare insieme al resto.
    // ENGLISH: NEW VERSION CHECK. Three states, not two: 'on', 'off', and NOT ASKED YET. The
    //          third one matters: until the user answers, the program does not connect, and
    //          the question is asked once. The answer lives in localStorage, not in the
    //          encrypted store: it is not a secret, and a clean install must be able to wipe
    //          it along with everything else.
    // ITALIANO: Il guscio Electron letto una volta per il corpo del componente. Nelle funzioni
    //           piu' sotto resta l'abitudine di rileggerlo in locale: quelle non le tocco.
    //           Nel browser di prova vale undefined, e tutto quello che dipende da lui sparisce
    //           da solo: la domanda non compare e nessun collegamento viene aperto.
    // ENGLISH: The Electron shell, read once for the component body. The functions below keep
    //          reading it locally; those are left alone. In the browser preview it is
    //          undefined, so everything that depends on it disappears by itself: the question
    //          never shows and no connection is ever opened.
    const apiElectron = (window as any).electronAPI;

    const [updateCheckChoice, setUpdateCheckChoice] = useState<'on' | 'off' | null>(() => {
        try { const v = localStorage.getItem('updateCheck'); return v === 'on' || v === 'off' ? v : null; }
        catch (_) { return null; }
    });
    const [updateAskOpen, setUpdateAskOpen] = useState(false);

    // ITALIANO: La scelta di cosa mettere nell'archivio. Tiene dentro anche l'elenco gia'
    //           filtrato, cosi' fra la domanda e l'esportazione non si rischia di lavorare su
    //           un elenco diverso da quello su cui sono stati calcolati numero e peso.
    // ENGLISH: The choice of what goes into the archive. It also holds the already-filtered
    //          list, so the export cannot end up working on a different set than the one the
    //          count and size were computed from.
    const [exportChoice, setExportChoice] = useState<any>(null);

    // ITALIANO: L'ultimo svuotamento del cestino, tenuto da parte per poterlo annullare: le foto
    //           con i loro tag e i percorsi dei file finiti nel Cestino di Windows. Dura quanto
    //           la sessione: chiudendo il programma se ne va, e da li' in poi resta il Cestino
    //           di Windows, che e' comunque la rete di sicurezza vera.
    // ENGLISH: The last emptying of the trash, kept aside so it can be undone: the photos with
    //          their tags and the paths of the files that went to the Windows Recycle Bin. It
    //          lasts as long as the session: close the program and it is gone, and from then on
    //          the Windows Recycle Bin is there, which is the real safety net anyway.
    const [ultimoSvuotamento, setUltimoSvuotamento] = useState<any>(null);
    const [ripristinoInCorso, setRipristinoInCorso] = useState(false);
    // ITALIANO: lo stesso segnale, sempre aggiornato, per handleEmptyTrash: la finestra di conferma
    //           ne conserva la versione del momento in cui e' stata aperta, che non lo vedrebbe.
    // ENGLISH: the same signal, always current, for handleEmptyTrash: the confirm dialog keeps the
    //          version from the moment it opened, which would not see it.
    const ripristinoInCorsoRef = useRef(false);
    // ITALIANO: il numero del progetto aperto: sale a ogni Chiudi progetto e Reset. "Svuota cestino"
    //           e "Annulla lo svuotamento" durano a lungo e intanto il progetto si puo' chiudere (la
    //           X del cestino resta libera): finito il lavoro, se il numero e' cambiato non toccano
    //           niente del progetto di adesso. Prima il tasto "Annulla lo svuotamento" compariva nel
    //           progetto successivo e ci infilava le foto di quello chiuso, con le anteprime rotte.
    // ENGLISH: the number of the open project: it goes up on every Close project and Reset. "Empty
    //          trash" and "Undo the emptying" take long and meanwhile the project can be closed (the
    //          trash's X stays free): when the job ends, if the number changed it touches nothing of
    //          the current project. The "Undo the emptying" button used to appear in the next project
    //          and push the closed project's photos into it, with broken thumbnails.
    const progettoGenRef = useRef(0);
    const [updateFound, setUpdateFound] = useState<{ versione: string; pagina: string } | null>(null);
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        try { return localStorage.getItem('isDarkMode') !== 'false'; } catch (_) { return true; }
    });
    const [sortOrder, setSortOrder] = useState<'name-asc' | 'name-desc' | 'date-asc' | 'date-desc'>('name-asc');
    
    const [dirHandle, setDirHandle] = useState<any>(null);
    
    const [imageWidth, setImageWidth] = useState(300);
    const [trashImageWidth, setTrashImageWidth] = useState(250);
    const [trashSortOrder, setTrashSortOrder] = useState('date-desc'); 
    
    const [viewMode, setViewMode] = useState('square'); 
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null); 
    const [slideDirection, setSlideDirection] = useState('right');
    const [toast, setToast] = useState({ show: false, message: '', type: 'info', id: 0 });
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} });
    // ITALIANO: Finestra a tre scelte mostrata chiudendo il progetto con modifiche non salvate
    // ENGLISH: Three-choice dialog shown when closing the project with unsaved changes
    const [saveCloseDialog, setSaveCloseDialog] = useState({ isOpen: false, isSaving: false });
    // ITALIANO: Editor di tag: apre/crea file .txt e .json di tag, indipendente dal progetto
    // ENGLISH: Tag editor: opens/creates .txt and .json tag files, independent of the project
    const [isTagEditorOpen, setIsTagEditorOpen] = useState(false);
    const [importSummary, setImportSummary] = useState<{ isOpen: boolean, summary: any, pendingData: any }>({ isOpen: false, summary: null, pendingData: null });
    const [selectedForBulk, setSelectedForBulk] = useState<string[]>([]);
    const [stagedBulkTags, setStagedBulkTags] = useState<string[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isTrashOpen, setIsTrashOpen] = useState(false);
    // ITALIANO: acceso mentre lo svuotamento sta spostando i file: spegne "Ripristina tutte" e
    //           "Svuota cestino", che restano a schermo perche' la finestra ora non si chiude subito.
    // ENGLISH: on while the empty is moving files: disables "Restore all" and "Empty trash", which
    //          stay on screen now that the window no longer closes right away.
    const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    // ITALIANO: quanti import sono in corso (processImportData). Un secondo import puo' partire
    //           durante il primo: chi finisce prima non deve spegnere la striscia dell'altro.
    // ENGLISH: how many imports are running (processImportData). A second import can start during
    //          the first: whichever ends first must not switch off the other's strip.
    const importAttiviRef = useRef(0);
    const [importProgress, setImportProgress] = useState(0);
    // ITALIANO: Stessa barra di avanzamento, ma durante il SALVATAGGIO. Riusa importProgress
    //           per la percentuale; isSaving decide se mostrarla e con quale etichetta.
    // ENGLISH: Same progress bar, but during SAVING. Reuses importProgress for the percentage;
    //          isSaving controls whether it shows and with which label.
    const [isSaving, setIsSaving] = useState(false);

    const [isStatsOpen, setIsStatsOpen] = useState(false);
    // ITALIANO: ricerca e ordinamento della lista completa dei tag nelle statistiche
    // ENGLISH: search and sort for the full tag list in the statistics
    const [statsSearch, setStatsSearch] = useState('');
    // ITALIANO: ricerca dentro il pannello di selezione in blocco (filtra le pillole dei tag).
    // ENGLISH: search inside the bulk-selection panel (filters the tag pills).
    const [bulkSearch, setBulkSearch] = useState('');
    // ITALIANO: ricerca per tag nella PAGINA PRINCIPALE (filtra le immagini). Uno o piu' tag separati
    //           da virgola/spazio; un'immagine passa se contiene TUTTI i termini indicati.
    // ENGLISH: tag search on the MAIN PAGE (filters images). One or more tags separated by comma/space;
    //          an image passes if it contains ALL the given terms.
    const [tagSearch, setTagSearch] = useState('');
    // ITALIANO: true mentre si trascinano file sopra la finestra (per mostrare l'area di rilascio).
    // ENGLISH: true while files are dragged over the window (to show the drop overlay).
    const [isDragging, setIsDragging] = useState(false);
    // ITALIANO: PRESTAZIONI — la ricerca nella lista tag delle statistiche usa un valore "differito":
    //           mentre scrivi, la casella resta immediata ma il filtro/ordinamento e il ridisegno
    //           della lista (potenzialmente decine di migliaia di righe) vengono aggiornati con calma,
    //           senza far scattare la digitazione. Il comportamento e' identico, solo piu' fluido.
    // ENGLISH: PERF — the stats tag-list search uses a DEFERRED value: while you type the input stays
    //          immediate, but the filter/sort and the (potentially tens-of-thousands-of-rows) list
    //          re-render are updated lazily, so typing does not stutter. Same behavior, just smoother.
    const deferredStatsSearch = useDeferredValue(statsSearch);
    const [statsSort, setStatsSort] = useState<'count' | 'name'>('count');
    // ITALIANO: "Appunti" dei tag: copiati da una foto, incollabili su un'altra.
    // ENGLISH: Tag "clipboard": copied from one photo, pasteable onto another.
    const [copiedTags, setCopiedTags] = useState<string[] | null>(null);

    // ITALIANO: Pulizia della sola chiave legacy 'customPrompt' (vecchia AI locale).
    //           NON rimuovere 'geminiApiKey' (getSecret la migra in safeStorage) né 'aiModel' (chiave viva).
    // ENGLISH: Cleanup of the legacy 'customPrompt' key only (old local AI).
    //          Do NOT remove 'geminiApiKey' (getSecret migrates it into safeStorage) nor 'aiModel' (live key).
    useEffect(() => {
        try {
            localStorage.removeItem('customPrompt');
        } catch (_) { /* ignore */ }
    }, []);

    // ITALIANO: Configurazione AI cloud (Gemini), persistente
    // ENGLISH: Cloud AI config (Gemini), persistent
    const [aiEnabled, setAiEnabled] = useState<boolean>(() => localStorage.getItem('aiEnabled') === 'true');
    // ITALIANO: normalizeModelId riporta a un modello valido chi aveva salvato uno dei
    //           modelli poi rimossi (altrimenti l'AI fallirebbe a ogni chiamata).
    // ENGLISH: normalizeModelId brings anyone who saved a since-removed model back to a
    //          valid one (otherwise every AI call would fail).
    const [aiModel, setAiModel] = useState<string>(() => normalizeModelId(localStorage.getItem('aiModel')));
    const [aiMaxTags, setAiMaxTags] = useState<number>(() => {
        const v = parseInt(localStorage.getItem('aiMaxTags') || '30', 10);
        return Number.isFinite(v) ? Math.max(1, Math.min(80, v)) : 30;
    });
    const [aiCustomPrompt, setAiCustomPrompt] = useState<string>(() => localStorage.getItem('aiCustomPrompt') || '');
    const [aiRpm, setAiRpm] = useState<number>(() => {
        const v = parseInt(localStorage.getItem('aiRpm') || '14', 10);
        return Number.isFinite(v) ? Math.max(5, Math.min(60, v)) : 14;
    });
    const [aiSkipTagged, setAiSkipTagged] = useState<boolean>(() => localStorage.getItem('aiSkipTagged') !== 'false');
    const aiCancelRequestedRef = useRef<boolean>(false);
    // ITALIANO: Stato gemello del ref aiCancelRequestedRef — solo per aggiornare l'UI del pulsante Annulla
    // ENGLISH: Mirror state of aiCancelRequestedRef — UI-only signal for the Cancel button
    const [aiCancelRequested, setAiCancelRequested] = useState<boolean>(false);
    // ITALIANO: AbortController del batch AI in corso — permette di interrompere anche la richiesta HTTP appesa
    // ENGLISH: AbortController of the running AI batch — lets Cancel interrupt even a hung HTTP request
    const aiAbortControllerRef = useRef<AbortController | null>(null);
    const [geminiApiKey, setGeminiApiKey] = useState<string>('');
    const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState<boolean>(false);
    const [tempApiKey, setTempApiKey] = useState<string>('');
    const [isApiKeyGuideOpen, setIsApiKeyGuideOpen] = useState<boolean>(false);
    const [isVerifyingApiKey, setIsVerifyingApiKey] = useState<boolean>(false);
    const [apiKeyError, setApiKeyError] = useState<string>('');
    const [isAIBusy, setIsAIBusy] = useState<boolean>(false);
    const [isGlobalAITagging, setIsGlobalAITagging] = useState<boolean>(false);
    const [globalAIProgress, setGlobalAIProgress] = useState<{ done: number; total: number; ok: number; errors: number; skipped: number }>({ done: 0, total: 0, ok: 0, errors: 0, skipped: 0 });
    const apiKeyLoadedRef = useRef<boolean>(false);

    // ITALIANO: Versione mostrata nelle impostazioni — letta da package.json tramite Electron,
    //           così nell'exe è SEMPRE aggiornata senza doverla cambiare a mano. In browser/dev
    //           usa il valore di riserva qui sotto.
    // ENGLISH: Version shown in settings — read from package.json via Electron, so the built app
    //          is ALWAYS current without a manual edit. In browser/dev it uses the fallback below.
    const [appVersion, setAppVersion] = useState<string>('1.3.0');
    useEffect(() => {
        const api = (window as any).electronAPI;
        if (api && typeof api.getAppVersion === 'function') {
            api.getAppVersion().then((v: string) => { if (v) setAppVersion(v); }).catch(() => {});
        }
    }, []);

    useEffect(() => { localStorage.setItem('aiEnabled', String(aiEnabled)); }, [aiEnabled]);
    useEffect(() => { localStorage.setItem('aiModel', aiModel); }, [aiModel]);
    useEffect(() => { localStorage.setItem('aiMaxTags', String(aiMaxTags)); }, [aiMaxTags]);
    useEffect(() => { localStorage.setItem('aiCustomPrompt', aiCustomPrompt); }, [aiCustomPrompt]);
    useEffect(() => { localStorage.setItem('aiRpm', String(aiRpm)); }, [aiRpm]);
    useEffect(() => { localStorage.setItem('aiSkipTagged', String(aiSkipTagged)); }, [aiSkipTagged]);
    // ITALIANO: tema e suoni scelti in Impostazioni (letti all'avvio, vedi soundEnabled).
    // ENGLISH: theme and sounds picked in Settings (read at start, see soundEnabled).
    useEffect(() => { try { localStorage.setItem('isDarkMode', String(isDarkMode)); } catch (_) { /* ignore */ } }, [isDarkMode]);
    useEffect(() => { try { localStorage.setItem('soundEnabled', String(soundEnabled)); } catch (_) { /* ignore */ } }, [soundEnabled]);

    // ITALIANO: Carico la API key dallo storage cifrato all'avvio
    // ENGLISH: Load the API key from encrypted storage on mount
    useEffect(() => {
        let cancelled = false;
        getSecret('geminiApiKey').then((value) => {
            if (cancelled) return;
            if (value) setGeminiApiKey(value);
            apiKeyLoadedRef.current = true;
            setChiaveApiCaricata(true);
        }).catch(() => { apiKeyLoadedRef.current = true; setChiaveApiCaricata(true); });
        return () => { cancelled = true; };
    }, []);

    // ITALIANO: Segnale di "APP PRONTA": la pagina ha finito di caricare tutto (immagini, font
    //           compresi) E la chiave cifrata e' stata letta. Serve alla schermata di
    //           caricamento, che deve restare finche' l'app non e' davvero pronta.
    // ENGLISH: "APP READY" signal: the page finished loading everything (images and fonts
    //          included) AND the encrypted key has been read. The loading screen uses it to stay
    //          up until the app is genuinely ready.
    useEffect(() => {
        if (document.readyState === 'complete') { setPaginaCaricata(true); return undefined; }
        const onLoad = () => setPaginaCaricata(true);
        window.addEventListener('load', onLoad, { once: true });
        return () => window.removeEventListener('load', onLoad);
    }, []);

    // ITALIANO: Persisti la API key in safeStorage (cifrata) appena cambia
    // ENGLISH: Persist the API key in safeStorage (encrypted) on every change
    useEffect(() => {
        if (!apiKeyLoadedRef.current) return;
        setSecret('geminiApiKey', geminiApiKey).then((ok) => {
            // ITALIANO: Fail-closed: se lo storage cifrato non è disponibile la chiave NON viene
            //           salvata in chiaro — avvisiamo l'utente che resterà valida solo per la sessione
            // ENGLISH: Fail-closed: if encrypted storage is unavailable the key is NOT saved in
            //          cleartext — warn the user it will only last for this session
            if (!ok && geminiApiKey) {
                showNotification(t.apiKeyNotSaved, 'error');
            }
        }).catch(err => console.error('Failed to persist API key', err));
    }, [geminiApiKey]);

    useEffect(() => {
        if (isApiKeyDialogOpen) {
            setTempApiKey(geminiApiKey);
            setApiKeyError('');
        }
    }, [isApiKeyDialogOpen, geminiApiKey]);

    // ITALIANO: Cancella la API key cifrata e termina sessione AI
    // ENGLISH: Wipe the encrypted API key and end AI session
    const handleClearApiKey = useCallback(async () => {
        try {
            // ITALIANO: Ferma SUBITO un eventuale batch in corso — altrimenti continuerebbe
            //           invisibile (e non annullabile) con la vecchia chiave catturata nella closure
            // ENGLISH: Stop any running batch IMMEDIATELY — otherwise it would keep running
            //          invisibly (and uncancellably) with the old key captured in its closure
            aiCancelRequestedRef.current = true;
            setAiCancelRequested(true);
            aiAbortControllerRef.current?.abort();
            const cancellata = await deleteSecret('geminiApiKey');
            setGeminiApiKey('');
            setIsAIBusy(false);
            setIsGlobalAITagging(false);
            setGlobalAIProgress({ done: 0, total: 0, ok: 0, errors: 0, skipped: 0 });
            // ITALIANO: la sessione smette comunque di usarla, ma "rimossa" si dice solo se e' vero:
            //           altrimenti al prossimo avvio la chiave torna, e l'utente lo deve sapere.
            // ENGLISH: the session stops using it either way, but "removed" is said only when true:
            //          otherwise the key comes back at the next start, and the user must know.
            if (!cancellata) {
                showNotification(t.aiKeyNotRemoved, 'error');
                return;
            }
            soundManager.chime();
            showNotification(t.aiKeyCleared || 'API Key removed', 'success');
        } catch (e: any) {
            console.error('Failed to clear API key', e);
            showNotification(`${t.aiError || 'AI Error'}: ${e?.message || ''}`.trim(), 'error');
        }
    }, [t]);

    const [isGlobalTagManagerOpen, setIsGlobalTagManagerOpen] = useState(false);
    const [isTagSuggestionsOpen, setIsTagSuggestionsOpen] = useState(false);
    const [customProjectTags, setCustomProjectTags] = useState<string[]>([]);
    const [showSplash, setShowSplash] = useState(true);
    const [splashProgress, setSplashProgress] = useState(0);
    // ITALIANO: i due pezzi del segnale "app pronta" usato dalla schermata di caricamento
    // ENGLISH: the two halves of the "app ready" signal used by the loading screen
    const [paginaCaricata, setPaginaCaricata] = useState(false);
    const [chiaveApiCaricata, setChiaveApiCaricata] = useState(false);

    const folderInputRef = useRef<HTMLInputElement>(null);
    const settingsRef = useRef<HTMLDivElement>(null);
    // ITALIANO: Specchio sempre aggiornato di `images` per i loop async (evita snapshot stantii che sovrascrivono le modifiche manuali)
    // ENGLISH: Always-fresh mirror of `images` for async loops (avoids stale snapshots that overwrite manual edits)
    const imagesRef = useRef<any[]>([]);
    // ITALIANO: le trigger word di ADESSO, per l'import che le legge dopo lunghe attese (le miniature
    //           di migliaia di foto): la sua copia di globalTriggers e' quella di quando si e' premuto
    //           Importa. Prima una trigger scritta (o tolta) nel frattempo non arrivava alle foto in
    //           arrivo, e i loro .txt si salvavano diversi da quello che il riquadro mostrava. Si
    //           aggiorna a ogni render e subito in handleGlobalTagsChange.
    // ENGLISH: the CURRENT trigger words, for the import that reads them after long waits (the
    //          thumbnails of thousands of photos): its copy of globalTriggers is the one from when
    //          Import was pressed. A trigger typed (or removed) meanwhile used to miss the incoming
    //          photos, and their .txt files were saved unlike what the box showed. It is updated on
    //          every render and at once in handleGlobalTagsChange.
    const globalTriggersRef = useRef<string[]>(globalTriggers);
    globalTriggersRef.current = globalTriggers;
    // ITALIANO: Le foto CHIUSE con la "x" (per id): tolte dalla vista ma ancora su disco, quindi
    //           ancora contate nell'impronta del backup anti-crash (vedi costruisciBackup). Ne
    //           escono solo quando il file lascia davvero il disco (cestino svuotato, eliminata per
    //           sempre) e si azzerano con Chiudi progetto e Reset.
    // ENGLISH: The photos CLOSED with the "x" (by id): out of view but still on disk, so still
    //          counted in the crash backup's fingerprint (see costruisciBackup). They leave only
    //          when the file really leaves the disk (trash emptied, deleted for good) and are
    //          cleared by Close project and Reset.
    const fotoChiuseRef = useRef<Map<string, FotoChiusa>>(new Map());
    // ITALIANO: TUTTE le anteprime create per il progetto (import e ricarico dopo un ritocco
    //           esterno). Le foto chiuse con la X o cancellate per sempre escono dall'elenco ma la
    //           loro anteprima resta viva (Ctrl+Z le riporta), e alla chiusura nessuno la vedeva
    //           piu': restava in memoria per tutta la sessione. Chiudi progetto e Reset le liberano
    //           tutte da qui (vedi liberaAnteprimeProgetto).
    // ENGLISH: EVERY thumbnail made for the project (import and reload after an outside retouch).
    //          Photos closed with the X or deleted for good leave the list but their thumbnail stays
    //          alive (Ctrl+Z brings them back), and on close nobody saw it any more: it stayed in
    //          memory for the whole session. Close project and Reset release them all from here
    //          (see liberaAnteprimeProgetto).
    const anteprimeProgettoRef = useRef<Set<string>>(new Set());

    const [history, setHistory] = useState<any[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    // ITALIANO: le trigger word di ogni passo della cronologia, allo stesso indice del passo. Il
    //           riquadro delle trigger e le foto cambiano insieme (handleGlobalTagsChange) in un solo
    //           passo, ma la cronologia ricordava solo le foto: Ctrl+Z toglieva la trigger dalle foto e
    //           il riquadro continuava a mostrarla (o il contrario, e il .txt non la scriveva piu' per
    //           prima). Il numero dei passi resta uguale a quello di `history`: si taglia, si aggiunge
    //           e si accorcia insieme a lei, e le pulizie della cronologia non cambiano i passi.
    // ENGLISH: the trigger words of every history step, at the same index as the step. The trigger
    //          box and the photos change together (handleGlobalTagsChange) in one step, but the
    //          history remembered only the photos: Ctrl+Z took the trigger off the photos while the
    //          box kept showing it (or the other way round, and the .txt no longer wrote it first).
    //          The number of steps stays the same as `history`: it is cut, pushed and shortened
    //          along with it, and the history clean-ups do not change the steps.
    const triggerHistoryRef = useRef<string[][]>([]);

    const handleSuggestedTagClick = (tag: string) => {
        if (selectedImageId) {
            // Siamo nella Lightbox
            const image = images.find(img => img.id === selectedImageId);
            if (image && !image.tags.includes(tag)) {
                updateImageTags(selectedImageId, [...image.tags, tag]);
                soundManager.pop();
            }
        } else if (selectedForBulk.length > 0) {
            // Siamo nella vista principale con immagini selezionate
            if (!stagedBulkTags.includes(tag)) {
                setStagedBulkTags(prev => [...prev, tag]);
                soundManager.pop();
            }
        } else {
            showNotification(t.selectImagesFirst || "Seleziona una o più immagini per aggiungere tag", "info");
        }
    };
    const isUndoRedoAction = useRef(false);

    useEffect(() => {
        if (isUndoRedoAction.current) {
            isUndoRedoAction.current = false;
            return;
        }
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(images);
            if (newHistory.length > 50) newHistory.shift();
            return newHistory;
        });
        // ITALIANO: le trigger di questo passo, con gli stessi tagli della cronologia qui sopra.
        // ENGLISH: this step's triggers, with the same cuts as the history above.
        const triggerPassi = triggerHistoryRef.current.slice(0, historyIndex + 1);
        triggerPassi.push(globalTriggers);
        if (triggerPassi.length > 50) triggerPassi.shift();
        triggerHistoryRef.current = triggerPassi;
        // ITALIANO: l'indice dallo stesso historyIndex dei tagli qui sopra, non da `prev + 1`: React
        //           in StrictMode (anteprima di sviluppo) ripete l'effetto all'avvio, e con `prev + 1`
        //           l'indice finiva un passo oltre l'ultimo (il primo Ctrl+Z non faceva niente).
        // ENGLISH: the index from the same historyIndex as the cuts above, not from `prev + 1`: React
        //          in StrictMode (development preview) repeats the effect on mount, and with
        //          `prev + 1` the index ended one step past the last (the first Ctrl+Z did nothing).
        setHistoryIndex(Math.min(historyIndex + 1, 49));
    }, [images]);

    useEffect(() => { imagesRef.current = images; }, [images]);

    // ITALIANO: cosa c'e' su disco per ogni foto (id -> l'ultimo originalTags visto), tenuto FUORI
    //           dalla cronologia. Ctrl+Z e Ctrl+Shift+Z lo rimettono sulle foto che riportano a
    //           schermo (vedi withLiveOriginalTags), anche su quelle che in quel momento non erano
    //           in galleria (Ctrl+Z oltre l'import, foto chiusa con la X): prima tornavano con il
    //           valore dell'import e risultavano "uguali al disco" dopo un salvataggio. Ogni
    //           scrittura di originalTags (import, Salva, il visualizzatore, l'editor di tag) passa
    //           da setImages, quindi da qui. Si svuota con la cronologia (Reset, Chiudi progetto).
    // ENGLISH: what is on disk for each photo (id -> the last originalTags seen), kept OUTSIDE the
    //          history. Ctrl+Z and Ctrl+Shift+Z put it on the photos they bring back on screen (see
    //          withLiveOriginalTags), also on those that were not in the gallery at that moment
    //          (Ctrl+Z past the import, a photo closed with the X): they used to come back with the
    //          import's value and count as "same as disk" after a save. Every write of originalTags
    //          (import, Save, the viewer, the tag editor) goes through setImages, hence through
    //          here. It is cleared together with the history (Reset, Close project).
    const discoNotoRef = useRef<Map<string, unknown>>(new Map());
    useEffect(() => {
        images.forEach((foto: any) => discoNotoRef.current.set(foto.id, foto.originalTags));
    }, [images]);

    // ITALIANO: PRESTAZIONI — copia "sempre aggiornata" della selezione, per far leggere lo stato ai
    //           gestori della galleria SENZA doverli ricreare ad ogni cambio di selezione (cosi' le
    //           card memorizzate non si ridisegnano tutte). Vedi GalleryCard piu' in basso.
    // ENGLISH: PERF — an always-current copy of the selection, so the gallery handlers can read the
    //          state WITHOUT being recreated on every selection change (keeping the memoized cards
    //          from all re-rendering). See GalleryCard below.
    const selectedForBulkRef = useRef<string[]>([]);
    useEffect(() => { selectedForBulkRef.current = selectedForBulk; }, [selectedForBulk]);

    // ITALIANO: quando la selezione in blocco si svuota (deseleziona tutto, si toglie l'ultima foto,
    //           si cestina/chiude/elimina l'ultima selezionata) azzero anche i tag "in preparazione".
    //           Prima restavano armati: riaprendo il pannello per un ALTRO gruppo di foto comparivano
    //           gia' pronti col tasto Conferma attivo, e un clic li applicava a foto sbagliate.
    // ENGLISH: when the bulk selection becomes empty (deselect-all, unticking the last photo,
    //          trashing/closing/deleting the last selected one) also clear the STAGED tags. They
    //          used to survive: reopening the panel for a DIFFERENT set of photos showed them already
    //          armed with Confirm live, and one click applied them to the wrong photos.
    useEffect(() => {
        if (selectedForBulk.length === 0 && stagedBulkTags.length > 0) setStagedBulkTags([]);
    }, [selectedForBulk.length, stagedBulkTags.length]);

    // ITALIANO: Backup automatico (debounce 1s) dei tag in localStorage — rete anti-crash: al
    //           re-import della cartella le modifiche non salvate vengono ripristinate.
    //           Contiene SOLO le foto con modifiche non salvate, con un'impronta per ogni cartella
    //           aperta (le regole e il perche' stanno in costruisciBackup). Quando non resta niente
    //           da salvare si cancella da solo; Reset lo cancella, Chiudi progetto ne toglie le
    //           cartelle in memoria e tiene quelle mai riaperte dopo un crash. Con la
    //           lista vuota all'avvio del programma (nessuna foto ancora entrata) non si tocca: e'
    //           proprio li' che serve il recupero dopo un crash. Dopo, una lista vuota vuol dire
    //           che l'utente ha chiuso tutte le foto, e il backup si ricalcola come sempre: prima
    //           restava, e chiudendo l'ultima foto con la X ("le modifiche andranno perse") le
    //           modifiche buttate via tornavano al caricamento successivo come "recuperate".
    // ENGLISH: Debounced (1s) automatic backup of the tags to localStorage — crash safety net:
    //          re-importing the folder restores unsaved edits.
    //          It holds ONLY the photos with unsaved edits, with one fingerprint per open folder
    //          (the rules and the why live in costruisciBackup). When nothing is left unsaved it
    //          removes itself; Reset removes it, Close project drops the folders in memory from it
    //          and keeps those never reopened after a crash. With an empty list at program
    //          start (no photo loaded yet) it is left alone: that is exactly when crash recovery is
    //          needed. Afterwards an empty list means the user closed every photo, and the backup is
    //          recomputed as always: it used to stay, and closing the last photo with the X ("the
    //          changes will be lost") brought the discarded edits back on the next load as
    //          "recovered".
    const backupConFotoRef = useRef(false);
    useEffect(() => {
        if (images.length > 0) backupConFotoRef.current = true;
        else if (!backupConFotoRef.current) return undefined;
        const handle = setTimeout(() => {
            const folder = (dirHandle && dirHandle.name) ? String(dirHandle.name) : '';
            scriviBackupSubito(localStorage, images, fotoChiuseRef.current.values(), folder, globalTriggersRef.current);
        }, 1000);
        return () => clearTimeout(handle);
    }, [images, dirHandle]);

    // ITALIANO: CHIUSURA DELLA FINESTRA (X, Alt+F4). "Chiudi progetto" con modifiche non salvate
    //           chiede Salva e chiudi / Chiudi senza salvare / Annulla; la X invece chiudeva subito,
    //           e una modifica fatta meno di un secondo prima non finiva nemmeno nel backup (il suo
    //           timer moriva con la pagina). Ora alla chiusura il backup si scrive SUBITO e, in
    //           Electron, con modifiche non salvate la chiusura si ferma e compare la STESSA finestra
    //           a tre scelte: "Chiudi senza salvare" e un "Salva e chiudi" riuscito chiudono poi la
    //           finestra davvero (chiudiFinestraSeRichiesto). Electron ferma la chiusura in silenzio
    //           perche' il processo principale non ascolta 'will-prevent-unload'. Nell'anteprima del
    //           browser non si ferma niente: si scrive solo il backup. Con l'app smontata (schermata
    //           d'errore) l'ascolto non c'e' piu', e il pulsante che ricarica resta libero.
    // ENGLISH: CLOSING THE WINDOW (X, Alt+F4). "Close project" with unsaved edits asks Save and
    //          close / Close without saving / Cancel; the X instead closed at once, and an edit made
    //          less than a second earlier did not even reach the backup (its timer died with the
    //          page). Now on close the backup is written AT ONCE and, in Electron, with unsaved edits
    //          the close stops and the SAME three-choice dialog shows: "Close without saving" and a
    //          successful "Save and close" then really close the window (chiudiFinestraSeRichiesto).
    //          Electron stops the close silently because the main process does not listen for
    //          'will-prevent-unload'. In the browser preview nothing is stopped: only the backup is
    //          written. With the app unmounted (error screen) the listener is gone, and the button
    //          that reloads stays free.
    const permettiChiusuraRef = useRef(false);
    const chiusuraFinestraRef = useRef(false);
    // ITALIANO: l'editor dei file di tag ha modifiche non salvate (le segnala lui, onDirtyChange). La
    //           sua X chiede prima di buttarle; la X della finestra e Alt+F4 invece chiudevano subito
    //           e la bozza spariva, anche senza nessuna foto aperta. Ora, in Electron, la chiusura si
    //           ferma, l'editor resta in vista e un avviso dice di salvare o scartare prima. La
    //           finestra a tre scelte non va bene qui: il suo "Salva e chiudi" non salva l'editor.
    // ENGLISH: the tag file editor has unsaved edits (it reports them itself, onDirtyChange). Its X
    //          asks before throwing them away; the window's X and Alt+F4 instead closed at once and
    //          the draft was gone, with no photo open too. Now, in Electron, the close stops, the
    //          editor stays in view and a notice says to save or discard first. The three-choice
    //          dialog does not fit here: its "Save and close" does not save the editor.
    const tagEditorDirtyRef = useRef(false);
    const segnaEditorSporco = useCallback((sporco: boolean) => { tagEditorDirtyRef.current = sporco; }, []);
    const saveCloseDialogRef = useRef(saveCloseDialog);
    saveCloseDialogRef.current = saveCloseDialog;
    // ITALIANO: un salvataggio o un'esportazione sta scrivendo (isSaving). La X della finestra
    //           chiudeva anche a meta' archivio, senza chiedere niente se non c'erano modifiche, e
    //           l'archivio a meta' andava perso. Ora la PRIMA X durante una scrittura si ferma e
    //           avvisa; una seconda X chiude comunque (chiusuraInScritturaRef), cosi' un'esportazione
    //           bloccata non tiene la finestra aperta per sempre. Finita la scrittura si riparte da capo.
    // ENGLISH: a save or an export is writing (isSaving). The window's X closed even mid-archive,
    //          asking nothing when there were no edits, and the half-written archive was lost. Now the
    //          FIRST X during a write stops and warns; a second X closes anyway
    //          (chiusuraInScritturaRef), so a stuck export does not keep the window open forever. Once
    //          the write is over it starts again from scratch.
    const isSavingRef = useRef(isSaving);
    isSavingRef.current = isSaving;
    const chiusuraInScritturaRef = useRef(false);
    if (!isSaving) chiusuraInScritturaRef.current = false;
    useEffect(() => {
        const allaChiusura = (e: BeforeUnloadEvent) => {
            // ITALIANO: l'utente ha gia' deciso (salvato, o chiuso senza salvare): si chiude e basta.
            // ENGLISH: the user already decided (saved, or closed without saving): just close.
            if (permettiChiusuraRef.current) return;
            const lista = imagesRef.current;
            const editorSporco = tagEditorDirtyRef.current;
            // ITALIANO: con l'elenco vuoto il backup si riscrive lo stesso se nella sessione c'erano
            //           foto (backupConFotoRef, come l'effetto col timer): chiusa l'ultima foto con la X
            //           e la finestra entro un secondo, il timer moriva con la pagina e le modifiche
            //           buttate via tornavano come "recuperate". All'avvio (nessuna foto) non si tocca.
            // ENGLISH: with an empty list the backup is still rewritten when the session had photos
            //          (backupConFotoRef, as the timer effect does): with the last photo closed with the
            //          X and the window within a second, the timer died with the page and the discarded
            //          edits came back as "recovered". At start-up (no photo) it is left alone.
            const conFoto = lista.length > 0 || backupConFotoRef.current;
            if (!conFoto && !editorSporco) return;
            const folder = (dirHandle && dirHandle.name) ? String(dirHandle.name) : '';
            if (conFoto) scriviBackupSubito(localStorage, lista, fotoChiuseRef.current.values(), folder, globalTriggersRef.current);
            if (!(window as any).electronAPI) return;
            // ITALIANO: una scrittura in corso (vedi isSavingRef): la prima X si ferma e avvisa.
            // ENGLISH: a write in progress (see isSavingRef): the first X stops and warns.
            if (isSavingRef.current && !chiusuraInScritturaRef.current) {
                e.preventDefault();
                e.returnValue = false;
                chiusuraInScritturaRef.current = true;
                setTimeout(() => showNotification(t.closeWhileWriting, 'info'), 0);
                return;
            }
            // ITALIANO: prima la bozza dell'editor (vedi tagEditorDirtyRef); le foto si chiedono alla X dopo.
            // ENGLISH: the editor's draft first (see tagEditorDirtyRef); the photos are asked at the next X.
            if (editorSporco) {
                e.preventDefault();
                e.returnValue = false;
                setTimeout(() => { setIsTagEditorOpen(true); showNotification(t.tagEditorUnsavedOnWindowClose, 'info'); }, 0);
                return;
            }
            if (!modificheNonSalvate(lista, globalTriggersRef.current)) return;
            e.preventDefault();
            // ITALIANO: come chiede la guida di Electron: returnValue esplicito, non solo preventDefault.
            // ENGLISH: as Electron's guide asks: an explicit returnValue, not just preventDefault.
            e.returnValue = false;
            chiusuraFinestraRef.current = true;
            // ITALIANO: l'editor (senza modifiche, a questo punto) si mette via: la finestra a tre
            //           scelte sta sotto di lui e restava nascosta.
            // ENGLISH: the editor (with no edits, at this point) is put away: the three-choice dialog
            //          sits below it and stayed hidden.
            if (!saveCloseDialogRef.current.isOpen) setTimeout(() => { setIsTagEditorOpen(false); setSaveCloseDialog({ isOpen: true, isSaving: false }); }, 0);
        };
        window.addEventListener('beforeunload', allaChiusura);
        return () => window.removeEventListener('beforeunload', allaChiusura);
    }, [dirHandle, t]);

    // ITALIANO: dopo "Chiudi senza salvare" o un "Salva e chiudi" riuscito: se la domanda era nata
    //           dalla X della finestra, la finestra si chiude davvero; se era nata da "Chiudi
    //           progetto", resta aperta come sempre.
    // ENGLISH: after "Close without saving" or a successful "Save and close": if the question came
    //          from the window's X, the window really closes; if it came from "Close project", it
    //          stays open as always.
    const chiudiFinestraSeRichiesto = () => {
        if (!chiusuraFinestraRef.current) return;
        chiusuraFinestraRef.current = false;
        permettiChiusuraRef.current = true;
        window.close();
    };

    // ITALIANO: Ctrl+Z e Ctrl+Shift+Z rimettono i tag del passo, ma non il ricordo di cosa c'e' su
    //           disco: quello resta l'ultimo noto (discoNotoRef, vedi withLiveOriginalTags).
    //           Prima, dopo un salvataggio, annullare riportava indietro anche lui e l'app diceva
    //           "niente da salvare" mentre il .txt conteneva ancora i tag appena tolti.
    // ENGLISH: Ctrl+Z and Ctrl+Shift+Z put back the step's tags, but not the record of what is on
    //          disk: that stays the last known one (discoNotoRef, see withLiveOriginalTags). After
    //          a save, undoing used to roll it back too, and the app said "nothing to save" while
    //          the .txt still held the tags just removed.
    // ITALIANO: si salta al passo piu' vicino DIVERSO da quello attuale (vedi nearestDifferentStep):
    //           le foto uscite dal disco lasciano passi identici, e un Ctrl+Z li' diceva "Azione
    //           annullata" senza cambiare niente. Se non c'e' un passo diverso, niente e nessun avviso.
    // ENGLISH: jump to the nearest step DIFFERENT from the current one (see nearestDifferentStep):
    //          photos that left the disk leave identical steps, and a Ctrl+Z there said "Action
    //          undone" without changing anything. With no different step: nothing, and no notice.
    // ITALIANO: e rimettono anche il riquadro delle trigger com'era in quel passo (triggerHistoryRef),
    //           tranne quando si torna alla galleria vuota di prima dell'import: una trigger scritta
    //           prima di importare non deve sparire per questo.
    // ENGLISH: and they also put the trigger box back as it was at that step (triggerHistoryRef),
    //          except when going back to the empty gallery from before the import: a trigger typed
    //          before importing must not vanish because of that.
    const handleUndo = useCallback(() => {
        const passo = nearestDifferentStep(history, historyIndex, -1);
        if (passo >= 0) {
            isUndoRedoAction.current = true;
            setHistoryIndex(passo);
            setImages(withLiveOriginalTags(history[passo], discoNotoRef.current));
            const triggerDelPasso = triggerHistoryRef.current[passo];
            if (triggerDelPasso && history[passo].length > 0) { globalTriggersRef.current = triggerDelPasso; setGlobalTriggers(triggerDelPasso); }
            setToast({ show: true, message: t.undoSuccess || "Azione annullata", type: 'info', id: Date.now() });
        }
    }, [history, historyIndex, t]);

    const handleRedo = useCallback(() => {
        const passo = nearestDifferentStep(history, historyIndex, 1);
        if (passo >= 0) {
            isUndoRedoAction.current = true;
            setHistoryIndex(passo);
            setImages(withLiveOriginalTags(history[passo], discoNotoRef.current));
            const triggerDelPasso = triggerHistoryRef.current[passo];
            if (triggerDelPasso && history[passo].length > 0) { globalTriggersRef.current = triggerDelPasso; setGlobalTriggers(triggerDelPasso); }
            setToast({ show: true, message: t.redoSuccess || "Azione ripristinata", type: 'info', id: Date.now() });
        }
    }, [history, historyIndex, t]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                return;
            }
            // ITALIANO: con una finestra aperta SOPRA il progetto, Ctrl+Z non lo tocca: nell'editor
            //           di tag (dopo la X su una pillola il fuoco torna alla pagina) annullava in
            //           silenzio l'ultima modifica del progetto dietro la finestra, e su una conferma
            //           cambiava le foto prima del "Conferma". Restano attivi galleria, visualizzatore,
            //           cestino e gestione dei tag del progetto, dove il progetto si vede.
            // ENGLISH: with a dialog open OVER the project, Ctrl+Z leaves it alone: in the tag editor
            //          (after the X on a pill the focus goes back to the page) it silently undid the
            //          project's last edit behind the dialog, and on a confirmation it changed the
            //          photos before "Confirm". Gallery, viewer, trash and project tag manager keep
            //          it, as the project is in view there.
            if (isTagEditorOpen || confirmDialog.isOpen || saveCloseDialog.isOpen || importSummary.isOpen
                || isApiKeyDialogOpen || isStatsOpen || !!exportChoice || updateAskOpen || !!updateFound) {
                return;
            }
            // ITALIANO: anche con una tastiera non latina (russa: "я"), vedi isLetterShortcut.
            // ENGLISH: also with a non-Latin keyboard (Russian: "я"), see isLetterShortcut.
            if (e.ctrlKey && e.shiftKey && isLetterShortcut(e, 'z')) {
                e.preventDefault();
                handleRedo();
            } else if (e.ctrlKey && isLetterShortcut(e, 'z')) {
                e.preventDefault();
                handleUndo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo, isTagEditorOpen, confirmDialog.isOpen, saveCloseDialog.isOpen, importSummary.isOpen,
        isApiKeyDialogOpen, isStatsOpen, exportChoice, updateAskOpen, updateFound]);

    const allUniqueTags = useMemo(() => {
        const imgTags = images.flatMap(img => img.tags);
        return [...new Set([...imgTags, ...customProjectTags])].sort((a, b) => a.localeCompare(b));
    }, [images, customProjectTags]);

    const displayedImages = useMemo(() => {
        let sorted = [...images].filter(img => !img.isTrashed);
        // ITALIANO: RICERCA PER TAG (pagina principale). Uno o piu' termini separati da VIRGOLA (i tag
        //           possono contenere spazi, es. "open eyes", quindi NON divido sugli spazi). Un'immagine
        //           passa se contiene TUTTI i termini (confronto per sottostringa, non distingue maiuscole).
        //           Cosi' "Seleziona tutte" (che opera su displayedImages) seleziona SOLO le filtrate.
        // ENGLISH: TAG SEARCH (main page). One or more terms separated by COMMA (tags may contain spaces,
        //          e.g. "open eyes", so I do NOT split on spaces). An image passes if it contains ALL the
        //          terms (case-insensitive substring). This way "Select all" (which works on
        //          displayedImages) selects ONLY the filtered ones.
        const terms = tagSearch.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        if (terms.length > 0) {
            sorted = sorted.filter(img => {
                const lower = (img.tags || []).map((tg: string) => tg.toLowerCase());
                return terms.every(term => lower.some((tg: string) => tg.includes(term)));
            });
        }
        return applySort(sorted, sortOrder);
    }, [images, sortOrder, tagSearch]);

    // ITALIANO: lista usata dal VISUALIZZATORE. E' quella filtrata, ma se la foto aperta e' appena
    //           uscita dal filtro (tipico: cerchi "smile", apri una foto e le TOGLI il tag "smile")
    //           la tengo dentro finche' resta aperta. Prima spariva di colpo: la finestra grande si
    //           chiudeva da sola a meta' lavoro e si tornava alla griglia senza piu' frecce avanti
    //           e indietro. Cosi' invece si continua a sfogliare e si chiude quando si vuole.
    // ENGLISH: list used by the VIEWER. It is the filtered one, but if the open photo has just left
    //          the filter (typical: search "smile", open a photo and REMOVE its "smile" tag) I keep
    //          it in while it stays open. It used to vanish at once: the big window closed by itself
    //          mid-task and dropped the user back on the grid with no next/prev arrows. Now browsing
    //          continues and the window closes when the user decides.
    //           Le foto uscite dal filtro vengono TRATTENUTE per tutta la sessione del
    //           visualizzatore, non solo finche' sono quella aperta. Trattenendo la sola aperta,
    //           premendo Avanti la foto spariva dall'elenco e Indietro non ci tornava piu' sopra:
    //           saltava a un'altra e il contatore calava da solo, come se fosse stata cancellata.
    //           L'elenco torna quello normale quando si chiude il visualizzatore.
    // ENGLISH: photos that left the filter are HELD for the whole viewer session, not only while
    //          they are the open one. Holding just the open photo meant that pressing Next made it
    //          drop out of the list, so Back no longer returned to it: it skipped to another one and
    //          the counter went down by itself, as if the photo had been deleted. The list goes back
    //          to normal when the viewer is closed.
    const [trattenuteNelVisualizzatore, setTrattenuteNelVisualizzatore] = useState<string[]>([]);
    useEffect(() => {
        if (!selectedImageId) {
            setTrattenuteNelVisualizzatore(prev => (prev.length > 0 ? [] : prev));
            return;
        }
        const visibili = new Set(displayedImages.map(img => img.id));
        setTrattenuteNelVisualizzatore(prev => {
            // ITALIANO: una foto che RIENTRA nel filtro (le si rimette il tag cercato) non ha piu'
            //           bisogno di essere trattenuta: la tolgo, cosi' l'elenco resta corto.
            // ENGLISH: a photo that comes BACK into the filter (the searched tag is put back) no
            //          longer needs holding: I drop it, keeping the list short.
            const ripulito = prev.filter(id => !visibili.has(id));
            const serve = !visibili.has(selectedImageId);
            const finale = serve && !ripulito.includes(selectedImageId) ? [...ripulito, selectedImageId] : ripulito;
            return finale.length === prev.length && finale.every((id, i) => id === prev[i]) ? prev : finale;
        });
    }, [selectedImageId, displayedImages]);

    const lightboxImages = useMemo(() => {
        if (!selectedImageId) return displayedImages;
        const visibili = new Set(displayedImages.map(img => img.id));
        const idsFuori = [...new Set([...trattenuteNelVisualizzatore, selectedImageId])].filter(id => !visibili.has(id));
        if (idsFuori.length === 0) return displayedImages;
        // ITALIANO: PRESTAZIONI — indice per id costruito UNA volta. Prima ogni foto trattenuta
        //           veniva cercata scorrendo tutto l'elenco: sfogliando a lungo una ricerca su
        //           migliaia di foto il costo cresceva a ogni modifica dei tag, e il visualizzatore
        //           rallentava man mano che si lavorava.
        // ENGLISH: PERF — an id index built ONCE. Every held photo used to be located by scanning
        //          the whole list: browsing a long search over thousands of photos made the cost grow
        //          with every tag edit, and the viewer got slower the more the user worked.
        const perId = new Map(images.map(img => [img.id, img]));
        const fuori = idsFuori
            .map(id => perId.get(id))
            .filter(img => img && !img.isTrashed);
        if (fuori.length === 0) return displayedImages;
        return applySort([...displayedImages, ...fuori], sortOrder);
    }, [displayedImages, images, selectedImageId, sortOrder, trattenuteNelVisualizzatore]);

    // ITALIANO: la foto aperta nel visualizzatore non c'e' piu' o e' nel cestino (Ctrl+Z, Ctrl+Shift+Z
    //           o un annullamento oltre l'import): il visualizzatore si chiude davvero, come fanno
    //           "Sposta nel cestino" e la X. Prima spariva ma l'app lo credeva ancora aperto: un tag
    //           suggerito finiva sulla foto nascosta nel cestino invece che sulle foto selezionate,
    //           Esc non rispondeva e ripristinando la foto il visualizzatore si riapriva da solo.
    // ENGLISH: the photo open in the viewer is gone or in the trash (Ctrl+Z, Ctrl+Shift+Z or an undo
    //          past the import): the viewer really closes, as "Move to trash" and the X do. It used to
    //          vanish while the app still believed it open: a suggested tag landed on the photo hidden
    //          in the trash instead of the selected photos, Esc did not answer and restoring the photo
    //          reopened the viewer by itself.
    useEffect(() => {
        if (selectedImageId && !images.some(img => img.id === selectedImageId && !img.isTrashed)) setSelectedImageId(null);
    }, [selectedImageId, images]);

    // ITALIANO: lo stesso per la selezione in blocco: una foto che non c'e' piu' o che e' nel
    //           cestino (Ctrl+Z, Ctrl+Shift+Z, un annullamento oltre l'import) esce dalla
    //           selezione. Prima restava: il pannello la contava ("foto selezionate: 2" con una sola
    //           a schermo), le pillole "presenti su alcune" mostravano i suoi tag e Conferma diceva
    //           un numero piu' basso. Le foto nascoste solo dalla ricerca restano selezionate. Se non
    //           cambia niente si tiene lo stesso elenco, cosi' le card non si ridisegnano.
    // ENGLISH: the same for the bulk selection: a photo that is gone or in the trash (Ctrl+Z,
    //          Ctrl+Shift+Z, an undo past the import) leaves the selection. It used to stay: the
    //          panel counted it ("selected photos: 2" with one on screen), the "on some" pills
    //          showed its tags and Confirm said a lower number. Photos hidden only by the search
    //          stay selected. When nothing changes the same list is kept, so the cards are not
    //          redrawn.
    useEffect(() => {
        setSelectedForBulk(prev => {
            if (prev.length === 0) return prev;
            const fotoNelProgetto = new Set(images.filter(img => !img.isTrashed).map(img => img.id));
            const restano = prev.filter(id => fotoNelProgetto.has(id));
            return restano.length === prev.length ? prev : restano;
        });
    }, [images]);

    const trashedImages = useMemo(() => images.filter(img => img.isTrashed), [images]);
    // ITALIANO: le foto del progetto, cioe' quelle fuori dal cestino: il contatore della barra le
    //           conta cosi' con e senza ricerca, come la galleria e le Statistiche. Senza ricerca
    //           contava anche le foto nel cestino ("5 immagini aperte" sopra una galleria di 3).
    // ENGLISH: the project's photos, i.e. those outside the trash: the bar counter counts them this
    //          way with and without a search, like the gallery and Statistics. Without a search it
    //          counted the trashed photos too ("5 images opened" above a gallery of 3).
    const fotoAttive = images.length - trashedImages.length;

    // ITALIANO: PRESTAZIONI — selezione come Set per un test O(1) "questa foto e' selezionata?".
    //           Serve alle card memorizzate della galleria (prop booleana isSelected).
    // ENGLISH: PERF — selection as a Set for an O(1) "is this photo selected?" test. Used by the
    //          memoized gallery cards (isSelected boolean prop).
    const selectedForBulkSet = useMemo(() => new Set(selectedForBulk), [selectedForBulk]);

    // ITALIANO: quante foto SELEZIONATE non sono piu' visibili per via della ricerca per tag. La
    //           selezione sopravvive di proposito al cambio di filtro (come in qualsiasi programma),
    //           ma i tag in blocco finiscono anche su quelle nascoste: senza avviso si rischiava di
    //           credere di taggare le 30 foto a schermo mentre se ne stavano taggando 150 invisibili.
    //           Il pannello lo dice chiaramente prima della conferma.
    // ENGLISH: how many SELECTED photos are no longer visible because of the tag search. The
    //          selection deliberately survives a filter change (as in any program), but bulk tags
    //          also land on the hidden ones: with no warning one could believe they were tagging the
    //          30 photos on screen while actually tagging 150 invisible ones. The panel now says so
    //          plainly before the confirmation.
    //           Conto SOLO le foto che riceveranno davvero i tag: presenti e non cestinate. Prima
    //           bastava "non visibile", ma displayedImages esclude gia' le cestinate, quindi una
    //           foto tornata nel cestino (per esempio con Annulla) veniva contata come "nascosta
    //           dalla ricerca" e l'avviso prometteva tag che applyBulkTags non avrebbe mai scritto.
    // ENGLISH: I count ONLY the photos that will really receive the tags: present and not trashed.
    //          It used to be enough to be "not visible", but displayedImages already excludes
    //          trashed ones, so a photo sent back to the trash (e.g. by Undo) was counted as
    //          "hidden by the search" and the warning promised tags applyBulkTags would never write.
    // ITALIANO: forma UNICA per tutti i tasti del pannello di selezione (Elimina / Annulla /
    //           Conferma): stessa altezza, stessi angoli, stessa ombra e stesso peso del testo,
    //           come i tasti grandi della barra comandi. Cambia solo il COLORE, che e' l'unica
    //           cosa che deve distinguerli. Tenerla in un posto solo evita che col tempo tornino
    //           ad avere aspetti diversi fra loro.
    // ENGLISH: ONE shape for every button in the selection panel (Delete / Cancel / Confirm): same
    //          height, corners, shadow and text weight as the big command-bar buttons. Only the
    //          COLOUR changes, which is the only thing that should tell them apart. Keeping it in
    //          one place stops them from drifting apart again over time.
    const bulkPanelBtn = 'h-[34px] shrink-0 flex justify-center items-center gap-2 px-4 rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-xs';

    // ITALIANO: stessa idea per i quattro tasti del pannello "tutti i tag del progetto" (elimina
    //           tutti / pulisci inutilizzati / esporta / importa): forma unica, cambia solo il
    //           colore. Prima due erano a tinta piena con ombra e due piatti col bordo, e sembravano
    //           appartenere a schermate diverse.
    // ENGLISH: same idea for the four buttons of the "all project tags" panel (delete all / clean
    //          unused / export / import): one shape, only the colour changes. Two used to be solid
    //          with a shadow and two flat with a border, so they looked like they belonged to
    //          different screens.
    const tagPanelBtn = 'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white shadow-md border-0 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';

    const hiddenSelectedCount = useMemo(() => {
        if (selectedForBulk.length === 0) return 0;
        const attive = new Set(images.filter(img => !img.isTrashed).map(img => img.id));
        const visibili = new Set(displayedImages.map(img => img.id));
        return selectedForBulk.filter(id => attive.has(id) && !visibili.has(id)).length;
    }, [selectedForBulk, displayedImages, images]);

    const sortedTrashedImages = useMemo(() => {
        return applySort([...trashedImages], trashSortOrder);
    }, [trashedImages, trashSortOrder]);

    // ITALIANO: `id` distingue ogni notifica, anche con lo stesso testo: da li' Toast fa ripartire
    //           i suoi 4 secondi (vedi Toast in components/ui.tsx).
    // ENGLISH: `id` tells every notification apart, even with the same text: Toast restarts its
    //          4 seconds from it (see Toast in components/ui.tsx).
    const showNotification = (message: string, type = 'info') => setToast({ show: true, message, type, id: Date.now() });

    // ITALIANO: SCELTA AUTOMATICA DEL MODELLO AI
    //   Quali modelli esistano lo dice Google, non questo file: cosi' il programma non resta
    //   legato a una sigla che un giorno Google chiude, e chi la usava non si ritrova l'AI
    //   rotta senza capire perche'. La regola di scelta, e il motivo per cui ogni candidato
    //   viene PROVATO prima di essere adottato, stanno in geminiService. Qui c'e' solo il
    //   QUANDO: una volta al giorno all'avvio, e subito quando il modello di adesso risponde
    //   "non esisto".
    //   Nota sulla privacy: si parte solo con l'AI accesa E la chiave presente. Chi non usa
    //   l'AI non fa partire nessun collegamento, e quella promessa resta vera alla lettera.
    // ENGLISH: AUTOMATIC AI MODEL SELECTION
    //   Which models exist is Google's word, not this file's: that way the program is not tied
    //   to an id Google may retire one day, leaving whoever used it with a broken AI and no
    //   explanation. The selection rule, and why every candidate is PROBED before being
    //   adopted, live in geminiService. Here there is only the WHEN: once a day at startup,
    //   and immediately when the current model answers "I do not exist".
    //   Privacy note: this runs only with AI enabled AND a key present. Whoever does not use
    //   the AI starts no connection at all, and that promise stays true to the letter.
    const [modelliDisponibili, setModelliDisponibili] = useState<any[]>(() => {
        try {
            const grezzo = JSON.parse(localStorage.getItem('aiModelliTrovati') || '[]');
            return Array.isArray(grezzo) ? grezzo : [];
        } catch (_) { return []; }
    });
    const [controlloModelloInCorso, setControlloModelloInCorso] = useState(false);
    const [modelloControllatoIl, setModelloControllatoIl] = useState<number>(() => {
        const n = parseInt(localStorage.getItem('aiModelloControllatoIl') || '0', 10);
        return Number.isFinite(n) ? n : 0;
    });
    const controlloModelloRef = useRef(false);
    const [riparaModello, setRiparaModello] = useState(0);
    // ITALIANO: l'interruttore AI com'e' adesso, letto dal controllo dei modelli prima di partire e
    //           dopo ogni attesa: con l'AI spenta non si parla con Google (README), e la riparazione
    //           chiesta da una foto o il controllo di avvio non devono cambiare modello dopo.
    // ENGLISH: the AI switch as it is now, read by the model check before it starts and after every
    //          wait: with the AI off Google is not contacted (README), and a repair asked by a photo
    //          or the startup check must not switch the model afterwards.
    const aiEnabledRef = useRef(aiEnabled);
    aiEnabledRef.current = aiEnabled;

    // ITALIANO: IL MODELLO SCELTO A MANO RESTA FISSO. E' cio' che la spiegazione promette
    //           ("scegliendo un modello preciso, resta fisso quello") e prima non era vero: nel
    //           codice non c'era nessun blocco, e il controllo del giorno dopo scavalcava la
    //           scelta senza chiedere. Scegliendo "Automatico" il blocco si toglie.
    //           Chi arriva dalla 1.2.0 parte da Automatico: e' la scelta che si voleva di serie.
    // ENGLISH: A MODEL PICKED BY HAND STAYS FIXED. That is what the hint promises ("pick a
    //          specific model and that one stays fixed") and it used to be false: there was no
    //          lock in the code, and the next day's check overrode the choice without asking.
    //          Picking "Automatic" removes the lock. Anyone coming from 1.2.0 starts on
    //          Automatic: that is the intended default.
    const [aiModelloFissato, setAiModelloFissato] = useState<boolean>(() => localStorage.getItem('aiModelloFissato') === 'true');
    // ITALIANO: due ref che il controllo dei modelli legge DOPO le sue attese (lo stato che ha in
    //           mano e' quello di quando e' partito): il blocco com'e' adesso, e quante volte si e'
    //           scelto un modello a mano nella tendina.
    // ENGLISH: two refs the model check reads AFTER its awaits (the state it holds is the one from
    //          when it started): the lock as it is now, and how many times a model was picked by
    //          hand in the dropdown.
    const aiModelloFissatoRef = useRef(aiModelloFissato);
    const sceltaManualeRef = useRef(0);
    // ITALIANO: l'ultimo modello scelto a mano nella tendina: dopo le attese il controllo ha in mano
    //           il modello di quando e' partito, non quello in uso adesso.
    // ENGLISH: the last model picked by hand in the dropdown: after its awaits the check holds the
    //          model from when it started, not the one in use now.
    const ultimaSceltaRef = useRef('');
    useEffect(() => {
        aiModelloFissatoRef.current = aiModelloFissato;
        try { localStorage.setItem('aiModelloFissato', aiModelloFissato ? 'true' : 'false'); } catch (_) { }
    }, [aiModelloFissato]);

    // ITALIANO: `fissato` si passa esplicitamente quando lo stato sta per cambiare nello stesso
    //           clic (passaggio ad Automatico): React non l'avrebbe ancora aggiornato, e il
    //           controllo partirebbe credendo il modello ancora bloccato.
    // ENGLISH: `fissato` is passed explicitly when the state is about to change in the same
    //          click (switching to Automatic): React would not have updated it yet, and the
    //          check would run believing the model still locked.
    const controllaModello = async (rotto: boolean, dilloComunque: boolean, fissato: boolean = aiModelloFissato) => {
        // ITALIANO: il ref, non lo stato: due controlli in parallelo sprecherebbero chiamate e
        //           potrebbero scriversi addosso il modello scelto.
        // ENGLISH: the ref, not the state: two checks in parallel would waste calls and could
        //          overwrite each other's chosen model.
        if (controlloModelloRef.current) return;
        if (!aiEnabledRef.current) return;
        if (!geminiApiKey) { if (dilloComunque) showNotification(t.aiModelCheckFailed, 'error'); return; }
        controlloModelloRef.current = true;
        setControlloModelloInCorso(true);
        const scelteAllInizio = sceltaManualeRef.current;

        // ITALIANO: "ultimo controllo" si scrive SOLO quando Google ha dato una risposta vera.
        //           Prima si scriveva sempre, anche dopo un fallimento: le Impostazioni dicevano
        //           "controllato oggi" su un controllo mai riuscito, e il tentativo successivo
        //           aspettava 24 ore.
        // ENGLISH: "last check" is written ONLY when Google gave a real answer. It used to be
        //          written every time, even after a failure: Settings said "checked today" for a
        //          check that never succeeded, and the next attempt waited 24 hours.
        const segnaControllo = () => {
            const adesso = Date.now();
            setModelloControllatoIl(adesso);
            try { localStorage.setItem('aiModelloControllatoIl', String(adesso)); } catch (_) { }
        };
        const tieniElenco = (elenco: any[]) => {
            if (!elenco || elenco.length === 0) return;
            setModelliDisponibili(elenco);
            try { localStorage.setItem('aiModelliTrovati', JSON.stringify(elenco)); } catch (_) { }
        };

        try {
            // ITALIANO: modello bloccato e ancora vivo: niente cambi da soli. Si aggiorna solo
            //           l'elenco nella tendina e, se lo si e' chiesto, si dice se ce n'e' uno piu'
            //           nuovo. Se invece il modello bloccato non esiste piu' (rotto), si ripara
            //           comunque: tenere un modello morto non e' rispettare una scelta.
            // ENGLISH: model locked and still alive: no changes on our own. Only the dropdown
            //          list is refreshed and, if asked, we say whether a newer one exists. If the
            //          locked model no longer exists (rotto), it is repaired anyway: keeping a
            //          dead model is not respecting a choice.
            if (fissato && !rotto) {
                const elenco = await elencaModelliRemoti(geminiApiKey);
                // ITALIANO: l'AI e' stata spenta mentre Google rispondeva: niente avvisi, niente cambi.
                // ENGLISH: the AI was switched off while Google answered: no notices, no changes.
                if (!aiEnabledRef.current) return;
                // ITALIANO: mentre Google rispondeva l'utente e' passato ad Automatico: il controllo
                //           chiesto da quel clic si e' perso (questo era in corso), quindi lo fa
                //           questo, proseguendo come Automatico. Prima diceva "ce n'e' uno piu'
                //           recente", segnava il controllo come fatto, e Automatico restava sul
                //           modello vecchio fino al giorno dopo.
                // ENGLISH: while Google was answering the user switched to Automatic: the check that
                //          click asked for was lost (this one was running), so this one does it,
                //          going on as Automatic. It used to say "a newer one is available", mark
                //          the check as done, and Automatic stayed on the old model until the next day.
                if (aiModelloFissatoRef.current) {
                    if (elenco.length === 0) {
                        if (dilloComunque) showNotification(t.aiModelCheckFailed, 'error');
                        return;
                    }
                    tieniElenco(elenco);
                    segnaControllo();
                    if (dilloComunque) {
                        // ITALIANO: "piu' recente" solo se la VERSIONE e' piu' alta. A parita' di
                        //           versione il flash pieno viene prima del lite nell'elenco: con
                        //           gemini-3.6-flash-lite bloccato si annunciava gemini-3.6-flash
                        //           come "piu' recente", ed e' la stessa 3.6.
                        // ENGLISH: "newer" only if the VERSION is higher. At equal version the full
                        //          flash comes before the lite in the list: with gemini-3.6-flash-lite
                        //          locked, gemini-3.6-flash was announced as "newer", and it is the
                        //          same 3.6.
                        if (confrontaVersioni(versioneDi(elenco[0].id), versioneDi(aiModel)) > 0) showNotification(t.aiModelNewerAvailable.replace('{a}', elenco[0].id), 'info');
                        else showNotification(t.aiModelUpToDate.replace('{a}', aiModel), 'success');
                    }
                    return;
                }
                tieniElenco(elenco);
            }

            const esito = await aggiornaModelloAutomatico(geminiApiKey, aiModel, rotto);
            if (!aiEnabledRef.current) return;
            tieniElenco(esito.disponibili);
            if (esito.esito !== 'nonRaggiungibile' && esito.esito !== 'chiaveNonValida' && esito.esito !== 'progettoRifiutato' && esito.esito !== 'occupato') segnaControllo();

            // ITALIANO: mentre Google rispondeva (qualche secondo: elenco e fino a tre prove)
            //           l'utente ha scelto a mano un modello preciso, ed e' ancora bloccato: vale
            //           la sua scelta. Il risultato si mette da parte senza dire niente (l'elenco
            //           della tendina e' gia' aggiornato). Prima lo si applicava lo stesso: la
            //           scelta spariva, il blocco cadeva e l'avviso diceva "Prima:" col modello
            //           di prima della scelta. Se invece e' tornato su Automatico, il risultato vale.
            // ENGLISH: while Google was answering (a few seconds: the list and up to three probes)
            //          the user picked a specific model by hand, and it is still locked: their
            //          choice stands. The result is set aside without a word (the dropdown list is
            //          already refreshed). It used to be applied anyway: the choice vanished, the
            //          lock dropped and the notice said "Before:" with the model from before the
            //          pick. If they went back to Automatic instead, the result stands.
            if (sceltaManualeRef.current !== scelteAllInizio && aiModelloFissatoRef.current) return;

            // ITALIANO: ...e se e' tornato su Automatico, il modello in uso e' quello scelto a mano
            //           (ultimaSceltaRef), non quello da cui il controllo e' partito. Prima si
            //           applicava solo un risultato "cambiato" rispetto alla partenza: partendo gia'
            //           dal piu' recente la risposta era "invariato", e Automatico restava sul modello
            //           vecchio scelto a mano fino al controllo del giorno dopo (il "torna su
            //           Automatico" della tendina, arrivato a controllo in corso, era stato scartato).
            //           Quando Google ha indicato un modello, si confronta con quello in uso e il
            //           cambio si annuncia nominando quello davvero sostituito.
            // ENGLISH: ...and if they went back to Automatic, the model in use is the hand-picked one
            //          (ultimaSceltaRef), not the one the check started from. Only a result "changed"
            //          against the start used to be applied: starting from the newest already, the
            //          answer was "unchanged", and Automatic stayed on the old hand-picked model until
            //          the next day's check (the dropdown's "back to Automatic", arriving while the
            //          check was running, had been dropped). When Google named a model, it is compared
            //          with the one in use and the switch is announced naming the one really replaced.
            if (sceltaManualeRef.current !== scelteAllInizio
                && (esito.esito === 'invariato' || esito.esito === 'aggiornato' || esito.esito === 'riparato')) {
                if (esito.modello !== ultimaSceltaRef.current) {
                    setAiModel(esito.modello);
                    setAiModelloFissato(false);
                    showNotification(t.aiModelSwitched.replace('{da}', ultimaSceltaRef.current).replace('{a}', esito.modello), 'info');
                } else if (dilloComunque) {
                    showNotification(t.aiModelUpToDate.replace('{a}', esito.modello), 'success');
                }
                return;
            }

            if (esito.cambiato) {
                // ITALIANO: il cambio si annuncia SEMPRE. Un modello nuovo puo' taggare in modo
                //           diverso, e se sei a meta' di un dataset e' una cosa che devi sapere:
                //           cambiare di nascosto sarebbe comodo da programmare e sleale da usare.
                //           Dopo una riparazione il blocco cade: il modello bloccato non c'e' piu'.
                // ENGLISH: the switch is ALWAYS announced. A new model can tag differently, and
                //          if you are halfway through a dataset that is something you need to
                //          know: switching quietly would be easy to code and unfair to use.
                //          After a repair the lock is dropped: the locked model is gone.
                setAiModel(esito.modello);
                setAiModelloFissato(false);
                const testo = esito.esito === 'riparato' ? t.aiModelRepaired : t.aiModelSwitched;
                showNotification(testo.replace('{da}', esito.precedente).replace('{a}', esito.modello), 'info');
            } else if (dilloComunque) {
                // ITALIANO: il motivo decide la frase: "non raggiungibile", "Google chiede di
                //           rallentare" e "nessuno passa la prova" sono tre cose diverse, e prima
                //           dicevano tutte la stessa - sbagliata per due su tre.
                // ENGLISH: the reason picks the sentence: "unreachable", "Google asks to slow
                //          down" and "none passes the test" are three different things, and they
                //          all used to say the same one - wrong for two of the three.
                if (esito.esito === 'nonRaggiungibile') showNotification(t.aiModelCheckFailed, 'error');
                else if (esito.esito === 'chiaveNonValida') showNotification(t.aiModelCheckKeyInvalid, 'error');
                else if (esito.esito === 'progettoRifiutato') showNotification(t.aiModelCheckProjectRefused, 'error');
                else if (esito.esito === 'occupato') showNotification(t.aiModelCheckBusy, 'info');
                else if (esito.esito === 'nessunoValido') showNotification(t.aiModelNoneWorking, 'error');
                else showNotification(t.aiModelUpToDate.replace('{a}', esito.modello), 'success');
            }
        } catch (err) {
            console.warn('[AI] Controllo del modello non riuscito:', err);
            // ITALIANO: con il modello bloccato l'elenco si chiede da qui: una chiave scaduta o
            //           revocata non e' "Google non raggiungibile", come nel giro automatico.
            // ENGLISH: with the model locked the list is asked from here: an expired or revoked
            //          key is not "Google unreachable", as in the automatic round.
            // ITALIANO: ...e nemmeno un progetto rifiutato, troppe richieste o Google sovraccarico:
            //           stesse frasi del giro automatico. "Non raggiungibile" resta per la rete.
            // ENGLISH: ...nor is a refused project, too many requests or Google overloaded: the same
            //          sentences as the automatic round. "Unreachable" stays for the network.
            if (dilloComunque && aiEnabledRef.current) {
                const { kind } = classifyGeminiError(err);
                if (kind === 'invalid_key') showNotification(t.aiModelCheckKeyInvalid, 'error');
                else if (kind === 'billing_required') showNotification(t.aiModelCheckProjectRefused, 'error');
                else if (kind === 'rate_limit' || kind === 'busy') showNotification(t.aiModelCheckBusy, 'info');
                else showNotification(t.aiModelCheckFailed, 'error');
            }
        } finally {
            controlloModelloRef.current = false;
            setControlloModelloInCorso(false);
        }
    };


    useEffect(() => {
        if (!aiEnabled || !geminiApiKey) return;
        if (Date.now() - modelloControllatoIl < 24 * 60 * 60 * 1000) return;
        // ITALIANO: "al massimo una volta al giorno" vale anche per i controlli non riusciti
        //           (Google occupato, rete assente, chiave che non va), che "ultimo controllo" non
        //           annota: prima ogni avvio, e ogni volta che si riaccendeva l'AI, si ricollegava.
        //           Il tentativo si annota a parte, cosi' le Impostazioni dicono ancora l'ultimo
        //           controllo riuscito. "Controlla ora" e la riparazione non passano da qui.
        // ENGLISH: "at most once a day" holds for failed checks too (Google busy, no network, a key
        //          that does not work), which "last check" does not record: every launch, and every
        //          time the AI was switched back on, used to connect again. The attempt is recorded
        //          apart, so Settings still shows the last successful check. "Check now" and the
        //          repair do not go through here.
        const adesso = Date.now();
        let tentatoIl = 0;
        try { tentatoIl = parseInt(localStorage.getItem('aiModelloTentatoIl') || '0', 10); } catch (_) { }
        if (Number.isFinite(tentatoIl) && tentatoIl <= adesso && adesso - tentatoIl < 24 * 60 * 60 * 1000) return;
        try { localStorage.setItem('aiModelloTentatoIl', String(adesso)); } catch (_) { }
        controllaModello(false, false);
    }, [aiEnabled, geminiApiKey]);

    // ITALIANO: il modello di adesso ha appena risposto "non esisto": si cerca subito il
    //           sostituto, senza aspettare il controllo del giorno dopo. Passa da un contatore
    //           invece che da una chiamata diretta, cosi' la funzione che tagga non si rifa'
    //           a ogni battito di questo controllo.
    // ENGLISH: the current model has just answered "I do not exist": look for the replacement
    //          right away instead of waiting for tomorrow's check. It goes through a counter
    //          rather than a direct call, so the tagging function is not rebuilt on every beat
    //          of this check.
    useEffect(() => {
        // ITALIANO: la riparazione dice SEMPRE com'e' andata: chi ha appena visto "modello non
        //           disponibile' deve sapere se e' stato sostituito o se non c'e' riuscita.
        // ENGLISH: the repair ALWAYS reports how it went: whoever just saw "model unavailable"
        //          needs to know whether it was replaced or whether that failed.
        if (riparaModello > 0) controllaModello(true, true);
    }, [riparaModello]);

    // ITALIANO: quello che si vede nella tendina. Se Google ha gia' risposto una volta, sono i
    //           suoi modelli; altrimenti la riserva incorporata. Il modello IN USO ci dev'essere
    //           sempre, altrimenti la tendina resterebbe vuota proprio mentre lo si sta usando.
    // ENGLISH: what the dropdown shows. If Google has answered at least once, those are its
    //          models; otherwise the built-in fallback. The model IN USE must always be there,
    //          or the dropdown would sit blank precisely while it is being used.
    const elencoModelli = useMemo(() => {
        const base = modelliDisponibili.length > 0
            ? modelliDisponibili.map((m: any) => ({ id: String(m.id), label: String(m.label || m.id), tier: getModelTier(String(m.id)), recommended: false }))
            : GEMINI_MODELS.map(m => ({ id: m.id, label: m.label, tier: m.tier as string, recommended: m.recommended }));
        if (!base.some(m => m.id === aiModel)) {
            base.unshift({ id: aiModel, label: aiModel, tier: getModelTier(aiModel), recommended: false });
        }
        return base;
    }, [modelliDisponibili, aiModel]);

    const handleDeleteAllTags = () => {
        setConfirmDialog({
            isOpen: true,
            title: t.deleteAllTags,
            message: t.confirmDeleteAllTagsMsg,
            onConfirm: () => {
                // ITALIANO: le trigger word restano sulle foto che le avevano. Prima se ne andavano
                //           anche loro mentre il riquadro delle trigger continuava a mostrarle, e
                //           niente le rimetteva: i .txt salvati dopo uscivano senza trigger, quelli
                //           delle foto importate dopo con. Non si svuota il riquadro: questo comando
                //           toglie i tag delle foto, non le trigger, che restano le prime nei .txt.
                // ENGLISH: trigger words stay on the photos that had them. They used to go too while
                //          the trigger box kept showing them, and nothing put them back: .txt files
                //          saved afterwards came out without the trigger, those of photos imported
                //          later with it. The box is not emptied: this command removes the photos'
                //          tags, not the triggers, which stay first in the .txt files.
                setImages(prev => prev.map(img => ({ ...img, tags: globalTriggers.filter(tg => img.tags.includes(tg)) })));
                setCustomProjectTags([]);
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                soundManager.pop();
                showNotification(t.allTagsDeleted, "success");
            },
            onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        });
    };

    const handleCleanUnusedTags = () => {
        const usedTags = new Set(images.flatMap(img => img.tags));
        setCustomProjectTags(prev => prev.filter(tag => usedTags.has(tag)));
        showNotification(t.completed, 'success');
        soundManager.pop();
    };

    const handleDeleteTagFromProject = (tagToDelete: string) => {
        // ITALIANO: la X su una trigger word la toglie anche dal suo riquadro, come toglierla da li'
        //           a mano (che la toglie da tutte le foto). Prima lasciava le foto ma restava nel
        //           riquadro: i .txt salvati dopo uscivano senza, le foto importate dopo con.
        // ENGLISH: the X on a trigger word also takes it out of its box, like removing it there by
        //          hand (which strips it from every photo). It used to leave the photos but stay in
        //          the box: .txt files saved afterwards came out without it, photos imported later with.
        if (globalTriggers.includes(tagToDelete)) {
            handleGlobalTagsChange(globalTriggers.filter(tg => tg !== tagToDelete));
        } else {
            setImages(prev => prev.map(img => ({
                ...img,
                tags: img.tags.filter(t => t !== tagToDelete)
            })));
        }
        setCustomProjectTags(prev => prev.filter(t => t !== tagToDelete));
        soundManager.click();
    };

    // ITALIANO: CHIUDE una singola immagine: la toglie dalla vista senza cestinarla e senza
    //           toccare nulla su disco — l'equivalente di "Chiudi progetto" per una sola foto.
    //           Se ha modifiche non salvate lo dice prima, cosi' non si perdono per distrazione.
    // ENGLISH: CLOSES a single image: removes it from view without trashing it and without
    //          touching anything on disk — the single-photo equivalent of "Close project".
    //          If it has unsaved changes it says so first, so they are not lost by accident.
    const handleCloseImage = useCallback((id: string) => {
        const img = imagesRef.current.find(i => i.id === id);
        if (!img) return;
        const chiudi = () => {
            // ITALIANO: NON libero qui la miniatura. Chiudere una foto e' un'azione ANNULLABILE
            //           (Ctrl+Z la riporta): se ne revocassi subito l'anteprima, all'annulla la foto
            //           tornerebbe con l'immagine ROTTA. Come per il cestino, l'anteprima resta valida
            //           e viene liberata in blocco alla chiusura/reset del progetto.
            // ENGLISH: do NOT free the thumbnail here. Closing a photo is an UNDOABLE action (Ctrl+Z
            //          brings it back): revoking its preview now would make the photo come back with a
            //          BROKEN image on undo. Like the trash, the preview stays valid and is freed in
            //          bulk on project close/reset.
            // ITALIANO: il file resta su disco: la foto conta ancora nell'impronta del backup.
            // ENGLISH: the file stays on disk: the photo still counts in the backup's fingerprint.
            fotoChiuseRef.current.set(id, { id, name: img.file.name, lotto: String(img.lottoImport || ''), cartella: String(img.cartellaImport || '') });
            setImages(prev => prev.filter(i => i.id !== id));
            setSelectedForBulk(prev => prev.filter(x => x !== id));
            setSelectedImageId(prev => prev === id ? null : prev);
            soundManager.pop();
        };
        const nonSalvata = JSON.stringify(img.tags) !== JSON.stringify(img.originalTags);
        if (!nonSalvata) return chiudi();
        setConfirmDialog({
            isOpen: true,
            title: t.closeImageTitle,
            message: t.closeImageUnsavedMsg,
            onConfirm: () => { chiudi(); setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} }); },
            onCancel: () => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} })
        });
    }, [t]);

    // ITALIANO: Quando l'editor di tag salva un file, se quel file e' DAVVERO il .txt di una foto
    //           del progetto ne allineo i tag in memoria (sia tags sia originalTags). Senza questo,
    //           un successivo salvataggio del progetto riscriverebbe quel .txt con i tag vecchi,
    //           annullando in silenzio la modifica fatta nell'editor.
    //           SICUREZZA: l'editor apre QUALSIASI file, quindi NON basta il nome. Due foto (o due
    //           .txt) chiamate uguale in cartelle diverse sono comunissime nei dataset LoRA: abbinare
    //           per solo nome farebbe dirottare i tag della foto sbagliata e, al salvataggio, ne
    //           distruggerebbe il .txt vero. Percio' confronto l'IDENTITA' reale del file salvato con
    //           il sidecar della foto (stessa cartella) tramite isSameEntry sugli handle: allineo solo
    //           la foto il cui sidecar E' ESATTAMENTE quel file. Se l'identita' non e' verificabile
    //           (niente handle dall'editor, foto senza cartella, sidecar non ancora su disco) NON
    //           tocco nulla: meglio non sincronizzare che corrompere.
    // ENGLISH: When the tag editor saves a file, if that file is TRULY a project photo's .txt I sync
    //          its in-memory tags (both tags and originalTags). Without this, a later project save
    //          would rewrite that .txt with the old tags, silently undoing the editor's change.
    //          SAFETY: the editor opens ANY file, so the name alone is NOT enough. Two photos (or two
    //          .txt) with the same name in different folders are extremely common in LoRA datasets:
    //          matching by name alone would hijack the wrong photo's tags and, on save, destroy its
    //          real .txt. So I compare the saved file's REAL IDENTITY with the photo's sidecar (same
    //          folder) via isSameEntry on the handles: I sync only the photo whose sidecar IS EXACTLY
    //          that file. If identity can't be verified (no handle from the editor, folder-less photo,
    //          sidecar not yet on disk) I touch NOTHING: better not to sync than to corrupt.
    const handleTagEditorSaved = async (savedName: string, savedTags: string[], savedHandle?: any) => {
        if (!savedHandle || typeof savedHandle.isSameEntry !== 'function') return;
        // ITALIANO: solo un .txt e' il file di tag di una foto. Un img_001.json salvato accanto a
        //           img_001.png la "allineava" lo stesso (stesso nome, e isSameEntry lo provava il
        //           .json stesso): la foto risultava salvata mentre il suo .txt restava com'era.
        // ENGLISH: only a .txt is a photo's tag file. An img_001.json saved next to img_001.png still
        //          "synced" it (same name, and isSameEntry was proven by the .json itself): the photo
        //          counted as saved while its .txt stayed as it was.
        if (!savedName.toLowerCase().endsWith('.txt')) return;
        // ITALIANO: il nome si confronta SENZA maiuscole, come fa l'import (makeFolderKeyer):
        //           IMG_001.JPG e img_001.txt sono una coppia. L'identita' vera la prova isSameEntry.
        // ENGLISH: the name is compared WITHOUT case, as the import does (makeFolderKeyer):
        //          IMG_001.JPG and img_001.txt are a pair. isSameEntry proves the real identity.
        const base = savedName.split('.').slice(0, -1).join('.').toLowerCase();
        // ITALIANO: cerco la foto la cui cartella contiene ESATTAMENTE questo file salvato.
        // ENGLISH: find the photo whose folder contains EXACTLY this saved file.
        let matchId: string | null = null;
        for (const img of images) {
            if (img.file.name.split('.').slice(0, -1).join('.').toLowerCase() !== base) continue;
            const dir = img.dirHandle;
            if (!dir || typeof dir.getFileHandle !== 'function') continue;
            try {
                const sidecar = await dir.getFileHandle(savedName);
                if (await savedHandle.isSameEntry(sidecar)) { matchId = img.id; break; }
            } catch { /* ITALIANO: sidecar assente o non confrontabile: salto, per prudenza */ }
        }
        if (!matchId) {
            // ITALIANO: foto SENZA cartella ("Carica immagini", trascinamento): nessun handle da
            //           confrontare, e prima restavano coi tag vecchi, che il primo "Salva" dopo una
            //           modifica riscriveva sopra il file dell'editor. In Electron si rilegge il .txt
            //           di ognuna dal SUO percorso vero (lo stesso canale dell'import): solo se sul
            //           disco c'e' altro rispetto a originalTags la foto si allinea, come sopra. Una
            //           foto omonima di un'altra cartella, col suo .txt invariato, non cambia.
            // ENGLISH: photos WITHOUT a folder ("Load images", drag and drop): no handle to compare,
            //          and they used to keep the old tags, which the first "Save" after an edit wrote
            //          over the editor's file. In Electron each one's .txt is read again from ITS real
            //          path (the same channel as the import): only if the disk holds something other
            //          than originalTags does the photo sync, as above. A same-named photo from another
            //          folder, with its .txt unchanged, does not change.
            const senzaCartella = images.filter(img => !img.dirHandle && img.file.name.split('.').slice(0, -1).join('.').toLowerCase() === base);
            if (senzaCartella.length === 0) return;
            const api = (window as any).electronAPI;
            if (!api || typeof api.readSidecarTags !== 'function' || typeof api.getPathForFile !== 'function') return;
            const dalDisco = new Map<string, string[]>();
            for (const img of senzaCartella) {
                const percorso = api.getPathForFile(img.file) || img.filePath || '';
                if (!percorso) continue;
                try {
                    const letti = await api.readSidecarTags([percorso]);
                    const s = Array.isArray(letti) ? letti[0] : null;
                    if (!s || s.skipped || typeof s.content !== 'string' || String(s.name).toLowerCase() !== savedName.toLowerCase()) continue;
                    const sulDisco = parseSidecarText(s.content).tags;
                    // ITALIANO: anche uguale, se il .txt all'import non si era letto: ora e' scritto e noto.
                    // ENGLISH: also when equal, if the .txt was unread at import: it is now written and known.
                    if (JSON.stringify(sulDisco) !== JSON.stringify(img.originalTags || []) || txtNonLettoInVigore(img)) dalDisco.set(img.id, sulDisco);
                } catch { /* ITALIANO: .txt non rileggibile: la foto resta com'era / ENGLISH: .txt not readable: the photo stays as it was */ }
            }
            if (dalDisco.size === 0) return;
            setImages(prev => prev.map(i =>
                dalDisco.has(i.id) ? { ...i, ...tagDopoEditor(i.tags, i.originalTags || [], dalDisco.get(i.id) || [], globalTriggers, i.baseTxtNonLetto) } : i
            ));
            return;
        }
        // ITALIANO: una trigger word ancora da salvare resta sulla foto (vedi tagDopoEditor): l'editor
        //           non l'ha mai vista, e prima spariva insieme alla sua scrittura nel .txt.
        // ENGLISH: a trigger word still to be saved stays on the photo (see tagDopoEditor): the editor
        //          never saw it, and it used to vanish along with its write into the .txt.
        setImages(prev => prev.map(i =>
            i.id === matchId ? { ...i, ...tagDopoEditor(i.tags, i.originalTags || [], savedTags, globalTriggers, i.baseTxtNonLetto) } : i
        ));
    };

    // ITALIANO: useCallback con identita' STABILE (nessuna dipendenza): cosi' passandolo a tutte le
    //           card memorizzate della galleria non le fa ridisegnare. Uso la forma "funzionale" di
    //           setSelectedImageId per non dover leggere selectedImageId (che lo renderebbe instabile).
    // ENGLISH: useCallback with a STABLE identity (no deps): so passing it to every memoized gallery
    //          card does not force them to re-render. I use the functional form of setSelectedImageId
    //          to avoid reading selectedImageId (which would make it unstable).
    const handleMoveToTrash = useCallback((id: string) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, isTrashed: true } : img));
        // ITALIANO: tolgo la foto anche dalla selezione in blocco (o resterebbe taggabile/riscrivibile).
        // ENGLISH: also drop the photo from the bulk selection (else it stays taggable/writable).
        setSelectedForBulk(prev => prev.filter(x => x !== id));
        setSelectedImageId(prev => prev === id ? null : prev);
        soundManager.pop();
    }, []);

    // ITALIANO: Sposta nel cestino TUTTE le foto selezionate in una volta. Come per la singola,
    //           e' un'azione REVERSIBILE: le foto finiscono nel cestino dell'app e si possono
    //           ripristinare; nessun file viene toccato su disco finche' non si svuota il cestino.
    //           Agisco solo su quelle NON gia' cestinate, azzero la selezione (cosi' il pannello si
    //           chiude da solo) e chiudo il visualizzatore se stava mostrando una delle cestinate.
    // ENGLISH: Move ALL selected photos to the trash at once. Like the single-photo action it is
    //          REVERSIBLE: the photos land in the app's trash and can be restored; no file on disk
    //          is touched until the trash is emptied. It only acts on the ones NOT already trashed,
    //          clears the selection (so the panel closes by itself) and closes the viewer if it was
    //          showing one of the trashed photos.
    const handleMoveSelectedToTrash = useCallback(() => {
        const ids = new Set(selectedForBulkRef.current);
        if (ids.size === 0) return;
        // ITALIANO: il conteggio si calcola PRIMA, sulla copia sempre aggiornata: contarlo dentro
        //           l'aggiornamento di stato lo farebbe contare due volte (React puo' rieseguire
        //           quella funzione) e il messaggio direbbe un numero sbagliato.
        // ENGLISH: the count is computed BEFORE, on the always-current copy: counting inside the
        //          state updater would double it (React may re-run that function) and the message
        //          would show a wrong number.
        const quante = imagesRef.current.filter(img => ids.has(img.id) && !img.isTrashed).length;
        if (quante === 0) return;
        setImages(prev => prev.map(img => (ids.has(img.id) && !img.isTrashed ? { ...img, isTrashed: true } : img)));
        setSelectedImageId(prev => (prev && ids.has(prev) ? null : prev));
        setSelectedForBulk([]);
        setStagedBulkTags([]);
        soundManager.pop();
        showNotification(t.movedToTrashCount.replace('{n}', String(quante)), 'info');
    }, [t]);

    // ITALIANO: Cestina la foto APERTA nel visualizzatore e passa direttamente alla
    //           successiva (o alla precedente se era l'ultima), senza chiudere la finestra.
    //           Chiude solo se non resta piu' nessuna foto. Il "prossimo" si calcola PRIMA
    //           di cestinare, sulla lista visibile in quel momento.
    // ENGLISH: Trash the OPEN photo in the viewer and jump straight to the next one (or the
    //          previous if it was the last), without closing the window. Closes only if no
    //          photo is left. "Next" is computed BEFORE trashing, on the currently shown list.
    const handleTrashFromLightbox = (id: string) => {
        const idx = lightboxImages.findIndex(img => img.id === id);
        const nextImg = idx === -1 ? null : (lightboxImages[idx + 1] || lightboxImages[idx - 1] || null);
        setImages(prev => prev.map(img => img.id === id ? { ...img, isTrashed: true } : img));
        // ITALIANO: come sopra, tolgo la foto cestinata dalla selezione in blocco.
        // ENGLISH: as above, drop the trashed photo from the bulk selection.
        setSelectedForBulk(prev => prev.filter(x => x !== id));
        setSelectedImageId(nextImg ? nextImg.id : null);
        soundManager.pop();
    };

    const handleRestore = (id: string) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, isTrashed: false } : img));
        soundManager.pop();
    };

    // ITALIANO: Sposta nel CESTINO DI WINDOWS l'immagine e il suo .txt, e ritorna l'ESITO VERO.
    //           O il file arriva nel Cestino di Windows, da dove si recupera, o non si tocca niente
    //           e chi chiama lo viene a sapere. Due cose sono state tolte da qui, ed erano tutte e
    //           due bugie sui file dell'utente:
    //           1) il ripiego `removeEntry`, che quando il Cestino falliva (file bloccato, permessi)
    //              cancellava il file DAVVERO, senza cestino e senza possibilita' di recupero — cioe'
    //              proprio nel caso in cui l'utente aveva piu' bisogno di poter tornare indietro;
    //           2) il `return true` finale, che dichiarava riuscita anche una cancellazione mai
    //              avvenuta: l'app diceva "File eliminati con successo" e toglieva la foto dal
    //              progetto mentre il file era ancora al suo posto.
    //           Un .txt assente (foto senza tag) NON e' un errore: lo salta gia' il canale di sistema.
    // ENGLISH: Moves the image and its .txt to the WINDOWS RECYCLE BIN and returns the REAL outcome.
    //          Either the file reaches the Recycle Bin, where it can be restored, or nothing is
    //          touched and the caller is told. Two things were removed from here, both of them lies
    //          about the user's files:
    //          1) the `removeEntry` fallback, which on a failed trash (locked file, permissions)
    //             deleted the file FOR GOOD, no bin and no way back — exactly when the user most
    //             needed to be able to undo;
    //          2) the trailing `return true`, which declared success for a deletion that never
    //             happened: the app said "Files deleted successfully" and dropped the photo from the
    //             project while the file was still sitting on disk.
    //          A missing .txt (photo with no tags) is NOT an error: the system channel already skips it.
    // ITALIANO: 'trashed' = nel Cestino di Windows, recuperabile · 'nopath' = il Cestino non e'
    //           raggiungibile perche' di questa foto non si conosce il percorso su disco, ma la
    //           cartella e' aperta e la cancellazione diretta sarebbe possibile (DEFINITIVA) ·
    //           'failed' = non si e' potuto fare niente.
    //           STORIA, perche' spiega perche' esiste 'nopath': il selettore di cartelle del browser
    //           consegna file SENZA percorso su disco, quindi `getPathForFile` torna vuoto e per un
    //           po' questo ha significato che nessuna foto aperta con "Carica Cartella" poteva
    //           andare nel Cestino di Windows (provato il 17 agosto 2026 sull'app vera: "Foto
    //           spostate nel Cestino di Windows: 0"). Ora il percorso lo cattura il processo
    //           principale al momento della scelta e arriva qui come `img.filePath`, quindi il caso
    //           normale e' 'trashed'. Restano su 'nopath' due situazioni: le unita' senza Cestino
    //           (cartelle di RETE, chiavette USB, schede SD: Windows rifiuta lo spostamento) e
    //           l'anteprima nel browser, dove non c'e' il guscio Electron.
    // ENGLISH: 'trashed' = in the Windows Recycle Bin, recoverable · 'nopath' = the Recycle Bin is
    //          out of reach because this photo's path on disk is unknown, but its folder is open and
    //          a direct delete would work (PERMANENTLY) · 'failed' = nothing could be done.
    //          HISTORY, because it explains why 'nopath' exists: the browser's folder picker hands
    //          over files WITHOUT a path on disk, so `getPathForFile` comes back empty, and for a
    //          while that meant no photo opened with "Load Folder" could reach the Windows Recycle
    //          Bin (verified 2026-08-17 on the real app: "Photos moved to the Windows Recycle Bin:
    //          0"). The path is now captured by the main process at pick time and arrives here as
    //          `img.filePath`, so the normal case is 'trashed'. Two situations stay on 'nopath':
    //          drives with no Recycle Bin (NETWORK folders, USB sticks, SD cards: Windows refuses
    //          the move) and the browser preview, where there is no Electron shell.
    // ITALIANO: I due percorsi su disco di una foto: l'immagine e il .txt con lo stesso nome.
    //           Sta qui, in un posto solo, perche' lo usano sia chi manda i file nel Cestino di
    //           Windows sia chi ce li ripesca. Se i due calcolassero il nome in modo anche solo
    //           leggermente diverso, l'annullamento andrebbe a cercare file che non ha mai
    //           cestinato e direbbe "non trovato" su roba che nel Cestino c'e' eccome.
    // ENGLISH: The two on-disk paths of a photo: the image and the same-named .txt. It lives here,
    //          in one place, because both the code that sends files to the Windows Recycle Bin and
    //          the code that fishes them back out use it. If the two worked the name out even
    //          slightly differently, the undo would look for files it never trashed and report
    //          "not found" for things that are sitting right there in the Recycle Bin.
    const percorsiSuDisco = (img: any): { imgPath: string; txtPath: string } => {
        const apiLocale = (window as any).electronAPI;
        const imgPath = (apiLocale && typeof apiLocale.getPathForFile === 'function' ? apiLocale.getPathForFile(img.file) : '') || img.filePath || '';
        if (!imgPath) return { imgPath: '', txtPath: '' };
        return { imgPath, txtPath: imgPath.replace(/\.[^.\\/]+$/, '') + '.txt' };
    };

    // ITALIANO: `spostati` (facoltativo) dice cosa e' arrivato DAVVERO nel Cestino di Windows. Il
    //           canale risponde 'ok' anche per un file che non c'e' (il .txt di una foto senza tag):
    //           solo il conto `trashed` distingue "spostato" da "non c'era". "Annulla lo
    //           svuotamento" deve ripescare solo cio' che e' stato spostato, o tirerebbe fuori un
    //           omonimo lasciato nel Cestino da uno svuotamento vecchio.
    // ENGLISH: `spostati` (optional) tells what REALLY reached the Windows Recycle Bin. The channel
    //          answers 'ok' also for a file that is not there (the .txt of a photo with no tags):
    //          only the `trashed` count tells "moved" from "was not there". "Undo the emptying"
    //          must fish back only what was moved, or it would pull out a namesake left in the
    //          Recycle Bin by an older emptying.
    const deleteImageFiles = async (img: any, spostati?: { img?: boolean; txt?: boolean }): Promise<'trashed' | 'nopath' | 'failed' | 'norecycle'> => {
        const api = (window as any).electronAPI;
        if (!api || typeof api.getPathForFile !== 'function' || typeof api.trashFiles !== 'function') {
            return img.dirHandle ? 'nopath' : 'failed';
        }
        try {
            // ITALIANO: `getPathForFile` resta PRIMO, cosi' le foto caricate una per una o
            //           trascinate continuano a comportarsi esattamente come prima. `img.filePath`
            //           copre solo il buco che lascia il selettore di cartelle del browser.
            // ENGLISH: `getPathForFile` stays FIRST, so photos loaded individually or dropped in
            //          keep behaving exactly as before. `img.filePath` only fills the gap left by
            //          the browser's folder picker.
            const { imgPath, txtPath } = percorsiSuDisco(img);
            if (!imgPath) return img.dirHandle ? 'nopath' : 'failed';
            // ITALIANO: due chiamate separate, non una sola con due percorsi: il canale ritorna un
            //           `ok` unico per tutto il gruppo, quindi con un .txt bloccato l'esito diceva
            //           "non riuscito" mentre l'IMMAGINE era gia' nel Cestino di Windows — e la foto
            //           restava nel cestino dell'app a puntare a un file che non c'e' piu'.
            //           Quello che conta per togliere la foto dal progetto e' l'immagine; un .txt
            //           rimasto indietro e' un residuo innocuo, e viene annotato nel registro.
            // ENGLISH: two separate calls, not one with both paths: the channel returns a single `ok`
            //          for the whole batch, so a locked .txt reported failure while the IMAGE had
            //          already reached the Recycle Bin - and the photo stayed in the app's trash
            //          pointing at a file that was gone. What decides whether the photo leaves the
            //          project is the image; a .txt left behind is a harmless leftover, logged here.
            // ITALIANO: e il .txt parte SOLO DOPO che l'immagine e' arrivata nel Cestino di Windows.
            //           Prima partiva comunque: con l'immagine bloccata la foto restava nel cestino
            //           dell'app ("Non rimosse: 1") ma il suo .txt era gia' sparito dal disco, e
            //           ripristinandola Salva non trovava niente da riscrivere. La coppia resta unita.
            // ENGLISH: and the .txt goes ONLY AFTER the image has reached the Windows Recycle Bin.
            //          It used to go regardless: with the image locked the photo stayed in the app's
            //          trash ("Not removed: 1") but its .txt had already left the disk, and after a
            //          restore Save found nothing to rewrite. The pair stays together.
            const resImg = await api.trashFiles([imgPath]);
            // ITALIANO: 'rifiutato' vuol dire che il Cestino di Windows non e' applicabile a questo
            //           file (cartella di rete, chiavetta, scheda SD, o estensione fuori elenco).
            //           Con la cartella aperta ("Carica cartella") si torna 'nopath', cioe' la strada
            //           della seconda conferma, che cancella passando dalla cartella. Senza cartella
            //           (foto caricate una per una o trascinate) il programma non ha modo di
            //           cancellarle: si torna 'norecycle', e il messaggio dice perche' e cosa fare,
            //           invece del solo "Non rimosse: 1" a ogni tentativo.
            // ENGLISH: 'rifiutato' means the Windows Recycle Bin does not apply to this file (network
            //          folder, USB stick, SD card, or an extension outside the list). With the folder
            //          open ("Load Folder") we return 'nopath', the second-confirmation road, which
            //          deletes through the folder. With no folder (photos loaded one by one or
            //          dropped in) the program has no way to delete them: we return 'norecycle', and
            //          the message says why and what to do, instead of a bare "Not removed: 1" on
            //          every try.
            const esitoImg = resImg && Array.isArray(resImg.results) ? resImg.results[0] : undefined;
            if (esitoImg === 'ok') {
                if (spostati) spostati.img = !!(resImg && resImg.trashed > 0);
                const resTxt = await api.trashFiles([txtPath]);
                if (spostati) spostati.txt = !!(resTxt && resTxt.trashed > 0);
                if (resTxt && !resTxt.ok) console.warn('[Cestino] Il file di testo non e\' stato spostato:', txtPath);
                return 'trashed';
            }
            if (esitoImg === 'rifiutato') return img.dirHandle ? 'nopath' : 'norecycle';
            return 'failed';
        } catch (err) {
            console.warn('[Cestino] Spostamento nel Cestino di Windows non riuscito:', err);
            return 'failed';
        }
    };

    // ITALIANO: cancellazione DEFINITIVA dalla cartella aperta, senza Cestino di Windows e senza
    //           possibilita' di recupero. Si usa SOLO dopo che l'utente ha letto e confermato la
    //           seconda finestra, quella che lo dice a parole. Fino a stamattina questa stessa
    //           chiamata partiva da sola, in silenzio, ogni volta che il Cestino non era
    //           raggiungibile — cioe' sempre, per le cartelle aperte con "Carica Cartella" — e
    //           l'app annunciava comunque "File eliminati con successo".
    // ENGLISH: PERMANENT delete from the open folder: no Recycle Bin, no way back. Used ONLY after
    //          the user has read and confirmed the second dialog, the one that says so in words.
    //          Until this morning this very call ran on its own, silently, whenever the Recycle Bin
    //          was out of reach - that is, always, for folders opened with "Load Folder" - and the
    //          app still announced "Files deleted successfully".
    const deleteImageFilesForGood = async (img: any): Promise<boolean> => {
        const folder = img.dirHandle;
        if (!folder || typeof folder.removeEntry !== 'function') return false;
        try {
            // ITALIANO: il nome VERO della foto, com'e' nella cartella, e il .txt che l'import le
            //           abbina (sidecarTagFileName). Col nome "ripulito", "photo..v2.png" diventava
            //           "photo.v2.png": un'ALTRA foto, se c'era, cancellata per sempre al suo posto.
            // ENGLISH: the photo's REAL name, as it is in the folder, and the .txt the import pairs
            //          with it (sidecarTagFileName). With the "cleaned" name, "photo..v2.png" became
            //          "photo.v2.png": ANOTHER photo, if there was one, deleted for good in its place.
            await folder.removeEntry(img.file.name);
            try { await folder.removeEntry(sidecarTagFileName(img.file.name)); } catch (_) { /* il .txt puo' non esserci */ }
            return true;
        } catch (err) {
            console.error('[Cestino] Cancellazione definitiva non riuscita:', img.file.name, err);
            return false;
        }
    };

    // ITALIANO: Le anteprime vivono in memoria finche' non le si libera esplicitamente. Non veniva
    //           fatto da nessuna parte: chiudendo un progetto da 2000 foto restavano occupati
    //           ~200 MB per tutta la sessione, e cambiando dataset piu' volte l'app finiva la
    //           memoria. Va chiamata ogni volta che delle immagini escono dall'elenco.
    // ENGLISH: Thumbnails stay in memory until explicitly released. Nothing ever did: closing a
    //          2000-photo project left ~200 MB pinned for the whole session, and switching datasets
    //          a few times exhausted the renderer. Call this whenever images leave the list.
    const releaseThumbnails = (imgs: any[]) => {
        for (const img of imgs || []) {
            if (img && typeof img.thumb === 'string' && img.thumb.startsWith('blob:')) {
                try { URL.revokeObjectURL(img.thumb); } catch (_) { /* ignore */ }
            }
        }
    };

    // ITALIANO: libera ogni anteprima annotata per il progetto, anche quelle delle foto che non sono
    //           piu' nell'elenco, e riparte da zero per il progetto dopo. Liberarne una due volte
    //           non fa niente.
    // ENGLISH: releases every thumbnail recorded for the project, including those of photos no
    //          longer in the list, and starts from zero for the next project. Releasing one twice
    //          does nothing.
    const liberaAnteprimeProgetto = () => {
        releaseThumbnails([...anteprimeProgettoRef.current].map(thumb => ({ thumb })));
        anteprimeProgettoRef.current.clear();
    };

    const handleDeletePermanently = async (id: string) => {
        // ITALIANO: la foto com'e' ADESSO, non com'era quando si e' aperta la conferma: se nel
        //           frattempo e' tornata in galleria (Ctrl+Z), non si tocca.
        // ENGLISH: the photo as it is NOW, not as it was when the confirmation opened: if it went
        //          back to the gallery meanwhile (Ctrl+Z), it is left alone.
        const img = imagesRef.current.find(i => i.id === id);
        if (!img || !img.isTrashed) return;

        let esito: 'trashed' | 'nopath' | 'failed' | 'norecycle' = 'failed';
        try {
            esito = await deleteImageFiles(img);
        } catch (error) {
            console.error(error);
        }
        // ITALIANO: niente Cestino di Windows e niente cartella aperta: si dice perche' e cosa fare.
        // ENGLISH: no Windows Recycle Bin and no open folder: say why and what to do.
        if (esito === 'norecycle') {
            showNotification(t.deleteNoRecycleBin, 'error');
            return;
        }
        // ITALIANO: il Cestino di Windows non e' raggiungibile per questa foto: si puo' solo
        //           cancellarla per sempre, e non lo si fa senza chiederlo.
        // ENGLISH: the Windows Recycle Bin is out of reach for this photo: the only option is a
        //          permanent delete, and that is not done without asking.
        if (esito === 'nopath') {
            chiediEliminazioneDefinitiva([img]);
            return;
        }
        // ITALIANO: se il file non e' finito nel Cestino di Windows, la foto RESTA nel cestino
        //           dell'app: cosi' si puo' riprovare. Prima veniva tolta comunque dal progetto e
        //           spariva dalla vista pur essendo ancora sul disco.
        // ENGLISH: if the file did not reach the Windows Recycle Bin, the photo STAYS in the app's
        //          trash so it can be retried. It used to be dropped from the project anyway,
        //          vanishing from view while still sitting on disk.
        if (esito !== 'trashed') {
            showNotification(t.deleteError, 'error');
            return;
        }

        // ITALIANO: il file ha lasciato il disco: non conta piu' nell'impronta del backup, anche se
        //           era stato chiuso e riportato con Ctrl+Z.
        // ENGLISH: the file has left the disk: it no longer counts in the backup's fingerprint, even
        //          if it had been closed and brought back with Ctrl+Z.
        fotoChiuseRef.current.delete(id);
        // ITALIANO: e non conta piu' nemmeno nella cronologia: un Ctrl+Z la rimetteva nel cestino
        //           dell'app mentre il file era nel Cestino di Windows (vedi purgeIdsFromHistory).
        //           L'uscita della foto non e' un passo da annullare: il file non c'e' piu'.
        // ENGLISH: nor in the history any more: one Ctrl+Z put it back in the app's trash while the
        //          file sat in the Windows Recycle Bin (see purgeIdsFromHistory). The photo leaving
        //          is not a step to undo: the file is gone.
        isUndoRedoAction.current = true;
        setImages(prev => prev.filter(i => i.id !== id));
        setHistory(prev => purgeIdsFromHistory(prev, new Set([id])));
        // ITALIANO: la foto non esiste piu': tolgo il suo id anche dalla selezione in blocco, o il
        //           pannello continuerebbe a contarla e ad agire su un id ormai inesistente.
        // ENGLISH: the photo no longer exists: drop its id from the bulk selection too, or the panel
        //          would keep counting it and acting on an id that is gone.
        setSelectedForBulk(prev => prev.filter(x => x !== id));
        showNotification(t.deleteSuccess, 'success');
        soundManager.pop();
    };

    // ITALIANO: ANNULLA LO SVUOTAMENTO
    //   Rimette al loro posto i file dell'ultimo svuotamento, ripescandoli dal Cestino di Windows.
    //   Le foto tornano nel cestino dell'app, cioe' esattamente dove stavano un attimo prima: e'
    //   il contrario esatto del passo che si vuole annullare, non una scorciatoia che le rimette
    //   in galleria saltando un passaggio che l'utente non ha chiesto di saltare.
    //
    //   Si conta la FOTO, non il file: moltissime foto non hanno un .txt accanto, e un .txt che
    //   non e' mai esistito non e' un fallimento da annunciare. Quello che decide e' l'immagine.
    // ENGLISH: UNDO THE EMPTYING
    //   Puts the files of the last emptying back where they were, fishing them out of the Windows
    //   Recycle Bin. The photos return to the app's trash, exactly where they were a moment
    //   earlier: that is the precise opposite of the step being undone, not a shortcut that drops
    //   them back in the gallery, skipping a step the user never asked to skip.
    //
    //   We count the PHOTO, not the file: plenty of photos have no .txt beside them, and a .txt
    //   that never existed is not a failure worth announcing. The image is what decides.
    const annullaSvuotamento = async () => {
        // ITALIANO: non durante uno svuotamento: alla sua fine liberava le anteprime delle foto che
        //           stavano tornando, e l'annullamento, finendo, cancellava il ricordo del nuovo
        //           svuotamento. I due tasti sono spenti; questo vale se un clic arriva lo stesso.
        // ENGLISH: not during an emptying: when it ended it released the thumbnails of the photos
        //          on their way back, and the undo, on finishing, erased the new emptying's record.
        //          Both buttons are disabled; this holds if a click gets through anyway.
        if (!ultimoSvuotamento || ripristinoInCorso || isEmptyingTrash) return;
        const apiLocale = (window as any).electronAPI;
        if (!apiLocale || typeof apiLocale.restoreTrashed !== 'function') return;
        setRipristinoInCorso(true);
        ripristinoInCorsoRef.current = true;
        const progetto = progettoGenRef.current;
        try {
            const voci: any[] = ultimoSvuotamento.voci || [];
            // ITALIANO: PRIMA le sole immagini, e i .txt solo dopo, solo per le foto tornate
            //           davvero. Il .txt di una foto che NON puo' tornare non va rimesso: finirebbe
            //           accanto all'immagine diversa che nel frattempo ha preso il suo nome, e le
            //           attaccherebbe in silenzio i tag di un'altra foto. Per un dataset e' un
            //           errore che poi non si scopre piu'. La coppia torna insieme o non torna.
            // ENGLISH: images FIRST, and the .txt files only afterwards, only for the photos that
            //          actually came back. The .txt of a photo that CANNOT return must not be put
            //          back: it would land beside the different image that has taken its name in the
            //          meantime and silently attach another photo's tags to it. For a dataset that is
            //          a mistake nobody ever catches. The pair comes back together or not at all.
            const esito = await apiLocale.restoreTrashed(voci.map((v: any) => v.imgPath).filter(Boolean));
            const perPercorso = new Map<string, string>();
            if (esito && Array.isArray(esito.results)) {
                esito.results.forEach((r: any) => { if (r && r.percorso) perPercorso.set(r.percorso, String(r.esito || '')); });
            }
            const tornate = voci.filter((v: any) => perPercorso.get(v.imgPath) === 'ok');
            const bloccate = voci.filter((v: any) => perPercorso.get(v.imgPath) === 'occupato');
            const rimaste = voci.filter((v: any) => perPercorso.get(v.imgPath) !== 'ok');
            // ITALIANO: 'nonTrovato' = il Cestino di Windows e' stato letto fino in fondo e il file
            //           non c'e': da li' non tornera' piu'. Tutti gli altri esiti ('fallito',
            //           'rifiutato', nessuna risposta) dicono solo che questa volta non ci si e'
            //           riusciti: il file e' ancora nel Cestino e si puo' riprovare.
            // ENGLISH: 'nonTrovato' = the Windows Recycle Bin was read to the end and the file is not
            //          there: it will never come back from it. Every other outcome ('fallito',
            //          'rifiutato', no answer) only says it did not work this time: the file is still
            //          in the Recycle Bin and a retry is possible.
            const nonTrovate = voci.filter((v: any) => perPercorso.get(v.imgPath) === 'nonTrovato');

            const testi = tornate.map((v: any) => v.txtPath).filter(Boolean);
            // ITALIANO: le foto la cui immagine e' tornata ma il cui .txt no. I tag sono ancora in
            //           memoria, ma la foto risultava salvata (tag uguali a originalTags), quindi
            //           "Salva Modifiche" non riscriveva mai quel .txt e il dataset restava con una
            //           foto senza didascalia. Conta come non tornato ogni esito che non sia 'ok',
            //           anche nessuna risposta o una seconda chiamata che si rompe: prima quella
            //           finiva nel catch e le immagini gia' tornate non rientravano nemmeno nel
            //           cestino dell'app.
            // ENGLISH: the photos whose image came back but whose .txt did not. The tags are still in
            //          memory, but the photo counted as saved (tags equal to originalTags), so "Save
            //          Changes" never rewrote that .txt and the dataset kept a photo with no caption.
            //          Every outcome other than 'ok' counts as not back, no answer and a second call
            //          that breaks too: that one used to land in the catch, and the images already
            //          back did not even re-enter the app's trash.
            const senzaTesto = new Set<string>();
            if (testi.length > 0) {
                let esitoTesti: any = null;
                try {
                    esitoTesti = await apiLocale.restoreTrashed(testi);
                } catch (err) {
                    console.warn('[Cestino] I file di testo non sono tornati:', err);
                }
                const testoPerPercorso = new Map<string, string>();
                if (esitoTesti && Array.isArray(esitoTesti.results)) {
                    esitoTesti.results.forEach((r: any) => { if (r && r.percorso) testoPerPercorso.set(r.percorso, String(r.esito || '')); });
                }
                tornate.forEach((v: any) => {
                    if (!v.txtPath || testoPerPercorso.get(v.txtPath) === 'ok') return;
                    console.warn('[Cestino] Il file di testo non e\' tornato:', v.txtPath, testoPerPercorso.get(v.txtPath) || '(nessuna risposta)');
                    senzaTesto.add(v.img.id);
                });
            }

            // ITALIANO: il progetto e' stato chiuso o azzerato mentre si aspettava il Cestino di
            //           Windows: i file sono tornati nella loro cartella (immagine e .txt insieme), ma
            //           le foto non entrano nel progetto di adesso, ne' il suo tasto di annullamento.
            // ENGLISH: the project was closed or reset while waiting for the Windows Recycle Bin: the
            //          files are back in their folder (image and .txt together), but the photos do not
            //          enter the current project, nor does its undo button.
            if (progetto !== progettoGenRef.current) {
                console.warn('[Cestino] Annullamento finito dopo la chiusura del progetto: file rimessi su disco, progetto attuale non toccato.');
                return;
            }

            if (tornate.length > 0) {
                // ITALIANO: tornano nel cestino dell'app, da dove "Ripristina" le riporta in galleria.
                // ENGLISH: back into the app's trash, from where "Restore" brings them to the gallery.
                // ITALIANO: mai due volte: una foto che nel progetto c'e' gia' non si aggiunge di
                //           nuovo, o ci sarebbero due card con lo stesso id.
                // ENGLISH: never twice: a photo already in the project is not added again, or
                //          there would be two cards with the same id.
                // ITALIANO: originalTags vuoto = "sul disco non c'e' il suo .txt": la foto resta da
                //           salvare, e dopo "Ripristina" (Salva salta le foto nel cestino) "Salva
                //           Modifiche" lo riscrive dai tag in memoria; il messaggio lo dice.
                // ENGLISH: empty originalTags = "its .txt is not on disk": the photo stays to be
                //          saved, and after "Restore" (Save skips trashed photos) "Save Changes"
                //          rewrites it from the tags in memory; the message says so.
                setImages(prev => {
                    const presenti = new Set(prev.map(i => i.id));
                    return [...prev, ...tornate.filter((v: any) => !presenti.has(v.img.id))
                        .map((v: any) => (senzaTesto.has(v.img.id) ? { ...v.img, isTrashed: true, originalTags: [] } : { ...v.img, isTrashed: true }))];
                });
            }
            // ITALIANO: si tiene solo cio' che NON e' tornato, cosi' il tasto resta a disposizione
            //           per quelle e sparisce quando non c'e' piu' niente da ripescare.
            // ENGLISH: keep only what did NOT come back, so the button stays available for those
            //          and disappears once there is nothing left to fish out.
            // ITALIANO: e non si tiene cio' che nel Cestino non c'e' piu': prima restava, e il tasto
            //           rifaceva a ogni clic lo stesso giro a vuoto fino alla chiusura del progetto.
            //           Le loro anteprime non le mostra piu' nessuno: si liberano.
            // ENGLISH: and what is no longer in the Recycle Bin is not kept: it used to stay, and the
            //          button redid the same empty round at every click until the project closed.
            //          Their thumbnails are shown by nobody any more: they are released.
            const riprovabili = rimaste.filter((v: any) => perPercorso.get(v.imgPath) !== 'nonTrovato');
            releaseThumbnails(nonTrovate.map((v: any) => v.img));
            setUltimoSvuotamento(riprovabili.length > 0 ? { voci: riprovabili } : null);

            // ITALIANO: IL MOTIVO CAMBIA IL MESSAGGIO. Dire "non trovate nel Cestino di Windows"
            //           quando il file c'era eccome, e non e' stato rimesso apposta per non
            //           sovrascrivere un omonimo, e' una bugia: manda a cercare nel posto sbagliato
            //           e fa sembrare perso un file che invece e' li'. Il canale la distinzione ce
            //           l'ha; buttarla via qui sarebbe stato lo stesso difetto che questa versione
            //           e' andata a estirpare dappertutto.
            // ENGLISH: THE REASON CHANGES THE MESSAGE. Saying "not found in the Windows Recycle Bin"
            //          when the file was very much there, and was deliberately left alone so as not
            //          to overwrite a namesake, is a lie: it sends the user looking in the wrong
            //          place and makes a file that is safe look lost. The channel keeps the
            //          distinction; throwing it away here would have been the very defect this
            //          version went round the whole program to remove.
            // ITALIANO: e "non trovato, forse e' stato svuotato" solo se e' vero per TUTTE: quando
            //           PowerShell viene fermato, e' bloccato o risponde male, i file sono ancora
            //           nel Cestino di Windows e dirlo svuotato li farebbe credere persi.
            // ENGLISH: and "not found, it may have been emptied" only when true for ALL of them:
            //          when PowerShell is stopped, blocked or answers badly, the files are still in
            //          the Windows Recycle Bin and calling it emptied would make them look lost.
            // ITALIANO: "c'e' gia' un omonimo" solo se e' il motivo di TUTTE quelle non tornate, come
            //           nel ramo parziale qui sotto: prima vinceva appena una era bloccata, diceva
            //           "Foto: 1" su tre e taceva le altre, anche quelle sparite dal Cestino.
            // ENGLISH: "a namesake is already there" only when it is the reason for ALL those not
            //          back, as in the partial branch below: it used to win as soon as one was
            //          blocked, said "Photos: 1" out of three and kept quiet about the others, even
            //          those gone from the Recycle Bin.
            // ITALIANO: non e' tornato niente, per motivi diversi (omonimo, sparita dal Cestino,
            //           non riuscita): una frase con un conto per motivo. Prima si cadeva su
            //           "Dovrebbero essere ancora li'", falso per quelle sparite dal Cestino di
            //           Windows, e il motivo dell'omonimo si perdeva.
            // ENGLISH: nothing came back, for different reasons (namesake, gone from the bin, not
            //          managed): one sentence with a count per reason. It used to fall to "They
            //          should still be there", false for those gone from the Windows Recycle Bin,
            //          and the namesake reason was lost.
            // ITALIANO: i .txt non tornati si dicono accanto all'esito delle immagini, e il
            //           messaggio non e' piu' il verde "tutto a posto".
            // ENGLISH: the .txt files not back are reported next to the images' outcome, and the
            //          message is no longer the green "all done".
            const conTesti = (frase: string) => (senzaTesto.size > 0
                ? [frase, t.undoEmptyTxtNotBack.replace('{n}', String(senzaTesto.size))].join(' · ')
                : frase);
            if (tornate.length === 0 && bloccate.length > 0 && bloccate.length === rimaste.length) {
                showNotification(t.undoEmptyBlocked.replace('{n}', String(bloccate.length)), 'info');
            } else if (tornate.length === 0 && nonTrovate.length === rimaste.length) {
                showNotification(t.undoEmptyNone, 'error');
            } else if (tornate.length === 0 && (bloccate.length > 0 || nonTrovate.length > 0)) {
                showNotification(t.undoEmptyMixed.replace('{blocked}', String(bloccate.length)).replace('{gone}', String(nonTrovate.length))
                    .replace('{failed}', String(rimaste.length - bloccate.length - nonTrovate.length)), 'error');
            } else if (tornate.length === 0) {
                showNotification(t.undoEmptyFailed, 'error');
            } else if (bloccate.length > 0 && bloccate.length === rimaste.length) {
                showNotification(conTesti(t.undoEmptyPartialBlocked.replace('{done}', String(tornate.length)).replace('{n}', String(bloccate.length))), 'info');
            } else if (rimaste.length > 0) {
                showNotification(conTesti(t.undoEmptyPartial.replace('{done}', String(tornate.length)).replace('{failed}', String(rimaste.length))), 'info');
            } else if (senzaTesto.size > 0) {
                showNotification(conTesti(t.undoEmptyDone.replace('{n}', String(tornate.length))), 'info');
            } else { showNotification(t.undoEmptyDone.replace('{n}', String(tornate.length)), 'success'); soundManager.pop(); }
        } catch (err) {
            console.error('[Cestino] Annullamento dello svuotamento non riuscito:', err);
            // ITALIANO: un errore del canale non dice niente del Cestino: i file sono ancora li'.
            //           Non lo si dice in un progetto aperto dopo: non e' il suo.
            // ENGLISH: a channel error says nothing about the Recycle Bin: the files are still there.
            //          It is not said in a project opened afterwards: it is not that project's.
            if (progetto === progettoGenRef.current) showNotification(t.undoEmptyFailed, 'error');
        } finally {
            setRipristinoInCorso(false);
            ripristinoInCorsoRef.current = false;
        }
    };

    const handleEmptyTrash = async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        // ITALIANO: mentre "Annulla lo svuotamento" ripesca i file non si svuota: il nuovo
        //           svuotamento liberava le anteprime delle foto che stavano tornando, e
        //           l'annullamento, finendo, ne cancellava il ricordo. Il tasto e' spento, ma una
        //           conferma aperta prima arriva lo stesso fin qui: si dice che cosa sta succedendo.
        // ENGLISH: while "Undo the emptying" is fishing files back nothing is emptied: the new
        //          emptying released the thumbnails of the photos on their way back, and the undo,
        //          on finishing, erased its record. The button is off, but a confirmation opened
        //          earlier still gets here: the user is told what is going on.
        if (ripristinoInCorsoRef.current) { showNotification(t.undoEmptyWorking, 'info'); return; }

        // ITALIANO: si tolgono dal progetto SOLO le foto che sono davvero arrivate nel Cestino di
        //           Windows. Quelle che non ce l'hanno fatta restano nel cestino dell'app, sotto gli
        //           occhi, e la finestra non si chiude: prima si svuotava tutto e si annunciava
        //           "riuscito" comunque, quindi un file bloccato spariva dalla vista e restava su
        //           disco senza che nessuno lo sapesse.
        // ENGLISH: only the photos that actually reached the Windows Recycle Bin leave the project.
        //          The ones that failed stay in the app's trash, in plain sight, and the window does
        //          not close: it used to empty everything and report success regardless, so a locked
        //          file vanished from view and stayed on disk with nobody the wiser.
        // ITALIANO: durante il ciclo la finestra resta aperta, quindi "Ripristina tutte" sarebbe
        //           cliccabile: premuto a meta' svuotamento rimetteva le foto in galleria mentre il
        //           ciclo continuava a spostarne i file nel Cestino, lasciando in progetto card che
        //           puntano a file spariti. Con la spia accesa i due tasti sono spenti.
        // ENGLISH: the window stays open during the loop, so "Restore all" would be clickable:
        //          pressed halfway it put the photos back in the gallery while the loop kept moving
        //          their files to the Recycle Bin, leaving cards pointing at files that are gone.
        //          With this flag set, both buttons are disabled.
        // ITALIANO: spenti anche "Ripristina" e la X di ogni singola foto, che prima restavano
        //           attivi durante lo svuotamento.
        // ENGLISH: the "Restore" and the X of every single photo are disabled too; they used to
        //          stay live during the emptying.
        setIsEmptyingTrash(true);
        const progetto = progettoGenRef.current;
        const removedIds = new Set<string>();
        const ripescabili: any[] = [];
        const senzaPercorso: any[] = [];
        let failed = 0;
        // ITALIANO: quante fra le non rimosse sono senza Cestino di Windows e senza cartella aperta.
        // ENGLISH: how many of the ones not removed have no Windows Recycle Bin and no open folder.
        let senzaCestino = 0;
        for (const scelta of trashedImages) {
            // ITALIANO: l'elenco e' quello del clic su "Svuota"; la foto si guarda com'e' ADESSO.
            //           Una foto tornata in galleria nel frattempo (Ctrl+Z con la conferma aperta,
            //           o il suo "Ripristina" durante lo svuotamento) non va nel Cestino di Windows:
            //           prima ci finiva lo stesso e spariva anche dalla galleria.
            // ENGLISH: the list is the one from the click on "Empty"; the photo is looked at as it
            //          is NOW. A photo that went back to the gallery meanwhile (Ctrl+Z with the
            //          confirmation open, or its own "Restore" during the emptying) does not go to
            //          the Windows Recycle Bin: it used to go anyway and vanish from the gallery too.
            const img = imagesRef.current.find(i => i.id === scelta.id);
            if (!img || !img.isTrashed) continue;
            let esito: 'trashed' | 'nopath' | 'failed' | 'norecycle' = 'failed';
            // ITALIANO: i percorsi si prendono PRIMA di spostare il file: dopo, al suo posto non
            //           c'e' piu' niente da cui ricavarli.
            // ENGLISH: take the paths BEFORE moving the file: afterwards nothing is left in its
            //          place to work them out from.
            const percorsi = percorsiSuDisco(img);
            const spostati: { img?: boolean; txt?: boolean } = {};
            try {
                esito = await deleteImageFiles(img, spostati);
            } catch (error) {
                console.error("Failed to delete", img.file.name, error);
            }
            // ITALIANO: si annota solo cio' che e' stato spostato davvero: un .txt che non c'era non
            //           si chiede indietro (finirebbe accanto alla foto il .txt omonimo di un'altra
            //           foto, rimasto nel Cestino da prima), e un'immagine gia' sparita dal disco esce
            //           dal progetto senza poter essere "annullata" in un'immagine vecchia.
            // ENGLISH: record only what really moved: a .txt that was not there is not asked back (the
            //          namesake .txt of another photo, left in the bin from before, would land beside
            //          this photo), and an image already gone from disk leaves the project without
            //          being "undone" into an old image.
            if (esito === 'trashed') {
                removedIds.add(img.id);
                if (percorsi.imgPath && spostati.img) ripescabili.push({ img, imgPath: percorsi.imgPath, txtPath: spostati.txt ? percorsi.txtPath : '' });
            }
            else if (esito === 'nopath') senzaPercorso.push(img);
            else {
                failed++;
                if (esito === 'norecycle') senzaCestino++;
            }
        }
        setIsEmptyingTrash(false);
        // ITALIANO: il progetto e' stato chiuso o azzerato durante lo svuotamento: da li' il ciclo
        //           non ha piu' spostato niente, e cio' che era gia' nel Cestino di Windows ci resta.
        //           Niente annullamento, messaggi o seconda finestra nel progetto di adesso.
        // ENGLISH: the project was closed or reset during the emptying: from then on the loop moved
        //          nothing more, and what already reached the Windows Recycle Bin stays there. No
        //          undo, messages or second dialog in the current project.
        if (progetto !== progettoGenRef.current) {
            console.warn('[Cestino] Svuotamento interrotto dalla chiusura del progetto: file gia\' spostati nel Cestino di Windows:', removedIds.size);
            return;
        }
        // ITALIANO: nel cestino non era rimasto niente da svuotare (tutto ripristinato nel
        //           frattempo): nessun messaggio di file spostati che non si sono mossi.
        // ENGLISH: nothing was left in the trash to empty (all restored meanwhile): no message
        //          about files moved that never moved.
        if (removedIds.size === 0 && failed === 0 && senzaPercorso.length === 0) return;
        // ITALIANO: cio' che si puo' ancora ripescare dal Cestino di Windows. Senza questo elenco,
        //           dopo lo svuotamento non resterebbe traccia di dove stavano i file, e nel Cestino
        //           di Windows c'e' la roba di tutti: la propria non si riconoscerebbe piu'.
        // ENGLISH: what can still be fished back out of the Windows Recycle Bin. Without this list
        //          nothing would record where the files used to be, and the Windows Recycle Bin
        //          holds everybody's things: ours could no longer be told apart.
        if (ripescabili.length > 0) {
            // ITALIANO: si annulla solo l'ULTIMO svuotamento: quello prima esce di scena, e le sue
            //           anteprime - che nessuno mostra piu' - si liberano invece di restare in
            //           memoria fino alla chiusura.
            // ENGLISH: only the LAST emptying can be undone: the one before leaves the stage, and
            //          its thumbnails - shown by nobody any more - are freed instead of sitting in
            //          memory until the program closes.
            // ITALIANO: mai l'anteprima di una foto che sta nel progetto: se l'annullamento l'ha
            //           rimessa nel cestino dell'app, quell'anteprima e' a schermo.
            // ENGLISH: never the thumbnail of a photo that is in the project: if the undo put it
            //          back in the app's trash, that thumbnail is on screen.
            if (ultimoSvuotamento) {
                const nelProgetto = new Set(imagesRef.current.map(i => i.id));
                releaseThumbnails(ultimoSvuotamento.voci.map((v: any) => v.img).filter((img: any) => !nelProgetto.has(img.id)));
            }
            setUltimoSvuotamento({ voci: ripescabili });
        }

        // ITALIANO: se non e' stata rimossa nemmeno una foto, NON si tocca `images`: `filter` creerebbe
        //           comunque un array nuovo, l'effetto che registra la cronologia lo vedrebbe come una
        //           modifica e il primo Ctrl+Z successivo si consumerebbe su un passo vuoto invece di
        //           annullare l'ultima modifica vera ai tag.
        // ENGLISH: if not a single photo was removed, do NOT touch `images`: `filter` would still make
        //          a new array, the history effect would read it as a change, and the next Ctrl+Z would
        //          burn itself on an empty step instead of undoing the user's last real tag edit.
        // ITALIANO: e quando delle foto escono, escono anche da OGNI passo della cronologia, e la
        //           loro uscita non diventa un passo: prima un Ctrl+Z dopo lo svuotamento le
        //           rimetteva nel cestino dell'app mentre i file erano nel Cestino di Windows, e da
        //           li' Salva scriveva .txt orfani nella cartella. Cosi' anche le anteprime del
        //           penultimo svuotamento, liberate qui sopra, non restano in nessun passo.
        // ENGLISH: and when photos leave, they leave EVERY step of the history too, and their
        //          leaving does not become a step: a Ctrl+Z after emptying used to put them back in
        //          the app's trash while the files sat in the Windows Recycle Bin, and from there
        //          Save wrote orphan .txt files into the folder. This way the thumbnails of the
        //          previous emptying, released above, are not left in any step either.
        removedIds.forEach(id => fotoChiuseRef.current.delete(id));
        if (removedIds.size > 0) {
            isUndoRedoAction.current = true;
            setImages(prev => prev.filter(i => !removedIds.has(i.id)));
            setHistory(prev => purgeIdsFromHistory(prev, removedIds));
        }
        // ITALIANO: le foto svuotate dal cestino non esistono piu': ripulisco la selezione in blocco
        //           dai loro id, altrimenti il contatore del pannello sovrastimerebbe.
        // ENGLISH: emptied-trash photos are gone: clear their ids from the bulk selection, otherwise
        //          the panel counter would over-report.
        setSelectedForBulk(prev => prev.filter(x => !removedIds.has(x)));
        // ITALIANO: per queste il Cestino di Windows non c'e'. Non si cancella di nascosto: si apre
        //           la seconda finestra, che dice quante sono, perche', e che non si torna indietro.
        // ENGLISH: for these the Windows Recycle Bin is not available. Nothing is deleted behind the
        //          user's back: the second dialog opens, saying how many, why, and that it is final.
        // ITALIANO: con loro viaggia il conto di questa prima parte (spostate nel Cestino di Windows,
        //           non riuscite): prima si perdeva qui, e il messaggio finale non ne diceva niente.
        // ENGLISH: the count of this first part travels with them (moved to the Windows Recycle
        //          Bin, failed): it used to be lost here, and the final message said nothing of it.
        if (senzaPercorso.length > 0) {
            chiediEliminazioneDefinitiva(senzaPercorso, { done: removedIds.size, failed, senzaCestino });
            return;
        }
        if (failed > 0) {
            showNotification(fraseCestinoWindows({ done: removedIds.size, failed, senzaCestino }), 'error');
            return;
        }
        setIsTrashOpen(false);
        showNotification(t.deleteSuccess, 'success');
        soundManager.pop();
    };

    // ITALIANO: la seconda finestra. Compare solo quando il Cestino di Windows non e' raggiungibile,
    //           dice quante foto riguarda e che la cancellazione e' definitiva. Se si annulla, le
    //           foto restano dove sono: nel cestino dell'app e sul disco.
    // ENGLISH: the second dialog. It shows only when the Windows Recycle Bin is out of reach, says
    //          how many photos it covers and that the delete is final. On cancel the photos stay
    //          where they are: in the app's trash and on disk.
    // ITALIANO: `prima` = com'e' andata la prima parte dello stesso svuotamento, quella del Cestino
    //           di Windows. Si dice sempre, che si confermi o che si annulli: prima le foto spostate
    //           sparivano dal cestino dell'app senza una parola, e quelle bloccate non venivano
    //           nominate.
    // ENGLISH: `prima` = how the first part of the same emptying went, the Windows Recycle Bin
    //          one. It is always said, on confirm or on cancel: the moved photos used to vanish from
    //          the app's trash without a word, and the locked ones were never named.
    // ITALIANO: `senzaCestino` = quante fra le non rimosse non hanno ne' il Cestino di Windows ne'
    //           la cartella aperta: per quelle si aggiunge la frase che dice perche' e cosa fare.
    // ENGLISH: `senzaCestino` = how many of the ones not removed have neither the Windows Recycle
    //          Bin nor an open folder: for those the sentence saying why and what to do is added.
    const fraseCestinoWindows = (prima: { done: number; failed: number; senzaCestino?: number }): string => {
        if (prima.failed > 0) return [t.deletePartial.replace('{done}', String(prima.done)).replace('{failed}', String(prima.failed)),
            (prima.senzaCestino || 0) > 0 ? t.deleteNoRecycleBin : ''].filter(Boolean).join(' · ');
        return prima.done > 0 ? t.deleteSuccess : '';
    };

    const chiediEliminazioneDefinitiva = (imgs: any[], prima: { done: number; failed: number; senzaCestino?: number } = { done: 0, failed: 0 }) => {
        setConfirmDialog({
            isOpen: true,
            title: t.deleteForGood,
            message: t.confirmHardDelete.replace('{n}', String(imgs.length)),
            onConfirm: () => eliminaPerSempre(imgs, prima),
            onCancel: () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                const frase = fraseCestinoWindows(prima);
                if (frase) showNotification(frase, prima.failed > 0 ? 'error' : 'success');
            }
        });
    };

    const eliminaPerSempre = async (imgs: any[], prima: { done: number; failed: number; senzaCestino?: number } = { done: 0, failed: 0 }) => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsEmptyingTrash(true);
        const progetto = progettoGenRef.current;
        const removedIds = new Set<string>();
        let failed = 0;
        for (const scelta of imgs) {
            // ITALIANO: come in "Svuota cestino": l'elenco e' quello della finestra, la foto si
            //           guarda com'e' ADESSO. Una foto tornata in galleria nel frattempo (Ctrl+Z
            //           mentre le altre si cancellano) non si tocca: prima veniva cancellata per
            //           sempre lo stesso, e spariva dalla galleria.
            // ENGLISH: as in "Empty trash": the list is the dialog's, the photo is looked at as it
            //          is NOW. A photo that went back to the gallery meanwhile (Ctrl+Z while the
            //          others are being deleted) is not touched: it used to be deleted for good
            //          anyway, and vanished from the gallery.
            const img = imagesRef.current.find(i => i.id === scelta.id);
            if (!img || !img.isTrashed) continue;
            if (await deleteImageFilesForGood(img)) removedIds.add(img.id); else failed++;
        }
        setIsEmptyingTrash(false);
        // ITALIANO: come in "Svuota cestino": il progetto e' stato chiuso o azzerato durante la
        //           cancellazione. Niente messaggio, chiusura della finestra del cestino o passo di
        //           cronologia nel progetto di adesso: non e' il suo lavoro.
        // ENGLISH: as in "Empty trash": the project was closed or reset during the delete. No
        //          message, trash-window close or history step in the current project: it is not
        //          that project's job.
        if (progetto !== progettoGenRef.current) {
            console.warn('[Cestino] Cancellazione definitiva interrotta dalla chiusura del progetto: file gia\' cancellati:', removedIds.size);
            return;
        }
        // ITALIANO: non e' stata cancellata nessuna foto (tutte tornate in galleria): niente
        //           "eliminate per sempre: 0", si dice solo com'e' andata la prima parte, se c'e'.
        // ENGLISH: no photo was deleted (all back in the gallery): no "deleted for good: 0", only
        //          how the first part went is said, if there was one.
        if (removedIds.size === 0 && failed === 0) {
            const frase = fraseCestinoWindows(prima);
            if (frase) showNotification(frase, prima.failed > 0 ? 'error' : 'success');
            return;
        }

        if (removedIds.size > 0) {
            removedIds.forEach(id => fotoChiuseRef.current.delete(id));
            // ITALIANO: come per lo svuotamento: i file non esistono piu', Ctrl+Z non li riporta.
            // ENGLISH: as for the emptying: the files no longer exist, Ctrl+Z does not bring them back.
            isUndoRedoAction.current = true;
            setImages(prev => prev.filter(i => !removedIds.has(i.id)));
            setHistory(prev => purgeIdsFromHistory(prev, removedIds));
            setSelectedForBulk(prev => prev.filter(x => !removedIds.has(x)));
        }
        // ITALIANO: un solo messaggio con le due parti, prima il Cestino di Windows e poi questa.
        //           Se qualcosa e' rimasto nel cestino dell'app (qui o nella prima parte) e' un
        //           errore e la finestra resta aperta, con quelle foto sotto gli occhi.
        // ENGLISH: one message with both parts, first the Windows Recycle Bin and then this one. If
        //          anything stayed in the app's trash (here or in the first part) it is an error and
        //          the window stays open, with those photos in plain sight.
        const testo = [fraseCestinoWindows(prima), failed > 0
            ? t.deleteForGoodPartial.replace('{done}', String(removedIds.size)).replace('{failed}', String(failed))
            : t.deleteForGoodDone.replace('{done}', String(removedIds.size))].filter(Boolean).join(' · ');
        if (failed > 0 || prima.failed > 0) {
            showNotification(testo, 'error');
            return;
        }
        // ITALIANO: la finestra si chiude solo se il cestino e' vuoto davvero: con la X su una sola
        //           foto le altre restano li'. imagesRef non ha ancora tolto quelle appena
        //           cancellate, per questo si escludono a mano.
        // ENGLISH: the window closes only when the trash is really empty: with the X on a single
        //          photo the others stay there. imagesRef has not dropped the ones just deleted yet,
        //          hence they are left out by hand.
        if (!imagesRef.current.some(i => i.isTrashed && !removedIds.has(i.id))) setIsTrashOpen(false);
        showNotification(testo, 'success');
        soundManager.pop();
    };

    const handleRestoreAll = () => {
        // ITALIANO: si rifanno solo le foto del cestino: le altre restano lo STESSO oggetto, come
        //           negli altri passi della cronologia. Prima si copiava ogni foto, e dopo uno
        //           svuotamento il primo Ctrl+Z si fermava su un passo uguale a quello attuale.
        // ENGLISH: only the trashed photos are rebuilt: the others stay the SAME object, as in the
        //          other history steps. Every photo used to be copied, and after an emptying the
        //          first Ctrl+Z stopped on a step equal to the current one.
        setImages(prev => prev.map(img => (img.isTrashed ? { ...img, isTrashed: false } : img)));
        showNotification(t.allPhotosRestored, "success");
        setIsTrashOpen(false);
        soundManager.pop();
    };

    // ITALIANO: Limiti di sicurezza sull'ingestione dei .txt sidecar (un dataset scaricato è input non fidato).
    //           Quelli sul numero e sulla lunghezza dei tag stanno con la lettura, in sidecarTags.
    // ENGLISH: Safety caps on sidecar .txt ingestion (a downloaded dataset is untrusted input).
    //          The caps on tag count and length live with the reading, in sidecarTags.
    const TXT_MAX_BYTES = 1024 * 1024;

    const processImportData = async (imgFiles: any[], txtFiles: any[], handle: any = null, folderOf: Map<any, any> | null = null, relPathOf: Map<any, string> | null = null, pathOf: Map<any, string> | null = null, cartellaRelOf: Map<any, string> | null = null) => {
        setImportSummary({ isOpen: false, summary: null, pendingData: null });
        // ITALIANO: la cartella globale serve solo come "cartella corrente" (backup anti-crash,
        //           visualizzatore). NON la azzeriamo se questo import non ne ha una — prima
        //           "Carica immagini" la metteva a null e i salvataggi degradavano a download.
        // ENGLISH: the global folder is only the "current folder" hint (crash backup, lightbox).
        //          We do NOT clear it when this import has none — "Load images" used to set it to
        //          null, silently degrading every later save into browser downloads.
        if (handle) setDirHandle(handle);
        // ITALIANO: la barra riparte da zero solo se nessun altro import la sta usando (vedi importAttiviRef).
        // ENGLISH: the bar restarts from zero only when no other import is using it (see importAttiviRef).
        if (importAttiviRef.current === 0) setImportProgress(0);
        importAttiviRef.current++;
        setIsImporting(true);
        let skippedTxtCount = 0;
        // ITALIANO: i nomi dei .txt saltati: l'avviso di fine import dice i primi (vedi avvisoImport).
        // ENGLISH: the names of the skipped .txt files: the end-of-import notice names the first ones (see avvisoImport).
        const nomiSaltati: string[] = [];
        let shortenedTxtCount = 0;
        let restoredCount = 0;
        try {
            await new Promise(r => setTimeout(r, 300));

            // ITALIANO: Eventuale backup automatico dei tag (recupero post-crash) — vedi effetto 'tagBackup'.
            //           Lo applichiamo SOLO se l'IMPRONTA di questa cartella coincide (nome cartella +
            //           numero di immagini + prima e ultima in ordine alfabetico): le regole stanno in
            //           backupDellImport. Ogni import e' un "lotto": le foto se lo portano dietro, con il
            //           nome della cartella, cosi' il backup tiene un'impronta per ogni cartella aperta.
            // ENGLISH: Automatic tag backup, if any (post-crash recovery) — see the 'tagBackup' effect.
            //          Applied ONLY when THIS folder's FINGERPRINT matches (folder name + image count +
            //          first and last name alphabetically): the rules live in backupDellImport. Every
            //          import is a "batch": the photos carry it, with the folder's name, so the backup
            //          keeps one fingerprint per open folder.
            const importFolder = (handle && handle.name) ? String(handle.name) : '';
            const importSignature = folderSignature(importFolder, imgFiles.map(f => f.name));
            const lottoImport = nuovoIdFoto();
            let backup: { voci: Record<string, any>; ts: number | null } | null = null;
            try {
                backup = backupDellImport(localStorage.getItem('tagBackup'), importFolder, importSignature);
            } catch (_) { backup = null; }
            const backupMap = backup ? backup.voci : null;

            // ITALIANO: chiave cartella+nome (vedi makeFolderKeyer): stessa immagine e stesso
            //           .txt SOLO se stanno nella stessa sottocartella.
            // ENGLISH: folder+name key (see makeFolderKeyer): an image and a .txt pair up ONLY
            //          when they live in the same subfolder.
            const folderKeyOf = makeFolderKeyer(folderOf);
            // ITALIANO: chiave del backup anti-crash (cartella + nome), stabile fra le sessioni.
            //           `nomiUnici` contiene i nomi che compaiono UNA sola volta in questo import:
            //           solo per quelli si puo' ancora leggere un backup VECCHIO (salvato col solo
            //           nome del file) senza rischio di scambio, cosi' un recupero gia' in memoria
            //           non va perso con l'aggiornamento.
            // ENGLISH: crash-backup key (folder + name), stable across sessions. `nomiUnici` holds
            //          the names appearing exactly ONCE in this import: only for those can an OLD
            //          backup (keyed by file name alone) still be read with no risk of a mix-up, so
            //          an already-stored recovery is not lost on upgrade.
            const backupKeyOf = makeBackupKeyer(folderOf, relPathOf);
            const conteggioNomi = new Map<string, number>();
            for (const f of imgFiles) conteggioNomi.set(f.name, (conteggioNomi.get(f.name) || 0) + 1);
            const nomiUnici = new Set([...conteggioNomi.entries()].filter(([, n]) => n === 1).map(([nome]) => nome));
            // ITALIANO: secondo ripiego, per i backup scritti dalla versione PRECEDENTE, che usava il
            //           solo nome della sottocartella invece del percorso completo. Senza di esso, chi
            //           aggiorna avendo modifiche non salvate su foto in sottocartella se le vedrebbe
            //           sparire in silenzio. Lo accetto SOLO dove quella chiave vecchia e' univoca in
            //           questo import: se due sottocartelle hanno lo stesso nome, la voce vecchia era
            //           gia' ambigua all'origine e va scartata.
            // ENGLISH: a second fallback for backups written by the PREVIOUS version, which used the
            //          subfolder's leaf name instead of the full path. Without it, anyone upgrading
            //          with unsaved edits on photos in subfolders would see them vanish silently. It
            //          is accepted ONLY where that old key is unique in this import: if two subfolders
            //          share a name, the old entry was already ambiguous at the source and is dropped.
            const chiaveFogliaOf = makeBackupKeyer(folderOf, null);
            const conteggioFoglia = new Map<string, number>();
            for (const f of imgFiles) {
                const k = chiaveFogliaOf(f);
                conteggioFoglia.set(k, (conteggioFoglia.get(k) || 0) + 1);
            }
            const textMap = new Map();
            // ITALIANO: data di modifica di ogni .txt: serve solo ai backup della versione precedente
            //           (vedi tagDaRipristinare).
            // ENGLISH: each .txt's modification date: only needed by the previous version's backups
            //          (see tagDaRipristinare).
            const txtMtime = new Map<string, number>();
            // ITALIANO: i .txt che ci sono ma non si sono potuti leggere: la loro foto non deve
            //           risultare modificata, o "Salva" ci scriverebbe sopra (vedi tagDiImport).
            // ENGLISH: the .txt files that exist but could not be read: their photo must not count
            //          as modified, or "Save" would write over them (see tagDiImport).
            const txtNonLetti = new Set<string>();
            for (let i = 0; i < txtFiles.length; i++) {
                try {
                    if (txtFiles[i].size > TXT_MAX_BYTES) {
                        // ITALIANO: Un sidecar legittimo pesa pochi KB: oltre 1 MB è sospetto, lo saltiamo
                        // ENGLISH: A legit sidecar weighs a few KB: over 1 MB is suspicious, skip it
                        console.warn(`[Import] Skipped oversized .txt (${txtFiles[i].size} bytes):`, txtFiles[i].name);
                        skippedTxtCount++;
                        nomiSaltati.push(String(txtFiles[i].name || ''));
                        txtNonLetti.add(folderKeyOf(txtFiles[i]));
                    } else {
                        const text = await txtFiles[i].text();
                        const letti = parseSidecarText(text);
                        if (letti.truncated) {
                            console.warn('[Import] .txt oltre i limiti, accorciato / over the caps, shortened:', txtFiles[i].name);
                            shortenedTxtCount++;
                        }
                        textMap.set(folderKeyOf(txtFiles[i]), letti.tags);
                        txtMtime.set(folderKeyOf(txtFiles[i]), Number(txtFiles[i].lastModified) || 0);
                    }
                } catch (e) {
                    // ITALIANO: File illeggibile (lockato/spostato): si salta, l'import non deve bloccarsi
                    // ENGLISH: Unreadable file (locked/moved): skip it, the import must not get stuck
                    console.warn('[Import] Unreadable .txt skipped:', txtFiles[i]?.name, e);
                    skippedTxtCount++;
                    nomiSaltati.push(String((txtFiles[i] && txtFiles[i].name) || ''));
                    if (txtFiles[i]) txtNonLetti.add(folderKeyOf(txtFiles[i]));
                }
                setImportProgress(Math.round(((i + 1) / (imgFiles.length + txtFiles.length)) * 50));
            }

            // ITALIANO: PRESTAZIONI — le miniature si generano a piccoli GRUPPI in PARALLELO, non
            //           piu' una alla volta. La decodifica delle immagini e' il collo di bottiglia
            //           dell'importazione: farla in serie, con tante foto, era lentissima. Il limite
            //           di concorrenza tiene bassa la memoria (poche immagini decodificate insieme).
            //           Il risultato e' identico: ogni foto riceve la sua miniatura.
            // ENGLISH: PERF — thumbnails are generated in small PARALLEL batches, no longer one at a
            //          time. Image decoding is the import bottleneck: doing it serially with many
            //          photos was very slow. The concurrency limit keeps memory bounded (few images
            //          decoded at once). The result is identical: each photo gets its own thumbnail.
            const THUMB_CONCURRENCY = 6;
            const thumbs: any[] = new Array(imgFiles.length).fill(null);
            let thumbsDone = 0;
            for (let start = 0; start < imgFiles.length; start += THUMB_CONCURRENCY) {
                const batch = [];
                for (let i = start; i < Math.min(start + THUMB_CONCURRENCY, imgFiles.length); i++) {
                    const idx = i;
                    batch.push(
                        generateThumbnail(imgFiles[idx])
                            .then((td: any) => { thumbs[idx] = td; })
                            .catch((e: any) => { console.warn('[Import] Thumbnail failed for', imgFiles[idx]?.name, e); })
                            .finally(() => { thumbsDone++; setImportProgress(50 + Math.round((thumbsDone / imgFiles.length) * 50)); })
                    );
                }
                await Promise.all(batch);
            }

            // ITALIANO: le trigger di adesso, non quelle di quando si e' premuto Importa (vedi
            //           globalTriggersRef). Da qui a setImages non c'e' nessuna attesa.
            // ENGLISH: the current triggers, not those from when Import was pressed (see
            //          globalTriggersRef). There is no wait from here to setImages.
            const triggerAttive = globalTriggersRef.current;
            const newImages = [];
            for (let i = 0; i < imgFiles.length; i++) {
                const thumbData: any = thumbs[i];
                // ITALIANO: tags = trigger attive + .txt; originalTags = solo cio' che e' davvero nel .txt
                //           (vedi tagDiImport), cosi' "Salva modifiche" scrive la trigger dove manca.
                // ENGLISH: tags = active triggers + .txt; originalTags = only what is really in the .txt
                //          (see tagDiImport), so "Save changes" writes the trigger where it is missing.
                const { tags: orderedTags, originalTags } = tagDiImport(triggerAttive, textMap.get(folderKeyOf(imgFiles[i])) || [], txtNonLetti.has(folderKeyOf(imgFiles[i])));
                // ITALIANO: Se il backup anti-crash ha tag diversi dai sidecar, ripristina le modifiche non salvate
                // ENGLISH: If the crash backup differs from the sidecar tags, restore the unsaved edits
                let finalTags = orderedTags;
                const chiaveBackup = backupKeyOf(imgFiles[i]);
                let entry: { tags?: unknown; caption?: unknown } | undefined = undefined;
                if (backupMap) {
                    const chiaveFoglia = chiaveFogliaOf(imgFiles[i]);
                    if (Object.prototype.hasOwnProperty.call(backupMap, chiaveBackup)) {
                        entry = backupMap[chiaveBackup];
                    } else if (chiaveFoglia !== chiaveBackup && conteggioFoglia.get(chiaveFoglia) === 1 && Object.prototype.hasOwnProperty.call(backupMap, chiaveFoglia)) {
                        // ITALIANO: backup della versione precedente (chiave col solo nome della
                        //           sottocartella): accettato perche' qui e' univoco.
                        // ENGLISH: backup from the previous version (key with the subfolder's leaf
                        //          name only): accepted because it is unique here.
                        entry = backupMap[chiaveFoglia];
                    } else if (nomiUnici.has(imgFiles[i].name) && Object.prototype.hasOwnProperty.call(backupMap, imgFiles[i].name)) {
                        // ITALIANO: backup salvato da una versione precedente (solo nome file): lo accetto
                        //           SOLO se in questo import quel nome e' unico, quindi non e' ambiguo.
                        // ENGLISH: backup written by an older version (file name only): accepted ONLY when
                        //          that name is unique in this import, so it cannot be ambiguous.
                        entry = backupMap[imgFiles[i].name];
                    }
                }
                const ripristinati = tagDaRipristinare(entry, orderedTags, originalTags, triggerAttive, txtMtime.get(folderKeyOf(imgFiles[i])), backup ? backup.ts : null);
                if (ripristinati) {
                    finalTags = ripristinati;
                    restoredCount++;
                }
                const discoImport = [...originalTags];
                newImages.push({
                    id: nuovoIdFoto(),
                    file: imgFiles[i],
                    thumb: thumbData?.url || '',
                    width: thumbData?.width || 0,
                    height: thumbData?.height || 0,
                    tags: finalTags,
                    originalTags: discoImport,
                    // ITALIANO: il .txt c'e' ma non si e' potuto leggere: i tag di adesso, cosi' le
                    //           trigger cambiate dopo non lo fanno scrivere (vedi fotoDaSalvare). E'
                    //           LO STESSO array di originalTags: ogni scrittura del .txt ne mette uno
                    //           nuovo, e da li' la regola torna quella di sempre (txtNonLettoInVigore).
                    // ENGLISH: the .txt exists but could not be read: the current tags, so triggers
                    //          changed later do not get it written (see fotoDaSalvare). It is THE SAME
                    //          array as originalTags: every write of the .txt puts a new one there,
                    //          and from then on the usual rule applies (txtNonLettoInVigore).
                    ...(txtNonLetti.has(folderKeyOf(imgFiles[i])) ? { baseTxtNonLetto: discoImport } : {}),
                    // ITALIANO: chiave con cui questa foto viene salvata nel backup anti-crash, e il
                    //           lotto di import con la sua cartella (un'impronta per cartella).
                    // ENGLISH: the key under which this photo is stored in the crash backup, and the
                    //          import batch with its folder (one fingerprint per folder).
                    backupKey: chiaveBackup,
                    lottoImport,
                    cartellaImport: importFolder,
                    // ITALIANO: percorso VERO del file sul disco, quello che serve a Windows per
                    //           mandarlo nel Cestino. Vuoto quando non si conosce: cartella di rete
                    //           (dove il Cestino di Windows non esiste), oppure fuori da Electron.
                    //           In quel caso il programma chiede conferma e cancella per sempre,
                    //           come faceva prima.
                    // ENGLISH: the file's REAL path on disk, the one Windows needs to move it to the
                    //          Recycle Bin. Empty when unknown: a network folder (where Windows has
                    //          no Recycle Bin at all), or outside Electron. In that case the app asks
                    //          for confirmation and deletes for good, as it did before.
                    filePath: (pathOf && pathOf.get(imgFiles[i])) || '',
                    // ITALIANO: OGNI immagine si porta dietro la cartella da cui proviene. Prima
                    //           esisteva una sola cartella globale: aprendo una seconda cartella
                    //           senza chiudere la prima, i tag della prima venivano scritti dentro
                    //           la seconda (e svuotando il cestino si cancellavano i file sbagliati).
                    // ENGLISH: EVERY image carries the folder it came from. There used to be a single
                    //          global folder: opening a second folder without closing the first wrote
                    //          the first folder's tags into the second one (and emptying the trash
                    //          deleted the wrong files).
                    dirHandle: asDirHandle(folderOf && folderOf.get(imgFiles[i])) || handle || null,
                    // ITALIANO: la sottocartella della foto rispetto alla cartella scelta con "Carica
                    //           cartella" (es. "10_face"; "" alla radice o senza cartella). Solo in
                    //           memoria: serve all'esportazione per rimettere le cartelle Kohya.
                    // ENGLISH: the photo's subfolder relative to the folder picked with "Load folder"
                    //          (e.g. "10_face"; "" at the root or with no folder). In memory only: the
                    //          export uses it to put the Kohya folders back.
                    cartellaRel: (cartellaRelOf && cartellaRelOf.get(imgFiles[i])) || '',
                });
            }

            // ITALIANO: le anteprime si annotano qui, nel momento in cui entrano nel progetto: un
            //           Reset premuto durante l'import non deve liberare quelle che stanno arrivando.
            // ENGLISH: thumbnails are recorded here, the moment they enter the project: a Reset pressed
            //          during the import must not release the ones on their way in.
            newImages.forEach(img => { if (img.thumb) anteprimeProgettoRef.current.add(img.thumb); });
            setImages(prev => {
                const combined = [...prev, ...newImages];
                return combined.sort((a, b) => a.file.name.localeCompare(b.file.name));
            });
            soundManager.chime();
            // ITALIANO: un .txt accorciato perche' fuori misura va detto: al primo salvataggio la parte
            //           tagliata sparirebbe dal disco. L'avviso prende il posto del messaggio di import
            //           (a schermo ne resta uno solo): le foto caricate si vedono comunque. Le foto
            //           recuperate dal backup e i .txt saltati si dicono con frasi intere (avvisoImport).
            // ENGLISH: a .txt shortened for being over the caps must be reported: the first save would
            //          drop the cut part from disk. The warning takes the import message's place (only
            //          one stays on screen): the loaded photos show anyway. Photos recovered from the
            //          backup and skipped .txt files are told in whole sentences (avvisoImport).
            const avviso = avvisoImport(t, { caricate: newImages.length, ripristinate: restoredCount, saltati: skippedTxtCount, accorciati: shortenedTxtCount, nomiSaltati });
            showNotification(avviso.testo, avviso.tipo);
        } catch (error: any) {
            console.error('[Import] Failed', error);
            showNotification(`${t.aiError || 'Error'}: ${String(error?.message || error || '').slice(0, 150)}`, 'error');
        } finally {
            // ITALIANO: Comunque vada, l'UI di import non deve restare bloccata
            //           (si spegne con l'ULTIMO import in corso, vedi importAttiviRef).
            // ENGLISH: No matter what, the import UI must never stay stuck
            //          (it goes off with the LAST running import, see importAttiviRef).
            importAttiviRef.current = Math.max(0, importAttiviRef.current - 1);
            setIsImporting(importAttiviRef.current > 0);
            if (folderInputRef.current) folderInputRef.current.value = '';
        }
    };

    const calculateImportSummary = (imgFiles: any[], txtFiles: any[], handle: any = null, folderOf: Map<any, any> | null = null, relPathOf: Map<any, string> | null = null, pathOf: Map<any, string> | null = null, cartellaRelOf: Map<any, string> | null = null) => {
        // ITALIANO: stesso abbinamento cartella+nome del vero import, cosi' il conteggio
        //           "con testo / senza testo" e' esatto anche con nomi ripetuti tra sottocartelle.
        // ENGLISH: same folder+name pairing as the real import, so the "with text / without text"
        //          count is accurate even with names repeated across subfolders.
        const keyOf = makeFolderKeyer(folderOf);
        const txtKeys = new Set(txtFiles.map(keyOf));
        let withText = 0;
        let withoutText = 0;

        imgFiles.forEach(f => {
            if (txtKeys.has(keyOf(f))) {
                withText++;
            } else {
                withoutText++;
            }
        });

        setImportSummary({
            isOpen: true,
            summary: {
                imagesCount: imgFiles.length,
                textFilesCount: txtFiles.length,
                imagesWithText: withText,
                imagesWithoutText: withoutText
            },
            pendingData: { imgFiles, txtFiles, handle, folderOf, relPathOf, pathOf, cartellaRelOf }
        });
    };

    const handleLoadFolderClick = async () => {
        if ('showDirectoryPicker' in window) {
            // ITALIANO: avviso il processo principale che sta per essere scelta una cartella: da
            //           questo momento e' l'unico a poter registrare il percorso che Electron gli
            //           passa. La pagina non lo conosce e non lo manda mai.
            // ENGLISH: tell the main process a folder pick is starting: from now on it is the only
            //          one allowed to record the path Electron hands it. The page never knows the
            //          path and never sends one.
            const api = (window as any).electronAPI;
            try { await api?.beginFolderPick?.(); } catch (_) { /* fuori da Electron non esiste */ }
            // ITALIANO: diventa vero appena il selettore ha dato la cartella: da li' in poi un errore
            //           e' della LETTURA, non del selettore, e il ripiego (il campo nascosto, cioe' un
            //           secondo selettore) non c'entra: si dice all'utente che la cartella non si legge.
            // ENGLISH: becomes true as soon as the picker has returned the folder: from then on an
            //          error belongs to the READ, not to the picker, and the fallback (the hidden input,
            //          i.e. a second picker) does not apply: the user is told the folder cannot be read.
            let cartellaScelta = false;
            try {
                // ITALIANO: l'id fa ricordare al sistema l'ULTIMA cartella usata: la volta dopo
                //           il selettore si riapre lì. startIn come riserva al primo utilizzo.
                // ENGLISH: the id makes the system remember the LAST used folder: next time the
                //          picker reopens there. startIn as a fallback on first use.
                const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite', id: 'itm-project', startIn: 'pictures' });
                cartellaScelta = true;

                // ITALIANO: immagini e .txt con la sottocartella di ciascuno; le voci illeggibili si
                //           saltano e si contano (vedi scanDirectoryHandle).
                // ENGLISH: images and .txt files with the subfolder of each; unreadable entries are
                //          skipped and counted (see scanDirectoryHandle).
                const { imgFiles, txtFiles, folderOf, relPathOf, skipped } = await scanDirectoryHandle(handle);

                if (imgFiles.length === 0) {
                    // ITALIANO: se nessuna immagine e' arrivata e qualcosa non si e' letto, si dice anche
                    //           quello: le immagini potevano stare proprio nelle voci saltate.
                    // ENGLISH: if no image arrived and something could not be read, that is said too:
                    //          the images may have been in the very entries that were skipped.
                    const saltate = skipped > 0 ? ' ' + t.folderEntriesSkipped.replace('{n}', String(skipped)) : '';
                    return showNotification(t.noImagesTitle + saltate, "info");
                }

                // ITALIANO: il percorso della cartella si ritira DOPO la scansione, non prima:
                //           riaprendo una cartella gia' usata Electron non chiede piu' il permesso
                //           (ce l'ha in memoria) e il percorso arriva solo con i "controlli", che
                //           scattano mentre si leggono i file. Misurato il 17 agosto 2026.
                //           Da qui compongo il percorso di ogni foto: cartella scelta + la parte di
                //           sottocartella che ho gia' costruito scendendo (relPathOf), meno il nome
                //           della radice, che nel percorso c'e' gia'.
                //           Se resta vuoto (cartella di rete, o fuori da Electron) non cambia niente:
                //           il programma si comporta esattamente come prima.
                // ENGLISH: the folder path is collected AFTER the scan, not before: re-opening a
                //          folder already used raises no permission request (the grant is cached) and
                //          the path only arrives with the "checks", which fire while the files are
                //          read. Measured 2026-08-17. From it I compose each photo's path: the picked
                //          folder plus the subfolder part already built while descending (relPathOf),
                //          minus the root's own name, which the path already carries.
                //          If it stays empty (network folder, or outside Electron) nothing changes:
                //          the app behaves exactly as before.
                //           NON basta chiedere "che percorso hai visto": in quella finestra arrivano
                //           anche cartelle che non c'entrano — al rientro del fuoco, quando il
                //           selettore si chiude, la pagina rilegge la foto selezionata di una cartella
                //           aperta prima, e anche quel percorso viene visto. Quindi mando le PROVE di
                //           cosa ho appena letto (nome, sottocartella, dimensione, data di modifica di
                //           qualche file) e il processo principale risponde solo se una cartella
                //           contiene DAVVERO quei file. Il nome della cartella non decide niente: qui
                //           si chiamano quasi tutte "dataset" o "img".
                // ENGLISH: asking "which path did you see" is NOT enough: unrelated folders land in
                //          that window too - on focus, as the picker closes, the page re-reads the
                //          selected photo of a previously opened folder, and that path is seen as
                //          well. So I send PROOF of what I just read (name, subfolder, size and
                //          modification time of a few files) and the main process answers only if a
                //          folder really holds those files. The folder's name decides nothing: around
                //          here they are nearly all called "dataset" or "img".
                const proveLettura = imgFiles.slice(0, 5).map(f => ({
                    rel: (relPathOf.get(f) || '').split('/').slice(1).join('/'),
                    name: f.name,
                    size: f.size,
                    mtime: f.lastModified,
                }));
                let rootPath = '';
                try { rootPath = (await api?.takePickedFolderPath?.(proveLettura)) || ''; } catch (_) { rootPath = ''; }
                const pathOf = new Map<any, string>();
                if (rootPath) {
                    const sep = rootPath.includes('\\') ? '\\' : '/';
                    for (const f of [...imgFiles, ...txtFiles]) {
                        const rel = relPathOf.get(f) || '';
                        const sub = rel.split('/').slice(1).join(sep);
                        pathOf.set(f, (sub ? rootPath + sep + sub : rootPath) + sep + f.name);
                    }
                }

                // ITALIANO: la sottocartella di ogni foto senza il nome della radice ("" alla radice):
                //           l'esportazione la rimette nell'archivio (vedi exportAllAsZip).
                // ENGLISH: each photo's subfolder without the root's name ("" at the root): the
                //          export puts it back in the archive (see exportAllAsZip).
                const cartellaRelOf = new Map<any, string>();
                for (const f of imgFiles) cartellaRelOf.set(f, (relPathOf.get(f) || '').split('/').slice(1).join('/'));
                calculateImportSummary(imgFiles, txtFiles, handle, folderOf, relPathOf, pathOf, cartellaRelOf);
                if (skipped > 0) showNotification(t.folderEntriesSkipped.replace('{n}', String(skipped)), 'info');

            } catch (err: any) {
                // ITALIANO: scelta annullata o fallita: chiudo comunque la finestra di registrazione
                //           del processo principale (elenco vuoto = non chiedo niente, azzera e basta),
                //           altrimenti resterebbe aperta a raccogliere cartelle per tutta la sessione.
                // ENGLISH: pick aborted or failed: close the main process's recording window anyway
                //          (empty list = ask for nothing, just reset), otherwise it would stay open
                //          collecting folders for the rest of the session.
                try { await api?.takePickedFolderPath?.([]); } catch (_) { /* ignore */ }
                if (cartellaScelta) {
                    console.error('[Import] Cartella scelta non leggibile / picked folder unreadable:', err);
                    showNotification(t.folderReadError, 'error');
                } else if (err.name !== 'AbortError') {
                    console.warn("Accesso diretto alla cartella bloccato (SecurityError nell'iframe). Uso il fallback standard.", err);
                    if (folderInputRef.current) folderInputRef.current.click();
                }
            }
        } else {
            if (folderInputRef.current) folderInputRef.current.click();
        }
    };

    const handleFolderUploadFallback = async (e: any) => {
        // ITALIANO: senza i file nascosti del Mac (__MACOSX, "._nome"), come "Carica cartella".
        // ENGLISH: without the Mac hidden files (__MACOSX, "._name"), as in "Load folder".
        const files = Array.from(e.target.files as FileList).filter((f: any) => !fileDiMac(f.name, f.webkitRelativePath));
        const imgFiles = files.filter(f => f.type.startsWith('image/'));
        const txtFiles = files.filter(f => f.name.toLowerCase().endsWith('.txt'));
        // ITALIANO: una cartella senza immagini va detta, come nelle altre strade, e il campo va
        //           liberato: altrimenti riscegliendo la stessa cartella il browser non avvisa piu'.
        // ENGLISH: a folder with no images must be reported, as on the other roads, and the input
        //          freed: otherwise picking the same folder again no longer fires at all.
        if (imgFiles.length === 0) {
            showNotification(t.noImagesTitle, 'info');
            if (folderInputRef.current) folderInputRef.current.value = '';
            return;
        }

        // ITALIANO: Anche nel fallback (input webkitdirectory) ricostruisco la sottocartella di
        //           ogni file dal suo percorso relativo, cosi' due foto con lo stesso nome in
        //           cartelle diverse non si scambiano i tag. Qui la cartella e' una STRINGA:
        //           serve solo per l'abbinamento, non come destinazione di salvataggio.
        // ENGLISH: In the fallback (webkitdirectory input) too, I rebuild each file's subfolder
        //          from its relative path, so two same-named photos in different folders do not
        //          swap tags. Here the folder is a STRING: used only for pairing, never as a
        //          save target.
        const dirOfRelPath = (f: any): string => {
            const rel: string = f.webkitRelativePath || '';
            const cut = Math.max(rel.lastIndexOf('/'), rel.lastIndexOf('\\'));
            return cut > 0 ? rel.slice(0, cut) : '';
        };
        const folderOf = new Map<any, any>();
        [...imgFiles, ...txtFiles].forEach(f => folderOf.set(f, dirOfRelPath(f)));
        // ITALIANO: come in "Carica cartella": la sottocartella senza il nome della radice.
        // ENGLISH: as in "Load folder": the subfolder without the root's name.
        const cartellaRelOf = new Map<any, string>();
        imgFiles.forEach(f => cartellaRelOf.set(f, dirOfRelPath(f).split(/[\\/]/).slice(1).join('/')));

        calculateImportSummary(imgFiles, txtFiles, null, folderOf, null, null, cartellaRelOf);
    };

    // ITALIANO: Carica SINGOLE immagini (una o piu'), non l'intera cartella. Nel selettore si
    //           scelgono SOLO immagini: i file di testo non compaiono. Se accanto a una foto
    //           c'e' un .txt con lo stesso nome, viene importato e abbinato in automatico;
    //           se non c'e' (es. prima volta) l'immagine si carica senza tag. Senza una
    //           cartella collegata, il salvataggio avviene come download del .txt.
    // ENGLISH: Load INDIVIDUAL images (one or more), not the whole folder. The picker shows
    //          ONLY images: text files do not appear. If a .txt with the same name sits next
    //          to a photo it is imported and paired automatically; if there is none (e.g.
    //          first time) the image loads without tags. With no folder attached, saving
    //          happens as a .txt download.
    const imagesInputRef = useRef<HTMLInputElement>(null);
    // ITALIANO: Cerca, per ogni immagine scelta, il file di testo con lo STESSO nome che sta
    //           accanto ad essa sul disco (foto.jpg -> foto.txt) e lo trasforma in un file
    //           leggibile dall'import. Se non c'e' (o siamo nel browser, senza Electron)
    //           torna una lista vuota: le immagini si caricano semplicemente senza tag.
    // ENGLISH: For each picked image, look for the same-named text file sitting next to it on
    //          disk (photo.jpg -> photo.txt) and turn it into a file the import can read. If
    //          missing (or we are in the browser, without Electron) it returns an empty list:
    //          the images simply load without tags.
    const loadSidecarTxtFiles = async (imgFiles: any[]): Promise<{ txtFiles: any[]; folderOf: Map<any, any> | null }> => {
        const vuoto = { txtFiles: [], folderOf: null };
        const api = (window as any).electronAPI;
        if (!api || typeof api.getPathForFile !== 'function' || typeof api.readSidecarTags !== 'function') return vuoto;
        try {
            // ITALIANO: la cartella di ogni file (immagine o .txt) e' una STRINGA, ricavata dal
            //           percorso reale. Serve SOLO per abbinare testo e immagine giusti: due foto
            //           con lo stesso nome in cartelle diverse restano separate. Non e' un handle,
            //           quindi non diventa mai destinazione di salvataggio (asDirHandle la scarta).
            //           Foto e .txt passano per la stessa regola (cartellaImmagine / cartellaTesto):
            //           alla radice di un'unita' le due forme erano diverse ("E:" contro "E:\").
            // ENGLISH: each file's folder (image or .txt) is a STRING, taken from the real path.
            //          Used ONLY to pair the right text with the right image: two same-named photos
            //          in different folders stay separate. It is not a handle, so it never becomes a
            //          save target (asDirHandle rejects it).
            //          Photo and .txt go through the same rule (cartellaImmagine / cartellaTesto): at
            //          a drive root the two forms used to differ ("E:" against "E:\").
            const folderOf = new Map<any, any>();
            const paths: string[] = [];
            for (const f of imgFiles) {
                const p = api.getPathForFile(f);
                if (p) { paths.push(p); folderOf.set(f, cartellaImmagine(p)); }
            }
            if (paths.length === 0) return vuoto;
            const sidecars = await api.readSidecarTags(paths);
            const txtFiles = (sidecars || []).map((s: any) => {
                // ITALIANO: un .txt che il processo principale non ha letto diventa un file illeggibile:
                //           l'import lo conta fra i saltati (vedi fileDaSidecar).
                // ENGLISH: a .txt the main process did not read becomes an unreadable file: the import
                //          counts it among the skipped ones (see fileDaSidecar).
                const file = fileDaSidecar(s);
                folderOf.set(file, typeof s.dir === 'string' ? cartellaTesto(s.dir) : '');
                return file;
            });
            return { txtFiles, folderOf };
        } catch (err) {
            console.warn('[Import] Tag .txt abbinati non leggibili, carico solo le immagini:', err);
            return vuoto;
        }
    };

    const handleImagesUpload = async (e: any) => {
        // ITALIANO: senza i file nascosti del Mac ("._nome"), come "Carica cartella".
        // ENGLISH: without the Mac hidden files ("._name"), as in "Load folder".
        const files = Array.from(e.target.files as FileList).filter((f: any) => !fileDiMac(f.name));
        const imgFiles = files.filter(f => f.type.startsWith('image/'));
        if (imgFiles.length === 0) { showNotification(t.noImagesTitle, 'info'); return; }
        // ITALIANO: i .txt non si scelgono a mano: li trovo io accanto alle immagini
        // ENGLISH: .txt files are not picked by hand: I find them next to the images
        const { txtFiles, folderOf } = await loadSidecarTxtFiles(imgFiles);
        calculateImportSummary(imgFiles, txtFiles, null, folderOf);
        if (imagesInputRef.current) imagesInputRef.current.value = '';
    };

    // ITALIANO: TRASCINAMENTO (drag & drop) di immagini nell'app. Il .txt gemello viene riconosciuto
    //           da solo: sia se trascinato ASSIEME all'immagine, sia se semplicemente PRESENTE nella
    //           stessa cartella su disco — perche' loadSidecarTxtFiles legge il file con lo stesso
    //           nome accanto a ciascuna immagine (via percorso Electron). Nel browser (senza Electron,
    //           niente accesso al disco) uso i .txt effettivamente trascinati, abbinati per nome.
    // ENGLISH: DRAG & DROP of images into the app. The sidecar .txt is recognized automatically:
    //          whether dragged TOGETHER with the image or simply PRESENT in the same folder on disk —
    //          because loadSidecarTxtFiles reads the same-named file next to each image (via the
    //          Electron path). In the browser (no Electron, no disk access) I use the .txt files
    //          actually dropped, paired by name.
    const handleDroppedFiles = useCallback(async (fileList: FileList) => {
        // ITALIANO: con l'editor dei file di tag (z 320) o la finestra della API key (z 400) aperti il
        //           riepilogo dell'importazione (z 300) si apriva SOTTO: il rilascio sembrava ignorato
        //           e un secondo rilascio sostituiva in silenzio quello in attesa. Si dice di chiudere
        //           prima la finestra (il messaggio sta sopra tutto).
        // ENGLISH: with the Tag file editor (z 320) or the API key dialog (z 400) open the import
        //          summary (z 300) opened UNDER it: the drop looked ignored and a second drop silently
        //          replaced the pending one. The user is told to close that window first (the message
        //          sits above everything).
        if (isTagEditorOpen || isApiKeyDialogOpen) { showNotification(t.dropCloseWindowFirst, 'info'); return; }
        // ITALIANO: senza i file nascosti del Mac ("._nome"), come "Carica cartella".
        // ENGLISH: without the Mac hidden files ("._name"), as in "Load folder".
        const files = Array.from(fileList || []).filter((f: any) => !fileDiMac(f.name));
        const imgFiles = files.filter(f => f.type.startsWith('image/'));
        if (imgFiles.length === 0) { showNotification(t.dropOnlyImages, 'info'); return; }
        const droppedTxt = files.filter(f => f.name.toLowerCase().endsWith('.txt'));
        const { txtFiles: diskTxt, folderOf } = await loadSidecarTxtFiles(imgFiles);
        if (diskTxt.length > 0) {
            calculateImportSummary(imgFiles, diskTxt, null, folderOf);
        } else {
            // ITALIANO: niente sidecar dal disco (browser o nessun .txt accanto): uso quelli trascinati.
            //           I .txt trascinati si abbinano per nome (folderOf resta null), ma la chiave del
            //           backup anti-crash porta comunque il percorso vero della foto quando Electron lo
            //           conosce: col solo nome due serie senza tag con gli stessi nomi si scambiavano le
            //           modifiche, e ritrascinando le stesse foto dopo un salvataggio le chiavi non
            //           combaciavano piu'. E' la stessa chiave del ramo qui sopra.
            // ENGLISH: no disk sidecars (browser or no adjacent .txt): use the dropped ones.
            //          The dropped .txt files pair by name (folderOf stays null), but the crash-backup
            //          key still carries the photo's real path when Electron knows it: with the bare
            //          name two untagged sets with the same names swapped their edits, and dropping the
            //          same photos again after a save no longer matched the keys. It is the same key as
            //          in the branch above.
            const chiavePercorso = new Map<any, string>();
            if (folderOf) for (const f of imgFiles) { const d = folderOf.get(f); if (typeof d === 'string' && d) chiavePercorso.set(f, d); }
            calculateImportSummary(imgFiles, droppedTxt, null, null, chiavePercorso.size > 0 ? chiavePercorso : null);
        }
    }, [t, isTagEditorOpen, isApiKeyDialogOpen]);
    // ITALIANO: riferimento SEMPRE aggiornato al gestore, cosi' i listener globali (sotto) restano
    //           registrati una volta sola ma chiamano sempre la versione corrente.
    // ENGLISH: an always-current ref to the handler, so the global listeners (below) subscribe once
    //          but always call the latest version.
    const dropHandlerRef = useRef(handleDroppedFiles);
    dropHandlerRef.current = handleDroppedFiles;

    // ITALIANO: gestione GLOBALE del trascinamento file. I due preventDefault sono FONDAMENTALI:
    //           senza di essi il rilascio di un file farebbe "navigare" la finestra al file (in
    //           passato questo rompeva l'app). Il contatore dragDepth evita che passare sopra un
    //           elemento figlio spenga l'area di rilascio. Rilasciando, importo i file trascinati.
    // ENGLISH: GLOBAL drag & drop handling. The two preventDefault calls are ESSENTIAL: without them
    //          dropping a file would make the window "navigate" to it (this used to break the app).
    //          The dragDepth counter prevents moving over a child element from turning the overlay
    //          off. On drop, I import the dropped files.
    useEffect(() => {
        let dragDepth = 0;
        const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
        const onDragEnter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; setIsDragging(true); };
        const onDragOver = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); };
        const onDragLeave = (e: DragEvent) => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (dragDepth === 0) setIsDragging(false); };
        const onDrop = (e: DragEvent) => {
            e.preventDefault();
            dragDepth = 0;
            setIsDragging(false);
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) dropHandlerRef.current(dt.files);
        };
        window.addEventListener('dragenter', onDragEnter);
        window.addEventListener('dragover', onDragOver);
        window.addEventListener('dragleave', onDragLeave);
        window.addEventListener('drop', onDrop);
        return () => {
            window.removeEventListener('dragenter', onDragEnter);
            window.removeEventListener('dragover', onDragOver);
            window.removeEventListener('dragleave', onDragLeave);
            window.removeEventListener('drop', onDrop);
        };
    }, []);

    // ITALIANO: se l'immagine APERTA nel visualizzatore viene modificata ESTERNAMENTE su disco (es.
    //           ritoccata in un altro programma), quando si torna sull'app (focus finestra) la
    //           ri-leggo dal disco e, se e' cambiata (data di modifica piu' recente), aggiorno
    //           anteprima e immagine piena. Funziona per le foto aperte da CARTELLA (che portano il
    //           loro handle scrivibile); il Lightbox rigenera l'immagine perche' dipende da file.
    // ENGLISH: if the image OPEN in the viewer is changed EXTERNALLY on disk (e.g. retouched in
    //          another app), when the user returns to the app (window focus) I re-read it from disk
    //          and, if it changed (newer modified time), refresh the thumbnail and the full image.
    //          Works for photos opened from a FOLDER (which carry their writable handle); the Lightbox
    //          regenerates the image because it depends on file.
    // ITALIANO: "sto gia' ricontrollando": tornando sull'app due volte di fila (alt-tab veloce) il
    //           secondo controllo partiva mentre il primo stava ancora leggendo il file, entrambi
    //           vedevano la foto vecchia e la ricaricavano — avviso doppio e anteprima generata due
    //           volte per niente. Con questa guardia il secondo controllo aspetta il suo turno.
    // ENGLISH: "already re-checking": returning to the app twice in a row (fast alt-tab) started the
    //          second check while the first was still reading the file, both saw the old photo and
    //          reloaded it — duplicate notification and a thumbnail generated twice for nothing.
    //          With this guard the second check simply skips.
    const reloadingRef = useRef(false);

    useEffect(() => {
        const ricontrolla = async () => {
            const id = selectedImageId;
            if (!id) return;
            if (reloadingRef.current) return;
            const img = imagesRef.current.find(i => i.id === id);
            if (!img || !img.dirHandle || typeof img.dirHandle.getFileHandle !== 'function') return;
            reloadingRef.current = true;
            try {
                const fh = await img.dirHandle.getFileHandle(img.file.name);
                const fresh = await fh.getFile();
                if (fresh.lastModified > (img.file.lastModified || 0)) {
                    let thumbData: any = null;
                    try { thumbData = await generateThumbnail(fresh); } catch (_) { /* tengo la vecchia anteprima */ }
                    // ITALIANO: NON revoco la vecchia anteprima (potrebbe essere nella cronologia annulla).
                    //           Si liberano tutte e due alla chiusura del progetto (anteprimeProgettoRef).
                    // ENGLISH: do NOT revoke the old thumbnail (it may live in the undo history).
                    //          Both are released when the project closes (anteprimeProgettoRef).
                    if (thumbData?.url) anteprimeProgettoRef.current.add(thumbData.url);
                    // ITALIANO: questo ricarico NON e' un'azione dell'utente: non deve entrare nella
                    //           cronologia. Prima ci finiva, e allora "Annulla" riportava la foto al
                    //           file VECCHIO invece di annullare l'ultima modifica ai tag; peggio, un
                    //           ricarico avvenuto in sottofondo cancellava i "Ripeti" in sospeso.
                    // ENGLISH: this reload is NOT a user action: it must not enter the history. It used
                    //          to, so "Undo" restored the OLD file instead of undoing the last tag edit;
                    //          worse, a background reload discarded any pending "Redo" steps.
                    // ITALIANO: un oggetto nuovo per ogni oggetto vecchio, uno solo: i passi della
                    //           cronologia (e la galleria) che avevano la stessa foto continuano ad
                    //           averla. Prima ogni passo ne riceveva una copia sua, e dopo l'uscita di
                    //           un'altra foto dal disco Ctrl+Z si fermava su passi rimasti identici.
                    // ENGLISH: one new object per old object, only one: the history steps (and the
                    //          gallery) that held the same photo keep sharing it. Every step used to
                    //          get a copy of its own, and once another photo left the disk Ctrl+Z
                    //          stopped on steps that had become identical.
                    const rifatte = new Map<any, any>();
                    const rifai = (i: any) => {
                        if (i.id !== id) return i;
                        if (!rifatte.has(i)) rifatte.set(i, { ...i, file: fresh, thumb: thumbData?.url || i.thumb, width: thumbData?.width || i.width, height: thumbData?.height || i.height });
                        return rifatte.get(i);
                    };
                    isUndoRedoAction.current = true;
                    setImages(prev => prev.map(rifai));
                    // ITALIANO: il ricarico non e' un'azione annullabile, ma cambia comunque il file
                    //           sottostante. Non bastava saltarne la registrazione: le istantanee gia'
                    //           in cronologia continuavano a contenere il file e l'anteprima VECCHI,
                    //           quindi il primo Annulla dopo un ritocco esterno rimetteva a schermo la
                    //           foto pre-ritocco. Aggiorno l'immagine anche li' dentro, lasciando
                    //           intatti i tag di ogni passo (quelli si' devono restare annullabili).
                    // ENGLISH: the reload is not an undoable action, yet it does change the underlying
                    //          file. Skipping its recording was not enough: the snapshots already in
                    //          history still held the OLD file and thumbnail, so the first Undo after
                    //          an external retouch brought the pre-retouch photo back on screen. I
                    //          refresh the image inside those snapshots too, leaving each step's tags
                    //          untouched (those must stay undoable).
                    setHistory(prev => prev.map(snap => snap.map(rifai)));
                    showNotification(t.imageReloaded, 'info');
                }
            } catch (_) { /* file spostato/illeggibile: ignoro */ }
            finally { reloadingRef.current = false; }
        };
        window.addEventListener('focus', ricontrolla);
        return () => window.removeEventListener('focus', ricontrolla);
    }, [selectedImageId, t]);

    // ITALIANO: ESPORTA / IMPORTA i tag del progetto (punto 16). Il JSON serve a
    //           reimportare tutto in modo pulito in un nuovo progetto; il TXT e' una
    //           lista leggibile. L'import accetta entrambi e AGGIUNGE i tag alla palette
    //           del progetto (senza doppioni).
    // ENGLISH: EXPORT / IMPORT project tags (item 16). JSON re-imports cleanly into a
    //          new project; TXT is a readable list. Import accepts both and ADDS the tags
    //          to the project palette (no duplicates).
    const projectTagsImportRef = useRef<HTMLInputElement>(null);

    const downloadTextFile = (content: string, mime: string, fileName: string) => {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        try {
            const a = document.createElement('a');
            a.href = url; a.download = fileName;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        } finally { URL.revokeObjectURL(url); }
    };

    // ITALIANO: UN SOLO tasto Esporta. Il FORMATO (JSON o TXT) si sceglie nel menu a
    //           tendina "Salva come" della finestra di salvataggio del sistema: scrivo il
    //           contenuto in base all'estensione scelta. Se il browser non ha il selettore
    //           di salvataggio, ripiego sul download in JSON.
    // ENGLISH: A SINGLE Export button. The FORMAT (JSON or TXT) is chosen in the OS save
    //          dialog's "Save as type" dropdown: I write the content based on the chosen
    //          extension. If the browser lacks the save picker, fall back to a JSON download.
    const handleExportProjectTags = async () => {
        // ITALIANO: trigger prima, poi il resto in ordine alfabetico (coerente col resto dell'app)
        // ENGLISH: triggers first, then the rest alphabetical (consistent with the rest of the app)
        const orderedTags = [
            ...globalTriggers.filter(tag => allUniqueTags.includes(tag)),
            ...allUniqueTags.filter(tag => !globalTriggers.includes(tag))
        ];
        if (orderedTags.length === 0) { showNotification(t.noTagsInProject, 'info'); return; }
        const jsonContent = () => JSON.stringify({ app: 'Images Tag Manager for LORAs', type: 'project-tags', version: 1, globalTriggers: [...globalTriggers], tags: orderedTags }, null, 2);
        const txtContent = () => orderedTags.join('\n') + '\n';

        if ('showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    id: 'itm-tags-export',
                    suggestedName: 'project-tags.json',
                    types: [
                        { description: t.exportFmtJson, accept: { 'application/json': ['.json'] } },
                        { description: t.exportFmtTxt, accept: { 'text/plain': ['.txt'] } },
                    ],
                });
                const isTxt = String(handle.name || '').toLowerCase().endsWith('.txt');
                const writable = await handle.createWritable();
                await writable.write(isTxt ? txtContent() : jsonContent());
                await writable.close();
                soundManager.chime();
                showNotification(t.projectTagsExported, 'success');
            } catch (err: any) {
                // ITALIANO: qui si SCRIVE: "impossibile salvare il file", non la frase dell'import
                //           ("impossibile leggere il file dei tag"), che mandava a cercare il guasto
                //           dalla parte sbagliata.
                // ENGLISH: this WRITES: "could not save the file", not the import's sentence ("could
                //          not read the tags file"), which sent the user looking on the wrong side.
                if (err && err.name !== 'AbortError') { console.error(err); showNotification(t.tagEditorSaveError, 'error'); }
            }
            return;
        }
        // ITALIANO: riserva per browser senza selettore di salvataggio: scarica in JSON.
        // ENGLISH: fallback for browsers without the save picker: download as JSON.
        downloadTextFile(jsonContent(), 'application/json', 'project-tags.json');
        soundManager.chime();
        showNotification(t.projectTagsExported, 'success');
    };

    const handleImportProjectTags = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            // ITALIANO: stessi limiti di prudenza dei sidecar: un file legittimo di tag pesa pochi KB.
            //           Oltre 1 MB e' sospetto (JSON gigante/ostile) e potrebbe bloccare l'app: lo
            //           rifiuto. Poi limito lunghezza e numero dei tag (vedi pulisciTagProgetto).
            // ENGLISH: same safety caps as the sidecars: a legit tag file weighs a few KB. Over 1 MB is
            //          suspicious (huge/hostile JSON) and could freeze the app: reject it. Then clamp
            //          each tag's length and the total count (see pulisciTagProgetto).
            if (file.size > 1024 * 1024) { showNotification(t.importTagsError, 'error'); return; }
            const text = (await file.text()).trim();
            let tags: string[] = [];
            let triggers: string[] = [];
            if (text.startsWith('{')) {
                const data = JSON.parse(text);
                if (Array.isArray(data.tags)) tags = data.tags;
                if (Array.isArray(data.globalTriggers)) triggers = data.globalTriggers;
            } else {
                // ITALIANO: TXT: un tag per riga (accetto anche le virgole come separatore).
                // ENGLISH: TXT: one tag per line (commas are also accepted as separators).
                tags = text.split(/[\r\n,]+/);
            }
            // ITALIANO: i trigger del file entrano comunque nella palette del progetto. Ogni tag e'
            //           ripulito dai caratteri di controllo e tagliato al limite dei .txt (4000
            //           caratteri: prima 100, e una didascalia in frase tornava monca); in tutto se ne
            //           tengono al massimo 5000. Se qualcosa si accorcia o resta fuori, lo si dice.
            // ENGLISH: the file's triggers also go into the project palette. Each tag is stripped of
            //          control chars and clamped to the .txt cap (4000 chars: it used to be 100, and a
            //          sentence caption came back cut); at most 5000 are kept in total. If anything is
            //          shortened or left out, it is said.
            const { tags: clean, truncated } = pulisciTagProgetto([...tags, ...triggers]);
            if (clean.length === 0) { showNotification(t.importTagsError, 'error'); return; }
            setCustomProjectTags(prev => [...new Set([...prev, ...clean])]);
            soundManager.chime();
            if (truncated) showNotification(t.projectTagsImportShortened.replace('{n}', String(clean.length)), 'info');
            else showNotification(`${t.projectTagsImported} (${clean.length})`, 'success');
        } catch (err) {
            showNotification(t.importTagsError, 'error');
        } finally {
            if (projectTagsImportRef.current) projectTagsImportRef.current.value = '';
        }
    };

    const handleResetProject = () => {
        setConfirmDialog({ isOpen: true, title: t.confirmResetTitle, message: t.confirmResetMsg, onConfirm: () => {
            // ITALIANO: un progetto nuovo: i lavori del cestino ancora in corso non lo toccano (vedi progettoGenRef).
            // ENGLISH: a new project: trash jobs still running do not touch it (see progettoGenRef).
            progettoGenRef.current++;
            // ITALIANO: Ferma un eventuale batch AI in corso e svuota il backup automatico dei tag
            // ENGLISH: Stop any running AI batch and clear the automatic tag backup
            aiCancelRequestedRef.current = true;
            setAiCancelRequested(true);
            aiAbortControllerRef.current?.abort();
            try { localStorage.removeItem('tagBackup'); } catch (_) { /* ignore */ }
            fotoChiuseRef.current.clear();
            releaseThumbnails(images);
            // ITALIANO: anche quelle delle foto chiuse con la X o cancellate per sempre.
            // ENGLISH: also those of the photos closed with the X or deleted for good.
            liberaAnteprimeProgetto();
            // ITALIANO: l'annullamento dello svuotamento appartiene a QUESTO progetto: se sopravvivesse,
            //           il tasto comparirebbe nel progetto successivo e ci infilerebbe le foto di
            //           quello chiuso. Le sue anteprime si liberano come tutte le altre.
            // ENGLISH: undoing the emptying belongs to THIS project: if it survived, the button would
            //          appear in the next project and push the closed project's photos into it.
            //          Its thumbnails are freed like all the others.
            if (ultimoSvuotamento) releaseThumbnails(ultimoSvuotamento.voci.map((v: any) => v.img));
            setUltimoSvuotamento(null);
            setImages([]); setGlobalTriggers([]); setSelectedForBulk([]); setStagedBulkTags([]); setCustomProjectTags([]); setDirHandle(null);
            setHistory([]); setHistoryIndex(-1); discoNotoRef.current.clear();
            soundManager.chime(); showNotification(t.successReset, "success");
            setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} });
        }, onCancel: () => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} }) });
    };

    // Helper function to order tags with global triggers first
    // ITALIANO: Ordine con cui i tag finiscono nel file .txt: prima le trigger word (nell'ordine
    //           scelto dall'utente, convenzione LoRA), poi TUTTI GLI ALTRI IN ORDINE ALFABETICO.
    //           L'ordinamento alfabetico mancava qui mentre il visualizzatore lo applicava: la
    //           stessa foto produceva due file diversi a seconda del tasto usato per salvarla.
    // ENGLISH: The order tags are written into the .txt: trigger words first (in the user's chosen
    //          order, LoRA convention), then EVERYTHING ELSE ALPHABETICALLY. The alphabetical sort
    //          was missing here while the lightbox applied it, so the same photo produced two
    //          different files depending on which save button was used.
    const getOrderedTagString = (tags: string[]) => {
        const orderedTags = [
            ...globalTriggers.filter(t => tags.includes(t)),
            ...tags.filter(t => !globalTriggers.includes(t)).sort((a, b) => a.localeCompare(b))
        ];
        return orderedTags.length > 0 ? orderedTags.join(', ') + ',' : '';
    };

    // ITALIANO: Funzione per salvare i file (sovrascrive o crea ZIP)
    // ENGLISH: Function to save files (overwrite or create ZIP)
    // ITALIANO: Torna TRUE se il salvataggio e' andato a buon fine, FALSE se e' fallito o
    //           e' stato annullato. Serve a "Salva e chiudi": se il salvataggio non riesce
    //           il progetto NON deve essere chiuso, altrimenti i tag andrebbero persi.
    // ENGLISH: Returns TRUE when the save succeeded, FALSE when it failed or was aborted.
    //          Needed by "Save and close": if saving fails the project must NOT be closed,
    //          otherwise the tags would be lost.
    // ITALIANO: `fraseNonScritte` = la frase sulle foto lasciate fuori da handleSaveChanges perche' il
    //           loro .txt non si e' potuto leggere (vedi txtNonLettoInVigore): va nello stesso avviso.
    // ENGLISH: `fraseNonScritte` = the sentence on the photos handleSaveChanges left out because their
    //          .txt could not be read (see txtNonLettoInVigore): it goes into the same notice.
    const performSave = async (imagesToSave: any[], fraseNonScritte = ''): Promise<boolean> => {
        // ITALIANO: Ogni immagine viene riscritta nella SUA cartella (img.dirHandle), non in una
        //           cartella globale: con due cartelle aperte insieme i tag finivano nel posto
        //           sbagliato. Le immagini senza cartella (caricate come file singoli) proseguono
        //           verso il salvataggio di emergenza (download).
        // ENGLISH: Each image is written back into ITS OWN folder (img.dirHandle), not a single
        //          global one: with two folders open at once the tags ended up in the wrong place.
        //          Images with no folder (loaded as individual files) fall through to the download
        //          fallback below.
        const withFolder = imagesToSave.filter(img => img.dirHandle);
        const withoutFolder = imagesToSave.filter(img => !img.dirHandle);
        const savedIds = new Set<string>();
        const failedNames: string[] = [];
        // ITALIANO: le foto offerte come download (anteprima del browser): non sono errori, ma
        //           nemmeno salvate. E quante hanno ora un .txt vuoto, che ferma Kohya.
        // ENGLISH: the photos offered as downloads (browser preview): not errors, but not saved
        //          either. And how many now have an empty .txt, which stops Kohya.
        let scaricate = 0;
        let svuotate = 0;
        // ITALIANO: il .txt che c'e' gia', o null se manca: serve a non CREARE un .txt vuoto.
        // ENGLISH: the .txt already there, or null if missing: used to never CREATE an empty .txt.
        const txtEsistente = async (dir: any, nome: string) => {
            try { return await dir.getFileHandle(nome); }
            catch (e: any) { if (e && e.name === 'NotFoundError') return null; throw e; }
        };
        const total = imagesToSave.length;
        let done = 0;
        const bump = (n = 1) => { done += n; if (total > 0) setImportProgress(Math.min(100, Math.round((done / total) * 100))); };
        // ITALIANO: due copie della stessa foto (la stessa cartella aperta due volte) con tag DIVERSI
        //           finirebbero nello stesso .txt: vinceva l'ultima scritta, e la card dell'altra
        //           mostrava come salvata una modifica che sul disco non c'era piu'. Non si sceglie
        //           in silenzio: nessuna delle due si scrive, restano da salvare e l'avviso dice di
        //           chiuderne una. Due copie con gli stessi tag si salvano come sempre. Lo stesso vale
        //           per due foto diverse con lo stesso nome (a.png e a.jpg): il .txt e' uno, a.txt.
        //           `chiave` dice dove finisce il .txt; `stessoPosto` confronta due chiavi uguali.
        // ENGLISH: two copies of the same photo (the same folder opened twice) with DIFFERENT tags
        //          would end in the same .txt: the last one written won, and the other one's card
        //          showed as saved an edit that was no longer on disk. No silent pick: neither is
        //          written, both stay to be saved and the notice says to close one. Two copies with
        //          the same tags are saved as always. The same goes for two different photos with the
        //          same name (a.png and a.jpg): there is one .txt, a.txt.
        //          `chiave` says where the .txt ends up; `stessoPosto` compares two equal keys.
        const doppie: string[] = [];
        const inConflitto = async (lista: any[], chiave: (img: any) => string, stessoPosto: (a: any, b: any) => Promise<boolean>) => {
            const perChiave = new Map<string, any[][]>();
            for (const img of lista) {
                const k = chiave(img);
                if (!k) continue;
                const gruppi = perChiave.get(k) || [];
                let gruppo: any[] | null = null;
                for (const g of gruppi) if (await stessoPosto(g[0], img)) { gruppo = g; break; }
                if (gruppo) gruppo.push(img); else gruppi.push([img]);
                perChiave.set(k, gruppi);
            }
            const fuori = new Set<string>();
            for (const gruppi of perChiave.values()) for (const g of gruppi) {
                if (g.length > 1 && new Set(g.map(img => getOrderedTagString(img.tags))).size > 1) g.forEach(img => fuori.add(img.id));
            }
            return fuori;
        };

        if (total > 0) { setIsSaving(true); setImportProgress(0); }
        try {
            // ITALIANO: 1) Immagini con una cartella scrivibile: ognuna nel SUO handle di cartella.
            //           Ogni file ha il PROPRIO try/catch: una foto che fallisce (bloccata, permessi,
            //           disco pieno) NON ferma le altre. Prima al primo errore si interrompeva tutto,
            //           le foto gia' scritte non risultavano salvate e le successive non erano tentate.
            // ENGLISH: 1) Images with a writable folder: each into ITS OWN folder handle. Every file
            //          has its OWN try/catch: one failing photo (locked, permissions, disk full) does
            //          NOT stop the others. It used to abort at the first error, leaving already-written
            //          photos unmarked and the rest never attempted.
            if (withFolder.length > 0) {
                showNotification(t.processingFiles, "info");
                // ITALIANO: stessa cartella anche da due handle diversi (due "Carica cartella"): isSameEntry.
                // ENGLISH: the same folder even from two different handles (two "Load folder"): isSameEntry.
                const doppieCartella = await inConflitto(withFolder, img => sidecarTagFileName(img.file.name).toLowerCase(), async (a, b) => {
                    if (a.dirHandle === b.dirHandle) return true;
                    try { return typeof a.dirHandle.isSameEntry === 'function' && await a.dirHandle.isSameEntry(b.dirHandle); } catch { return false; }
                });
                for (const img of withFolder) {
                    if (doppieCartella.has(img.id)) { doppie.push(img.file.name); bump(); continue; }
                    try {
                        const tagString = getOrderedTagString(img.tags);
                        // ITALIANO: lo stesso .txt che l'import rilegge e Kohya usa (vedi sidecarTagFileName).
                        // ENGLISH: the same .txt the import reads back and Kohya uses (see sidecarTagFileName).
                        const fileName = sidecarTagFileName(img.file.name);
                        // ITALIANO: una foto senza tag non riceve un .txt NUOVO e vuoto: Kohya si
                        //           ferma su un .txt vuoto ("caption file is empty"), non su uno che
                        //           manca (come nell'esportazione). Quello che c'era si svuota davvero.
                        // ENGLISH: a photo with no tags does not get a NEW empty .txt: Kohya stops on
                        //          an empty .txt ("caption file is empty"), not on a missing one (as
                        //          in the export). One that was there is really emptied.
                        const fileHandle = tagString === ''
                            ? await txtEsistente(img.dirHandle, fileName)
                            : await img.dirHandle.getFileHandle(fileName, { create: true });
                        if (fileHandle) {
                            const writable = await fileHandle.createWritable();
                            await writable.write(tagString);
                            await writable.close();
                            if (tagString === '') svuotate++;
                        }
                        savedIds.add(img.id);
                    } catch (err) {
                        console.error('[Salvataggio] impossibile scrivere', img.file.name, err);
                        failedNames.push(img.file.name);
                    }
                    bump();
                }
            }

            // ITALIANO: 2) Immagini senza cartella (caricate con "Carica immagini"): in Electron scrivo
            //           il .txt SUL POSTO accanto all'immagine vera, con esito REALE per ogni file.
            //           Prima degradavano a un download del browser che in Electron apre una finestra
            //           "Salva con nome" annullabile, ma la funzione dava per "salvato" senza sapere se
            //           il file fosse stato scritto: annullare bastava a perdere i tag (e "Salva e
            //           chiudi" cancellava il backup). Ora l'esito e' vero.
            // ENGLISH: 2) Images without a folder (loaded via "Load images"): in Electron write the
            //          .txt IN PLACE next to the real image, with a REAL per-file outcome. They used to
            //          degrade to a browser download which in Electron pops a cancellable "Save as"
            //          dialog, yet the function reported "saved" without knowing whether the file was
            //          written: cancelling was enough to lose the tags (and "Save and close" cleared the
            //          backup). Now the outcome is real.
            const api = (window as any).electronAPI;
            let remaining = withoutFolder;
            if (remaining.length > 0 && api && typeof api.getPathForFile === 'function' && typeof api.writeSidecarTags === 'function') {
                showNotification(t.processingFiles, "info");
                // ITALIANO: la chiave e' il .txt di arrivo (cartella + sidecarTagFileName, come nel processo
                //           principale), senza maiuscole come Windows: la stessa foto caricata due volte,
                //           ma anche a.png e a.jpg, finiscono nello stesso a.txt. Prima contava il percorso
                //           dell'immagine: a.png e a.jpg con tag diversi si scrivevano tutte e due nello
                //           stesso a.txt, vinceva l'ultima, e risultavano salvate tutte e due.
                // ENGLISH: the key is the target .txt (folder + sidecarTagFileName, as in the main process),
                //          case-insensitive like Windows: the same photo loaded twice, but also a.png and
                //          a.jpg, end in the same a.txt. It used to be the image path: a.png and a.jpg with
                //          different tags were both written into the same a.txt, the last one won, and both
                //          counted as saved.
                const txtDiArrivo = (img: any) => {
                    const p = String(api.getPathForFile(img.file) || '');
                    if (!p) return '';
                    const taglio = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/')) + 1;
                    return (p.slice(0, taglio) + sidecarTagFileName(p.slice(taglio))).toLowerCase();
                };
                const doppiePercorso = await inConflitto(remaining, txtDiArrivo, async () => true);
                remaining.forEach(img => { if (doppiePercorso.has(img.id)) doppie.push(img.file.name); });
                bump(doppiePercorso.size);
                remaining = remaining.filter(img => !doppiePercorso.has(img.id));
                const items = remaining.map(img => ({ imagePath: api.getPathForFile(img.file) || '', content: getOrderedTagString(img.tags) }));
                try {
                    const res = await api.writeSidecarTags(items);
                    const flags: boolean[] = Array.isArray(res && res.results) ? res.results : [];
                    remaining.forEach((img, i) => { if (flags[i]) savedIds.add(img.id); else failedNames.push(img.file.name); });
                    // ITALIANO: il processo principale non crea un .txt vuoto nuovo: si e' svuotato
                    //           solo quello di una foto che sul disco aveva dei tag.
                    // ENGLISH: the main process does not create a new empty .txt: only the one of a
                    //          photo that had tags on disk was emptied.
                    svuotate += remaining.filter((img, i) => flags[i] && img.tags.length === 0 && (img.originalTags || []).length > 0).length;
                } catch (err) {
                    console.error('[Salvataggio] scrittura sidecar fallita', err);
                    remaining.forEach(img => failedNames.push(img.file.name));
                }
                bump(remaining.length);
                remaining = [];
            }

            // ITALIANO: 3) Vero ripiego BROWSER (fuori da Electron): un download e' un'ESPORTAZIONE, non
            //           un salvataggio verificato. NON le segno come salvate (originalTags resta) e le
            //           conto come NON riuscite, cosi' "Salva e chiudi" non chiude e non cancella il
            //           backup su file che potrebbero non essere mai stati scritti.
            // ENGLISH: 3) True BROWSER fallback (outside Electron): a download is an EXPORT, not a
            //          verified save. I do NOT mark them saved (originalTags stays) and count them as
            //          NOT succeeded, so "Save and close" won't close nor clear the backup on files that
            //          may never have been written.
            if (remaining.length > 0) {
                showNotification(t.infoSaveFallback, "info");
                for (const img of remaining) {
                    const tagString = getOrderedTagString(img.tags);
                    const blob = new Blob([tagString], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    try {
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = buildTagFileName(img.file.name);
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    } finally {
                        URL.revokeObjectURL(url);
                    }
                    bump();
                    // ITALIANO: respiro fra un download e l'altro, il browser non li accetta a raffica
                    // ENGLISH: breathing room between downloads, the browser rejects rapid-fire ones
                    await new Promise(r => setTimeout(r, 300));
                }
                // ITALIANO: contate a parte: offerte come download, non fallite (vedi il messaggio).
                // ENGLISH: counted apart: offered as downloads, not failed (see the message).
                scaricate += remaining.length;
                remaining = [];
            }
        } finally {
            setTimeout(() => { setIsSaving(false); setImportProgress(0); }, 500);
        }

        // ITALIANO: segno come salvati SOLO i file davvero scritti, coi tag dello SNAPSHOT (non quelli
        //           attuali): un tag aggiunto durante il salvataggio non risulta gia' salvato.
        // ENGLISH: mark as saved ONLY the files really written, with the SNAPSHOT tags (not the live
        //          ones): a tag added while saving is not counted as already saved.
        if (savedIds.size > 0) {
            // ITALIANO: segnare i file come salvati non e' un'azione dell'utente: non diventa un
            //           passo della cronologia (Ctrl+Z non tocca originalTags, vedi
            //           withLiveOriginalTags). Prima lo era: il primo Ctrl+Z dopo "Salva" diceva
            //           "Azione annullata" senza cambiare niente, e un salvataggio dopo un Ctrl+Z
            //           cancellava i passi da rifare.
            // ENGLISH: marking the files as saved is not a user action: it does not become a history
            //          step (Ctrl+Z does not touch originalTags, see withLiveOriginalTags). It used to
            //          be one: the first Ctrl+Z after "Save" said "Action undone" without changing
            //          anything, and a save after a Ctrl+Z wiped the steps to redo.
            isUndoRedoAction.current = true;
            setImages(prev => prev.map(img => {
                if (!savedIds.has(img.id)) return img;
                const snap = imagesToSave.find(s => s.id === img.id);
                return snap ? { ...img, originalTags: [...snap.tags] } : img;
            }));
        }

        // ITALIANO: qualcosa non e' stato salvato (o e' stato solo offerto come download): si torna
        //           FALSE, cosi' "Salva e chiudi" NON chiude e NON cancella il backup anti-crash.
        //           Il messaggio e' fatto di frasi intere: niente salvato, salvate N su M (coi primi
        //           nomi), offerte come download. Prima erano pezzi incollati ("Salvataggio
        //           parziale: 0/5 — non salvate: ..."), "parziale" anche con niente salvato, e i
        //           download dell'anteprima risultavano un errore.
        // ENGLISH: something was not saved (or was only offered as a download): return FALSE, so
        //          "Save and close" does NOT close nor clear the crash backup. The message is made of
        //          whole sentences: nothing saved, N of M saved (with the first names), offered as
        //          downloads. It used to be glued pieces ("Partial save: 0/5 — failed: ..."),
        //          "partial" even with nothing saved, and the preview's downloads showed as an error.
        const primi = failedNames.slice(0, 3).join(', ') + (failedNames.length > 3 ? '…' : '');
        const frasi: string[] = [];
        if (failedNames.length > 0) {
            frasi.push(savedIds.size === 0
                ? t.saveNoneSaved.replace('{names}', primi)
                : t.saveSomeFailed.replace('{saved}', String(savedIds.size)).replace('{total}', String(total)).replace('{names}', primi));
        }
        // ITALIANO: le copie doppie non scritte (vedi inConflitto), un nome per foto.
        // ENGLISH: the duplicate copies not written (see inConflitto), one name per photo.
        if (doppie.length > 0) {
            const nomi = [...new Set(doppie)];
            frasi.push(t.saveSameFileTwice.replace('{names}', nomi.slice(0, 3).join(', ') + (nomi.length > 3 ? '…' : '')));
        }
        if (scaricate > 0) frasi.push(scaricate === 1 ? t.saveDownloadedOne : t.saveDownloadedMany.replace('{n}', String(scaricate)));
        if (frasi.length === 0) frasi.push(t.successSaveChanges);
        // ITALIANO: un .txt svuotato ferma Kohya: lo si dice, senza bloccare niente.
        // ENGLISH: an emptied .txt stops Kohya: say so, without blocking anything.
        if (svuotate > 0) frasi.push(svuotate === 1 ? t.saveEmptyCaptionOne : t.saveEmptyCaptionMany.replace('{n}', String(svuotate)));
        if (fraseNonScritte) frasi.push(fraseNonScritte);
        const riuscito = failedNames.length === 0 && scaricate === 0 && doppie.length === 0 && !fraseNonScritte;
        if (riuscito) soundManager.chime();
        showNotification(frasi.join(' '), (failedNames.length > 0 || doppie.length > 0) ? "error" : (scaricate > 0 || svuotate > 0 || fraseNonScritte) ? "info" : "success");
        return riuscito;
    };

    // ITALIANO: Salva solo le immagini che hanno subito modifiche
    // ENGLISH: Save only the images that have undergone changes
    // ITALIANO: Torna TRUE se non c'era nulla da salvare o se il salvataggio e' riuscito.
    // ENGLISH: Returns TRUE when there was nothing to save or the save succeeded.
    const handleSaveChanges = async (): Promise<boolean> => {
        // ITALIANO: NON salvo le foto nel cestino: i loro .txt non vanno scritti su disco (l'utente le
        //           ha escluse dal dataset). Salvo solo le foto attive con modifiche.
        // ENGLISH: do NOT save trashed photos: their .txt must not be written to disk (the user
        //          excluded them from the dataset). Save only active photos with changes.
        // ITALIANO: una foto col .txt non letto all'import si salva solo per i tag messi apposta su
        //           di lei, non per una trigger (vedi fotoDaSalvare).
        // ENGLISH: a photo whose .txt was not read at import is saved only for the tags put on it on
        //          purpose, not for a trigger (see fotoDaSalvare).
        const modifiedImages = images.filter(img => !img.isTrashed && fotoDaSalvare(img, globalTriggers));
        if (modifiedImages.length === 0) { showNotification(t.noChanges, "info"); return true; }
        // ITALIANO: una foto il cui .txt non si e' potuto leggere all'import non si scrive: cosa contiene
        //           non si sa, e un tag aggiunto a tutte, un Incolla o l'AI lo sostituivano coi soli tag
        //           nuovi (vedi txtNonLettoInVigore). Resta da salvare, l'avviso la nomina, e si torna
        //           FALSE: "Salva e chiudi" non chiude. Per sostituirlo apposta: il visualizzatore.
        // ENGLISH: a photo whose .txt could not be read at import is not written: its content is
        //          unknown, and a tag added to all photos, a Paste or the AI replaced it with the new
        //          tags alone (see txtNonLettoInVigore). It stays unsaved, the notice names it, and
        //          FALSE is returned: "Save and close" does not close. To replace it on purpose: the viewer.
        const nonScritte = modifiedImages.filter(img => txtNonLettoInVigore(img)).map(img => img.file.name);
        const daScrivere = modifiedImages.filter(img => !txtNonLettoInVigore(img));
        const primi = nonScritte.slice(0, 3).join(', ') + (nonScritte.length > 3 ? '…' : '');
        const fraseNonScritte = nonScritte.length === 0 ? ''
            : nonScritte.length === 1 ? t.saveUnreadTxtOne.replace('{names}', primi)
            : t.saveUnreadTxtMany.replace('{n}', String(nonScritte.length)).replace('{names}', primi);
        if (daScrivere.length === 0) { showNotification(fraseNonScritte, "info"); return false; }
        return performSave(daScrivere, fraseNonScritte);
    };

    // ITALIANO: Esporta i tag di tutte le immagini del progetto
    // ENGLISH: Export tags for all images in the project
    // ITALIANO: Crea un unico .zip con un .txt per immagine. La barra di avanzamento segue la
    //           compressione, cosi' su dataset grandi si vede che il programma sta lavorando.
    // ENGLISH: Builds a single .zip holding one .txt per image. The progress bar follows the
    //          compression, so on large datasets it is visible that the app is working.
    // ITALIANO: Peso in parole. Serve per far vedere in anticipo quanto pesera' l'archivio:
    //           la differenza fra le due strade e' fra i KB e i GB, e va vista PRIMA di premere.
    // ENGLISH: Human-readable size, shown before starting: the gap between the two roads is
    //          KB against GB, and it has to be visible BEFORE the button is pressed.
    const formatoPeso = (byte: number): string => {
        if (byte < 1024) return byte + ' B';
        const unita = ['KB', 'MB', 'GB', 'TB'];
        let v = byte / 1024;
        let i = 0;
        while (v >= 1024 && i < unita.length - 1) { v /= 1024; i++; }
        return (v < 10 ? v.toFixed(1) : Math.round(v).toString()).replace('.', ',') + ' ' + unita[i];
    };

    const exportAllAsZip = async (imagesToExport: any[], conImmagini: boolean, rinomina: boolean): Promise<boolean> => {
        setIsSaving(true); setImportProgress(0);
        try {
            showNotification(t.zipProcessing, "info");
            // ITALIANO: l'elenco delle voci dell'archivio, in ordine. Qui non si legge niente: ogni
            //           foto si legge solo quando tocca a lei, a pezzi, mentre si scrive (scriviZip).
            // ENGLISH: the list of the archive's entries, in order. Nothing is read here: each photo
            //          is read only when its turn comes, in chunks, while writing (scriviZip).
            const voci: VoceZip[] = [];
            // ITALIANO: la foto si rilegge dalla SUA cartella quando tocca a lei. Il file preso
            //           all'import e' un'istantanea: se nel frattempo la foto e' stata ritoccata in un
            //           altro programma, Chromium rifiuta di leggerlo (NotReadableError) e tutta
            //           l'esportazione finiva con un generico "Errore durante la creazione dello ZIP".
            //           Riletta cosi', nell'archivio va la versione di adesso. Senza cartella ("Carica
            //           immagini") o se la foto non c'e' piu', resta l'istantanea: se non si legge,
            //           l'avviso dice quale foto (zipPhotoUnreadable).
            // ENGLISH: the photo is re-read from ITS folder when its turn comes. The file taken at
            //          import is a snapshot: if meanwhile the photo was retouched in another program,
            //          Chromium refuses to read it (NotReadableError) and the whole export ended with a
            //          generic "Error creating ZIP". Re-read this way, the archive gets today's version.
            //          With no folder ("Load images") or if the photo is gone, the snapshot stays: if it
            //          cannot be read, the notice says which photo (zipPhotoUnreadable).
            const fotoAggiornata = (img: any) => async (): Promise<Blob> => {
                const dir = img.dirHandle;
                if (dir && typeof dir.getFileHandle === 'function') {
                    try { return await (await dir.getFileHandle(img.file.name)).getFile(); }
                    catch (_) { /* spostata o cancellata: si prova l'istantanea / moved or deleted: try the snapshot */ }
                }
                return img.file;
            };
            // ITALIANO: due foto con lo STESSO nome in sottocartelle diverse (tipico dei dataset LoRA:
            //           10_viso\img.png e 20_corpo\img.png) davano lo stesso nome nell'archivio, e
            //           l'omonimo SOVRASCRIVEVA l'altro: uno dei due .txt spariva in silenzio. Ora, se il nome e'
            //           gia' occupato, distinguo il file con la sua sottocartella (es. "10_viso/img.txt")
            //           o, se serve, con un suffisso numerico; nessun .txt viene piu' perso, e avviso.
            // ENGLISH: two photos with the SAME name in different subfolders (typical LoRA layout:
            //          10_face\img.png and 20_body\img.png) produced the same archive entry name, and
            //          the namesake OVERWROTE the other: one of the two .txt vanished silently. Now,
            //          if the name is already taken, I disambiguate the file with its subfolder (e.g.
            //          "10_face/img.txt") or, if needed, a numeric suffix; no .txt is lost, and I warn.
            // ITALIANO: i nomi si confrontano senza badare alle maiuscole: per Windows A.txt e a.txt
            //           sono lo stesso file, ed estraendo uno prendeva il posto dell'altro (e Kohya
            //           abbinava la foto ai tag sbagliati). Il nome nell'archivio resta com'e'.
            // ENGLISH: names are compared ignoring capitals: to Windows A.txt and a.txt are the same
            //          file, and on extraction one replaced the other (and Kohya paired the photo with
            //          the wrong tags). The name in the archive stays as it is.
            const usedNames = new Set<string>();
            const occupato = (n: string) => usedNames.has(n.toLowerCase());
            let collisionCount = 0;
            // ITALIANO: rinominando, il nome e' il posto in fila: 0001, 0002... Le cifre sono
            //           almeno quattro (e' la convenzione dei dataset LoRA) e diventano di piu'
            //           solo se le foto sono piu' di 9999, cosi' i nomi restano in ordine anche
            //           per chi li guarda in una cartella. Cosi' i nomi doppi non esistono proprio.
            // ENGLISH: when renaming, the name is the position in line: 0001, 0002... At least
            //          four digits (the LoRA dataset convention), more only past 9999 photos, so
            //          the names still sort correctly in a folder listing. Duplicate names simply
            //          cannot happen this way.
            const cifre = Math.max(4, String(imagesToExport.length).length);
            let progressivo = 0;
            // ITALIANO: quante foto entrano senza .txt perche' non hanno tag: l'avviso finale lo dice,
            //           altrimenti si addestrerebbero senza descrizione senza che nessuno lo sappia.
            // ENGLISH: how many photos go in without a .txt because they have no tags: the final
            //          notice says so, otherwise they would train without a caption unnoticed.
            let senzaTag = 0;
            imagesToExport.forEach((img) => {
                // ITALIANO: una foto senza tag (solo con "Tag e immagini") entra SENZA .txt: un .txt
                //           vuoto fa fermare l'addestramento di Kohya ("caption file is empty"), uno
                //           che manca no. Il suo nome resta comunque occupato, come per le altre.
                // ENGLISH: an untagged photo (only with "Tags and images") goes in WITHOUT a .txt: an
                //          empty .txt stops Kohya's training ("caption file is empty"), a missing one
                //          does not. Its name stays taken all the same, as for the others.
                const conTag = Array.isArray(img.tags) && img.tags.length > 0;
                if (conImmagini && !conTag) senzaTag++;
                if (rinomina) {
                    progressivo++;
                    const numero = String(progressivo).padStart(cifre, '0');
                    const nf = String(img.file.name || '');
                    const pt = nf.lastIndexOf('.');
                    if (conTag) voci.push({ nome: numero + '.txt', dati: getOrderedTagString(img.tags) });
                    voci.push({ nome: numero + (pt > 0 ? nf.slice(pt) : ''), dati: fotoAggiornata(img), etichetta: nf });
                    return;
                }
                // ITALIANO: il .txt dell'archivio si chiama come quello che l'import abbina alla foto
                //           (sidecarTagFileName): estratto accanto a "photo..v2.png" deve essere
                //           "photo..v2.txt", non il nome ripulito "photo.v2.txt", che non si abbinava.
                // ENGLISH: the archive's .txt is named like the one the import pairs with the photo
                //          (sidecarTagFileName): extracted next to "photo..v2.png" it must be
                //          "photo..v2.txt", not the cleaned "photo.v2.txt", which did not pair.
                // ITALIANO: la foto torna nella sua sottocartella (cartellaRel, da "Carica cartella"):
                //           10_face/a.txt, 20_body/b.txt. Prima finiva tutto alla radice tranne gli
                //           omonimi, e sd-scripts (train_data_dir) legge solo le cartelle N_nome: le
                //           foto alla radice restavano fuori e i numeri di ripetizioni sparivano. Ogni
                //           pezzo si ripulisce; "", "." e ".." si saltano, cosi' niente esce dall'archivio.
                // ENGLISH: the photo goes back into its subfolder (cartellaRel, from "Load folder"):
                //          10_face/a.txt, 20_body/b.txt. Everything used to land at the root except the
                //          namesakes, and sd-scripts (train_data_dir) only reads N_name folders: the
                //          root photos were left out and the repeat counts vanished. Every part is
                //          cleaned; "", "." and ".." are skipped, so nothing escapes the archive.
                const sotto = String(img.cartellaRel || '').split(/[\\/]/)
                    .filter(p => p && p !== '.' && p !== '..').map(p => sanitizeFileName(p, '_')).join('/');
                const baseName = (sotto ? sotto + '/' : '') + sidecarTagFileName(img.file.name);
                let name = baseName;
                if (occupato(name)) {
                    collisionCount++;
                    // ITALIANO: con la sottocartella gia' nel nome resta il suffisso numerico.
                    // ENGLISH: with the subfolder already in the name, the numeric suffix remains.
                    const dir = (!sotto && img.dirHandle && typeof img.dirHandle.name === 'string') ? sanitizeFileName(img.dirHandle.name) : '';
                    if (dir && !occupato(`${dir}/${baseName}`)) {
                        name = `${dir}/${baseName}`;
                    } else {
                        const dot = baseName.lastIndexOf('.');
                        const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
                        const ext = dot > 0 ? baseName.slice(dot) : '';
                        let n = 2;
                        while (occupato(`${stem} (${n})${ext}`)) n++;
                        name = `${stem} (${n})${ext}`;
                    }
                }
                usedNames.add(name.toLowerCase());
                if (conTag) voci.push({ nome: name, dati: getOrderedTagString(img.tags) });
                if (conImmagini) {
                    // ITALIANO: la foto prende lo STESSO nome del suo .txt, estensione a parte. Cosi'
                    //           la coppia resta abbinata anche nei casi risolti qui sopra, dove il
                    //           nome e' stato cambiato per non sovrascrivere un omonimo: se il .txt
                    //           e' diventato "10_viso/img.txt", la foto diventa "10_viso/img.png".
                    // ENGLISH: the photo takes the SAME name as its .txt, extension aside. That keeps
                    //          the pair together even in the cases resolved above, where the name was
                    //          changed to avoid overwriting a namesake: if the .txt became
                    //          "10_face/img.txt", the photo becomes "10_face/img.png".
                    const nomeFoto = String(img.file.name || '');
                    const punto = nomeFoto.lastIndexOf('.');
                    const estensione = punto > 0 ? nomeFoto.slice(punto) : '';
                    voci.push({ nome: name.slice(0, -4) + estensione, dati: fotoAggiornata(img), etichetta: nomeFoto });
                }
            });
            // ITALIANO: SCRITTURA A PEZZI, DIRETTAMENTE SUL DISCO. Con le foto un dataset da qualche
            //           migliaio di immagini fa dieci e passa GB: non deve passare dalla memoria.
            //           Prima c'era JSZip, che la promessa non la manteneva: leggeva SUBITO ogni foto
            //           per intero (mentre la finestra di salvataggio era ancora aperta) e le teneva
            //           tutte fino alla fine; la pausa sul flusso frenava solo l'uscita, e la finestra
            //           moriva lo stesso. Ora scriviZip legge ogni foto solo quando tocca a lei, un
            //           pezzo per volta, e aspetta che il pezzo sia sul disco prima di leggere il
            //           successivo; oltre i 4 GB scrive lo ZIP64, che JSZip non sapeva fare.
            //           Nessuna compressione: JPEG e PNG sono gia' compressi, comprimerli costa
            //           minuti e guadagna quasi zero (ed e' quello che il codice faceva gia' prima).
            // ENGLISH: CHUNKED WRITE, STRAIGHT TO DISK. With photos, a dataset of a few thousand images
            //          makes ten-plus GB: it must not go through memory. JSZip used to be here, and it
            //          did not keep that promise: it read every photo WHOLE right away (while the save
            //          dialog was still open) and kept them all to the end; the pause on the stream
            //          only slowed the output, and the window died anyway. Now scriviZip reads each
            //          photo only when its turn comes, one chunk at a time, and waits for the chunk to
            //          be on disk before reading the next; past 4 GB it writes ZIP64, which JSZip could
            //          not do. No compression: JPEG and PNG are already compressed, so compressing
            //          them costs minutes for almost nothing (as the code already did).
            const nomeSuggerito = conImmagini ? 'dataset.zip' : 'tags_all.zip';
            // ITALIANO: avanzamento sui byte: quelli dei .txt e delle foto, noti in anticipo.
            // ENGLISH: progress over bytes: those of the .txt and of the photos, known in advance.
            const totale = voci.reduce((n, v) => n + (typeof v.dati === 'string' ? v.dati.length : 0), 0)
                + (conImmagini ? imagesToExport.reduce((n, img) => n + (img.file && img.file.size ? img.file.size : 0), 0) : 0);
            let fatto = 0;
            let ultimo = -1;
            const avanzamento = (n: number) => {
                fatto += n;
                const percento = Math.min(100, Math.round((fatto / Math.max(1, totale)) * 100));
                if (percento !== ultimo) { ultimo = percento; setImportProgress(percento); }
            };
            const salvaSuDisco = 'showSaveFilePicker' in window;
            if (salvaSuDisco) {
                const handle = await (window as any).showSaveFilePicker({
                    id: 'itm-zip-export',
                    suggestedName: nomeSuggerito,
                    types: [{ description: 'ZIP', accept: { 'application/zip': ['.zip'] } }],
                });
                const writable = await handle.createWritable();
                try {
                    await scriviZip(voci, { write: (pezzo) => writable.write(pezzo) }, { onAvanzamento: avanzamento });
                } catch (errScrittura) {
                    // ITALIANO: si butta via, NON si chiude: close() SALVEREBBE il pezzo scritto
                    //           fin qui, e resterebbe sul disco un dataset.zip troncato che
                    //           sembra buono. abort() lascia il file di prima com'era.
                    // ENGLISH: discard it, do NOT close: close() would SAVE the part written so
                    //          far, leaving a truncated dataset.zip on disk that looks fine.
                    //          abort() leaves the previous file as it was.
                    try { await writable.abort(); } catch (_) { }
                    throw errScrittura;
                }
                await writable.close();
            } else {
                // ITALIANO: riserva per i browser senza finestra di salvataggio: l'archivio si
                //           raccoglie in memoria e si scarica (qui non c'e' un file su cui scrivere).
                // ENGLISH: fallback for browsers with no save picker: the archive is gathered in
                //          memory and downloaded (there is no file to write into here).
                const pezzi: Uint8Array[] = [];
                await scriviZip(voci, { write: async (pezzo) => { pezzi.push(pezzo); } }, { onAvanzamento: avanzamento });
                const blob = new Blob(pezzi as BlobPart[], { type: 'application/zip' });
                const url = URL.createObjectURL(blob);
                try {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = nomeSuggerito;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                } finally {
                    URL.revokeObjectURL(url);
                }
            }
            soundManager.chime();
            // ITALIANO: se c'erano nomi doppi lo dico: i file sono TUTTI nell'archivio (rinominati),
            //           cosi' l'utente sa perche' alcuni .txt hanno un nome diverso dalla loro foto.
            // ENGLISH: if there were duplicate names I say so: all files ARE in the archive (renamed),
            //          so the user knows why some .txt have a different name than their photo.
            // ITALIANO: e le foto senza tag, con una frase intera giusta anche per 1.
            // ENGLISH: and the untagged photos, in a whole sentence that is right for 1 too.
            const avvisoSenzaTag = senzaTag === 0 ? ''
                : ' ' + (senzaTag === 1 ? t.zipUntaggedOne : t.zipUntaggedMany.replace('{n}', String(senzaTag)));
            if (collisionCount > 0) {
                showNotification(`${t.zipSuccess}${avvisoSenzaTag} — ${t.zipNameCollisionWarn.replace('{n}', String(collisionCount))}`, "info");
            } else if (senzaTag > 0) {
                showNotification(t.zipSuccess + avvisoSenzaTag, "info");
            } else {
                showNotification(t.zipSuccess, "success");
            }
            return true;
        } catch (err: any) {
            // ITALIANO: chiudere la finestra di salvataggio non e' un errore: non si dice niente.
            // ENGLISH: dismissing the save dialog is not an error: stay quiet.
            if (err && err.name === 'AbortError') return false;
            console.error(err);
            // ITALIANO: una foto che non si legge si nomina, con cosa fare; il resto resta generico.
            // ENGLISH: a photo that cannot be read is named, with what to do; the rest stays generic.
            if (err && err.name === ERRORE_LETTURA_ZIP) showNotification(t.zipPhotoUnreadable.replace('{name}', String(err.voce || '')), "error");
            else showNotification(t.zipError, "error");
            return false;
        } finally {
            setTimeout(() => { setIsSaving(false); setImportProgress(0); }, 500);
        }
    };

    // ITALIANO: "Esporta tutti" crea SEMPRE un unico archivio .zip (niente piu' file singoli).
    // ENGLISH: "Export all" ALWAYS creates a single .zip archive (no more one-file-per-image).
    const handleExportAll = () => {
        // ITALIANO: `!img.isTrashed` — le foto messe nel cestino sono state SCARTATE dal dataset:
        //           i loro .txt non devono finire nell'archivio esportato. Mancava, ed era l'unico
        //           punto del codice che non filtrava le cestinate (il salvataggio, la galleria e
        //           le statistiche lo fanno tutti).
        // ENGLISH: `!img.isTrashed` — photos in the trash were DISCARDED from the dataset: their
        //          .txt must not land in the exported archive. This guard was missing here, the one
        //          spot that did not filter the trash (save, gallery and stats all do).
        // ITALIANO: due elenchi. "Solo i tag" prende le foto CON tag (una foto senza tag non ha un
        //           .txt da mettere); "Tag e immagini" prende TUTTE le foto attive. Prima anche lui
        //           prendeva solo quelle con tag: le foto ancora senza tag sparivano dal dataset
        //           esportato, con "archivio creato" come unico messaggio, e se nessuna aveva tag
        //           l'esportazione si rifiutava del tutto.
        // ENGLISH: two lists. "Tags only" takes the photos WITH tags (an untagged photo has no .txt
        //          to put in); "Tags and images" takes ALL active photos. It used to take only the
        //          tagged ones too: the still-untagged photos vanished from the exported dataset,
        //          with "archive created" as the only message, and if none had tags the export
        //          refused altogether.
        // ITALIANO: in fila come nella galleria ("Ordina per"): e' l'ordine che "Rinomina in
        //           sequenza" promette per 0001, 0002... Prima restava quello in memoria (A-Z
        //           dall'import, con in fondo le foto tornate annullando lo svuotamento del cestino).
        // ENGLISH: lined up as in the gallery ("Sort by"): the order "Rename in sequence" promises
        //          for 0001, 0002... It used to stay the in-memory one (A-Z from the import, with the
        //          photos brought back by undoing the trash emptying at the end).
        // ITALIANO: un salvataggio o un'esportazione sta gia' scrivendo: la barra di avanzamento e'
        //           sua, e una seconda operazione la nasconderebbe a meta' (il tasto e' disattivato).
        // ENGLISH: a save or an export is already writing: the progress bar belongs to it, and a
        //          second operation would hide it halfway (the button is disabled).
        if (isSaving) return;
        const attive = applySort(images.filter(img => !img.isTrashed), sortOrder);
        const imagesWithTags = attive.filter(img => img.tags && img.tags.length > 0);

        if (attive.length === 0) {
            return showNotification(t.errorNoTagsToExport, "info");
        }

        // ITALIANO: si chiede PRIMA cosa mettere dentro, con numero di file e peso delle due
        //           strade gia' calcolati: la differenza fra le due e' fra KB e GB.
        // ENGLISH: ask FIRST what goes in, with the file count and size of both roads already
        //          worked out: the gap between them is KB against GB.
        const pesoTag = imagesWithTags.reduce((n, img) => n + new Blob([getOrderedTagString(img.tags)]).size, 0);
        const pesoFoto = attive.reduce((n, img) => n + (img.file && img.file.size ? img.file.size : 0), 0);
        setExportChoice({
            imgs: imagesWithTags,
            tutte: attive,
            riepilogo: {
                soloTag: { file: imagesWithTags.length, peso: formatoPeso(pesoTag) },
                conImmagini: { file: imagesWithTags.length + attive.length, peso: formatoPeso(pesoTag + pesoFoto) },
            },
        });
    };

    // ITALIANO: "Esporta" nella finestra di scelta: ogni strada col suo elenco (vedi handleExportAll).
    //           "Solo i tag" senza nessuna foto con tag non ha niente da mettere: lo si dice.
    // ENGLISH: "Export" in the choice dialog: each road with its own list (see handleExportAll).
    //          "Tags only" with no tagged photo has nothing to put in: say so.
    const avviaExport = (conImmagini: boolean, rinomina: boolean) => {
        const scelta = exportChoice;
        setExportChoice(null);
        if (!scelta) return undefined;
        const lista = conImmagini ? scelta.tutte : scelta.imgs;
        if (!lista || lista.length === 0) { showNotification(t.errorNoTagsToExport, "info"); return undefined; }
        return exportAllAsZip(lista, conImmagini, rinomina);
    };

    // ITALIANO: useCallback (dip. solo dalle trigger word): identita' stabile mentre si modificano i
    //           tag, cosi' passandolo alle card della galleria non le fa ridisegnare tutte.
    // ENGLISH: useCallback (deps only the trigger words): stable identity while editing tags, so
    //          passing it to the gallery cards does not force them all to re-render.
    const updateImageTags = useCallback((id: string, newTags: string[]) => {
        // ITALIANO: Deduplica alla fonte — incollando "sunset, sunset" o simili non si creano tag
        //           doppi (che finirebbero nel .txt esportato e darebbero due pillole con la stessa key React).
        // ENGLISH: Dedupe at the source — pasting "sunset, sunset" etc. must not create duplicate tags
        //          (they would end up in the exported .txt and render two pills with the same React key).
        // ITALIANO: anche "smile" e "Smile" sono doppioni: resta la grafia che c'era gia', o quella
        //           della trigger word (vedi tagCase). Nessun tag viene messo in minuscolo.
        // ENGLISH: "smile" and "Smile" are duplicates too: the spelling already there stays, or the
        //          trigger word's (see tagCase). No tag is lowercased.
        const uniqueTags = uniqueTagsIgnoringCase(newTags, globalTriggers);
        // ITALIANO: Ordine dei tag: prima le trigger word (nell'ordine impostato dall'utente,
        //           convenzione LoRA), poi tutti gli altri in ORDINE ALFABETICO. Vale ovunque,
        //           perche' questo e' l'unico punto in cui i tag di un'immagine vengono scritti.
        // ENGLISH: Tag order: trigger words first (in the user's configured order, LoRA
        //          convention), then everything else ALPHABETICALLY. Applies everywhere, since
        //          this is the single place an image's tags are written.
        const orderedTags = [
            ...globalTriggers.filter(tag => uniqueTags.includes(tag)),
            ...uniqueTags.filter(tag => !globalTriggers.includes(tag)).sort((a, b) => a.localeCompare(b))
        ];
        setImages(prev => prev.map(img => img.id === id ? { ...img, tags: orderedTags } : img));
    }, [globalTriggers]);
    // ITALIANO: il visualizzatore ha scritto il .txt: come in performSave, non e' un passo della cronologia.
    // ENGLISH: the viewer wrote the .txt: as in performSave, it is not a history step.
    const updateOriginalTags = (id: string, newTags: string[]) => { isUndoRedoAction.current = true; setImages(prev => prev.map(img => img.id === id ? { ...img, originalTags: [...newTags] } : img)); };
    const toggleImageSelection = useCallback((id: string) => setSelectedForBulk(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]), []);

    // ITALIANO: clic su una miniatura: se c'e' gia' una selezione multipla la aggiunge/toglie,
    //           altrimenti apre la foto. Legge la selezione da un REF, cosi' resta stabile e non fa
    //           ridisegnare tutte le card memorizzate ad ogni cambio di selezione.
    // ENGLISH: click on a thumbnail: if a multi-selection is in progress add/remove it, otherwise
    //          open the photo. Reads the selection from a REF, so it stays stable and does not force
    //          every memoized card to re-render on each selection change.
    const handleCardClick = useCallback((id: string) => {
        if (selectedForBulkRef.current.length > 0) {
            setSelectedForBulk(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
            soundManager.click();
        } else {
            setSelectedImageId(id);
        }
    }, []);

    // ITALIANO: Copia/incolla dei tag direttamente dalle MINIATURE (stesso "appunti"
    //           del visualizzatore). Copia = mette i tag della foto negli appunti;
    //           Incolla = li AGGIUNGE a un'altra foto senza doppioni.
    // ENGLISH: Copy/paste tags straight from the THUMBNAILS (same clipboard as the
    //          viewer). Copy = puts the photo's tags in the clipboard; Paste = ADDS
    //          them to another photo without duplicates.
    const handleCopyThumbTags = useCallback((img: any) => {
        if (!img.tags || img.tags.length === 0) { showNotification(t.noTagsToCopy, 'info'); return; }
        setCopiedTags([...img.tags]);
        showNotification(`${t.tagsCopiedNotif} (${img.tags.length})`, 'success');
        soundManager.click();
    }, [t]);
    const handlePasteThumbTags = useCallback((img: any) => {
        if (!copiedTags || copiedTags.length === 0) return;
        updateImageTags(img.id, [...new Set([...(img.tags || []), ...copiedTags])]);
        showNotification(t.tagsPastedNotif, 'success');
        soundManager.pop();
    }, [copiedTags, updateImageTags, t]);

    // ITALIANO: Seleziona TUTTE le foto visibili; se sono gia' tutte selezionate, le deseleziona.
    //           Agisce SOLO sulle visibili: le eventuali selezioni nascoste dalla ricerca restano
    //           intatte, esattamente come fa "Inverti selezione". Prima il tasto sostituiva l'intera
    //           selezione (o la svuotava del tutto), quindi con un filtro attivo bastava un clic per
    //           perdere senza preavviso decine di foto scelte a mano e non piu' visibili.
    // ENGLISH: Select ALL visible photos; if they are all already selected, deselect them. It acts
    //          ONLY on the visible ones: any selection hidden by the search stays untouched, exactly
    //          like "Invert selection". The button used to replace the whole selection (or empty it),
    //          so with a filter active one click silently dropped dozens of hand-picked photos that
    //          were no longer visible.
    const toggleSelectAll = () => {
        const visibleIds = displayedImages.map(img => img.id);
        const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedForBulk.includes(id));
        setSelectedForBulk(prev => {
            const visibleSet = new Set(visibleIds);
            const hiddenSelected = prev.filter(id => !visibleSet.has(id));
            return allSelected ? hiddenSelected : [...hiddenSelected, ...visibleIds];
        });
        soundManager.pop();
    };

    // ITALIANO: INVERTE la selezione sulle immagini VISIBILI (quelle mostrate/filtrate): quelle
    //           selezionate si deselezionano e viceversa. Utile dopo una ricerca per tag.
    // ENGLISH: INVERTS the selection over the VISIBLE images (those shown/filtered): selected ones
    //          get deselected and vice versa. Handy after a tag search.
    const invertSelection = () => {
        const visibleIds = displayedImages.map(img => img.id);
        setSelectedForBulk(prev => {
            const prevSet = new Set(prev);
            // ITALIANO: tengo eventuali selezioni non visibili (fuori dal filtro) e inverto le visibili.
            // ENGLISH: keep any non-visible selections (outside the filter) and invert the visible ones.
            const hiddenSelected = prev.filter(id => !visibleIds.includes(id));
            const invertedVisible = visibleIds.filter(id => !prevSet.has(id));
            return [...hiddenSelected, ...invertedVisible];
        });
        soundManager.pop();
    };

    // ITALIANO: Chiude il PROGETTO ATTUALE: toglie tutte le foto E cancella tutti i tag,
    //           riportando l'app come appena aperta. Se ci sono modifiche non salvate lo
    //           segnala prima. Non tocca i file su disco (le foto e i .txt restano dove sono).
    // ENGLISH: Closes the CURRENT PROJECT: removes all photos AND clears all tags, bringing
    //          the app back to its just-opened state. Warns first if there are unsaved
    //          changes. Does not touch files on disk (photos and .txt stay where they are).
    // ITALIANO: Chiusura vera e propria. Separata perche' la usano entrambe le strade:
    //           la conferma semplice (niente da salvare) e la finestra a tre scelte.
    // ENGLISH: The actual close. Split out because both paths use it: the simple
    //          confirmation (nothing to save) and the three-choice dialog.
    const closeProjectNow = () => {
        // ITALIANO: un progetto nuovo: i lavori del cestino ancora in corso non lo toccano (vedi progettoGenRef).
        // ENGLISH: a new project: trash jobs still running do not touch it (see progettoGenRef).
        progettoGenRef.current++;
        // ITALIANO: ferma un eventuale batch AI in corso, poi azzera TUTTO
        // ENGLISH: stop any running AI batch, then clear EVERYTHING
        aiCancelRequestedRef.current = true;
        setAiCancelRequested(true);
        aiAbortControllerRef.current?.abort();
        // ITALIANO: dal backup anti-crash escono le cartelle di questo progetto, non quelle mai
        //           riaperte dopo un crash (vedi backupDopoChiusura). Prima si cancellava tutto.
        // ENGLISH: this project's folders leave the crash backup, not those never reopened after a
        //          crash (see backupDopoChiusura). Everything used to be removed.
        backupDopoChiusura(localStorage, imagesRef.current, fotoChiuseRef.current.values());
        fotoChiuseRef.current.clear();
        // ITALIANO: libera le anteprime, altrimenti restano in memoria per tutta la sessione
        //           (con 2000 foto sono centinaia di MB che non tornano piu' indietro).
        // ENGLISH: free the thumbnails, otherwise they stay in memory for the whole session
        //          (with 2000 photos that is hundreds of MB that never come back).
        releaseThumbnails(images);
        // ITALIANO: anche quelle delle foto chiuse con la X o cancellate per sempre, che
        //           nell'elenco non ci sono piu'.
        // ENGLISH: also those of the photos closed with the X or deleted for good, which are no
        //          longer in the list.
        liberaAnteprimeProgetto();
        // ITALIANO: l'annullamento dello svuotamento appartiene a QUESTO progetto: se sopravvivesse,
        //           il tasto comparirebbe nel progetto successivo e ci infilerebbe le foto di
        //           quello chiuso. Le sue anteprime si liberano come tutte le altre.
        // ENGLISH: undoing the emptying belongs to THIS project: if it survived, the button would
        //          appear in the next project and push the closed project's photos into it.
        //          Its thumbnails are freed like all the others.
        if (ultimoSvuotamento) releaseThumbnails(ultimoSvuotamento.voci.map((v: any) => v.img));
        setUltimoSvuotamento(null);
        setImages([]);
        setGlobalTriggers([]);
        setSelectedForBulk([]);
        setStagedBulkTags([]);
        setCustomProjectTags([]);
        setDirHandle(null);
        setSelectedImageId(null);
        setCopiedTags(null);
        // ITALIANO: azzera anche la cronologia: senza questo, dopo aver chiuso il progetto un
        //           Ctrl+Z riportava indietro tutte le foto ma ormai scollegate dalla cartella,
        //           e i salvataggi successivi non toccavano piu' i file originali.
        // ENGLISH: also clear the undo history: without this, after closing the project a Ctrl+Z
        //          brought every photo back but detached from its folder, so later saves no longer
        //          touched the original files.
        setHistory([]);
        setHistoryIndex(-1);
        discoNotoRef.current.clear();
        soundManager.chime();
        showNotification(t.closeAllDone, 'success');
    };

    const handleCloseProject = () => {
        if (images.length === 0) return;
        // ITALIANO: stessa regola di handleSaveChanges: le foto nel cestino non si salvano, quindi
        //           non contano. Prima contavano qui e non li': "ci sono modifiche non salvate",
        //           poi "Salva e chiudi" rispondeva "Nessuna modifica da salvare."
        // ENGLISH: same rule as handleSaveChanges: trashed photos are never saved, so they do not
        //          count. They used to count here and not there: "there are unsaved changes",
        //          then "Save and close" answered "No changes to save."
        const hasUnsaved = images.some(img => !img.isTrashed && fotoDaSalvare(img, globalTriggers));

        // ITALIANO: Con modifiche non salvate si sceglie fra TRE strade: salvare e chiudere,
        //           chiudere buttando via le modifiche, oppure annullare.
        // ENGLISH: With unsaved changes the user picks between THREE paths: save and close,
        //          close discarding the changes, or cancel.
        if (hasUnsaved) {
            setSaveCloseDialog({ isOpen: true, isSaving: false });
            return;
        }

        // ITALIANO: Niente da salvare: basta la conferma semplice di sempre.
        // ENGLISH: Nothing to save: the usual simple confirmation is enough.
        setConfirmDialog({
            isOpen: true,
            title: t.closeAllTitle,
            message: t.closeAllMsg,
            onConfirm: () => {
                closeProjectNow();
                setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} });
            },
            onCancel: () => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} })
        });
    };

    // ITALIANO: Tasto VERDE "Salva e chiudi". Se il salvataggio fallisce (es. cartella non
    //           piu' accessibile) il progetto NON viene chiuso e la finestra resta aperta,
    //           cosi' non si perdono i tag: l'errore lo segnala gia' performSave.
    // ENGLISH: GREEN "Save and close" button. If saving fails (e.g. folder no longer
    //          reachable) the project is NOT closed and the dialog stays open, so no tags
    //          are lost: performSave already reports the error.
    const handleSaveAndCloseProject = async () => {
        // ITALIANO: un'esportazione sta ancora scrivendo: un salvataggio adesso le spegnerebbe la
        //           barra a meta' (vedi isSavingRef). La finestra resta aperta e si riprova dopo.
        // ENGLISH: an export is still writing: a save now would switch its bar off halfway (see
        //          isSavingRef). The dialog stays open and the user tries again later.
        if (isSavingRef.current) {
            showNotification(t.saveWaitForWrite, 'info');
            return;
        }
        setSaveCloseDialog({ isOpen: true, isSaving: true });
        let saved = false;
        try {
            saved = await handleSaveChanges();
        } catch (err) {
            // ITALIANO: senza questo, un errore imprevisto lasciava la finestra con i tre tasti
            //           disabilitati per sempre, bloccando l'app sopra il progetto.
            // ENGLISH: without this, an unexpected error left the dialog with all three buttons
            //          disabled forever, freezing the app on top of the project.
            console.error('[Chiudi progetto] salvataggio fallito:', err);
            showNotification(t.errorSaveGen || t.dirError, 'error');
            saved = false;
        }
        if (!saved) {
            setSaveCloseDialog({ isOpen: true, isSaving: false });
            return;
        }
        setSaveCloseDialog({ isOpen: false, isSaving: false });
        closeProjectNow();
        chiudiFinestraSeRichiesto();
    };

    // ITALIANO: "Chiudi senza salvare" e Annulla della finestra a tre scelte. Annulla dimentica anche
    //           che la domanda era nata dalla X: la finestra resta aperta.
    // ENGLISH: "Close without saving" and Cancel of the three-choice dialog. Cancel also forgets that
    //          the question came from the X: the window stays open.
    const handleDiscardAndClose = () => {
        setSaveCloseDialog({ isOpen: false, isSaving: false });
        closeProjectNow();
        chiudiFinestraSeRichiesto();
    };

    const handleCancelClose = () => {
        chiusuraFinestraRef.current = false;
        setSaveCloseDialog({ isOpen: false, isSaving: false });
    };

    // ITALIANO: Tagga la singola immagine via Gemini API
    // ENGLISH: Tag a single image via Gemini API
    const handleAITagSingle = useCallback(async (imageId: string): Promise<number> => {
        if (!aiEnabled) return 0;
        if (!geminiApiKey) { setIsApiKeyDialogOpen(true); return 0; }
        const img = images.find(i => i.id === imageId);
        if (!img) return 0;
        setIsAIBusy(true);
        try {
            const tags = await getGeminiTags(img.file, {
                apiKey: geminiApiKey,
                modelName: aiModel,
                maxTags: aiMaxTags,
                customPrompt: aiCustomPrompt,
            });
            // ITALIANO: Merge sui tag LIVE (via imagesRef), non sullo snapshot pre-richiesta:
            //           i tag modificati a mano durante l'attesa non vengono persi
            // ENGLISH: Merge against LIVE tags (via imagesRef), not the pre-request snapshot:
            //          tags edited manually while waiting are not lost
            const live = imagesRef.current.find(i => i.id === imageId);
            const baseTags: string[] = live ? live.tags : img.tags;
            const merged = [...new Set([...baseTags, ...tags])];
            // ITALIANO: si contano solo i tag che la foto riceve davvero (vedi countNewTagsIgnoringCase).
            // ENGLISH: only the tags the photo really gets are counted (see countNewTagsIgnoringCase).
            const added = countNewTagsIgnoringCase(baseTags, tags);
            updateImageTags(imageId, merged);
            soundManager.chime();
            showNotification(t.aiTagsGenerated.replace('{n}', String(added)), 'success');
            return added;
        } catch (e: any) {
            console.error('AI tag failed', e);
            const { kind, quotaGiorno } = classifyGeminiError(e);
            if (kind === 'invalid_key') setIsApiKeyDialogOpen(true);
            // ITALIANO: `invalid_key` e' il caso piu' frequente di tutti — la chiave sbagliata o
            //           scaduta — ed era l'unico che cadeva sul messaggio grezzo di Google, sempre
            //           in inglese, in tutte e 9 le lingue. La traduzione esisteva gia' (`aiKeyInvalid`,
            //           usata nella finestra della chiave): mancava solo qui.
            // ENGLISH: `invalid_key` is the most common case of all - a wrong or expired key - and it
            //          was the only one falling through to Google's raw message, always in English, in
            //          all 9 languages. The translation already existed (`aiKeyInvalid`, used in the
            //          key dialog): it was simply never used here.
            const friendly = kind === 'invalid_key'
                ? (t.aiKeyInvalid || 'API key not valid')
                : kind === 'billing_required'
                ? (t.aiBillingRequired || 'This model requires billing enabled on your Google Cloud project.')
                : kind === 'rate_limit'
                ? (quotaGiorno ? t.aiDailyQuota : (t.aiRateLimit || 'Rate limit exceeded. Wait a moment or upgrade tier.'))
                : kind === 'model_unavailable'
                ? (t.aiModelUnavailable || 'Model unavailable for your account.')
                // ITALIANO: Google sovraccarico e foto rifiutata dal filtro: frasi tradotte, non il
                //           JSON grezzo di Google (e niente suono o messaggio verde di successo).
                // ENGLISH: Google overloaded and photo refused by the filter: translated sentences,
                //          not Google's raw JSON (and no success chime or green message).
                : kind === 'busy'
                ? t.aiServerBusy
                : kind === 'blocked'
                ? t.aiResponseBlocked
                // ITALIANO: tutto il resto (rete assente, attesa scaduta, una richiesta che Google non
                //           accetta) mostrava il testo grezzo, in inglese in tutte le lingue: ora una
                //           frase tradotta. Una foto che non si puo' mandare (vuota, oltre 20 MB, in un
                //           formato illeggibile) lo dice. Il testo vero resta nella console (sopra).
                // ENGLISH: everything else (no network, timeout, a request Google does not accept)
                //          showed the raw text, in English in every language: now a translated
                //          sentence. A photo that cannot be sent (empty, over 20 MB, in an unreadable
                //          format) says so. The real text stays in the console (above).
                : e?.geminiKind === 'photo'
                ? t.aiPhotoNotSupported
                : t.aiRequestFailed;
            showNotification(`${t.aiError || 'AI Error'}: ${friendly}`, 'error');
            // ITALIANO: il modello non esiste piu': invece di lasciare l'AI rotta finche'
            //           qualcuno non va a cambiarla a mano, si cerca subito il sostituto.
            // ENGLISH: the model is gone: rather than leaving the AI broken until someone goes
            //          and changes it by hand, look for the replacement right away.
            if (kind === 'model_unavailable') setRiparaModello(n => n + 1);
            return 0;
        } finally {
            setIsAIBusy(false);
        }
    }, [aiEnabled, geminiApiKey, aiModel, aiMaxTags, aiCustomPrompt, images, t, updateImageTags]);

    // ITALIANO: Richiesta di annullamento del bulk tagging — viene letta dai cicli e dagli sleep.
    //           Aggiorna sia il ref (per il loop async) che lo state (per re-render del pulsante).
    // ENGLISH: Cancel request for bulk tagging — read by loops and sleeps.
    //          Updates both the ref (for the async loop) and state (to re-render the button).
    const handleCancelAITagging = useCallback(() => {
        aiCancelRequestedRef.current = true;
        setAiCancelRequested(true);
        // ITALIANO: Abortisce anche l'eventuale richiesta HTTP in volo (altrimenti su rete bloccata si resterebbe appesi)
        // ENGLISH: Also aborts any in-flight HTTP request (otherwise a stalled connection would hang forever)
        aiAbortControllerRef.current?.abort();
    }, []);

    // ITALIANO: Tagga tutte le immagini con throttle adattivo (mira aiRpm) + retry su rate-limit.
    //           Supporta skip immagini già taggate e annullamento via aiCancelRequestedRef.
    // ENGLISH: Tag every image with adaptive throttle (targets aiRpm) + retry on rate-limit.
    //          Supports skipping already-tagged images and cancel via aiCancelRequestedRef.
    const handleAITagAll = useCallback(async () => {
        if (!aiEnabled || images.length === 0 || isGlobalAITagging) return;
        if (!geminiApiKey) { setIsApiKeyDialogOpen(true); return; }
        aiCancelRequestedRef.current = false;
        setAiCancelRequested(false);
        // ITALIANO: Controller per abortire le richieste HTTP in volo quando l'utente annulla
        // ENGLISH: Controller to abort in-flight HTTP requests when the user cancels
        aiAbortControllerRef.current = new AbortController();
        const batchSignal = aiAbortControllerRef.current.signal;
        setIsGlobalAITagging(true);
        setGlobalAIProgress({ done: 0, total: images.length, ok: 0, errors: 0, skipped: 0 });
        // ITALIANO: Intervallo minimo tra le richieste in base alla RPM target dell'utente
        // ENGLISH: Minimum interval between requests based on user's target RPM
        const minIntervalMs = Math.max(1000, Math.floor(60000 / Math.max(1, aiRpm)));
        // ITALIANO: Sleep cancellabile — controlla aiCancelRequestedRef ad intervalli di 200ms
        // ENGLISH: Cancellable sleep — checks aiCancelRequestedRef every 200ms
        const cancellableSleep = async (ms: number): Promise<void> => {
            const step = 200;
            const end = Date.now() + ms;
            while (Date.now() < end) {
                if (aiCancelRequestedRef.current) return;
                const remaining = end - Date.now();
                if (remaining <= 0) return;
                await new Promise(r => setTimeout(r, Math.min(step, remaining)));
            }
        };
        let totalTagsAdded = 0;
        let okCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        let fatalAbort = false;
        let cancelled = false;
        // ITALIANO: foto di fila che non sono riuscite a raggiungere Google (vedi sotto).
        // ENGLISH: photos in a row that could not reach Google (see below).
        let reteConsecutivi = 0;
        try {
            for (let i = 0; i < images.length; i++) {
                if (aiCancelRequestedRef.current) { cancelled = true; break; }
                // ITALIANO: Lo snapshot fornisce solo l'ID; lo stato VIVO arriva da imagesRef —
                //           così skip e merge vedono le modifiche fatte dall'utente durante il batch
                // ENGLISH: The snapshot only provides the ID; LIVE state comes from imagesRef —
                //          so skip and merge see edits the user made during the batch
                const snapshotItem = images[i];
                const current = snapshotItem ? imagesRef.current.find(im => im.id === snapshotItem.id) : null;
                if (!current || current.isTrashed) {
                    // ITALIANO: Eliminata o nel cestino nel frattempo: non sprecare quota
                    // ENGLISH: Deleted or trashed meanwhile: don't waste quota
                    skippedCount++;
                    setGlobalAIProgress({ done: i + 1, total: images.length, ok: okCount, errors: errorCount, skipped: skippedCount });
                    continue;
                }
                // ITALIANO: Skip se richiesto e l'immagine ha già almeno un tag (stato live). Le
                //           trigger word non contano (vedi hasTagsBeyondTriggers): con una trigger
                //           impostata ogni foto risultava taggata e non ne partiva nessuna.
                // ENGLISH: Skip if requested and the image already has at least one tag (live state).
                //          Trigger words do not count (see hasTagsBeyondTriggers): with a trigger set
                //          every photo looked tagged and none was sent.
                // ITALIANO: una foto il cui .txt non si e' potuto leggere all'import ha dei tag su disco,
                //           anche se qui sembra senza (vedi txtNonLettoInVigore): si salta anche lei.
                // ENGLISH: a photo whose .txt could not be read at import has tags on disk, even if it
                //          looks untagged here (see txtNonLettoInVigore): it is skipped too.
                if (aiSkipTagged && ((Array.isArray(current.tags) && hasTagsBeyondTriggers(current.tags, globalTriggersRef.current)) || txtNonLettoInVigore(current))) {
                    skippedCount++;
                    console.log(`[AI] ${i + 1}/${images.length} ${current.file.name}: skipped (already tagged)`);
                    setGlobalAIProgress({ done: i + 1, total: images.length, ok: okCount, errors: errorCount, skipped: skippedCount });
                    continue;
                }

                const requestStart = Date.now();
                let success = false;
                // ITALIANO: la foto e' stata chiusa mentre la sua richiesta era in volo: si conta fra
                //           le saltate, come quella chiusa prima. Prima si contava fra le "taggate".
                // ENGLISH: the photo was closed while its request was in flight: it counts as skipped,
                //          like one closed before. It used to count as "tagged".
                let removedMidRequest = false;
                let erroreRete = false;
                // ITALIANO: Retry su rate-limit, max 2 tentativi extra con attesa progressiva
                // ENGLISH: Retry on rate-limit, max 2 extra attempts with progressive wait
                for (let attempt = 0; attempt < 3; attempt++) {
                    if (aiCancelRequestedRef.current) { cancelled = true; break; }
                    try {
                        const tags = await getGeminiTags(current.file, {
                            apiKey: geminiApiKey,
                            modelName: aiModel,
                            maxTags: aiMaxTags,
                            customPrompt: aiCustomPrompt,
                            signal: batchSignal,
                        });
                        // ITALIANO: Merge sui tag LIVE letti ORA — le modifiche manuali fatte
                        //           durante la richiesta (secondi) non vengono sovrascritte
                        // ENGLISH: Merge against LIVE tags read NOW — manual edits made during
                        //          the request (seconds) are not overwritten
                        const liveNow = imagesRef.current.find(im => im.id === current.id);
                        if (!liveNow) {
                            // ITALIANO: Rimossa durante la richiesta: ignora il risultato
                            // ENGLISH: Removed during the request: discard the result
                            console.log(`[AI] ${i + 1}/${images.length} ${current.file.name}: removed mid-batch, result discarded`);
                            removedMidRequest = true;
                            break;
                        }
                        const baseTags: string[] = Array.isArray(liveNow.tags) ? liveNow.tags : [];
                        const merged = [...new Set([...baseTags, ...tags])];
                        totalTagsAdded += countNewTagsIgnoringCase(baseTags, tags);
                        updateImageTags(current.id, merged);
                        success = true;
                        console.log(`[AI] ${i + 1}/${images.length} ${current.file.name}: ${tags.length} tags`);
                        break;
                    } catch (err: any) {
                        // ITALIANO: Se l'errore deriva dall'annullamento (abort), esci subito senza contarlo come errore
                        // ENGLISH: If the error comes from cancellation (abort), exit immediately without counting it as an error
                        if (aiCancelRequestedRef.current) { cancelled = true; break; }
                        const { kind, message, quotaGiorno } = classifyGeminiError(err);
                        console.warn(`[AI] ${i + 1}/${images.length} ${current.file.name} (attempt ${attempt + 1}): ${kind} — ${message}`);
                        if (kind === 'invalid_key') {
                            // ITALIANO: si apre la finestra della chiave, ma senza una riga di
                            //           spiegazione la taggatura in blocco si fermava in silenzio e
                            //           non era detto che si capisse perche'.
                            // ENGLISH: the key dialog opens, but with no line of explanation the bulk
                            //          tagging just stopped in silence and the reason was not obvious.
                            showNotification(`${t.aiError || 'AI Error'}: ${t.aiKeyInvalid || 'API key not valid'}`, 'error');
                            setIsApiKeyDialogOpen(true);
                            fatalAbort = true;
                            break;
                        }
                        if (kind === 'billing_required' || kind === 'model_unavailable') {
                            const friendly = kind === 'billing_required'
                                ? (t.aiBillingRequired || 'Model requires billing on your Google Cloud project.')
                                : (t.aiModelUnavailable || 'Model unavailable for your account.');
                            showNotification(`${t.aiError || 'AI Error'}: ${friendly}`, 'error');
                            // ITALIANO: la riparazione automatica era collegata solo al tagging di
                            //           una foto: qui, nel caso normale, non partiva mai.
                            // ENGLISH: the automatic repair was wired only to single-photo tagging:
                            //          here, in the normal case, it never started.
                            if (kind === 'model_unavailable') setRiparaModello(n => n + 1);
                            fatalAbort = true;
                            break;
                        }
                        // ITALIANO: la quota del GIORNO e' finita: riprovare fra 15 e 45 secondi
                        //           non serve, e ogni foto rimasta costava un minuto e tre richieste a
                        //           vuoto, per ore, con un riepilogo che non diceva il perche'. Ci si
                        //           ferma subito e lo si dice. Le foto gia' taggate restano.
                        // ENGLISH: the DAILY quota is used up: retrying in 15 and 45 seconds is
                        //          pointless, and every remaining photo cost a minute and three wasted
                        //          requests, for hours, with a summary that never said why. Stop at
                        //          once and say so. The photos already tagged stay tagged.
                        if (kind === 'rate_limit' && quotaGiorno) {
                            showNotification(`${t.aiError || 'AI Error'}: ${t.aiDailyQuota}`, 'error');
                            fatalAbort = true;
                            break;
                        }
                        // ITALIANO: Google sovraccarico (503/500) passa da solo: si riprova come per il
                        //           limite di frequenza. Una foto rifiutata ('blocked') invece no.
                        // ENGLISH: Google overloaded (503/500) passes on its own: retry as for the rate
                        //          limit. A refused photo ('blocked') does not.
                        if ((kind === 'rate_limit' || kind === 'busy') && attempt < 2) {
                            // ITALIANO: Backoff progressivo: 15s, 45s — cancellabile
                            // ENGLISH: Progressive backoff: 15s, 45s — cancellable
                            const backoff = attempt === 0 ? 15000 : 45000;
                            console.warn(`[AI] Rate limit, retry in ${backoff / 1000}s...`);
                            await cancellableSleep(backoff);
                            if (aiCancelRequestedRef.current) { cancelled = true; break; }
                            continue;
                        }
                        // ITALIANO: Errore non-fatale o ultimo tentativo fallito → segna come errore e prosegui.
                        //           Un errore senza nome e senza stato HTTP (rete assente, attesa
                        //           scaduta) vuol dire che Google non si e' raggiunto: non una foto
                        //           che non si puo' mandare, ne' una risposta di Google.
                        // ENGLISH: Non-fatal error or last attempt failed → record error and continue.
                        //          An unnamed error with no HTTP status (no network, timeout) means
                        //          Google was not reached: not a photo that cannot be sent, nor an
                        //          answer from Google.
                        if (kind === 'unknown' && typeof err?.status !== 'number' && err?.geminiKind !== 'photo') erroreRete = true;
                        break;
                    }
                }

                if (fatalAbort || cancelled) break;
                if (removedMidRequest) skippedCount++;
                else if (success) okCount++;
                else errorCount++;
                setGlobalAIProgress({ done: i + 1, total: images.length, ok: okCount, errors: errorCount, skipped: skippedCount });
                // ITALIANO: senza rete ogni foto falliva lo stesso, una dopo l'altra (con una
                //           connessione bloccata 90 secondi l'una, per ore), e alla fine il riepilogo
                //           diceva solo "Non riuscite: 300". Dopo tre foto di fila che non raggiungono
                //           Google ci si ferma e lo si dice. Le foto gia' taggate restano.
                // ENGLISH: with no network every photo failed anyway, one after the other (on a
                //          stalled connection 90 seconds each, for hours), and in the end the summary
                //          only said "Failed: 300". After three photos in a row that do not reach
                //          Google the run stops and says so. The photos already tagged stay.
                reteConsecutivi = erroreRete && !success && !removedMidRequest ? reteConsecutivi + 1 : 0;
                if (reteConsecutivi >= 3) {
                    showNotification(`${t.aiError || 'AI Error'}: ${t.aiNetworkStopped}`, 'error');
                    fatalAbort = true;
                    break;
                }

                // ITALIANO: Throttle adattivo — aspetta solo se la richiesta è stata più veloce del minimo
                // ENGLISH: Adaptive throttle — only wait if the request was faster than the minimum
                if (i < images.length - 1) {
                    const elapsed = Date.now() - requestStart;
                    const waitMs = Math.max(0, minIntervalMs - elapsed);
                    if (waitMs > 0) await cancellableSleep(waitMs);
                }
            }
            soundManager.chime();
            const successType: 'success' | 'info' | 'error' = cancelled
                ? 'info'
                : errorCount === 0 ? 'success' : (okCount > 0 ? 'info' : 'error');
            // ITALIANO: una frase intera, "finito" OPPURE "annullato", con i numeri dopo i due punti
            //           (si legge giusta anche con 1). Prima si incollavano pezzi e simboli, e un
            //           tagging annullato diceva "Annullato · Completato! · ✓ 2 · ✗ 0 · ...".
            //           Dopo un errore grave (chiave, fatturazione, modello) il riepilogo non si
            //           mostra: prendeva il posto del messaggio d'errore appena comparso, in verde.
            // ENGLISH: one whole sentence, "finished" OR "cancelled", with the numbers after the
            //          colon (it reads right with 1 too). Pieces and symbols used to be glued, and a
            //          cancelled run said "Cancelled · Completed! · ✓ 2 · ✗ 0 · ...". After a fatal
            //          error (key, billing, model) the summary is not shown: it used to replace the
            //          error message that had just appeared, in green.
            const modello = cancelled
                ? (t.aiBatchCancelled || 'AI tagging cancelled. Photos tagged: {ok}. Failed: {err}. Skipped: {skip}. Tags added: {n}.')
                : (t.aiBatchDone || 'AI tagging finished. Photos tagged: {ok}. Failed: {err}. Skipped: {skip}. Tags added: {n}.');
            const summary = modello.replace('{ok}', String(okCount)).replace('{err}', String(errorCount)).replace('{skip}', String(skippedCount)).replace('{n}', String(totalTagsAdded));
            if (!fatalAbort) showNotification(summary, successType);
        } finally {
            aiCancelRequestedRef.current = false;
            setAiCancelRequested(false);
            setIsGlobalAITagging(false);
            aiAbortControllerRef.current = null;
        }
    }, [aiEnabled, geminiApiKey, aiModel, aiMaxTags, aiCustomPrompt, aiRpm, aiSkipTagged, images, isGlobalAITagging, t, updateImageTags]);

    // ITALIANO: Verifica la API key chiedendo l'elenco dei modelli, NON una risposta a un
    //           modello preciso: cosi' una chiave buona resta buona anche il giorno che
    //           Google chiude il modello di riserva. Vedi verifyGeminiApiKey.
    // ENGLISH: Verify the API key by asking for the model list, NOT for an answer from one
    //          specific model: a good key stays good even the day Google retires the
    //          fallback model. See verifyGeminiApiKey.
    const handleVerifyApiKey = useCallback(async () => {
        const key = tempApiKey.trim();
        if (!key) { setApiKeyError(t.aiKeyEmpty || 'Please enter a key'); return; }
        setIsVerifyingApiKey(true);
        setApiKeyError('');
        try {
            const result = await verifyGeminiApiKey(key);
            if (result.ok) {
                setGeminiApiKey(key);
                setIsApiKeyDialogOpen(false);
                soundManager.chime();
                showNotification(t.aiKeySaved || 'API Key verified and saved', 'success');
            } else {
                // ITALIANO: la chiave sbagliata e' il primo caso, con la sua frase tradotta. Prima
                //           cadeva sul testo grezzo del servizio: i primi 200 caratteri della risposta
                //           JSON di Google, o l'inglese fisso "too short" premendo Invio con una
                //           chiave corta. Anche gli errori sconosciuti (rete assente, attesa scaduta,
                //           una richiesta che Google non accetta) hanno una frase tradotta: il loro
                //           testo grezzo va solo nella console.
                // ENGLISH: a wrong key is the first case, with its translated sentence. It used to
                //          fall to the service's raw text: the first 200 characters of Google's JSON
                //          answer, or the fixed English "too short" when pressing Enter with a short
                //          key. Unknown errors (no network, timeout, a request Google does not accept)
                //          get a translated sentence too: their raw text goes to the console only.
                if (result.errorKind === 'unknown') console.warn('[AI] Verifica della chiave non riuscita:', result.error);
                const friendly = result.errorKind === 'invalid_key'
                    ? (t.aiKeyInvalid || 'API Key invalid')
                    : result.errorKind === 'billing_required'
                    ? (t.aiBillingRequired || 'Billing required on your Google Cloud project.')
                    : result.errorKind === 'rate_limit'
                    ? (t.aiRateLimit || 'Rate limit (key valid but throttled).')
                    : result.errorKind === 'busy'
                    ? t.aiServerBusy
                    : result.errorKind === 'model_unavailable'
                    ? (t.aiModelUnavailable || 'Model unavailable for your account.')
                    : t.aiRequestFailed;
                setApiKeyError(friendly);
            }
        } catch (e: any) {
            console.warn('[AI] Verifica della chiave non riuscita:', e);
            setApiKeyError(t.aiRequestFailed);
        } finally {
            setIsVerifyingApiKey(false);
        }
    }, [tempApiKey, t]);
    
    const applyBulkTags = () => {
        // ITALIANO: applico i tag SOLO alle foto selezionate e NON cestinate. La guardia !isTrashed
        //           e' una seconda rete: anche se un id cestinato restasse per errore nella
        //           selezione, non gli si scrivono tag (e quindi non finiscono nel suo .txt).
        // ENGLISH: apply tags ONLY to selected and NON-trashed photos. The !isTrashed guard is a
        //          safety net: even if a trashed id lingered in the selection, no tags are written
        //          to it (so none reach its .txt).
        // ITALIANO: si contano solo i tag che almeno una foto riceve davvero e le foto che cambiano
        //           davvero (a parte le maiuscole, come countNewTagsIgnoringCase). Prima si contavano
        //           i tag messi nel pannello e tutte le foto selezionate: 5 foto che avevano gia'
        //           "1girl" davano "Tag aggiunti: 1. Foto interessate: 5." senza che cambiasse niente.
        // ENGLISH: only the tags at least one photo really gets and the photos that really change
        //          are counted (apart from case, as countNewTagsIgnoringCase). The staged tags and all
        //          the selected photos used to be counted: 5 photos already holding "1girl" gave "Tags
        //          added: 1. Photos affected: 5." with nothing changed.
        const daCambiare = new Set<string>();
        const tagNuovi = new Set<string>();
        for (const img of images) {
            if (!selectedForBulk.includes(img.id) || img.isTrashed) continue;
            const mancanti = stagedBulkTags.filter(tag => countNewTagsIgnoringCase(img.tags, [tag]) > 0);
            if (mancanti.length === 0) continue;
            daCambiare.add(img.id);
            for (const tag of mancanti) tagNuovi.add(tag.toLowerCase());
        }
        if (daCambiare.size === 0) {
            // ITALIANO: niente da aggiungere: nessun passo vuoto nella cronologia, nessun suono di
            //           successo, e il pannello si chiude come sempre.
            // ENGLISH: nothing to add: no empty step in the history, no success chime, and the panel
            //          closes as always.
            showNotification(t.bulkTagsNothingNew, 'info');
            setStagedBulkTags([]);
            setSelectedForBulk([]);
            return;
        }
        setImages(prev => prev.map(img => {
            if (daCambiare.has(img.id) && !img.isTrashed) {
                const combinedTags = uniqueTagsIgnoringCase([...img.tags, ...stagedBulkTags], globalTriggers);
                // ITALIANO: stesso ordine di tutto il resto: trigger prima, poi alfabetico
                // ENGLISH: same order as everywhere else: triggers first, then alphabetical
                const orderedTags = [
                    ...globalTriggers.filter(t => combinedTags.includes(t)),
                    ...combinedTags.filter(t => !globalTriggers.includes(t)).sort((a, b) => a.localeCompare(b))
                ];
                return { ...img, tags: orderedTags };
            }
            return img;
        }));
        soundManager.chime();
        showNotification(t.bulkTagsAdded.replace('{tags}', String(tagNuovi.size)).replace('{images}', String(daCambiare.size)), "success");
        setStagedBulkTags([]);
        // ITALIANO: finito il lavoro si deselezionano le immagini, e cosi' il pannello si chiude
        //           da solo (compare solo quando c'e' almeno un'immagine selezionata). Prima
        //           restava aperto con le foto ancora selezionate, e al clic successivo i tag
        //           venivano riapplicati alle stesse immagini senza accorgersene.
        // ENGLISH: once done the images are deselected, which closes the panel by itself (it only
        //          shows while at least one image is selected). It used to stay open with the
        //          photos still selected, so the next click silently re-applied tags to them.
        setSelectedForBulk([]);
    };

    const currentIndex = lightboxImages.findIndex(img => img.id === selectedImageId);
    const handleNext = () => { if (currentIndex < lightboxImages.length - 1) { setSlideDirection('left'); setSelectedImageId(lightboxImages[currentIndex + 1].id); } };
    const handlePrev = () => { if (currentIndex > 0) { setSlideDirection('right'); setSelectedImageId(lightboxImages[currentIndex - 1].id); } };

    const handleGlobalTagsChange = (newGlobalTags: string[]) => {
        const added = newGlobalTags.filter(t => !globalTriggers.includes(t));
        const removed = globalTriggers.filter(t => !newGlobalTags.includes(t));
        globalTriggersRef.current = newGlobalTags;
        setGlobalTriggers(newGlobalTags);
        if (images.length > 0) {
            setImages(prev => prev.map(img => {
                let updatedTags = [...img.tags];
                added.forEach(tag => { if (!updatedTags.includes(tag)) updatedTags.unshift(tag); });
                removed.forEach(tag => { updatedTags = updatedTags.filter(t => t !== tag); });
                // ITALIANO: la trigger "OHWX" su una foto che ha "ohwx" non diventa un secondo tag.
                // ENGLISH: the trigger "OHWX" on a photo that has "ohwx" does not become a second tag.
                updatedTags = uniqueTagsIgnoringCase(updatedTags, newGlobalTags);
                
                const orderedTags = [
                    ...newGlobalTags.filter(t => updatedTags.includes(t)),
                    ...updatedTags.filter(t => !newGlobalTags.includes(t))
                ];
                
                return { ...img, tags: orderedTags };
            }));
        }
    };

    useEffect(() => { soundManager.enabled = soundEnabled; }, [soundEnabled]);

    // ITALIANO: La domanda arriva DOPO la scelta della lingua, mai insieme: due finestre
    //           sovrapposte al primo avvio sono un muro. Se la lingua non e' ancora stata
    //           scelta l'effetto non fa nulla e ripassa quando cambia showLangPicker.
    // ENGLISH: The question comes AFTER the language choice, never alongside it: two stacked
    //          dialogs on a first run are a wall. If the language has not been picked yet the
    //          effect does nothing and runs again when showLangPicker changes.
    useEffect(() => {
        // ITALIANO: tutte le uscite restituiscono la stessa pulizia. Con uscite anticipate "nude"
        //           il controllo dei tipi si lamenta che non tutti i rami restituiscono un valore.
        // ENGLISH: every exit returns the same cleanup. With bare early returns the type check
        //          complains that not all code paths return a value.
        let vivo = true;
        const pulisci = () => { vivo = false; };
        if (!apiElectron || typeof apiElectron.checkForUpdate !== 'function') return pulisci;
        if (showLangPicker) return pulisci;
        if (updateCheckChoice === null) { setUpdateAskOpen(true); return pulisci; }
        if (updateCheckChoice !== 'on') return pulisci;
        (async () => {
            try {
                const esito = await apiElectron.checkForUpdate();
                if (vivo && esito && esito.versione) setUpdateFound(esito);
            } catch (_) { /* senza rete non si dice niente / stays quiet when offline */ }
        })();
        return pulisci;
    }, [updateCheckChoice, showLangPicker]);

    // ITALIANO: Registra la risposta. Un solo punto che scrive, cosi' lo stato in memoria e
    //           quello su disco non possono divergere.
    // ENGLISH: Records the answer. A single writing point, so the in-memory state and the
    //          stored one cannot drift apart.
    const rispondiAggiornamenti = useCallback((scelta: 'on' | 'off') => {
        try { localStorage.setItem('updateCheck', scelta); } catch (_) { /* ignore */ }
        setUpdateCheckChoice(scelta);
        setUpdateAskOpen(false);
    }, []);
    useEffect(() => {
        const initAudio = () => { soundManager.init(); document.removeEventListener('click', initAudio); };
        document.addEventListener('click', initAudio);
        return () => document.removeEventListener('click', initAudio);
    }, []);
    useEffect(() => {
        function handleClickOutside(event: any) {
            if (settingsRef.current && !settingsRef.current.contains(event.target)) setIsSettingsOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // ITALIANO: Quanto resta su la schermata di caricamento = il MAGGIORE fra due tempi:
    //             - un minimo di 3 secondi, cosi' non lampeggia via quando l'app e' gia' pronta;
    //             - il tempo che serve davvero a caricare, se e' piu' lungo.
    //           Finche' l'app non e' pronta la barra si ferma al 95%: arriva al 100% solo quando
    //           c'e' davvero tutto, cosi' non dice il falso.
    //           Prima la barra avanzava a scatti casuali e spariva in poco piu' di un secondo,
    //           senza alcun legame con il caricamento reale.
    // ENGLISH: How long the loading screen stays = the LONGER of two times:
    //            - a 3 second minimum, so it does not flash past when the app is already ready;
    //            - the time loading actually takes, when that is longer.
    //          Until the app is ready the bar stops at 95%: it only reaches 100% once everything
    //          really is there, so it never tells a lie.
    //          It used to advance in random jumps and vanish in barely over a second, with no
    //          connection to the real loading at all.
    const SPLASH_MIN_MS = 3000;
    const appPronta = paginaCaricata && chiaveApiCaricata;
    // ITALIANO: il momento di inizio sta in un ref, NON in una variabile dentro l'effetto. L'effetto
    //           dipende da appPronta e quindi si ri-crea quando l'app diventa pronta: se il tempo di
    //           inizio ripartiva da li', la barra tornava visibilmente a 0% e lo splash restava altri
    //           3 secondi interi. Col ref l'inizio e' fissato una volta sola, al lancio.
    // ENGLISH: the start time lives in a ref, NOT in a variable inside the effect. The effect depends
    //          on appPronta and so re-creates when the app turns ready: if the start time restarted
    //          there, the bar visibly fell back to 0% and the splash stayed a further full 3 seconds.
    //          With the ref the start is fixed once, at launch.
    const splashInizioRef = useRef<number | null>(null);
    useEffect(() => {
        if (!showSplash) return undefined;
        // ITALIANO: al PRIMO avvio la scelta lingua (z sopra) copre il caricamento. Se il conto dei
        //           3s partisse dal lancio, aspettando sul picker il caricamento finirebbe dietro e
        //           non si vedrebbe piu'. Quindi finche' il picker e' aperto il caricamento resta in
        //           attesa: il conto parte solo alla sua chiusura.
        // ENGLISH: on FIRST launch the language picker (higher z) covers the splash. If the 3s count
        //          started at launch, lingering on the picker would spend the splash behind it and it
        //          would never show. So while the picker is open the splash waits: the count starts
        //          only when the picker closes.
        if (showLangPicker) return undefined;
        if (splashInizioRef.current === null) splashInizioRef.current = Date.now();
        const interval = setInterval(() => {
            const trascorso = Date.now() - (splashInizioRef.current || Date.now());
            const perTempo = Math.min(100, (trascorso / SPLASH_MIN_MS) * 100);
            setSplashProgress(appPronta ? perTempo : Math.min(95, perTempo));
            if (trascorso >= SPLASH_MIN_MS && appPronta) {
                setSplashProgress(100);
                clearInterval(interval);
                setShowSplash(false);
            }
        }, 50);
        return () => clearInterval(interval);
    }, [showSplash, appPronta, showLangPicker]);

    return (
        <div className={`h-screen transition-colors duration-500 overflow-hidden w-full ${isDarkMode ? 'dark' : ''}`}>
            {/* ITALIANO: Scelta lingua al PRIMO avvio — sta sopra a tutto (anche allo splash).
                          Usa i nomi nelle lingue native: niente immagini remote, funziona offline. */}
            {/* ENGLISH: FIRST-run language picker — sits above everything (splash included).
                         Uses native language names: no remote images, works offline. */}
            {showLangPicker && (
                <div className={`fixed inset-0 z-[10000] flex items-center justify-center p-6 transition-colors duration-500 ${isDarkMode ? 'bg-violet-950' : 'bg-violet-50'}`}>
                    <div className={`relative w-full max-w-xl p-8 ${isDarkMode ? 'bg-gray-900/70 border-gray-700/50' : 'bg-white/80 border-gray-200'} backdrop-blur-xl border shadow-2xl rounded-3xl flex flex-col gap-7 animate-in fade-in zoom-in duration-500`}>
                        <div className="flex flex-col items-center gap-3 text-center">
                            <img src="./logo.png" alt="" className="w-16 h-16 object-contain drop-shadow-md" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            <h1 className={`text-2xl font-bold bg-clip-text text-transparent ${isDarkMode ? 'bg-gradient-to-r from-white to-gray-300' : 'bg-gradient-to-r from-gray-900 to-gray-600'}`}>Images Tag Manager for LORAs</h1>
                            <p className={`text-[10px] uppercase tracking-widest font-semibold ${isDarkMode ? 'text-violet-400' : 'text-violet-600'}`}>{tPending.langPickerTitle}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2.5">
                            {APP_LANGUAGES.map((l) => (
                                <button
                                    key={l.code}
                                    onClick={() => { setPendingLang(l.code); soundManager.pop(); }}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 [will-change:transform] [backface-visibility:hidden] [transform:translateZ(0)] ${pendingLang === l.code
                                        ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white border-transparent shadow-[0_0_16px_2px_rgba(139,92,246,0.45)] [mask-image:linear-gradient(to_right,transparent,black_1.5px,black_calc(100%-1.5px),transparent)]'
                                        : (isDarkMode ? 'bg-violet-900/40 border-violet-800/50 text-gray-300 hover:bg-violet-800/50 hover:border-violet-500/50' : 'bg-white/70 border-gray-200 text-gray-700 hover:bg-violet-50 hover:border-violet-300')}`}
                                >
                                    <img src={flagUri(l.flag)} alt="" className="w-5 h-5 rounded-full object-cover shadow-sm shrink-0" />
                                    <span className="truncate">{l.label}</span>
                                </button>
                            ))}
                        </div>
                        {/* ITALIANO: Conferma esplicita — l'etichetta è già nella lingua selezionata.
                            ENGLISH: Explicit confirmation — the label is already in the selected language. */}
                        <button
                            onClick={() => {
                                setLang(pendingLang);
                                try { localStorage.setItem('langChosen', '1'); } catch (_) { /* ignore */ }
                                setShowLangPicker(false);
                                soundManager.chime();
                            }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-bold shadow-lg transition-all active:scale-95"
                        >
                            <Check size={18} />
                            {tPending.confirm}
                        </button>
                        <p className={`text-[11px] text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            {tPending.langPickerHint}
                        </p>
                    </div>
                </div>
            )}
            {/* ITALIANO: Schermata di caricamento con la STESSA veste della scelta lingua: sfondo
                          viola sfumato e finestra centrale sfocata con bordo e angoli tondi.
                          Prima era una pagina piatta senza finestra. */}
            {/* ENGLISH: Loading screen wearing the SAME look as the language picker: purple gradient
                         background and a centred blurred card with border and rounded corners.
                         It used to be a flat page with no card. */}
            {showSplash && (
                <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-6 transition-colors duration-500 ${isDarkMode ? 'bg-violet-950' : 'bg-violet-50'}`}>
                    {/* ITALIANO: Riquadro sullo stile della schermata di avvio di Windows: tinta piena
                                  in sfumatura, angoli da 16px e nessun bordo (il bordo si vedeva come
                                  un filo chiaro). Tutta la tavolozza e' sul VIOLA: niente toni che
                                  tirano all'azzurro. */}
                    {/* ENGLISH: Card in the style of the Windows startup screen: a solid gradient, 16px
                                 corners and no border (a border showed as a light hairline). The whole
                                 palette stays VIOLET: no tones drifting towards light blue. */}
                    <div className={`relative w-full max-w-xl p-10 overflow-hidden shadow-2xl rounded-2xl flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500 ${isDarkMode
                        ? 'bg-gradient-to-br from-violet-950 to-violet-900'
                        : 'bg-gradient-to-br from-white to-violet-50'}`}>
                        {/* ITALIANO: il logo "respira" come nella schermata di Windows (vedi .logo-pulse) */}
                        {/* ENGLISH: the logo "breathes" like on the Windows screen (see .logo-pulse) */}
                        <div className="relative flex items-center justify-center">
                            <img src="./logo.png" alt="Logo" className="logo-pulse w-28 h-28 object-contain relative z-10" onError={(e) => { e.currentTarget.src = './icon.png'; e.currentTarget.onerror = (e2) => { const target = (e2 as Event).currentTarget as HTMLImageElement | null; if (target) target.style.display = 'none'; const fallback = document.getElementById('fallback-splash-logo'); if (fallback) fallback.classList.remove('hidden'); } }} />
                            <div id="fallback-splash-logo" className={`logo-pulse p-6 rounded-3xl hidden relative z-10 ${isDarkMode ? 'bg-violet-500/10 shadow-[0_0_40px_rgba(139,92,246,0.25)]' : 'bg-violet-50 shadow-xl'}`}>
                                <Tag size={72} className="text-violet-400" strokeWidth={1.5} />
                            </div>
                        </div>
                        <div className="text-center">
                            <h1 className={`text-3xl font-black tracking-tight bg-clip-text text-transparent ${isDarkMode ? 'bg-gradient-to-r from-white to-violet-300' : 'bg-gradient-to-r from-gray-900 to-violet-600'}`}>
                                {t.appTitle}
                            </h1>
                            {/* ITALIANO: niente sottotitolo "For LORAs": il titolo lo contiene gia'
                                          ("Images Tag Manager for LORAs"), era scritto due volte. */}
                            {/* ENGLISH: no "For LORAs" subtitle: the title already contains it
                                         ("Images Tag Manager for LORAs"), it was written twice. */}
                            <p className={`mt-3 text-xs font-semibold tracking-wide ${isDarkMode ? 'text-violet-300' : 'text-violet-500'}`}>
                                v{appVersion}
                            </p>
                        </div>
                        <div className={`w-64 h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-violet-950' : 'bg-violet-100'}`}>
                            <div
                                className="h-full bg-violet-500 transition-all duration-100 ease-out"
                                style={{ width: `${splashProgress}%` }}
                            />
                        </div>
                        {/* ITALIANO: qui c'era la nota sull'antivirus. Tolta su richiesta: la schermata di
                                      avvio dura pochi secondi e quel testo la appesantiva. L'avviso resta
                                      dove c'e' il tempo di leggerlo, cioe' nella pagina di benvenuto
                                      dell'installer (build/lang-strings.nsh, AV_NOTICE_TEXT). */}
                        {/* ENGLISH: the antivirus note used to be here. Removed on request: the startup
                                     screen only lasts a few seconds and that text weighed it down. The
                                     notice stays where there is time to read it, i.e. the installer's
                                     welcome page (build/lang-strings.nsh, AV_NOTICE_TEXT). */}
                        {/* ITALIANO: Il copyright sta in una fascia a se', attaccata al fondo della finestra:
                                      i margini negativi la fanno arrivare fino ai bordi e gli angoli bassi
                                      seguono quelli della finestra. Viola PIU' SCURO del riquadro, cosi' si
                                      stacca senza introdurre azzurro. Apre il profilo GitHub. */}
                        {/* ENGLISH: The copyright sits in its own strip welded to the bottom of the card:
                                     negative margins carry it to the edges and its bottom corners follow the
                                     card's. A DARKER violet than the card, so it separates without bringing
                                     any light blue in. It opens the GitHub profile. */}
                        <button
                            onClick={() => {
                                const api = (window as any).electronAPI;
                                if (api && typeof api.openExternal === 'function') api.openExternal(GITHUB_PROFILE);
                                else window.open(GITHUB_PROFILE, '_blank', 'noopener');
                            }}
                            title="github.com/xXIlRizzoXx"
                            className={`self-stretch -mx-10 -mb-10 mt-2 px-10 py-3 rounded-b-2xl text-xs font-semibold tracking-wide transition-colors ${isDarkMode
                                ? 'bg-violet-950 text-violet-200 hover:bg-violet-900 hover:text-white'
                                : 'bg-violet-200 text-violet-900 hover:bg-violet-300'}`}
                        >
                            © xXIlRizzoXx
                        </button>
                    </div>
                </div>
            )}
            
            {toast.show && <Toast id={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(prev => ({ ...prev, show: false }))} />}
            {/* ITALIANO: Finestre di dialogo per conferme e riepilogo importazione */}
            {/* ENGLISH: Dialog boxes for confirmations and import summary */}
            <ExportChoiceDialog
                isOpen={!!exportChoice}
                riepilogo={exportChoice ? exportChoice.riepilogo : null}
                t={t}
                isDarkMode={isDarkMode}
                onCancel={() => setExportChoice(null)}
                onConfirm={avviaExport}
            />
            <UpdateDialog
                isOpen={updateAskOpen}
                title={t.updateAskTitle}
                message={t.updateAskMsg}
                confirmLabel={t.updateAskYes}
                cancelLabel={t.updateAskNo}
                onConfirm={() => rispondiAggiornamenti('on')}
                onCancel={() => rispondiAggiornamenti('off')}
                isDarkMode={isDarkMode}
            />
            <UpdateDialog
                isOpen={!!updateFound}
                title={t.updateFoundTitle}
                message={t.updateFoundMsg.replace('{current}', appVersion).replace('{latest}', updateFound ? updateFound.versione : '')}
                confirmLabel={t.updateOpenPage}
                cancelLabel={t.updateLater}
                onConfirm={() => {
                    if (updateFound && apiElectron && typeof apiElectron.openExternal === 'function') apiElectron.openExternal(updateFound.pagina);
                    setUpdateFound(null);
                }}
                onCancel={() => setUpdateFound(null)}
                isDarkMode={isDarkMode}
            />
            <CustomConfirmDialog isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={confirmDialog.onCancel} t={t} isDarkMode={isDarkMode} />
            {/* ITALIANO: area di RILASCIO che appare mentre si trascinano file sopra la finestra. */}
            {/* ENGLISH: DROP overlay shown while files are dragged over the window. */}
            {isDragging && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center bg-indigo-950/70 backdrop-blur-sm pointer-events-none animate-in fade-in">
                    <div className="flex flex-col items-center gap-4 px-12 py-10 rounded-3xl border-4 border-dashed border-indigo-400 bg-indigo-900/40 shadow-2xl">
                        <ImageIcon size={56} className="text-indigo-300" />
                        <p className="text-xl font-bold text-white">{t.dropImagesHere}</p>
                        <p className="text-sm text-indigo-200">{t.dropReleaseHint}</p>
                    </div>
                </div>
            )}

            <TagFileEditor
                isOpen={isTagEditorOpen}
                onClose={() => setIsTagEditorOpen(false)}
                t={t}
                isDarkMode={isDarkMode}
                lang={lang}
                showNotification={showNotification}
                onFileSaved={handleTagEditorSaved}
                onDirtyChange={segnaEditorSporco}
                projectTags={allUniqueTags}
                onImportTagsToProject={(tagsFromEditor: string[]) => {
                    // ITALIANO: i tag aperti/importati nell'editor entrano anche nella palette del
                    //           progetto (riquadro di selezione in blocco), senza doppioni.
                    // ENGLISH: tags opened/imported in the editor also enter the project palette
                    //          (bulk-selection panel), without duplicates.
                    const puliti = [...new Set(tagsFromEditor.map(s => String(s).trim()).filter(Boolean))];
                    if (puliti.length > 0) setCustomProjectTags(prev => [...new Set([...prev, ...puliti])]);
                }}
            />
            <SaveBeforeCloseDialog
                isOpen={saveCloseDialog.isOpen}
                isSaving={saveCloseDialog.isSaving}
                title={t.closeAllTitle}
                message={t.closeAllUnsavedMsg}
                onSave={handleSaveAndCloseProject}
                onDiscard={handleDiscardAndClose}
                onCancel={handleCancelClose}
                t={t}
                isDarkMode={isDarkMode}
            />
            <ImportSummaryDialog isOpen={importSummary.isOpen} summary={importSummary.summary} onConfirm={() => processImportData(importSummary.pendingData.imgFiles, importSummary.pendingData.txtFiles, importSummary.pendingData.handle, importSummary.pendingData.folderOf, importSummary.pendingData.relPathOf, importSummary.pendingData.pathOf, importSummary.pendingData.cartellaRelOf)} onCancel={() => { setImportSummary({ isOpen: false, summary: null, pendingData: null }); if (folderInputRef.current) folderInputRef.current.value = ''; }} t={t} isDarkMode={isDarkMode} />

            {/* ITALIANO: Dialog inserimento / verifica API Key Gemini */}
            {/* ENGLISH: Gemini API Key entry / verification dialog */}
            {isApiKeyDialogOpen && (
                <div className={`fixed inset-0 z-[400] flex items-center justify-center p-4 ${isDarkMode ? 'bg-black/80' : 'bg-gray-900/50'} backdrop-blur-sm animate-in fade-in`}>
                    <div className={`w-full max-w-md p-6 rounded-3xl shadow-2xl border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} flex flex-col gap-4`}>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-500 rounded-xl">
                                <KeyRound size={24} />
                            </div>
                            <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t.apiKeyTitle || 'API Key Gemini'}</h2>
                        </div>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t.apiKeyDesc || 'Per usare Gemini è necessaria una API key gratuita di Google AI Studio.'}</p>
                        <div className={`p-3 rounded-xl text-xs ${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                            <p className="mb-2"><strong>{t.apiKeyHowTo || 'Come ottenerla:'}</strong></p>
                            <ol className="list-decimal pl-4 space-y-1">
                                <li><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">{t.apiKeyStep1 || 'Vai su Google AI Studio'}</a></li>
                                <li>{t.apiKeyStep2 || 'Accedi col tuo account Google'}</li>
                                <li>{t.apiKeyStep3 || 'Clicca su "Create API key"'}</li>
                                <li>{t.apiKeyStep4 || 'Copia e incolla qui sotto'}</li>
                            </ol>
                        </div>
                        <input
                            type="password"
                            value={tempApiKey}
                            onChange={(e) => { setTempApiKey(e.target.value); setApiKeyError(''); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !isVerifyingApiKey) handleVerifyApiKey(); }}
                            placeholder={t.apiKeyPlaceholder || 'Incolla qui la tua API Key...'}
                            autoComplete="off"
                            spellCheck={false}
                            className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                        />
                        {apiKeyError && (
                            <div className={`text-xs rounded-lg px-3 py-2 ${isDarkMode ? 'bg-red-900/30 text-red-400 border border-red-800/50' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                {apiKeyError}
                            </div>
                        )}
                        <div className="flex justify-end gap-3 mt-1">
                            <button
                                onClick={() => { setIsApiKeyDialogOpen(false); if (!geminiApiKey) setAiEnabled(false); }}
                                disabled={isVerifyingApiKey}
                                className={`px-4 py-2 rounded-xl font-medium transition-colors ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                            >
                                {t.cancel || 'Annulla'}
                            </button>
                            <button
                                onClick={handleVerifyApiKey}
                                disabled={isVerifyingApiKey || tempApiKey.trim().length < 20}
                                className="px-4 py-2 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-colors shadow-md flex items-center gap-2"
                            >
                                {isVerifyingApiKey && <Loader2 size={14} className="animate-spin" />}
                                {isVerifyingApiKey ? (t.aiKeyVerifying || 'Verifica in corso…') : (t.apiKeySaveButton || 'Verifica e salva')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <input type="file" {...{webkitdirectory: "true", directory: "true"} as any} multiple ref={folderInputRef} className="hidden" onChange={handleFolderUploadFallback} />
            {/* ITALIANO: Selettore per singole immagini + relativi .txt (punto 12) */}
            {/* ENGLISH: Picker for individual images + their .txt files (item 12) */}
            {/* ITALIANO: accept solo immagini = nel selettore i file di testo NON si vedono */}
            {/* ENGLISH: images-only accept = text files are NOT shown in the picker */}
            <input type="file" accept="image/*" multiple ref={imagesInputRef} className="hidden" onChange={handleImagesUpload} />
            
            {isTrashOpen && (
                <div className={`fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6 ${isDarkMode ? 'bg-black/80' : 'bg-gray-900/50'} backdrop-blur-sm animate-in fade-in`}>
                    <div className={`w-full max-w-5xl h-[80vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className={`p-4 md:p-6 border-b flex justify-between items-center ${isDarkMode ? 'border-gray-800 bg-gray-800/50' : 'border-gray-100 bg-gray-50/50'}`}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-xl">
                                    <Trash2 size={24} />
                                </div>
                                <div>
                                    <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t.trash}</h2>
                                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t.trashCount.replace('{n}', String(trashedImages.length))}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {ultimoSvuotamento && (
                                    <button
                                        onClick={annullaSvuotamento}
                                        disabled={ripristinoInCorso || isEmptyingTrash}
                                        title={t.undoEmptyHint}
                                        className={`flex items-center gap-2 px-4 py-2 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'} border rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {ripristinoInCorso ? <Loader2 size={18} className="animate-spin" /> : <Undo2 size={18} />}
                                        <span className="hidden sm:inline">{t.undoEmptyTrash}</span>
                                    </button>
                                )}
                                {trashedImages.length > 0 && (
                                    <>
                                        <button
                                            onClick={handleRestoreAll}
                                            disabled={isEmptyingTrash || ripristinoInCorso}
                                            className={`flex items-center gap-2 px-4 py-2 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'} border rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            <RefreshCw size={18} />
                                            <span className="hidden sm:inline">{t.restoreAll}</span>
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setConfirmDialog({
                                                    isOpen: true,
                                                    title: t.emptyTrash,
                                                    message: t.confirmEmptyTrash,
                                                    onConfirm: handleEmptyTrash,
                                                    onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                                                });
                                            }}
                                            disabled={isEmptyingTrash || ripristinoInCorso}
                                            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Trash size={18} />
                                            <span className="hidden sm:inline">{t.emptyTrash}</span>
                                        </button>
                                    </>
                                )}
                                <button onClick={() => setIsTrashOpen(false)} className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                                    <X size={24} />
                                </button>
                            </div>
                        </div>
                        
                        <div className={`flex-1 flex flex-col min-h-0 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                            {/* ITALIANO: Dove stanno DAVVERO questi file. Il cestino dell'app e' solo una lista: le
                                foto restano nella cartella dell'utente finche' non si svuota, e allora escono di li'
                                e vanno nel Cestino di Windows. L'app non lo diceva da nessuna parte, e in tre altre
                                finestre rassicura invece che "i file su disco non vengono toccati": chi legge quelle
                                arriva qui convinto che nemmeno questo tasto tocchi niente. Detto PRIMA di premere,
                                non dentro la finestra di conferma che si legge di fretta.
                                ENGLISH: where these files REALLY are. The app's trash is just a list: the photos stay
                                in the user's folder until it is emptied, and only then do they leave it for the
                                Windows Recycle Bin. The app said this nowhere, while three other dialogs promise that
                                "files on disk are not touched" - whoever read those arrives here sure that this
                                button touches nothing either. Said BEFORE the click, not inside the confirm box
                                that gets skimmed. */}
                            {trashedImages.length > 0 && (
                                <div className={`px-4 py-2.5 border-b flex items-start gap-2 shrink-0 text-xs ${isDarkMode ? 'border-gray-800 bg-amber-500/10 text-amber-300' : 'border-gray-200 bg-amber-50 text-amber-800'}`}>
                                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                    <span>{t.trashInfo}</span>
                                </div>
                            )}
                            {trashedImages.length > 0 && (
                                <div className={`p-4 border-b flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 ${isDarkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white/50'}`}>
                                    <div className="flex items-center gap-2">
                                        <ArrowDownUp size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                                        <select value={trashSortOrder} onChange={(e) => setTrashSortOrder(e.target.value)} className={`text-sm rounded-lg border-none focus:ring-0 cursor-pointer font-medium ${isDarkMode ? 'bg-transparent text-gray-300' : 'bg-transparent text-gray-700'}`}>
                                            <option value="name-asc" className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>{t.sortNameAsc}</option>
                                            <option value="name-desc" className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>{t.sortNameDesc}</option>
                                            <option value="date-asc" className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>{t.sortDateAsc}</option>
                                            <option value="date-desc" className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>{t.sortDateDesc}</option>
                                        </select>
                                    </div>
                                    <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border shadow-sm ${isDarkMode ? 'bg-gray-800/50 border-gray-700/50' : 'bg-white border-gray-200'}`}>
                                        <ZoomOut size={14} className="text-gray-400" />
                                        <input type="range" min="150" max="400" value={trashImageWidth} onChange={(e) => setTrashImageWidth(Number(e.target.value))} className="w-24 md:w-32 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-indigo-500" />
                                        <ZoomIn size={14} className="text-gray-400" />
                                    </div>
                                </div>
                            )}
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 relative">
                                {trashedImages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center">
                                        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${isDarkMode ? 'bg-gray-800 text-gray-600' : 'bg-gray-100 text-gray-300'}`}>
                                            <Trash2 size={48} />
                                        </div>
                                        <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{t.trashEmpty}</h3>
                                        {ultimoSvuotamento && (
                                            <>
                                                <p className={`text-sm max-w-md leading-relaxed mb-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t.undoEmptyHint}</p>
                                                <button
                                                    onClick={annullaSvuotamento}
                                                    disabled={ripristinoInCorso || isEmptyingTrash}
                                                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all shadow-md shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {ripristinoInCorso ? <Loader2 size={18} className="animate-spin" /> : <Undo2 size={18} />}
                                                    {ripristinoInCorso ? t.undoEmptyWorking : t.undoEmptyTrash}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid gap-4 md:gap-6 transition-all duration-300 items-start" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${trashImageWidth}px, 1fr))` }}>
                                        {sortedTrashedImages.map(img => (
                                            <div key={img.id} className={`group ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all border flex flex-col h-full`}>
                                                <div className={`relative ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} overflow-hidden shrink-0 flex justify-center items-center ${viewMode === 'square' ? 'aspect-square' : ''}`} style={viewMode === 'original' ? { height: 'auto', minHeight: '120px' } : {}}>
                                                    <img src={img.thumb} alt="Trash preview" loading="lazy" className={`w-full ${viewMode === 'square' ? 'h-full object-cover' : 'h-auto object-contain'} opacity-70`} />
                                                    
                                                    {qualityWarningText(t, img.width, img.height) !== null && (
                                                        <div className="absolute top-2 right-2 z-30 group/alert">
                                                            <div className="p-1.5 bg-yellow-500 text-white rounded-lg shadow-md cursor-help">
                                                                <AlertTriangle size={16} strokeWidth={2.5} />
                                                            </div>
                                                            <div className="absolute right-0 top-full mt-2 w-64 p-2.5 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/alert:opacity-100 group-hover/alert:visible transition-all duration-200 pointer-events-none whitespace-pre-line border border-gray-700">
                                                                {qualityWarningText(t, img.width, img.height)}
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    <button onClick={() => handleRestore(img.id)} disabled={isEmptyingTrash} className="absolute top-2 left-2 p-1.5 bg-black/50 hover:bg-green-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-20 disabled:cursor-not-allowed" title={t.restore}><RefreshCw size={14} /></button>
                                                    <button onClick={() => {
                                                        setConfirmDialog({
                                                            isOpen: true,
                                                            title: t.deletePermanently,
                                                            message: t.confirmDelete,
                                                            onConfirm: () => {
                                                                handleDeletePermanently(img.id);
                                                                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                                            },
                                                            onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                                                        });
                                                    }} disabled={isEmptyingTrash} className={`absolute top-2 ${qualityWarningText(t, img.width, img.height) !== null ? 'right-10' : 'right-2'} p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-20 disabled:cursor-not-allowed`} title={t.deletePermanently}><X size={14} /></button>
                                                </div>
                                                <div className={`p-3 flex-1 flex flex-col ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                                    <div className={`flex-1 rounded-xl border p-1 ${isDarkMode ? 'bg-gray-900/30 border-gray-700/50' : 'bg-gray-50 border-gray-100'}`}>
                                                        <TagInput lang={lang} tags={img.tags} setTags={() => {}} placeholder="" maxHeight={viewMode === 'original' ? 'flex-1 h-full max-h-none' : 'max-h-[180px]'} readOnly={true} isDarkMode={isDarkMode} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedImageId && (
                <Lightbox
                    globalTriggers={globalTriggers}
                    image={lightboxImages.find(img => img.id === selectedImageId)}
                    onClose={() => setSelectedImageId(null)}
                    updateTags={updateImageTags}
                    allTags={allUniqueTags}
                    addProjectTag={(tag: string) => setCustomProjectTags(prev => prev.includes(tag) ? prev : [...prev, tag])}
                    t={t}
                    onNext={handleNext}
                    onPrev={handlePrev}
                    hasNext={(lightboxImages.length - 1) > currentIndex}
                    hasPrev={currentIndex > 0}
                    slideDirection={slideDirection}
                    showNotification={showNotification}
                    updateOriginalTags={updateOriginalTags}
                    dirHandle={lightboxImages.find(img => img.id === selectedImageId)?.dirHandle || null}
                    isDarkMode={isDarkMode}
                    onMoveToTrash={handleTrashFromLightbox}
                    imageIndex={currentIndex}
                    imageCount={lightboxImages.length}
                    copiedTags={copiedTags}
                    onCopyTags={(tags: string[]) => { setCopiedTags([...tags]); showNotification(t.tagsCopiedNotif, 'success'); }}
                    lang={lang}
                    aiEnabled={aiEnabled}
                    aiBusy={isAIBusy}
                    onAITagSingle={handleAITagSingle}
                />
            )}

            {/* ITALIANO: sfondo generale dell'app: un unico viola pieno, uguale su tutti i lati.
                          Prima era una sfumatura diagonale (grigio-osso a sinistra, slate-azzurro a
                          destra) e ai margini dell'app si vedevano due lineette di colore diverso. */}
            {/* ENGLISH: overall app background: a single solid violet, identical on every side. It
                         used to be a diagonal gradient (bone-gray on the left, slate-blue on the
                         right) and two differently-coloured lines showed in the app's margins. */}
            <div className={`fixed inset-0 z-0 transition-colors duration-500 ${isDarkMode ? 'bg-violet-950' : 'bg-violet-50'}`}></div>

            {/* ITALIANO: Rientro UGUALE su tutti i lati (p-4/p-6) e nessun tetto di larghezza,
                          così su schermi larghi la finestra interna non lascia grandi fasce ai lati.
                ENGLISH: EQUAL inset on every side (p-4/p-6) and no width cap, so on wide screens
                         the inner window doesn't leave big empty bands left and right. */}
            <div className="relative z-10 w-full p-4 md:p-6 mx-auto h-full">
                <div className={`${isDarkMode ? 'bg-gray-900/70 border-gray-700/50' : 'bg-white/80 border-gray-200'} backdrop-blur-xl border shadow-2xl rounded-3xl overflow-hidden transition-all duration-500 flex flex-col relative h-full max-h-[calc(100vh-2rem)] md:max-h-[calc(100vh-3rem)]`}>
                    
                    <div className={`border-b ${isDarkMode ? 'border-gray-800/50 bg-black/20' : 'border-gray-200 bg-gray-50/50'} p-4 md:p-5 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 z-20`}>
                        <div className="flex-1 flex justify-start w-full md:w-auto">
                        </div>
                        <div className="flex-1 flex justify-center items-center gap-3 w-full md:w-auto">
                            <div className="hidden sm:block relative">
                                <img src="./logo.png" alt="Logo" className="w-12 h-12 object-contain drop-shadow-md" onError={(e) => { e.currentTarget.src = './icon.png'; e.currentTarget.onerror = (e2) => { const target = (e2 as Event).currentTarget as HTMLImageElement | null; if (target) target.style.display = 'none'; const fallback = document.getElementById('fallback-header-logo'); if (fallback) fallback.classList.remove('hidden'); } }} />
                                <div id="fallback-header-logo" className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md hidden"><Tag className="text-white" size={20} /></div>
                            </div>
                            <h1 className={`text-lg md:text-xl font-bold bg-clip-text text-transparent ${isDarkMode ? 'bg-gradient-to-r from-white to-gray-300' : 'bg-gradient-to-r from-gray-900 to-gray-600'} whitespace-nowrap`}>{t.appTitle}</h1>
                        </div>
                        <div className="flex-1 flex justify-end w-full md:w-auto gap-2">
                            <button onClick={() => setIsTrashOpen(true)} className={`flex items-center gap-2 p-2 md:px-3 md:py-2 rounded-xl ${isDarkMode ? 'bg-gray-800/50 hover:bg-gray-700 border-gray-700/50 text-gray-300' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-600'} border shadow-sm transition-colors focus:outline-none`}>
                                <span className="font-semibold text-sm hidden sm:inline-block">{t.trash}</span>
                                <div className="relative">
                                    <Trash2 size={20} />
                                    {trashedImages.length > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                                            {trashedImages.length}
                                        </span>
                                    )}
                                </div>
                            </button>
                            <div className="relative" ref={settingsRef}>
                                <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className={`flex items-center gap-2 p-2 md:px-3 md:py-2 rounded-xl ${isDarkMode ? 'bg-gray-800/50 hover:bg-gray-700 border-gray-700/50 text-gray-300' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-600'} border shadow-sm transition-colors focus:outline-none`}><span className="font-semibold text-sm hidden sm:inline-block">{t.settings}</span><Settings size={20} className={isSettingsOpen ? "rotate-45 transition-transform duration-300" : "transition-transform duration-300"} /></button>
                                
                                {isSettingsOpen && <div className={`absolute right-0 mt-2 w-80 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl shadow-xl border p-4 z-50 animate-in fade-in slide-in-from-top-2`}>
                                    <h3 className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} uppercase mb-4 tracking-wider`}>{t.settings}</h3>
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <div className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} font-medium`}>{soundEnabled ? <Volume2 size={16} className="text-indigo-500"/> : <VolumeX size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-400'}/>} {t.uiSounds}</div>
                                            <AppleToggle checked={soundEnabled} onChange={setSoundEnabled} colorClass="bg-indigo-500" />
                                        </div>
                                        {apiElectron && typeof apiElectron.checkForUpdate === 'function' && (
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center justify-between">
                                                    <div className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} font-medium`}>{t.updateCheckLabel}</div>
                                                    <AppleToggle checked={updateCheckChoice === 'on'} onChange={(v: boolean) => rispondiAggiornamenti(v ? 'on' : 'off')} colorClass="bg-indigo-500" />
                                                </div>
                                                <p className={`text-[10px] leading-snug ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{t.updateCheckHint}</p>
                                            </div>
                                        )}
                                        <div className={`w-full h-px ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}></div>
                                        <div className="flex items-center justify-between">
                                            <div className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} font-medium`}>{isDarkMode ? <Moon size={16} className="text-purple-400"/> : <Sun size={16} className="text-amber-500"/>} {t.theme}</div>
                                            <AppleToggle checked={isDarkMode} onChange={setIsDarkMode} colorClass="bg-indigo-500" iconOn={<Moon size={10}/>} iconOff={<Sun size={10}/>} />
                                        </div>
                                        <div className={`w-full h-px ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}></div>
                                        {/* ITALIANO: Il tasto "Statistiche progetto" e' stato tolto da qui: ora sta sulla pagina principale (riquadro destro). */}
                                        {/* ENGLISH: The "Project statistics" button was removed from here: it now lives on the main page (right panel). */}
                                        {/* ITALIANO: Sezione strumenti AI cloud (Gemini) */}
                                        {/* ENGLISH: Cloud AI tools section (Gemini) */}
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <div className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} font-medium`}>
                                                    <Sparkles size={16} className="text-purple-500"/>
                                                    {t.aiSettings || 'AI Tools'}
                                                    {/* ITALIANO: Badge che segnala la funzione AI come sperimentale (beta) — ENGLISH: Badge marking the AI feature as experimental (beta) */}
                                                    <span
                                                        title={t.aiBetaHint || 'Experimental feature — may change or give imperfect results.'}
                                                        className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider leading-none ${isDarkMode ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30' : 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'}`}
                                                    >
                                                        {t.aiBeta || 'Beta'}
                                                    </span>
                                                </div>
                                                {/* ITALIANO: spegnere l'AI ferma anche la taggatura in blocco in corso, come Annulla: prima le foto continuavano a partire verso Google con l'AI "spenta" */}
                                                {/* ENGLISH: switching the AI off also stops the running bulk tagging, like Cancel: photos used to keep going to Google with the AI "off" */}
                                                <AppleToggle checked={aiEnabled} onChange={(v: boolean) => { setAiEnabled(v); if (!v && aiAbortControllerRef.current) handleCancelAITagging(); if (v && !geminiApiKey) setIsApiKeyDialogOpen(true); }} colorClass="bg-purple-500" />
                                            </div>
                                            {aiEnabled && (
                                                <div className={`flex flex-col gap-2 p-2 rounded-lg text-[10px] ${isDarkMode ? 'bg-gray-900/60 text-gray-400' : 'bg-purple-50/50 text-gray-600'}`}>
                                                    <p className="leading-relaxed">{t.aiCloudInfo || ''}</p>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="font-medium text-[11px]">{t.aiKeyLabel || 'API Key Gemini'}</label>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => setIsApiKeyDialogOpen(true)}
                                                                className={`flex-1 flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-mono transition-colors border ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                                            >
                                                                <span className="truncate">{geminiApiKey ? `${'•'.repeat(8)}${geminiApiKey.slice(-4)}` : (t.aiKeyMissing || 'Click to enter your key')}</span>
                                                                <KeyRound size={11} className="shrink-0" />
                                                            </button>
                                                            {geminiApiKey && (
                                                                <button
                                                                    onClick={() => {
                                                                        setConfirmDialog({
                                                                            isOpen: true,
                                                                            title: t.aiKeyClearTitle || 'Cancella API Key',
                                                                            message: t.aiKeyClearMsg || 'Vuoi davvero rimuovere la API key salvata?',
                                                                            onConfirm: async () => {
                                                                                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                                                                await handleClearApiKey();
                                                                            },
                                                                            onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
                                                                        });
                                                                    }}
                                                                    className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'text-red-400 hover:bg-red-900/40' : 'text-red-500 hover:bg-red-50'}`}
                                                                    title={t.aiKeyClear || 'Rimuovi'}
                                                                >
                                                                    <X size={11} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {/* ITALIANO: Pulsante guida espandibile */}
                                                        {/* ENGLISH: Expandable guide button */}
                                                        <button
                                                            onClick={() => setIsApiKeyGuideOpen(v => !v)}
                                                            className={`mt-1 flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-bold transition-colors ${isDarkMode ? 'bg-indigo-900/30 text-indigo-300 hover:bg-indigo-900/50' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                                                        >
                                                            <span className="flex items-center gap-1.5">
                                                                <BookOpen size={11} />
                                                                {t.aiKeyGuideToggle || 'Come ottenere una API key'}
                                                            </span>
                                                            {isApiKeyGuideOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                                        </button>
                                                        {isApiKeyGuideOpen && (
                                                            <div className={`mt-1 p-3 rounded-md text-[10.5px] leading-relaxed flex flex-col gap-2 ${isDarkMode ? 'bg-gray-900/80 text-gray-300 border border-gray-700' : 'bg-white text-gray-700 border border-gray-200'}`}>
                                                                <p className="font-bold text-[11px]">{t.aiKeyGuideIntro || 'La key è gratis. Servono ~30 secondi:'}</p>
                                                                <ol className="list-decimal pl-4 space-y-2">
                                                                    <li>
                                                                        <span className="font-medium">{t.aiKeyGuideStep1Title || 'Apri Google AI Studio'}</span>
                                                                        <p className="opacity-80 mt-0.5">{t.aiKeyGuideStep1Desc || 'Clicca il link qui sotto, il sito si aprirà nel browser predefinito.'}</p>
                                                                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 mt-1 px-2 py-1 rounded text-[10px] font-bold ${isDarkMode ? 'bg-indigo-700 text-white hover:bg-indigo-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                                                                            <ExternalLink size={10} /> aistudio.google.com/app/apikey
                                                                        </a>
                                                                    </li>
                                                                    <li>
                                                                        <span className="font-medium">{t.aiKeyGuideStep2Title || 'Accedi col tuo account Google'}</span>
                                                                        <p className="opacity-80 mt-0.5">{t.aiKeyGuideStep2Desc || 'Va bene un qualsiasi account Gmail (anche personale). Accetta i termini se richiesto.'}</p>
                                                                    </li>
                                                                    <li>
                                                                        <span className="font-medium">{t.aiKeyGuideStep3Title || 'Clicca "Create API key" o "Get API key"'}</span>
                                                                        <p className="opacity-80 mt-0.5">{t.aiKeyGuideStep3Desc || "Il pulsante blu in alto a destra. Se chiede di scegliere un progetto, lascia quello suggerito di default."}</p>
                                                                    </li>
                                                                    <li>
                                                                        <span className="font-medium">{t.aiKeyGuideStep4Title || 'Copia la stringa generata'}</span>
                                                                        <p className="opacity-80 mt-0.5">{t.aiKeyGuideStep4Desc || 'Inizia con "AIza..." ed è lunga 39 caratteri. Usa l\'icona di copia accanto alla key.'}</p>
                                                                    </li>
                                                                    <li>
                                                                        <span className="font-medium">{t.aiKeyGuideStep5Title || 'Incollala qui'}</span>
                                                                        <p className="opacity-80 mt-0.5">{t.aiKeyGuideStep5Desc || 'Clicca il campo "API Key Gemini" sopra, incolla, conferma. L\'app la verifica e la salva cifrata.'}</p>
                                                                    </li>
                                                                </ol>
                                                                <div className={`mt-1 p-2 rounded text-[10px] flex items-start gap-1.5 ${isDarkMode ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-800/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                                                                    <Check size={11} className="shrink-0 mt-0.5" />
                                                                    <span><strong>{t.aiKeyGuideFreeTitle || 'È gratis'}</strong> — {t.aiKeyGuideFreeBody || 'Il free tier copre ~15 richieste/minuto, sufficiente per dataset fino a centinaia di foto.'}</span>
                                                                </div>
                                                                <div className={`p-2 rounded text-[10px] flex items-start gap-1.5 ${isDarkMode ? 'bg-amber-900/30 text-amber-300 border border-amber-800/50' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                                                    <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                                                                    <span><strong>{t.aiKeyGuideRecoverTitle || 'L\'hai persa?'}</strong> {t.aiKeyGuideRecoverBody || 'Apri di nuovo aistudio.google.com/app/apikey: troverai tutte le tue key (puoi crearne di nuove o eliminare le vecchie).'}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="font-medium text-[11px]">{t.aiModelLabel || 'Modello'}</label>
                                                        <select
                                                            value={aiModelloFissato ? aiModel : '__auto__'}
                                                            onChange={(e) => {
                                                                const scelto = e.target.value;
                                                                if (scelto === '__auto__') {
                                                                    setAiModelloFissato(false);
                                                                    if (geminiApiKey) controllaModello(false, true, false);
                                                                } else {
                                                                    sceltaManualeRef.current += 1;
                                                                    ultimaSceltaRef.current = scelto;
                                                                    setAiModel(scelto);
                                                                    setAiModelloFissato(true);
                                                                }
                                                            }}
                                                            className={`w-full text-[11px] rounded-md border px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-500 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
                                                        >
                                                            <option value="__auto__">{t.aiModelAutomatic.replace('{a}', aiModel)}</option>
                                                            {elencoModelli.map(m => {
                                                                // ITALIANO: 'unknown' (flash-lite, senza versione): nessun simbolo, invece di
                                                                //           promettere un piano gratuito che il modello puo' non avere.
                                                                // ENGLISH: 'unknown' (flash-lite, no version): no badge, rather than promising
                                                                //          a free tier the model may not have.
                                                                const tierBadge = m.tier === 'free' ? ' ✓' : m.tier === 'limited' ? ' ◐' : m.tier === 'paid' ? ' $' : '';
                                                                return (
                                                                    <option key={m.id} value={m.id}>
                                                                        {m.label}{tierBadge}{m.recommended ? ' ★' : ''}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                        {getModelTier(aiModel) === 'limited' && (
                                                            <div className={`text-[10px] rounded-md px-2 py-1.5 mt-1 flex items-start gap-1.5 ${isDarkMode ? 'bg-blue-900/30 text-blue-300 border border-blue-800/50' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                                                                <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                                                                <span>{t.aiModelLimitedWarning || 'Free tier limitato (rate limit più bassi). Per uso intenso serve billing attivo.'}</span>
                                                            </div>
                                                        )}
                                                        {getModelTier(aiModel) === 'paid' && (
                                                            <div className={`text-[10px] rounded-md px-2 py-1.5 mt-1 flex items-start gap-1.5 ${isDarkMode ? 'bg-amber-900/30 text-amber-300 border border-amber-800/50' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                                                <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                                                                <span>{t.aiModelPaidWarning || 'Questo modello richiede billing attivo sul tuo progetto Google Cloud (no free tier).'}</span>
                                                            </div>
                                                        )}
                                                        <p className={`text-[10px] leading-snug mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>{t.aiModelAutoHint}</p>
                                                        <div className="flex items-center justify-between gap-2 mt-1">
                                                            <span className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                {modelloControllatoIl > 0
                                                                    ? t.aiModelCheckedOn.replace('{quando}', new Date(modelloControllatoIl).toLocaleDateString(lang))
                                                                    : t.aiModelCheckedNever}
                                                            </span>
                                                            <button
                                                                onClick={() => controllaModello(false, true)}
                                                                disabled={controlloModelloInCorso || !geminiApiKey}
                                                                className={`text-[10px] px-2 py-1 rounded-md border transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                                                            >
                                                                {controlloModelloInCorso ? '…' : t.aiModelCheckNow}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="flex items-center justify-between font-medium text-[11px]">
                                                            <span>{t.aiMaxTags || 'Max tags'}</span>
                                                            <span className="font-bold tabular-nums">{aiMaxTags}</span>
                                                        </label>
                                                        <input
                                                            type="range"
                                                            min={1} max={80} step={1}
                                                            value={aiMaxTags}
                                                            onChange={(e) => setAiMaxTags(parseInt(e.target.value, 10))}
                                                            className="w-full h-1.5 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="flex items-center justify-between font-medium text-[11px]">
                                                            <span>{t.aiRpmLabel || 'Velocità (req/min)'}</span>
                                                            <span className="font-bold tabular-nums">{aiRpm}</span>
                                                        </label>
                                                        <input
                                                            type="range"
                                                            min={5} max={60} step={1}
                                                            value={aiRpm}
                                                            onChange={(e) => setAiRpm(parseInt(e.target.value, 10))}
                                                            className="w-full h-1.5 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                                        />
                                                        <p className="text-[9px] italic opacity-80">{t.aiRpmHint || 'Free tier: max 15. Più alto = più veloce ma rischio rate-limit.'}</p>
                                                    </div>
                                                    <div className={`flex items-start justify-between gap-3 px-2 py-1.5 rounded-md ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-100/70'}`}>
                                                        <div className="flex flex-col gap-0.5 min-w-0">
                                                            <span className="font-medium text-[11px]">{t.aiSkipTagged || 'Salta foto già taggate'}</span>
                                                            <span className="text-[9px] italic opacity-75 leading-snug">{t.aiSkipTaggedHint || 'Se attivo, le immagini che hanno già almeno un tag vengono saltate durante "Tagga tutte con AI".'}</span>
                                                        </div>
                                                        <AppleToggle checked={aiSkipTagged} onChange={(v: boolean) => setAiSkipTagged(v)} colorClass="bg-purple-500" />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="font-medium text-[11px]">{t.aiCustomPromptLabel || 'Prompt personalizzato (opzionale)'}</label>
                                                        <textarea
                                                            value={aiCustomPrompt}
                                                            onChange={(e) => setAiCustomPrompt(e.target.value)}
                                                            maxLength={500}
                                                            placeholder={t.aiCustomPromptPlaceholder || "Es. focalizzati su vestiti e ambientazione, niente NSFW…"}
                                                            className={`w-full text-[11px] rounded-md border px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-500 min-h-[60px] resize-none ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-600' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'}`}
                                                        />
                                                    </div>
                                                    <p className={`text-[9px] italic mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                                        {t.aiModelLegend}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        <div className={`w-full h-px ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}></div>
                                        <div className="flex items-center justify-between">
                                            <div className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} font-medium`}>
                                                <Globe size={16} className="text-blue-500"/>
                                                {t.language}
                                            </div>
                                            <div className="relative group">
                                                <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border cursor-pointer ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                                                    <img src={flagUriForLang(lang)} alt={lang} className="w-5 h-5 rounded-full object-cover" />
                                                    <span className="text-xs font-medium uppercase">{lang}</span>
                                                </div>
                                                <div className={`absolute right-0 top-full mt-1 w-36 py-1 rounded-xl border shadow-xl overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                                    {APP_LANGUAGES.map((l) => (
                                                        <div 
                                                            key={l.code} 
                                                            onClick={() => setLang(l.code)}
                                                            className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${lang === l.code ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600') : (isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-50 text-gray-700')}`}
                                                        >
                                                            <img src={flagUri(l.flag)} alt={l.label} className="w-5 h-5 rounded-full object-cover shadow-sm" />
                                                            <span className="text-xs font-medium">{l.label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`w-full h-px ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'} my-1`}></div>
                                        <div className="flex flex-col items-center gap-1">
                                            <span className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} font-semibold tracking-widest uppercase`}>{t.versionLabel} {appVersion}</span>
                                            <span className={`text-[9px] ${isDarkMode ? 'text-gray-600' : 'text-gray-400'} font-medium italic`}>{t.copyrightLabel} xXIlRizzoXx</span>
                                        </div>
                                    </div>
                                </div>}
                            </div>
                        </div>
                    </div>

                    <div className={`transition-all duration-500 ease-in-out overflow-hidden flex justify-center shrink-0 ${isDarkMode ? 'bg-gray-800/20 border-gray-800/50' : 'bg-gray-100/50 border-gray-200'} ${(isImporting || isSaving) ? 'max-h-32 opacity-100 border-b' : 'max-h-0 opacity-0'}`}>
                        {/* ITALIANO: piena larghezza con lo stesso rientro (p-4 md:p-5) della riga comandi,
                                      cosi' la barra di avanzamento arriva agli stessi bordi dei due riquadri. */}
                        {/* ENGLISH: full width with the command row's inset (p-4 md:p-5), so the progress bar
                                     reaches the same edges as the two side boxes. */}
                        <div className="w-full p-4 md:p-5">
                            <div className={`p-4 rounded-2xl flex items-center gap-4 shadow-inner border ${isDarkMode ? 'bg-indigo-900/30 border-indigo-700/50' : 'bg-white border-indigo-200'}`}>
                                <div className="w-6 h-6 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{importProgress === 100 ? t.completed : (isSaving ? t.savingInProgress : t.processingFiles)}</span>
                                        <span className="text-sm font-bold text-indigo-500">{importProgress}%</span>
                                    </div>
                                    <div className={`w-full rounded-full h-2 overflow-hidden shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                        <div className="bg-indigo-500 h-full rounded-full transition-all duration-200" style={{width: `${importProgress}%`}}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ITALIANO: lg:items-stretch = i tre riquadri si allungano tutti alla STESSA altezza (quella
                                  del piu' alto), cosi' il riquadro di sinistra arriva in basso come quello di destra. */}
                    {/* ENGLISH: lg:items-stretch = the three panels all stretch to the SAME height (the tallest),
                                 so the left panel reaches the bottom like the right one. */}
                    <div className={`p-4 md:p-5 flex flex-col lg:flex-row lg:items-stretch gap-6 border-b ${isDarkMode ? 'border-gray-800/50 bg-gray-800/20' : 'border-gray-200 bg-gray-100/30'} shrink-0`}>
                        
                        <div className={`w-full lg:w-[420px] flex flex-col gap-3 shrink-0 ${isDarkMode ? 'bg-gray-900/50 border-gray-700/50' : 'bg-white border-gray-200'} p-4 rounded-2xl border shadow-inner`}>
                            {/* ITALIANO: "Carica Cartella" e "Carica immagini" affiancati, stesso colore (blu). */}
                            {/* ENGLISH: "Load Folder" and "Load images" side by side, same colour (blue). */}
                            <div className="flex gap-2">
                                <button onClick={handleLoadFolderClick} className={`flex-1 h-[42px] flex justify-center items-center gap-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm`}>
                                    <Folder size={16} />
                                    <span>{t.loadFolder}</span>
                                </button>
                                <button onClick={() => imagesInputRef.current?.click()} className={`flex-1 h-[42px] flex justify-center items-center gap-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm`}>
                                    <ImageIcon size={16} />
                                    <span>{t.loadImages}</span>
                                </button>
                            </div>
                            {/* ITALIANO: Chiude il progetto attuale (foto + tag), come app appena aperta — arancione */}
                            {/* ENGLISH: Closes the current project (photos + tags), like a freshly opened app — orange */}
                            {/* ITALIANO: spento anche mentre si scrive (isSaving), come Salva ed Esporta: "Salva e
                                chiudi" spegneva a meta' la barra di un'esportazione in corso.
                                ENGLISH: also off while writing (isSaving), like Save and Export: "Save and
                                close" switched off the bar of a running export halfway. */}
                            <button onClick={handleCloseProject} disabled={images.length === 0 || isSaving} className={`w-full h-[42px] flex justify-center items-center gap-2 px-4 rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm ${(images.length === 0 || isSaving) ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed') : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'}`} title={t.closeAllImages}>
                                <X size={16} />
                                <span>{t.closeAllImages}</span>
                            </button>
                            <button onClick={handleResetProject} className={`w-full h-[42px] flex justify-center items-center gap-2 px-4 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm`}>
                                <Trash size={16} />
                                <span>{t.resetProject}</span>
                            </button>
                        </div>
                        
                        {/* ITALIANO: Sezione centrale racchiusa in un riquadro con lo STESSO stile dei due
                                      pannelli laterali (bg, bordo, angoli, ombra interna). */}
                        {/* ENGLISH: Centre section wrapped in a panel with the SAME style as the two side
                                     panels (bg, border, rounding, inner shadow). */}
                        <div className={`flex-1 w-full flex flex-col gap-3 min-w-0 ${isDarkMode ? 'bg-gray-900/50 border-gray-700/50' : 'bg-white border-gray-200'} p-4 rounded-2xl border shadow-inner`}>
                            {/* ITALIANO: Input per le trigger words globali */}
                            {/* ENGLISH: Input for global trigger words */}
                            <div className="w-full">
                                {/* ITALIANO: cap a 120px (con scorrimento interno) cosi' la sezione centrale non
                                              diventa mai piu' alta dei due riquadri laterali: la barra comandi resta bilanciata. */}
                                {/* ENGLISH: capped at 120px (scrolls inside) so the centre section never grows taller
                                             than the two side panels: the command bar stays balanced. */}
                                <TagInput lang={lang} tags={globalTriggers} setTags={handleGlobalTagsChange} placeholder={t.globalTriggersPlaceholder} isGlobal={true} maxHeight="max-h-[120px]" isDarkMode={isDarkMode} />
                            </div>

                            {/* ITALIANO: Toolbar Tag Suggeriti + Auto-Tag AI (se abilitato) */}
                            {/* ENGLISH: Toolbar with Suggested Tags + AI Auto-Tag (if enabled) */}
                            <div className={`p-2 rounded-xl border ${isDarkMode ? 'bg-gray-950/40 border-gray-700/40' : 'bg-gray-50 border-gray-100'} flex flex-col gap-2 w-full`}>
                                <div className="flex items-center justify-center gap-3 flex-wrap">
                                    {aiEnabled && (
                                        <button
                                            onClick={handleAITagAll}
                                            disabled={isGlobalAITagging || images.length === 0}
                                            className={`flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${isGlobalAITagging || images.length === 0 ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed') : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md active:scale-95'}`}
                                        >
                                            {isGlobalAITagging ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                            {isGlobalAITagging ? `${globalAIProgress.done}/${globalAIProgress.total}` : (t.aiAutoTagAll || 'Auto-tag all with AI')}
                                        </button>
                                    )}
                                    {/* ITALIANO: Annulla resta finche' la taggatura gira, anche con l'AI appena spenta */}
                                    {/* ENGLISH: Cancel stays while the tagging runs, even with the AI just switched off */}
                                    {isGlobalAITagging && (
                                        <button
                                            onClick={handleCancelAITagging}
                                            disabled={aiCancelRequested}
                                            title={t.aiCancel || t.cancel || 'Cancel'}
                                            className={`flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${aiCancelRequested ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed') : 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-md active:scale-95'}`}
                                        >
                                            <X size={14} />
                                            {aiCancelRequested ? (t.aiCancelling || 'Cancelling…') : (t.aiCancel || t.cancel || 'Cancel')}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setIsTagSuggestionsOpen(!isTagSuggestionsOpen)}
                                        className={`flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-md active:scale-95`}
                                    >
                                        <Tags size={14} />
                                        {t.suggestedTags}
                                    </button>
                                </div>
                                {isGlobalAITagging && (() => {
                                    const errSuffix = globalAIProgress.errors > 0 ? ` · ✗ ${globalAIProgress.errors}` : '';
                                    const skipSuffix = globalAIProgress.skipped > 0 ? ` · ⊘ ${globalAIProgress.skipped}` : '';
                                    const label = `${t.aiTaggingInProgress || 'Tagging…'} ${globalAIProgress.done}/${globalAIProgress.total}${errSuffix}${skipSuffix}`;
                                    const pct = globalAIProgress.total > 0 ? Math.round((globalAIProgress.done / globalAIProgress.total) * 100) : 0;
                                    return (
                                        <div className="w-full flex flex-col gap-1 px-2 pb-1">
                                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                                                <span className={isDarkMode ? 'text-purple-400' : 'text-purple-600'}>{label}</span>
                                                <span className={isDarkMode ? 'text-purple-400' : 'text-purple-600'}>{pct}%</span>
                                            </div>
                                            <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                                                <div
                                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                        
                        <div className={`w-full lg:w-[420px] flex flex-col gap-3 shrink-0 ${isDarkMode ? 'bg-gray-900/50 border-gray-700/50' : 'bg-white border-gray-200'} p-4 rounded-2xl border shadow-inner`}>
                            <div className="flex gap-2">
                                {/* ITALIANO: Pulsante per visualizzare tutti i tag del progetto */}
                                {/* ENGLISH: Button to view all project tags */}
                                <button
                                    onClick={() => setIsGlobalTagManagerOpen(true)}
                                    className="w-full h-[42px] flex justify-center items-center gap-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm"
                                >
                                    <Tag size={16} />
                                    <span>{t.allTagsButton}</span>
                                </button>
                            </div>
                            {/* ITALIANO: Statistiche del progetto — sulla pagina principale, sotto "Visualizza tutti i tag" */}
                            {/* ENGLISH: Project statistics — on the main page, below "View all project tags" */}
                            {/* ITALIANO: Editor di tag — sempre disponibile, anche senza foto aperte:
                                          serve proprio a lavorare sui file di tag da soli. */}
                            {/* ENGLISH: Tag editor — always available, even with no photos open: its whole
                                         point is working on tag files on their own. */}
                            <div className="flex gap-2">
                                <button onClick={() => { setIsStatsOpen(true); soundManager.pop(); }} disabled={images.length === 0} className={`flex-1 h-[42px] flex justify-center items-center gap-2 px-3 rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm ${images.length === 0 ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed') : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white'}`} title={t.projectStats}>
                                    <BarChart3 size={16} />
                                    <span>{t.projectStats}</span>
                                </button>
                                <button onClick={() => { setIsTagEditorOpen(true); soundManager.pop(); }} className="flex-1 h-[42px] flex justify-center items-center gap-2 px-3 rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white" title={t.tagEditor}>
                                    <Tags size={16} />
                                    <span>{t.tagEditor}</span>
                                </button>
                            </div>
                            {/* ITALIANO: Stessa struttura della riga sopra (due tasti flex-1 con gap-2), cosi'
                                          i quattro tasti piccoli hanno tutti la STESSA larghezza. L'etichetta
                                          "ZIP" sotto e' stata tolta: ora il formato e' scritto nel tasto stesso. */}
                            {/* ENGLISH: Same structure as the row above (two flex-1 buttons with gap-2), so the
                                         four small buttons all share the SAME width. The "ZIP" caption below is
                                         gone: the format is now written on the button itself. */}
                            <div className="flex gap-2">
                                <button onClick={handleSaveChanges} disabled={images.length === 0 || isSaving} className="flex-1 h-[42px] flex justify-center items-center gap-2 px-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-400 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm">
                                    <Save size={16} />
                                    <span className="hidden sm:inline">{t.saveChanges}</span>
                                    <span className="sm:hidden">{t.saveShort}</span>
                                </button>
                                {/* ITALIANO: il tasto diceva "Esporta tutti" e l'archivio conteneva solo i .txt:
                                    chi lo premeva si aspettava il dataset intero, foto comprese, e doveva aprire
                                    lo zip per scoprire che dentro c'erano le sole didascalie. Ora il nome dice
                                    cosa esce e il suggerimento dice cosa NON esce.
                                    ENGLISH: the button said "Export All" while the archive held only the .txt
                                    files: people expected the whole dataset, images included, and had to open the
                                    zip to find out it was captions only. The name now says what comes out, and
                                    the tooltip says what does not. */}
                                <button onClick={handleExportAll} title={t.exportAllTip} disabled={images.length === 0 || isSaving} className="flex-1 h-[42px] flex justify-center items-center gap-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-400 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm">
                                    <SaveAll size={16} />
                                    <span className="hidden sm:inline">{t.exportAllTxt}</span>
                                    <span className="sm:hidden">{t.exportShort}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ITALIANO: barra degli strumenti RESPONSIVE. Su schermo largo (xl) resta divisa in
                                  tre colonne uguali come sempre: conteggio+ricerca a sinistra, tipo di
                                  vista al centro, ordinamento+zoom a destra. Sotto quella larghezza le
                                  tre colonne NON si schiacciano piu' una sull'altra: la prima prende
                                  una riga tutta sua e le altre due si dividono la riga sotto. Prima la
                                  riga era rigida (niente "a capo") e restringendo la finestra gli
                                  elementi finivano uno sopra l'altro. */}
                    {/* ENGLISH: RESPONSIVE toolbar. On wide screens (xl) it keeps the usual three equal
                                 columns: count+search left, view mode centre, sort+zoom right. Below
                                 that width the three columns no longer crush into each other: the first
                                 takes a full row of its own and the other two share the row below. The
                                 row used to be rigid (no wrapping) and narrowing the window made the
                                 elements overlap. */}
                    <div className={`px-6 py-2.5 ${isDarkMode ? 'bg-gray-800/40 border-gray-800/50' : 'bg-gray-50 border-gray-200'} border-b flex flex-wrap justify-between items-center gap-x-4 gap-y-2 shrink-0`}>
                        <div className={`basis-full xl:basis-auto flex flex-wrap items-center gap-2 text-sm font-medium min-w-0 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {/* ITALIANO: conteggio — se c'e' una ricerca per tag mostro "filtrate / totali" */}
                            {/* ENGLISH: count — if a tag search is active I show "filtered / total" */}
                            <div className="flex items-center gap-2 shrink-0"><ImageIcon size={16} /><span className="whitespace-nowrap">{tagSearch.trim() ? `${displayedImages.length} / ${fotoAttive}` : `${fotoAttive} ${fotoAttive === 1 ? t.imgOpenedSingle : t.imgOpenedPlural}`}</span></div>
                            {/* ITALIANO: ricerca per TAG — filtra le immagini mostrate (uno o piu' tag separati da virgola) */}
                            {/* ENGLISH: TAG search — filters the shown images (one or more comma-separated tags) */}
                            <div className="relative flex-1 min-w-[150px] max-w-xs">
                                <Search size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                                <input
                                    type="text"
                                    value={tagSearch}
                                    onChange={e => setTagSearch(e.target.value)}
                                    placeholder={t.tagSearchPlaceholder}
                                    className={`w-full border rounded-lg pl-8 pr-7 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500' : 'bg-white border-gray-200 text-gray-700 placeholder-gray-400'}`}
                                />
                                {tagSearch && <button onClick={() => setTagSearch('')} title={t.cancel} className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 ${isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}><X size={12} /></button>}
                            </div>
                            {/* ITALIANO: Seleziona / deseleziona + INVERTI le foto visibili (filtrate) */}
                            {/* ENGLISH: Select / deselect + INVERT the visible (filtered) photos */}
                            {displayedImages.length > 0 && (() => {
                                const allSelected = displayedImages.every(img => selectedForBulk.includes(img.id));
                                return (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button onClick={toggleSelectAll} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${allSelected ? 'bg-indigo-500 border-indigo-500 text-white' : (isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}`}>
                                            <Check size={13} />
                                            {allSelected ? (t.deselectAll || 'Deseleziona tutte') : (t.selectAll || 'Seleziona tutte')}
                                        </button>
                                        <button onClick={invertSelection} title={t.invertSelection} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                            <Ungroup size={13} />
                                            <span className="hidden lg:inline">{t.invertSelection}</span>
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                        {/* ITALIANO: shrink-0: questo gruppo NON deve poter essere schiacciato. Prima era
                                      flex-1 e con justify-center, quando lo spazio non bastava (parole lunghe:
                                      russo, tedesco) il contenuto sbordava SIMMETRICAMENTE dai due lati, finendo
                                      sotto "Ordina per" e persino fuori dal bordo sinistro della finestra.
                                      Non potendosi stringere, e' il flex-wrap della riga a mandarlo a capo. */}
                        {/* ENGLISH: shrink-0: this group must NOT be squeezable. It used to be flex-1 and, with
                                     justify-center, whenever space ran short (long words: Russian, German) the
                                     content overflowed SYMMETRICALLY on both sides, landing under "Sort by" and
                                     even past the window's left edge. Since it cannot shrink, the row's
                                     flex-wrap moves it to its own line instead. */}
                        <div className="shrink-0 flex justify-center">
                            <div className={`flex items-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'} p-1 rounded-lg shadow-inner`}>
                                <button onClick={() => setViewMode('square')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'square' ? (isDarkMode ? 'bg-gray-700 text-indigo-400 shadow-sm' : 'bg-white text-indigo-600 shadow-sm') : (isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}><LayoutGrid size={14} /> {t.square}</button>
                                <button onClick={() => setViewMode('original')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'original' ? (isDarkMode ? 'bg-gray-700 text-indigo-400 shadow-sm' : 'bg-white text-indigo-600 shadow-sm') : (isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}><Grid3X3 size={14} /> {t.original}</button>
                            </div>
                        </div>
                        {/* ITALIANO: questa colonna invece DEVE potersi stringere: cosi' il suo flex-wrap
                                      interno manda lo zoom sotto l'ordinamento prima che la riga trabocchi.
                                      Con shrink-0 restava larga quanto il suo contenuto e rubava lo spazio. */}
                        {/* ENGLISH: this column MUST be able to shrink: that way its inner flex-wrap moves
                                     the zoom below the sort control before the row overflows. With shrink-0
                                     it stayed at its content width and hogged the space. */}
                        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-[10px] uppercase font-bold tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{t.sortBy}:</span>
                                <select 
                                    value={sortOrder} 
                                    onChange={(e) => setSortOrder(e.target.value as any)}
                                    className={`text-xs font-semibold px-2 py-1.5 rounded-lg outline-none transition-all cursor-pointer ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'} border shadow-sm`}
                                >
                                    <option value="name-asc">{t.sortNameAsc}</option>
                                    <option value="name-desc">{t.sortNameDesc}</option>
                                    <option value="date-desc">{t.sortDateDesc}</option>
                                    <option value="date-asc">{t.sortDateAsc}</option>
                                </select>
                            </div>
                            <span className={`hidden sm:inline-block text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wide`}>{t.zoom}</span>
                            <div className={`flex items-center gap-2 ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-200'} px-3 py-1 rounded-full border shadow-inner`}>
                                <ZoomOut size={14} className="text-gray-400" />
                                <input type="range" min="150" max="500" step="10" value={imageWidth} onChange={(e) => setImageWidth(Number(e.target.value))} className="w-20 md:w-32 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                                <ZoomIn size={14} className="text-gray-400" />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-row overflow-hidden relative">
                        <div className={`p-4 md:p-6 ${isDarkMode ? 'bg-black/20' : 'bg-gray-200/40'} flex-1 overflow-y-auto min-h-0 relative`}>
                            {images.length === 0 ? <div className={`flex flex-col items-center justify-center h-full ${isDarkMode ? 'opacity-60' : 'opacity-100'}`}><ImageIcon size={64} className={`${isDarkMode ? 'text-gray-600' : 'text-gray-400'} mb-4`} /><p className={`text-lg font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>{t.noImagesTitle}</p><p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-600'} mt-2 font-bold`}>{t.noImagesDesc}</p></div> :
                            // ITALIANO: col pannello di selezione aperto lascio SOTTO (pb-[52vh]) spazio per scorrere
                            //           TUTTE le card sopra il pannello: prima le ultime restavano coperte e non si
                            //           riusciva a scrivere/toccare i loro tag.
                            // ENGLISH: with the selection panel open I leave space BELOW (pb-[52vh]) to scroll ALL
                            //          cards above the panel: the last ones used to stay covered and unusable.
                            <div className={`grid gap-4 md:gap-6 transition-all duration-300 items-start relative z-0 ${selectedForBulk.length > 0 ? 'pb-[52vh]' : 'pb-2'}`} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${imageWidth}px, 1fr))`, ['--card-h' as any]: viewMode === 'square' ? `${imageWidth + 180}px` : '320px' }}>
                                {displayedImages.map((img) => (
                                    <GalleryCard
                                        key={img.id}
                                        img={img}
                                        isDarkMode={isDarkMode}
                                        viewMode={viewMode}
                                        lang={lang}
                                        t={t}
                                        isSelected={selectedForBulkSet.has(img.id)}
                                        copiedCount={copiedTags?.length || 0}
                                        onCardClick={handleCardClick}
                                        onSelectToggle={toggleImageSelection}
                                        onTrash={handleMoveToTrash}
                                        onClose={handleCloseImage}
                                        onCopy={handleCopyThumbTags}
                                        onPaste={handlePasteThumbTags}
                                        onUpdateTags={updateImageTags}
                                    />
                                ))}
                            </div>}
                        </div>
                        <TagSuggestionsPanel 
                            isOpen={isTagSuggestionsOpen} 
                            onClose={() => setIsTagSuggestionsOpen(false)} 
                            onTagClick={handleSuggestedTagClick} 
                            lang={lang} 
                            isDarkMode={isDarkMode} 
                            t={t} 
                            selectedTags={stagedBulkTags}
                        />
                    </div>

                    {selectedForBulk.length > 0 && (
                        <div className={`absolute bottom-6 left-0 right-0 mx-auto w-[95%] max-w-6xl backdrop-blur-xl border p-4 z-[150] shadow-2xl animate-in slide-in-from-bottom-12 flex flex-col gap-3 max-h-[46vh] rounded-2xl ring-1 ring-black/5 ${isDarkMode ? 'bg-gray-900/95 border-gray-700' : 'bg-white/95 border-gray-200'}`}>
                            <div className="w-full flex flex-col gap-3 h-full min-h-0">
                                <div className="flex justify-between items-center shrink-0"><div className="flex items-center gap-3"><div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}><Grid3X3 size={18} /></div><div><h3 className={`text-sm font-bold leading-tight ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{t.bulkPanelTitle.replace('{n}', String(selectedForBulk.length))}</h3></div></div><button onClick={() => { setSelectedForBulk([]); setStagedBulkTags([]); }} className={`p-1.5 rounded-full border hover:bg-red-500 hover:border-red-500 hover:text-white transition-all shadow-sm shrink-0 ${isDarkMode ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'}`}><X size={14} /></button></div>
                                {hiddenSelectedCount > 0 && (
                                    <div className={`shrink-0 flex items-start gap-2 px-3 py-2 rounded-lg border text-xs leading-snug ${isDarkMode ? 'bg-amber-900/30 border-amber-700/60 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-800'}`}>
                                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                        <span>{t.bulkHiddenWarn.replace('{n}', String(hiddenSelectedCount))}</span>
                                    </div>
                                )}
                                {/* ITALIANO: riga responsive — a sinistra scrivi un tag NUOVO (Invio) da applicare alle
                                              foto selezionate; a destra un motore di RICERCA che filtra le pillole sotto. */}
                                {/* ENGLISH: responsive row — left: type a NEW tag (Enter) to apply to the selected
                                             photos; right: a SEARCH box that filters the pills below. */}
                                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                                    <input
                                        type="text"
                                        placeholder={t.bulkAddPlaceholder}
                                        className={`flex-1 min-w-0 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-200 placeholder-gray-500' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'}`}
                                        onKeyDown={(e: any) => {
                                            if (e.key === 'Enter' || e.key === ',') {
                                                e.preventDefault();
                                                // ITALIANO: un elenco incollato diventa un tag per voce (vedi splitTagInput).
                                                // ENGLISH: a pasted list becomes one tag per item (see splitTagInput).
                                                const nuovi = splitTagInput(e.target.value);
                                                if (nuovi.length > 0) {
                                                    setStagedBulkTags(prev => [...prev, ...nuovi.filter(tag => !hasTagIgnoringCase(prev, tag))]);
                                                    e.target.value = '';
                                                    soundManager.pop();
                                                }
                                            }
                                        }}
                                    />
                                    <div className="relative sm:w-72 shrink-0">
                                        <Search size={15} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                                        <input
                                            type="text"
                                            value={bulkSearch}
                                            onChange={e => setBulkSearch(e.target.value)}
                                            placeholder={t.bulkSearchPlaceholder}
                                            className={`w-full border rounded-lg pl-8 pr-7 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-200 placeholder-gray-500' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'}`}
                                        />
                                        {bulkSearch && <button onClick={() => setBulkSearch('')} className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 ${isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}><X size={13} /></button>}
                                    </div>
                                </div>
                                <div className={`flex-1 min-h-0 overflow-y-auto flex flex-wrap content-start gap-3.5 lightbox-scroll p-[10px] border-y ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`} style={{ scrollbarGutter: 'stable' }}>
                                    {(() => {
                                        const q = bulkSearch.trim().toLowerCase();
                                        const displayTags = [...new Set([...allUniqueTags, ...stagedBulkTags])]
                                            .filter(tag => !q || tag.toLowerCase().includes(q))
                                            .sort((a, b) => a.localeCompare(b));
                                        // ITALIANO: PRESTAZIONI — l'insieme dei tag presenti su almeno una foto selezionata si
                                        //           calcola UNA volta sola (ricerca istantanea in un Set), non per ogni pillola.
                                        // ENGLISH: PERF — the set of tags present on at least one selected photo is computed
                                        //           ONCE (instant Set lookup), not per pill.
                                        const selectedIdSet = new Set(selectedForBulk);
                                        const tagsOnSelected = new Set<string>();
                                        for (const im of images) {
                                            if (!selectedIdSet.has(im.id)) continue;
                                            for (const tg of im.tags) tagsOnSelected.add(tg);
                                        }
                                        return displayTags.length === 0 ? <p className="text-xs text-gray-500 italic py-2 w-full text-center">{q ? t.statsNoTagsMatch : t.noTagsInProject}</p> : displayTags.map(tag => {
                                            const category = getTagCategory(tag);
                                            const colorClass = getCategoryColor(category, isDarkMode);
                                            const activeColorClass = getActiveCategoryColor(category);
                                            const isStaged = stagedBulkTags.includes(tag);
                                            const isPartiallySelected = tagsOnSelected.has(tag);

                                            // ITALIANO: TRE stati ben distinti (vedi legenda sotto):
                                            //   1) DA AGGIUNGERE (staged): pieno acceso + anello + spunta.
                                            //   2) GIA' SU ALCUNE: contorno tratteggiato, sfondo trasparente.
                                            //   3) DISPONIBILE: pieno tenue.
                                            // ENGLISH: THREE clearly distinct states (see legend below):
                                            //   1) TO ADD (staged): vivid fill + ring + check.
                                            //   2) ON SOME: dashed outline, transparent bg.
                                            //   3) AVAILABLE: soft fill.
                                            let buttonClass = '';
                                            if (isStaged) {
                                                buttonClass = `${activeColorClass} scale-105 font-bold ring-2 ring-offset-1 ${isDarkMode ? 'ring-white/50 ring-offset-gray-900' : 'ring-black/20 ring-offset-white'}`;
                                            } else if (isPartiallySelected) {
                                                const textColorMatch = colorClass.match(/text-[a-z]+-\d+/);
                                                const textColor = textColorMatch ? textColorMatch[0] : (isDarkMode ? 'text-gray-300' : 'text-gray-600');
                                                const borderColor = textColor.replace('text-', 'border-');
                                                buttonClass = `bg-transparent border-2 border-dashed ${textColor} ${borderColor} ${isDarkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-100'} opacity-90`;
                                            } else {
                                                buttonClass = `${colorClass} border border-transparent hover:brightness-110 shadow-sm`;
                                            }

                                            return (
                                                <button key={tag} onClick={() => setStagedBulkTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} className={`px-2.5 py-1 rounded-full text-xs transition-all flex items-center gap-1 ${buttonClass}`}>
                                                    {category === 'nsfw' && <span className={`font-bold text-[9px] px-1 rounded-sm ${isStaged ? 'bg-white text-red-500' : 'bg-red-500 text-white'}`}>+18</span>}
                                                    {isStaged && <Check size={12} strokeWidth={3} />}
                                                    {tag}
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>
                                {/* ITALIANO: LEGENDA degli stati delle pillole (non solo il tratteggiato). */}
                                {/* ENGLISH: LEGEND of the pill states (not just the dashed one). */}
                                {/* ITALIANO: riga finale — a SINISTRA "Elimina selezionate" (stesso aspetto di
                                              "Resetta Progetto", cosi' si riconosce subito come azione forte), a
                                              DESTRA la legenda dei tre stati delle pillole. Il tasto sposta nel
                                              CESTINO dell'app: e' reversibile, le foto si ripristinano e nessun
                                              file viene toccato su disco finche' non si svuota il cestino. */}
                                {/* ENGLISH: final row — LEFT "Delete selected" (same look as "Reset project", so it
                                             reads at once as a strong action), RIGHT the legend of the three pill
                                             states. The button moves photos to the app's TRASH: reversible, they can
                                             be restored, and no file on disk is touched until the trash is emptied. */}
                                <div className="shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                                    <button onClick={handleMoveSelectedToTrash} title={t.moveToTrash} className={`${bulkPanelBtn} bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white`}>
                                        <Trash size={15} />
                                        <span>{t.deleteSelected}</span>
                                    </button>
                                    <div className={`flex flex-wrap items-center justify-end gap-x-4 gap-y-1.5 text-[10px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    <span className="font-bold uppercase tracking-wide">{t.legendTitle}</span>
                                    <span className="flex items-center gap-1.5">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white ring-2 ring-offset-1 ${isDarkMode ? 'ring-white/50 ring-offset-gray-900' : 'ring-black/20 ring-offset-white'}`}><Check size={10} strokeWidth={3} />tag</span>
                                        {t.legendStaged}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] bg-transparent border-2 border-dashed ${isDarkMode ? 'text-gray-300 border-gray-500' : 'text-gray-600 border-gray-400'}`}>tag</span>
                                        {t.legendOnSome}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] shadow-sm ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>tag</span>
                                        {t.legendAvailable}
                                    </span>
                                    </div>
                                </div>
                                {stagedBulkTags.length > 0 && (
                                    <div className="flex justify-end items-center gap-2 shrink-0 animate-in slide-in-from-right-4">
                                        <button onClick={() => setStagedBulkTags([])} className={`${bulkPanelBtn} ${isDarkMode ? 'bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-gray-100' : 'bg-gradient-to-r from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 text-gray-800'}`}>
                                            <X size={15} />
                                            <span>{t.cancel}</span>
                                        </button>
                                        <button onClick={applyBulkTags} className={`${bulkPanelBtn} bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white`}>
                                            <Check size={15} />
                                            <span>{t.confirm}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isGlobalTagManagerOpen && (
                <div className="fixed inset-0 z-[200] flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsGlobalTagManagerOpen(false)}>
                    <div className={`w-96 max-w-[90vw] h-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-2xl flex flex-col animate-in slide-in-from-right-4`} onClick={e => e.stopPropagation()}>
                        <div className={`p-5 border-b ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-100'} flex justify-between items-center shrink-0`}>
                            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} flex items-center gap-2`}><Tag size={20} className="text-indigo-500"/> {t.projectTagManager}</h2>
                            <button onClick={() => setIsGlobalTagManagerOpen(false)} className={`hover:bg-red-500 hover:text-white rounded-full p-1.5 transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}><X size={16} /></button>
                        </div>
                        <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} shrink-0 flex flex-col gap-3`}>
                             <input
                                type="text"
                                placeholder={t.addTagToProject}
                                onKeyDown={(e: any) => {
                                    if (e.key === 'Enter' || e.key === ',') {
                                        e.preventDefault();
                                        // ITALIANO: un elenco incollato diventa un tag per voce (vedi splitTagInput).
                                        // ENGLISH: a pasted list becomes one tag per item (see splitTagInput).
                                        const nuovi = splitTagInput(e.target.value).filter(tag => !hasTagIgnoringCase(allUniqueTags, tag));
                                        if (nuovi.length > 0) {
                                            setCustomProjectTags(prev => [...prev, ...nuovi.filter(tag => !hasTagIgnoringCase(prev, tag))]);
                                            e.target.value = '';
                                            soundManager.pop();
                                        }
                                    }
                                }}
                                className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner ${isDarkMode ? 'bg-gray-900 border-gray-600 text-gray-100' : 'bg-gray-50 border-gray-300 text-gray-800'}`}
                            />
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleDeleteAllTags}
                                    disabled={allUniqueTags.length === 0}
                                    className={`${tagPanelBtn} bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700`}
                                >
                                    <Trash size={14} />
                                    {t.deleteAllTags}
                                </button>
                                <button
                                    onClick={handleCleanUnusedTags}
                                    disabled={allUniqueTags.length === 0}
                                    className={`${tagPanelBtn} bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600`}
                                >
                                    <RefreshCw size={14} />
                                    {t.cleanUnusedTags}
                                </button>
                            </div>
                            {/* ITALIANO: UN tasto Esporta (formato scelto nella finestra di salvataggio) + UN tasto Importa.
                                          Etichette su due righe per spiegare meglio cosa fanno. */}
                            {/* ENGLISH: ONE Export button (format chosen in the save dialog) + ONE Import button.
                                         Two-line labels to explain them better. */}
                            <div className="flex gap-2">
                                <button onClick={handleExportProjectTags} disabled={allUniqueTags.length === 0} title={t.exportProjectTags} className={`${tagPanelBtn} flex-col gap-0.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700`}>
                                    <span className="flex items-center gap-1.5 text-xs font-bold"><Upload size={14} /> {t.exportProjectTags}</span>
                                    <span className="text-[9px] font-medium opacity-70 leading-none">{t.exportProjectTagsHint}</span>
                                </button>
                                <button onClick={() => projectTagsImportRef.current?.click()} title={t.importProjectTags} className={`${tagPanelBtn} flex-col gap-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700`}>
                                    <span className="flex items-center gap-1.5 text-xs font-bold"><Download size={14} /> {t.importProjectTags}</span>
                                    <span className="text-[9px] font-medium opacity-70 leading-none">{t.importProjectTagsHint}</span>
                                </button>
                                <input type="file" accept=".json,.txt,application/json,text/plain" ref={projectTagsImportRef} className="hidden" onChange={handleImportProjectTags} />
                            </div>
                        </div>
                        <div className={`flex-1 p-4 overflow-y-auto flex flex-wrap content-start gap-3.5 lightbox-scroll ${isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50'}`} style={{ scrollbarGutter: 'stable' }}>
                             {allUniqueTags.length === 0 ? <p className={`text-sm italic w-full text-center mt-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{t.noTagsInProject}</p> :
                             allUniqueTags.map(tag => {
                                const category = getTagCategory(tag);
                                const colorClass = getActiveCategoryColor(category);

                                return (
                                <span key={tag} className={`px-2.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${colorClass}`}>
                                    {category === 'nsfw' && <span className="font-bold text-[9px] bg-white text-red-500 px-1 rounded-sm">+18</span>}
                                    {tag}
                                    <button onClick={() => handleDeleteTagFromProject(tag)} className="hover:bg-red-500 hover:text-white rounded-full p-0.5 transition-colors focus:outline-none text-white/70 hover:text-white">
                                        <X size={10} />
                                    </button>
                                </span>
                             )})}
                        </div>
                    </div>
                </div>
            )}

            {isStatsOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsStatsOpen(false)}>
                    <div className={`w-[90vw] max-w-5xl max-h-[90vh] ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95`} onClick={e => e.stopPropagation()}>
                        <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'} flex justify-between items-center shrink-0`}>
                            <h2 className={`text-xl font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} flex items-center gap-2`}><PieChart size={24} className="text-indigo-500"/> {t.projectStats}</h2>
                            <button onClick={() => setIsStatsOpen(false)} className={`hover:bg-red-500 hover:text-white rounded-full p-2 transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}><X size={20} /></button>
                        </div>
                        
                        <div className={`flex-1 overflow-y-auto p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                            {(() => {
                                // ITALIANO: le statistiche contano SOLO le foto attive, non quelle nel
                                //           cestino. Prima leggevano l'elenco grezzo `images` (che tiene
                                //           anche le cestinate): "Totale immagini", "Senza tag", media e
                                //           conteggi includevano foto gia' buttate, e l'utente cercava
                                //           foto senza tag che nella galleria non esistevano piu'.
                                // ENGLISH: statistics count ONLY active photos, not trashed ones. They
                                //          used to read the raw `images` list (which keeps trashed
                                //          entries): "Total images", "Untagged", the average and the
                                //          counts all included already-discarded photos.
                                const statsImages = images.filter(img => !img.isTrashed);
                                const statsUniqueTags = [...new Set([...statsImages.flatMap(img => img.tags), ...customProjectTags])].sort((a, b) => a.localeCompare(b));
                                const totalImages = statsImages.length;
                                const totalTags = statsUniqueTags.length;
                                const taggedImages = statsImages.filter(img => img.tags && img.tags.length > 0).length;
                                const taggedPercentage = totalImages > 0 ? Math.round((taggedImages / totalImages) * 100) : 0;

                                const categoryCounts: Record<string, number> = {};
                                statsUniqueTags.forEach(tag => {
                                    const cat = getTagCategory(tag);
                                    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
                                });
                                // ITALIANO: nelle fette si mostra il NOME della categoria nella lingua scelta
                                //           (prima compariva l'identificativo grezzo, es. "face_details").
                                // ENGLISH: slices show the category NAME in the chosen language (the raw id,
                                //          e.g. "face_details", used to be displayed instead).
                                const pieData = Object.entries(categoryCounts).map(([name, value]) => ({ name: translateCategory(name, lang, t), value }));
                                const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28'];

                                const tagUsage: Record<string, number> = {};
                                statsImages.forEach(img => {
                                    img.tags.forEach((tag: string) => {
                                        tagUsage[tag] = (tagUsage[tag] || 0) + 1;
                                    });
                                });
                                const barData = Object.entries(tagUsage)
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 10)
                                    .map(([name, value]) => ({ name, value }));

                                // ITALIANO: metriche extra per le statistiche avanzate
                                // ENGLISH: extra metrics for the advanced statistics
                                const untaggedImages = totalImages - taggedImages;
                                const usageValues = Object.values(tagUsage);
                                const totalTagInstances = usageValues.reduce((a, b) => a + b, 0);
                                const avgTagsPerImage = totalImages > 0 ? (totalTagInstances / totalImages).toFixed(1) : '0';
                                const singletonCount = usageValues.filter(c => c === 1).length;
                                const maxUsage = usageValues.length > 0 ? Math.max(...usageValues) : 0;

                                // ITALIANO: lista COMPLETA dei tag (anche quelli mai usati = 0), filtrata e ordinata
                                // ENGLISH: FULL tag list (including never-used ones = 0), filtered and sorted
                                const fullTagList = statsUniqueTags
                                    .map(tag => ({ tag, count: tagUsage[tag] || 0 }))
                                    .filter(x => x.tag.toLowerCase().includes(deferredStatsSearch.toLowerCase()))
                                    .sort((a, b) => statsSort === 'name'
                                        ? a.tag.localeCompare(b.tag)
                                        : (b.count - a.count) || a.tag.localeCompare(b.tag));

                                return (
                                    <div className="flex flex-col gap-8">
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-indigo-50 border-indigo-100'} flex flex-col gap-1`}>
                                                <div className="flex items-center gap-2"><div className="p-1.5 bg-indigo-500 rounded-lg text-white"><ImageIcon size={16} /></div></div>
                                                <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{totalImages}</p>
                                                <p className={`text-[11px] font-medium leading-tight ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t.statsTotalImages}</p>
                                            </div>
                                            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-purple-50 border-purple-100'} flex flex-col gap-1`}>
                                                <div className="flex items-center gap-2"><div className="p-1.5 bg-purple-500 rounded-lg text-white"><Tag size={16} /></div></div>
                                                <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{totalTags}</p>
                                                <p className={`text-[11px] font-medium leading-tight ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t.statsTotalTags}</p>
                                            </div>
                                            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-emerald-50 border-emerald-100'} flex flex-col gap-1`}>
                                                <div className="flex items-center gap-2"><div className="p-1.5 bg-emerald-500 rounded-lg text-white"><Check size={16} /></div></div>
                                                <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{taggedImages} <span className="text-xs font-normal opacity-70">({taggedPercentage}%)</span></p>
                                                <p className={`text-[11px] font-medium leading-tight ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t.statsTaggedImages}</p>
                                            </div>
                                            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-amber-50 border-amber-100'} flex flex-col gap-1`}>
                                                <div className="flex items-center gap-2"><div className="p-1.5 bg-amber-500 rounded-lg text-white"><AlertTriangle size={16} /></div></div>
                                                <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{untaggedImages}</p>
                                                <p className={`text-[11px] font-medium leading-tight ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t.statsUntaggedImages}</p>
                                            </div>
                                            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-cyan-50 border-cyan-100'} flex flex-col gap-1`}>
                                                <div className="flex items-center gap-2"><div className="p-1.5 bg-cyan-500 rounded-lg text-white"><BarChart3 size={16} /></div></div>
                                                <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{avgTagsPerImage}</p>
                                                <p className={`text-[11px] font-medium leading-tight ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t.statsAvgTagsPerImage}</p>
                                            </div>
                                            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-rose-50 border-rose-100'} flex flex-col gap-1`}>
                                                <div className="flex items-center gap-2"><div className="p-1.5 bg-rose-500 rounded-lg text-white"><Sparkles size={16} /></div></div>
                                                <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{singletonCount}</p>
                                                <p className={`text-[11px] font-medium leading-tight ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t.statsSingletonTags}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
                                                <h3 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} flex items-center gap-2`}><PieChart size={20} /> {t.statsCategoryDistribution}</h3>
                                                <div className="h-64 w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <RechartsPieChart>
                                                            <Pie
                                                                data={pieData}
                                                                cx="50%"
                                                                cy="50%"
                                                                labelLine={false}
                                                                outerRadius={80}
                                                                fill="#8884d8"
                                                                dataKey="value"
                                                                /* ITALIANO: etichette disegnate a mano per poterne scegliere il COLORE:
                                                                   di serie Recharts le scrive scure, illeggibili sul tema scuro. */
                                                                /* ENGLISH: hand-drawn labels so their COLOUR can be set: by default
                                                                   Recharts writes them dark, unreadable on the dark theme. */
                                                                label={(props: any) => {
                                                                    const { cx, cy, midAngle, outerRadius, name, percent } = props;
                                                                    const RAD = Math.PI / 180;
                                                                    const r = outerRadius + 18;
                                                                    const x = cx + r * Math.cos(-midAngle * RAD);
                                                                    const y = cy + r * Math.sin(-midAngle * RAD);
                                                                    return (
                                                                        <text
                                                                            x={x} y={y}
                                                                            fill={isDarkMode ? '#e5e7eb' : '#374151'}
                                                                            fontSize={11}
                                                                            textAnchor={x > cx ? 'start' : 'end'}
                                                                            dominantBaseline="central"
                                                                        >
                                                                            {`${name} ${(percent * 100).toFixed(0)}%`}
                                                                        </text>
                                                                    );
                                                                }}
                                                            >
                                                                {pieData.map((_, index) => (
                                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                                ))}
                                                            </Pie>
                                                            {/* ITALIANO: contentStyle colora solo il riquadro. Il titolo e i valori dentro
                                                                la nuvoletta hanno un colore PROPRIO, che Recharts lascia scuro: sul tema
                                                                scuro restavano illeggibili. Servono anche labelStyle e itemStyle. */}
                                                            {/* ENGLISH: contentStyle only colours the box. The label and the values inside
                                                                the tooltip carry their OWN colour, which Recharts leaves dark, so they were
                                                                unreadable on the dark theme. labelStyle and itemStyle are needed too. */}
                                                            <Tooltip
                                                                contentStyle={{ backgroundColor: isDarkMode ? '#1f2937' : '#fff', borderColor: isDarkMode ? '#374151' : '#e5e7eb', borderRadius: 10 }}
                                                                labelStyle={{ color: isDarkMode ? '#f3f4f6' : '#111827', fontWeight: 600 }}
                                                                itemStyle={{ color: isDarkMode ? '#e5e7eb' : '#374151' }}
                                                            />
                                                        </RechartsPieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
                                                <h3 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} flex items-center gap-2`}><BarChart3 size={20} /> {t.statsTopTags}</h3>
                                                <div className="h-64 w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <RechartsBarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} horizontal={false} />
                                                            <XAxis type="number" stroke={isDarkMode ? '#9ca3af' : '#4b5563'} />
                                                            <YAxis dataKey="name" type="category" width={100} stroke={isDarkMode ? '#9ca3af' : '#4b5563'} tick={{ fontSize: 11 }} />
                                                            <Tooltip
                                                                cursor={{ fill: isDarkMode ? '#374151' : '#f3f4f6' }}
                                                                contentStyle={{ backgroundColor: isDarkMode ? '#1f2937' : '#fff', borderColor: isDarkMode ? '#374151' : '#e5e7eb', borderRadius: 10 }}
                                                                labelStyle={{ color: isDarkMode ? '#f3f4f6' : '#111827', fontWeight: 600 }}
                                                                itemStyle={{ color: isDarkMode ? '#e5e7eb' : '#374151' }}
                                                            />
                                                            <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                                                        </RechartsBarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ITALIANO: Lista COMPLETA e scorrevole di TUTTI i tag del progetto, con ricerca,
                                                      ordinamento (per frequenza o A-Z), conteggio d'uso e barra di frequenza. */}
                                        {/* ENGLISH: FULL scrollable list of ALL project tags, with search, sorting
                                                     (by frequency or A-Z), usage count and a frequency bar. */}
                                        <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                                <h3 className={`text-lg font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} flex items-center gap-2`}>
                                                    <Tags size={20} className="text-indigo-500" /> {t.statsAllTags} <span className="text-sm font-normal opacity-60">({fullTagList.length})</span>
                                                </h3>
                                                <div className="flex items-center gap-2">
                                                    <input type="text" value={statsSearch} onChange={e => setStatsSearch(e.target.value)} placeholder={t.statsSearchTag}
                                                        className={`w-40 px-3 py-1.5 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-gray-50 border-gray-300 text-gray-800'}`} />
                                                    <div className={`flex rounded-lg overflow-hidden border shrink-0 ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                                                        <button onClick={() => setStatsSort('count')} className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${statsSort === 'count' ? 'bg-indigo-500 text-white' : (isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100')}`}>{t.statsSortCount}</button>
                                                        <button onClick={() => setStatsSort('name')} className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${statsSort === 'name' ? 'bg-indigo-500 text-white' : (isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100')}`}>{t.statsSortName}</button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="max-h-80 overflow-y-auto lightbox-scroll pr-1 flex flex-col gap-1.5" style={{ scrollbarGutter: 'stable' }}>
                                                {fullTagList.length === 0 ? (
                                                    <p className="text-sm text-gray-500 italic text-center py-6">{t.statsNoTagsMatch}</p>
                                                ) : fullTagList.map(({ tag, count }) => {
                                                    const category = getTagCategory(tag);
                                                    const pct = maxUsage > 0 ? (count / maxUsage) * 100 : 0;
                                                    const imgPct = totalImages > 0 ? Math.round((count / totalImages) * 100) : 0;
                                                    const traduzione = translateTag(tag, lang);
                                                    return (
                                                        // ITALIANO: content-visibility:auto — il browser NON disegna le righe fuori
                                                        //           dallo schermo finche' non le scorri. Con decine di migliaia di tag
                                                        //           la lista resta scorrevole tutta (nessuna funzione tolta), ma pesa
                                                        //           come poche righe. contain-intrinsic-size tiene giusta la barra di
                                                        //           scorrimento riservando l'altezza stimata di ogni riga.
                                                        // ENGLISH: content-visibility:auto — the browser does NOT paint off-screen rows
                                                        //          until you scroll to them. With tens of thousands of tags the whole
                                                        //          list is still scrollable (no feature removed) but costs like a few
                                                        //          rows. contain-intrinsic-size keeps the scrollbar correct by reserving
                                                        //          each row's estimated height.
                                                        <div key={tag} className="flex items-center gap-3 group/riga" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 28px' }}>
                                                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold max-w-[42%] truncate flex items-center ${getCategoryColor(category, isDarkMode)}`} title={traduzione ? `${tag} — ${traduzione}` : tag}>
                                                                {category === 'nsfw' && <span className="font-bold text-[8px] px-1 rounded-sm mr-0.5 bg-red-500 text-white shrink-0">+18</span>}
                                                                <span className="truncate">{tag}</span>
                                                            </span>
                                                            {/* ITALIANO: copia il singolo tag negli appunti (compare passandoci sopra) */}
                                                            {/* ENGLISH: copies the single tag to the clipboard (appears on hover) */}
                                                            <button
                                                                onClick={() => {
                                                                    navigator.clipboard?.writeText(tag)
                                                                        .then(() => { soundManager.pop(); showNotification(`${t.statsTagCopied}: ${tag}`, 'success'); })
                                                                        .catch(() => showNotification(t.importTagsError, 'error'));
                                                                }}
                                                                title={t.statsCopyTag}
                                                                className={`shrink-0 p-1 rounded-md opacity-0 group-hover/riga:opacity-100 transition-all ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-200'}`}
                                                            >
                                                                <Copy size={12} />
                                                            </button>
                                                            <div className={`flex-1 h-2.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                                                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                                            </div>
                                                            <span className={`shrink-0 text-xs font-bold tabular-nums w-10 text-right ${count === 0 ? 'opacity-40' : ''} ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{count}</span>
                                                            <span className={`shrink-0 text-[10px] tabular-nums w-9 text-right ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{imgPct}%</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
