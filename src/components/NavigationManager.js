/**
 * NavigationManager - управление навигацией по меню команды /help
 * Обрабатывает callback запросы и управляет переходами между разделами
 */

class NavigationManager {
    constructor(menuBuilder, userTypeDetector, contentProvider) {
        this.menuBuilder = menuBuilder;
        this.userTypeDetector = userTypeDetector;
        this.contentProvider = contentProvider;
        
        // Карта callback обработчиков
        this.callbackHandlers = {
            // Основная навигация
            'help_main': this.handleMainMenu.bind(this),
            
            // Админские функции
            'help_admin_users': this.handleAdminUsers.bind(this),
            'help_admin_stats': this.handleAdminStats.bind(this),
            'help_admin_settings': this.handleAdminSettings.bind(this),
            'help_admin_notifications': this.handleAdminNotifications.bind(this),
            'help_admin_requests': this.handleAdminRequests.bind(this),
            'help_admin_blocks': this.handleAdminBlocks.bind(this),
            'help_admin_backup': this.handleAdminBackup.bind(this),
            
            // Административные функции управления пользователями
            'help_admin_all_users': this.handleAdminAllUsers.bind(this),
            'help_admin_pending_requests': this.handleAdminPendingRequests.bind(this),
            'help_admin_authorized': this.handleAdminAuthorized.bind(this),
            'help_admin_blocked': this.handleAdminBlocked.bind(this),
            'help_admin_detailed_stats': this.handleAdminDetailedStats.bind(this),
            
            // Пользовательские функции
            'help_user_profile': this.handleUserProfile.bind(this),
            'help_user_settings': this.handleUserSettings.bind(this),
            'help_user_history': this.handleUserHistory.bind(this),
            'help_user_news': this.handleUserNews.bind(this),
            'help_user_faq': this.handleUserFAQ.bind(this),
            'help_user_support': this.handleUserSupport.bind(this),
            
            // Гостевые функции
            'help_guest_about': this.handleGuestAbout.bind(this),
            'help_guest_rules': this.handleGuestRules.bind(this),
            'help_guest_contacts': this.handleGuestContacts.bind(this),
            'help_guest_faq': this.handleGuestFAQ.bind(this),
            'help_guest_check_request': this.handleGuestCheckRequest.bind(this),
            
            // Специальные функции
            'help_emergency': this.handleEmergency.bind(this),
            'help_refresh': this.handleRefresh.bind(this)
        };
    }

    /**
     * Обработать callback запрос
     * @param {Object} callbackQuery - Callback query объект
     * @param {Object} user - Объект пользователя
     * @param {Function} bot - Экземпляр бота
     * @returns {Promise<boolean>} - Успешность обработки
     */
    async handleCallback(callbackQuery, user, bot) {
        const { data, from, message } = callbackQuery;
        const telegramId = from.id;
        
        try {
            // Определяем тип пользователя
            const userType = this.userTypeDetector.detectUserType(telegramId, user);
            
            // Проверяем доступ к функции
            const accessCheck = this.checkAccess(data, userType);
            if (!accessCheck.allowed) {
                await bot.answerCallbackQuery(callbackQuery.id, {
                    text: accessCheck.message,
                    show_alert: true
                });
                return false;
            }

            // Находим обработчик
            const handler = this.callbackHandlers[data];
            if (!handler) {
                await bot.answerCallbackQuery(callbackQuery.id, {
                    text: '❓ Неизвестная команда',
                    show_alert: true
                });
                return false;
            }

            // Выполняем обработчик
            const result = await handler(callbackQuery, user, userType, bot);
            
            // Отвечаем на callback
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: result.notificationText || '✅'
            });

