/**
 * Main Telegram Bot Application
 * Handles bot initialization, database connection, and message routing
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');

// Import database connection and models
const database = require('./database/connection');
const User = require('./database/models/user');
const TelegramModel = require('./database/models/telegram');
const AuthRequest = require('./database/models/authRequest');
const HelpMetrics = require('./database/models/helpMetrics');

// Import help components
const MenuBuilder = require('./components/MenuBuilder');
const UserTypeDetector = require('./components/UserTypeDetector');
const ContentProvider = require('./components/ContentProvider');
const NavigationManager = require('./components/NavigationManager');

// Bot configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID);

if (!BOT_TOKEN) {
    console.error('BOT_TOKEN is required in .env file');
    process.exit(1);
}

if (!ADMIN_ID) {
    console.error('ADMIN_ID is required in .env file');
    process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Initialize help components
const menuBuilder = new MenuBuilder();
const userTypeDetector = new UserTypeDetector(ADMIN_ID);
const contentProvider = new ContentProvider();
const navigationManager = new NavigationManager(menuBuilder, userTypeDetector, contentProvider);

// Conversation states for authorization flow
const CONVERSATION_STATES = {
    AWAITING_NICKNAME: 'awaiting_nickname',
    AWAITING_PHOTO: 'awaiting_photo',
    PROCESSING: 'processing'
};

// Temporary session storage for user conversations
const userSessions = new Map();

// Session timeout (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Image paths
const IMAGES = {
    LEADER: path.join(__dirname, '..', 'лидер.png'),
    AUTHORIZED: path.join(__dirname, '..', 'авторизованные.png'),
    NEWCOMERS: path.join(__dirname, '..', 'новички.png')
};

// Verify image files exist
Object.entries(IMAGES).forEach(([name, imagePath]) => {
    if (!fs.existsSync(imagePath)) {
        console.error(`Image file not found: ${imagePath}`);
        process.exit(1);
    }
});

/**
 * Initialize database connection and ensure admin user exists
 */
async function initializeDatabase() {
    try {
        await database.connect();
        console.log('Database connected successfully');
        
        // Ensure admin user exists in users table for foreign key references
        await ensureAdminUser();
    } catch (error) {
        console.error('Failed to connect to database:', error);
        process.exit(1);
    }
}

/**
 * Ensure admin user exists in users table for foreign key references
 */
async function ensureAdminUser() {
    try {
        // Check if admin user exists in users table
        let adminUser = await User.findByTelegramId(ADMIN_ID);
        
        if (!adminUser) {
            console.log(`Creating admin user record for ID: ${ADMIN_ID}`);
            // Create admin user record
            adminUser = await User.create({
                telegram_id: ADMIN_ID,
                username: 'admin',
                first_name: 'Admin',
                last_name: 'Bot',
                authorized: 1
            });
            console.log(`Admin user created in users table with ID: ${adminUser.id}`);
        } else {
            console.log(`Admin user already exists in users table with ID: ${adminUser.id}`);
            // Ensure admin is authorized
            if (!adminUser.isAuthorized()) {
                await adminUser.setAuthorized(1);
                console.log('Admin authorization status updated');
            }
        }
        
        return adminUser;
    } catch (error) {
        console.error('Error ensuring admin user exists:', error);
        throw error;
    }
}

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions() {
    const now = Date.now();
    for (const [telegramId, session] of userSessions.entries()) {
        if (now - session.startTime > SESSION_TIMEOUT) {
            userSessions.delete(telegramId);
            console.log(`Cleaned up expired session for user ${telegramId}`);
        }
    }
}

/**
 * Set up session cleanup interval
 */
setInterval(cleanupExpiredSessions, 5 * 60 * 1000); // Clean up every 5 minutes

/**
 * Validate nickname format (Name_Surname)
 * @param {string} nickname - Nickname to validate
 * @returns {boolean}
 */
function validateNickname(nickname) {
    const nicknameRegex = /^[A-Za-zА-Яа-я]+_[A-Za-zА-Яа-я]+$/;
    return nicknameRegex.test(nickname);
}

/**
 * Save photo file from Telegram
 * @param {string} fileId - Telegram file ID
 * @param {number} telegramId - User's Telegram ID
 * @returns {Promise<string>} - Path to saved file
 */
