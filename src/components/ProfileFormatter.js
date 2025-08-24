/**
 * ProfileFormatter Component
 * Formats beautiful profile messages with status-specific layouts and interactive keyboards
 */

class ProfileFormatter {
    constructor() {
        // Emoji constants for consistent styling
        this.emojis = {
            crown: '👑',
            check: '✅',
            lock: '🔒',
            person: '👤',
            chart: '📊',
            calendar: '📅',
            clock: '🕐',
            star: '⭐',
            shield: '🛡️',
            key: '🔑',
            arrow: '➤',
            dot: '•',
            branch: '├──',
            lastBranch: '└──'
        };
    }

    /**
     * Format complete profile message
     * @param {Object} profileData - Complete profile data from UserDataRetriever
     * @returns {Object} Formatted message and keyboard
     */
    formatProfileMessage(profileData) {
        try {
            const message = this.buildProfileMessage(profileData);
            const keyboard = this.buildInteractiveKeyboard(profileData);

            return {
                message,
                keyboard,
                parseMode: 'HTML'
            };
        } catch (error) {
            throw new Error(`Failed to format profile message: ${error.message}`);
        }
    }

    /**
     * Build the main profile message
     * @param {Object} profileData - Profile data
     * @returns {string} Formatted message
     */
    buildProfileMessage(profileData) {
        const header = this.formatProfileHeader(profileData);
        const personalInfo = this.formatPersonalInformation(profileData);
        const statusInfo = this.formatStatusInformation(profileData);
        const specificInfo = this.formatStatusSpecificInfo(profileData);

        return [
            header,
            '',
            personalInfo,
            '',
            statusInfo,
            '',
            specificInfo
        ].join('\n');
    }

    /**
     * Format profile header with status badge and name
     * @param {Object} profileData - Profile data
     * @returns {string} Formatted header
     */
    formatProfileHeader(profileData) {
        const { statusInfo } = profileData;
        const displayName = this.getDisplayName(profileData);
        
        return [
            `${statusInfo.emoji} <b>${displayName}</b>`,
            `${statusInfo.badge}`
        ].join('\n');
    }

    /**
     * Format personal information section
     * @param {Object} profileData - Profile data
     * @returns {string} Formatted personal information
     */
    formatPersonalInformation(profileData) {
        const username = this.getUsername(profileData);
        const fullName = this.getFullName(profileData);
        const language = this.getLanguageDisplay(profileData.language_code);
        const memberSince = profileData.memberSince;

        return [
            `${this.emojis.person} <b>Личная информация</b>`,
            `${this.emojis.branch} Имя: ${fullName}`,
            `${this.emojis.branch} Username: ${username}`,
            `${this.emojis.branch} Язык: ${language}`,
            `${this.emojis.lastBranch} Участник с: ${memberSince}`
        ].join('\n');
    }

    /**
     * Format status information section
     * @param {Object} profileData - Profile data
     * @returns {string} Formatted status information
     */
    formatStatusInformation(profileData) {
        const { statusInfo, profileCompleteness, lastActivity } = profileData;

        return [
            `${this.emojis.chart} <b>Статус профиля</b>`,
            `${this.emojis.branch} Уровень доступа: ${statusInfo.level}`,
            `${this.emojis.branch} Заполненность профиля: ${profileCompleteness}%`,
            `${this.emojis.lastBranch} Последняя активность: ${lastActivity}`
        ].join('\n');
    }

    /**
     * Format status-specific information
     * @param {Object} profileData - Profile data
     * @returns {string} Formatted status-specific information
     */
    formatStatusSpecificInfo(profileData) {
        const { statusInfo, isAdmin, authRequest } = profileData;

        switch (statusInfo.type) {
            case 'admin':
                return this.formatAdminInfo();
            case 'authorized':
                return this.formatAuthorizedInfo();
            case 'unauthorized':
                return this.formatUnauthorizedInfo(authRequest);
            default:
                return '';
        }
    }

