#!/usr/bin/env node

/**
 * Скрипт для обновления статусов автомобилей в гараже
 * Использует все созданные службы для безопасного и надежного обновления
 */

const StatusUpdaterService = require('../src/components/StatusUpdaterService');
const VehicleMatchingService = require('../src/components/VehicleMatchingService');
const ValidationService = require('../src/components/ValidationService');
const AuditLogger = require('../src/components/AuditLogger');
const Garage = require('../src/database/models/garage');
const database = require('../src/database/connection');

class VehicleStatusUpdateScript {
    constructor() {
        this.statusUpdater = new StatusUpdaterService();
        this.vehicleMatcher = new VehicleMatchingService();
        this.validator = new ValidationService();
        this.auditLogger = new AuditLogger();
        this.batchId = this.auditLogger.generateBatchId();
    }

    /**
     * Список автомобилей для обновления (из пользовательского запроса)
     */
    getVehicleUpdates() {
        return [
            { carName: 'BMW 4-Series', status: 'хорошее' },
            { carName: 'Audi RS6', status: 'хорошее' },
            { carName: 'Mercedes G63AMG', status: 'хорошее' },
            { carName: 'Tesla Model 3', status: 'хорошее' },
            { carName: 'Mercedes G63AMG', status: 'среднее' }, // Дубликат с другим статусом
            { carName: 'Chevrolet Camaro', status: 'хорошее' },
            { carName: 'Rolls-Royce Phantom', status: 'хорошее' },
            { carName: 'Ferrari J50', status: 'хорошее' },
            { carName: 'Porsche 911', status: 'хорошее' },
            { carName: 'Sparrow', status: 'хорошее' },
            { carName: 'Ducati Ducnaked', status: 'хорошее' },
            { carName: 'NRG-500', status: 'хорошее' },
            { carName: 'Mercedes-Benz C63S', status: 'хорошее' },
            { carName: 'BMW M3 Touring', status: 'хорошее' },
            { carName: 'Lamborghini Huracan 2022', status: 'хорошее' }
        ];
    }

    /**
     * Отображение текущего состояния гаража
     */
    async showCurrentGarageState() {
        console.log('📊 ТЕКУЩЕЕ СОСТОЯНИЕ ГАРАЖА:');
        console.log('=' .repeat(60));

        try {
            const cars = await Garage.getAllCars();
            const stats = await Garage.getStatistics();

            console.log(`Всего автомобилей: ${stats.total}`);
            console.log(`🟢 Хорошее: ${stats['Хорошее']}`);
            console.log(`🟡 Среднее: ${stats['Среднее']}`);
            console.log(`🔴 Плохое: ${stats['Плохое']}`);
            console.log('');

            console.log('СПИСОК АВТОМОБИЛЕЙ:');
            cars.forEach(car => {
                const emoji = car.getStatusEmoji();
                console.log(`${emoji} ${car.car_name} (ID: ${car.car_id}) - ${car.status}`);
            });
            console.log('');

        } catch (error) {
            console.error('❌ Ошибка получения данных гаража:', error.message);
        }
    }

    /**
     * Предварительный анализ обновлений
     */
    async preAnalyzeUpdates(updates) {
        console.log('🔍 ПРЕДВАРИТЕЛЬНЫЙ АНАЛИЗ ОБНОВЛЕНИЙ:');
        console.log('=' .repeat(60));

        const analysis = {
            totalUpdates: updates.length,
            uniqueVehicles: new Set(updates.map(u => u.carName.toLowerCase())).size,
            statusDistribution: {},
            duplicatesInList: [],
            vehicleMatches: [],
            unmatchedVehicles: []
        };

        // Анализ распределения статусов
        updates.forEach(update => {
            const normalizedStatus = this.statusUpdater.normalizeStatus(update.status);
            analysis.statusDistribution[normalizedStatus] = (analysis.statusDistribution[normalizedStatus] || 0) + 1;
        });

        // Поиск дубликатов в списке
        const vehicleNames = updates.map(u => u.carName.toLowerCase());
        const duplicates = vehicleNames.filter((name, index) => vehicleNames.indexOf(name) !== index);
        analysis.duplicatesInList = [...new Set(duplicates)];

        // Проверка соответствий с базой данных
        for (const update of updates) {
            const searchResult = await this.vehicleMatcher.findVehicle(update.carName);
            if (searchResult.found) {
                analysis.vehicleMatches.push({
                    input: update.carName,
                    matched: searchResult.vehicle.car_name,
                    matchType: searchResult.matchType,
                    confidence: searchResult.confidence
                });
            } else {
                analysis.unmatchedVehicles.push({
                    input: update.carName,
                    suggestions: searchResult.alternatives.slice(0, 3)
                });
            }
        }

        // Вывод результатов анализа
        console.log(`Всего обновлений: ${analysis.totalUpdates}`);
        console.log(`Уникальных автомобилей: ${analysis.uniqueVehicles}`);
        console.log('');

        console.log('Распределение статусов:');
        Object.entries(analysis.statusDistribution).forEach(([status, count]) => {
            const emoji = status === 'Хорошее' ? '🟢' : status === 'Среднее' ? '🟡' : '🔴';
            console.log(`${emoji} ${status}: ${count}`);
        });
        console.log('');

        if (analysis.duplicatesInList.length > 0) {
            console.log('⚠️  Дубликаты в списке обновлений:');
            analysis.duplicatesInList.forEach(name => {
                const entries = updates.filter(u => u.carName.toLowerCase() === name);
                console.log(`   • ${entries[0].carName}: ${entries.map(e => e.status).join(', ')}`);
            });
            console.log('');
        }

        if (analysis.unmatchedVehicles.length > 0) {
            console.log('❌ Автомобили не найдены в базе данных:');
            analysis.unmatchedVehicles.forEach(item => {
                console.log(`   • ${item.input}`);
                if (item.suggestions.length > 0) {
                    console.log(`     Возможно: ${item.suggestions.map(s => s.vehicle?.car_name || s).join(', ')}`);
                }
            });
            console.log('');
        }

        console.log('✅ Совпадения с базой данных:');
        analysis.vehicleMatches.forEach(match => {
            const confidence = Math.round(match.confidence * 100);
            console.log(`   • ${match.input} → ${match.matched} (${match.matchType}, ${confidence}%)`);
        });
        console.log('');

        return analysis;
    }

