const GarageRequest = require('../database/models/garageRequest');
const Garage = require('../database/models/garage');
const User = require('../database/models/user');

/**
 * RequestProcessor - компонент для обработки заявок на замену масла
 * Реализует бизнес-логику обработки заявок и валидацию
 */
class RequestProcessor {
    constructor() {
        // Настройки антиспама
        this.SPAM_LIMITS = {
            HOURLY_LIMIT: 3,           // 3 заявки в час
            DAILY_LIMIT: 10,           // 10 заявок в день
            PER_CAR_DAILY_LIMIT: 2     // 2 заявки на один автомобиль в день
        };

        // Настройки автоматических выплат
        this.PAYMENT_SETTINGS = {
            REWARD_AMOUNT: 3000000,    // 3 млн игровой валюты
            AUTO_PAYMENT_DELAY: 5000   // 5 секунд задержки перед автовыплатой
        };

        // Валидные статусы заявок
        this.VALID_STATUSES = ['Не выплачено', 'Принято', 'Отклонено', 'Производится оплата'];
    }

    /**
     * Создать новую заявку с валидацией
     * @param {Object} requestData - Данные заявки
     * @returns {Promise<GarageRequest>}
     */
    async createRequest(requestData) {
        try {
            // Валидация входных данных
            await this.validateRequestData(requestData);

            // Проверка антиспам лимитов
            await this.validateSpamLimits(requestData.telegram_id, requestData.car_id);

            // Создание заявки
            const newRequest = await GarageRequest.create(requestData);

            console.log(`✅ Создана новая заявка #${newRequest.id} для автомобиля ${requestData.car_id}`);
            return newRequest;

        } catch (error) {
            console.error('❌ Ошибка создания заявки:', error);
            throw error;
        }
    }

    /**
     * Обработать одобрение заявки администратором
     * @param {number} requestId - ID заявки
     * @param {number} adminId - ID администратора
     * @returns {Promise<Object>}
     */
    async processApproval(requestId, adminId) {
        try {
            const request = await GarageRequest.findById(requestId);
            if (!request) {
                throw new Error('Заявка не найдена');
            }

            if (request.payment_status !== 'Не выплачено') {
                throw new Error(`Заявка уже обработана. Статус: ${request.payment_status}`);
            }

            // Одобряем заявку (это также обновит статус автомобиля)
            await request.approve(adminId);

            // Устанавливаем статус "Производится оплата"
            await request.updatePaymentStatus('Производится оплата');

            // Получаем данные для уведомления
            const [car, user] = await Promise.all([
                request.getCar(),
                request.getUser()
            ]);

            console.log(`✅ Заявка #${requestId} одобрена администратором ${adminId}`);

            return {
                success: true,
                request,
                car,
                user,
                message: 'Заявка одобрена! Начинается процесс выплаты.'
            };

        } catch (error) {
            console.error(`❌ Ошибка одобрения заявки #${requestId}:`, error);
            throw error;
        }
    }

    /**
     * Обработать отклонение заявки администратором
     * @param {number} requestId - ID заявки
     * @param {number} adminId - ID администратора
     * @param {string} comment - Причина отклонения
     * @returns {Promise<Object>}
     */
    async processRejection(requestId, adminId, comment) {
        try {
            const request = await GarageRequest.findById(requestId);
            if (!request) {
                throw new Error('Заявка не найдена');
            }

            if (request.payment_status !== 'Не выплачено') {
                throw new Error(`Заявка уже обработана. Статус: ${request.payment_status}`);
            }

            if (!comment || comment.trim().length === 0) {
                throw new Error('Необходимо указать причину отклонения');
            }

            // Отклоняем заявку
            await request.reject(adminId, comment.trim());

            // Получаем данные для уведомления
            const [car, user] = await Promise.all([
                request.getCar(),
                request.getUser()
            ]);

            console.log(`❌ Заявка #${requestId} отклонена администратором ${adminId}. Причина: ${comment}`);

            return {
                success: true,
                request,
                car,
                user,
                comment: comment.trim(),
                message: 'Заявка отклонена'
            };

        } catch (error) {
            console.error(`❌ Ошибка отклонения заявки #${requestId}:`, error);
            throw error;
        }
    }

