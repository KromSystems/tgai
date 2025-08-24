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
 * Initialize database connection
 */
async function initializeDatabase() {
    try {
        await database.connect();
        console.log('Database connected successfully');
    } catch (error) {
        console.error('Failed to connect to database:', error);
        process.exit(1);
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
                // User is not authorized - send newcomers image
                await bot.sendPhoto(chatId, IMAGES.NEWCOMERS, {
                    caption: 'Добро пожаловать! Вы пока не авторизованы 🔒'
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
    
    // Handle general messages (for future expansion)
    bot.on('message', async (msg) => {
        // Skip if it's a command (already handled above)
        if (msg.text && msg.text.startsWith('/')) {
            return;
        }
        
        // Log all non-command messages for debugging
        console.log(`Message from ${msg.from.id}: ${msg.text || '[non-text message]'}`);
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