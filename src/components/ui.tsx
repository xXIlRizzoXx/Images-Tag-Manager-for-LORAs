/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: COMPONENTI DELL'INTERFACCIA                                     **
**  Qui ci sono i pezzi riutilizzabili dell'app, come i tasti, le levette     **
**  e i messaggi di notifica che compaiono sullo schermo.                     **
**                                                                            **
**  ENGLISH: INTERFACE COMPONENTS                                             **
**  Here are the reusable pieces of the app, such as buttons, toggles,        **
**  and notification messages that appear on the screen.                      **
**                                                                            **
*******************************************************************************
*******************************************************************************/
import React, { useState, useRef, useEffect } from 'react';
import { X, TriangleAlert, Info, Check, Download, FileArchive, Images, FileText } from 'lucide-react';
import { soundManager } from '../utils/soundManager';

// ITALIANO: Levetta stile Apple per attivare/disattivare opzioni
// ENGLISH: Apple-style toggle to turn options on/off
export const AppleToggle = ({ checked, onChange, iconOn, iconOff, colorClass = "bg-green-500" }: any) => (
    <div onClick={() => { onChange(!checked); if(!checked) soundManager.pop(); else soundManager.click(); }} className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out shadow-inner shrink-0 ${checked ? colorClass : 'bg-gray-100 ring-1 ring-inset ring-gray-300 dark:bg-gray-600 dark:ring-0'}`}>
        <div className={`bg-white w-4 h-4 rounded-full shadow-md ring-1 ring-black/10 transform transition-transform duration-300 ease-in-out flex justify-center items-center ${checked ? 'translate-x-6' : 'translate-x-0'}`}>
        <span className={`w-3 h-3 flex items-center justify-center ${!checked && iconOff ? 'text-yellow-500' : 'text-gray-800'}`}>{checked ? iconOn : iconOff}</span>
        </div>
    </div>
);

// ITALIANO: Campo di inserimento per i tag con suggerimenti e cancellazione
// ENGLISH: Input field for tags with suggestions and deletion
import { getTagCategory, getCategoryColor, getActiveCategoryColor } from '../utils/tagCategorization';
import { translateTag } from '../utils/tagTranslation';
import { hasTagIgnoringCase, uniqueTagsIgnoringCase } from '../utils/tagCase';

// ITALIANO: `lang` serve a mostrare la traduzione del tag al passaggio del mouse: prima
//           accadeva solo nel visualizzatore a foto singola, non sulle miniature.
// ENGLISH: `lang` is what enables the hover translation of a tag: it used to happen only in
//          the single-photo viewer, never on the gallery thumbnails.
export const TagInput = ({ tags, setTags, placeholder = "", isGlobal = false, maxHeight = "max-h-[120px]", isDarkMode = true, readOnly = false, lang = 'it' }: any) => {
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    
    const handleKeyDown = (e: any) => {
        if (readOnly) return;
        if (e.key === ',' || e.key === 'Enter') {
            e.preventDefault();
            const newTag = inputValue.trim().replace(/,$/, '');
            // ITALIANO: "Smile" su una foto che ha "smile" non e' un tag nuovo (vedi tagCase).
            // ENGLISH: "Smile" on a photo that has "smile" is not a new tag (see tagCase).
            if (newTag && !hasTagIgnoringCase(tags, newTag)) { setTags([...tags, newTag]); setInputValue(''); soundManager.pop(); }
        } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
            setTags(tags.slice(0, -1)); soundManager.click();
        }
    };

    const handlePaste = (e: any) => {
        if (readOnly) return;
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text');
        const newTags = uniqueTagsIgnoringCase(pasteData.split(/[,\n\r]+/)
            .map((t: string) => t.trim())
            .filter((t: string) => t && !hasTagIgnoringCase(tags, t)));
        
        if (newTags.length > 0) {
            setTags([...tags, ...newTags]);
            soundManager.pop();
        }
    };

    const removeTag = (idx: number) => { 
        if (readOnly) return;
        setTags(tags.filter((_: any, i: number) => i !== idx)); 
        soundManager.click(); 
    };
    
    return (
        <div onClick={() => !readOnly && inputRef.current?.focus()} className={`flex flex-wrap items-center content-start gap-3.5 p-2 border rounded-xl transition-all w-full min-h-[46px] overflow-y-auto lightbox-scroll ${readOnly ? 'cursor-default' : 'cursor-text'} ${maxHeight} ${isGlobal ? 'justify-center bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700/50 focus-within:ring-2 focus-within:ring-indigo-500/50' : 'bg-white dark:bg-gray-800/50 border-gray-300 dark:border-gray-700 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500'}`}>
        {tags.map((tag: string, index: number) => {
            const category = getTagCategory(tag);
            const isNsfw = category === 'nsfw';
            const colorClass = getActiveCategoryColor(category);
            
            const traduzione = translateTag(tag, lang);
            return (
                <span key={index} title={traduzione ? `${tag} — ${traduzione}` : tag} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] leading-tight font-medium animate-in zoom-in duration-200 ${colorClass}`}>
                    {isNsfw && <span className="font-bold text-[9px] bg-white text-red-500 px-1 rounded-sm mr-0.5">+18</span>}
                    {tag}
                    {!readOnly && (
                        <button onClick={(e) => { e.stopPropagation(); removeTag(index); }} className="hover:bg-black/10 dark:hover:bg-black/20 rounded-full p-0.5 transition-colors focus:outline-none"><X size={10} /></button>
                    )}
                </span>
            );
        })}
        {!readOnly && (
            <input 
                ref={inputRef}
                type="text" 
                value={inputValue} 
                onChange={(e) => setInputValue(e.target.value)} 
                onKeyDown={handleKeyDown} 
                onPaste={handlePaste}
                placeholder={placeholder}
                className={`w-full bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-700 dark:placeholder-gray-400 text-sm py-1 px-1 ${isGlobal ? 'text-center' : ''}`} 
            />
        )}
        </div>
    );
};

