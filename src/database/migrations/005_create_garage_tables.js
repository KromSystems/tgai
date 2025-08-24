/**
 * Migration: Create garage and garage_requests tables
 * Создает систему управления гаражом для автоматизации замены масла
 */

const database = require('../connection');

async function up() {
    try {
        // Создание таблицы garage (основные автомобили)
        const garageTableSql = `
            CREATE TABLE IF NOT EXISTS garage (
                car_id INTEGER PRIMARY KEY,
                car_name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Хорошее' CHECK (status IN ('Среднее', 'Хорошее', 'Плохое')),
                last_maintenance DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        await database.run(garageTableSql);
        console.log('✅ garage table created successfully');

        // Создание таблицы garage_requests (заявки на обслуживание)
        const garageRequestsTableSql = `
            CREATE TABLE IF NOT EXISTS garage_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                car_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                telegram_id TEXT NOT NULL,
                photo_path TEXT NOT NULL,
                payment_status TEXT NOT NULL DEFAULT 'Не выплачено' CHECK (payment_status IN ('Не выплачено', 'Принято', 'Отклонено', 'Производится оплата')),
                admin_comment TEXT,
                admin_id INTEGER,
                submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                processed_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (car_id) REFERENCES garage (car_id),
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (admin_id) REFERENCES users (id)
            )
        `;
        
        await database.run(garageRequestsTableSql);
        console.log('✅ garage_requests table created successfully');

        // Создание индексов для оптимизации производительности
        const indices = [
            'CREATE INDEX IF NOT EXISTS idx_garage_requests_user_id ON garage_requests (user_id)',
            'CREATE INDEX IF NOT EXISTS idx_garage_requests_car_id ON garage_requests (car_id)',
            'CREATE INDEX IF NOT EXISTS idx_garage_requests_telegram_id ON garage_requests (telegram_id)',
            'CREATE INDEX IF NOT EXISTS idx_garage_requests_status ON garage_requests (payment_status)',
            'CREATE INDEX IF NOT EXISTS idx_garage_requests_submitted_at ON garage_requests (submitted_at)',
            'CREATE INDEX IF NOT EXISTS idx_garage_car_name ON garage (car_name)',
            'CREATE INDEX IF NOT EXISTS idx_garage_status ON garage (status)'
        ];

        for (const indexSql of indices) {
            await database.run(indexSql);
        }
        console.log('✅ Garage table indices created successfully');

        // Инициализация автомобилей по умолчанию (20 автомобилей из GTA San Andreas)
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

        // Проверяем, есть ли уже данные в таблице
        const existingCars = await database.get('SELECT COUNT(*) as count FROM garage');
        
        if (existingCars.count === 0) {
            const insertCarSql = `
                INSERT INTO garage (car_id, car_name, status, last_maintenance) 
                VALUES (?, ?, ?, datetime('now', '-' || (ABS(RANDOM()) % 30 + 1) || ' days'))
            `;
            
            for (const car of defaultCars) {
                await database.run(insertCarSql, [car.car_id, car.car_name, car.status]);
            }
            console.log('✅ Default cars initialized successfully');
        } else {
            console.log('ℹ️ Cars already exist in database, skipping initialization');
        }

        // Создание триггера для автоматического обновления updated_at
        const triggerSql = `
            CREATE TRIGGER IF NOT EXISTS garage_update_timestamp 
            AFTER UPDATE ON garage
            BEGIN
                UPDATE garage SET updated_at = CURRENT_TIMESTAMP WHERE car_id = NEW.car_id;
            END
        `;
        
        await database.run(triggerSql);

        const requestsTriggerSql = `
            CREATE TRIGGER IF NOT EXISTS garage_requests_update_timestamp 
            AFTER UPDATE ON garage_requests
            BEGIN
                UPDATE garage_requests SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
        `;
        
        await database.run(requestsTriggerSql);
        console.log('✅ Database triggers created successfully');

        return true;
    } catch (error) {
        console.error('❌ Error creating garage tables:', error);
        throw error;
    }
}

async function down() {
    try {
        // Удаление триггеров
        await database.run('DROP TRIGGER IF EXISTS garage_update_timestamp');
        await database.run('DROP TRIGGER IF EXISTS garage_requests_update_timestamp');
        
        // Удаление таблиц (в обратном порядке из-за внешних ключей)
        await database.run('DROP TABLE IF EXISTS garage_requests');
        await database.run('DROP TABLE IF EXISTS garage');
        
        console.log('✅ Garage tables dropped successfully');
        return true;
    } catch (error) {
        console.error('❌ Error dropping garage tables:', error);
        throw error;
    }
}

module.exports = {
    up,
    down,
    description: 'Create garage and garage_requests tables for car maintenance management system'
};