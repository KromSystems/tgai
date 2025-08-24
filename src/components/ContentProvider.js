/**
 * ContentProvider - поставщик персонализированного контента для команды /help
 * Управляет шаблонами сообщений и их персонализацией
 */

class ContentProvider {
    constructor() {
        this.templates = {
            // Базовые приветствия
            welcome_admin: '🏛️ ПАНЕЛЬ АДМИНИСТРАТОРА 👑',
            welcome_user: '🎯 ДОБРО ПОЖАЛОВАТЬ! ✨',
            welcome_guest: '🚪 ДОБРО ПОЖАЛОВАТЬ В СИСТЕМУ! 🌟',

            // Персонализированные элементы
            user_greeting: 'Привет, {first_name}!',
            last_seen: 'Последний вход: {formatted_date}',
            member_since: 'С нами с {registration_date}',
            
            // Статусные сообщения
            auth_pending: '⏳ Ваша заявка находится на рассмотрении',
            auth_rejected: '❌ Ваша заявка была отклонена',
            auth_approved: '✅ Вы успешно авторизованы',

            // Системные сообщения
            error_db: '⚠️ Временные технические работы',
            error_general: '🔄 Попробуем еще раз...',
            loading: '📝 Инициализация профиля...',
            timeout: '⚡ Быстрое меню помощи'
        };

        this.fallbackMessages = {
            admin: 'Добро пожаловать, администратор!',
            user: 'Добро пожаловать, пользователь!',
            guest: 'Добро пожаловать! Пройдите авторизацию для полного доступа.'
        };
    }

    /**
     * Получить персонализированное приветствие
     * @param {string} userType - Тип пользователя
     * @param {Object} user - Объект пользователя
     * @returns {string} - Персонализированное приветствие
     */
    getPersonalizedGreeting(userType, user) {
        if (!user) {
            return this.templates.welcome_guest;
        }

        const firstName = user.first_name || 'пользователь';
        
        switch (userType) {
            case 'admin':
                return `${this.templates.welcome_admin}\n\nДобро пожаловать обратно, ${firstName}!`;
            case 'authorized':
                return `${this.templates.welcome_user}\n\n${this.formatTemplate(this.templates.user_greeting, { first_name: firstName })}`;
            case 'unauthorized':
                return this.templates.welcome_guest;
            default:
                return this.fallbackMessages.guest;
        }
    }

    /**
     * Получить информацию о последней активности
     * @param {Object} user - Объект пользователя
     * @returns {string} - Информация о последней активности
     */
    getLastActivityInfo(user) {
        if (!user || !user.updated_at) {
            return 'Последний вход: неизвестно';
        }

        const lastSeen = new Date(user.updated_at);
        const formatted = this.formatDate(lastSeen);
        
        return this.formatTemplate(this.templates.last_seen, { formatted_date: formatted });
    }

    /**
     * Получить информацию о регистрации
     * @param {Object} user - Объект пользователя
     * @returns {string} - Информация о регистрации
     */
    getRegistrationInfo(user) {
        if (!user || !user.created_at) {
            return '';
        }

        const registrationDate = new Date(user.created_at);
        const formatted = this.formatDate(registrationDate);
        
        return this.formatTemplate(this.templates.member_since, { registration_date: formatted });
    }

    /**
     * Получить статус заявки на авторизацию
     * @param {Object} authRequest - Объект заявки
     * @returns {string} - Статус заявки
     */
    getAuthRequestStatus(authRequest) {
        if (!authRequest) {
            return '';
        }

        switch (authRequest.status) {
            case 'pending':
                return `${this.templates.auth_pending}\n📅 Подана: ${authRequest.getFormattedSubmissionDate()}`;
            case 'rejected':
                return `${this.templates.auth_rejected}\n💡 Вы можете подать новую заявку`;
            case 'approved':
                return this.templates.auth_approved;
            default:
                return '';
        }
    }

    /**
     * Получить статистическую информацию
     * @param {string} userType - Тип пользователя
     * @param {Object} stats - Объект статистики
     * @returns {string} - Форматированная статистика
     */
    getStatsInfo(userType, stats = {}) {
        if (userType === 'admin') {
            return `📊 Статистика системы:
• Всего пользователей: ${stats.total_users || 0}
• Авторизованных: ${stats.authorized_users || 0}
• Ожидающих заявок: ${stats.pending_requests || 0}
• Активных сегодня: ${stats.active_today || 0}`;
        }

        if (userType === 'unauthorized') {
            return `📈 Информация о системе:
⏱️ Среднее время рассмотрения: 24 часа
✅ Процент одобренных заявок: 85%
👥 Активных пользователей: ${stats.active_users || 100}+`;
        }

        return '';
    }