// ITALIANO: Messaggio a comparsa (notifica) in basso a destra
// ENGLISH: Pop-up message (notification) at the bottom right
export const Toast = ({ message, type, onClose, id }: any) => {
    // ITALIANO: i 4 secondi partono con ogni notifica NUOVA (testo, tipo o `id` diversi: l'id
    //           cambia anche quando torna lo stesso testo, es. "Tag copiati" due volte di fila).
    //           Prima dipendevano da onClose, che App crea nuova a ogni disegno: scrivendo nella
    //           ricerca, o durante "Tagga tutte con AI" veloce, ripartivano a ogni disegno e il
    //           messaggio non spariva piu'. La chiusura usata e' sempre l'ultima ricevuta.
    // ENGLISH: the 4 seconds start with every NEW notification (different text, type or `id`: the
    //          id changes even when the same text comes back, e.g. "Tags copied" twice in a row).
    //          They used to depend on onClose, which App creates anew on every render: typing in
    //          the search, or a fast "Auto-tag all with AI", restarted them on every render and
    //          the message never went away. The close function used is always the latest one.
    const chiudiRef = useRef(onClose);
    useEffect(() => { chiudiRef.current = onClose; });
    useEffect(() => { const timer = setTimeout(() => chiudiRef.current(), 4000); return () => clearTimeout(timer); }, [message, type, id]);
    const bgColor = type === 'error' ? 'bg-red-600' : 'bg-emerald-500';
    const infoColor = type === 'info' ? 'bg-blue-600' : bgColor;
    return (
        <div className={`fixed bottom-8 right-8 flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl text-white ${infoColor} animate-in slide-in-from-bottom-10 fade-in z-[9999] w-max max-w-[90vw]`}>
            {type === 'error' ? <TriangleAlert size={18} /> : type === 'info' ? <Info size={18} /> : <Check size={18} />}
            {/* ITALIANO: va a capo solo quando supera il 90% della finestra (w-max lo tiene su una riga
                altrimenti): un avviso fatto di frasi intere puo' essere lungo, e con nowrap usciva
                dallo schermo. ENGLISH: wraps only past 90% of the window (w-max keeps it on one line
                otherwise): a notice made of whole sentences can be long, and with nowrap it ran off
                the screen. */}
            <span className="font-medium text-sm">{message}</span>
            <button onClick={onClose} className="ml-2 hover:bg-black/20 rounded-full p-1 transition-colors"><X size={14} /></button>
        </div>
    );
};

