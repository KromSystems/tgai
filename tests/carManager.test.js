const CarManager = require('../src/components/CarManager');
const Garage = require('../src/database/models/garage');
const GarageRequest = require('../src/database/models/garageRequest');
const User = require('../src/database/models/user');

// Mock бота
const mockBot = {
    sendMessage: jest.fn(),
    sendPhoto: jest.fn(),
    editMessageText: jest.fn(),
    answerCallbackQuery: jest.fn(),
    deleteMessage: jest.fn()
};

// Mock модулей
jest.mock('../src/database/models/garage');
jest.mock('../src/database/models/garageRequest');
jest.mock('../src/database/models/user');

describe('CarManager', () => {
    let carManager;
    const ADMIN_ID = 123456789;
    const NON_ADMIN_ID = 987654321;

    beforeEach(() => {
        carManager = new CarManager(mockBot, ADMIN_ID);
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        test('должен правильно инициализироваться', () => {
            expect(carManager.bot).toBe(mockBot);
            expect(carManager.adminIds).toEqual([ADMIN_ID]);
            expect(carManager.adminSessions).toBeInstanceOf(Map);
            expect(carManager.ADMIN_STATES).toHaveProperty('AWAITING_CAR_NAME');
            expect(carManager.ADMIN_MESSAGES).toHaveProperty('ACCESS_DENIED');
        });

        test('должен поддерживать множественных админов', () => {
            const multiAdminCarManager = new CarManager(mockBot, [ADMIN_ID, NON_ADMIN_ID]);
            expect(multiAdminCarManager.adminIds).toEqual([ADMIN_ID, NON_ADMIN_ID]);
        });
    });

    describe('isAdmin', () => {
        test('должен определять администратора', () => {
            expect(carManager.isAdmin(ADMIN_ID)).toBe(true);
            expect(carManager.isAdmin(NON_ADMIN_ID)).toBe(false);
        });
    });

    describe('handleGarageAdminCommand', () => {
        test('должен показать админ-панель для администратора', async () => {
            const msg = {
                chat: { id: 12345 },
                from: { id: ADMIN_ID }
            };

            const mockStats = {
                total: 20,
                'Хорошее': 8,
                'Среднее': 7,
                'Плохое': 5
            };
            Garage.getStatistics.mockResolvedValue(mockStats);
            GarageRequest.countByStatus.mockResolvedValue(3);

            await carManager.handleGarageAdminCommand(msg);

            expect(Garage.getStatistics).toHaveBeenCalled();
            expect(GarageRequest.countByStatus).toHaveBeenCalledWith('Не выплачено');
            expect(mockBot.sendMessage).toHaveBeenCalledWith(
                12345,
                expect.stringContaining('🔧 АДМИН ПАНЕЛЬ ГАРАЖА'),
                expect.objectContaining({
                    reply_markup: expect.objectContaining({
                        inline_keyboard: expect.any(Array)
                    })
                })
            );
        });

        test('должен отклонить неадминистратора', async () => {
            const msg = {
                chat: { id: 12345 },
                from: { id: NON_ADMIN_ID }
            };

            await carManager.handleGarageAdminCommand(msg);

            expect(mockBot.sendMessage).toHaveBeenCalledWith(
                12345,
                carManager.ADMIN_MESSAGES.ACCESS_DENIED
            );
        });
    });

    describe('buildAdminKeyboard', () => {
        test('должен построить клавиатуру администратора', () => {
            const keyboard = carManager.buildAdminKeyboard(5);

            expect(keyboard).toHaveLength(3);
            expect(keyboard[0]).toHaveLength(2); // Статистика и Управление
            expect(keyboard[1]).toHaveLength(2); // Добавить авто и Заявки
            expect(keyboard[2]).toHaveLength(1); // Главное меню

            expect(keyboard[0][0].text).toBe('📊 Статистика');
            expect(keyboard[0][1].text).toBe('🔧 Управление');
            expect(keyboard[1][0].text).toBe('➕ Добавить авто');
            expect(keyboard[1][1].text).toBe('📋 Заявки (5)');
        });

        test('должен показать заявки без числа, если их нет', () => {
            const keyboard = carManager.buildAdminKeyboard(0);
            
            expect(keyboard[1][1].text).toBe('📋 Заявки');
        });
    });

    describe('showCarManagement', () => {
        test('должен показать список автомобилей', async () => {
            const chatId = 12345;
            const mockCarsData = {
                cars: [
                    { car_id: 1, car_name: 'Infernus', getDisplayName: () => '🟢 Infernus: Хорошее' },
                    { car_id: 2, car_name: 'Cheetah', getDisplayName: () => '🟡 Cheetah: Среднее' }
                ],
                pagination: {
                    currentPage: 0,
                    totalPages: 1,
                    hasNext: false,
                    hasPrev: false
                }
            };
            Garage.getCarsPaginated.mockResolvedValue(mockCarsData);

            await carManager.showCarManagement(chatId);

            expect(Garage.getCarsPaginated).toHaveBeenCalledWith(0, 5);
            expect(mockBot.sendMessage).toHaveBeenCalledWith(
                chatId,
                expect.stringContaining('🔧 УПРАВЛЕНИЕ АВТОМОБИЛЯМИ'),
                expect.objectContaining({
                    reply_markup: expect.objectContaining({
                        inline_keyboard: expect.any(Array)
                    })
                })
            );
        });

        test('должен показать сообщение о пустом гараже', async () => {
            const chatId = 12345;
            const mockCarsData = {
                cars: [],
                pagination: { currentPage: 0, totalPages: 0 }
            };
            Garage.getCarsPaginated.mockResolvedValue(mockCarsData);

            await carManager.showCarManagement(chatId);

            expect(mockBot.sendMessage).toHaveBeenCalledWith(
                chatId,
                '🚗 Гараж пуст! Добавьте первый автомобиль.',
                expect.objectContaining({
                    reply_markup: expect.objectContaining({
                        inline_keyboard: expect.arrayContaining([
                            expect.arrayContaining([
                                expect.objectContaining({ text: '➕ Добавить авто' })
                            ])
                        ])
                    })
                })
            );
        });
    });

    describe('buildCarManagementKeyboard', () => {
        test('должен построить клавиатуру управления автомобилями', () => {
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

            const keyboard = carManager.buildCarManagementKeyboard(cars, pagination);

            expect(keyboard).toHaveLength(4); // 2 ряда кнопок редактирования + навигация + нижний ряд
            expect(keyboard[0]).toHaveLength(2); // Первый ряд: 2 кнопки редактирования
            expect(keyboard[1]).toHaveLength(1); // Второй ряд: 1 кнопка редактирования
            expect(keyboard[2]).toHaveLength(1); // Навигация: только "Далее"
            expect(keyboard[3]).toHaveLength(2); // Добавить авто + Главное меню

            expect(keyboard[0][0].callback_data).toBe('admin_edit_1');
            expect(keyboard[0][1].callback_data).toBe('admin_edit_2');
            expect(keyboard[1][0].callback_data).toBe('admin_edit_3');
        });
    });

    describe('handleCarEdit', () => {
        test('должен показать меню редактирования автомобиля', async () => {
            const callbackQuery = {
                message: { chat: { id: 12345 }, message_id: 456 },
                data: 'admin_edit_1',
                id: 'callback123'
            };

            const mockCar = {
                car_id: 1,
                car_name: 'Infernus',
                getDisplayName: () => '🟢 Infernus: Хорошее',
                last_maintenance: new Date().toISOString()
            };
            Garage.findById.mockResolvedValue(mockCar);

            await carManager.handleCarEdit(callbackQuery);

            expect(Garage.findById).toHaveBeenCalledWith(1);
            expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback123');
            expect(mockBot.editMessageText).toHaveBeenCalledWith(
                expect.stringContaining('🚗 РЕДАКТИРОВАНИЕ АВТОМОБИЛЯ'),
                expect.objectContaining({
                    chat_id: 12345,
                    message_id: 456,
                    reply_markup: expect.objectContaining({
                        inline_keyboard: expect.arrayContaining([
                            expect.arrayContaining([
                                expect.objectContaining({ text: '🎨 Изменить статус' }),
                                expect.objectContaining({ text: '✏️ Изменить название' })
                            ])
                        ])
                    })
                })
            );
        });

        test('должен обработать несуществующий автомобиль', async () => {
            const callbackQuery = {
                message: { chat: { id: 12345 } },
                data: 'admin_edit_999',
                id: 'callback123'
            };

            Garage.findById.mockResolvedValue(null);

            await carManager.handleCarEdit(callbackQuery);

            expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith(
                'callback123',
                expect.objectContaining({
                    text: carManager.ADMIN_MESSAGES.CAR_NOT_FOUND,
                    show_alert: true
                })
            );
        });
    });

    describe('buildStatusKeyboard', () => {
        test('должен построить клавиатуру выбора статуса', () => {
            const keyboard = carManager.buildStatusKeyboard(1);

            expect(keyboard).toHaveLength(4);
            expect(keyboard[0][0].text).toBe('🟢 Хорошее');
            expect(keyboard[1][0].text).toBe('🟡 Среднее');
            expect(keyboard[2][0].text).toBe('🔴 Плохое');
            expect(keyboard[3][0].text).toBe('❌ Отмена');

            expect(keyboard[0][0].callback_data).toBe('admin_set_status_1_Хорошее');
            expect(keyboard[1][0].callback_data).toBe('admin_set_status_1_Среднее');
            expect(keyboard[2][0].callback_data).toBe('admin_set_status_1_Плохое');
        });
    });

    describe('handleSetStatus', () => {
        test('должен обновить статус автомобиля', async () => {
            const callbackQuery = {
                message: { chat: { id: 12345 }, message_id: 456 },
                data: 'admin_set_status_1_Среднее',
                id: 'callback123'
            };

            const mockCar = {
                car_id: 1,
                car_name: 'Infernus',
                getDisplayName: () => '🟡 Infernus: Среднее',
                last_maintenance: new Date().toISOString()
            };
            Garage.findById.mockResolvedValue(mockCar);
            Garage.updateStatus.mockResolvedValue();

            await carManager.handleSetStatus(callbackQuery);

            expect(Garage.findById).toHaveBeenCalledWith(1);
            expect(Garage.updateStatus).toHaveBeenCalledWith(1, 'Среднее');
            expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith(
                'callback123',
                expect.objectContaining({
                    text: expect.stringContaining('Статус автомобиля "Infernus" изменен на Среднее'),
                    show_alert: false
                })
            );
        });
    });

    describe('handleAddCar', () => {
        test('должен начать процесс добавления автомобиля', async () => {
            const callbackQuery = {
                message: { chat: { id: 12345 }, message_id: 456 },
                from: { id: ADMIN_ID },
                id: 'callback123'
            };

            await carManager.handleAddCar(callbackQuery);

            expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback123');
            expect(mockBot.editMessageText).toHaveBeenCalledWith(
                carManager.ADMIN_MESSAGES.ENTER_CAR_NAME,
                expect.objectContaining({
                    chat_id: 12345,
                    message_id: 456,
                    reply_markup: expect.objectContaining({
                        inline_keyboard: expect.arrayContaining([
                            expect.arrayContaining([
                                expect.objectContaining({ text: '❌ Отмена' })
                            ])
                        ])
                    })
                })
            );

            // Проверяем, что сессия установлена
            const session = carManager.getAdminSession(ADMIN_ID);
            expect(session).toBeTruthy();
            expect(session.state).toBe(carManager.ADMIN_STATES.AWAITING_CAR_NAME);
        });
    });

    describe('processNewCarName', () => {
        beforeEach(() => {
            // Устанавливаем сессию для тестов
            carManager.setAdminSession(ADMIN_ID, {
                state: carManager.ADMIN_STATES.AWAITING_CAR_NAME,
                messageId: 456
            });
        });

        test('должен обработать валидное название автомобиля', async () => {
            const msg = {
                chat: { id: 12345 },
                from: { id: ADMIN_ID },
                text: 'Lamborghini',
                message_id: 789
            };

            await carManager.processNewCarName(msg);

            const session = carManager.getAdminSession(ADMIN_ID);
            expect(session.carName).toBe('Lamborghini');
            expect(session.state).toBe('awaiting_status_selection');

            expect(mockBot.deleteMessage).toHaveBeenCalledTimes(2); // Удаление исходного и пользовательского сообщений
            expect(mockBot.sendMessage).toHaveBeenCalledWith(
                12345,
                expect.stringContaining('🎨 Выберите начальный статус автомобиля:'),
                expect.objectContaining({
                    reply_markup: expect.objectContaining({
                        inline_keyboard: expect.any(Array)
                    })
                })
            );
        });

        test('должен отклонить пустое название', async () => {
            const msg = {
                chat: { id: 12345 },
                from: { id: ADMIN_ID },
                text: '   ',
                message_id: 789
            };

            await carManager.processNewCarName(msg);

            expect(mockBot.sendMessage).toHaveBeenCalledWith(
                12345,
                '❌ Название автомобиля не может быть пустым. Попробуйте снова:'
            );
        });

        test('должен отклонить слишком длинное название', async () => {
            const msg = {
                chat: { id: 12345 },
                from: { id: ADMIN_ID },
                text: 'A'.repeat(51), // 51 символ
                message_id: 789
            };

            await carManager.processNewCarName(msg);

            expect(mockBot.sendMessage).toHaveBeenCalledWith(
                12345,
                '❌ Название слишком длинное (максимум 50 символов). Попробуйте снова:'
            );
        });

        test('должен игнорировать ввод без активной сессии', async () => {
            carManager.clearAdminSession(ADMIN_ID);

            const msg = {
                chat: { id: 12345 },
                from: { id: ADMIN_ID },
                text: 'Lamborghini',
                message_id: 789
            };

            await carManager.processNewCarName(msg);

            expect(mockBot.sendMessage).not.toHaveBeenCalled();
        });
    });

    describe('handleCreateCar', () => {
        beforeEach(() => {
            carManager.setAdminSession(ADMIN_ID, {
                carName: 'Lamborghini',
                state: 'awaiting_status_selection'
            });
        });

        test('должен создать новый автомобиль', async () => {
            const callbackQuery = {
                message: { chat: { id: 12345 } },
                from: { id: ADMIN_ID },
                data: 'admin_create_car_Хорошее',
                id: 'callback123'
            };

            const mockNewCar = {
                car_id: 21,
                car_name: 'Lamborghini',
                status: 'Хорошее'
            };
            Garage.addCar.mockResolvedValue(mockNewCar);

            // Mock для showAdminMenu
            const mockStats = { total: 21, 'Хорошее': 9, 'Среднее': 7, 'Плохое': 5 };
            Garage.getStatistics.mockResolvedValue(mockStats);
            GarageRequest.countByStatus.mockResolvedValue(0);

            await carManager.handleCreateCar(callbackQuery);

            expect(Garage.addCar).toHaveBeenCalledWith('Lamborghini', 'Хорошее');
            expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith(
                'callback123',
                expect.objectContaining({
                    text: expect.stringContaining('Автомобиль "Lamborghini" успешно добавлен!'),
                    show_alert: false
                })
            );

            // Проверяем, что сессия очищена
            const session = carManager.getAdminSession(ADMIN_ID);
            expect(session).toBeNull();
        });

        test('должен обработать ошибку создания автомобиля', async () => {
            const callbackQuery = {
                message: { chat: { id: 12345 } },
                from: { id: ADMIN_ID },
                data: 'admin_create_car_Хорошее',
                id: 'callback123'
            };

            Garage.addCar.mockRejectedValue(new Error('Ошибка базы данных'));

            await carManager.handleCreateCar(callbackQuery);

            expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith(
                'callback123',
                expect.objectContaining({
                    text: expect.stringContaining('❌ Произошла ошибка: Ошибка базы данных'),
                    show_alert: true
                })
            );

            // Проверяем, что сессия очищена даже при ошибке
            const session = carManager.getAdminSession(ADMIN_ID);
            expect(session).toBeNull();
        });
    });

    describe('handleAdminCallback', () => {
        test('должен отклонить неадминистратора', async () => {
            const callbackQuery = {
                from: { id: NON_ADMIN_ID },
                data: 'admin_menu',
                id: 'callback123'
            };

            await carManager.handleAdminCallback(callbackQuery);

            expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith(
                'callback123',
                expect.objectContaining({
                    text: carManager.ADMIN_MESSAGES.ACCESS_DENIED,
                    show_alert: true
                })
            );
        });

        test('должен обработать admin_menu callback', async () => {
            const callbackQuery = {
                message: { chat: { id: 12345 } },
                from: { id: ADMIN_ID },
                data: 'admin_menu',
                id: 'callback123'
            };

            const mockStats = { total: 20, 'Хорошее': 8, 'Среднее': 7, 'Плохое': 5 };
            Garage.getStatistics.mockResolvedValue(mockStats);
            GarageRequest.countByStatus.mockResolvedValue(3);

            await carManager.handleAdminCallback(callbackQuery);

            expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback123');
            expect(mockBot.sendMessage).toHaveBeenCalledWith(
                12345,
                expect.stringContaining('🔧 АДМИН ПАНЕЛЬ ГАРАЖА'),
                expect.objectContaining({
                    reply_markup: expect.objectContaining({
                        inline_keyboard: expect.any(Array)
                    })
                })
            );
        });
    });

    describe('session management', () => {
        test('setAdminSession должен установить сессию', () => {
            const sessionData = { state: 'test_state', data: 'test_data' };
            carManager.setAdminSession(ADMIN_ID, sessionData);

            const session = carManager.getAdminSession(ADMIN_ID);
            expect(session).toBeTruthy();
            expect(session.state).toBe('test_state');
            expect(session.data).toBe('test_data');
            expect(session.startTime).toBeTruthy();
        });

        test('getAdminSession должен вернуть null для несуществующей сессии', () => {
            const session = carManager.getAdminSession(999);
            expect(session).toBeNull();
        });

        test('clearAdminSession должен удалить сессию', () => {
            carManager.setAdminSession(ADMIN_ID, { state: 'test' });
            expect(carManager.getAdminSession(ADMIN_ID)).toBeTruthy();

            carManager.clearAdminSession(ADMIN_ID);
            expect(carManager.getAdminSession(ADMIN_ID)).toBeNull();
        });

        test('cleanupExpiredSessions должен удалить истекшие сессии', () => {
            // Устанавливаем сессию с истекшим временем
            carManager.setAdminSession(ADMIN_ID, { state: 'test' });
            const session = carManager.adminSessions.get(ADMIN_ID);
            session.startTime = Date.now() - (35 * 60 * 1000); // 35 минут назад

            carManager.cleanupExpiredSessions();

            expect(carManager.getAdminSession(ADMIN_ID)).toBeNull();
        });
    });
});