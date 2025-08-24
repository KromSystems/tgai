const Garage = require('../database/models/garage');
const database = require('../database/connection');

/**
 * VehicleMatchingService - Служба для сопоставления названий автомобилей
 * Обеспечивает интеллектуальный поиск и сопоставление названий автомобилей
 */
class VehicleMatchingService {
    constructor() {
        this.similarityThreshold = 0.7; // Порог схожести для fuzzy matching
    }

    /**
     * Нормализация названия автомобиля
     * @param {string} name - Название автомобиля
     * @returns {string} Нормализованное название
     */
    normalizeVehicleName(name) {
        if (!name || typeof name !== 'string') {
            return '';
        }

        return name
            .trim()
            .replace(/\s+/g, ' ') // Убираем лишние пробелы
            .replace(/[^\w\s-]/g, '') // Убираем специальные символы, кроме дефисов
            .toLowerCase();
    }

    /**
     * Вычисление расстояния Левенштейна между строками
     * @param {string} str1 - Первая строка
     * @param {string} str2 - Вторая строка
     * @returns {number} Расстояние Левенштейна
     */
    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

        for (let i = 0; i <= str1.length; i++) {
            matrix[0][i] = i;
        }

        for (let j = 0; j <= str2.length; j++) {
            matrix[j][0] = j;
        }

        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1, // deletion
                    matrix[j - 1][i] + 1, // insertion
                    matrix[j - 1][i - 1] + indicator // substitution
                );
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Вычисление коэффициента схожести между строками
     * @param {string} str1 - Первая строка
     * @param {string} str2 - Вторая строка
     * @returns {number} Коэффициент схожести (0-1)
     */
    calculateSimilarity(str1, str2) {
        const normalized1 = this.normalizeVehicleName(str1);
        const normalized2 = this.normalizeVehicleName(str2);

        if (normalized1 === normalized2) {
            return 1.0;
        }

        const maxLength = Math.max(normalized1.length, normalized2.length);
        if (maxLength === 0) {
            return 1.0;
        }

        const distance = this.levenshteinDistance(normalized1, normalized2);
        return 1 - (distance / maxLength);
    }

    /**
     * Поиск точного совпадения
     * @param {string} carName - Название автомобиля
     * @returns {Promise<Object|null>} Найденный автомобиль
     */
    async findExactMatch(carName) {
        const sql = 'SELECT * FROM garage WHERE car_name = ?';
        try {
            const row = await database.get(sql, [carName]);
            return row ? new Garage(row) : null;
        } catch (error) {
            throw new Error(`Ошибка точного поиска: ${error.message}`);
        }
    }

    /**
     * Поиск с игнорированием регистра
     * @param {string} carName - Название автомобиля
     * @returns {Promise<Object|null>} Найденный автомобиль
     */
    async findCaseInsensitiveMatch(carName) {
        const sql = 'SELECT * FROM garage WHERE LOWER(TRIM(car_name)) = LOWER(TRIM(?))';
        try {
            const row = await database.get(sql, [carName]);
            return row ? new Garage(row) : null;
        } catch (error) {
            throw new Error(`Ошибка поиска без учета регистра: ${error.message}`);
        }
    }

    /**
     * Поиск дубликатов по названию
     * @param {string} carName - Название автомобиля
     * @returns {Promise<Array>} Массив найденных дубликатов
     */
    async findDuplicates(carName) {
        const sql = 'SELECT * FROM garage WHERE LOWER(TRIM(car_name)) = LOWER(TRIM(?))';
        try {
            const rows = await database.all(sql, [carName]);
            return rows.map(row => new Garage(row));
        } catch (error) {
            throw new Error(`Ошибка поиска дубликатов: ${error.message}`);
        }
    }

    /**
     * Fuzzy поиск по схожести названий
     * @param {string} carName - Название автомобиля
     * @param {number} threshold - Порог схожести (по умолчанию из this.similarityThreshold)
     * @returns {Promise<Array>} Массив найденных автомобилей с коэффициентом схожести
     */
    async findFuzzyMatches(carName, threshold = this.similarityThreshold) {
        try {
            const allCars = await Garage.getAllCars();
            const matches = [];

            for (const car of allCars) {
                const similarity = this.calculateSimilarity(carName, car.car_name);
                if (similarity >= threshold) {
                    matches.push({
                        vehicle: car,
                        similarity,
                        matchType: similarity === 1.0 ? 'exact' : 'fuzzy'
                    });
                }
            }

            // Сортируем по убыванию схожести
            return matches.sort((a, b) => b.similarity - a.similarity);
        } catch (error) {
            throw new Error(`Ошибка fuzzy поиска: ${error.message}`);
        }
    }

    /**
     * Поиск по ключевым словам
     * @param {string} carName - Название автомобиля
     * @returns {Promise<Array>} Массив найденных автомобилей
     */
    async findByKeywords(carName) {
        try {
            const keywords = this.extractKeywords(carName);
            if (keywords.length === 0) {
                return [];
            }

            const allCars = await Garage.getAllCars();
            const matches = [];

            for (const car of allCars) {
                const carKeywords = this.extractKeywords(car.car_name);
                const commonKeywords = keywords.filter(keyword => 
                    carKeywords.some(carKeyword => 
                        carKeyword.includes(keyword) || keyword.includes(carKeyword)
                    )
                );

                if (commonKeywords.length > 0) {
                    const score = commonKeywords.length / Math.max(keywords.length, carKeywords.length);
                    matches.push({
                        vehicle: car,
                        score,
                        commonKeywords,
                        matchType: 'keyword'
                    });
                }
            }

            return matches.sort((a, b) => b.score - a.score);
        } catch (error) {
            throw new Error(`Ошибка поиска по ключевым словам: ${error.message}`);
        }
    }

    /**
     * Извлечение ключевых слов из названия
     * @param {string} name - Название автомобиля
     * @returns {Array<string>} Массив ключевых слов
     */
    extractKeywords(name) {
        const normalized = this.normalizeVehicleName(name);
        return normalized
            .split(/[\s\-]+/)
            .filter(word => word.length > 1) // Исключаем однобуквенные слова
            .filter(word => !['the', 'and', 'or', 'for', 'in', 'on', 'at', 'to', 'of'].includes(word));
    }

    /**
     * Комплексный поиск автомобиля
     * @param {string} carName - Название автомобиля
     * @returns {Promise<Object>} Результат поиска с деталями
     */
    async findVehicle(carName) {
        const searchResult = {
            query: carName,
            found: false,
            matchType: null,
            vehicle: null,
            alternatives: [],
            duplicates: [],
            confidence: 0
        };

        try {
            // 1. Точное совпадение
            let match = await this.findExactMatch(carName);
            if (match) {
                searchResult.found = true;
                searchResult.matchType = 'exact';
                searchResult.vehicle = match;
                searchResult.confidence = 1.0;
                
                // Проверяем на дубликаты
                const duplicates = await this.findDuplicates(carName);
                if (duplicates.length > 1) {
                    searchResult.duplicates = duplicates;
                }
                
                return searchResult;
            }

            // 2. Поиск без учета регистра
            match = await this.findCaseInsensitiveMatch(carName);
            if (match) {
                searchResult.found = true;
                searchResult.matchType = 'case_insensitive';
                searchResult.vehicle = match;
                searchResult.confidence = 0.95;
                return searchResult;
            }

            // 3. Fuzzy поиск
            const fuzzyMatches = await this.findFuzzyMatches(carName);
            if (fuzzyMatches.length > 0) {
                const bestMatch = fuzzyMatches[0];
                searchResult.found = true;
                searchResult.matchType = 'fuzzy';
                searchResult.vehicle = bestMatch.vehicle;
                searchResult.confidence = bestMatch.similarity;
                searchResult.alternatives = fuzzyMatches.slice(1, 4); // До 3 альтернатив
                return searchResult;
            }

            // 4. Поиск по ключевым словам
            const keywordMatches = await this.findByKeywords(carName);
            if (keywordMatches.length > 0) {
                searchResult.alternatives = keywordMatches.slice(0, 5); // До 5 альтернатив
            }

            return searchResult;

        } catch (error) {
            searchResult.error = error.message;
            return searchResult;
        }
    }

    /**
     * Разрешение дубликатов по дополнительным критериям
     * @param {Array} duplicates - Массив дубликатов
     * @param {Object} criteria - Критерии для выбора (статус, ID и т.д.)
     * @returns {Object} Выбранный автомобиль
     */
    resolveDuplicates(duplicates, criteria = {}) {
        if (!duplicates || duplicates.length === 0) {
            return null;
        }

        if (duplicates.length === 1) {
            return duplicates[0];
        }

        // Стратегии разрешения дубликатов:
        
        // 1. По предпочтительному статусу
        if (criteria.preferredStatus) {
            const statusMatch = duplicates.find(car => car.status === criteria.preferredStatus);
            if (statusMatch) {
                return statusMatch;
            }
        }

        // 2. По ID (меньший ID = более старая запись)
        if (criteria.preferOlder) {
            return duplicates.reduce((oldest, current) => 
                current.car_id < oldest.car_id ? current : oldest
            );
        }

        // 3. По последнему обслуживанию (более свежее)
        if (criteria.preferRecentMaintenance) {
            return duplicates.reduce((recent, current) => {
                if (!recent.last_maintenance) return current;
                if (!current.last_maintenance) return recent;
                return new Date(current.last_maintenance) > new Date(recent.last_maintenance) ? current : recent;
            });
        }

        // По умолчанию - первый найденный
        return duplicates[0];
    }

    /**
     * Получение рекомендаций для исправления названия
     * @param {string} carName - Неправильное название
     * @returns {Promise<Array>} Массив рекомендаций
     */
    async getSuggestions(carName) {
        try {
            const fuzzyMatches = await this.findFuzzyMatches(carName, 0.3); // Более низкий порог
            const keywordMatches = await this.findByKeywords(carName);

            const suggestions = new Set();

            // Добавляем fuzzy matches
            fuzzyMatches.slice(0, 3).forEach(match => {
                suggestions.add(match.vehicle.car_name);
            });

            // Добавляем keyword matches
            keywordMatches.slice(0, 3).forEach(match => {
                suggestions.add(match.vehicle.car_name);
            });

            return Array.from(suggestions);
        } catch (error) {
            console.error('Ошибка получения рекомендаций:', error);
            return [];
        }
    }

    /**
     * Валидация существования автомобиля
     * @param {string} carName - Название автомобиля
     * @returns {Promise<Object>} Результат валидации
     */
    async validateVehicleExists(carName) {
        const result = await this.findVehicle(carName);
        
        return {
            isValid: result.found,
            vehicle: result.vehicle,
            confidence: result.confidence,
            matchType: result.matchType,
            suggestions: result.alternatives.map(alt => alt.vehicle ? alt.vehicle.car_name : alt.vehicle),
            duplicates: result.duplicates,
            error: result.error
        };
    }
}

module.exports = VehicleMatchingService;