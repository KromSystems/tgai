/**
 * UserDataRetriever Component
 * Aggregates user profile data from multiple database sources
 */

const User = require('../database/models/user');
const TelegramModel = require('../database/models/telegram');
const AuthRequest = require('../database/models/authRequest');
const HelpMetrics = require('../database/models/helpMetrics');

class UserDataRetriever {
    constructor(adminId) {
        this.adminId = adminId;
    }

    /**
     * Get complete user profile data
     * @param {number} telegramId - Telegram user ID
     * @returns {Promise<Object>} Complete profile data
     */
    async getUserProfileData(telegramId) {
        try {
            // Get basic user data
            const userData = await this.getUserData(telegramId);
            if (!userData) {
                throw new Error('User not found');
            }

            // Get additional profile data
            const profileData = {
                ...userData,
                isAdmin: telegramId === this.adminId,
                authRequest: await this.getAuthRequestData(telegramId),
                lastActivity: await this.getLastActivity(telegramId),
                memberSince: this.formatMemberSince(userData.created_at),
                profileCompleteness: this.calculateProfileCompleteness(userData),
                statusInfo: this.getStatusInfo(userData, telegramId === this.adminId)
            };

            return profileData;
        } catch (error) {
            throw new Error(`Failed to retrieve user profile data: ${error.message}`);
        }
    }

    /**
     * Get basic user data
     * @param {number} telegramId - Telegram user ID
     * @returns {Promise<Object|null>} User data
     */
    async getUserData(telegramId) {
        try {
            let user = await User.findByTelegramId(telegramId);
            
            // If user doesn't exist, try to find in telegram table
            if (!user) {
                const telegramUser = await TelegramModel.findByTelegramId(telegramId);
                if (telegramUser) {
                    // Create user record from telegram data
                    user = await User.create({
                        telegram_id: telegramId,
                        username: telegramUser.username,
                        first_name: telegramUser.first_name,
                        last_name: telegramUser.last_name,
                        authorized: 0
                    });
                }
            }

            return user ? user.toJSON() : null;
        } catch (error) {
            throw new Error(`Failed to get user data: ${error.message}`);
        }
    }

    /**
     * Get authorization request data for unauthorized users
     * @param {number} telegramId - Telegram user ID
     * @returns {Promise<Object|null>} Authorization request data
     */
    async getAuthRequestData(telegramId) {
        try {
            const authRequest = await AuthRequest.findByTelegramId(telegramId, 'pending');
            return authRequest ? {
                status: authRequest.status,
                submittedAt: authRequest.submitted_at,
                hasRequest: true
            } : {
                status: 'none',
                submittedAt: null,
                hasRequest: false
            };
        } catch (error) {
            console.error('Error getting auth request data:', error);
            return {
                status: 'unknown',
                submittedAt: null,
                hasRequest: false
            };
        }
    }

    /**
     * Get user's last activity timestamp
     * @param {number} telegramId - Telegram user ID
     * @returns {Promise<string>} Formatted last activity
     */
    async getLastActivity(telegramId) {
        try {
            // Get the most recent help metrics entry
            const recentActivity = await HelpMetrics.findRecentByTelegramId(telegramId);
            
            if (recentActivity) {
                return this.formatLastActivity(recentActivity.created_at);
            }

            // Fallback to user update time
            const user = await User.findByTelegramId(telegramId);
            if (user && user.updated_at) {
                return this.formatLastActivity(user.updated_at);
            }

            return 'Неизвестно';
        } catch (error) {
            console.error('Error getting last activity:', error);
            return 'Неизвестно';
        }
    }

    /**
     * Calculate profile completeness percentage
     * @param {Object} userData - User data
     * @returns {number} Completeness percentage (0-100)
     */
    calculateProfileCompleteness(userData) {
        const fields = [
            'telegram_id',
            'username',
            'first_name',
            'last_name',
            'language_code'
        ];

        const completedFields = fields.filter(field => {
            const value = userData[field];
            return value !== null && value !== undefined && value !== '';
        });

        return Math.round((completedFields.length / fields.length) * 100);
    }

    /**
     * Get status information based on user type
     * @param {Object} userData - User data
     * @param {boolean} isAdmin - Whether user is admin
     * @returns {Object} Status information
     */
    getStatusInfo(userData, isAdmin) {
        if (isAdmin) {
            return {
                type: 'admin',
                badge: '👑 Лидер',
                emoji: '👑',
                level: 'Администратор',
                description: 'Полные административные права'
            };
        } else if (userData.authorized === 1) {
            return {
                type: 'authorized',
                badge: '✅ Авторизован',
                emoji: '✅',
                level: 'Авторизованный пользователь',
                description: 'Полный доступ к функциям бота'
            };
        } else {
            return {
                type: 'unauthorized',
                badge: '🔒 Не авторизован',
                emoji: '🔒',
                level: 'Новичок',
                description: 'Ограниченный доступ'
            };
        }
    }

    /**
     * Format member since date
     * @param {string} createdAt - User creation timestamp
     * @returns {string} Formatted date
     */
    formatMemberSince(createdAt) {
        if (!createdAt) return 'Неизвестно';

        try {
            const date = new Date(createdAt);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 1) {
                return 'Сегодня';
            } else if (diffDays === 1) {
                return 'Вчера';
            } else if (diffDays < 7) {
                return `${diffDays} дней назад`;
            } else if (diffDays < 30) {
                const weeks = Math.floor(diffDays / 7);
                return `${weeks} ${weeks === 1 ? 'неделю' : 'недель'} назад`;
            } else if (diffDays < 365) {
                const months = Math.floor(diffDays / 30);
                return `${months} ${months === 1 ? 'месяц' : 'месяцев'} назад`;
            } else {
                const years = Math.floor(diffDays / 365);
                return `${years} ${years === 1 ? 'год' : 'лет'} назад`;
            }
        } catch (error) {
            console.error('Error formatting member since date:', error);
            return 'Неизвестно';
        }
    }

    /**
     * Format last activity timestamp
     * @param {string} timestamp - Activity timestamp
     * @returns {string} Formatted last activity
     */
    formatLastActivity(timestamp) {
        if (!timestamp) return 'Неизвестно';

        try {
            const date = new Date(timestamp);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffMinutes = Math.floor(diffTime / (1000 * 60));
            const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffMinutes < 1) {
                return 'Только что';
            } else if (diffMinutes < 60) {
                return `${diffMinutes} мин назад`;
            } else if (diffHours < 24) {
                return `${diffHours} ч назад`;
            } else if (diffDays < 7) {
                return `${diffDays} дн назад`;
            } else {
                return date.toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            }
        } catch (error) {
            console.error('Error formatting last activity:', error);
            return 'Неизвестно';
        }
    }

    /**
     * Get user display name with fallbacks
     * @param {Object} userData - User data
     * @returns {string} Display name
     */
    getDisplayName(userData) {
        if (userData.first_name || userData.last_name) {
            const parts = [];
            if (userData.first_name) parts.push(userData.first_name);
            if (userData.last_name) parts.push(userData.last_name);
            return parts.join(' ');
        }
        
        if (userData.username) {
            return `@${userData.username}`;
        }
        
        return `Пользователь ${userData.telegram_id}`;
    }

    /**
     * Get username with @ prefix or fallback
     * @param {Object} userData - User data
     * @returns {string} Username or fallback
     */
    getUsername(userData) {
        return userData.username ? `@${userData.username}` : 'Не указан';
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
        
        return languages[languageCode] || `${languageCode || 'Не указан'}`;
    }
}

module.exports = UserDataRetriever;