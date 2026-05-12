/**
 * Global AI Task Queue
 * เพื่อจำกัดจำนวนการเรียก AI (OpenRouter) พร้อมกันทั้งบอท
 * ป้องกันการติด Rate Limit และลดภาระของระบบเมี๊ยว🐾
 */
class AIQueue {
    constructor(concurrency = 2) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }

    /**
     * เพิ่มงานเข้าคิวและรอให้ประมวลผลเมี๊ยว🐾
     * @param {Function} taskFn ฟังก์ชันที่ส่งค่า Promise กลับมา
     * @returns {Promise<any>}
     */
    async run(taskFn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ taskFn, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.running >= this.concurrency || this.queue.length === 0) {
            return;
        }

        const { taskFn, resolve, reject } = this.queue.shift();
        this.running++;
        const startTime = Date.now();
        const taskId = Math.random().toString(36).substring(7);

        console.log(`[Queue Info] Task ${taskId} started. Running: ${this.running}, Waiting: ${this.queue.length}`);

        try {
            const result = await taskFn();
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`[Queue Info] Task ${taskId} completed in ${duration}s.`);
            resolve(result);
        } catch (error) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.error(`[Queue Info] Task ${taskId} failed after ${duration}s:`, error.message || error);
            reject(error);
        } finally {
            this.running--;
            this.process();
        }
    }

    /**
     * ดึงจำนวนงานที่รออยู่ในคิวเมี๊ยว🐾
     */
    get queueLength() {
        return this.queue.length;
    }
}

// สร้าง Instance เดียวสำหรับใช้ทั้งระบบ (Singleton) เมี๊ยว🐾
const globalAIQueue = new AIQueue(4); // ปรับเป็น 4 คิวเพื่อให้ตอบได้พร้อมกันหลายห้องเมี๊ยว🐾

module.exports = globalAIQueue;