// ITALIANO: Finestra di dialogo per confermare azioni importanti
// ENGLISH: Dialog box to confirm important actions
/**
 * ITALIANO: Finestra a due scelte per le NOTIZIE, non per i pericoli. Serve due volte:
 *   per chiedere una sola volta se controllare gli aggiornamenti, e per dire che ne e'
 *   uscito uno. Perche' non riusare CustomConfirmDialog: quella ha il triangolo rosso, il
 *   tasto rosso, e usa il TITOLO come etichetta del tasto - qui verrebbe un pulsante che
 *   dice "E' uscita una versione nuova". Qui le due etichette arrivano da fuori, cosi'
 *   dicono che cosa fa il tasto.
 *
 * ENGLISH: A two-choice dialog for NEWS, not for danger. Used twice: to ask once whether to
 *   check for updates, and to say one has come out. CustomConfirmDialog is not reused
 *   because it carries a red triangle, a red button, and uses the TITLE as the button
 *   label - which here would produce a button reading "A newer version is out". These two
 *   labels are passed in, so each button says what it does.
 */
/**
 * ITALIANO: Scelta di cosa mettere nell'archivio: solo i .txt con i tag, oppure anche le foto.
 *   La scelta si fa ogni volta e non ha un valore preferito salvato, perche' le due strade
 *   pesano in modo molto diverso: pochi KB contro parecchi GB. Sotto ogni voce c'e' il numero
 *   di file e il peso, cosi' nessuno si ritrova un archivio da 12 GB per aver premuto un tasto
 *   che credeva leggero.
 *
 * ENGLISH: Choice of what goes into the archive: only the .txt files with the tags, or the
 *   photos as well. It is asked every time and no preference is stored, because the two roads
 *   weigh wildly differently: a few KB against several GB. Each option shows its file count and
 *   size, so nobody ends up with a 12 GB archive from a button they thought was light.
 */
