const GarageRequest = require('../src/database/models/garageRequest');
const Garage = require('../src/database/models/garage');
const User = require('../src/database/models/user');
const database = require('../src/database/connection');
const fs = require('fs');
const path = require('path');

describe('GarageRequest Model', () => {
    let testUser;
    let testCar;

    beforeAll(async () => {
        // Подключаемся к тестовой базе данных
        await database.connect();
        
        // Создаем необходимые таблицы
        await database.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER NOT NULL UNIQUE,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                language_code TEXT,
                is_bot INTEGER DEFAULT 0,
                authorized INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await database.run(`
            CREATE TABLE IF NOT EXISTS garage (
                car_id INTEGER PRIMARY KEY,
                car_name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Хорошее',
                last_maintenance DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await database.run(`
            CREATE TABLE IF NOT EXISTS garage_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                car_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                telegram_id TEXT NOT NULL,
                photo_path TEXT NOT NULL,
                payment_status TEXT NOT NULL DEFAULT 'Не выплачено',
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
        `);
    });

    beforeEach(async () => {
        // Очищаем таблицы
        await database.run('DELETE FROM garage_requests');
        await database.run('DELETE FROM users');
        await database.run('DELETE FROM garage');
        
        // Создаем тестового пользователя
        const userData = {
            telegram_id: 123456789,
            username: 'testuser',
            first_name: 'Test',
            last_name: 'User',
            authorized: 1
        };
        testUser = await User.create(userData);
        
        // Создаем тестовый автомобиль
        await database.run(`
            INSERT INTO garage (car_id, car_name, status) 
            VALUES (1, 'TestCar', 'Среднее')
        `);
        testCar = await Garage.findById(1);
        
        // Создаем тестовый файл фотографии
        const testPhotoPath = path.join(__dirname, 'test_photo.jpg');
        if (!fs.existsSync(testPhotoPath)) {
            fs.writeFileSync(testPhotoPath, 'test photo content');
        }
    });

    afterEach(async () => {
        // Удаляем тестовый файл фотографии
        const testPhotoPath = path.join(__dirname, 'test_photo.jpg');
        if (fs.existsSync(testPhotoPath)) {
            fs.unlinkSync(testPhotoPath);
        }
    });

    afterAll(async () => {
        // Очищаем данные и закрываем соединение
        await database.run('DELETE FROM garage_requests');
        await database.run('DELETE FROM users');
        await database.run('DELETE FROM garage');
        await database.close();
    });

    describe('create', () => {
        test('должен создать новую заявку', async () => {
            const requestData = {
                car_id: testCar.car_id,
                user_id: testUser.id,
                telegram_id: testUser.telegram_id.toString(),
                photo_path: path.join(__dirname, 'test_photo.jpg'),
                payment_status: 'Не выплачено'
            };

            const request = await GarageRequest.create(requestData);

            expect(request).toBeInstanceOf(GarageRequest);
            expect(request.car_id).toBe(testCar.car_id);
            expect(request.user_id).toBe(testUser.id);
            expect(request.payment_status).toBe('Не выплачено');
        });
    });

    describe('findById', () => {
        test('должен найти заявку по ID', async () => {
            // Создаем заявку
            const requestData = {
                car_id: testCar.car_id,
                user_id: testUser.id,
                telegram_id: testUser.telegram_id.toString(),
                photo_path: path.join(__dirname, 'test_photo.jpg')
            };
            const createdRequest = await GarageRequest.create(requestData);

            // Ищем по ID
            const foundRequest = await GarageRequest.findById(createdRequest.id);

            expect(foundRequest).toBeInstanceOf(GarageRequest);
            expect(foundRequest.id).toBe(createdRequest.id);
        });

        test('должен вернуть null для несуществующего ID', async () => {
            const request = await GarageRequest.findById(999);
            expect(request).toBeNull();
        });
    });

    describe('findByUserAndCar', () => {
        test('должен найти заявку пользователя для автомобиля', async () => {
            const requestData = {
                car_id: testCar.car_id,
                user_id: testUser.id,
                telegram_id: testUser.telegram_id.toString(),
                photo_path: path.join(__dirname, 'test_photo.jpg')
            };
            await GarageRequest.create(requestData);

            const foundRequest = await GarageRequest.findByUserAndCar(testUser.id, testCar.car_id);

            expect(foundRequest).toBeInstanceOf(GarageRequest);
            expect(foundRequest.user_id).toBe(testUser.id);
            expect(foundRequest.car_id).toBe(testCar.car_id);
        });
    });

    describe('findPendingRequests', () => {
        test('должен вернуть ожидающие заявки', async () => {
            // Создаем заявки с разными статусами
            await GarageRequest.create({
                car_id: testCar.car_id,
                user_id: testUser.id,
                telegram_id: testUser.telegram_id.toString(),
                photo_path: path.join(__dirname, 'test_photo.jpg'),
                payment_status: 'Не выплачено'
            });

            await GarageRequest.create({
                car_id: testCar.car_id,
                user_id: testUser.id,
                telegram_id: testUser.telegram_id.toString(),
                photo_path: path.join(__dirname, 'test_photo.jpg'),
                payment_status: 'Принято'
            });

            const pendingRequests = await GarageRequest.findPendingRequests();

            expect(pendingRequests).toHaveLength(1);
            expect(pendingRequests[0].payment_status).toBe('Не выплачено');
        });
    });

    describe('countRecentByUser', () => {
        test('должен подсчитать недавние заявки пользователя', async () => {
            // Создаем заявку
            await GarageRequest.create({
                car_id: testCar.car_id,
                user_id: testUser.id,
                telegram_id: testUser.telegram_id.toString(),
                photo_path: path.join(__dirname, 'test_photo.jpg')
            });

            const count = await GarageRequest.countRecentByUser(testUser.telegram_id.toString(), 1);
            expect(count).toBe(1);

            const countOtherUser = await GarageRequest.countRecentByUser('999999999', 1);
            expect(countOtherUser).toBe(0);
        });
    });

    describe('approve', () => {
        test('должен одобрить заявку и обновить статус автомобиля', async () => {
            const request = await GarageRequest.create({
                car_id: testCar.car_id,
                user_id: testUser.id,
                telegram_id: testUser.telegram_id.toString(),
                photo_path: path.join(__dirname, 'test_photo.jpg')
            });

            // Создаем администратора
            const admin = await User.create({
                telegram_id: 987654321,
                username: 'admin',
                first_name: 'Admin',
                authorized: 1
            });

            await request.approve(admin.id);

            expect(request.payment_status).toBe('Принято');
            expect(request.admin_id).toBe(admin.id);

            // Проверяем, что статус автомобиля обновился
            const updatedCar = await Garage.findById(testCar.car_id);
            expect(updatedCar.status).toBe('Хорошее');
        });
    });

    describe('reject', () => {
        test('должен отклонить заявку с комментарием', async () => {
            const request = await GarageRequest.create({
                car_id: testCar.car_id,
                user_id: testUser.id,
                telegram_id: testUser.telegram_id.toString(),
                photo_path: path.join(__dirname, 'test_photo.jpg')
            });

            const admin = await User.create({
                telegram_id: 987654321,
                username: 'admin',
                first_name: 'Admin',
                authorized: 1
            });

            const comment = 'Фото не соответствует требованиям';
            await request.reject(admin.id, comment);

            expect(request.payment_status).toBe('Отклонено');
            expect(request.admin_id).toBe(admin.id);
            expect(request.admin_comment).toBe(comment);
        });
    });

    describe('Instance methods', () => {
        test('photoExists должен корректно проверять существование файла', () => {
            const request = new GarageRequest({
                photo_path: path.join(__dirname, 'test_photo.jpg')
            });

            expect(request.photoExists()).toBe(true);

            const requestWithoutPhoto = new GarageRequest({
                photo_path: 'nonexistent.jpg'
            });

            expect(requestWithoutPhoto.photoExists()).toBe(false);
        });

        test('getFormattedStatus должен вернуть статус с эмодзи', () => {
            const requests = [
                new GarageRequest({ payment_status: 'Не выплачено' }),
                new GarageRequest({ payment_status: 'Принято' }),
                new GarageRequest({ payment_status: 'Отклонено' }),
                new GarageRequest({ payment_status: 'Производится оплата' })
            ];

            expect(requests[0].getFormattedStatus()).toBe('⏳ Не выплачено');
            expect(requests[1].getFormattedStatus()).toBe('✅ Принято');
            expect(requests[2].getFormattedStatus()).toBe('❌ Отклонено');
            expect(requests[3].getFormattedStatus()).toBe('💰 Производится оплата');
        });

        test('getFormattedSubmissionDate должен форматировать дату', () => {
            const request = new GarageRequest({
                submitted_at: '2023-12-25 15:30:45'
            });

            const formatted = request.getFormattedSubmissionDate();
            expect(formatted).toMatch(/\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}/);
        });
    });

    describe('getCar and getUser', () => {
        test('должны вернуть связанные объекты', async () => {
            const request = await GarageRequest.create({
                car_id: testCar.car_id,
                user_id: testUser.id,
                telegram_id: testUser.telegram_id.toString(),
                photo_path: path.join(__dirname, 'test_photo.jpg')
            });

            const car = await request.getCar();
            const user = await request.getUser();

            expect(car).toBeInstanceOf(Garage);
            expect(car.car_id).toBe(testCar.car_id);

            expect(user).toBeInstanceOf(User);
            expect(user.id).toBe(testUser.id);
        });
    });
});