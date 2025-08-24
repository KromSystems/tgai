/**
 * MenuBuilder - строитель интерактивных меню для команды /help
 * Создает красивые меню с эмодзи и интерактивными кнопками
 */

class MenuBuilder {
    constructor() {
        this.emojis = {
            // Статусы
            admin: '👑',
            authorized: '✅',
            unauthorized: '🔒',
            
            // Функции
            users: '👥',
            stats: '📊',
            settings: '⚙️',
            profile: '👤',
            notifications: '🔔',
            backup: '💾',
            support: '🆘',
            info: 'ℹ️',
            rules: '📖',
            contacts: '📞',
            
            // Навигация
            home: '🏠',
            back: '🔙',
            refresh: '🔄',
            
            // Декор
            sparkle: '✨',
            star: '🌟',
            target: '🎯',
            game: '🎮',
            trophy: '🏆',
            door: '🚪',
            palace: '🏛️'
        };
    }

    /**
     * Построить главное меню для администратора
     * @param {Object} user - Объект пользователя
     * @returns {Object} - Сообщение и клавиатура
     */
    buildAdminMenu(user) {
        const text = `${this.emojis.palace} ПАНЕЛЬ АДМИНИСТРАТОРА ${this.emojis.admin}

Добро пожаловать в панель управления ботом!

┌─── ${this.emojis.users} УПРАВЛЕНИЕ ───┐
│ • Заявки на авторизацию     │
│ • Список пользователей      │
│ • Заблокированные           │
└─────────────────────────┘

┌─── ${this.emojis.stats} АНАЛИТИКА ───┐
│ • Статистика бота           │
│ • Активность пользователей  │
│ • Отчеты                    │
└─────────────────────────┘

┌─── ${this.emojis.settings} НАСТРОЙКИ ───┐
│ • Конфигурация бота         │
│ • Сообщения и тексты        │
│ • Резервное копирование     │
└─────────────────────────┘

${this.emojis.support} Экстренная помощь: /emergency
${this.emojis.contacts} Техподдержка: @admin_username`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: `${this.emojis.users} Пользователи`, callback_data: 'help_admin_users' },
                    { text: `${this.emojis.stats} Статистика`, callback_data: 'help_admin_stats' }
                ],
                [
                    { text: `${this.emojis.settings} Настройки`, callback_data: 'help_admin_settings' },
                    { text: `${this.emojis.notifications} Уведомления`, callback_data: 'help_admin_notifications' }
                ],
                [
                    { text: `${this.emojis.info} Заявки`, callback_data: 'help_admin_requests' },
                    { text: `🚫 Блокировка`, callback_data: 'help_admin_blocks' }
                ],
                [
                    { text: `${this.emojis.backup} Бэкап`, callback_data: 'help_admin_backup' },
                    { text: `${this.emojis.refresh} Обновить`, callback_data: 'help_main' }
                ]
            ]
        };

        return { text, keyboard };
    }

    /**
     * Построить главное меню для авторизованного пользователя
     * @param {Object} user - Объект пользователя
     * @returns {Object} - Сообщение и клавиатура
     */
    buildUserMenu(user) {
        const greeting = user.first_name ? `${user.first_name}` : 'пользователь';
        const lastSeen = user.updated_at ? 
            new Date(user.updated_at).toLocaleDateString('ru-RU') : 
            'неизвестно';

        const text = `${this.emojis.target} ДОБРО ПОЖАЛОВАТЬ! ${this.emojis.sparkle}

Привет, ${greeting}! Вы успешно авторизованы в системе!

┌─── ${this.emojis.game} ОСНОВНЫЕ ФУНКЦИИ ───┐
│ • Мой профиль               │
│ • Настройки уведомлений     │
│ • История активности        │
└────────────────────────────┘

┌─── ${this.emojis.info} ИНФОРМАЦИЯ ───┐
│ • Правила использования     │
│ • Часто задаваемые вопросы  │
│ • Новости и обновления      │
└────────────────────────────┘

┌─── ${this.emojis.support} ПОДДЕРЖКА ───┐
│ • Связаться с админом       │
│ • Сообщить о проблеме       │
│ • Предложить улучшение      │
└────────────────────────────┘

📅 Последний вход: ${lastSeen}
${this.emojis.trophy} Статус: Авторизованный пользователь`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: `${this.emojis.profile} Профиль`, callback_data: 'help_user_profile' },
                    { text: `${this.emojis.settings} Настройки`, callback_data: 'help_user_settings' }
                ],
                [
                    { text: `📋 История`, callback_data: 'help_user_history' },
                    { text: `📢 Новости`, callback_data: 'help_user_news' }
                ],
                [
                    { text: `❓ FAQ`, callback_data: 'help_user_faq' },
                    { text: `${this.emojis.support} Поддержка`, callback_data: 'help_user_support' }
                ],
                [
                    { text: `${this.emojis.refresh} Обновить`, callback_data: 'help_main' },
                    { text: `${this.emojis.home} Главная`, callback_data: 'help_main' }
                ]
            ]
        };

        return { text, keyboard };
    }

    /**
     * Построить главное меню для неавторизованного пользователя
     * @param {Object} user - Объект пользователя (может быть null)
     * @param {Object} authRequest - Активная заявка (если есть)
     * @returns {Object} - Сообщение и клавиатура
     */
    buildGuestMenu(user, authRequest = null) {
        let statusText = '';
        if (authRequest) {
            if (authRequest.status === 'pending') {
                statusText = `⏳ Ваша заявка находится на рассмотрении
📅 Подана: ${authRequest.getFormattedSubmissionDate()}`;
            } else if (authRequest.status === 'rejected') {
                statusText = `❌ Ваша заявка была отклонена
💡 Вы можете подать новую заявку`;
            }
        }

        const text = `${this.emojis.door} ДОБРО ПОЖАЛОВАТЬ В СИСТЕМУ! ${this.emojis.star}

Вы пока не авторизованы. Получите доступ ко всем функциям!

┌─── ${this.emojis.unauthorized} АВТОРИЗАЦИЯ ───┐
│ • Как получить доступ       │
│ • Требования к заявке       │
│ • Статус моей заявки        │
└────────────────────────────┘

┌─── ${this.emojis.info} ИНФОРМАЦИЯ ───┐
│ • О проекте                 │
│ • Возможности системы       │
│ • Правила сообщества        │
└────────────────────────────┘

┌─── ${this.emojis.contacts} КОНТАКТЫ ───┐
│ • Связаться с админом       │
│ • Техническая поддержка     │
│ • Социальные сети           │
└────────────────────────────┘

${statusText}

⏱️ Среднее время рассмотрения: 24 часа
${this.emojis.authorized} Процент одобренных заявок: 85%`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: `${this.emojis.unauthorized} Авторизоваться`, callback_data: 'start_authorization' },
                    { text: `📋 Моя заявка`, callback_data: 'help_guest_check_request' }
                ],
                [
                    { text: `${this.emojis.info} О системе`, callback_data: 'help_guest_about' },
                    { text: `${this.emojis.rules} Правила`, callback_data: 'help_guest_rules' }
                ],
                [
                    { text: `${this.emojis.contacts} Контакты`, callback_data: 'help_guest_contacts' },
                    { text: `❓ Помощь`, callback_data: 'help_guest_faq' }
                ],
                [
                    { text: `${this.emojis.refresh} Обновить`, callback_data: 'help_main' },
                    { text: `${this.emojis.back} Назад`, callback_data: 'help_main' }
                ]
            ]
        };

        return { text, keyboard };
    }

    /**
     * Построить меню управления пользователями (для админа)
     * @param {Array} pendingRequests - Ожидающие заявки
     * @param {Object} stats - Статистика пользователей
     * @returns {Object} - Сообщение и клавиатура
     */
    buildAdminUsersMenu(pendingRequests = [], stats = {}) {
        const text = `${this.emojis.users} УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ

📊 Статистика:
• Всего пользователей: ${stats.total || 0}
• Авторизованных: ${stats.authorized || 0}
• Ожидающих заявок: ${pendingRequests.length}
• Заблокированных: ${stats.blocked || 0}

${pendingRequests.length > 0 ? 
    `🔔 У вас ${pendingRequests.length} новых заявок на рассмотрение!` : 
    '✅ Все заявки обработаны'}`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: `📋 Заявки (${pendingRequests.length})`, callback_data: 'help_admin_pending_requests' },
                    { text: `👥 Все пользователи`, callback_data: 'help_admin_all_users' }
                ],
                [
                    { text: `✅ Авторизованные`, callback_data: 'help_admin_authorized' },
                    { text: `🚫 Заблокированные`, callback_data: 'help_admin_blocked' }
                ],
                [
                    { text: `📈 Детальная статистика`, callback_data: 'help_admin_detailed_stats' }
                ],
                [
                    { text: `${this.emojis.back} Назад в админ меню`, callback_data: 'help_main' }
                ]
            ]
        };

        return { text, keyboard };
    }

    /**
     * Построить меню профиля пользователя
     * @param {Object} user - Объект пользователя
     * @returns {Object} - Сообщение и клавиатура
     */
    buildUserProfileMenu(user) {
        const text = `${this.emojis.profile} МОЙ ПРОФИЛЬ

👤 Имя: ${user.getFullName()}
🆔 ID: ${user.telegram_id}
📅 Регистрация: ${new Date(user.created_at).toLocaleDateString('ru-RU')}
🌐 Язык: ${user.language_code || 'не указан'}
${this.emojis.authorized} Статус: Авторизован

🔧 Доступные действия:`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: `✏️ Редактировать профиль`, callback_data: 'help_user_edit_profile' },
                    { text: `📜 История активности`, callback_data: 'help_user_activity' }
                ],
                [
                    { text: `🔔 Настройки уведомлений`, callback_data: 'help_user_notifications' }
                ],
                [
                    { text: `${this.emojis.back} Назад`, callback_data: 'help_main' }
                ]
            ]
        };

        return { text, keyboard };
    }

    /**
     * Построить меню информации о системе
     * @returns {Object} - Сообщение и клавиатура
     */
    buildAboutSystemMenu() {
        const text = `${this.emojis.info} О СИСТЕМЕ

🎯 Цель проекта:
Создание закрытого сообщества для обмена знаниями и опытом

⚡ Возможности:
• Авторизованный доступ
• Интерактивное управление
• Система уведомлений
• Административные функции

🛠️ Технологии:
• Node.js + Telegram Bot API
• SQLite база данных
• Система автоматизации

📈 Статистика:
• Работаем с ${new Date().getFullYear()} года
• Более 100+ пользователей
• 99.9% времени работы`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: `📖 Подробная документация`, callback_data: 'help_guest_docs' },
                    { text: `🔧 Техническая информация`, callback_data: 'help_guest_tech' }
                ],
                [
                    { text: `${this.emojis.back} Назад`, callback_data: 'help_main' }
                ]
            ]
        };

        return { text, keyboard };
    }

    /**
     * Построить меню правил
     * @returns {Object} - Сообщение и клавиатура
     */
    buildRulesMenu() {
        const text = `${this.emojis.rules} ПРАВИЛА СООБЩЕСТВА

📋 Основные правила:

1️⃣ Уважение к участникам
Будьте вежливы и корректны в общении

2️⃣ Запрет спама
Не размещайте повторяющиеся или нерелевантные сообщения

3️⃣ Конфиденциальность
Не разглашайте личную информацию других участников

4️⃣ Актуальный контент
Делитесь полезной и актуальной информацией

5️⃣ Соблюдение авторских прав
Указывайте источники при использовании чужих материалов

⚠️ Нарушение правил может привести к блокировке аккаунта`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: `📜 Полные правила`, callback_data: 'help_guest_full_rules' },
                    { text: `⚖️ Политика модерации`, callback_data: 'help_guest_moderation' }
                ],
                [
                    { text: `${this.emojis.back} Назад`, callback_data: 'help_main' }
                ]
            ]
        };

        return { text, keyboard };
    }

    /**
     * Построить меню контактов
     * @returns {Object} - Сообщение и клавиатура
     */
    buildContactsMenu() {
        const text = `${this.emojis.contacts} КОНТАКТЫ

👤 Администратор:
@admin_username

📧 Email поддержки:
support@example.com

🌐 Официальные ресурсы:
• Telegram канал: @example_channel
• GitHub: github.com/example
• Веб-сайт: example.com

⏰ Время ответа:
• Обычно: 2-6 часов
• Экстренные случаи: 30 минут
• Выходные: до 24 часов

🆘 Экстренная связь:
Используйте команду /emergency для критических вопросов`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: `📱 Написать админу`, url: 'https://t.me/admin_username' },
                    { text: `📢 Канал новостей`, url: 'https://t.me/example_channel' }
                ],
                [
                    { text: `🆘 Экстренная помощь`, callback_data: 'help_emergency' }
                ],
                [
                    { text: `${this.emojis.back} Назад`, callback_data: 'help_main' }
                ]
            ]
        };

        return { text, keyboard };
    }

    /**
     * Построить меню FAQ
     * @returns {Object} - Сообщение и клавиатура
     */
    buildFAQMenu() {
        const text = `❓ ЧАСТО ЗАДАВАЕМЫЕ ВОПРОСЫ

🔍 Популярные вопросы:

❓ Как получить авторизацию?
Отправьте заявку через кнопку "Авторизоваться"

❓ Сколько времени рассматривается заявка?
Обычно 2-24 часа в рабочие дни

❓ Что делать, если заявка отклонена?
Можно подать повторную заявку с исправлениями

❓ Как связаться с администратором?
Используйте раздел "Контакты" или команду /help

❓ Можно ли изменить данные профиля?
Да, в разделе "Мой профиль"`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: `🔍 Поиск по FAQ`, callback_data: 'help_faq_search' },
                    { text: `💡 Задать вопрос`, callback_data: 'help_faq_ask' }
                ],
                [
                    { text: `📋 Все вопросы`, callback_data: 'help_faq_all' }
                ],
                [
                    { text: `${this.emojis.back} Назад`, callback_data: 'help_main' }
                ]
            ]
        };

        return { text, keyboard };
    }

    /**
     * Построить меню всех пользователей
     */
    buildAllUsersMenu(users) {
        const totalUsers = users.length;
        let usersList = '';
        
        if (totalUsers === 0) {
            usersList = '💭 Пользователи не найдены';
        } else {
            users.forEach((user, index) => {
                const status = user.authorized === 1 ? '✅ Авторизован' : '⏳ Ожидает';
                const regDate = new Date(user.created_at).toLocaleDateString('ru-RU');
                usersList += `${index + 1}️⃣ ${user.getDisplayName()}\n   📅 Рег: ${regDate} | ${status}\n\n`;
            });
        }

        const text = `👥 ВСЕ ПОЛЬЗОВАТЕЛИ\n\n📊 Общая статистика:\n• Всего пользователей: ${totalUsers}\n\n${usersList}`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: `🔍 Поиск`, callback_data: 'help_admin_search_user' },
                    { text: `📈 Экспорт`, callback_data: 'help_admin_export_users' }
                ],
                [
                    { text: `${this.emojis.back} Назад`, callback_data: 'help_admin_users' }
                ]
            ]
        };

        return { text, keyboard };
    }

    buildPendingRequestsMenu(requests) {
        const totalRequests = requests.length;
        let requestsList = '';
        
        if (totalRequests === 0) {
            requestsList = '✅ Все заявки обработаны!';
        } else {
            requests.slice(0, 5).forEach((request, index) => {
                const submittedDate = new Date(request.submitted_at).toLocaleDateString('ru-RU');
                requestsList += `${index + 1}️⃣ ID: ${request.telegram_id}\n   📅 Подана: ${submittedDate}\n\n`;
            });
        }

        const text = `📋 ОЖИДАЮЩИЕ ЗАЯВКИ\n\n• Ожидающих заявок: ${totalRequests}\n\n${requestsList}`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: `✅ Обработать`, callback_data: 'help_admin_process_requests' }
                ],
                [
                    { text: `${this.emojis.back} Назад`, callback_data: 'help_admin_users' }
                ]
            ]
        };

        return { text, keyboard };
    }

    buildAuthorizedUsersMenu(users) {
        const totalUsers = users.length;
        let usersList = '';
        
        if (totalUsers === 0) {
            usersList = '💭 Нет авторизованных пользователей';
        } else {
            users.slice(0, 8).forEach((user, index) => {
                const regDate = new Date(user.created_at).toLocaleDateString('ru-RU');
                usersList += `${index + 1}️⃣ ${user.getDisplayName()}\n   📅 Авт.: ${regDate}\n\n`;
            });
        }

        const text = `✅ АВТОРИЗОВАННЫЕ\n\n• Авторизованных: ${totalUsers}\n\n${usersList}`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: `📋 Полный список`, callback_data: 'help_admin_full_authorized_list' }
                ],
                [
                    { text: `${this.emojis.back} Назад`, callback_data: 'help_admin_users' }
                ]
            ]
        };

        return { text, keyboard };
    }

    buildBlockedUsersMenu(users) {
        const totalUsers = users.length;
        const text = `🚫 ЗАБЛОКИРОВАННЫЕ\n\n• Заблокированных: ${totalUsers}\n\n✅ Нет заблокированных пользователей`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: `${this.emojis.back} Назад`, callback_data: 'help_admin_users' }
                ]
            ]
        };

        return { text, keyboard };
    }

    buildDetailedStatsMenu(stats) {
        const uptimeHours = Math.floor(process.uptime() / 3600);
        const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        
        const text = `📈 ДЕТАЛЬНАЯ СТАТИСТИКА\n\n👥 Пользователи:\n• Всего: ${stats.total || 0}\n• Авторизованных: ${stats.authorized || 0}\n• Неавторизованных: ${stats.unauthorized || 0}\n\n📊 Система:\n• Время работы: ${uptimeHours} ч\n• Память: ${memoryUsage} MB`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: `🔄 Обновить`, callback_data: 'help_admin_detailed_stats' }
                ],
                [
                    { text: `${this.emojis.back} Назад`, callback_data: 'help_admin_users' }
                ]
            ]
        };

        return { text, keyboard };
    }
}

module.exports = MenuBuilder;