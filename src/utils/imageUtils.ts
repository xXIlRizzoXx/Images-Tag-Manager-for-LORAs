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
export const generateThumbnail = async (file: File): Promise<{ url: string, width: number, height: number } | null> => {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            resolve({ url, width: img.width, height: img.height });
        };
        img.onerror = () => {
            resolve({ url, width: 0, height: 0 }); // Fallback if image fails to load dimensions
        };
        img.src = url;
    });
};
