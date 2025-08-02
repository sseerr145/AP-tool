/**
 * Global rendering state manager to prevent canvas conflicts
 */

class RenderingStateManager {
  constructor() {
    this.isRendering = false;
    this.queue = [];
  }

  async executeRender(renderFunction, context = 'unknown') {
    return new Promise((resolve, reject) => {
      const task = {
        execute: renderFunction,
        resolve,
        reject,
        context
      };

      this.queue.push(task);
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isRendering || this.queue.length === 0) return;

    this.isRendering = true;
    const task = this.queue.shift();

    try {
      console.log(`🎨 Starting render task: ${task.context}`);
      const result = await task.execute();
      task.resolve(result);
    } catch (error) {
      console.error(`❌ Render task failed: ${task.context}`, error);
      task.reject(error);
    } finally {
      this.isRendering = false;
      console.log(`✅ Completed render task: ${task.context}`);
      
      // Process next task after a small delay
      setTimeout(() => {
        this.processQueue();
      }, 100);
    }
  }

  isCurrentlyRendering() {
    return this.isRendering;
  }

  getQueueLength() {
    return this.queue.length;
  }
}

// Global singleton instance
export const renderingManager = new RenderingStateManager();