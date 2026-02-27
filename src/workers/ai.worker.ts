
/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: LAVORATORE INTELLIGENZA ARTIFICIALE                             **
**  Questo file si occupa di far funzionare l'IA in sottofondo.               **
**  Analizza le immagini per suggerire i tag senza rallentare il programma.   **
**                                                                            **
**  ENGLISH: ARTIFICIAL INTELLIGENCE WORKER                                   **
**  This file handles running the AI in the background.                       **
**  It analyzes images to suggest tags without slowing down the program.      **
**                                                                            **
*******************************************************************************
*******************************************************************************/
import { pipeline, env } from '@xenova/transformers';

// ITALIANO: Salta i controlli dei modelli locali
// ENGLISH: Skip local model checks
env.allowLocalModels = false;

// ITALIANO: Usa il pattern Singleton per consentire la costruzione pigra della pipeline.
// ENGLISH: Use the Singleton pattern to enable lazy construction of the pipeline.
class ClassificationPipeline {
  static task = 'image-classification';
  static model = 'Xenova/vit-base-patch16-224';
  static instance: any = null;

  static async getInstance(progress_callback: any = null) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task as any, this.model, { progress_callback });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
    const { type, data } = event.data;

    if (type === 'generate') {
        try {
            const classifier = await ClassificationPipeline.getInstance((x: any) => {
                self.postMessage({ type: 'progress', data: x });
            });

            const result = await classifier(data.imageUrl, { topk: data.maxTags || 10 });
            self.postMessage({ type: 'result', data: result });
        } catch (error: any) {
            self.postMessage({ type: 'error', data: error.message });
        }
    }
});
