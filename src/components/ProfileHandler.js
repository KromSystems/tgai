/**
 * ProfileHandler Component
 * Main orchestrator for the /profile command functionality
 */

const UserDataRetriever = require('./UserDataRetriever');
const ImageSelector = require('./ImageSelector');
const ProfileFormatter = require('./ProfileFormatter');

class ProfileHandler {
    constructor(adminId) {
        this.adminId = adminId;
        this.userDataRetriever = new UserDataRetriever(adminId);
        this.imageSelector = new ImageSelector();
        this.profileFormatter = new ProfileFormatter();
        
        // Initialize and validate image selector
        this.validateComponents();
    }

    /**
     * Validate all components are properly initialized
     */
    validateComponents() {
        try {
            // Validate image selector has all required images
            const healthCheck = this.imageSelector.getHealthCheck();
            if (!healthCheck.overall) {
                console.warn('Some profile images are missing or invalid:', healthCheck);
            }
            
            console.log('ProfileHandler initialized successfully');
        } catch (error) {
            console.error('Error initializing ProfileHandler:', error);
            throw error;
        }
    }

    /**
     * Handle /profile command
     * @param {Object} msg - Telegram message object
     * @param {Object} bot - Telegram bot instance
     * @returns {Promise<void>}
     */
    async handleProfileCommand(msg, bot) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;

