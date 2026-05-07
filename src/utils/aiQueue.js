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

        try {
            const result = await taskFn();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.running--;
            // เรียกประมวลผลงานถัดไปทันทีเมี๊ยว🐾
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
const globalAIQueue = new AIQueue(5); // ปรับเพิ่มเป็น 5 สำหรับโมเดลแบบเสียตังค์เมี๊ยว🐾

module.exports = globalAIQueue;
