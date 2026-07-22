/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: STRUMENTI PER LE IMMAGINI                                       **
**  Contiene funzioni che aiutano a gestire le foto, come la creazione        **
**  delle piccole anteprime che vedi nella galleria.                          **
**                                                                            **
**  ENGLISH: IMAGE UTILITIES                                                  **
**  Contains functions that help manage photos, such as creating              **
**  the small thumbnails you see in the gallery.                              **
**                                                                            **
*******************************************************************************
*******************************************************************************/

// ITALIANO: Lato massimo (in pixel) della miniatura. La galleria mostra le foto
//           molto piccole, quindi ~420px bastano e avanzano anche in modalita'
//           "quadrata" con lo zoom al massimo.
// ENGLISH: Max side (px) of the thumbnail. The gallery shows photos very small,
//          so ~420px is plenty, even in "square" mode at max zoom.
const THUMB_MAX_SIDE = 420;
const THUMB_TYPE = 'image/webp';
const THUMB_QUALITY = 0.82;

// ITALIANO: Percorso di riserva usato solo se il browser non ha createImageBitmap
//           o se la decodifica fallisce: torna al vecchio comportamento (URL
//           all'immagine intera) cosi' la foto si vede comunque.
// ENGLISH: Fallback used only if the browser lacks createImageBitmap or decoding
//          fails: reverts to the old behavior (URL to the full image) so the
//          photo still shows.
const fallbackFullImage = (file: File): Promise<{ url: string, width: number, height: number } | null> =>
    new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => resolve({ url, width: img.width, height: img.height });
        img.onerror = () => resolve({ url, width: 0, height: 0 });
        img.src = url;
    });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> =>
    new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * ITALIANO: Crea una VERA miniatura ridotta. Fondamentale per le prestazioni:
 *   prima questa funzione restituiva l'immagine a piena risoluzione, quindi la
 *   galleria teneva in memoria decine di foto enormi e si impallava. Ora la foto
 *   viene ridisegnata piccola su una tela e salvata come immagine leggera;
 *   l'originale ad alta risoluzione viene liberato subito e ricaricato solo
 *   quando apri la singola immagine.
 *   Le dimensioni restituite (width/height) restano quelle ORIGINALI, perche'
 *   servono all'avviso "qualita' minima" nel visualizzatore.
 *
 * ENGLISH: Builds a REAL downscaled thumbnail. Critical for performance: this
 *   function used to return the full-resolution image, so the gallery kept
 *   dozens of huge photos in memory and choked. Now the photo is redrawn small
 *   onto a canvas and stored as a light image; the full-res original is freed
 *   immediately and only reloaded when you open the single image.
 *   The returned width/height stay the ORIGINAL ones, because the viewer's
 *   "minimum quality" warning needs them.
 */
export const generateThumbnail = async (file: File): Promise<{ url: string, width: number, height: number } | null> => {
    if (typeof createImageBitmap !== 'function') {
        return fallbackFullImage(file);
    }

    let bitmap: ImageBitmap | null = null;
    try {
        bitmap = await createImageBitmap(file);
    } catch (_) {
        return fallbackFullImage(file);
    }

    const ow = bitmap.width;
    const oh = bitmap.height;

    try {
        const scale = Math.min(1, THUMB_MAX_SIDE / Math.max(ow, oh || 1));
        const tw = Math.max(1, Math.round(ow * scale));
        const th = Math.max(1, Math.round(oh * scale));

        const canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            bitmap.close();
            return { url: URL.createObjectURL(file), width: ow, height: oh };
        }
        ctx.drawImage(bitmap, 0, 0, tw, th);
        bitmap.close();
        bitmap = null;

        let blob = await canvasToBlob(canvas, THUMB_TYPE, THUMB_QUALITY);
        // ITALIANO: se il browser non sa scrivere WebP, ripiega su JPEG.
        // ENGLISH: if the browser cannot encode WebP, fall back to JPEG.
        if (!blob) blob = await canvasToBlob(canvas, 'image/jpeg', THUMB_QUALITY);
        if (!blob) return { url: URL.createObjectURL(file), width: ow, height: oh };

        return { url: URL.createObjectURL(blob), width: ow, height: oh };
    } catch (_) {
        if (bitmap) { try { bitmap.close(); } catch (_e) { /* ignore */ } }
        return { url: URL.createObjectURL(file), width: ow, height: oh };
    }
};