        try {
            console.log(`Processing /profile command for user ${telegramId}`);

            // Send typing indicator
            await bot.sendChatAction(chatId, 'typing');

            // Get complete profile data
            const profileData = await this.userDataRetriever.getUserProfileData(telegramId);
            
            // Format profile message and keyboard
            const formattedProfile = this.profileFormatter.formatProfileMessage(profileData);
            
            // Get profile image
            const imageStream = this.imageSelector.getImageStream(profileData.statusInfo);
            
            // Send profile with image
            await bot.sendPhoto(chatId, imageStream, {
                caption: formattedProfile.message,
                parse_mode: formattedProfile.parseMode,
                reply_markup: formattedProfile.keyboard
            });

            console.log(`Profile successfully sent for user ${telegramId}`);

        } catch (error) {
            console.error(`Error handling profile command for user ${telegramId}:`, error);
            await this.handleProfileError(chatId, telegramId, error, bot);
        }
    }

    /**
     * Handle profile refresh from callback query
     * @param {Object} callbackQuery - Telegram callback query object
     * @param {Object} bot - Telegram bot instance
     * @returns {Promise<void>}
     */
    async handleProfileRefresh(callbackQuery, bot) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const telegramId = callbackQuery.from.id;

        try {
            console.log(`Processing profile refresh for user ${telegramId}`);

            // Answer callback query to remove loading state
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Обновляю профиль...'
            });

            // Send typing indicator
            await bot.sendChatAction(chatId, 'typing');

            // Get fresh profile data
            const profileData = await this.userDataRetriever.getUserProfileData(telegramId);
            
            // Format updated profile message and keyboard
            const formattedProfile = this.profileFormatter.formatProfileMessage(profileData);
            
            // Get profile image
            const imageStream = this.imageSelector.getImageStream(profileData.statusInfo);

            // Delete old message and send new one
            await bot.deleteMessage(chatId, messageId);
            
            await bot.sendPhoto(chatId, imageStream, {
                caption: formattedProfile.message,
                parse_mode: formattedProfile.parseMode,
                reply_markup: formattedProfile.keyboard
            });

            console.log(`Profile refreshed successfully for user ${telegramId}`);

        } catch (error) {
            console.error(`Error refreshing profile for user ${telegramId}:`, error);
            
            // Try to answer callback query with error
            try {
                await bot.answerCallbackQuery(callbackQuery.id, {
                    text: 'Ошибка обновления профиля',
                    show_alert: true
                });
            } catch (cbError) {
                console.error('Error answering callback query:', cbError);
            }

            await this.handleProfileError(chatId, telegramId, error, bot);
        }
    }

    /**
     * Handle profile errors with fallback options
     * @param {number} chatId - Chat ID
     * @param {number} telegramId - Telegram user ID
     * @param {Error} error - Error object
     * @param {Object} bot - Telegram bot instance
     * @returns {Promise<void>}
     */
    async handleProfileError(chatId, telegramId, error, bot) {
        try {
            console.log(`Handling profile error for user ${telegramId}:`, error.message);

            // Try to get basic user data for fallback
            let fallbackMessage;
            
            try {
                const basicUserData = await this.userDataRetriever.getUserData(telegramId);
                if (basicUserData) {
                    // Create minimal profile data
                    const minimalProfileData = {
                        ...basicUserData,
                        statusInfo: this.userDataRetriever.getStatusInfo(basicUserData, telegramId === this.adminId),
                        memberSince: this.userDataRetriever.formatMemberSince(basicUserData.created_at),
                        lastActivity: 'Неизвестно'
                    };
                    
                    fallbackMessage = this.profileFormatter.formatSimpleProfile(minimalProfileData);
                } else {
                    fallbackMessage = this.profileFormatter.formatErrorMessage('Пользователь не найден');
                }
            } catch (fallbackError) {
                console.error('Error creating fallback profile:', fallbackError);
                fallbackMessage = this.profileFormatter.formatErrorMessage('Временная ошибка сервера');
            }

            // Send fallback message without image
            await bot.sendMessage(chatId, fallbackMessage, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔄 Попробовать снова', callback_data: 'refresh_profile' },
                        { text: '❓ Помощь', callback_data: 'help' }
                    ]]
                }
            });

        } catch (fallbackError) {
            console.error(`Critical error handling profile error for user ${telegramId}:`, fallbackError);
            
            // Last resort - send plain text error
            try {
                await bot.sendMessage(chatId, 
                    '❌ Произошла ошибка при загрузке профиля. Попробуйте позже или обратитесь к администратору.'
                );
            } catch (criticalError) {
                console.error('Critical error sending fallback message:', criticalError);
            }
        }
    }

    /**
     * Get profile preview for other commands
     * @param {number} telegramId - Telegram user ID
     * @returns {Promise<Object>} Profile preview data
     */
    async getProfilePreview(telegramId) {
        try {
            const profileData = await this.userDataRetriever.getUserProfileData(telegramId);
            
            return {
                displayName: this.profileFormatter.getDisplayName(profileData),
                statusBadge: profileData.statusInfo.badge,
                statusEmoji: profileData.statusInfo.emoji,
                level: profileData.statusInfo.level,
                isAuthorized: profileData.authorized === 1,
                isAdmin: telegramId === this.adminId
            };
        } catch (error) {
            console.error(`Error getting profile preview for user ${telegramId}:`, error);
            return {
                displayName: `Пользователь ${telegramId}`,
                statusBadge: '❓ Неизвестно',
                statusEmoji: '❓',
                level: 'Неизвестно',
                isAuthorized: false,
                isAdmin: false,
                error: error.message
            };
        }
    }

    /**
     * Validate user can access profile feature
     * @param {number} telegramId - Telegram user ID
     * @returns {Promise<boolean>} Whether user can access profile
     */
    async canAccessProfile(telegramId) {
        try {
            const userData = await this.userDataRetriever.getUserData(telegramId);
            return userData !== null;
        } catch (error) {
            console.error(`Error checking profile access for user ${telegramId}:`, error);
            return false;
        }
    }

    /**
     * Get profile statistics for admin
     * @returns {Promise<Object>} Profile statistics
     */
    async getProfileStats() {
        try {
            // This would require additional database queries
            // For now, return basic stats structure
            return {
                totalProfiles: 0,
                adminProfiles: 0,
                authorizedProfiles: 0,
                unauthorizedProfiles: 0,
                recentActivity: 0
            };
        } catch (error) {
            console.error('Error getting profile statistics:', error);
            throw error;
        }
    }

    /**
     * Handle profile-related callback queries
     * @param {Object} callbackQuery - Telegram callback query object
     * @param {Object} bot - Telegram bot instance
     * @returns {Promise<boolean>} Whether callback was handled
     */
    async handleProfileCallback(callbackQuery, bot) {
        const { data } = callbackQuery;

        try {
            switch (data) {
                case 'refresh_profile':
                    await this.handleProfileRefresh(callbackQuery, bot);
                    return true;

                case 'edit_profile':
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: 'Функция редактирования профиля в разработке',
                        show_alert: true
                    });
                    return true;

                case 'my_stats':
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: 'Статистика пользователя в разработке',
                        show_alert: true
                    });
                    return true;

                case 'notifications':
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: 'Настройки уведомлений в разработке',
                        show_alert: true
                    });
                    return true;

                default:
                    return false;
            }
        } catch (error) {
            console.error('Error handling profile callback:', error);
            
            try {
                await bot.answerCallbackQuery(callbackQuery.id, {
                    text: 'Произошла ошибка',
                    show_alert: true
                });
            } catch (cbError) {
                console.error('Error answering callback query:', cbError);
            }
            
            return false;
        }
    }

    /**
     * Get component health status
     * @returns {Object} Health status of all components
     */
    getHealthStatus() {
        try {
            const imageHealth = this.imageSelector.getHealthCheck();
            
            return {
                overall: imageHealth.overall,
                components: {
                    userDataRetriever: {
                        status: 'healthy',
                        adminId: this.adminId
                    },
                    imageSelector: imageHealth,
                    profileFormatter: {
                        status: 'healthy'
                    }
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                overall: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = ProfileHandler;