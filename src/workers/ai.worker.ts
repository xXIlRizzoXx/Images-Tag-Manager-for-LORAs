
import { pipeline, env } from '@xenova/transformers';

// Skip local model checks
env.allowLocalModels = false;

// Use the Singleton pattern to enable lazy construction of the pipeline.
class CaptioningPipeline {
  static task = 'image-to-text';
  static model = 'Xenova/vit-gpt2-image-captioning';
  static instance: any = null;

  static async getInstance(progress_callback: any = null) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
    const { type, data } = event.data;

    if (type === 'generate') {
        try {
            const captioner = await CaptioningPipeline.getInstance((x: any) => {
                self.postMessage({ type: 'progress', data: x });
            });

            const result = await captioner(data.imageUrl);
            self.postMessage({ type: 'result', data: result });
        } catch (error: any) {
            self.postMessage({ type: 'error', data: error.message });
        }
    }
});
