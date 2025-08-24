/**
 * User management utility script
 * Provides commands to manage user authorization and view database data
 */

require('dotenv').config();
const database = require('../src/database/connection');
const User = require('../src/database/models/user');
const TelegramModel = require('../src/database/models/telegram');

/**
 * Display help information
 */
function showHelp() {
    console.log(`
📚 User Management Utility

Usage:
  node scripts/manage_users.js <command> [options]

Commands:
  list-users              List all users with their authorization status
  list-admins             List all admin data from telegram table
  authorize <telegram_id> Authorize a user by their Telegram ID
  unauthorize <telegram_id> Remove authorization from a user
  user-info <telegram_id> Show detailed information about a user
  help                    Show this help message

Examples:
  node scripts/manage_users.js list-users
  node scripts/manage_users.js authorize 123456789
  node scripts/manage_users.js user-info 123456789
    `);
}

/**
 * List all users
 */
async function listUsers() {
    try {
        const users = await User.findAll();
        console.log(`\n👥 Total users: ${users.length}\n`);
        
        if (users.length === 0) {
            console.log('No users found.');
            return;
        }
        
        console.log('ID'.padEnd(8) + 'Telegram ID'.padEnd(15) + 'Username'.padEnd(20) + 'Name'.padEnd(25) + 'Authorized');
        console.log('-'.repeat(80));
        
        for (const user of users) {
            const id = user.id.toString().padEnd(8);
            const telegramId = user.telegram_id.toString().padEnd(15);
            const username = (user.username || '').padEnd(20);
            const name = user.getFullName().padEnd(25);
            const authorized = user.isAuthorized() ? '✅ Yes' : '❌ No';
            
            console.log(`${id}${telegramId}${username}${name}${authorized}`);
        }
    } catch (error) {
        console.error('Error listing users:', error.message);
    }
}

/**
 * List admin data
 */
async function listAdmins() {
    try {
        const admins = await TelegramModel.findAll();
        console.log(`\n👑 Admin data entries: ${admins.length}\n`);
        
        if (admins.length === 0) {
            console.log('No admin data found.');
            return;
        }
        
        for (const admin of admins) {
            console.log(`ID: ${admin.id}`);
            console.log(`Telegram ID: ${admin.telegram_id}`);
            console.log(`Username: ${admin.username || 'N/A'}`);
            console.log(`Name: ${admin.first_name || ''} ${admin.last_name || ''}`.trim() || 'N/A');
            console.log(`Language: ${admin.language_code || 'N/A'}`);
            console.log(`Created: ${admin.created_at}`);
            console.log(`Updated: ${admin.updated_at}`);
            console.log('-'.repeat(50));
        }
    } catch (error) {
        console.error('Error listing admins:', error.message);
    }
}

/**
 * Authorize a user
 */
async function authorizeUser(telegramId) {
    try {
        const user = await User.findByTelegramId(parseInt(telegramId));
        
        if (!user) {
            console.log(`❌ User with Telegram ID ${telegramId} not found.`);
            return;
        }
        
        if (user.isAuthorized()) {
            console.log(`ℹ️  User ${user.getFullName()} is already authorized.`);
            return;
        }
        
        await user.setAuthorized(1);
        console.log(`✅ User ${user.getFullName()} has been authorized.`);
        
    } catch (error) {
        console.error('Error authorizing user:', error.message);
    }
}

/**
 * Remove authorization from a user
 */
async function unauthorizeUser(telegramId) {
    try {
        const user = await User.findByTelegramId(parseInt(telegramId));
        
        if (!user) {
            console.log(`❌ User with Telegram ID ${telegramId} not found.`);
            return;
        }
        
        if (!user.isAuthorized()) {
            console.log(`ℹ️  User ${user.getFullName()} is already unauthorized.`);
            return;
        }
        
        await user.setAuthorized(0);
        console.log(`❌ Authorization removed from user ${user.getFullName()}.`);
        
    } catch (error) {
        console.error('Error unauthorizing user:', error.message);
    }
}

/**
 * Show user information
 */
async function showUserInfo(telegramId) {
    try {
        const user = await User.findByTelegramId(parseInt(telegramId));
        
        if (!user) {
            console.log(`❌ User with Telegram ID ${telegramId} not found.`);
            return;
        }
        
        console.log(`\n👤 User Information\n`);
        console.log(`Database ID: ${user.id}`);
        console.log(`Telegram ID: ${user.telegram_id}`);
        console.log(`Username: ${user.username || 'N/A'}`);
        console.log(`First Name: ${user.first_name || 'N/A'}`);
        console.log(`Last Name: ${user.last_name || 'N/A'}`);
        console.log(`Full Name: ${user.getFullName()}`);
        console.log(`Language Code: ${user.language_code || 'N/A'}`);
        console.log(`Is Bot: ${user.is_bot ? 'Yes' : 'No'}`);
        console.log(`Authorized: ${user.isAuthorized() ? '✅ Yes' : '❌ No'}`);
        console.log(`Created: ${user.created_at}`);
        console.log(`Updated: ${user.updated_at}`);
        
    } catch (error) {
        console.error('Error showing user info:', error.message);
    }
}

/**
 * Main function
 */
async function main() {
    const command = process.argv[2];
    const arg = process.argv[3];
    
    try {
        // Connect to database
        await database.connect();
        
        switch (command) {
            case 'list-users':
                await listUsers();
                break;
                
            case 'list-admins':
                await listAdmins();
                break;
                
            case 'authorize':
                if (!arg) {
                    console.log('❌ Please provide a Telegram ID');
                    console.log('Usage: node scripts/manage_users.js authorize <telegram_id>');
                    return;
                }
                await authorizeUser(arg);
                break;
                
            case 'unauthorize':
                if (!arg) {
                    console.log('❌ Please provide a Telegram ID');
                    console.log('Usage: node scripts/manage_users.js unauthorize <telegram_id>');
                    return;
                }
                await unauthorizeUser(arg);
                break;
                
            case 'user-info':
                if (!arg) {
                    console.log('❌ Please provide a Telegram ID');
                    console.log('Usage: node scripts/manage_users.js user-info <telegram_id>');
                    return;
                }
                await showUserInfo(arg);
                break;
                
            case 'help':
            case undefined:
                showHelp();
                break;
                
            default:
                console.log(`❌ Unknown command: ${command}`);
                showHelp();
                break;
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        // Close database connection
        await database.close();
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { main };