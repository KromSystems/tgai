const GarageRequest = require('../database/models/garageRequest');
const RequestProcessor = require('./RequestProcessor');

/**
 * AdminNotifier - компонент для уведомления администраторов
 * Обрабатывает уведомления о новых заявках и действия администраторов
 */
class AdminNotifier {
    constructor(bot, adminId) {
        this.bot = bot;
        this.adminId = adminId;
        this.requestProcessor = new RequestProcessor();
        
        // Состояния для обработки причин отклонения
        this.adminSessions = new Map();
        this.SESSION_TIMEOUT = 10 * 60 * 1000; // 10 минут

        // Настройка автоочистки сессий
        setInterval(() => this.cleanupExpiredSessions(), 2 * 60 * 1000);
    }

    /**
     * Уведомить администратора о новой заявке
     * @param {GarageRequest} request - Новая заявка
     */
    async notifyNewRequest(request) {
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
                `📊 Статус масла: ${car.getDisplayName()}\n` +
                `⏰ Подано: ${request.getFormattedSubmissionDate()}\n` +
                `💰 Вознаграждение: 3 млн`;

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
                ],
                [
                    {
                        text: '📊 Подробности',
                        callback_data: `garage_details_${request.id}`
                    }
                ]
            ];

            // Отправляем фото с кнопками
            if (request.photoExists()) {
                await this.bot.sendPhoto(this.adminId, request.photo_path, {
                    caption: messageText,
                    reply_markup: {
                        inline_keyboard: keyboard
                    }
                });
            } else {
                await this.bot.sendMessage(this.adminId, messageText + '\n\n❌ Фото недоступно', {
                    reply_markup: {
                        inline_keyboard: keyboard
                    }
                });
            }

            console.log(`📢 Администратор уведомлен о новой заявке #${request.id}`);

        } catch (error) {
            console.error('❌ Ошибка уведомления администратора:', error);
            
            // Отправляем базовое уведомление, если основное не удалось
            try {
                await this.bot.sendMessage(this.adminId, 
                    `🚨 Новая заявка #${request.id}\n` +
                    `❌ Ошибка загрузки деталей: ${error.message}`
                );
            } catch (fallbackError) {
                console.error('❌ Ошибка отправки резервного уведомления:', fallbackError);
            }
        }
    }

    /**
     * Обработать одобрение заявки администратором
     * @param {Object} callbackQuery - Callback query от Telegram
     */
    async handleAdminApproval(callbackQuery) {
        const requestId = parseInt(callbackQuery.data.split('_')[2]);
        const adminTelegramId = callbackQuery.from.id;

        try {
            // Проверяем права администратора
            if (adminTelegramId !== this.adminId) {
                await this.bot.answerCallbackQuery(callbackQuery.id, {
                    text: 'У вас нет прав для выполнения этого действия',
                    show_alert: true
                });
                return;
            }

            // Получаем ID администратора из базы данных
            const User = require('../database/models/user');
            const admin = await User.findByTelegramId(adminTelegramId);
            if (!admin) {
                await this.bot.answerCallbackQuery(callbackQuery.id, {
                    text: 'Администратор не найден в базе данных',
                    show_alert: true
                });
                return;
            }

            // Обрабатываем одобрение
            const result = await this.requestProcessor.processApproval(requestId, admin.id);

            // Обновляем сообщение администратора
            await this.updateAdminMessage(callbackQuery, result, 'approved');

            // Уведомляем пользователя об одобрении
            await this.notifyUserApproval(result);

            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: '✅ Заявка одобрена!',
                show_alert: false
            });

        } catch (error) {
            console.error(`❌ Ошибка одобрения заявки #${requestId}:`, error);
            
            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: `Ошибка: ${error.message}`,
                show_alert: true
            });
        }
    }

    /**
     * Обработать отклонение заявки администратором
     * @param {Object} callbackQuery - Callback query от Telegram
     */
    async handleAdminRejection(callbackQuery) {
        const requestId = parseInt(callbackQuery.data.split('_')[2]);
        const adminTelegramId = callbackQuery.from.id;

        try {
            // Проверяем права администратора
            if (adminTelegramId !== this.adminId) {
                await this.bot.answerCallbackQuery(callbackQuery.id, {
                    text: 'У вас нет прав для выполнения этого действия',
                    show_alert: true
                });
                return;
            }

            // Устанавливаем состояние ожидания причины отклонения
            this.setAdminSession(adminTelegramId, {
                state: 'awaiting_rejection_reason',
                requestId: requestId,
                originalMessageId: callbackQuery.message.message_id
            });

            await this.bot.answerCallbackQuery(callbackQuery.id);
            
            await this.bot.sendMessage(this.adminId, 
                `❌ Отклонение заявки #${requestId}\n\n` +
                `📝 Введите причину отклонения (она будет отправлена пользователю):`,
                {
                    reply_markup: {
                        force_reply: true
                    }
                }
            );

        } catch (error) {
            console.error(`❌ Ошибка инициации отклонения заявки #${requestId}:`, error);
            
            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: `Ошибка: ${error.message}`,
                show_alert: true
            });
        }
    }

    /**
     * Обработать причину отклонения от администратора
     * @param {Object} msg - Сообщение с причиной отклонения
     */
    async handleRejectionReason(msg) {
        const adminTelegramId = msg.from.id;
        const reason = msg.text;

        try {
            // Проверяем сессию администратора
            const session = this.getAdminSession(adminTelegramId);
            if (!session || session.state !== 'awaiting_rejection_reason') {
                return; // Игнорируем, если не ожидается причина
            }

            const requestId = session.requestId;

            // Получаем ID администратора из базы данных
            const User = require('../database/models/user');
            const admin = await User.findByTelegramId(adminTelegramId);
            if (!admin) {
                await this.bot.sendMessage(this.adminId, '❌ Администратор не найден в базе данных');
                this.clearAdminSession(adminTelegramId);
                return;
            }

            // Обрабатываем отклонение
            const result = await this.requestProcessor.processRejection(requestId, admin.id, reason);

            // Очищаем сессию
            this.clearAdminSession(adminTelegramId);

            // Обновляем исходное сообщение
            await this.updateAdminMessageForRejection(session.originalMessageId, result);

            // Уведомляем пользователя об отклонении
            await this.notifyUserRejection(result);

            await this.bot.sendMessage(this.adminId, 
                `✅ Заявка #${requestId} отклонена.\n` +
                `📝 Причина: ${reason}`
            );

        } catch (error) {
            console.error('❌ Ошибка обработки причины отклонения:', error);
            
            await this.bot.sendMessage(this.adminId, 
                `❌ Ошибка обработки отклонения: ${error.message}`
            );
            
            this.clearAdminSession(adminTelegramId);
        }
    }

    /**
     * Показать подробности заявки
     * @param {Object} callbackQuery - Callback query
     */
    async handleRequestDetails(callbackQuery) {
        const requestId = parseInt(callbackQuery.data.split('_')[2]);

        try {
            const request = await GarageRequest.findById(requestId);
            if (!request) {
                await this.bot.answerCallbackQuery(callbackQuery.id, {
                    text: 'Заявка не найдена',
                    show_alert: true
                });
                return;
            }

            const [car, user] = await Promise.all([
                request.getCar(),
                request.getUser()
            ]);

            const detailsText = 
                `📊 ПОДРОБНОСТИ ЗАЯВКИ #${request.id}\n\n` +
                `👤 Пользователь:\n` +
                `   • Имя: ${user.first_name} ${user.last_name || ''}\n` +
                `   • Username: ${user.username ? '@' + user.username : 'Не указан'}\n` +
                `   • Telegram ID: ${user.telegram_id}\n` +
                `   • Авторизован: ${user.isAuthorized() ? '✅' : '❌'}\n\n` +
                `🚗 Автомобиль:\n` +
                `   • Название: ${car.car_name}\n` +
                `   • ID: ${car.car_id}\n` +
                `   • Статус: ${car.getDisplayName()}\n` +
                `   • Последнее ТО: ${car.last_maintenance ? new Date(car.last_maintenance).toLocaleDateString('ru-RU') : 'Не указано'}\n\n` +
                `📋 Заявка:\n` +
                `   • Статус: ${request.getFormattedStatus()}\n` +
                `   • Подана: ${request.getFormattedSubmissionDate()}\n` +
                `   • Фото: ${request.photoExists() ? '✅ Доступно' : '❌ Недоступно'}`;

            await this.bot.answerCallbackQuery(callbackQuery.id);
            await this.bot.sendMessage(this.adminId, detailsText);

        } catch (error) {
            console.error('❌ Ошибка получения подробностей заявки:', error);
            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Ошибка загрузки подробностей',
                show_alert: true
            });
        }
    }

    /**
     * Обновить сообщение администратора после обработки
     * @param {Object} callbackQuery - Callback query
     * @param {Object} result - Результат обработки
     * @param {string} action - Действие ('approved' или 'rejected')
     */
    async updateAdminMessage(callbackQuery, result, action) {
        try {
            const { request, car, user } = result;
            const userName = user.first_name + (user.last_name ? ` ${user.last_name}` : '');
            const username = user.username ? `@${user.username}` : '';

            const statusEmoji = action === 'approved' ? '✅' : '❌';
            const statusText = action === 'approved' ? 'ОДОБРЕНА' : 'ОТКЛОНЕНА';

            const updatedText = 
                `${statusEmoji} ЗАЯВКА ${statusText} #${request.id}\n\n` +
                `👤 Пользователь: ${userName} ${username}\n` +
                `🚗 Автомобиль: ${car.car_name}\n` +
                `📊 Статус масла: ${car.getDisplayName()}\n` +
                `⏰ Подано: ${request.getFormattedSubmissionDate()}\n` +
                `✅ Обработано: ${new Date().toLocaleString('ru-RU')}\n` +
                `💰 Вознаграждение: 3 млн`;

            await this.bot.editMessageCaption(updatedText, {
                chat_id: callbackQuery.message.chat.id,
                message_id: callbackQuery.message.message_id,
                reply_markup: { inline_keyboard: [] }
            });

        } catch (error) {
            console.error('❌ Ошибка обновления сообщения администратора:', error);
        }
    }

    /**
     * Обновить сообщение для отклоненной заявки
     * @param {number} messageId - ID сообщения
     * @param {Object} result - Результат отклонения
     */
    async updateAdminMessageForRejection(messageId, result) {
        try {
            const { request, car, user, comment } = result;
            const userName = user.first_name + (user.last_name ? ` ${user.last_name}` : '');
            const username = user.username ? `@${user.username}` : '';

            const updatedText = 
                `❌ ЗАЯВКА ОТКЛОНЕНА #${request.id}\n\n` +
                `👤 Пользователь: ${userName} ${username}\n` +
                `🚗 Автомобиль: ${car.car_name}\n` +
                `📊 Статус масла: ${car.getDisplayName()}\n` +
                `⏰ Подано: ${request.getFormattedSubmissionDate()}\n` +
                `❌ Отклонено: ${new Date().toLocaleString('ru-RU')}\n` +
                `📝 Причина: ${comment}`;

            await this.bot.editMessageCaption(updatedText, {
                chat_id: this.adminId,
                message_id: messageId,
                reply_markup: { inline_keyboard: [] }
            });

        } catch (error) {
            console.error('❌ Ошибка обновления сообщения для отклонения:', error);
        }
    }

    /**
     * Уведомить пользователя об одобрении заявки
     * @param {Object} result - Результат одобрения
     */
    async notifyUserApproval(result) {
        try {
            const { request, car, user } = result;

            const messageText = 
                `✅ ЗАЯВКА ОДОБРЕНА!\n\n` +
                `🚗 Автомобиль: ${car.car_name}\n` +
                `💰 Вознаграждение: 3 млн игровой валюты\n` +
                `📋 Номер заявки: #${request.id}\n\n` +
                `💸 Производится оплата...\n` +
                `Средства будут зачислены в ближайшее время.`;

            await this.bot.sendMessage(user.telegram_id, messageText);

        } catch (error) {
            console.error('❌ Ошибка уведомления пользователя об одобрении:', error);
        }
    }

    /**
     * Уведомить пользователя об отклонении заявки
     * @param {Object} result - Результат отклонения
     */
    async notifyUserRejection(result) {
        try {
            const { request, car, user, comment } = result;

            const messageText = 
                `❌ ЗАЯВКА ОТКЛОНЕНА\n\n` +
                `🚗 Автомобиль: ${car.car_name}\n` +
                `📋 Номер заявки: #${request.id}\n\n` +
                `📝 Причина отклонения:\n${comment}\n\n` +
                `💡 Вы можете подать новую заявку с учетом замечаний.`;

            await this.bot.sendMessage(user.telegram_id, messageText);

        } catch (error) {
            console.error('❌ Ошибка уведомления пользователя об отклонении:', error);
        }
    }

    /**
     * Установить сессию администратора
     * @param {number} adminId - ID администратора
     * @param {Object} sessionData - Данные сессии
     */
    setAdminSession(adminId, sessionData) {
        this.adminSessions.set(adminId, {
            ...sessionData,
            startTime: Date.now()
        });
    }

    /**
     * Получить сессию администратора
     * @param {number} adminId - ID администратора
     * @returns {Object|null}
     */
    getAdminSession(adminId) {
        return this.adminSessions.get(adminId) || null;
    }

    /**
     * Очистить сессию администратора
     * @param {number} adminId - ID администратора
     */
    clearAdminSession(adminId) {
        this.adminSessions.delete(adminId);
    }

    /**
     * Очистить истекшие сессии администраторов
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        for (const [adminId, session] of this.adminSessions.entries()) {
            if (now - session.startTime > this.SESSION_TIMEOUT) {
                this.adminSessions.delete(adminId);
                console.log(`Очищена истекшая админ-сессия для ${adminId}`);
            }
        }
    }
}

module.exports = AdminNotifier;