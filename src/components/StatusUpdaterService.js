const Garage = require('../database/models/garage');
const database = require('../database/connection');

/**
 * StatusUpdaterService - Служба для обновления статусов автомобилей
 * Обеспечивает централизованное управление обновлениями статусов с валидацией и аудитом
 */
class StatusUpdaterService {
    constructor() {
        this.validStatuses = ['Хорошее', 'Среднее', 'Плохое'];
    }

    /**
     * Нормализация статуса из пользовательского ввода
     * @param {string} status - Статус в любом регистре
     * @returns {string} Нормализованный статус
     */
    normalizeStatus(status) {
        if (!status || typeof status !== 'string') {
            throw new Error('Статус должен быть строкой');
        }

        const normalized = status.trim().toLowerCase();
        
        // Маппинг различных вариантов написания статусов
        const statusMap = {
            'хорошее': 'Хорошее',
            'хороший': 'Хорошее',
            'хорошо': 'Хорошее',
            'good': 'Хорошее',
            'excellent': 'Хорошее',
            'среднее': 'Среднее',
            'средний': 'Среднее',
            'нормальное': 'Среднее',
            'average': 'Среднее',
            'medium': 'Среднее',
            'плохое': 'Плохое',
            'плохой': 'Плохое',
            'плохо': 'Плохое',
            'bad': 'Плохое',
            'poor': 'Плохое'
        };

        const result = statusMap[normalized];
        if (!result) {
            throw new Error(`Неизвестный статус: "${status}". Допустимые: ${this.validStatuses.join(', ')}`);
        }

        return result;
    }

    /**
     * Поиск автомобиля по названию с учетом вариантов написания
     * @param {string} carName - Название автомобиля
     * @returns {Promise<Object|null>} Найденный автомобиль или null
     */
    async findVehicleByName(carName) {
        if (!carName || typeof carName !== 'string') {
            throw new Error('Название автомобиля должно быть строкой');
        }

        const normalizedName = carName.trim();
        
        // Точное совпадение
        const exactMatch = await this.findExactMatch(normalizedName);
        if (exactMatch) {
            return exactMatch;
        }

        // Поиск с игнорированием регистра
        const caseInsensitiveMatch = await this.findCaseInsensitiveMatch(normalizedName);
        if (caseInsensitiveMatch) {
            return caseInsensitiveMatch;
        }

        // Fuzzy поиск для частичных совпадений
        const fuzzyMatch = await this.findFuzzyMatch(normalizedName);
        return fuzzyMatch;
    }

    /**
     * Точное совпадение названия
     * @param {string} carName - Название автомобиля
     * @returns {Promise<Object|null>}
     */
    async findExactMatch(carName) {
        const sql = 'SELECT * FROM garage WHERE car_name = ?';
        try {
            const row = await database.get(sql, [carName]);
            return row ? new Garage(row) : null;
        } catch (error) {
            throw new Error(`Ошибка поиска автомобиля: ${error.message}`);
        }
    }

    /**
     * Поиск с игнорированием регистра
     * @param {string} carName - Название автомобиля
     * @returns {Promise<Object|null>}
     */
    async findCaseInsensitiveMatch(carName) {
        const sql = 'SELECT * FROM garage WHERE LOWER(car_name) = LOWER(?)';
        try {
            const row = await database.get(sql, [carName]);
            return row ? new Garage(row) : null;
        } catch (error) {
            throw new Error(`Ошибка поиска автомобиля: ${error.message}`);
        }
    }

    /**
     * Fuzzy поиск для частичных совпадений
     * @param {string} carName - Название автомобиля
     * @returns {Promise<Object|null>}
     */
    async findFuzzyMatch(carName) {
        const sql = 'SELECT * FROM garage WHERE car_name LIKE ?';
        try {
            // Ищем автомобили, содержащие ключевые слова
            const keywords = carName.split(/\s+/).filter(word => word.length > 2);
            
            for (const keyword of keywords) {
                const row = await database.get(sql, [`%${keyword}%`]);
                if (row) {
                    return new Garage(row);
                }
            }
            
            return null;
        } catch (error) {
            throw new Error(`Ошибка fuzzy поиска: ${error.message}`);
        }
    }