            return true;
        } catch (error) {
            console.error('Error handling callback:', error);
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Произошла ошибка',
                show_alert: true
            });
            return false;
        }
    }

    /**
     * Проверить доступ к функции
     * @param {string} callbackData - Данные callback
     * @param {string} userType - Тип пользователя
     * @returns {Object} - Результат проверки доступа
     */
    checkAccess(callbackData, userType) {
        // Админские функции
        if (callbackData.startsWith('help_admin_') && userType !== 'admin') {
            return {
                allowed: false,
                message: '👑 Доступно только администраторам'
            };
        }

        // Пользовательские функции
        if (callbackData.startsWith('help_user_') && userType === 'unauthorized') {
            return {
                allowed: false,
                message: '🔒 Необходима авторизация'
            };
        }

        return { allowed: true };
    }

    /**
     * Обработчик главного меню
     */
    async handleMainMenu(callbackQuery, user, userType, bot) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        let menuData;
        
        switch (userType) {
            case 'admin':
                menuData = this.menuBuilder.buildAdminMenu(user);
                break;
            case 'authorized':
                menuData = this.menuBuilder.buildUserMenu(user);
                break;
            case 'unauthorized':
                // Получаем активную заявку
                const AuthRequest = require('../database/models/authRequest');
                const authRequest = await AuthRequest.findByTelegramId(user?.telegram_id);
                menuData = this.menuBuilder.buildGuestMenu(user, authRequest);
                break;
            default:
                throw new Error('Unknown user type');
        }

        await bot.editMessageText(menuData.text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: menuData.keyboard,
            parse_mode: 'HTML'
        });

        return { notificationText: 'Главное меню обновлено' };
    }

    /**
     * Обработчик меню управления пользователями
     */
    async handleAdminUsers(callbackQuery, user, userType, bot) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        // Получаем статистику пользователей
        const User = require('../database/models/user');
        const AuthRequest = require('../database/models/authRequest');
        
        const [totalUsers, authorizedUsers, pendingRequests] = await Promise.all([
            User.findAll(),
            User.findAuthorized(),
            AuthRequest.findPending()
        ]);

        const stats = {
            total: totalUsers.length,
            authorized: authorizedUsers.length,
            blocked: 0 // TODO: implement blocked users count
        };

        const menuData = this.menuBuilder.buildAdminUsersMenu(pendingRequests, stats);

        await bot.editMessageText(menuData.text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: menuData.keyboard,
            parse_mode: 'HTML'
        });

        return { notificationText: 'Управление пользователями' };
    }

    /**
     * Обработчик статистики администратора
     */
    async handleAdminStats(callbackQuery, user, userType, bot) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        // Получаем статистику
        const HelpMetrics = require('../database/models/helpMetrics');
        const stats = await HelpMetrics.getUsageStats();
        
        const text = `📊 СТАТИСТИКА СИСТЕМЫ

📈 Использование команды /help:
• Всего запросов (7 дней): ${stats.total_usage}
• Среднее время ответа: ${stats.avg_response_time?.toFixed(2) || 0}мс

👥 По типам пользователей:
${stats.user_type_breakdown.map(item => 
    `• ${this.userTypeDetector.getUserLevelName(item.user_type)}: ${item.count}`
).join('\n')}

🔥 Популярные разделы:
${stats.popular_sections.slice(0, 5).map((item, index) => 
    `${index + 1}. ${item.menu_section}: ${item.count} переходов`
).join('\n')}

📅 Период: ${stats.time_range}`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📊 Детальная статистика', callback_data: 'help_admin_detailed_stats' },
                    { text: '📈 Тренды', callback_data: 'help_admin_trends' }
                ],
                [
                    { text: '🔄 Обновить', callback_data: 'help_admin_stats' }
                ],
                [
                    { text: '🔙 Назад', callback_data: 'help_main' }
                ]
            ]
        };

        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });

        return { notificationText: 'Статистика обновлена' };
    }

    /**
     * Обработчик профиля пользователя
     */
    async handleUserProfile(callbackQuery, user, userType, bot) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        const menuData = this.menuBuilder.buildUserProfileMenu(user);

        await bot.editMessageText(menuData.text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: menuData.keyboard,
            parse_mode: 'HTML'
        });

        return { notificationText: 'Профиль пользователя' };
    }

    /**
     * Обработчик информации о системе
     */
    async handleGuestAbout(callbackQuery, user, userType, bot) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        const menuData = this.menuBuilder.buildAboutSystemMenu();

        await bot.editMessageText(menuData.text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: menuData.keyboard,
            parse_mode: 'HTML'
        });

        return { notificationText: 'О системе' };
    }

    /**
     * Обработчик правил
     */
    async handleGuestRules(callbackQuery, user, userType, bot) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        const menuData = this.menuBuilder.buildRulesMenu();

        await bot.editMessageText(menuData.text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: menuData.keyboard,
            parse_mode: 'HTML'
        });

        return { notificationText: 'Правила сообщества' };
    }

    /**
     * Обработчик контактов
     */
    async handleGuestContacts(callbackQuery, user, userType, bot) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        const menuData = this.menuBuilder.buildContactsMenu();

        await bot.editMessageText(menuData.text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: menuData.keyboard,
            parse_mode: 'HTML'
        });

        return { notificationText: 'Контактная информация' };
    }

    /**
     * Обработчик FAQ
     */
    async handleGuestFAQ(callbackQuery, user, userType, bot) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        const menuData = this.menuBuilder.buildFAQMenu();

        await bot.editMessageText(menuData.text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: menuData.keyboard,
            parse_mode: 'HTML'
        });

        return { notificationText: 'Часто задаваемые вопросы' };
    }

    /**
     * Обработчик экстренной помощи
     */
    async handleEmergency(callbackQuery, user, userType, bot) {
        const chatId = callbackQuery.message.chat.id;
        const telegramId = callbackQuery.from.id;
        
        const text = `🆘 ЭКСТРЕННАЯ ПОМОЩЬ

Ваш запрос на экстренную помощь отправлен администратору.

📞 Контакты для критических ситуаций:
• Telegram: @admin_username
• Email: emergency@example.com

⏰ Время ответа: до 30 минут

🔴 Используйте только для критических вопросов!`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📱 Написать админу', url: 'https://t.me/admin_username' }
                ],
                [
                    { text: '🔙 Назад в меню', callback_data: 'help_main' }
                ]
            ]
        };

        // Уведомляем администратора
        const ADMIN_ID = parseInt(process.env.ADMIN_ID);
        await bot.sendMessage(ADMIN_ID, 
            `🆘 ЭКСТРЕННЫЙ ЗАПРОС\n\n` +
            `От: ${user?.getDisplayName() || telegramId}\n` +
            `ID: ${telegramId}\n` +
            `Время: ${new Date().toLocaleString('ru-RU')}\n\n` +
            `Пользователь запросил экстренную помощь.`
        );

        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id,
            reply_markup: keyboard,
            parse_mode: 'HTML'
        });

        return { notificationText: 'Запрос отправлен администратору' };
    }

    // Заглушки для остальных обработчиков
    async handleAdminSettings(callbackQuery, user, userType, bot) {
        return this.createPlaceholderHandler('Настройки администратора')(callbackQuery, user, userType, bot);
    }

    async handleAdminNotifications(callbackQuery, user, userType, bot) {
        return this.createPlaceholderHandler('Уведомления')(callbackQuery, user, userType, bot);
    }

    async handleAdminRequests(callbackQuery, user, userType, bot) {
        return this.createPlaceholderHandler('Заявки на авторизацию')(callbackQuery, user, userType, bot);
    }

    async handleAdminBlocks(callbackQuery, user, userType, bot) {
        return this.createPlaceholderHandler('Управление блокировками')(callbackQuery, user, userType, bot);
    }

    async handleAdminBackup(callbackQuery, user, userType, bot) {
        return this.createPlaceholderHandler('Резервное копирование')(callbackQuery, user, userType, bot);
    }

    async handleUserSettings(callbackQuery, user, userType, bot) {
        return this.createPlaceholderHandler('Настройки пользователя')(callbackQuery, user, userType, bot);
    }

    async handleUserHistory(callbackQuery, user, userType, bot) {
        return this.createPlaceholderHandler('История активности')(callbackQuery, user, userType, bot);
    }

    async handleUserNews(callbackQuery, user, userType, bot) {
        return this.createPlaceholderHandler('Новости')(callbackQuery, user, userType, bot);
    }

    async handleUserFAQ(callbackQuery, user, userType, bot) {
        return this.handleGuestFAQ(callbackQuery, user, userType, bot);
    }

    async handleUserSupport(callbackQuery, user, userType, bot) {
        return this.createPlaceholderHandler('Поддержка')(callbackQuery, user, userType, bot);
    }

    async handleGuestCheckRequest(callbackQuery, user, userType, bot) {
        return this.createPlaceholderHandler('Проверка заявки')(callbackQuery, user, userType, bot);
    }

    async handleRefresh(callbackQuery, user, userType, bot) {
        return this.handleMainMenu(callbackQuery, user, userType, bot);
    }

    /**
     * Обработчик показа всех пользователей
     */
    async handleAdminAllUsers(callbackQuery, user, userType, bot) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            // Получаем всех пользователей
            const User = require('../database/models/user');
            const allUsers = await User.findAll({ limit: 10 }); // Ограничиваем для первой страницы
            
            const menuData = this.menuBuilder.buildAllUsersMenu(allUsers);

            await bot.editMessageText(menuData.text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: menuData.keyboard,
                parse_mode: 'HTML'
            });

            return { notificationText: `Найдено ${allUsers.length} пользователей` };
        } catch (error) {
            console.error('Error in handleAdminAllUsers:', error);
            return { notificationText: 'Ошибка загрузки пользователей' };
        }
    }

    /**
     * Обработчик ожидающих заявок
     */
    async handleAdminPendingRequests(callbackQuery, user, userType, bot) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            const AuthRequest = require('../database/models/authRequest');
            const pendingRequests = await AuthRequest.findPending();
            
            const menuData = this.menuBuilder.buildPendingRequestsMenu(pendingRequests);

            await bot.editMessageText(menuData.text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: menuData.keyboard,
                parse_mode: 'HTML'
            });

            return { notificationText: `Найдено ${pendingRequests.length} ожидающих заявок` };
        } catch (error) {
            console.error('Error in handleAdminPendingRequests:', error);
            return { notificationText: 'Ошибка загрузки заявок' };
        }
    }

    /**
     * Обработчик авторизованных пользователей
     */
    async handleAdminAuthorized(callbackQuery, user, userType, bot) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            const User = require('../database/models/user');
            const authorizedUsers = await User.findAuthorized();
            
            const menuData = this.menuBuilder.buildAuthorizedUsersMenu(authorizedUsers);

            await bot.editMessageText(menuData.text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: menuData.keyboard,
                parse_mode: 'HTML'
            });

            return { notificationText: `Найдено ${authorizedUsers.length} авторизованных пользователей` };
        } catch (error) {
            console.error('Error in handleAdminAuthorized:', error);
            return { notificationText: 'Ошибка загрузки авторизованных пользователей' };
        }
    }

    /**
     * Обработчик заблокированных пользователей
     */
    async handleAdminBlocked(callbackQuery, user, userType, bot) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            // Пока нет поля blocked в базе, показываем пустой список
            const blockedUsers = [];
            
            const menuData = this.menuBuilder.buildBlockedUsersMenu(blockedUsers);

            await bot.editMessageText(menuData.text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: menuData.keyboard,
                parse_mode: 'HTML'
            });

            return { notificationText: `Найдено ${blockedUsers.length} заблокированных пользователей` };
        } catch (error) {
            console.error('Error in handleAdminBlocked:', error);
            return { notificationText: 'Ошибка загрузки заблокированных пользователей' };
        }
    }

    /**
     * Обработчик детальной статистики
     */
    async handleAdminDetailedStats(callbackQuery, user, userType, bot) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            const User = require('../database/models/user');
            const AuthRequest = require('../database/models/authRequest');
            const HelpMetrics = require('../database/models/helpMetrics');
            
            // Получаем детальную статистику
            const [totalUsers, authorizedUsers, pendingRequests, allMetrics] = await Promise.all([
                User.findAll(),
                User.findAuthorized(),
                AuthRequest.findPending(),
                HelpMetrics.findAll()
            ]);
            
            const stats = {
                total: totalUsers.length,
                authorized: authorizedUsers.length,
                unauthorized: totalUsers.length - authorizedUsers.length,
                pendingRequests: pendingRequests.length,
                blocked: 0, // TODO: implement when blocked field is added
                helpMetrics: allMetrics.length
            };
            
            const menuData = this.menuBuilder.buildDetailedStatsMenu(stats);

            await bot.editMessageText(menuData.text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: menuData.keyboard,
                parse_mode: 'HTML'
            });

            return { notificationText: 'Детальная статистика системы' };
        } catch (error) {
            console.error('Error in handleAdminDetailedStats:', error);
            return { notificationText: 'Ошибка загрузки статистики' };
        }
    }

    /**
     * Создать обработчик-заглушку
     * @param {string} sectionName - Название раздела
     * @returns {Function} - Обработчик-заглушка
     */
    createPlaceholderHandler(sectionName) {
        return async (callbackQuery, user, userType, bot) => {
            const chatId = callbackQuery.message.chat.id;
            const messageId = callbackQuery.message.message_id;
            
            const text = `🚧 ${sectionName}

Раздел находится в разработке.

🔜 Скоро здесь будут доступны:
• Расширенные функции
• Детальные настройки
• Дополнительная информация

💡 Следите за обновлениями!`;

            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '🔙 Назад', callback_data: 'help_main' }
                    ]
                ]
            };

            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: keyboard
            });

            return { notificationText: `${sectionName} - в разработке` };
        };
    }
}

module.exports = NavigationManager;