export const ExportChoiceDialog = ({ isOpen, riepilogo, t, isDarkMode, onConfirm, onCancel }: any) => {
    const [conImmagini, setConImmagini] = React.useState(false);
    const [rinomina, setRinomina] = React.useState(false);
    React.useEffect(() => { if (isOpen) { setConImmagini(false); setRinomina(false); } }, [isOpen]);
    if (!isOpen || !riepilogo) return null;

    const voce = (attiva: boolean, icona: any, titolo: string, dati: any, onClick: () => void) => (
        <button
            onClick={onClick}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-start gap-3 ${attiva
                ? 'border-indigo-500 ring-2 ring-indigo-500/40 ' + (isDarkMode ? 'bg-indigo-900/25' : 'bg-indigo-50')
                : (isDarkMode ? 'border-gray-700 hover:bg-gray-700/40' : 'border-gray-200 hover:bg-gray-50')}`}
        >
            <span className={`mt-0.5 shrink-0 ${attiva ? 'text-indigo-500' : (isDarkMode ? 'text-gray-500' : 'text-gray-400')}`}>{icona}</span>
            <span className="min-w-0">
                <span className={`block text-sm font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{titolo}</span>
                <span className={`block text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {(t.exportFilesAndSize || 'Files: {n} · about {size}').replace('{n}', String(dati.file)).replace('{size}', dati.peso)}
                </span>
            </span>
        </button>
    );

    const sceltaNome = (attiva: boolean, testo: string, onClick: () => void) => (
        <button
            onClick={onClick}
            className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all flex items-center gap-2 ${attiva
                ? 'border-indigo-500 ' + (isDarkMode ? 'bg-indigo-900/25 text-gray-100' : 'bg-indigo-50 text-gray-900')
                : (isDarkMode ? 'border-gray-700 text-gray-400 hover:bg-gray-700/40' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}`}
        >
            <span className={`w-3 h-3 rounded-full border-2 shrink-0 ${attiva ? 'border-indigo-500 bg-indigo-500' : (isDarkMode ? 'border-gray-600' : 'border-gray-300')}`} />
            {testo}
        </button>
    );

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
            <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl shadow-2xl border w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200`}>
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4 text-indigo-500 dark:text-indigo-400">
                        <FileArchive size={24} />
                        <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t.exportChoiceTitle}</h3>
                    </div>
                    <div className="flex flex-col gap-2">
                        {voce(!conImmagini, <FileText size={18} />, t.exportOnlyTags, riepilogo.soloTag, () => setConImmagini(false))}
                        {voce(conImmagini, <Images size={18} />, t.exportTagsAndImages, riepilogo.conImmagini, () => setConImmagini(true))}
                    </div>
                    {conImmagini && (
                        <>
                            {/* ITALIANO: la scelta dei nomi compare SOLO con le foto dentro. Rinominare i
                                soli .txt darebbe file che non corrispondono piu' a nessuna immagine sul
                                disco: sarebbero inservibili, quindi la domanda li' non si fa nemmeno.
                                ENGLISH: the naming choice appears ONLY when the photos are in. Renaming the
                                .txt alone would produce files matching no image on disk -- useless, so the
                                question is not even asked there. */}
                            <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                                <p className={`text-xs font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{t.exportNamesTitle}</p>
                                <div className="flex flex-col gap-2">
                                    {sceltaNome(!rinomina, t.exportKeepNames, () => setRinomina(false))}
                                    {sceltaNome(rinomina, t.exportRenameSeq, () => setRinomina(true))}
                                </div>
                            </div>
                            <p className={`text-[11px] leading-snug mt-3 ${isDarkMode ? 'text-amber-300/80' : 'text-amber-700'}`}>{rinomina ? t.exportRenameHint : t.exportSizeWarn}</p>
                        </>
                    )}
                </div>
                <div className={`${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-100'} px-6 py-4 flex justify-end gap-3 border-t`}>
                    <button onClick={onCancel} className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200'}`}>{t.cancel}</button>
                    <button onClick={() => onConfirm(conImmagini, conImmagini && rinomina)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all active:scale-95">{t.exportStart}</button>
                </div>
            </div>
        </div>
    );
};

export const UpdateDialog = ({ isOpen, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, isDarkMode }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
            <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl shadow-2xl border w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200`}>
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-3 text-indigo-500 dark:text-indigo-400">
                        <Download size={24} />
                        <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} leading-relaxed ml-9`}>{message}</p>
                </div>
                <div className={`${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-100'} px-6 py-4 flex justify-end gap-3 border-t`}>
                    <button onClick={onCancel} className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200'}`}>{cancelLabel}</button>
                    <button onClick={onConfirm} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all active:scale-95">{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
};

export const CustomConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, t, isDarkMode }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
            <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl shadow-2xl border w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200`}>
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-3 text-red-500 dark:text-red-400">
                        <TriangleAlert size={24} />
                        <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} leading-relaxed ml-9`}>{message}</p>
                </div>
                <div className={`${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-100'} px-6 py-4 flex justify-end gap-3 border-t`}>
                    <button onClick={onCancel} className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200'}`}>{t.cancel}</button>
                    <button onClick={onConfirm} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 shadow-md shadow-red-500/20 transition-all active:scale-95">{title}</button>
                </div>
            </div>
        </div>
    );
};