    /**
     * Обновить статус оплаты заявки
     * @param {number} requestId - ID заявки
     * @param {string} status - Новый статус
     * @returns {Promise<void>}
     */
    async updatePaymentStatus(requestId, status) {
        try {
            if (!this.VALID_STATUSES.includes(status)) {
                throw new Error(`Недопустимый статус: ${status}`);
            }

            const request = await GarageRequest.findById(requestId);
            if (!request) {
                throw new Error('Заявка не найдена');
            }

            await request.updatePaymentStatus(status);
            
            console.log(`💰 Обновлен статус оплаты заявки #${requestId}: ${status}`);

        } catch (error) {
            console.error(`❌ Ошибка обновления статуса оплаты заявки #${requestId}:`, error);
            throw error;
        }
    }

    /**
     * Проверить лимиты антиспама
     * @param {string} telegramId - Telegram ID пользователя
     * @param {number} carId - ID автомобиля (опционально)
     * @returns {Promise<boolean>}
     */
    async validateSpamLimits(telegramId, carId = null) {
        try {
            // Проверка часового лимита
            const hourlyCount = await GarageRequest.countRecentByUser(telegramId, 1);
            if (hourlyCount >= this.SPAM_LIMITS.HOURLY_LIMIT) {
                throw new Error(`Превышен лимит заявок (${this.SPAM_LIMITS.HOURLY_LIMIT} в час). Попробуйте позже.`);
            }

            // Проверка дневного лимита
            const dailyCount = await GarageRequest.countRecentByUser(telegramId, 24);
            if (dailyCount >= this.SPAM_LIMITS.DAILY_LIMIT) {
                throw new Error(`Превышен дневной лимит заявок (${this.SPAM_LIMITS.DAILY_LIMIT} в день). Попробуйте завтра.`);
            }

            // Проверка лимита по автомобилю (если указан)
            if (carId) {
                const user = await User.findByTelegramId(parseInt(telegramId));
                if (user) {
                    const carDailyCount = await this.countUserCarRequests(user.id, carId, 24);
                    if (carDailyCount >= this.SPAM_LIMITS.PER_CAR_DAILY_LIMIT) {
                        throw new Error(`Превышен лимит заявок для этого автомобиля (${this.SPAM_LIMITS.PER_CAR_DAILY_LIMIT} в день).`);
                    }
                }
            }

            return true;
        } catch (error) {
            console.error('❌ Ошибка проверки антиспам лимитов:', error);
            throw error;
        }
    }

    /**
     * Подсчитать заявки пользователя для конкретного автомобиля
     * @param {number} userId - ID пользователя
     * @param {number} carId - ID автомобиля
     * @param {number} hours - Количество часов назад
     * @returns {Promise<number>}
     */
    async countUserCarRequests(userId, carId, hours) {
        try {
            const sql = `
                SELECT COUNT(*) as count 
                FROM garage_requests 
                WHERE user_id = ? AND car_id = ? 
                AND submitted_at > datetime('now', '-${hours} hours')
            `;
            
            const database = require('../database/connection');
            const result = await database.get(sql, [userId, carId]);
            return result.count || 0;
        } catch (error) {
            throw new Error(`Ошибка подсчета заявок пользователя: ${error.message}`);
        }
    }

    /**
     * Валидация данных заявки
     * @param {Object} requestData - Данные заявки
     * @returns {Promise<void>}
     */
    async validateRequestData(requestData) {
        try {
            // Проверка обязательных полей
            if (!requestData.car_id) {
                throw new Error('Не указан ID автомобиля');
            }

            if (!requestData.user_id) {
                throw new Error('Не указан ID пользователя');
            }

            if (!requestData.telegram_id) {
                throw new Error('Не указан Telegram ID');
            }

            if (!requestData.photo_path) {
                throw new Error('Не указан путь к фотографии');
            }

            // Проверка существования автомобиля
            const car = await Garage.findById(requestData.car_id);
            if (!car) {
                throw new Error('Автомобиль не найден');
            }

            // Проверка существования пользователя
            const user = await User.findById(requestData.user_id);
            if (!user) {
                throw new Error('Пользователь не найден');
            }

            // Проверка авторизации пользователя
            if (!user.isAuthorized()) {
                throw new Error('Пользователь не авторизован');
            }

            // Проверка существования файла фотографии
            const fs = require('fs');
            if (!fs.existsSync(requestData.photo_path)) {
                throw new Error('Файл фотографии не найден');
            }

        } catch (error) {
            throw new Error(`Ошибка валидации данных заявки: ${error.message}`);
        }
    }