    /**
     * Format admin-specific information
     * @returns {string} Formatted admin info
     */
    formatAdminInfo() {
        return [
            `${this.emojis.crown} <b>Административные привилегии</b>`,
            `${this.emojis.branch} Управление пользователями`,
            `${this.emojis.branch} Просмотр заявок на авторизацию`,
            `${this.emojis.branch} Доступ к аналитике`,
            `${this.emojis.lastBranch} Системные настройки`
        ].join('\n');
    }

    /**
     * Format authorized user information
     * @returns {string} Formatted authorized user info
     */
    formatAuthorizedInfo() {
        return [
            `${this.emojis.check} <b>Права доступа</b>`,
            `${this.emojis.branch} Полный доступ к боту`,
            `${this.emojis.branch} Использование всех команд`,
            `${this.emojis.lastBranch} Участие в активностях`
        ].join('\n');
    }

    /**
     * Format unauthorized user information
     * @param {Object} authRequest - Authorization request data
     * @returns {string} Formatted unauthorized user info
     */
    formatUnauthorizedInfo(authRequest) {
        const requestStatus = this.formatAuthRequestStatus(authRequest);
        
        return [
            `${this.emojis.lock} <b>Статус авторизации</b>`,
            `${this.emojis.branch} Ограниченный доступ`,
            `${this.emojis.branch} Подача заявки: ${requestStatus}`,
            `${this.emojis.lastBranch} Необходима авторизация`
        ].join('\n');
    }

    /**
     * Format authorization request status
     * @param {Object} authRequest - Authorization request data
     * @returns {string} Formatted request status
     */
    formatAuthRequestStatus(authRequest) {
        if (!authRequest.hasRequest) {
            return 'Не подана';
        }

        const statusMap = {
            'pending': 'Ожидает рассмотрения',
            'approved': 'Одобрена',
            'rejected': 'Отклонена',
            'none': 'Не подана'
        };

        return statusMap[authRequest.status] || 'Неизвестно';
    }

    /**
     * Build interactive keyboard based on user status
     * @param {Object} profileData - Profile data
     * @returns {Object} Telegram inline keyboard
     */
    buildInteractiveKeyboard(profileData) {
        const { statusInfo, isAdmin } = profileData;
        const keyboard = [];

        switch (statusInfo.type) {
            case 'admin':
                keyboard.push(
                    [
                        { text: '👥 Управление пользователями', callback_data: 'admin_users' },
                        { text: '📊 Аналитика', callback_data: 'admin_analytics' }
                    ],
                    [
                        { text: '⚙️ Настройки', callback_data: 'admin_settings' },
                        { text: '🔄 Обновить профиль', callback_data: 'refresh_profile' }
                    ]
                );
                break;

            case 'authorized':
                keyboard.push(
                    [
                        { text: '📝 Редактировать профиль', callback_data: 'edit_profile' },
                        { text: '📊 Моя статистика', callback_data: 'my_stats' }
                    ],
                    [
                        { text: '🔔 Уведомления', callback_data: 'notifications' },
                        { text: '🔄 Обновить профиль', callback_data: 'refresh_profile' }
                    ]
                );
                break;

            case 'unauthorized':
            default:
                keyboard.push(
                    [
                        { text: '🔐 Подать заявку', callback_data: 'submit_auth_request' },
                        { text: '📋 Статус заявки', callback_data: 'check_auth_status' }
                    ],
                    [
                        { text: '❓ Помощь', callback_data: 'help' },
                        { text: '🔄 Обновить профиль', callback_data: 'refresh_profile' }
                    ]
                );
                break;
        }

        return {
            inline_keyboard: keyboard
        };
    }