async function savePhotoFile(fileId, telegramId) {
    try {
        const file = await bot.getFile(fileId);
        const timestamp = Date.now();
        const fileName = `${timestamp}_${telegramId}.jpg`;
        const photoPath = path.join(__dirname, '..', 'photos', 'auth_requests', fileName);
        
        await bot.downloadFile(fileId, path.dirname(photoPath));
        
        // Rename the file to our desired name
        const downloadedPath = path.join(path.dirname(photoPath), file.file_path.split('/').pop());
        if (downloadedPath !== photoPath) {
            fs.renameSync(downloadedPath, photoPath);
        }
        
        return photoPath;
    } catch (error) {
        throw new Error(`Failed to save photo: ${error.message}`);
    }
}

/**
 * Handle authorization flow start
 */
async function handleAuthorizationStart(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const telegramId = callbackQuery.from.id;
    
    try {
        // Check if user already has pending request
        const existingRequest = await AuthRequest.findByTelegramId(telegramId, 'pending');
        if (existingRequest) {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: 'У вас уже есть ожидающая заявка',
                show_alert: true
            });
            return;
        }
        
        // Start authorization process
        userSessions.set(telegramId, {
            state: CONVERSATION_STATES.AWAITING_NICKNAME,
            startTime: Date.now()
        });
        
        await bot.answerCallbackQuery(callbackQuery.id);
        await bot.sendMessage(chatId, '📝 Введите ваш никнейм в формате Name_Surname\n\nПример: Ivan_Petrov');
        
        console.log(`User ${telegramId} started authorization process`);
    } catch (error) {
        console.error('Error starting authorization:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Произошла ошибка. Попробуйте позже',
            show_alert: true
        });
    }
}

/**
 * Handle nickname input
 */
async function handleNicknameInput(msg) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const nickname = msg.text.trim();
    
    try {
        if (!validateNickname(nickname)) {
            await bot.sendMessage(chatId, '❌ Неверный формат никнейма!\n\nИспользуйте формат: Name_Surname\nПример: Ivan_Petrov');
            return;
        }
        
        // Update session with nickname
        const session = userSessions.get(telegramId);
        session.nickname = nickname;
        session.state = CONVERSATION_STATES.AWAITING_PHOTO;
        userSessions.set(telegramId, session);
        
        await bot.sendMessage(chatId, '✅ Никнейм принят!\n\n📷 Теперь отправьте фотографию (сжатую для Telegram)\n\n📝 Инструкция: напишите /fam, затем /time и отправьте скриншот боту');
        
        console.log(`User ${telegramId} provided nickname: ${nickname}`);
    } catch (error) {
        console.error('Error handling nickname:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
    }
}

/**
 * Handle photo upload
 */
async function handlePhotoUpload(msg) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    
    try {
        const session = userSessions.get(telegramId);
        const nickname = session.nickname;
        
        // Get the largest photo size
        const photo = msg.photo[msg.photo.length - 1];
        const photoPath = await savePhotoFile(photo.file_id, telegramId);
        
        // Get or create user
        const userData = {
            telegram_id: telegramId,
            username: msg.from.username,
            first_name: msg.from.first_name,
            last_name: msg.from.last_name,
            language_code: msg.from.language_code,
            is_bot: msg.from.is_bot || false
        };
        
        const user = await User.findOrCreate(userData);
        
        // Create authorization request
        const authRequest = await AuthRequest.create({
            user_id: user.id,
            telegram_id: telegramId,
            nickname: nickname,
            photo_path: photoPath,
            status: 'pending'
        });
        
        // Update session state
        session.state = CONVERSATION_STATES.PROCESSING;
        userSessions.set(telegramId, session);
        
        // Send notification to admin
        await sendAdminNotification(authRequest);
        
        // Confirm to user
        await bot.sendMessage(chatId, '✅ Данные отправлены на проверку!\n\n🕰️ Ожидайте решения администратора...');
        
        // Clean up session
        userSessions.delete(telegramId);
        
        console.log(`User ${telegramId} submitted authorization request with ID ${authRequest.id}`);
    } catch (error) {
        console.error('Error handling photo upload:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка при сохранении фотографии. Попробуйте позже.');
    }
}

/**
 * Send notification to admin about new authorization request
 */
