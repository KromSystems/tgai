const database = require('../connection');
const fs = require('fs');
const path = require('path');
const User = require('./user');
const Garage = require('./garage');

/**
 * GarageRequest Model
 * Управляет заявками на замену масла в автомобилях
 */
class GarageRequest {
    constructor(data = {}) {
        this.id = data.id || null;
        this.car_id = data.car_id;
        this.user_id = data.user_id;
        this.telegram_id = data.telegram_id;
        this.photo_path = data.photo_path;
        this.payment_status = data.payment_status || 'Не выплачено';
        this.admin_comment = data.admin_comment || null;
        this.admin_id = data.admin_id || null;
        this.submitted_at = data.submitted_at || null;
        this.processed_at = data.processed_at || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    /**
     * Создать новую заявку на замену масла
     * @param {Object} requestData - Данные заявки
     * @returns {Promise<GarageRequest>}
     */
    static async create(requestData) {
        const sql = `
            INSERT INTO garage_requests (car_id, user_id, telegram_id, photo_path, payment_status)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const params = [
            requestData.car_id,
            requestData.user_id,
            requestData.telegram_id,
            requestData.photo_path,
            requestData.payment_status || 'Не выплачено'
        ];

        try {
            const result = await database.run(sql, params);
            const newRequest = await GarageRequest.findById(result.id);
            return newRequest;
        } catch (error) {
            throw new Error(`Ошибка создания заявки: ${error.message}`);
        }
    }

    /**
     * Найти заявку по ID
     * @param {number} id - ID заявки
     * @returns {Promise<GarageRequest|null>}
     */
    static async findById(id) {
        const sql = 'SELECT * FROM garage_requests WHERE id = ?';
        try {
            const row = await database.get(sql, [id]);
            return row ? new GarageRequest(row) : null;
        } catch (error) {
            throw new Error(`Ошибка поиска заявки по ID: ${error.message}`);
        }
    }

    /**
     * Найти заявки пользователя по автомобилю
     * @param {number} userId - ID пользователя
     * @param {number} carId - ID автомобиля
     * @param {string} status - Опциональный фильтр по статусу
     * @returns {Promise<GarageRequest|null>}
     */
    static async findByUserAndCar(userId, carId, status = null) {
        let sql = 'SELECT * FROM garage_requests WHERE user_id = ? AND car_id = ?';
        const params = [userId, carId];
        
        if (status) {
            sql += ' AND payment_status = ?';
            params.push(status);
        }
        
        sql += ' ORDER BY submitted_at DESC LIMIT 1';
        
        try {
            const row = await database.get(sql, params);
            return row ? new GarageRequest(row) : null;
        } catch (error) {
            throw new Error(`Ошибка поиска заявки пользователя: ${error.message}`);
        }
    }

    /**
     * Получить ожидающие заявки
     * @returns {Promise<Array<GarageRequest>>}
     */
    static async findPendingRequests() {
        const sql = 'SELECT * FROM garage_requests WHERE payment_status = ? ORDER BY submitted_at ASC';
        try {
            const rows = await database.all(sql, ['Не выплачено']);
            return rows.map(row => new GarageRequest(row));
        } catch (error) {
            throw new Error(`Ошибка получения ожидающих заявок: ${error.message}`);
        }
    }

    /**
     * Получить заявки по статусу
     * @param {string} status - Статус для фильтрации
     * @returns {Promise<Array<GarageRequest>>}
     */
    static async findByStatus(status) {
        const sql = 'SELECT * FROM garage_requests WHERE payment_status = ? ORDER BY submitted_at DESC';
        try {
            const rows = await database.all(sql, [status]);
            return rows.map(row => new GarageRequest(row));
        } catch (error) {
            throw new Error(`Ошибка получения заявок по статусу: ${error.message}`);
        }
    }

    /**
     * Подсчитать количество заявок по статусу
     * @param {string} status - Статус для подсчета
     * @returns {Promise<number>}
     */
    static async countByStatus(status) {
        const sql = 'SELECT COUNT(*) as count FROM garage_requests WHERE payment_status = ?';
        try {
            const result = await database.get(sql, [status]);
            return result.count || 0;
        } catch (error) {
            throw new Error(`Ошибка подсчета заявок по статусу: ${error.message}`);
        }
    }

    /**
     * Подсчитать количество заявок пользователя за последние часы (анти-спам)
     * @param {string} telegramId - Telegram ID пользователя
     * @param {number} hours - Количество часов назад
     * @returns {Promise<number>}
     */
    static async countRecentByUser(telegramId, hours = 1) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM garage_requests 
            WHERE telegram_id = ? AND submitted_at > datetime('now', '-${hours} hours')
        `;
        
        try {
            const result = await database.get(sql, [telegramId]);
            return result.count || 0;
        } catch (error) {
            throw new Error(`Ошибка подсчета недавних заявок: ${error.message}`);
        }
    }

    /**
     * Получить заявки пользователя
     * @param {string} telegramId - Telegram ID пользователя
     * @param {number} limit - Лимит записей
     * @returns {Promise<Array<GarageRequest>>}
     */
    static async findByTelegramId(telegramId, limit = 10) {
        const sql = `
            SELECT * FROM garage_requests 
            WHERE telegram_id = ? 
            ORDER BY submitted_at DESC 
            LIMIT ?
        `;
        
        try {
            const rows = await database.all(sql, [telegramId, limit]);
            return rows.map(row => new GarageRequest(row));
        } catch (error) {
            throw new Error(`Ошибка получения заявок пользователя: ${error.message}`);
        }
    }

    /**
     * Одобрить заявку
     * @param {number} adminId - ID администратора
     * @returns {Promise<void>}
     */
    async approve(adminId) {
        const sql = `
            UPDATE garage_requests 
            SET payment_status = 'Принято', admin_id = ?, processed_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;

        try {
            await database.run(sql, [adminId, this.id]);
            this.payment_status = 'Принято';
            this.admin_id = adminId;
            this.processed_at = new Date().toISOString();

            // Обновляем статус автомобиля на "Хорошее"
            await Garage.updateStatus(this.car_id, 'Хорошее');
        } catch (error) {
            throw new Error(`Ошибка одобрения заявки: ${error.message}`);
        }
    }

    /**
     * Отклонить заявку
     * @param {number} adminId - ID администратора
     * @param {string} comment - Комментарий причины отклонения
     * @returns {Promise<void>}
     */
    async reject(adminId, comment) {
        const sql = `
            UPDATE garage_requests 
            SET payment_status = 'Отклонено', admin_id = ?, admin_comment = ?, processed_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;

        try {
            await database.run(sql, [adminId, comment, this.id]);
            this.payment_status = 'Отклонено';
            this.admin_id = adminId;
            this.admin_comment = comment;
            this.processed_at = new Date().toISOString();
        } catch (error) {
            throw new Error(`Ошибка отклонения заявки: ${error.message}`);
        }
    }

    /**
     * Обновить статус оплаты
     * @param {string} status - Новый статус оплаты
     * @returns {Promise<void>}
     */
    async updatePaymentStatus(status) {
        const validStatuses = ['Не выплачено', 'Принято', 'Отклонено', 'Производится оплата'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Недопустимый статус: ${status}. Допустимые: ${validStatuses.join(', ')}`);
        }

        const sql = 'UPDATE garage_requests SET payment_status = ? WHERE id = ?';

        try {
            await database.run(sql, [status, this.id]);
            this.payment_status = status;
        } catch (error) {
            throw new Error(`Ошибка обновления статуса оплаты: ${error.message}`);
        }
    }

    /**
     * Проверить, существует ли файл фотографии
     * @returns {boolean}
     */
    photoExists() {
        if (!this.photo_path) {
            return false;
        }
        return fs.existsSync(this.photo_path);
    }

    /**
     * Получить буфер файла фотографии
     * @returns {Promise<Buffer|null>}
     */
    async getPhotoBuffer() {
        if (!this.photoExists()) {
            return null;
        }

        try {
            return fs.readFileSync(this.photo_path);
        } catch (error) {
            throw new Error(`Ошибка чтения файла фотографии: ${error.message}`);
        }
    }

    /**
     * Удалить файл фотографии
     * @returns {Promise<boolean>}
     */
    async deletePhoto() {
        if (!this.photoExists()) {
            return false;
        }

        try {
            fs.unlinkSync(this.photo_path);
            return true;
        } catch (error) {
            throw new Error(`Ошибка удаления файла фотографии: ${error.message}`);
        }
    }

    /**
     * Получить форматированный статус
     * @returns {string}
     */
    getFormattedStatus() {
        const statusEmojis = {
            'Не выплачено': '⏳',
            'Принято': '✅',
            'Отклонено': '❌',
            'Производится оплата': '💰'
        };
        
        return `${statusEmojis[this.payment_status] || '❓'} ${this.payment_status}`;
    }

    /**
     * Получить автомобиль, связанный с заявкой
     * @returns {Promise<Garage|null>}
     */
    async getCar() {
        try {
            return await Garage.findById(this.car_id);
        } catch (error) {
            throw new Error(`Ошибка получения автомобиля: ${error.message}`);
        }
    }

    /**
     * Получить пользователя, связанного с заявкой
     * @returns {Promise<User|null>}
     */
    async getUser() {
        try {
            return await User.findById(this.user_id);
        } catch (error) {
            throw new Error(`Ошибка получения пользователя: ${error.message}`);
        }
    }

    /**
     * Получить администратора, обработавшего заявку
     * @returns {Promise<User|null>}
     */
    async getAdmin() {
        if (!this.admin_id) {
            return null;
        }
        
        try {
            return await User.findById(this.admin_id);
        } catch (error) {
            throw new Error(`Ошибка получения администратора: ${error.message}`);
        }
    }

    /**
     * Получить форматированную дату подачи заявки
     * @returns {string}
     */
    getFormattedSubmissionDate() {
        if (!this.submitted_at) {
            return 'Не указано';
        }

        const date = new Date(this.submitted_at);
        return date.toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Получить статистику заявок
     * @returns {Promise<Object>}
     */
    static async getStatistics() {
        const sql = `
            SELECT 
                payment_status,
                COUNT(*) as count,
                DATE(submitted_at) as date
            FROM garage_requests 
            GROUP BY payment_status, DATE(submitted_at)
            ORDER BY date DESC
        `;

        try {
            const rows = await database.all(sql);
            return rows;
        } catch (error) {
            throw new Error(`Ошибка получения статистики заявок: ${error.message}`);
        }
    }

    /**
     * Удалить заявку
     * @returns {Promise<boolean>}
     */
    async delete() {
        const sql = 'DELETE FROM garage_requests WHERE id = ?';
        try {
            // Сначала удаляем фото, если оно есть
            await this.deletePhoto();
            
            const result = await database.run(sql, [this.id]);
            return result.changes > 0;
        } catch (error) {
            throw new Error(`Ошибка удаления заявки: ${error.message}`);
        }
    }
}

module.exports = GarageRequest;