    /**
     * Получить статистику обработки заявок
     * @param {Object} options - Опции фильтрации
     * @returns {Promise<Object>}
     */
    async getProcessingStatistics(options = {}) {
        try {
            const { 
                startDate = null, 
                endDate = null, 
                adminId = null 
            } = options;

            let sql = `
                SELECT 
                    payment_status,
                    COUNT(*) as count,
                    AVG(
                        CASE 
                            WHEN processed_at IS NOT NULL AND submitted_at IS NOT NULL 
                            THEN (julianday(processed_at) - julianday(submitted_at)) * 24 * 60
                            ELSE NULL 
                        END
                    ) as avg_processing_time_minutes
                FROM garage_requests 
                WHERE 1=1
            `;

            const params = [];

            if (startDate) {
                sql += ' AND submitted_at >= ?';
                params.push(startDate);
            }

            if (endDate) {
                sql += ' AND submitted_at <= ?';
                params.push(endDate);
            }

            if (adminId) {
                sql += ' AND admin_id = ?';
                params.push(adminId);
            }

            sql += ' GROUP BY payment_status';

            const database = require('../database/connection');
            const rows = await database.all(sql, params);

            const stats = {
                total: 0,
                pending: 0,
                approved: 0,
                rejected: 0,
                processing: 0,
                avgProcessingTime: 0
            };

            let totalProcessingTime = 0;
            let processedCount = 0;

            rows.forEach(row => {
                stats.total += row.count;
                
                switch (row.payment_status) {
                    case 'Не выплачено':
                        stats.pending = row.count;
                        break;
                    case 'Принято':
                        stats.approved = row.count;
                        if (row.avg_processing_time_minutes) {
                            totalProcessingTime += row.avg_processing_time_minutes * row.count;
                            processedCount += row.count;
                        }
                        break;
                    case 'Отклонено':
                        stats.rejected = row.count;
                        if (row.avg_processing_time_minutes) {
                            totalProcessingTime += row.avg_processing_time_minutes * row.count;
                            processedCount += row.count;
                        }
                        break;
                    case 'Производится оплата':
                        stats.processing = row.count;
                        break;
                }
            });

            stats.avgProcessingTime = processedCount > 0 ? 
                Math.round(totalProcessingTime / processedCount) : 0;

            stats.approvalRate = stats.total > 0 ? 
                Math.round((stats.approved / (stats.approved + stats.rejected)) * 100) : 0;

            return stats;
        } catch (error) {
            throw new Error(`Ошибка получения статистики обработки: ${error.message}`);
        }
    }

    /**
     * Получить заявки, ожидающие обработки
     * @param {number} limit - Лимит результатов
     * @returns {Promise<Array>}
     */
    async getPendingRequests(limit = 50) {
        try {
            const requests = await GarageRequest.findPendingRequests();
            
            // Обогащаем данными об автомобилях и пользователях
            const enrichedRequests = [];
            
            for (const request of requests.slice(0, limit)) {
                const [car, user] = await Promise.all([
                    request.getCar(),
                    request.getUser()
                ]);
                
                enrichedRequests.push({
                    request,
                    car,
                    user,
                    waitingTime: this.calculateWaitingTime(request.submitted_at)
                });
            }

            return enrichedRequests;
        } catch (error) {
            throw new Error(`Ошибка получения ожидающих заявок: ${error.message}`);
        }
    }

    /**
     * Вычислить время ожидания заявки
     * @param {string} submittedAt - Время подачи заявки
     * @returns {Object}
     */
    calculateWaitingTime(submittedAt) {
        const submitted = new Date(submittedAt);
        const now = new Date();
        const diffMs = now - submitted;
        
        const minutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        return {
            totalMinutes: minutes,
            formatted: days > 0 ? `${days}д ${hours % 24}ч` : 
                      hours > 0 ? `${hours}ч ${minutes % 60}м` : 
                      `${minutes}м`
        };
    }

    /**
     * Автоматическая очистка старых заявок
     * @param {number} daysOld - Возраст заявок в днях
     * @returns {Promise<number>}
     */
    async cleanupOldRequests(daysOld = 30) {
        try {
            const sql = `
                DELETE FROM garage_requests 
                WHERE (payment_status = 'Принято' OR payment_status = 'Отклонено')
                AND processed_at < datetime('now', '-${daysOld} days')
            `;

            const database = require('../database/connection');
            const result = await database.run(sql);
            
            console.log(`🧹 Очищено ${result.changes} старых заявок (старше ${daysOld} дней)`);
            return result.changes;
        } catch (error) {
            throw new Error(`Ошибка очистки старых заявок: ${error.message}`);
        }
    }
}

module.exports = RequestProcessor;