    /**
     * Обработка дубликатов Mercedes G63AMG
     */
    async resolveMercedesG63AMGDuplicate(updates) {
        console.log('🔧 ОБРАБОТКА ДУБЛИКАТА Mercedes G63AMG:');
        console.log('=' .repeat(60));

        const mercedesUpdates = updates.filter(u => 
            u.carName.toLowerCase().includes('mercedes') && u.carName.toLowerCase().includes('g63amg')
        );

        if (mercedesUpdates.length <= 1) {
            console.log('Дубликатов Mercedes G63AMG не обнаружено.');
            return updates;
        }

        console.log(`Найдено ${mercedesUpdates.length} записей для Mercedes G63AMG:`);
        mercedesUpdates.forEach((update, index) => {
            console.log(`${index + 1}. ${update.carName} → ${update.status}`);
        });

        // Стратегия: оставляем запись "хорошее", так как она встречается первой
        const resolvedUpdate = mercedesUpdates.find(u => 
            this.statusUpdater.normalizeStatus(u.status) === 'Хорошее'
        ) || mercedesUpdates[0];

        console.log(`Выбрана запись: ${resolvedUpdate.carName} → ${resolvedUpdate.status}`);
        console.log('');

        // Удаляем все записи Mercedes G63AMG и добавляем только выбранную
        const filteredUpdates = updates.filter(u => 
            !(u.carName.toLowerCase().includes('mercedes') && u.carName.toLowerCase().includes('g63amg'))
        );

        filteredUpdates.push(resolvedUpdate);
        return filteredUpdates;
    }

