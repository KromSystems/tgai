const Garage = require('../database/models/garage');
const User = require('../database/models/user');
const GarageRequest = require('../database/models/garageRequest');

/**
 * CarManager - компонент для административного управления автомобилями в гараже
 * Обрабатывает команду /garage_admin и предоставляет удобный интерфейс управления
 */
class CarManager {
    constructor(bot, adminIds) {
        this.bot = bot;
        this.adminIds = Array.isArray(adminIds) ? adminIds : [adminIds];
        this.adminSessions = new Map(); // Хранилище состояний администраторов
        this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 минут
        
        // Состояния администраторского интерфейса
        this.ADMIN_STATES = {
            AWAITING_CAR_NAME: 'admin_awaiting_car_name',
            AWAITING_NEW_CAR_NAME: 'admin_awaiting_new_car_name',
            CONFIRMING_DELETE: 'admin_confirming_delete'
        };

        // Сообщения интерфейса
        this.ADMIN_MESSAGES = {
            ACCESS_DENIED: '❌ Доступ запрещен! Эта команда доступна только администраторам.',
            MAIN_MENU: '🔧 АДМИН ПАНЕЛЬ ГАРАЖА',
            CAR_ADDED: '✅ Автомобиль "{name}" успешно добавлен!',
            CAR_DELETED: '🗑️ Автомобиль "{name}" успешно удален!',
            STATUS_UPDATED: '✅ Статус автомобиля "{name}" изменен на {status}',
            NAME_UPDATED: '✅ Название автомобиля изменено на "{name}"',
            ENTER_CAR_NAME: '📝 Введите название нового автомобиля:',
            SELECT_STATUS: '🎨 Выберите начальный статус автомобиля:',
            CONFIRM_DELETE: '⚠️ Вы уверены, что хотите удалить автомобиль "{name}"?',
            ENTER_NEW_NAME: '📝 Введите новое название для автомобиля "{name}":',
            CAR_NOT_FOUND: '❌ Автомобиль не найден',
            ERROR_OCCURRED: '❌ Произошла ошибка: {error}'
        };

        // Настройка автоочистки сессий
        setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
    }

    /**
     * Проверить, является ли пользователь администратором
     * @param {number} telegramId - ID пользователя в Telegram
     * @returns {boolean}
     */
    isAdmin(telegramId) {
        return this.adminIds.includes(telegramId);
    }

    /**
     * Обработать команду /garage_admin
     * @param {Object} msg - Сообщение от Telegram
     */
    async handleGarageAdminCommand(msg) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;

