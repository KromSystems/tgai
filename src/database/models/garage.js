const database = require('../connection');

/**
 * Garage Model
 * Управляет автомобилями в гараже семьи
 */
class Garage {
    constructor(data = {}) {
        this.car_id = data.car_id || null;
        this.car_name = data.car_name || null;
        this.status = data.status || 'Хорошее';
        this.last_maintenance = data.last_maintenance || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    /**
     * Получить все автомобили
     * @returns {Promise<Array<Garage>>}
     */
    static async getAllCars() {
        const sql = 'SELECT * FROM garage ORDER BY car_id ASC';
        try {
            const rows = await database.all(sql);
            return rows.map(row => new Garage(row));
        } catch (error) {
            throw new Error(`Ошибка получения списка автомобилей: ${error.message}`);
        }
    }

    /**
     * Найти автомобиль по ID
     * @param {number} carId - ID автомобиля
     * @returns {Promise<Garage|null>}
     */
    static async findById(carId) {
        const sql = 'SELECT * FROM garage WHERE car_id = ?';
        try {
            const row = await database.get(sql, [carId]);
            return row ? new Garage(row) : null;
        } catch (error) {
            throw new Error(`Ошибка поиска автомобиля по ID: ${error.message}`);
        }
    }

    /**
     * Получить автомобили с пагинацией
     * @param {number} page - Номер страницы (начиная с 0)
     * @param {number} pageSize - Размер страницы
     * @returns {Promise<Object>} - Объект с автомобилями и информацией о пагинации
     */
    static async getCarsPaginated(page = 0, pageSize = 5) {
        const offset = page * pageSize;
        const sql = 'SELECT * FROM garage ORDER BY car_id ASC LIMIT ? OFFSET ?';
        const countSql = 'SELECT COUNT(*) as total FROM garage';

        try {
            const [rows, countResult] = await Promise.all([
                database.all(sql, [pageSize, offset]),
                database.get(countSql)
            ]);

            const cars = rows.map(row => new Garage(row));
            const total = countResult.total;
            const totalPages = Math.ceil(total / pageSize);

            return {
                cars,
                pagination: {
                    currentPage: page,
                    pageSize,
                    total,
                    totalPages,
                    hasNext: page < totalPages - 1,
                    hasPrev: page > 0
                }
            };
        } catch (error) {
            throw new Error(`Ошибка получения автомобилей с пагинацией: ${error.message}`);
        }
    }

    /**
     * Обновить статус автомобиля
     * @param {number} carId - ID автомобиля
     * @param {string} status - Новый статус ('Среднее', 'Хорошее', 'Плохое')
     * @returns {Promise<void>}
     */
    static async updateStatus(carId, status) {
        const validStatuses = ['Среднее', 'Хорошее', 'Плохое'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Недопустимый статус: ${status}. Допустимые: ${validStatuses.join(', ')}`);
        }

        const sql = `
            UPDATE garage 
            SET status = ?, last_maintenance = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE car_id = ?
        `;

        try {
            const result = await database.run(sql, [status, carId]);
            if (result.changes === 0) {
                throw new Error(`Автомобиль с ID ${carId} не найден`);
            }
        } catch (error) {
            throw new Error(`Ошибка обновления статуса автомобиля: ${error.message}`);
        }
    }

    /**
     * Получить автомобили по статусу
     * @param {string} status - Статус для фильтрации
     * @returns {Promise<Array<Garage>>}
     */
    static async getByStatus(status) {
        const sql = 'SELECT * FROM garage WHERE status = ? ORDER BY car_id ASC';
        try {
            const rows = await database.all(sql, [status]);
            return rows.map(row => new Garage(row));
        } catch (error) {
            throw new Error(`Ошибка получения автомобилей по статусу: ${error.message}`);
        }
    }

    /**
     * Получить статистику автомобилей
     * @returns {Promise<Object>}
     */
    static async getStatistics() {
        const sql = `
            SELECT 
                status,
                COUNT(*) as count
            FROM garage 
            GROUP BY status
        `;

        try {
            const rows = await database.all(sql);
            const stats = {
                'Хорошее': 0,
                'Среднее': 0,
                'Плохое': 0,
                total: 0
            };

            rows.forEach(row => {
                stats[row.status] = row.count;
                stats.total += row.count;
            });

            return stats;
        } catch (error) {
            throw new Error(`Ошибка получения статистики: ${error.message}`);
        }
    }

    /**
     * Инициализация автомобилей по умолчанию (используется в миграции)
     * @returns {Promise<void>}
     */
    static async initializeDefaultCars() {
        const defaultCars = [
            { car_id: 1, car_name: 'Infernus', status: 'Хорошее' },
            { car_id: 2, car_name: 'Cheetah', status: 'Среднее' },
            { car_id: 3, car_name: 'Banshee', status: 'Плохое' },
            { car_id: 4, car_name: 'Bullet', status: 'Хорошее' },
            { car_id: 5, car_name: 'Turismo', status: 'Среднее' },
            { car_id: 6, car_name: 'ZR-350', status: 'Хорошее' },
            { car_id: 7, car_name: 'Jester', status: 'Плохое' },
            { car_id: 8, car_name: 'Sultan', status: 'Среднее' },
            { car_id: 9, car_name: 'Elegy', status: 'Хорошее' },
            { car_id: 10, car_name: 'Uranus', status: 'Плохое' },
            { car_id: 11, car_name: 'Phoenix', status: 'Среднее' },
            { car_id: 12, car_name: 'Comet', status: 'Хорошее' },
            { car_id: 13, car_name: 'Buffalo', status: 'Среднее' },
            { car_id: 14, car_name: 'Feltzer', status: 'Плохое' },
            { car_id: 15, car_name: 'Euros', status: 'Хорошее' },
            { car_id: 16, car_name: 'Flash', status: 'Среднее' },
            { car_id: 17, car_name: 'Stratum', status: 'Плохое' },
            { car_id: 18, car_name: 'Club', status: 'Хорошее' },
            { car_id: 19, car_name: 'Super GT', status: 'Среднее' },
            { car_id: 20, car_name: 'Hotknife', status: 'Плохое' }
        ];

        const insertSql = `
            INSERT OR IGNORE INTO garage (car_id, car_name, status, last_maintenance) 
            VALUES (?, ?, ?, datetime('now', '-' || (ABS(RANDOM()) % 30 + 1) || ' days'))
        `;

        try {
            for (const car of defaultCars) {
                await database.run(insertSql, [car.car_id, car.car_name, car.status]);
            }
        } catch (error) {
            throw new Error(`Ошибка инициализации автомобилей: ${error.message}`);
        }
    }

    /**
     * Проверить, нуждается ли автомобиль в обслуживании
     * @returns {boolean}
     */
    isMaintenanceNeeded() {
        if (!this.last_maintenance) return true;
        
        const lastMaintenance = new Date(this.last_maintenance);
        const now = new Date();
        const daysSinceLastMaintenance = Math.floor((now - lastMaintenance) / (1000 * 60 * 60 * 24));
        
        // Автомобилю нужно обслуживание, если прошло более 7 дней или статус "Плохое"
        return daysSinceLastMaintenance > 7 || this.status === 'Плохое';
    }

    /**
     * Получить эмодзи для статуса автомобиля
     * @returns {string}
     */
    getStatusEmoji() {
        const statusEmojis = {
            'Хорошее': '🟢',
            'Среднее': '🟡',
            'Плохое': '🔴'
        };
        return statusEmojis[this.status] || '⚪';
    }

    /**
     * Получить полное описание автомобиля
     * @returns {string}
     */
    getDisplayName() {
        return `${this.getStatusEmoji()} ${this.car_name}: ${this.status}`;
    }

    /**
     * Обновить данные автомобиля
     * @param {Object} updateData - Данные для обновления
     * @returns {Promise<Garage>}
     */
    async update(updateData) {
        const allowedFields = ['car_name', 'status', 'last_maintenance'];
        const updates = [];
        const params = [];

        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                params.push(updateData[key]);
                this[key] = updateData[key];
            }
        });

        if (updates.length === 0) {
            return this;
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(this.car_id);

        const sql = `UPDATE garage SET ${updates.join(', ')} WHERE car_id = ?`;

        try {
            await database.run(sql, params);
            this.updated_at = new Date().toISOString();
            return this;
        } catch (error) {
            throw new Error(`Ошибка обновления автомобиля: ${error.message}`);
        }
    }

    /**
     * Получить историю обслуживания (через связь с garage_requests)
     * @returns {Promise<Array>}
     */
    async getMaintenanceHistory() {
        const sql = `
            SELECT gr.*, u.first_name, u.last_name 
            FROM garage_requests gr
            JOIN users u ON gr.user_id = u.id
            WHERE gr.car_id = ? AND gr.payment_status = 'Принято'
            ORDER BY gr.processed_at DESC
        `;

        try {
            const rows = await database.all(sql, [this.car_id]);
            return rows;
        } catch (error) {
            throw new Error(`Ошибка получения истории обслуживания: ${error.message}`);
        }
    }
}

module.exports = Garage;