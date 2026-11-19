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

// ITALIANO: sotto questi pixel (1 megapixel = 1.000.000 di pixel, come i megapixel mostrati) la foto
//   e' piccola per il training. Prima la soglia era 1024x1024 (1.048.576): le misure dei bucket SDXL
//   come 896x1152 (1,03 MP) ricevevano l'avviso «almeno 1 megapixel».
// ENGLISH: below these pixels (1 megapixel = 1,000,000 pixels, like the megapixels shown) the photo
//   is small for training. The threshold used to be 1024x1024 (1,048,576): SDXL bucket sizes such as
//   896x1152 (1.03 MP) got the "at least 1 megapixel" warning.
const MIN_TRAINING_PIXELS = 1000000;

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

// ITALIANO: il testo dell'avviso giallo, o null quando non serve un avviso. `lang` = la lingua scelta:
//   i megapixel hanno il decimale come le Statistiche e il peso dell'esportazione (punto in inglese,
//   cinese e giapponese, virgola altrove; senza lingua il punto). La seconda riga e' una frase intera
//   con {w}, {h}, {mp} (imageQualityLabel): prima era incollata qui, col punto in tutte le lingue e
//   senza lo spazio francese prima dei due punti.
// ENGLISH: the yellow warning's text, or null when no warning is needed. `lang` = the chosen language:
//   the megapixels get the decimal of the Statistics and of the export size (a point in English,
//   Chinese and Japanese, a comma elsewhere; with no language a point). The second line is a whole
//   sentence with {w}, {h}, {mp} (imageQualityLabel): it used to be glued here, with a point in every
//   language and without the French space before the colon.
export const qualityWarningText = (t: any, width: number, height: number, lang?: string): string | null => {
    const stato = qualityState(width, height);
    if (stato === 'unreadable') return t.imageUnreadable;
    if (stato === 'low') {
        const punto = !lang || lang === 'en' || lang === 'zh' || lang === 'ja';
        // ITALIANO: arrotondato per difetto, cosi' una foto sotto la soglia non mostra mai «1,00 MP».
        // ENGLISH: rounded down, so a photo below the threshold never shows "1.00 MP".
        const mp = (Math.floor(width * height / 10000) / 100).toFixed(2).replace('.', punto ? '.' : ',');
        const misura = String(t.imageQualityLabel).replace('{w}', String(width)).replace('{h}', String(height)).replace('{mp}', mp);
        return `${t.minQualityWarning}\n${misura}`;
    }
    return null;
};
