const Garage = require('../database/models/garage');
const GarageRequest = require('../database/models/garageRequest');

/**
 * CarManager - компонент для управления автомобилями
 * Обеспечивает бизнес-логику работы с автомобилями в гараже
 */
class CarManager {
    constructor() {
        // Конфигурация статусов
        this.STATUS_PRIORITIES = {
            'Плохое': 3,
            'Среднее': 2,
            'Хорошее': 1
        };

        this.STATUS_COLORS = {
            'Плохое': '🔴',
            'Среднее': '🟡',
            'Хорошее': '🟢'
        };

        this.MAINTENANCE_RECOMMENDATIONS = {
            'Плохое': 'Срочно требуется замена масла!',
            'Среднее': 'Рекомендуется замена масла в ближайшее время',
            'Хорошее': 'Состояние масла хорошее'
        };
    }

    /**
     * Получить все автомобили
     * @returns {Promise<Array<Garage>>}
     */
    async getAllCars() {
        try {
            return await Garage.getAllCars();
        } catch (error) {
            throw new Error(`Ошибка получения списка автомобилей: ${error.message}`);
        }
    }

    /**
     * Получить автомобиль по ID
     * @param {number} carId - ID автомобиля
     * @returns {Promise<Garage|null>}
     */
    async getCarById(carId) {
        try {
            return await Garage.findById(carId);
        } catch (error) {
            throw new Error(`Ошибка получения автомобиля: ${error.message}`);
        }
    }

    /**
     * Получить автомобили с пагинацией
     * @param {number} page - Номер страницы
     * @param {number} pageSize - Размер страницы
     * @returns {Promise<Object>}
     */
    async getCarsPaginated(page = 0, pageSize = 5) {
        try {
            return await Garage.getCarsPaginated(page, pageSize);
        } catch (error) {
            throw new Error(`Ошибка получения автомобилей с пагинацией: ${error.message}`);
        }
    }

    /**
     * Обновить статус автомобиля
     * @param {number} carId - ID автомобиля
     * @param {string} status - Новый статус
     * @returns {Promise<void>}
     */
    async updateCarStatus(carId, status) {
        try {
            await Garage.updateStatus(carId, status);
        } catch (error) {
            throw new Error(`Ошибка обновления статуса автомобиля: ${error.message}`);
        }
    }

    /**
     * Получить автомобили по статусу
     * @param {string} status - Статус для фильтрации
     * @returns {Promise<Array<Garage>>}
     */
    async getCarsByStatus(status) {
        try {
            return await Garage.getByStatus(status);
        } catch (error) {
            throw new Error(`Ошибка получения автомобилей по статусу: ${error.message}`);
        }
    }

    /**
     * Получить автомобили, нуждающиеся в обслуживании
     * @returns {Promise<Array<Object>>}
     */
    async getCarsNeedingMaintenance() {
        try {
            const allCars = await this.getAllCars();
            const needMaintenance = [];

            for (const car of allCars) {
                if (car.isMaintenanceNeeded()) {
                    const priority = this.getMaintenancePriority(car);
                    needMaintenance.push({
                        car,
                        priority,
                        recommendation: this.MAINTENANCE_RECOMMENDATIONS[car.status],
                        urgency: this.getUrgencyLevel(car)
                    });
                }
            }

            // Сортируем по приоритету (самые важные сначала)
            return needMaintenance.sort((a, b) => b.priority - a.priority);
        } catch (error) {
            throw new Error(`Ошибка получения автомобилей для обслуживания: ${error.message}`);
        }
    }

    /**
     * Получить приоритет обслуживания автомобиля
     * @param {Garage} car - Автомобиль
     * @returns {number}
     */
    getMaintenancePriority(car) {
        const statusPriority = this.STATUS_PRIORITIES[car.status] || 0;
        
        // Добавляем приоритет на основе времени последнего обслуживания
        let timePriority = 0;
        if (car.last_maintenance) {
            const lastMaintenance = new Date(car.last_maintenance);
            const now = new Date();
            const daysSinceLastMaintenance = Math.floor((now - lastMaintenance) / (1000 * 60 * 60 * 24));
            
            if (daysSinceLastMaintenance > 30) timePriority = 3;
            else if (daysSinceLastMaintenance > 14) timePriority = 2;
            else if (daysSinceLastMaintenance > 7) timePriority = 1;
        } else {
            timePriority = 3; // Если никогда не обслуживался
        }

        return statusPriority + timePriority;
    }

