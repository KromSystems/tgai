const Garage = require('../src/database/models/garage');
const database = require('../src/database/connection');

describe('Garage Model', () => {
    beforeAll(async () => {
        // Подключаемся к тестовой базе данных
        await database.connect();
        
        // Создаем таблицу для тестов (если не существует)
        await database.run(`
            CREATE TABLE IF NOT EXISTS garage (
                car_id INTEGER PRIMARY KEY,
                car_name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Хорошее' CHECK (status IN ('Среднее', 'Хорошее', 'Плохое')),
                last_maintenance DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    });

    beforeEach(async () => {
        // Очищаем таблицу перед каждым тестом
        await database.run('DELETE FROM garage');
        
        // Добавляем тестовые данные
        await database.run(`
            INSERT INTO garage (car_id, car_name, status, last_maintenance) 
            VALUES 
                (1, 'Infernus', 'Хорошее', datetime('now', '-5 days')),
                (2, 'Cheetah', 'Среднее', datetime('now', '-10 days')),
                (3, 'Banshee', 'Плохое', datetime('now', '-20 days'))
        `);
    });

    afterAll(async () => {
        // Очищаем данные после тестов
        await database.run('DELETE FROM garage');
        await database.close();
    });

    describe('getAllCars', () => {
        test('должен вернуть все автомобили', async () => {
            const cars = await Garage.getAllCars();
            
            expect(cars).toHaveLength(3);
            expect(cars[0]).toBeInstanceOf(Garage);
            expect(cars[0].car_name).toBe('Infernus');
        });
    });

    describe('findById', () => {
        test('должен найти автомобиль по ID', async () => {
            const car = await Garage.findById(1);
            
            expect(car).toBeInstanceOf(Garage);
            expect(car.car_name).toBe('Infernus');
            expect(car.status).toBe('Хорошее');
        });

        test('должен вернуть null для несуществующего ID', async () => {
            const car = await Garage.findById(999);
            expect(car).toBeNull();
        });
    });

    describe('getCarsPaginated', () => {
        test('должен вернуть автомобили с пагинацией', async () => {
            const result = await Garage.getCarsPaginated(0, 2);
            
            expect(result.cars).toHaveLength(2);
            expect(result.pagination.currentPage).toBe(0);
            expect(result.pagination.pageSize).toBe(2);
            expect(result.pagination.total).toBe(3);
            expect(result.pagination.totalPages).toBe(2);
            expect(result.pagination.hasNext).toBe(true);
            expect(result.pagination.hasPrev).toBe(false);
        });

        test('должен правильно обрабатывать вторую страницу', async () => {
            const result = await Garage.getCarsPaginated(1, 2);
            
            expect(result.cars).toHaveLength(1);
            expect(result.pagination.currentPage).toBe(1);
            expect(result.pagination.hasNext).toBe(false);
            expect(result.pagination.hasPrev).toBe(true);
        });
    });

    describe('updateStatus', () => {
        test('должен обновить статус автомобиля', async () => {
            await Garage.updateStatus(1, 'Плохое');
            
            const car = await Garage.findById(1);
            expect(car.status).toBe('Плохое');
        });

        test('должен выбросить ошибку для недопустимого статуса', async () => {
            await expect(Garage.updateStatus(1, 'Отличное')).rejects.toThrow('Недопустимый статус');
        });

        test('должен выбросить ошибку для несуществующего автомобиля', async () => {
            await expect(Garage.updateStatus(999, 'Хорошее')).rejects.toThrow('Автомобиль с ID 999 не найден');
        });
    });

    describe('getByStatus', () => {
        test('должен вернуть автомобили по статусу', async () => {
            const goodCars = await Garage.getByStatus('Хорошее');
            const badCars = await Garage.getByStatus('Плохое');
            
            expect(goodCars).toHaveLength(1);
            expect(goodCars[0].car_name).toBe('Infernus');
            
            expect(badCars).toHaveLength(1);
            expect(badCars[0].car_name).toBe('Banshee');
        });
    });

    describe('getStatistics', () => {
        test('должен вернуть статистику автомобилей', async () => {
            const stats = await Garage.getStatistics();
            
            expect(stats.total).toBe(3);
            expect(stats['Хорошее']).toBe(1);
            expect(stats['Среднее']).toBe(1);
            expect(stats['Плохое']).toBe(1);
        });
    });

    describe('Instance methods', () => {
        test('isMaintenanceNeeded должен правильно определять необходимость обслуживания', async () => {
            const cars = await Garage.getAllCars();
            const infernus = cars.find(car => car.car_name === 'Infernus');
            const banshee = cars.find(car => car.car_name === 'Banshee');
            
            // Infernus - хорошее состояние, но прошло 5 дней (меньше 7)
            expect(infernus.isMaintenanceNeeded()).toBe(false);
            
            // Banshee - плохое состояние
            expect(banshee.isMaintenanceNeeded()).toBe(true);
        });

        test('getStatusEmoji должен вернуть правильный эмодзи', async () => {
            const cars = await Garage.getAllCars();
            const infernus = cars.find(car => car.car_name === 'Infernus');
            const cheetah = cars.find(car => car.car_name === 'Cheetah');
            const banshee = cars.find(car => car.car_name === 'Banshee');
            
            expect(infernus.getStatusEmoji()).toBe('🟢');
            expect(cheetah.getStatusEmoji()).toBe('🟡');
            expect(banshee.getStatusEmoji()).toBe('🔴');
        });

        test('getDisplayName должен вернуть полное описание', async () => {
            const car = await Garage.findById(1);
            expect(car.getDisplayName()).toBe('🟢 Infernus: Хорошее');
        });
    });

    describe('update', () => {
        test('должен обновить данные автомобиля', async () => {
            const car = await Garage.findById(1);
            await car.update({ status: 'Среднее' });
            
            expect(car.status).toBe('Среднее');
            
            // Проверяем обновление в БД
            const updatedCar = await Garage.findById(1);
            expect(updatedCar.status).toBe('Среднее');
        });

        test('должен игнорировать недопустимые поля', async () => {
            const car = await Garage.findById(1);
            const originalName = car.car_name;
            
            await car.update({ invalid_field: 'test', car_name: 'NewName' });
            
            expect(car.car_name).toBe('NewName');
            expect(car.invalid_field).toBeUndefined();
        });
    });
});