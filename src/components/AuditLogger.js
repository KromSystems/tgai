const database = require('../database/connection');
const fs = require('fs').promises;
const path = require('path');

/**
 * AuditLogger - Служба для ведения аудита изменений статусов автомобилей
 * Обеспечивает полное логирование всех операций для последующего анализа
 */
class AuditLogger {
    constructor() {
        this.logDir = path.join(process.cwd(), 'logs');
        this.logFile = path.join(this.logDir, 'status_updates.log');
        this.jsonLogFile = path.join(this.logDir, 'status_updates.json');
        this.setupPromise = this.ensureLogDirectory();
    }

    /**
     * Создание директории для логов, если она не существует
     */
    async ensureLogDirectory() {
        try {
            await fs.access(this.logDir);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.mkdir(this.logDir, { recursive: true });
                console.log(`📁 Создана директория для логов: ${this.logDir}`);
            } else {
                throw error;
            }
        }
    }

    /**
     * Создание записи аудита
     * @param {Object} auditData - Данные для аудита
     * @returns {Object} Запись аудита
     */
    createAuditEntry(auditData) {
        const timestamp = new Date().toISOString();
        const auditId = this.generateAuditId();

        return {
            auditId,
            timestamp,
            event: 'status_update',
            carId: auditData.carId || null,
            carName: auditData.carName || null,
            oldStatus: auditData.oldStatus || null,
            newStatus: auditData.newStatus || null,
            updateReason: auditData.updateReason || 'Manual update',
            source: auditData.source || 'StatusUpdaterService',
            operator: auditData.operator || 'system',
            batchId: auditData.batchId || null,
            success: auditData.success !== false, // По умолчанию true
            error: auditData.error || null,
            metadata: {
                userAgent: auditData.userAgent || null,
                ipAddress: auditData.ipAddress || null,
                sessionId: auditData.sessionId || null,
                requestId: auditData.requestId || null,
                validationWarnings: auditData.validationWarnings || [],
                previousUpdate: auditData.previousUpdate || null,
                processingTime: auditData.processingTime || null
            }
        };
    }

    /**
     * Генерация уникального ID для записи аудита
     * @returns {string} Уникальный ID
     */
    generateAuditId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        return `audit_${timestamp}_${random}`;
    }

    /**
     * Логирование успешного обновления статуса
     * @param {Object} updateData - Данные об обновлении
     * @returns {Promise<Object>} Запись аудита
     */
    async logStatusUpdate(updateData) {
        await this.setupPromise;

        const auditEntry = this.createAuditEntry({
            carId: updateData.carId,
            carName: updateData.carName,
            oldStatus: updateData.oldStatus,
            newStatus: updateData.newStatus,
            updateReason: updateData.updateReason,
            source: updateData.source,
            operator: updateData.operator,
            batchId: updateData.batchId,
            success: true,
            validationWarnings: updateData.validationWarnings,
            processingTime: updateData.processingTime
        });

        await this.writeToLogs(auditEntry);
        console.log(`📝 [AUDIT] ${auditEntry.timestamp}: ${updateData.carName} (${updateData.carId}) ${updateData.oldStatus} → ${updateData.newStatus}`);

        return auditEntry;
    }

    /**
     * Логирование неуспешной попытки обновления
     * @param {Object} errorData - Данные об ошибке
     * @returns {Promise<Object>} Запись аудита
     */
    async logStatusUpdateError(errorData) {
        await this.setupPromise;

        const auditEntry = this.createAuditEntry({
            carId: errorData.carId,
            carName: errorData.carName,
            oldStatus: errorData.oldStatus,
            newStatus: errorData.attemptedStatus,
            updateReason: errorData.updateReason,
            source: errorData.source,
            operator: errorData.operator,
            batchId: errorData.batchId,
            success: false,
            error: errorData.error,
            processingTime: errorData.processingTime
        });

        await this.writeToLogs(auditEntry);
        console.log(`❌ [AUDIT] ${auditEntry.timestamp}: Ошибка обновления ${errorData.carName}: ${errorData.error}`);

        return auditEntry;
    }

    /**
     * Логирование начала пакетного обновления
     * @param {Object} batchData - Данные о пакете
     * @returns {Promise<Object>} Запись аудита
     */
    async logBatchStart(batchData) {
        await this.setupPromise;

        const auditEntry = this.createAuditEntry({
            updateReason: 'Batch update started',
            source: batchData.source,
            operator: batchData.operator,
            batchId: batchData.batchId,
            metadata: {
                totalVehicles: batchData.totalVehicles,
                batchSize: batchData.batchSize,
                expectedDuration: batchData.expectedDuration
            }
        });

        auditEntry.event = 'batch_start';
        await this.writeToLogs(auditEntry);
        console.log(`🚀 [AUDIT] ${auditEntry.timestamp}: Начато пакетное обновление ${batchData.totalVehicles} автомобилей (Batch ID: ${batchData.batchId})`);

        return auditEntry;
    }

    /**
     * Логирование завершения пакетного обновления
     * @param {Object} batchData - Данные о завершении пакета
     * @returns {Promise<Object>} Запись аудита
     */
    async logBatchComplete(batchData) {
        await this.setupPromise;

        const auditEntry = this.createAuditEntry({
            updateReason: 'Batch update completed',
            source: batchData.source,
            operator: batchData.operator,
            batchId: batchData.batchId,
            success: batchData.success,
            error: batchData.error,
            metadata: {
                totalVehicles: batchData.totalVehicles,
                successfulUpdates: batchData.successfulUpdates,
                failedUpdates: batchData.failedUpdates,
                unchangedVehicles: batchData.unchangedVehicles,
                processingTime: batchData.processingTime,
                errors: batchData.errors || []
            }
        });

        auditEntry.event = 'batch_complete';
        await this.writeToLogs(auditEntry);
        
        const status = batchData.success ? '✅' : '❌';
        console.log(`${status} [AUDIT] ${auditEntry.timestamp}: Завершено пакетное обновление (Batch ID: ${batchData.batchId}). Успешно: ${batchData.successfulUpdates}, Ошибки: ${batchData.failedUpdates}`);

        return auditEntry;
    }

    /**
     * Запись в файлы логов
     * @param {Object} auditEntry - Запись аудита
     */
    async writeToLogs(auditEntry) {
        try {
            // Запись в текстовый лог
            const logLine = this.formatLogLine(auditEntry);
            await fs.appendFile(this.logFile, logLine + '\n', 'utf8');

            // Запись в JSON лог
            await fs.appendFile(this.jsonLogFile, JSON.stringify(auditEntry) + '\n', 'utf8');

        } catch (error) {
            console.error('Ошибка записи в лог файлы:', error);
            // Не выбрасываем ошибку, чтобы не прерывать основной процесс
        }
    }

    /**
     * Форматирование строки лога
     * @param {Object} auditEntry - Запись аудита
     * @returns {string} Отформатированная строка
     */
    formatLogLine(auditEntry) {
        const timestamp = auditEntry.timestamp;
        const event = auditEntry.event.toUpperCase();
        const status = auditEntry.success ? 'SUCCESS' : 'ERROR';
        
        let details = [];
        
        if (auditEntry.carName) {
            details.push(`Vehicle: ${auditEntry.carName} (ID: ${auditEntry.carId})`);
        }
        
        if (auditEntry.oldStatus && auditEntry.newStatus) {
            details.push(`Status: ${auditEntry.oldStatus} → ${auditEntry.newStatus}`);
        }
        
        if (auditEntry.batchId) {
            details.push(`Batch: ${auditEntry.batchId}`);
        }
        
        if (auditEntry.error) {
            details.push(`Error: ${auditEntry.error}`);
        }

        const detailsStr = details.join(' | ');
        return `[${timestamp}] ${event} ${status} ${auditEntry.auditId} - ${detailsStr}`;
    }

    /**
     * Получение истории изменений для автомобиля
     * @param {number} carId - ID автомобиля
     * @param {number} limit - Лимит записей (по умолчанию 50)
     * @returns {Promise<Array>} Массив записей аудита
     */
    async getVehicleHistory(carId, limit = 50) {
        try {
            await this.setupPromise;
            const entries = await this.readJsonLogs();
            
            return entries
                .filter(entry => entry.carId === carId)
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, limit);
        } catch (error) {
            console.error('Ошибка получения истории автомобиля:', error);
            return [];
        }
    }

    /**
     * Получение записей пакетного обновления
     * @param {string} batchId - ID пакета
     * @returns {Promise<Array>} Массив записей аудита
     */
    async getBatchHistory(batchId) {
        try {
            await this.setupPromise;
            const entries = await this.readJsonLogs();
            
            return entries
                .filter(entry => entry.batchId === batchId)
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        } catch (error) {
            console.error('Ошибка получения истории пакета:', error);
            return [];
        }
    }

    /**
     * Чтение JSON логов из файла
     * @returns {Promise<Array>} Массив записей аудита
     */
    async readJsonLogs() {
        try {
            const content = await fs.readFile(this.jsonLogFile, 'utf8');
            const lines = content.trim().split('\n').filter(line => line.trim());
            return lines.map(line => JSON.parse(line));
        } catch (error) {
            if (error.code === 'ENOENT') {
                return []; // Файл не существует - возвращаем пустой массив
            }
            throw error;
        }
    }

    /**
     * Получение статистики обновлений за период
     * @param {Date} startDate - Начальная дата
     * @param {Date} endDate - Конечная дата
     * @returns {Promise<Object>} Статистика обновлений
     */
    async getUpdateStatistics(startDate, endDate) {
        try {
            const entries = await this.readJsonLogs();
            const filteredEntries = entries.filter(entry => {
                const entryDate = new Date(entry.timestamp);
                return entryDate >= startDate && entryDate <= endDate && entry.event === 'status_update';
            });

            const stats = {
                totalUpdates: filteredEntries.length,
                successfulUpdates: filteredEntries.filter(e => e.success).length,
                failedUpdates: filteredEntries.filter(e => !e.success).length,
                statusTransitions: {},
                vehicleUpdateCounts: {},
                operatorActivity: {},
                timeRange: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString()
                }
            };

            // Анализ переходов статусов
            filteredEntries.forEach(entry => {
                if (entry.oldStatus && entry.newStatus) {
                    const transition = `${entry.oldStatus} → ${entry.newStatus}`;
                    stats.statusTransitions[transition] = (stats.statusTransitions[transition] || 0) + 1;
                }

                if (entry.carName) {
                    stats.vehicleUpdateCounts[entry.carName] = (stats.vehicleUpdateCounts[entry.carName] || 0) + 1;
                }

                if (entry.operator) {
                    stats.operatorActivity[entry.operator] = (stats.operatorActivity[entry.operator] || 0) + 1;
                }
            });

            return stats;
        } catch (error) {
            console.error('Ошибка получения статистики:', error);
            return null;
        }
    }

    /**
     * Архивирование старых логов
     * @param {number} daysToKeep - Количество дней для хранения
     * @returns {Promise<boolean>} Успех операции
     */
    async archiveOldLogs(daysToKeep = 90) {
        try {
            await this.setupPromise;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            const entries = await this.readJsonLogs();
            const recentEntries = entries.filter(entry => 
                new Date(entry.timestamp) >= cutoffDate
            );

            const archivedEntries = entries.filter(entry => 
                new Date(entry.timestamp) < cutoffDate
            );

            if (archivedEntries.length > 0) {
                // Создаем архивный файл
                const archiveFile = path.join(this.logDir, `archived_${Date.now()}.json`);
                await fs.writeFile(archiveFile, archivedEntries.map(e => JSON.stringify(e)).join('\n'), 'utf8');

                // Перезаписываем основной файл только с актуальными записями
                await fs.writeFile(this.jsonLogFile, recentEntries.map(e => JSON.stringify(e)).join('\n'), 'utf8');

                console.log(`📦 Архивировано ${archivedEntries.length} записей в ${archiveFile}`);
            }

            return true;
        } catch (error) {
            console.error('Ошибка архивирования логов:', error);
            return false;
        }
    }

    /**
     * Генерация уникального ID для пакета
     * @returns {string} Уникальный ID пакета
     */
    generateBatchId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 6);
        return `batch_${timestamp}_${random}`;
    }

    /**
     * Очистка всех логов (использовать с осторожностью!)
     * @returns {Promise<boolean>} Успех операции
     */
    async clearAllLogs() {
        try {
            await this.setupPromise;
            await fs.writeFile(this.logFile, '', 'utf8');
            await fs.writeFile(this.jsonLogFile, '', 'utf8');
            console.log('🗑️  Все логи очищены');
            return true;
        } catch (error) {
            console.error('Ошибка очистки логов:', error);
            return false;
        }
    }
}

module.exports = AuditLogger;