    /**
     * Получить уровень срочности
     * @param {Garage} car - Автомобиль
     * @returns {string}
     */
    getUrgencyLevel(car) {
        const priority = this.getMaintenancePriority(car);
        
        if (priority >= 5) return 'Критично';
        if (priority >= 3) return 'Высокий';
        if (priority >= 2) return 'Средний';
        return 'Низкий';
    }

    /**
     * Получить статистику автомобилей
     * @returns {Promise<Object>}
     */
    async getCarStatistics() {
        try {
            const stats = await Garage.getStatistics();
            const needMaintenance = await this.getCarsNeedingMaintenance();
            
            return {
                ...stats,
                needMaintenance: needMaintenance.length,
                critical: needMaintenance.filter(item => item.urgency === 'Критично').length,
                maintenanceRate: stats.total > 0 ? Math.round((needMaintenance.length / stats.total) * 100) : 0
            };
        } catch (error) {
            throw new Error(`Ошибка получения статистики: ${error.message}`);
        }
    }

    /**
     * Найти автомобили по названию
     * @param {string} searchTerm - Поисковый запрос
     * @returns {Promise<Array<Garage>>}
     */
    async searchCarsByName(searchTerm) {
        try {
            const allCars = await this.getAllCars();
            const searchLower = searchTerm.toLowerCase();
            
            return allCars.filter(car => 
                car.car_name.toLowerCase().includes(searchLower)
            );
        } catch (error) {
            throw new Error(`Ошибка поиска автомобилей: ${error.message}`);
        }
    }

    /**
     * Получить отчет по автомобилю
     * @param {number} carId - ID автомобиля
     * @returns {Promise<Object>}
     */
    async getCarReport(carId) {
        try {
            const car = await this.getCarById(carId);
            if (!car) {
                throw new Error('Автомобиль не найден');
            }

            // Получаем историю обслуживания
            const maintenanceHistory = await car.getMaintenanceHistory();
            
            // Получаем активные заявки
            const activeRequests = await GarageRequest.findByStatus('Не выплачено');
            const carActiveRequests = activeRequests.filter(req => req.car_id === carId);

            // Статистика по заявкам
            const allRequests = await this.getCarRequestHistory(carId);
            const approvedRequests = allRequests.filter(req => req.payment_status === 'Принято');
            const rejectedRequests = allRequests.filter(req => req.payment_status === 'Отклонено');

            return {
                car,
                status: {
                    current: car.status,
                    emoji: car.getStatusEmoji(),
                    needsMaintenance: car.isMaintenanceNeeded(),
                    urgency: this.getUrgencyLevel(car),
                    recommendation: this.MAINTENANCE_RECOMMENDATIONS[car.status]
                },
                maintenance: {
                    lastMaintenance: car.last_maintenance,
                    history: maintenanceHistory,
                    totalMaintenances: maintenanceHistory.length
                },
                requests: {
                    active: carActiveRequests,
                    total: allRequests.length,
                    approved: approvedRequests.length,
                    rejected: rejectedRequests.length,
                    approvalRate: allRequests.length > 0 ? 
                        Math.round((approvedRequests.length / allRequests.length) * 100) : 0
                }
            };
        } catch (error) {
            throw new Error(`Ошибка получения отчета по автомобилю: ${error.message}`);
        }
    }

    /**
     * Получить историю заявок по автомобилю
     * @param {number} carId - ID автомобиля
     * @returns {Promise<Array>}
     */
    async getCarRequestHistory(carId) {
        try {
            // Это упрощенная версия, в реальности нужен метод в модели GarageRequest
            const sql = `
                SELECT gr.*, u.first_name, u.last_name, u.username
                FROM garage_requests gr
                JOIN users u ON gr.user_id = u.id
                WHERE gr.car_id = ?
                ORDER BY gr.submitted_at DESC
            `;
            
            const database = require('../database/connection');
            const rows = await database.all(sql, [carId]);
            return rows;
        } catch (error) {
            throw new Error(`Ошибка получения истории заявок: ${error.message}`);
        }
    }

