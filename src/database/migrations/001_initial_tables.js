/**
 * Initial database migration
 * Creates users and messages tables according to the schema design
 */

const database = require('../connection');

const migration = {
    version: '001',
    description: 'Create initial tables: users and messages',
    
    async up() {
        const statements = [
            // Create users table
            {
                sql: `
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        telegram_id BIGINT UNIQUE NOT NULL,
                        username TEXT,
                        first_name TEXT,
                        last_name TEXT,
                        language_code TEXT,
                        is_bot BOOLEAN DEFAULT FALSE,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `
            },
            
            // Create messages table
            {
                sql: `
                    CREATE TABLE IF NOT EXISTS messages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER,
                        message_id BIGINT,
                        text TEXT,
                        message_type TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                    )
                `
            },
            
            // Create migrations table to track applied migrations
            {
                sql: `
                    CREATE TABLE IF NOT EXISTS migrations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        version TEXT UNIQUE NOT NULL,
                        description TEXT,
                        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `
            },
            
            // Create indexes for better performance
            {
                sql: 'CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users (telegram_id)'
            },
            {
                sql: 'CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)'
            },
            {
                sql: 'CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages (user_id)'
            },
            {
                sql: 'CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages (message_id)'
            },
            {
                sql: 'CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at)'
            }
        ];

        try {
            console.log('Running migration: Create initial tables');
            
            for (const statement of statements) {
                await database.run(statement.sql);
                const logText = statement.sql.trim().split('\n')[0].trim() || statement.sql.trim();
                console.log('✓ Executed:', logText);
            }
            
            // Record this migration
            await database.run(
                'INSERT OR IGNORE INTO migrations (version, description) VALUES (?, ?)',
                [this.version, this.description]
            );
            
            console.log('✓ Migration completed successfully');
            return true;
        } catch (error) {
            console.error('Migration failed:', error.message);
            throw error;
        }
    },
    
    async down() {
        const statements = [
            'DROP INDEX IF EXISTS idx_messages_created_at',
            'DROP INDEX IF EXISTS idx_messages_message_id',
            'DROP INDEX IF EXISTS idx_messages_user_id',
            'DROP INDEX IF EXISTS idx_users_username',
            'DROP INDEX IF EXISTS idx_users_telegram_id',
            'DROP TABLE IF EXISTS messages',
            'DROP TABLE IF EXISTS users'
        ];

        try {
            console.log('Rolling back migration: Create initial tables');
            
            for (const sql of statements) {
                await database.run(sql);
                console.log('✓ Executed:', sql);
            }
            
            // Remove migration record
            await database.run(
                'DELETE FROM migrations WHERE version = ?',
                [this.version]
            );
            
            console.log('✓ Migration rollback completed');
            return true;
        } catch (error) {
            console.error('Migration rollback failed:', error.message);
            throw error;
        }
    }
};

module.exports = migration;