    /**
     * Валидация перехода статуса
     * @param {string} oldStatus - Текущий статус
     * @param {string} newStatus - Новый статус
     * @returns {boolean} Разрешен ли переход
     */
    validateStatusTransition(oldStatus, newStatus) {
        // Все переходы между статусами разрешены
        // В будущем здесь могут быть добавлены бизнес-правила
        return this.validStatuses.includes(oldStatus) && this.validStatuses.includes(newStatus);
    }

    /**
     * Логирование изменения статуса
     * @param {number} carId - ID автомобиля
     * @param {string} carName - Название автомобиля
     * @param {string} oldStatus - Старый статус
     * @param {string} newStatus - Новый статус
     * @param {string} updateReason - Причина обновления
     */
    async logStatusChange(carId, carName, oldStatus, newStatus, updateReason = 'Обновление через StatusUpdaterService') {
        const logEntry = {
            timestamp: new Date().toISOString(),
            carId,
            carName,
            oldStatus,
            newStatus,
            updateReason,
            source: 'StatusUpdaterService'
        };

        console.log(`📝 [AUDIT] ${logEntry.timestamp}: ${carName} (ID: ${carId}) изменен с "${oldStatus}" на "${newStatus}"`);
        
        // В будущем здесь может быть сохранение в таблицу audit_log
        return logEntry;
    }

    /**
     * Обновление статуса одного автомобиля
     * @param {string} carName - Название автомобиля
     * @param {string} newStatus - Новый статус
     * @returns {Promise<Object>} Результат обновления
     */
    async updateSingleVehicle(carName, newStatus) {
        try {
            // Нормализуем статус
            const normalizedStatus = this.normalizeStatus(newStatus);
            
            // Ищем автомобиль
            const vehicle = await this.findVehicleByName(carName);
            if (!vehicle) {
                return {
                    success: false,
                    carName,
                    error: `Автомобиль "${carName}" не найден в базе данных`,
                    suggestions: await this.getSimilarVehicleNames(carName)
                };
            }

            // Проверяем, нужно ли обновление
            if (vehicle.status === normalizedStatus) {
                return {
                    success: true,
                    carName: vehicle.car_name,
                    carId: vehicle.car_id,
                    oldStatus: vehicle.status,
                    newStatus: normalizedStatus,
                    changed: false,
                    message: 'Статус уже установлен'
                };
            }

            // Валидируем переход
            if (!this.validateStatusTransition(vehicle.status, normalizedStatus)) {
                return {
                    success: false,
                    carName: vehicle.car_name,
                    error: `Недопустимый переход статуса с "${vehicle.status}" на "${normalizedStatus}"`
                };
            }

            // Сохраняем старый статус для логирования
            const oldStatus = vehicle.status;

            // Обновляем статус
            await Garage.updateStatus(vehicle.car_id, normalizedStatus);

            // Логируем изменение
            await this.logStatusChange(vehicle.car_id, vehicle.car_name, oldStatus, normalizedStatus);

            return {
                success: true,
                carName: vehicle.car_name,
                carId: vehicle.car_id,
                oldStatus,
                newStatus: normalizedStatus,
                changed: true,
                message: 'Статус успешно обновлен'
            };

        } catch (error) {
            return {
                success: false,
                carName,
                error: error.message
            };
        }
    }

    /**
     * Получение похожих названий автомобилей для подсказок
     * @param {string} carName - Название автомобиля
     * @returns {Promise<Array<string>>} Массив похожих названий
     */
    async getSimilarVehicleNames(carName) {
        try {
            const allCars = await Garage.getAllCars();
            const keywords = carName.toLowerCase().split(/\s+/);
            
            const similar = allCars.filter(car => {
                const carNameLower = car.car_name.toLowerCase();
                return keywords.some(keyword => carNameLower.includes(keyword));
            }).map(car => car.car_name);

            return similar.slice(0, 3); // Возвращаем максимум 3 предложения
        } catch (error) {
            console.error('Ошибка получения похожих названий:', error);
            return [];
        }
    }