async function sendAdminNotification(authRequest) {
    try {
        const user = await authRequest.getUser();
        const photoBuffer = fs.readFileSync(authRequest.photo_path);
        
        const keyboard = {
            inline_keyboard: [[
                { text: 'Принять', callback_data: `approve_${authRequest.id}` },
                { text: 'Отказать', callback_data: `reject_${authRequest.id}` }
            ]]
        };
        
        const caption = `📝 Новая заявка от ${authRequest.nickname}\n\n` +
                       `🆔 Telegram ID: ${authRequest.telegram_id}\n` +
                       `👤 Username: ${user.username ? '@' + user.username : 'Не указан'}\n` +
                       `📅 Дата: ${new Date().toLocaleString('ru-RU')}`;
        
        await bot.sendPhoto(ADMIN_ID, photoBuffer, {
            caption: caption,
            reply_markup: keyboard
        });
        
        console.log(`Admin notification sent for request ID ${authRequest.id}`);
    } catch (error) {
        console.error('Error sending admin notification:', error);
        throw error;
    }
}

/**
 * Handle admin approval
 */
async function handleApproval(callbackQuery) {
    const requestId = parseInt(callbackQuery.data.split('_')[1]);
    
    try {
        const authRequest = await AuthRequest.findById(requestId);
        if (!authRequest) {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Заявка не найдена',
                show_alert: true
            });
            return;
        }
        
        if (authRequest.status !== 'pending') {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Заявка уже обработана',
                show_alert: true
            });
            return;
        }
        
        // Get admin user database ID (not Telegram ID)
        const adminUser = await User.findByTelegramId(ADMIN_ID);
        if (!adminUser) {
            throw new Error('Admin user not found in database');
        }
        
        // Update request status with admin user's database ID
        await authRequest.updateStatus('approved', adminUser.id);
        
        // Update user authorization status
        const user = await User.findById(authRequest.user_id);
        await user.setAuthorized(1);
        
        // Notify user about approval
        await bot.sendMessage(authRequest.telegram_id, 
            '✅ Поздравляем! Ваша заявка одобрена!\n\n🎉 Теперь вы авторизованы в системе!');
        
        // Update admin message
        await bot.editMessageCaption(
            `✅ ОДОБРЕНО\n\n${callbackQuery.message.caption}`,
            {
                chat_id: callbackQuery.message.chat.id,
                message_id: callbackQuery.message.message_id,
                reply_markup: { inline_keyboard: [] }
            }
        );
        
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Заявка одобрена!'
        });
        
        console.log(`Admin approved request ID ${requestId}`);
    } catch (error) {
        console.error('Error approving request:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Ошибка при одобрении',
            show_alert: true
        });
    }
}

/**
 * Handle admin rejection
 */
async function handleRejection(callbackQuery) {
    const requestId = parseInt(callbackQuery.data.split('_')[1]);
    
    try {
        const authRequest = await AuthRequest.findById(requestId);
        if (!authRequest) {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Заявка не найдена',
                show_alert: true
            });
            return;
        }
        
        if (authRequest.status !== 'pending') {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Заявка уже обработана',
                show_alert: true
            });
            return;
        }
        
        // Get admin user database ID (not Telegram ID)
        const adminUser = await User.findByTelegramId(ADMIN_ID);
        if (!adminUser) {
            throw new Error('Admin user not found in database');
        }
        
        // Update request status with admin user's database ID
        await authRequest.updateStatus('rejected', adminUser.id);
        
        // Notify user about rejection with option to reapply
        const keyboard = {
            inline_keyboard: [[
                { text: 'Подать заявку повторно', callback_data: 'start_authorization' }
            ]]
        };
        
        await bot.sendMessage(authRequest.telegram_id, 
            '❌ К сожалению, ваша заявка отклонена.\n\nВы можете подать заявку повторно.',
            { reply_markup: keyboard }
        );
        
        // Update admin message
        await bot.editMessageCaption(
            `❌ ОТКЛОНЕНО\n\n${callbackQuery.message.caption}`,
            {
                chat_id: callbackQuery.message.chat.id,
                message_id: callbackQuery.message.message_id,
                reply_markup: { inline_keyboard: [] }
            }
        );
        
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Заявка отклонена'
        });
        
        console.log(`Admin rejected request ID ${requestId}`);
    } catch (error) {
        console.error('Error rejecting request:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Ошибка при отклонении',
            show_alert: true
        });
    }
}

/**
 * Handle /help command
 */