    /**
     * Get display name with fallbacks
     * @param {Object} profileData - Profile data
     * @returns {string} Display name
     */
    getDisplayName(profileData) {
        if (profileData.first_name || profileData.last_name) {
            const parts = [];
            if (profileData.first_name) parts.push(profileData.first_name);
            if (profileData.last_name) parts.push(profileData.last_name);
            return parts.join(' ');
        }
        
        if (profileData.username) {
            return `@${profileData.username}`;
        }
        
        return `Пользователь ${profileData.telegram_id}`;
    }

    /**
     * Get username with @ prefix or fallback
     * @param {Object} profileData - Profile data
     * @returns {string} Username or fallback
     */
    getUsername(profileData) {
        return profileData.username ? `@${profileData.username}` : '<i>Не указан</i>';
    }

    /**
     * Get full name or fallback
     * @param {Object} profileData - Profile data
     * @returns {string} Full name or fallback
     */
    getFullName(profileData) {
        const parts = [];
        if (profileData.first_name) parts.push(profileData.first_name);
        if (profileData.last_name) parts.push(profileData.last_name);
        
        return parts.length > 0 ? parts.join(' ') : '<i>Не указано</i>';
    }

    /**
     * Get language display name
     * @param {string} languageCode - Language code
     * @returns {string} Language display name
     */
    getLanguageDisplay(languageCode) {
        const languages = {
            'ru': '🇷🇺 Русский',
            'en': '🇺🇸 English',
            'uk': '🇺🇦 Українська',
            'be': '🇧🇾 Беларуская',
            'kk': '🇰🇿 Қазақша'
        };
        
        return languages[languageCode] || `${languageCode || '<i>Не указан</i>'}`;
    }

    /**
     * Format profile completeness with visual indicator
     * @param {number} completeness - Completeness percentage
     * @returns {string} Formatted completeness with progress bar
     */
    formatProfileCompleteness(completeness) {
        const filled = Math.floor(completeness / 10);
        const empty = 10 - filled;
        const progressBar = '█'.repeat(filled) + '░'.repeat(empty);
        
        return `${completeness}% [${progressBar}]`;
    }

    /**
     * Create a simple text-only profile for fallback
     * @param {Object} profileData - Profile data
     * @returns {string} Simple profile text
     */
    formatSimpleProfile(profileData) {
        const { statusInfo } = profileData;
        const displayName = this.getDisplayName(profileData);
        
        return [
            `${statusInfo.emoji} ${displayName}`,
            `Статус: ${statusInfo.badge}`,
            `Уровень: ${statusInfo.level}`,
            `Участник с: ${profileData.memberSince}`,
            `Последняя активность: ${profileData.lastActivity}`
        ].join('\n');
    }

    /**
     * Format error message for profile display
     * @param {string} errorMessage - Error message
     * @returns {string} Formatted error message
     */
    formatErrorMessage(errorMessage) {
        return [
            '❌ <b>Ошибка загрузки профиля</b>',
            '',
            `Причина: ${errorMessage}`,
            '',
            'Попробуйте позже или обратитесь к администратору.'
        ].join('\n');
    }

    /**
     * Get profile statistics for display
     * @param {Object} profileData - Profile data
     * @returns {Object} Profile statistics
     */
    getProfileStats(profileData) {
        return {
            completeness: profileData.profileCompleteness,
            fieldsCompleted: Math.floor(profileData.profileCompleteness / 20),
            totalFields: 5,
            hasAvatar: !!profileData.first_name,
            hasUsername: !!profileData.username,
            memberDays: this.calculateMemberDays(profileData.created_at)
        };
    }

    /**
     * Calculate member days
     * @param {string} createdAt - Creation timestamp
     * @returns {number} Days since creation
     */
    calculateMemberDays(createdAt) {
        if (!createdAt) return 0;
        
        try {
            const created = new Date(createdAt);
            const now = new Date();
            const diffTime = Math.abs(now - created);
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        } catch (error) {
            return 0;
        }
    }
}

module.exports = ProfileFormatter;