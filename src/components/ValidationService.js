const Garage = require('../database/models/garage');

/**
 * ValidationService - Служба для валидации данных и бизнес-правил
 * Обеспечивает проверку корректности обновлений статусов автомобилей
 */
class ValidationService {
    constructor() {
        this.validStatuses = ['Хорошее', 'Среднее', 'Плохое'];
        this.statusPriority = {
            'Плохое': 1,
            'Среднее': 2,
            'Хорошее': 3
        };
    }

    /**
     * Валидация статуса
     * @param {string} status - Статус для проверки
     * @returns {Object} Результат валидации
     */
    validateStatus(status) {
        const result = {
            isValid: false,
            normalizedStatus: null,
            error: null
        };

        if (!status || typeof status !== 'string') {
            result.error = 'Статус должен быть строкой';
            return result;
        }

        const trimmedStatus = status.trim();
        if (trimmedStatus.length === 0) {
            result.error = 'Статус не может быть пустым';
            return result;
        }

        // Проверяем точное совпадение
        if (this.validStatuses.includes(trimmedStatus)) {
            result.isValid = true;
            result.normalizedStatus = trimmedStatus;
            return result;
        }

        // Проверяем с игнорированием регистра
        const normalizedInput = trimmedStatus.toLowerCase();
        const statusMap = {
            'хорошее': 'Хорошее',
            'хороший': 'Хорошее',
            'хорошо': 'Хорошее',
            'good': 'Хорошее',
            'excellent': 'Хорошее',
            'отличное': 'Хорошее',
            'отлично': 'Хорошее',
            'среднее': 'Среднее',
            'средний': 'Среднее',
            'средне': 'Среднее',
            'нормальное': 'Среднее',
            'нормально': 'Среднее',
            'average': 'Среднее',
            'medium': 'Среднее',
            'ok': 'Среднее',
            'плохое': 'Плохое',
            'плохой': 'Плохое',
            'плохо': 'Плохое',
            'bad': 'Плохое',
            'poor': 'Плохое',
            'ужасное': 'Плохое',
            'ужасно': 'Плохое',
            'terrible': 'Плохое'
        };

        const mappedStatus = statusMap[normalizedInput];
        if (mappedStatus) {
            result.isValid = true;
            result.normalizedStatus = mappedStatus;
            return result;
        }

        result.error = `Неизвестный статус: "${status}". Допустимые значения: ${this.validStatuses.join(', ')}`;
        return result;
    }

    /**
     * Валидация перехода статуса
     * @param {string} oldStatus - Текущий статус
     * @param {string} newStatus - Новый статус
     * @returns {Object} Результат валидации перехода
     */
    validateStatusTransition(oldStatus, newStatus) {
        const result = {
            isValid: false,
            isDowngrade: false,
            isUpgrade: false,
            isNoChange: false,
            warning: null,
            recommendation: null
        };

        // Проверяем валидность статусов
        const oldStatusValidation = this.validateStatus(oldStatus);
        const newStatusValidation = this.validateStatus(newStatus);

        if (!oldStatusValidation.isValid) {
            result.error = `Недопустимый текущий статус: ${oldStatusValidation.error}`;
            return result;
        }

        if (!newStatusValidation.isValid) {
            result.error = `Недопустимый новый статус: ${newStatusValidation.error}`;
            return result;
        }

        const normalizedOld = oldStatusValidation.normalizedStatus;
        const normalizedNew = newStatusValidation.normalizedStatus;

        // Проверяем, есть ли изменение
        if (normalizedOld === normalizedNew) {
            result.isValid = true;
            result.isNoChange = true;
            result.warning = 'Статус не изменился';
            return result;
        }

        // Определяем тип перехода
        const oldPriority = this.statusPriority[normalizedOld];
        const newPriority = this.statusPriority[normalizedNew];

        if (newPriority > oldPriority) {
            result.isUpgrade = true;
            result.recommendation = 'Улучшение состояния автомобиля';
        } else {
            result.isDowngrade = true;
            result.warning = 'Ухудшение состояния автомобиля';
        }

        // Все переходы разрешены (в данной версии)
        result.isValid = true;
        return result;
    }