async function handleHelpCommand(msg) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const startTime = Date.now();
    
    const userData = {
        telegram_id: telegramId,
        username: msg.from.username,
        first_name: msg.from.first_name,
        last_name: msg.from.last_name,
        language_code: msg.from.language_code,
        is_bot: msg.from.is_bot || false
    };

    try {
        // Save telegram data
        await TelegramModel.createOrUpdate({
            ...userData,
            is_premium: msg.from.is_premium,
            added_to_attachment_menu: msg.from.added_to_attachment_menu,
            can_join_groups: msg.from.can_join_groups,
            can_read_all_group_messages: msg.from.can_read_all_group_messages,
            supports_inline_queries: msg.from.supports_inline_queries
        });

        // Get or create user
        const user = await User.findOrCreate(userData);
        
        // Determine user type
        const userType = userTypeDetector.detectUserType(telegramId, user);
        
        // Get auth request for unauthorized users
        let authRequest = null;
        if (userType === 'unauthorized') {
            authRequest = await AuthRequest.findByTelegramId(telegramId);
        }
        
        // Build appropriate menu
        let menuData;
        switch (userType) {
            case 'admin':
                menuData = menuBuilder.buildAdminMenu(user);
                break;
            case 'authorized':
                menuData = menuBuilder.buildUserMenu(user);
                break;
            case 'unauthorized':
                menuData = menuBuilder.buildGuestMenu(user, authRequest);
                break;
            default:
                throw new Error('Unknown user type');
        }

        // Add motivational message
        const motivationalMessage = contentProvider.getMotivationalMessage(userType);
        menuData.text += `\n\n${motivationalMessage}`;

        // Send menu with typing effect
        await bot.sendChatAction(chatId, 'typing');
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for typing effect
        
        const sentMessage = await bot.sendMessage(chatId, menuData.text, {
            reply_markup: menuData.keyboard,
            parse_mode: 'HTML'
        });

        // Add sparkle reaction
        try {
            await bot.setMessageReaction(chatId, sentMessage.message_id, [{ type: 'emoji', emoji: '✨' }]);
        } catch (reactionError) {
            // Reactions might not be supported in all chats, silently ignore
        }

        // Record metrics
        const responseTime = Date.now() - startTime;
        await HelpMetrics.record({
            telegram_id: telegramId,
            user_type: userType,
            menu_section: 'main',
            action: 'view',
            response_time: responseTime
        });

        console.log(`User ${telegramId} (${userType}) used /help command (${responseTime}ms)`);
    } catch (error) {
        console.error('Error handling /help command:', error);
        
        // Send fallback message
        const fallbackMessage = contentProvider.getErrorMessage('general', error.message);
        await bot.sendMessage(chatId, fallbackMessage);
        
        // Record error metric
        await HelpMetrics.record({
            telegram_id: telegramId,
            user_type: 'unknown',
            menu_section: 'error',
            action: 'view',
            response_time: Date.now() - startTime
        });
    }
}
/**
 * Handle /start command
 */
async function handleStartCommand(msg) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const userData = {
        telegram_id: telegramId,
        username: msg.from.username,
        first_name: msg.from.first_name,
        last_name: msg.from.last_name,
        language_code: msg.from.language_code,
        is_bot: msg.from.is_bot || false
    };

    try {
        // Check if user is admin
        if (telegramId === ADMIN_ID) {
            console.log(`Admin ${telegramId} used /start command`);
            
            // Save admin data to telegram table
            await TelegramModel.createOrUpdate({
                ...userData,
                is_premium: msg.from.is_premium,
                added_to_attachment_menu: msg.from.added_to_attachment_menu,
                can_join_groups: msg.from.can_join_groups,
                can_read_all_group_messages: msg.from.can_read_all_group_messages,
                supports_inline_queries: msg.from.supports_inline_queries
            });
            
            // Send leader image to admin
            await bot.sendPhoto(chatId, IMAGES.LEADER, {
                caption: 'Добро пожаловать, лидер! 👑'
            });
            
            console.log('Admin data saved and leader image sent');
        } else {
            // Handle regular user
            const user = await User.findOrCreate(userData);
            
            if (user.isAuthorized()) {
                // User is authorized - send authorized image
                await bot.sendPhoto(chatId, IMAGES.AUTHORIZED, {
                    caption: 'Добро пожаловать обратно! Вы авторизованы ✅'
                });
                console.log(`Authorized user ${telegramId} used /start command`);
            } else {
                // User is not authorized - send newcomers image with authorization button
                const keyboard = {
                    inline_keyboard: [[
                        { text: 'Авторизация', callback_data: 'start_authorization' }
                    ]]
                };
                
                await bot.sendPhoto(chatId, IMAGES.NEWCOMERS, {
                    caption: 'Добро пожаловать! Вы пока не авторизованы 🔒',
                    reply_markup: keyboard
                });
                console.log(`Unauthorized user ${telegramId} used /start command`);
            }
        }
    } catch (error) {
        console.error('Error handling /start command:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
    }
}