/**
 * ITALIANO: Finestra con TRE scelte, usata quando si chiude il progetto con modifiche
 *   non salvate:
 *     - Salva e chiudi        (verde)   salva i tag e poi chiude
 *     - Chiudi senza salvare  (rosso)   chiude buttando via le modifiche
 *     - Annulla               (arancio) non fa nulla, resta tutto com'e'
 *   Il tasto verde si disabilita durante il salvataggio, per non farlo premere due volte.
 *
 * ENGLISH: THREE-choice dialog, used when closing the project with unsaved changes:
 *     - Save and close        (green)  saves the tags, then closes
 *     - Close without saving  (red)    closes and discards the changes
 *     - Cancel                (orange) does nothing
 *   The green button is disabled while saving, so it cannot be pressed twice.
 */
export const SaveBeforeCloseDialog = ({ isOpen, title, message, isSaving, onSave, onDiscard, onCancel, t, isDarkMode }: any) => {
    if (!isOpen) return null;
    // ITALIANO: z-[500], sopra l'editor dei file di tag (320/340), la finestra della API key (400) e
    //           le altre finestre: la X della finestra puo' arrivare con una di loro aperta, e la
    //           domanda restava nascosta sotto (la X sembrava morta). Sopra restano solo la schermata
    //           di avvio, la scelta della lingua e i messaggi a comparsa.
    // ENGLISH: z-[500], above the Tag file editor (320/340), the API key dialog (400) and the other
    //          dialogs: the window X can arrive with one of them open, and the question stayed hidden
    //          underneath (the X looked dead). Only the splash, the language picker and the toasts
    //          stay above.
    return (
        <div className="fixed inset-0 z-[500]flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
            <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl shadow-2xl border w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200`}>
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-3 text-amber-500 dark:text-amber-400">
                        <TriangleAlert size={24} />
                        <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} leading-relaxed ml-9`}>{message}</p>
                </div>
                <div className={`${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-100'} px-6 py-4 flex flex-col sm:flex-row gap-2.5 border-t`}>
                    <button
                        onClick={onSave}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t.saveAndClose}
                    </button>
                    <button
                        onClick={onDiscard}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t.closeWithoutSaving}
                    </button>
                    <button
                        onClick={onCancel}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t.cancel}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ITALIANO: Finestra che mostra cosa è stato trovato durante l'importazione
// ENGLISH: Window showing what was found during import
export const ImportSummaryDialog = ({ isOpen, summary, onConfirm, onCancel, t, isDarkMode }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
            <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl shadow-2xl border w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200`}>
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4 text-indigo-500 dark:text-indigo-400">
                        <Info size={24} />
                        <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t.importSummaryTitle}</h3>
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>{t.importSummaryMsg}</p>
                    <div className={`space-y-3 ${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-100'} p-4 rounded-xl border`}>
                        <div className="flex justify-between items-center">
                            <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t.imagesFound}</span>
                            <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{summary.imagesCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t.textFilesFound}</span>
                            <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{summary.textFilesCount}</span>
                        </div>
                        <div className={`h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} my-2`}></div>
                        <div className="flex justify-between items-center">
                            <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t.imagesWithText}</span>
                            <span className={`text-sm font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{summary.imagesWithText}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t.imagesWithoutText}</span>
                            <span className={`text-sm font-bold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{summary.imagesWithoutText}</span>
                        </div>
                    </div>
                </div>
                <div className={`${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-100'} px-6 py-4 flex justify-end gap-3 border-t`}>
                    <button onClick={onCancel} className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200'}`}>{t.cancel}</button>
                    <button onClick={onConfirm} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all active:scale-95">{t.importButton}</button>
                </div>
            </div>
        </div>
    );
};