    /**
     * Валидация названия автомобиля
     * @param {string} carName - Название автомобиля
     * @returns {Object} Результат валидации
     */
    validateCarName(carName) {
        const result = {
            isValid: false,
            normalizedName: null,
            error: null,
            warnings: []
        };

        if (!carName || typeof carName !== 'string') {
            result.error = 'Название автомобиля должно быть строкой';
            return result;
        }

        const trimmedName = carName.trim();
        
        if (trimmedName.length === 0) {
            result.error = 'Название автомобиля не может быть пустым';
            return result;
        }

        if (trimmedName.length > 100) {
            result.error = 'Название автомобиля слишком длинное (максимум 100 символов)';
            return result;
        }

        if (trimmedName.length < 2) {
            result.error = 'Название автомобиля слишком короткое (минимум 2 символа)';
            return result;
        }

        // Проверяем на подозрительные символы
        const suspiciousChars = /[<>{}[\]\\|`~!@#$%^&*()+=;:'"]/;
        if (suspiciousChars.test(trimmedName)) {
            result.warnings.push('Название содержит подозрительные символы');
        }

        // Проверяем на слишком много цифр
        const digitCount = (trimmedName.match(/\d/g) || []).length;
        if (digitCount > trimmedName.length * 0.5) {
            result.warnings.push('Название содержит слишком много цифр');
        }

        result.isValid = true;
        result.normalizedName = trimmedName;
        return result;
    }

    /**
     * Валидация существования автомобиля в базе данных
     * @param {string} carName - Название автомобиля
     * @returns {Promise<Object>} Результат валидации
     */
    async validateVehicleExists(carName) {
        const result = {
            exists: false,
            vehicle: null,
            error: null,
            duplicates: []
        };

        try {
            // Точный поиск
            let vehicle = await this.findExactVehicle(carName);
            if (vehicle) {
                result.exists = true;
                result.vehicle = vehicle;
                
                // Проверяем на дубликаты
                const duplicates = await this.findDuplicateVehicles(carName);
                if (duplicates.length > 1) {
                    result.duplicates = duplicates;
                }
                
                return result;
            }

            // Поиск без учета регистра
            vehicle = await this.findCaseInsensitiveVehicle(carName);
            if (vehicle) {
                result.exists = true;
                result.vehicle = vehicle;
                return result;
            }

            result.error = `Автомобиль "${carName}" не найден в базе данных`;
            return result;

        } catch (error) {
            result.error = `Ошибка поиска автомобиля: ${error.message}`;
            return result;
        }
    }

    /**
     * Точный поиск автомобиля
     * @param {string} carName - Название автомобиля
     * @returns {Promise<Object|null>}
     */
    async findExactVehicle(carName) {
        try {
            return await Garage.findById(carName) || await this.findByExactName(carName);
        } catch (error) {
            throw new Error(`Ошибка точного поиска: ${error.message}`);
        }
    }

    /**
     * Поиск по точному названию
     * @param {string} carName - Название автомобиля
     * @returns {Promise<Object|null>}
     */
    async findByExactName(carName) {
        try {
            const allCars = await Garage.getAllCars();
            return allCars.find(car => car.car_name === carName) || null;
        } catch (error) {
            throw new Error(`Ошибка поиска по названию: ${error.message}`);
        }
    }

    /**
     * Поиск без учета регистра
     * @param {string} carName - Название автомобиля
     * @returns {Promise<Object|null>}
     */
    async findCaseInsensitiveVehicle(carName) {
        try {
            const allCars = await Garage.getAllCars();
            return allCars.find(car => 
                car.car_name.toLowerCase().trim() === carName.toLowerCase().trim()
            ) || null;
        } catch (error) {
            throw new Error(`Ошибка поиска без учета регистра: ${error.message}`);
        }
    }

    /**
     * Поиск дубликатов
     * @param {string} carName - Название автомобиля
     * @returns {Promise<Array>}
     */
    async findDuplicateVehicles(carName) {
        try {
            const allCars = await Garage.getAllCars();
            return allCars.filter(car => 
                car.car_name.toLowerCase().trim() === carName.toLowerCase().trim()
            );
        } catch (error) {
            throw new Error(`Ошибка поиска дубликатов: ${error.message}`);
        }
    }

    /**
     * Валидация истории обслуживания
     * @param {Object} vehicle - Объект автомобиля
     * @param {string} newStatus - Новый статус
     * @returns {Object} Результат валидации
     */
    validateMaintenanceHistory(vehicle, newStatus) {
        const result = {
            isValid: true,
            warnings: [],
            recommendations: []
        };

        if (!vehicle) {
            result.isValid = false;
            result.error = 'Автомобиль не предоставлен для валидации';
            return result;
        }

        // Проверяем последнее обслуживание
        if (vehicle.last_maintenance) {
            const lastMaintenance = new Date(vehicle.last_maintenance);
            const now = new Date();
            const daysSinceLastMaintenance = Math.floor((now - lastMaintenance) / (1000 * 60 * 60 * 24));

            if (daysSinceLastMaintenance > 30) {
                result.warnings.push(`Последнее обслуживание было ${daysSinceLastMaintenance} дней назад`);
            }

            // Проверяем логичность статуса относительно времени последнего обслуживания
            if (newStatus === 'Хорошее' && daysSinceLastMaintenance > 60) {
                result.warnings.push('Подозрительно: хорошее состояние при давнем обслуживании');
            }

            if (newStatus === 'Плохое' && daysSinceLastMaintenance < 7) {
                result.warnings.push('Подозрительно: плохое состояние сразу после обслуживания');
            }
        } else {
            result.warnings.push('Отсутствует информация о последнем обслуживании');
        }

        // Рекомендации по улучшению
        if (newStatus === 'Плохое') {
            result.recommendations.push('Рекомендуется запланировать обслуживание');
        }

        if (newStatus === 'Среднее') {
            result.recommendations.push('Рекомендуется профилактический осмотр');
        }

        return result;
    }

    /**
     * Комплексная валидация обновления статуса
     * @param {string} carName - Название автомобиля
     * @param {string} newStatus - Новый статус
     * @returns {Promise<Object>} Полный результат валидации
     */
    async validateStatusUpdate(carName, newStatus) {
        const result = {
            isValid: false,
            errors: [],
            warnings: [],
            recommendations: [],
            vehicle: null,
            normalizedStatus: null
        };

        try {
            // 1. Валидация названия автомобиля
            const nameValidation = this.validateCarName(carName);
            if (!nameValidation.isValid) {
                result.errors.push(`Название автомобиля: ${nameValidation.error}`);
                return result;
            }
            result.warnings.push(...nameValidation.warnings);

            // 2. Валидация статуса
            const statusValidation = this.validateStatus(newStatus);
            if (!statusValidation.isValid) {
                result.errors.push(`Статус: ${statusValidation.error}`);
                return result;
            }
            result.normalizedStatus = statusValidation.normalizedStatus;

            // 3. Проверка существования автомобиля
            const existenceValidation = await this.validateVehicleExists(nameValidation.normalizedName);
            if (!existenceValidation.exists) {
                result.errors.push(existenceValidation.error);
                return result;
            }
            result.vehicle = existenceValidation.vehicle;

            if (existenceValidation.duplicates.length > 1) {
                result.warnings.push(`Найдено ${existenceValidation.duplicates.length} автомобилей с таким названием`);
            }

            // 4. Валидация перехода статуса
            const transitionValidation = this.validateStatusTransition(
                result.vehicle.status, 
                result.normalizedStatus
            );
            
            if (!transitionValidation.isValid) {
                result.errors.push(`Переход статуса: ${transitionValidation.error}`);
                return result;
            }

            if (transitionValidation.warning) {
                result.warnings.push(transitionValidation.warning);
            }

            if (transitionValidation.recommendation) {
                result.recommendations.push(transitionValidation.recommendation);
            }

            // 5. Валидация истории обслуживания
            const maintenanceValidation = this.validateMaintenanceHistory(
                result.vehicle, 
                result.normalizedStatus
            );
            
            result.warnings.push(...maintenanceValidation.warnings);
            result.recommendations.push(...maintenanceValidation.recommendations);

            // Если дошли до сюда - валидация прошла успешно
            result.isValid = true;
            return result;

        } catch (error) {
            result.errors.push(`Системная ошибка: ${error.message}`);
            return result;
        }
    }

    /**
     * Валидация массива обновлений
     * @param {Array} updates - Массив обновлений [{carName, status}]
     * @returns {Promise<Object>} Результат валидации массива
     */
    async validateBatchUpdates(updates) {
        const result = {
            isValid: true,
            totalCount: updates.length,
            validCount: 0,
            invalidCount: 0,
            validUpdates: [],
            invalidUpdates: [],
            summary: {
                errors: [],
                warnings: [],
                duplicateVehicles: []
            }
        };

        if (!Array.isArray(updates)) {
            result.isValid = false;
            result.summary.errors.push('Список обновлений должен быть массивом');
            return result;
        }

        if (updates.length === 0) {
            result.isValid = false;
            result.summary.errors.push('Список обновлений не может быть пустым');
            return result;
        }

        // Проверяем каждое обновление
        for (let i = 0; i < updates.length; i++) {
            const update = updates[i];
            const updateValidation = await this.validateStatusUpdate(update.carName, update.status);

            if (updateValidation.isValid) {
                result.validCount++;
                result.validUpdates.push({
                    index: i,
                    carName: update.carName,
                    status: updateValidation.normalizedStatus,
                    vehicle: updateValidation.vehicle,
                    warnings: updateValidation.warnings,
                    recommendations: updateValidation.recommendations
                });
            } else {
                result.invalidCount++;
                result.invalidUpdates.push({
                    index: i,
                    carName: update.carName,
                    status: update.status,
                    errors: updateValidation.errors,
                    warnings: updateValidation.warnings
                });
            }

            // Собираем общие предупреждения
            result.summary.warnings.push(...updateValidation.warnings);
        }

        // Проверяем на дубликаты в самом списке
        const vehicleNames = updates.map(u => u.carName.toLowerCase().trim());
        const duplicateNames = vehicleNames.filter((name, index) => vehicleNames.indexOf(name) !== index);
        
        if (duplicateNames.length > 0) {
            result.summary.duplicateVehicles = [...new Set(duplicateNames)];
            result.summary.warnings.push(`Дубликаты в списке: ${result.summary.duplicateVehicles.join(', ')}`);
        }

        // Определяем общую валидность
        result.isValid = result.invalidCount === 0;

        return result;
    }
}

module.exports = ValidationService;