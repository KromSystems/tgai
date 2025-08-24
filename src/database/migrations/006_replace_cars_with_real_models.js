/**
 * Migration: Replace GTA cars with real car models
 * Заменяет автомобили из GTA San Andreas на реальные модели автомобилей
 */

const database = require('../connection');

async function up() {
    try {
        console.log('🚗 Начинаем замену автомобилей на реальные модели...');

        // Проверяем, есть ли связанные заявки
        const requestsCheck = await database.get('SELECT COUNT(*) as count FROM garage_requests');
        if (requestsCheck.count > 0) {
            console.log(`⚠️  Обнаружено ${requestsCheck.count} заявок в системе. Отключаем проверку внешних ключей...`);
        }

        // Отключаем проверку внешних ключей
        await database.run('PRAGMA foreign_keys = OFF');
        console.log('🔓 Проверка внешних ключей отключена');

        // Новый список реальных автомобилей (исключаем дубликат Mercedes G63AMG)
        const newCars = [
            { car_id: 1, car_name: 'BMW 4-Series', status: 'Хорошее' },
            { car_id: 2, car_name: 'Audi RS6', status: 'Среднее' },
            { car_id: 3, car_name: 'Mercedes G63AMG', status: 'Плохое' },
            { car_id: 4, car_name: 'Tesla Model 3', status: 'Хорошее' },
            { car_id: 5, car_name: 'Chevrolet Camaro', status: 'Среднее' },
            { car_id: 6, car_name: 'Rolls-Royce Phantom', status: 'Хорошее' },
            { car_id: 7, car_name: 'Ferrari J50', status: 'Плохое' },
            { car_id: 8, car_name: 'Porsche 911', status: 'Среднее' },
            { car_id: 9, car_name: 'Sparrow', status: 'Хорошее' },
            { car_id: 10, car_name: 'Ducati Ducnaked', status: 'Плохое' },
            { car_id: 11, car_name: 'NRG-500', status: 'Среднее' },
            { car_id: 12, car_name: 'Mercedes-Benz C63S', status: 'Хорошее' },
            { car_id: 13, car_name: 'BMW M3 Touring', status: 'Среднее' },
            { car_id: 14, car_name: 'Lamborghini Huracan 2022', status: 'Плохое' }
        ];

        // Очищаем текущую таблицу автомобилей
        await database.run('DELETE FROM garage');
        console.log('🗑️  Старые автомобили удалены');

        // Сбрасываем счетчик автоинкремента (если используется)
        await database.run('DELETE FROM sqlite_sequence WHERE name = "garage"');

        // Вставляем новые автомобили
        const insertSql = `
            INSERT INTO garage (car_id, car_name, status, last_maintenance, created_at) 
            VALUES (?, ?, ?, datetime('now', '-' || (ABS(RANDOM()) % 30 + 1) || ' days'), CURRENT_TIMESTAMP)
        `;

        let insertedCount = 0;
        for (const car of newCars) {
            try {
                await database.run(insertSql, [car.car_id, car.car_name, car.status]);
                insertedCount++;
                console.log(`✅ Добавлен: ${car.car_name} (${car.status})`);
            } catch (error) {
                console.error(`❌ Ошибка добавления ${car.car_name}:`, error.message);
                throw error;
            }
        }

        // Включаем обратно проверку внешних ключей
        await database.run('PRAGMA foreign_keys = ON');
        console.log('🔒 Проверка внешних ключей включена');

        console.log(`🎉 Успешно добавлено ${insertedCount} автомобилей`);

        // Проверяем финальное состояние
        const finalCount = await database.get('SELECT COUNT(*) as count FROM garage');
        console.log(`📊 Всего автомобилей в гараже: ${finalCount.count}`);

        // Показываем статистику по статусам
        const statsQuery = `
            SELECT 
                status,
                COUNT(*) as count
            FROM garage 
            GROUP BY status
        `;
        
        const stats = await database.all(statsQuery);
        console.log('📈 Статистика по статусам:');
        stats.forEach(stat => {
            const emoji = stat.status === 'Хорошее' ? '🟢' : stat.status === 'Среднее' ? '🟡' : '🔴';
            console.log(`   ${emoji} ${stat.status}: ${stat.count} автомобилей`);
        });

        return true;
    } catch (error) {
        console.error('❌ Ошибка замены автомобилей:', error);
        
        // В случае ошибки включаем обратно проверку внешних ключей
        try {
            await database.run('PRAGMA foreign_keys = ON');
        } catch (pragmaError) {
            console.error('❌ Ошибка включения PRAGMA:', pragmaError);
        }
        
        throw error;
    }
}

async function down() {
    try {
        console.log('🔄 Откат к автомобилям GTA San Andreas...');
        
        // Восстанавливаем старые автомобили из GTA
        const gtaCars = [
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

        // Очищаем текущую таблицу
        await database.run('DELETE FROM garage');
        
        // Восстанавливаем GTA автомобили
        const insertSql = `
            INSERT INTO garage (car_id, car_name, status, last_maintenance, created_at) 
            VALUES (?, ?, ?, datetime('now', '-' || (ABS(RANDOM()) % 30 + 1) || ' days'), CURRENT_TIMESTAMP)
        `;

        for (const car of gtaCars) {
            await database.run(insertSql, [car.car_id, car.car_name, car.status]);
        }

        console.log('✅ Автомобили GTA San Andreas восстановлены');
        return true;
    } catch (error) {
        console.error('❌ Ошибка отката миграции:', error);
        throw error;
    }
}

module.exports = {
    up,
    down,
    description: 'Replace GTA San Andreas cars with real car models from user list'
};