    /**
     * Получить рекомендации по автомобилю
     * @param {number} carId - ID автомобиля
     * @returns {Promise<Array<string>>}
     */
    async getCarRecommendations(carId) {
        try {
            const car = await this.getCarById(carId);
            if (!car) {
                return [];
            }

            const recommendations = [];
            
            // Рекомендации по статусу
            if (car.status === 'Плохое') {
                recommendations.push('🚨 Срочно требуется замена масла');
                recommendations.push('⚠️ Не рекомендуется эксплуатация без обслуживания');
            } else if (car.status === 'Среднее') {
                recommendations.push('⚡ Рекомендуется замена масла в ближайшие дни');
                recommendations.push('📊 Контролируйте состояние масла');
            } else {
                recommendations.push('✅ Состояние масла хорошее');
                recommendations.push('📅 Плановое обслуживание через 7-10 дней');
            }

            // Рекомендации по времени обслуживания
            if (car.last_maintenance) {
                const lastMaintenance = new Date(car.last_maintenance);
                const now = new Date();
                const daysSinceLastMaintenance = Math.floor((now - lastMaintenance) / (1000 * 60 * 60 * 24));
                
                if (daysSinceLastMaintenance > 30) {
                    recommendations.push('🕐 Прошло более 30 дней с последнего обслуживания');
                } else if (daysSinceLastMaintenance > 14) {
                    recommendations.push('🕐 Прошло более 2 недель с последнего обслуживания');
                }
            } else {
                recommendations.push('❓ Автомобиль ещё не обслуживался');
            }

            return recommendations;
        } catch (error) {
            throw new Error(`Ошибка получения рекомендаций: ${error.message}`);
        }
    }

    /**
     * Получить топ автомобилей по количеству заявок
     * @param {number} limit - Лимит результатов
     * @returns {Promise<Array>}
     */
    async getTopCarsByRequests(limit = 5) {
        try {
            const sql = `
                SELECT 
                    g.car_id,
                    g.car_name,
                    g.status,
                    COUNT(gr.id) as request_count,
                    COUNT(CASE WHEN gr.payment_status = 'Принято' THEN 1 END) as approved_count
                FROM garage g
                LEFT JOIN garage_requests gr ON g.car_id = gr.car_id
                GROUP BY g.car_id, g.car_name, g.status
                ORDER BY request_count DESC
                LIMIT ?
            `;
            
            const database = require('../database/connection');
            const rows = await database.all(sql, [limit]);
            
            return rows.map(row => ({
                car_id: row.car_id,
                car_name: row.car_name,
                status: row.status,
                request_count: row.request_count,
                approved_count: row.approved_count,
                approval_rate: row.request_count > 0 ? 
                    Math.round((row.approved_count / row.request_count) * 100) : 0
            }));
        } catch (error) {
            throw new Error(`Ошибка получения топа автомобилей: ${error.message}`);
        }
    }

    /**
     * Проверить возможность подачи заявки на автомобиль
     * @param {number} carId - ID автомобиля
     * @param {number} userId - ID пользователя
     * @returns {Promise<Object>}
     */
    async canSubmitRequest(carId, userId) {
        try {
            const car = await this.getCarById(carId);
            if (!car) {
                return {
                    allowed: false,
                    reason: 'Автомобиль не найден'
                };
            }

            // Проверяем, есть ли активная заявка
            const existingRequest = await GarageRequest.findByUserAndCar(userId, carId, 'Не выплачено');
            if (existingRequest) {
                return {
                    allowed: false,
                    reason: 'У вас уже есть активная заявка для этого автомобиля'
                };
            }

            // Проверяем, нужно ли обслуживание
            if (!car.isMaintenanceNeeded()) {
                return {
                    allowed: true,
                    warning: 'Автомобиль в хорошем состоянии, но вы можете подать заявку'
                };
            }

            return {
                allowed: true,
                message: 'Автомобиль нуждается в обслуживании'
            };
        } catch (error) {
            return {
                allowed: false,
                reason: `Ошибка проверки: ${error.message}`
            };
        }
    }
}

module.exports = CarManager;