    /**
     * Выполнение обновлений с полным аудитом
     */
    async executeUpdates(updates) {
        console.log('🚀 ВЫПОЛНЕНИЕ ОБНОВЛЕНИЙ:');
        console.log('=' .repeat(60));

        const startTime = Date.now();

        // Логируем начало пакетного обновления
        await this.auditLogger.logBatchStart({
            batchId: this.batchId,
            totalVehicles: updates.length,
            batchSize: updates.length,
            source: 'VehicleStatusUpdateScript',
            operator: 'system'
        });

        // Валидация всего пакета
        console.log('Валидация пакета обновлений...');
        const validation = await this.validator.validateBatchUpdates(updates);
        
        if (!validation.isValid) {
            console.log('❌ Валидация не пройдена:');
            validation.invalidUpdates.forEach(item => {
                console.log(`   • ${item.carName}: ${item.errors.join(', ')}`);
            });
            
            await this.auditLogger.logBatchComplete({
                batchId: this.batchId,
                totalVehicles: updates.length,
                successfulUpdates: 0,
                failedUpdates: validation.invalidCount,
                unchangedVehicles: 0,
                success: false,
                error: 'Batch validation failed',
                errors: validation.invalidUpdates.map(item => item.errors).flat(),
                processingTime: Date.now() - startTime,
                source: 'VehicleStatusUpdateScript',
                operator: 'system'
            });
            
            return false;
        }

        console.log(`✅ Валидация пройдена. Валидных обновлений: ${validation.validCount}`);
        console.log('');

        // Выполняем обновления
        const report = await this.statusUpdater.updateVehicleStatuses(
            validation.validUpdates.map(item => ({
                carName: item.carName,
                status: item.status
            }))
        );

        // Логируем каждое обновление
        for (const update of report.successful) {
            await this.auditLogger.logStatusUpdate({
                carId: update.carId,
                carName: update.carName,
                oldStatus: update.oldStatus,
                newStatus: update.newStatus,
                updateReason: 'Bulk status update from user list',
                source: 'VehicleStatusUpdateScript',
                operator: 'system',
                batchId: this.batchId,
                validationWarnings: validation.validUpdates.find(v => v.carName === update.carName)?.warnings || [],
                processingTime: Date.now() - startTime
            });
        }

        for (const error of report.failed) {
            await this.auditLogger.logStatusUpdateError({
                carName: error.carName,
                attemptedStatus: updates.find(u => u.carName === error.carName)?.status,
                error: error.error,
                updateReason: 'Bulk status update from user list',
                source: 'VehicleStatusUpdateScript',
                operator: 'system',
                batchId: this.batchId,
                processingTime: Date.now() - startTime
            });
        }

        // Логируем завершение пакета
        await this.auditLogger.logBatchComplete({
            batchId: this.batchId,
            totalVehicles: updates.length,
            successfulUpdates: report.summary.updated,
            failedUpdates: report.summary.failed,
            unchangedVehicles: report.summary.unchanged,
            success: report.summary.failed === 0,
            errors: report.summary.errors,
            processingTime: Date.now() - startTime,
            source: 'VehicleStatusUpdateScript',
            operator: 'system'
        });

        // Выводим отчет
        console.log(this.statusUpdater.generateUpdateReport(report));

        return report;
    }

    /**
     * Отображение итогового состояния
     */
    async showFinalState() {
        console.log('📋 ИТОГОВОЕ СОСТОЯНИЕ ГАРАЖА:');
        console.log('=' .repeat(60));

        await this.showCurrentGarageState();
    }

    /**
     * Главная функция выполнения скрипта
     */
    async run() {
        console.log('🚗 ОБНОВЛЕНИЕ СТАТУСОВ АВТОМОБИЛЕЙ В ГАРАЖЕ');
        console.log('=' .repeat(60));
        console.log(`Batch ID: ${this.batchId}`);
        console.log(`Время запуска: ${new Date().toLocaleString('ru-RU')}`);
        console.log('');

        try {
            // Инициализируем подключение к базе данных
            console.log('🔌 Подключение к базе данных...');
            await database.connect();
            console.log('✅ База данных подключена');
            console.log('');
            // 1. Показываем текущее состояние
            await this.showCurrentGarageState();

            // 2. Получаем список обновлений
            let updates = this.getVehicleUpdates();
            console.log(`📝 Получен список из ${updates.length} обновлений`);
            console.log('');

            // 3. Предварительный анализ
            await this.preAnalyzeUpdates(updates);

            // 4. Обрабатываем дубликаты
            updates = await this.resolveMercedesG63AMGDuplicate(updates);

            // 5. Выполняем обновления
            const report = await this.executeUpdates(updates);

            if (report) {
                // 6. Показываем итоговое состояние
                await this.showFinalState();

                console.log('🎉 ОБНОВЛЕНИЕ ЗАВЕРШЕНО УСПЕШНО!');
                console.log(`Batch ID: ${this.batchId}`);
                console.log(`Время завершения: ${new Date().toLocaleString('ru-RU')}`);
            } else {
                console.log('❌ ОБНОВЛЕНИЕ НЕ ВЫПОЛНЕНО ИЗ-ЗА ОШИБОК ВАЛИДАЦИИ');
            }

            // Закрываем соединение с базой данных
            await database.close();

        } catch (error) {
            console.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', error.message);
            console.error('Stack trace:', error.stack);

            // Логируем критическую ошибку
            await this.auditLogger.logBatchComplete({
                batchId: this.batchId,
                totalVehicles: 0,
                successfulUpdates: 0,
                failedUpdates: 0,
                unchangedVehicles: 0,
                success: false,
                error: `Critical error: ${error.message}`,
                processingTime: 0,
                source: 'VehicleStatusUpdateScript',
                operator: 'system'
            });

            // Закрываем соединение с базой данных
            try {
                await database.close();
            } catch (closeError) {
                console.error('Ошибка закрытия базы данных:', closeError.message);
            }

            process.exit(1);
        }
    }
}

// Запуск скрипта, если он выполняется напрямую
if (require.main === module) {
    const script = new VehicleStatusUpdateScript();
    script.run().catch(error => {
        console.error('Необработанная ошибка:', error);
        process.exit(1);
    });
}

module.exports = VehicleStatusUpdateScript;