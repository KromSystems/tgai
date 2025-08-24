/**
 * UserTypeDetector - определитель типа пользователя для команды /help
 * Анализирует статус авторизации и права доступа
 */

class UserTypeDetector {
    constructor(adminId) {
        this.adminId = adminId;
    }

    /**
     * Определить тип пользователя
     * @param {number} telegramId - Telegram ID пользователя
     * @param {Object} user - Объект пользователя из БД
     * @returns {string} - Тип пользователя: 'admin', 'authorized', 'unauthorized'
     */
    detectUserType(telegramId, user) {
        // Проверка администратора
        if (this.isAdmin(telegramId)) {
            return 'admin';
        }

        // Проверка авторизованного пользователя
        if (user && user.isAuthorized()) {
            return 'authorized';
        }

        // Неавторизованный пользователь
        return 'unauthorized';
    }

    /**
     * Проверить, является ли пользователь администратором
     * @param {number} telegramId - Telegram ID пользователя
     * @returns {boolean}
     */
    isAdmin(telegramId) {
        return telegramId === this.adminId;
    }

    /**
     * Проверить, является ли пользователь авторизованным
     * @param {Object} user - Объект пользователя из БД
     * @returns {boolean}
     */
    isAuthorized(user) {
        return user && user.isAuthorized();
    }

    /**
     * Получить права доступа пользователя
     * @param {string} userType - Тип пользователя
     * @returns {Object} - Объект с правами доступа
     */
    getUserPermissions(userType) {
        const permissions = {
            admin: {
                canViewAdminPanel: true,
                canManageUsers: true,
                canViewStatistics: true,
                canChangeSettings: true,
                canAccessBackup: true,
                canViewAllRequests: true,
                canApproveRequests: true,
                canBlockUsers: true,
                level: 'admin'
            },
            authorized: {
                canViewAdminPanel: false,
                canManageUsers: false,
                canViewStatistics: false,
                canChangeSettings: false,
                canAccessBackup: false,
                canViewAllRequests: false,
                canApproveRequests: false,
                canBlockUsers: false,
                canEditProfile: true,
                canViewHistory: true,
                canContactSupport: true,
                level: 'user'
            },
            unauthorized: {
                canViewAdminPanel: false,
                canManageUsers: false,
                canViewStatistics: false,
                canChangeSettings: false,
                canAccessBackup: false,
                canViewAllRequests: false,
                canApproveRequests: false,
                canBlockUsers: false,
                canEditProfile: false,
                canViewHistory: false,
                canContactSupport: true,
                canRequestAuth: true,
                canViewPublicInfo: true,
                level: 'guest'
            }
        };

        return permissions[userType] || permissions.unauthorized;
    }

    /**
     * Проверить доступ к функции
     * @param {string} userType - Тип пользователя
     * @param {string} action - Действие для проверки
     * @returns {boolean}
     */
    hasPermission(userType, action) {
        const permissions = this.getUserPermissions(userType);
        return permissions[action] || false;
    }

    /**
     * Получить список доступных разделов меню
     * @param {string} userType - Тип пользователя
     * @returns {Array} - Массив доступных разделов
     */
    getAvailableMenuSections(userType) {
        const sections = {
            admin: [
                'main',
                'admin_users',
                'admin_stats', 
                'admin_settings',
                'admin_notifications',
                'admin_requests',
                'admin_blocks',
                'admin_backup'
            ],
            authorized: [
                'main',
                'user_profile',
                'user_settings',
                'user_history',
                'user_news',
                'user_faq',
                'user_support'
            ],
            unauthorized: [
                'main',
                'guest_about',
                'guest_rules',
                'guest_contacts',
                'guest_faq',
                'guest_auth_info'
            ]
        };

        return sections[userType] || sections.unauthorized;
    }

    /**
     * Получить название уровня доступа
     * @param {string} userType - Тип пользователя
     * @returns {string} - Человекочитаемое название уровня
     */
    getUserLevelName(userType) {
        const levelNames = {
            admin: 'Администратор',
            authorized: 'Авторизованный пользователь',
            unauthorized: 'Гость'
        };

        return levelNames[userType] || 'Неизвестный';
    }

    /**
     * Получить иконку для типа пользователя
     * @param {string} userType - Тип пользователя
     * @returns {string} - Эмодзи иконка
     */
    getUserIcon(userType) {
        const icons = {
            admin: '👑',
            authorized: '✅',
            unauthorized: '🔒'
        };

        return icons[userType] || '❓';
    }

    /**
     * Проверить, нужно ли показывать предупреждения
     * @param {string} userType - Тип пользователя
     * @param {string} targetSection - Целевой раздел
     * @returns {Object} - Информация о предупреждении
     */
    checkAccessWarning(userType, targetSection) {
        const permissions = this.getUserPermissions(userType);
        
        // Список защищенных разделов и необходимых прав
        const protectedSections = {
            'admin_users': 'canManageUsers',
            'admin_stats': 'canViewStatistics',
            'admin_settings': 'canChangeSettings',
            'admin_backup': 'canAccessBackup',
            'user_profile': 'canEditProfile',
            'user_history': 'canViewHistory'
        };

        const requiredPermission = protectedSections[targetSection];
        
        if (requiredPermission && !permissions[requiredPermission]) {
            return {
                hasWarning: true,
                message: this.getAccessDeniedMessage(userType, targetSection),
                suggestedAction: this.getSuggestedAction(userType)
            };
        }

        return {
            hasWarning: false,
            message: null,
            suggestedAction: null
        };
    }

    /**
     * Получить сообщение об отказе в доступе
     * @param {string} userType - Тип пользователя
     * @param {string} section - Раздел
     * @returns {string} - Сообщение об ошибке
     */
    getAccessDeniedMessage(userType, section) {
        if (userType === 'unauthorized') {
            return '🔒 Этот раздел доступен только авторизованным пользователям.\n\nПожалуйста, пройдите авторизацию для получения доступа.';
        }

        if (userType === 'authorized' && section.startsWith('admin_')) {
            return '👑 Этот раздел доступен только администраторам.\n\nОбратитесь к администратору, если у вас есть вопросы.';
        }

        return '❌ У вас нет доступа к этому разделу.';
    }

    /**
     * Получить рекомендуемое действие
     * @param {string} userType - Тип пользователя
     * @returns {string} - Рекомендуемое действие
     */
    getSuggestedAction(userType) {
        const actions = {
            unauthorized: 'Подайте заявку на авторизацию через кнопку "Авторизоваться"',
            authorized: 'Обратитесь к администратору за дополнительными правами',
            admin: 'У вас есть полный доступ ко всем функциям'
        };

        return actions[userType] || 'Обратитесь за помощью к администратору';
    }
}

module.exports = UserTypeDetector;