    /**
     * Массовое обновление статусов автомобилей
     * @param {Array<Object>} vehicleStatusList - Массив объектов {carName, status}
     * @returns {Promise<Object>} Отчет об обновлении
     */
    async updateVehicleStatuses(vehicleStatusList) {
        if (!Array.isArray(vehicleStatusList)) {
            throw new Error('Список автомобилей должен быть массивом');
        }

        const report = {
            startTime: new Date().toISOString(),
            total: vehicleStatusList.length,
            successful: [],
            failed: [],
            unchanged: [],
            summary: {
                updated: 0,
                failed: 0,
                unchanged: 0,
                errors: []
            }
        };

        console.log(`🚗 Начинаем обновление статусов для ${vehicleStatusList.length} автомобилей...`);

        for (const vehicleData of vehicleStatusList) {
            const { carName, status } = vehicleData;
            
            try {
                const result = await this.updateSingleVehicle(carName, status);
                
                if (result.success) {
                    if (result.changed) {
                        report.successful.push(result);
                        report.summary.updated++;
                        console.log(`✅ ${result.carName}: ${result.oldStatus} → ${result.newStatus}`);
                    } else {
                        report.unchanged.push(result);
                        report.summary.unchanged++;
                        console.log(`⚪ ${result.carName}: ${result.message}`);
                    }
                } else {
                    report.failed.push(result);
                    report.summary.failed++;
                    report.summary.errors.push(result.error);
                    console.log(`❌ ${carName}: ${result.error}`);
                    
                    if (result.suggestions && result.suggestions.length > 0) {
                        console.log(`   💡 Возможно, вы имели в виду: ${result.suggestions.join(', ')}`);
                    }
                }
            } catch (error) {
                const errorResult = {
                    success: false,
                    carName,
                    error: error.message
                };
                
                report.failed.push(errorResult);
                report.summary.failed++;
                report.summary.errors.push(error.message);
                console.log(`❌ ${carName}: ${error.message}`);
            }
        }

        report.endTime = new Date().toISOString();
        report.duration = new Date(report.endTime) - new Date(report.startTime);

        return report;
    }

    /**
     * Генерация отчета об обновлении
     * @param {Object} report - Отчет от updateVehicleStatuses
     * @returns {string} Форматированный отчет
     */
    generateUpdateReport(report) {
        const lines = [
            '🚗 ОТЧЕТ ОБ ОБНОВЛЕНИИ СТАТУСОВ АВТОМОБИЛЕЙ',
            '=' .repeat(50),
            `📅 Время выполнения: ${new Date(report.startTime).toLocaleString('ru-RU')}`,
            `⏱️  Длительность: ${Math.round(report.duration / 1000)}с`,
            `📊 Всего обработано: ${report.total}`,
            '',
            '📈 СТАТИСТИКА:',
            `✅ Обновлено: ${report.summary.updated}`,
            `⚪ Без изменений: ${report.summary.unchanged}`,
            `❌ Ошибки: ${report.summary.failed}`,
            ''
        ];

        if (report.successful.length > 0) {
            lines.push('✅ УСПЕШНО ОБНОВЛЕНЫ:');
            report.successful.forEach(item => {
                lines.push(`   • ${item.carName}: ${item.oldStatus} → ${item.newStatus}`);
            });
            lines.push('');
        }

        if (report.unchanged.length > 0) {
            lines.push('⚪ БЕЗ ИЗМЕНЕНИЙ:');
            report.unchanged.forEach(item => {
                lines.push(`   • ${item.carName}: ${item.newStatus} (уже установлен)`);
            });
            lines.push('');
        }

        if (report.failed.length > 0) {
            lines.push('❌ ОШИБКИ:');
            report.failed.forEach(item => {
                lines.push(`   • ${item.carName}: ${item.error}`);
            });
            lines.push('');
        }

        return lines.join('\n');
    }
}

module.exports = StatusUpdaterService;