    /**
     * Получить сообщение об ошибке
     * @param {string} errorType - Тип ошибки
     * @param {string} context - Контекст ошибки
     * @returns {string} - Сообщение об ошибке
     */
    getErrorMessage(errorType, context = '') {
        const errorMessages = {
            database: `${this.templates.error_db}\n\nПопробуйте позже или обратитесь к администратору.`,
            network: `${this.templates.error_general}\n\nПроверьте подключение к интернету.`,
            timeout: `${this.templates.timeout}\n\nСистема перегружена, показываем базовое меню.`,
            permission: '🚫 У вас нет доступа к этой функции.\n\nОбратитесь к администратору за помощью.',
            not_found: '❓ Запрашиваемая информация не найдена.\n\nВозможно, данные были удалены.',
            general: `${this.templates.error_general}\n\nЕсли проблема повторяется, обратитесь к администратору.`
        };

        const message = errorMessages[errorType] || errorMessages.general;
        return context ? `${message}\n\nКонтекст: ${context}` : message;
    }

    /**
     * Получить help-сообщения для различных команд
     * @param {string} command - Команда
     * @param {string} userType - Тип пользователя
     * @returns {string} - Help-сообщение
     */
    getCommandHelp(command, userType) {
        const helpMessages = {
            '/start': 'Начать работу с ботом и пройти авторизацию',
            '/help': 'Показать это меню помощи',
            '/emergency': 'Экстренная связь с администратором (только для критических ситуаций)'
        };

        if (userType === 'admin') {
            helpMessages['/admin'] = 'Панель администратора';
            helpMessages['/stats'] = 'Статистика системы';
            helpMessages['/backup'] = 'Создать резервную копию';
        }

        return helpMessages[command] || 'Команда не найдена';
    }

    /**
     * Получить списки полезных ссылок
     * @param {string} userType - Тип пользователя
     * @returns {Array} - Массив ссылок
     */
    getUsefulLinks(userType) {
        const baseLinks = [
            { text: 'Официальный канал', url: 'https://t.me/example_channel' },
            { text: 'Техподдержка', url: 'https://t.me/admin_username' }
        ];

        if (userType === 'admin') {
            return [
                ...baseLinks,
                { text: 'Панель мониторинга', url: 'https://monitoring.example.com' },
                { text: 'Логи системы', url: 'https://logs.example.com' }
            ];
        }

        if (userType === 'authorized') {
            return [
                ...baseLinks,
                { text: 'Документация', url: 'https://docs.example.com' },
                { text: 'FAQ', url: 'https://faq.example.com' }
            ];
        }

        return baseLinks;
    }

    /**
     * Форматировать шаблон с подстановкой переменных
     * @param {string} template - Шаблон сообщения
     * @param {Object} variables - Переменные для подстановки
     * @returns {string} - Форматированное сообщение
     */
    formatTemplate(template, variables) {
        let formatted = template;
        
        Object.keys(variables).forEach(key => {
            const placeholder = `{${key}}`;
            formatted = formatted.replace(new RegExp(placeholder, 'g'), variables[key]);
        });
        
        return formatted;
    }

    /**
     * Форматировать дату для отображения
     * @param {Date} date - Дата для форматирования
     * @returns {string} - Форматированная дата
     */
    formatDate(date) {
        if (!date) return 'неизвестно';
        
        const now = new Date();
        const diffInHours = Math.abs(now - date) / 36e5;
        
        if (diffInHours < 1) {
            return 'только что';
        } else if (diffInHours < 24) {
            return `${Math.floor(diffInHours)} ч. назад`;
        } else if (diffInHours < 48) {
            return 'вчера';
        } else {
            return date.toLocaleDateString('ru-RU');
        }
    }

    /**
     * Получить мотивационное сообщение
     * @param {string} userType - Тип пользователя
     * @returns {string} - Мотивационное сообщение
     */
    getMotivationalMessage(userType) {
        const messages = {
            admin: [
                '🌟 Отличная работа в управлении сообществом!',
                '💪 Ваше лидерство делает систему лучше!',
                '🎯 Продолжайте развивать проект!'
            ],
            authorized: [
                '🎉 Рады видеть вас в нашем сообществе!',
                '✨ Используйте все возможности системы!',
                '🚀 Развивайтесь вместе с нами!'
            ],
            unauthorized: [
                '🌟 Присоединяйтесь к нашему сообществу!',
                '🔓 Авторизация откроет новые возможности!',
                '💫 Мы ждем вас в нашей команде!'
            ]
        };

        const userMessages = messages[userType] || messages.unauthorized;
        return userMessages[Math.floor(Math.random() * userMessages.length)];
    }

    /**
     * Получить подсказки по использованию
     * @param {string} userType - Тип пользователя
     * @returns {Array} - Массив подсказок
     */
    getUsageTips(userType) {
        const tips = {
            admin: [
                '💡 Используйте /stats для быстрого просмотра статистики',
                '🔔 Настройте уведомления о новых заявках',
                '💾 Регулярно создавайте резервные копии'
            ],
            authorized: [
                '📱 Настройте уведомления в разделе "Настройки"',
                '👤 Обновите информацию в профиле',
                '📋 Изучите раздел FAQ для ответов на вопросы'
            ],
            unauthorized: [
                '📝 Подготовьте никнейм в формате Name_Surname',
                '📷 Сделайте скриншот команд /fam и /time',
                '⏰ Заявки рассматриваются в течение 24 часов'
            ]
        };

        return tips[userType] || tips.unauthorized;
    }
}

module.exports = ContentProvider;