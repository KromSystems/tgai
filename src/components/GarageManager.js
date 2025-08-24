const Garage = require('../database/models/garage');
const GarageRequest = require('../database/models/garageRequest');
const User = require('../database/models/user');
const path = require('path');
const fs = require('fs');

/**
 * GarageManager - основной контроллер системы управления гаражом
 * Обрабатывает команду /takecar и взаимодействие с пользователями
 */
class GarageManager {
    constructor(bot, adminId) {
        this.bot = bot;
        this.adminId = adminId;
        this.userSessions = new Map(); // Хранилище состояний пользователей
        this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 минут
        
        // Состояния разговора
        this.STATES = {
            AWAITING_PHOTO: 'garage_awaiting_photo',
            AWAITING_REJECTION_REASON: 'garage_awaiting_rejection_reason'
        };

        // Настройка автоочистки сессий
        setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
    }

    /**
     * Обработать команду /takecar
     * @param {Object} msg - Сообщение от Telegram
     */
    async handleTakeCarCommand(msg) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;

        try {
            // Проверяем авторизацию пользователя
            const user = await User.findByTelegramId(telegramId);
            if (!user || !user.isAuthorized()) {
                await this.bot.sendMessage(chatId, 
                    '❌ Доступ запрещен!\n\n' +
                    'Эта команда доступна только авторизованным пользователям. ' +
                    'Используйте команду /help для получения инструкций по авторизации.'
                );
                return;
            }

            // Получаем первую страницу автомобилей
            await this.showGarageMenu(chatId, 0);
            
        } catch (error) {
            console.error('Ошибка обработки команды /takecar:', error);
            await this.bot.sendMessage(chatId, 
                '❌ Произошла ошибка при загрузке гаража. Попробуйте позже.'
            );
        }
    }

    /**
     * Показать меню гаража с пагинацией
     * @param {number} chatId - ID чата
     * @param {number} page - Номер страницы
     */
    async showGarageMenu(chatId, page = 0) {
        try {
            const pageSize = 5;
            const carsData = await Garage.getCarsPaginated(page, pageSize);
            const { cars, pagination } = carsData;

            if (cars.length === 0) {
                await this.bot.sendMessage(chatId, '🚗 Гараж пуст!');
                return;
            }

            // Формируем текст сообщения
            let messageText = `🚗 ГАРАЖ СЕМЬИ | АВТОМОБИЛИ (${pagination.currentPage + 1}/${pagination.totalPages})\n\n`;
            
            cars.forEach(car => {
                messageText += `${car.getDisplayName()}\n`;
            });

            // Формируем клавиатуру
            const keyboard = this.buildGarageKeyboard(cars, pagination);

            const options = {
                reply_markup: {
                    inline_keyboard: keyboard
                }
            };

            await this.bot.sendMessage(chatId, messageText, options);

        } catch (error) {
            console.error('Ошибка показа меню гаража:', error);
            await this.bot.sendMessage(chatId, '❌ Ошибка загрузки автомобилей');
        }
    }

    /**
     * Построить клавиатуру для гаража
     * @param {Array} cars - Список автомобилей
     * @param {Object} pagination - Информация о пагинации
     * @returns {Array} Клавиатура
     */
    buildGarageKeyboard(cars, pagination) {
        const keyboard = [];

        // Кнопки автомобилей (по 2 в ряду)
        for (let i = 0; i < cars.length; i += 2) {
            const row = [];
            
            // Первая кнопка в ряду
            const car1 = cars[i];
            row.push({
                text: `🚗 ${car1.car_name}`,
                callback_data: `select_car_${car1.car_id}`
            });

            // Вторая кнопка в ряду (если есть)
            if (i + 1 < cars.length) {
                const car2 = cars[i + 1];
                row.push({
                    text: `🚗 ${car2.car_name}`,
                    callback_data: `select_car_${car2.car_id}`
                });
            }

            keyboard.push(row);
        }

        // Кнопки навигации
        const navRow = [];
        if (pagination.hasPrev) {
            navRow.push({
                text: '⬅️ Назад',
                callback_data: `garage_page_${pagination.currentPage - 1}`
            });
        }
        if (pagination.hasNext) {
            navRow.push({
                text: '➡️ Далее',
                callback_data: `garage_page_${pagination.currentPage + 1}`
            });
        }

        if (navRow.length > 0) {
            keyboard.push(navRow);
        }

        // Кнопка "Назад в главное меню"
        keyboard.push([{
            text: '🏠 Главное меню',
            callback_data: 'back_to_main'
        }]);

        return keyboard;
    }

    /**
     * Обработать выбор автомобиля
     * @param {Object} callbackQuery - Callback query от Telegram
     */
    async handleCarSelection(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const telegramId = callbackQuery.from.id;
        const carId = parseInt(callbackQuery.data.split('_')[2]);

        try {
            // Проверяем лимит заявок (анти-спам)
            const recentRequestsCount = await GarageRequest.countRecentByUser(telegramId.toString(), 1);
            if (recentRequestsCount >= 3) {
                await this.bot.answerCallbackQuery(callbackQuery.id, {
                    text: 'Вы превысили лимит заявок (3 в час)',
                    show_alert: true
                });
                return;
            }

            // Получаем информацию об автомобиле
            const car = await Garage.findById(carId);
            if (!car) {
                await this.bot.answerCallbackQuery(callbackQuery.id, {
                    text: 'Автомобиль не найден',
                    show_alert: true
                });
                return;
            }

            // Проверяем, есть ли уже активная заявка для этого автомобиля
            const user = await User.findByTelegramId(telegramId);
            const existingRequest = await GarageRequest.findByUserAndCar(user.id, carId, 'Не выплачено');
            
            if (existingRequest) {
                await this.bot.answerCallbackQuery(callbackQuery.id, {
                    text: `У вас уже есть активная заявка для ${car.car_name}`,
                    show_alert: true
                });
                return;
            }

            // Устанавливаем состояние ожидания фото
            this.setUserSession(telegramId, {
                state: this.STATES.AWAITING_PHOTO,
                carId: carId,
                carName: car.car_name
            });

            await this.bot.answerCallbackQuery(callbackQuery.id);
            await this.bot.sendMessage(chatId, 
                `📷 Отправьте фото замены масла для *${car.car_name}*\n\n` +
                `Текущий статус: ${car.getDisplayName()}\n` +
                `Вознаграждение: 3 млн игровой валюты\n\n` +
                `⏱️ У вас есть 30 минут для отправки фото.`,
                { parse_mode: 'Markdown' }
            );

        } catch (error) {
            console.error('Ошибка обработки выбора автомобиля:', error);
            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Ошибка обработки запроса',
                show_alert: true
            });
        }
    }

    /**
     * Обработать навигацию по страницам
     * @param {Object} callbackQuery - Callback query от Telegram
     */
    async handlePageNavigation(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const page = parseInt(callbackQuery.data.split('_')[2]);

        try {
            await this.bot.answerCallbackQuery(callbackQuery.id);
            
            // Редактируем существующее сообщение
            await this.editGarageMenu(chatId, callbackQuery.message.message_id, page);
            
        } catch (error) {
            console.error('Ошибка навигации по страницам:', error);
            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Ошибка навигации',
                show_alert: true
            });
        }
    }

    /**
     * Редактировать меню гаража
     * @param {number} chatId - ID чата
     * @param {number} messageId - ID сообщения
     * @param {number} page - Номер страницы
     */
    async editGarageMenu(chatId, messageId, page = 0) {
        try {
            const pageSize = 5;
            const carsData = await Garage.getCarsPaginated(page, pageSize);
            const { cars, pagination } = carsData;

            // Формируем новый текст
            let messageText = `🚗 ГАРАЖ СЕМЬИ | АВТОМОБИЛИ (${pagination.currentPage + 1}/${pagination.totalPages})\n\n`;
            
            cars.forEach(car => {
                messageText += `${car.getDisplayName()}\n`;
            });

            // Формируем новую клавиатуру
            const keyboard = this.buildGarageKeyboard(cars, pagination);

            await this.bot.editMessageText(messageText, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });

        } catch (error) {
            console.error('Ошибка редактирования меню гаража:', error);
            throw error;
        }
    }

    /**
     * Обработать загрузку фотографии
     * @param {Object} msg - Сообщение с фото
     */
    async handlePhotoUpload(msg) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;

        try {
            // Проверяем состояние пользователя
            const session = this.getUserSession(telegramId);
            if (!session || session.state !== this.STATES.AWAITING_PHOTO) {
                return; // Игнорируем фото, если не ожидается
            }

            // Получаем пользователя
            const user = await User.findByTelegramId(telegramId);
            if (!user) {
                await this.bot.sendMessage(chatId, '❌ Пользователь не найден');
                this.clearUserSession(telegramId);
                return;
            }

            // Сохраняем фото
            const photoPath = await this.savePhotoFile(msg.photo[msg.photo.length - 1].file_id, telegramId, session.carId);

            // Создаем заявку
            const requestData = {
                car_id: session.carId,
                user_id: user.id,
                telegram_id: telegramId.toString(),
                photo_path: photoPath,
                payment_status: 'Не выплачено'
            };

            const newRequest = await GarageRequest.create(requestData);

            // Очищаем сессию
            this.clearUserSession(telegramId);

            // Уведомляем пользователя
            await this.bot.sendMessage(chatId, 
                `✅ Заявка подана!\n\n` +
                `🚗 Автомобиль: ${session.carName}\n` +
                `📷 Фото получено\n` +
                `💰 Вознаграждение: 3 млн\n\n` +
                `⏳ Ожидайте решения администратора...`
            );

            // Уведомляем администраторов
            await this.notifyAdmins(newRequest);

        } catch (error) {
            console.error('Ошибка обработки фото:', error);
            await this.bot.sendMessage(chatId, '❌ Ошибка обработки фотографии. Попробуйте снова.');
            this.clearUserSession(telegramId);
        }
    }

    /**
     * Уведомить администраторов о новой заявке
     * @param {GarageRequest} request - Заявка
     */
    async notifyAdmins(request) {
        try {
            const [car, user] = await Promise.all([
                request.getCar(),
                request.getUser()
            ]);

            const userName = user.first_name + (user.last_name ? ` ${user.last_name}` : '');
            const username = user.username ? `@${user.username}` : '';

            const messageText = 
                `🚨 НОВАЯ ЗАЯВКА #${request.id}\n\n` +
                `👤 Пользователь: ${userName} ${username}\n` +
                `🚗 Автомобиль: ${car.car_name}\n` +
                `📷 Фото: Прикреплено ниже\n` +
                `⏰ Подано: ${request.getFormattedSubmissionDate()}`;

            const keyboard = [
                [
                    {
                        text: '✅ Принять',
                        callback_data: `garage_approve_${request.id}`
                    },
                    {
                        text: '❌ Отклонить',
                        callback_data: `garage_reject_${request.id}`
                    }
                ]
            ];

            // Отправляем фото с кнопками администратору
            if (request.photoExists()) {
                await this.bot.sendPhoto(this.adminId, request.photo_path, {
                    caption: messageText,
                    reply_markup: {
                        inline_keyboard: keyboard
                    }
                });
            } else {
                await this.bot.sendMessage(this.adminId, messageText, {
                    reply_markup: {
                        inline_keyboard: keyboard
                    }
                });
            }

        } catch (error) {
            console.error('Ошибка уведомления администраторов:', error);
        }
    }

    /**
     * Сохранить файл фотографии
     * @param {string} fileId - ID файла в Telegram
     * @param {number} telegramId - ID пользователя
     * @param {number} carId - ID автомобиля
     * @returns {Promise<string>} Путь к сохраненному файлу
     */
    async savePhotoFile(fileId, telegramId, carId) {
        try {
            const file = await this.bot.getFile(fileId);
            const timestamp = Date.now();
            const fileName = `${timestamp}_${telegramId}_car${carId}.jpg`;
            
            // Создаем директорию, если она не существует
            const photosDir = path.join(__dirname, '..', '..', 'photos', 'garage_requests');
            if (!fs.existsSync(photosDir)) {
                fs.mkdirSync(photosDir, { recursive: true });
            }
            
            const photoPath = path.join(photosDir, fileName);
            
            await this.bot.downloadFile(fileId, photosDir);
            
            // Переименовываем файл
            const downloadedPath = path.join(photosDir, file.file_path.split('/').pop());
            if (downloadedPath !== photoPath) {
                fs.renameSync(downloadedPath, photoPath);
            }
            
            return photoPath;
        } catch (error) {
            throw new Error(`Ошибка сохранения фото: ${error.message}`);
        }
    }

    /**
     * Установить сессию пользователя
     * @param {number} telegramId - ID пользователя
     * @param {Object} sessionData - Данные сессии
     */
    setUserSession(telegramId, sessionData) {
        this.userSessions.set(telegramId, {
            ...sessionData,
            startTime: Date.now()
        });
    }

    /**
     * Получить сессию пользователя
     * @param {number} telegramId - ID пользователя
     * @returns {Object|null}
     */
    getUserSession(telegramId) {
        return this.userSessions.get(telegramId) || null;
    }

    /**
     * Очистить сессию пользователя
     * @param {number} telegramId - ID пользователя
     */
    clearUserSession(telegramId) {
        this.userSessions.delete(telegramId);
    }

    /**
     * Очистить истекшие сессии
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        for (const [telegramId, session] of this.userSessions.entries()) {
            if (now - session.startTime > this.SESSION_TIMEOUT) {
                this.userSessions.delete(telegramId);
                console.log(`Очищена истекшая сессия для пользователя ${telegramId}`);
            }
        }
    }
}

module.exports = GarageManager;