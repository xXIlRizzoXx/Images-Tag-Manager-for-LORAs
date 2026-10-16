/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: AVVISO SULLA QUALITA' DI UNA FOTO                               **
**  Regola pura, senza React: la usano la galleria, il cestino e il           **
**  visualizzatore, e le prove la possono eseguire da sola.                   **
**                                                                            **
**  ENGLISH: WARNING ABOUT A PHOTO'S QUALITY                                  **
**  Pure rule, no React: the gallery, the trash and the viewer use it, and    **
**  the tests can run it on its own.                                          **
**                                                                            **
*******************************************************************************
*******************************************************************************/

// ITALIANO: sotto questi pixel (1 megapixel, 1024x1024) la foto e' piccola per il training.
// ENGLISH: below these pixels (1 megapixel, 1024x1024) the photo is small for training.
const MIN_TRAINING_PIXELS = 1048576;

// ITALIANO: 'unreadable' = il programma non ha potuto leggere la foto (larghezza o altezza 0: TIFF,
//   HEIC o un file rovinato, che Chromium non sa mostrare); 'low' = sotto 1 megapixel; 'ok' = niente
//   da dire. Prima 0x0 contava come misura e la foto risultava "sotto 1 megapixel: 0x0 (0.00 MP)".
// ENGLISH: 'unreadable' = the program could not read the photo (width or height 0: TIFF, HEIC or a
//   damaged file, which Chromium cannot display); 'low' = below 1 megapixel; 'ok' = nothing to say.
//   0x0 used to count as a measurement and the photo came out as "below 1 megapixel: 0x0 (0.00 MP)".
export const qualityState = (width: number, height: number): 'unreadable' | 'low' | 'ok' => {
    if (!(width > 0 && height > 0)) return 'unreadable';
    return width * height < MIN_TRAINING_PIXELS ? 'low' : 'ok';
};

// ITALIANO: il testo dell'avviso giallo, o null quando non serve un avviso.
// ENGLISH: the yellow warning's text, or null when no warning is needed.
export const qualityWarningText = (t: any, width: number, height: number): string | null => {
    const stato = qualityState(width, height);
    if (stato === 'unreadable') return t.imageUnreadable;
    if (stato === 'low') return `${t.minQualityWarning}\n${t.imageQualityLabel}: ${width}x${height} (${(width * height / 1000000).toFixed(2)} MP)`;
    return null;
};
