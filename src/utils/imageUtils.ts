/******************************************************************************
**                                                                            **
**  ITALIANO: STRUMENTI PER LE IMMAGINI                                       **
**  Contiene funzioni che aiutano a gestire le foto, come la creazione        **
**  delle piccole anteprime che vedi nella galleria.                          **
**                                                                            **
**  ENGLISH: IMAGE UTILITIES                                                  **
**  Contains functions that help manage photos, such as creating              **
**  the small thumbnails you see in the gallery.                              **
**                                                                            **
*******************************************************************************/
export const generateThumbnail = async (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 400; 
            let width = img.width;
            let height = img.height;
            if (width > height && width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
            } else if (height > width && height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
    });
};