/**
 * Set up bot event handlers
 */
function setupBotHandlers() {
    // Handle /start command
    bot.onText(/\/start/, handleStartCommand);
    
    // Handle /help command
    bot.onText(/\/help/, handleHelpCommand);
    
    // Handle callback queries (inline buttons)
    bot.on('callback_query', async (callbackQuery) => {
        const data = callbackQuery.data;
        const telegramId = callbackQuery.from.id;
        
        try {
            // Handle help-related callbacks
            if (data.startsWith('help_')) {
                // Get user for help navigation
                const user = await User.findByTelegramId(telegramId);
                
                // Record navigation metric
                const userType = userTypeDetector.detectUserType(telegramId, user);
                await HelpMetrics.record({
                    telegram_id: telegramId,
                    user_type: userType,
                    menu_section: data,
                    action: 'click'
                });
                
                // Handle navigation
                await navigationManager.handleCallback(callbackQuery, user, bot);
                return;
            }
            
            // Handle existing authorization callbacks
            if (data === 'start_authorization') {
                await handleAuthorizationStart(callbackQuery);
            } else if (data.startsWith('approve_')) {
                await handleApproval(callbackQuery);
            } else if (data.startsWith('reject_')) {
                await handleRejection(callbackQuery);
            } else {
                // Unknown callback
                await bot.answerCallbackQuery(callbackQuery.id, {
                    text: '❓ Неизвестная команда',
                    show_alert: true
                });
            }
        } catch (error) {
            console.error('Error handling callback query:', error);
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Произошла ошибка',
                show_alert: true
            });
        }
    });
    
    // Handle general messages (for authorization flow and future expansion)
    bot.on('message', async (msg) => {
        const telegramId = msg.from.id;
        const session = userSessions.get(telegramId);
        
        // Skip if it's a command (already handled above)
        if (msg.text && msg.text.startsWith('/')) {
            return;
        }
        
        try {
            // Handle authorization flow
            if (session) {
                if (session.state === CONVERSATION_STATES.AWAITING_NICKNAME && msg.text) {
                    await handleNicknameInput(msg);
                } else if (session.state === CONVERSATION_STATES.AWAITING_PHOTO && msg.photo) {
                    await handlePhotoUpload(msg);
                } else if (session.state === CONVERSATION_STATES.AWAITING_PHOTO && !msg.photo) {
                    await bot.sendMessage(msg.chat.id, '📷 Пожалуйста, отправьте фотографию.');
                } else if (session.state === CONVERSATION_STATES.AWAITING_NICKNAME && !msg.text) {
                    await bot.sendMessage(msg.chat.id, '📝 Пожалуйста, введите ваш никнейм.');
                }
            } else {
                // Log all non-session messages for debugging
                console.log(`Message from ${telegramId}: ${msg.text || '[non-text message]'}`);
            }
        } catch (error) {
            console.error('Error handling message:', error);
            await bot.sendMessage(msg.chat.id, 'Произошла ошибка. Попробуйте позже.');
        }
    });
    
    // Handle polling errors
    bot.on('polling_error', (error) => {
        console.error('Polling error:', error);
    });
    
    console.log('Bot handlers set up successfully');
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown() {
    const shutdown = async (signal) => {
        console.log(`\nReceived ${signal}. Shutting down gracefully...`);
        
        try {
            // Stop bot polling
            await bot.stopPolling();
            console.log('Bot polling stopped');
            
            // Close database connection
            await database.close();
            console.log('Database connection closed');
            
            process.exit(0);
        } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    };
    
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

/**
 * Main application startup
 */
async function main() {
    try {
        console.log('Starting Telegram Bot...');
        
        // Initialize database
        await initializeDatabase();
        
        // Set up bot handlers
        setupBotHandlers();
        
        // Set up graceful shutdown
        setupGracefulShutdown();
        
        console.log(`Bot started successfully! Admin ID: ${ADMIN_ID}`);
        console.log('Bot is now listening for messages...');
        
    } catch (error) {
        console.error('Failed to start bot:', error);
        process.exit(1);
    }
}

// Start the application
if (require.main === module) {
    main();
}

module.exports = { bot, main };