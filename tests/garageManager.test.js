const GarageManager = require('../src/components/GarageManager');
const Garage = require('../src/database/models/garage');
const GarageRequest = require('../src/database/models/garageRequest');
const User = require('../src/database/models/user');

// Mock бота
const mockBot = {
    sendMessage: jest.fn(),
    sendPhoto: jest.fn(),
    editMessageText: jest.fn(),
    answerCallbackQuery: jest.fn(),
    getFile: jest.fn(),
    downloadFile: jest.fn()
};

// Mock модулей
jest.mock('../src/database/models/garage');
jest.mock('../src/database/models/garageRequest');
jest.mock('../src/database/models/user');
jest.mock('fs');

describe('GarageManager', () => {
    let garageManager;
    const ADMIN_ID = 123456789;

    beforeEach(() => {
        garageManager = new GarageManager(mockBot, ADMIN_ID);
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        test('должен правильно инициализироваться', () => {
            expect(garageManager.bot).toBe(mockBot);
            expect(garageManager.adminId).toBe(ADMIN_ID);
            expect(garageManager.userSessions).toBeInstanceOf(Map);
            expect(garageManager.STATES).toHaveProperty('AWAITING_PHOTO');
        });
    });

    describe('handleTakeCarCommand', () => {
        test('должен показать меню гаража для авторизованного пользователя', async () => {
            const msg = {
                chat: { id: 12345 },
                from: { id: 67890 }
            };

            const mockUser = { id: 1, isAuthorized: () => true };
            User.findByTelegramId.mockResolvedValue(mockUser);

            const mockCarsData = {
                cars: [
                    { car_id: 1, car_name: 'Infernus', getDisplayName: () => '🟢 Infernus: Хорошее' }
                ],
                pagination: {
                    currentPage: 0,
                    totalPages: 1,
                    hasNext: false,
                    hasPrev: false
                }
            };
            Garage.getCarsPaginated.mockResolvedValue(mockCarsData);

            await garageManager.handleTakeCarCommand(msg);

            expect(User.findByTelegramId).toHaveBeenCalledWith(67890);
            expect(mockBot.sendMessage).toHaveBeenCalledWith(
                12345,
                expect.stringContaining('🚗 ГАРАЖ СЕМЬИ'),
                expect.objectContaining({
                    reply_markup: expect.objectContaining({
                        inline_keyboard: expect.any(Array)
                    })
                })
            );
        });

        test('должен отклонить неавторизованного пользователя', async () => {
            const msg = {
                chat: { id: 12345 },
                from: { id: 67890 }
            };

            const mockUser = { id: 1, isAuthorized: () => false };
            User.findByTelegramId.mockResolvedValue(mockUser);

            await garageManager.handleTakeCarCommand(msg);

            expect(mockBot.sendMessage).toHaveBeenCalledWith(
                12345,
                expect.stringContaining('❌ Доступ запрещен!')
            );
        });

        test('должен отклонить пользователя, которого нет в базе', async () => {
            const msg = {
                chat: { id: 12345 },
                from: { id: 67890 }
            };

            User.findByTelegramId.mockResolvedValue(null);

            await garageManager.handleTakeCarCommand(msg);

            expect(mockBot.sendMessage).toHaveBeenCalledWith(
                12345,
                expect.stringContaining('❌ Доступ запрещен!')
            );
        });
    });

    describe('buildGarageKeyboard', () => {
        test('должен построить клавиатуру с автомобилями', () => {
            const cars = [
                { car_id: 1, car_name: 'Infernus' },
                { car_id: 2, car_name: 'Cheetah' },
                { car_id: 3, car_name: 'Banshee' }
            ];
            const pagination = {
                currentPage: 0,
                hasNext: true,
                hasPrev: false
            };

            const keyboard = garageManager.buildGarageKeyboard(cars, pagination);

            expect(keyboard).toHaveLength(3); // 2 ряда с машинами + навигация + главное меню
            expect(keyboard[0]).toHaveLength(2); // Первый ряд: 2 машины
            expect(keyboard[1]).toHaveLength(1); // Второй ряд: 1 машина
            expect(keyboard[2]).toHaveLength(1); // Навигация: только "Далее"
            expect(keyboard[3]).toHaveLength(1); // Главное меню

            expect(keyboard[0][0].callback_data).toBe('select_car_1');
            expect(keyboard[0][1].callback_data).toBe('select_car_2');
            expect(keyboard[1][0].callback_data).toBe('select_car_3');
        });
    });

    describe('handleCarSelection', () => {
        test('должен обработать выбор автомобиля', async () => {
            const callbackQuery = {
                message: { chat: { id: 12345 } },
                from: { id: 67890 },
                data: 'select_car_1',
                id: 'callback123'
            };

            GarageRequest.countRecentByUser.mockResolvedValue(0);
            const mockCar = { car_id: 1, car_name: 'Infernus', getDisplayName: () => '🟢 Infernus: Хорошее' };
            Garage.findById.mockResolvedValue(mockCar);
            
            const mockUser = { id: 1 };
            User.findByTelegramId.mockResolvedValue(mockUser);
            GarageRequest.findByUserAndCar.mockResolvedValue(null);

            await garageManager.handleCarSelection(callbackQuery);

            expect(GarageRequest.countRecentByUser).toHaveBeenCalledWith('67890', 1);
            expect(Garage.findById).toHaveBeenCalledWith(1);
            expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback123');
            expect(mockBot.sendMessage).toHaveBeenCalledWith(
                12345,
                expect.stringContaining('📷 Отправьте фото замены масла для *Infernus*'),
                expect.objectContaining({ parse_mode: 'Markdown' })
            );
        });

        test('должен отклонить при превышении лимита заявок', async () => {
            const callbackQuery = {
                message: { chat: { id: 12345 } },
                from: { id: 67890 },
                data: 'select_car_1',
                id: 'callback123'
            };

            GarageRequest.countRecentByUser.mockResolvedValue(3);

            await garageManager.handleCarSelection(callbackQuery);

            expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith(
                'callback123',
                expect.objectContaining({
                    text: 'Вы превысили лимит заявок (3 в час)',
                    show_alert: true
                })
            );
        });

        test('должен отклонить при существующей активной заявке', async () => {
            const callbackQuery = {
                message: { chat: { id: 12345 } },
                from: { id: 67890 },
                data: 'select_car_1',
                id: 'callback123'
            };

            GarageRequest.countRecentByUser.mockResolvedValue(0);
            const mockCar = { car_id: 1, car_name: 'Infernus' };
            Garage.findById.mockResolvedValue(mockCar);
            
            const mockUser = { id: 1 };
            User.findByTelegramId.mockResolvedValue(mockUser);
            GarageRequest.findByUserAndCar.mockResolvedValue({ id: 1 }); // Существующая заявка

            await garageManager.handleCarSelection(callbackQuery);

            expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith(
                'callback123',
                expect.objectContaining({
                    text: expect.stringContaining('У вас уже есть активная заявка'),
                    show_alert: true
                })
            );
        });
    });

    describe('handlePageNavigation', () => {
        test('должен обработать навигацию по страницам', async () => {
            const callbackQuery = {
                message: { 
                    chat: { id: 12345 },
                    message_id: 98765 
                },
                data: 'garage_page_1',
                id: 'callback123'
            };

            const mockCarsData = {
                cars: [],
                pagination: { currentPage: 1, totalPages: 2, hasNext: false, hasPrev: true }
            };
            Garage.getCarsPaginated.mockResolvedValue(mockCarsData);

            await garageManager.handlePageNavigation(callbackQuery);

            expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback123');
            expect(mockBot.editMessageText).toHaveBeenCalled();
        });
    });

    describe('Session management', () => {
        test('должен правильно управлять сессиями пользователей', () => {
            const telegramId = 12345;
            const sessionData = {
                state: garageManager.STATES.AWAITING_PHOTO,
                carId: 1,
                carName: 'Infernus'
            };

            // Установка сессии
            garageManager.setUserSession(telegramId, sessionData);
            
            // Получение сессии
            const session = garageManager.getUserSession(telegramId);
            expect(session.state).toBe(garageManager.STATES.AWAITING_PHOTO);
            expect(session.carId).toBe(1);
            expect(session.startTime).toBeCloseTo(Date.now(), -1000);

            // Очистка сессии
            garageManager.clearUserSession(telegramId);
            const clearedSession = garageManager.getUserSession(telegramId);
            expect(clearedSession).toBeNull();
        });

        test('должен очищать истекшие сессии', () => {
            const telegramId = 12345;
            
            // Устанавливаем сессию с прошедшим временем
            garageManager.userSessions.set(telegramId, {
                state: garageManager.STATES.AWAITING_PHOTO,
                startTime: Date.now() - garageManager.SESSION_TIMEOUT - 1000
            });

            expect(garageManager.userSessions.has(telegramId)).toBe(true);
            
            garageManager.cleanupExpiredSessions();
            
            expect(garageManager.userSessions.has(telegramId)).toBe(false);
        });
    });

    describe('handlePhotoUpload', () => {
        test('должен обработать загрузку фото', async () => {
            const msg = {
                chat: { id: 12345 },
                from: { id: 67890 },
                photo: [{ file_id: 'file123' }]
            };

            // Устанавливаем сессию
            garageManager.setUserSession(67890, {
                state: garageManager.STATES.AWAITING_PHOTO,
                carId: 1,
                carName: 'Infernus'
            });

            const mockUser = { id: 1, telegram_id: 67890 };
            User.findByTelegramId.mockResolvedValue(mockUser);

            const mockRequest = { id: 1 };
            GarageRequest.create.mockResolvedValue(mockRequest);

            // Mock для savePhotoFile
            garageManager.savePhotoFile = jest.fn().mockResolvedValue('/path/to/photo.jpg');
            garageManager.notifyAdmins = jest.fn().mockResolvedValue();

            await garageManager.handlePhotoUpload(msg);

            expect(garageManager.savePhotoFile).toHaveBeenCalled();
            expect(GarageRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    car_id: 1,
                    user_id: 1,
                    telegram_id: '67890'
                })
            );
            expect(mockBot.sendMessage).toHaveBeenCalledWith(
                12345,
                expect.stringContaining('✅ Заявка подана!')
            );
            expect(garageManager.notifyAdmins).toHaveBeenCalledWith(mockRequest);
        });

        test('должен игнорировать фото без активной сессии', async () => {
            const msg = {
                chat: { id: 12345 },
                from: { id: 67890 },
                photo: [{ file_id: 'file123' }]
            };

            await garageManager.handlePhotoUpload(msg);

            expect(User.findByTelegramId).not.toHaveBeenCalled();
            expect(mockBot.sendMessage).not.toHaveBeenCalled();
        });
    });
});