        try {
            // Проверяем права администратора
            if (!this.isAdmin(telegramId)) {
                await this.bot.sendMessage(chatId, this.ADMIN_MESSAGES.ACCESS_DENIED);
                return;
            }

            // Показываем главное меню администратора
            await this.showAdminMenu(chatId);
            
        } catch (error) {
            console.error('Ошибка обработки команды /garage_admin:', error);
            await this.bot.sendMessage(chatId, 
                this.ADMIN_MESSAGES.ERROR_OCCURRED.replace('{error}', 'Попробуйте позже')
            );
        }
    }

    /**
     * Показать главное административное меню
     * @param {number} chatId - ID чата
     */
    async showAdminMenu(chatId) {
        try {
            // Получаем статистику
            const stats = await Garage.getStatistics();
            const pendingRequests = await GarageRequest.countByStatus('Не выплачено');

            const messageText = 
                `${this.ADMIN_MESSAGES.MAIN_MENU}\n\n` +
                `📊 Статистика: ${stats.total} машин\n` +
                `🟢 Хорошее: ${stats['Хорошее']} автомобилей\n` +
                `🟡 Среднее: ${stats['Среднее']} автомобилей\n` +
                `🔴 Плохое: ${stats['Плохое']} автомобилей\n\n` +
                `📋 Заявок на рассмотрении: ${pendingRequests}`;

            const keyboard = this.buildAdminKeyboard(pendingRequests);

            await this.bot.sendMessage(chatId, messageText, {
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });

        } catch (error) {
            console.error('Ошибка показа административного меню:', error);
            throw error;
        }
    }

    /**
     * Построить клавиатуру главного меню администратора
     * @param {number} pendingRequests - Количество необработанных заявок
     * @returns {Array} Клавиатура
     */
    buildAdminKeyboard(pendingRequests = 0) {
        const requestText = pendingRequests > 0 
            ? `📋 Заявки (${pendingRequests})` 
            : '📋 Заявки';

        return [
            [
                { text: '📊 Статистика', callback_data: 'admin_stats' },
                { text: '🔧 Управление', callback_data: 'admin_manage' }
            ],
            [
                { text: '➕ Добавить авто', callback_data: 'admin_add_car' },
                { text: requestText, callback_data: 'admin_requests' }
            ],
            [
                { text: '🏠 Главное меню', callback_data: 'back_to_main' }
            ]
        ];
    }

    /**
     * Показать управление автомобилями с пагинацией
     * @param {number} chatId - ID чата
     * @param {number} page - Номер страницы
     * @param {number} messageId - ID сообщения для редактирования (опционально)
     */
    async showCarManagement(chatId, page = 0, messageId = null) {
        try {
            const pageSize = 5;
            const carsData = await Garage.getCarsPaginated(page, pageSize);
            const { cars, pagination } = carsData;

            if (cars.length === 0) {
                const message = '🚗 Гараж пуст! Добавьте первый автомобиль.';
                const keyboard = [[
                    { text: '➕ Добавить авто', callback_data: 'admin_add_car' },
                    { text: '⬅️ Назад', callback_data: 'admin_menu' }
                ]];

                if (messageId) {
                    await this.bot.editMessageText(message, {
                        chat_id: chatId,
                        message_id: messageId,
                        reply_markup: { inline_keyboard: keyboard }
                    });
                } else {
                    await this.bot.sendMessage(chatId, message, {
                        reply_markup: { inline_keyboard: keyboard }
                    });
                }
                return;
            }

            // Формируем текст сообщения
            let messageText = `🔧 УПРАВЛЕНИЕ АВТОМОБИЛЯМИ (Страница ${pagination.currentPage + 1}/${pagination.totalPages})\n\n`;
            
            cars.forEach((car, index) => {
                const number = pagination.currentPage * pageSize + index + 1;
                messageText += `${number}. ${car.getDisplayName()}\n`;
            });

            // Формируем клавиатуру
            const keyboard = this.buildCarManagementKeyboard(cars, pagination);

            if (messageId) {
                await this.bot.editMessageText(messageText, {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: { inline_keyboard: keyboard }
                });
            } else {
                await this.bot.sendMessage(chatId, messageText, {
                    reply_markup: { inline_keyboard: keyboard }
                });
            }

        } catch (error) {
            console.error('Ошибка показа управления автомобилями:', error);
            throw error;
        }
    }

    /**
     * Построить клавиатуру для управления автомобилями
     * @param {Array} cars - Список автомобилей
     * @param {Object} pagination - Информация о пагинации
     * @returns {Array} Клавиатура
     */
    buildCarManagementKeyboard(cars, pagination) {
        const keyboard = [];

        // Кнопки редактирования автомобилей (по 2 в ряду)
        for (let i = 0; i < cars.length; i += 2) {
            const row = [];
            
            const car1 = cars[i];
            row.push({
                text: '✏️ Изменить',
                callback_data: `admin_edit_${car1.car_id}`
            });

            if (i + 1 < cars.length) {
                const car2 = cars[i + 1];
                row.push({
                    text: '✏️ Изменить',
                    callback_data: `admin_edit_${car2.car_id}`
                });
            }

            keyboard.push(row);
        }

        // Кнопки навигации
        const navRow = [];
        if (pagination.hasPrev) {
            navRow.push({
                text: '⬅️ Назад',
                callback_data: `admin_manage_page_${pagination.currentPage - 1}`
            });
        }
        if (pagination.hasNext) {
            navRow.push({
                text: '➡️ Далее',
                callback_data: `admin_manage_page_${pagination.currentPage + 1}`
            });
        }

        if (navRow.length > 0) {
            keyboard.push(navRow);
        }

        // Нижний ряд кнопок
        keyboard.push([
            { text: '➕ Добавить авто', callback_data: 'admin_add_car' },
            { text: '🏠 Главное меню', callback_data: 'admin_menu' }
        ]);

        return keyboard;
    }

    /**
     * Показать меню редактирования автомобиля
     * @param {Object} callbackQuery - Callback query от Telegram
     */
    async handleCarEdit(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const carId = parseInt(callbackQuery.data.split('_')[2]);

        try {
            const car = await Garage.findById(carId);
            if (!car) {
                await this.bot.answerCallbackQuery(callbackQuery.id, {
                    text: this.ADMIN_MESSAGES.CAR_NOT_FOUND,
                    show_alert: true
                });
                return;
            }

            const messageText = 
                `🚗 РЕДАКТИРОВАНИЕ АВТОМОБИЛЯ\n\n` +
                `📛 Название: ${car.car_name}\n` +
                `📊 Статус: ${car.getDisplayName()}\n` +
                `🔧 Последнее ТО: ${car.last_maintenance ? new Date(car.last_maintenance).toLocaleDateString() : 'Не указано'}`;

            const keyboard = [
                [
                    { text: '🎨 Изменить статус', callback_data: `admin_status_${carId}` },
                    { text: '✏️ Изменить название', callback_data: `admin_name_${carId}` }
                ],
                [
                    { text: '🗑️ Удалить авто', callback_data: `admin_delete_${carId}` }
                ],
                [
                    { text: '⬅️ Назад к списку', callback_data: 'admin_manage' }
                ]
            ];

            await this.bot.answerCallbackQuery(callbackQuery.id);
            await this.bot.editMessageText(messageText, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id,
                reply_markup: { inline_keyboard: keyboard }
            });

        } catch (error) {
            console.error('Ошибка редактирования автомобиля:', error);
            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: this.ADMIN_MESSAGES.ERROR_OCCURRED.replace('{error}', 'Попробуйте позже'),
                show_alert: true
            });
        }
    }

    /**
     * Показать выбор статуса автомобиля
     * @param {Object} callbackQuery - Callback query от Telegram
     */
    async handleStatusChange(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const carId = parseInt(callbackQuery.data.split('_')[2]);

        try {
            const car = await Garage.findById(carId);
            if (!car) {
                await this.bot.answerCallbackQuery(callbackQuery.id, {
                    text: this.ADMIN_MESSAGES.CAR_NOT_FOUND,
                    show_alert: true
                });
                return;
            }

            const messageText = 
                `🎨 ИЗМЕНЕНИЕ СТАТУСА\n\n` +
                `🚗 Автомобиль: ${car.car_name}\n` +
                `📊 Текущий статус: ${car.getDisplayName()}\n\n` +
                `Выберите новый статус:`;

            const keyboard = this.buildStatusKeyboard(carId);

            await this.bot.answerCallbackQuery(callbackQuery.id);
            await this.bot.editMessageText(messageText, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id,
                reply_markup: { inline_keyboard: keyboard }
            });

        } catch (error) {
            console.error('Ошибка изменения статуса:', error);
            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: this.ADMIN_MESSAGES.ERROR_OCCURRED.replace('{error}', 'Попробуйте позже'),
                show_alert: true
            });
        }
    }

    /**
     * Построить клавиатуру выбора статуса
     * @param {number} carId - ID автомобиля
     * @returns {Array} Клавиатура
     */
    buildStatusKeyboard(carId) {
        return [
            [
                { text: '🟢 Хорошее', callback_data: `admin_set_status_${carId}_Хорошее` }
            ],
            [
                { text: '🟡 Среднее', callback_data: `admin_set_status_${carId}_Среднее` }
            ],
            [
                { text: '🔴 Плохое', callback_data: `admin_set_status_${carId}_Плохое` }
            ],
            [
                { text: '❌ Отмена', callback_data: `admin_edit_${carId}` }
            ]
        ];
    }

    /**
     * Применить новый статус автомобиля
     * @param {Object} callbackQuery - Callback query от Telegram
     */
    async handleSetStatus(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const parts = callbackQuery.data.split('_');
        const carId = parseInt(parts[3]);
        const newStatus = parts[4];

        try {
            const car = await Garage.findById(carId);
            if (!car) {
                await this.bot.answerCallbackQuery(callbackQuery.id, {
                    text: this.ADMIN_MESSAGES.CAR_NOT_FOUND,
                    show_alert: true
                });
                return;
            }

            await Garage.updateStatus(carId, newStatus);

            const successMessage = this.ADMIN_MESSAGES.STATUS_UPDATED
                .replace('{name}', car.car_name)
                .replace('{status}', newStatus);

            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: successMessage,
                show_alert: false
            });

            // Возвращаемся к меню редактирования автомобиля
            const updatedCar = await Garage.findById(carId);
            const messageText = 
                `🚗 РЕДАКТИРОВАНИЕ АВТОМОБИЛЯ\n\n` +
                `📛 Название: ${updatedCar.car_name}\n` +
                `📊 Статус: ${updatedCar.getDisplayName()}\n` +
                `🔧 Последнее ТО: ${updatedCar.last_maintenance ? new Date(updatedCar.last_maintenance).toLocaleDateString() : 'Не указано'}`;

            const keyboard = [
                [
                    { text: '🎨 Изменить статус', callback_data: `admin_status_${carId}` },
                    { text: '✏️ Изменить название', callback_data: `admin_name_${carId}` }
                ],
                [
                    { text: '🗑️ Удалить авто', callback_data: `admin_delete_${carId}` }
                ],
                [
                    { text: '⬅️ Назад к списку', callback_data: 'admin_manage' }
                ]
            ];

            await this.bot.editMessageText(messageText, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id,
                reply_markup: { inline_keyboard: keyboard }
            });

        } catch (error) {
            console.error('Ошибка установки статуса:', error);
            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: this.ADMIN_MESSAGES.ERROR_OCCURRED.replace('{error}', error.message),
                show_alert: true
            });
        }
    }

    /**
     * Начать процесс добавления нового автомобиля
     * @param {Object} callbackQuery - Callback query от Telegram
     */
    async handleAddCar(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const telegramId = callbackQuery.from.id;

        try {
            // Устанавливаем состояние ожидания названия
            this.setAdminSession(telegramId, {
                state: this.ADMIN_STATES.AWAITING_CAR_NAME,
                messageId: callbackQuery.message.message_id
            });

            await this.bot.answerCallbackQuery(callbackQuery.id);
            await this.bot.editMessageText(this.ADMIN_MESSAGES.ENTER_CAR_NAME, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '❌ Отмена', callback_data: 'admin_menu' }
                    ]]
                }
            });

        } catch (error) {
            console.error('Ошибка начала добавления автомобиля:', error);
            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: this.ADMIN_MESSAGES.ERROR_OCCURRED.replace('{error}', 'Попробуйте позже'),
                show_alert: true
            });
        }
    }

    /**
     * Обработать ввод названия нового автомобиля
     * @param {Object} msg - Сообщение от Telegram
     */
    async processNewCarName(msg) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        const carName = msg.text.trim();

        try {
            const session = this.getAdminSession(telegramId);
            if (!session || session.state !== this.ADMIN_STATES.AWAITING_CAR_NAME) {
                return; // Игнорируем, если не ожидается ввод
            }

            // Валидация названия
            if (!carName || carName.length === 0) {
                await this.bot.sendMessage(chatId, '❌ Название автомобиля не может быть пустым. Попробуйте снова:');
                return;
            }

            if (carName.length > 50) {
                await this.bot.sendMessage(chatId, '❌ Название слишком длинное (максимум 50 символов). Попробуйте снова:');
                return;
            }

            // Обновляем сессию
            this.setAdminSession(telegramId, {
                ...session,
                carName: carName,
                state: 'awaiting_status_selection'
            });

            // Показываем выбор статуса
            const messageText = 
                `${this.ADMIN_MESSAGES.SELECT_STATUS}\n\n` +
                `🚗 Название: ${carName}`;

            const keyboard = [
                [
                    { text: '🟢 Хорошее', callback_data: `admin_create_car_Хорошее` }
                ],
                [
                    { text: '🟡 Среднее', callback_data: `admin_create_car_Среднее` }
                ],
                [
                    { text: '🔴 Плохое', callback_data: `admin_create_car_Плохое` }
                ],
                [
                    { text: '❌ Отмена', callback_data: 'admin_menu' }
                ]
            ];

            // Удаляем исходное сообщение
            try {
                await this.bot.deleteMessage(chatId, session.messageId);
            } catch (deleteError) {
                // Игнорируем ошибку удаления
            }

            // Удаляем сообщение пользователя
            try {
                await this.bot.deleteMessage(chatId, msg.message_id);
            } catch (deleteError) {
                // Игнорируем ошибку удаления
            }

            await this.bot.sendMessage(chatId, messageText, {
                reply_markup: { inline_keyboard: keyboard }
            });

        } catch (error) {
            console.error('Ошибка обработки названия автомобиля:', error);
            await this.bot.sendMessage(chatId, 
                this.ADMIN_MESSAGES.ERROR_OCCURRED.replace('{error}', 'Попробуйте позже')
            );
            this.clearAdminSession(telegramId);
        }
    }

    /**
     * Создать новый автомобиль с выбранным статусом
     * @param {Object} callbackQuery - Callback query от Telegram
     */
    async handleCreateCar(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const telegramId = callbackQuery.from.id;
        const status = callbackQuery.data.split('_')[3];

        try {
            const session = this.getAdminSession(telegramId);
            if (!session || !session.carName) {
                await this.bot.answerCallbackQuery(callbackQuery.id, {
                    text: 'Ошибка сессии. Начните заново.',
                    show_alert: true
                });
                return;
            }

            // Создаем автомобиль
            const newCar = await Garage.addCar(session.carName, status);

            // Очищаем сессию
            this.clearAdminSession(telegramId);

            const successMessage = this.ADMIN_MESSAGES.CAR_ADDED.replace('{name}', session.carName);

            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: successMessage,
                show_alert: false
            });

            // Показываем обновленное главное меню
            await this.showAdminMenu(chatId);

        } catch (error) {
            console.error('Ошибка создания автомобиля:', error);
            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: this.ADMIN_MESSAGES.ERROR_OCCURRED.replace('{error}', error.message),
                show_alert: true
            });
            this.clearAdminSession(telegramId);
        }
    }

    /**
     * Обработать все callback queries администратора
     * @param {Object} callbackQuery - Callback query от Telegram
     */
    async handleAdminCallback(callbackQuery) {
        const data = callbackQuery.data;
        const telegramId = callbackQuery.from.id;

        // Проверяем права администратора
        if (!this.isAdmin(telegramId)) {
            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: this.ADMIN_MESSAGES.ACCESS_DENIED,
                show_alert: true
            });
            return;
        }

        try {
            // Роутинг callback queries
            if (data === 'admin_menu') {
                await this.bot.answerCallbackQuery(callbackQuery.id);
                await this.showAdminMenu(callbackQuery.message.chat.id);
            } else if (data === 'admin_manage') {
                await this.bot.answerCallbackQuery(callbackQuery.id);
                await this.showCarManagement(callbackQuery.message.chat.id, 0, callbackQuery.message.message_id);
            } else if (data.startsWith('admin_manage_page_')) {
                const page = parseInt(data.split('_')[3]);
                await this.bot.answerCallbackQuery(callbackQuery.id);
                await this.showCarManagement(callbackQuery.message.chat.id, page, callbackQuery.message.message_id);
            } else if (data.startsWith('admin_edit_')) {
                await this.handleCarEdit(callbackQuery);
            } else if (data.startsWith('admin_status_')) {
                await this.handleStatusChange(callbackQuery);
            } else if (data.startsWith('admin_set_status_')) {
                await this.handleSetStatus(callbackQuery);
            } else if (data === 'admin_add_car') {
                await this.handleAddCar(callbackQuery);
            } else if (data.startsWith('admin_create_car_')) {
                await this.handleCreateCar(callbackQuery);
            } else {
                // Неизвестный callback
                await this.bot.answerCallbackQuery(callbackQuery.id);
            }

        } catch (error) {
            console.error('Ошибка обработки admin callback:', error);
            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: this.ADMIN_MESSAGES.ERROR_OCCURRED.replace('{error}', 'Попробуйте позже'),
                show_alert: true
            });
        }
    }

    /**
     * Установить сессию администратора
     * @param {number} telegramId - ID администратора
     * @param {Object} sessionData - Данные сессии
     */
    setAdminSession(telegramId, sessionData) {
        this.adminSessions.set(telegramId, {
            ...sessionData,
            startTime: Date.now()
        });
    }

    /**
     * Получить сессию администратора
     * @param {number} telegramId - ID администратора
     * @returns {Object|null}
     */
    getAdminSession(telegramId) {
        return this.adminSessions.get(telegramId) || null;
    }

    /**
     * Очистить сессию администратора
     * @param {number} telegramId - ID администратора
     */
    clearAdminSession(telegramId) {
        this.adminSessions.delete(telegramId);
    }

    /**
     * Очистить истекшие сессии
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        for (const [telegramId, session] of this.adminSessions.entries()) {
            if (now - session.startTime > this.SESSION_TIMEOUT) {
                this.adminSessions.delete(telegramId);
                console.log(`Очищена истекшая админ-сессия для пользователя ${telegramId}`);
            }
        }
    }
}

module.exports = CarManager;