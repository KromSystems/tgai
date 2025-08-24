/**
 * Add authorized column to users table and create telegram table
 * Migration for handling user authorization and telegram admin data
 */

const database = require('../connection');

const migration = {
    version: '002',
    description: 'Add authorized column to users table and create telegram table',
    
    async up() {
        const statements = [
            // Add authorized column to users table
            {
                sql: `
                    ALTER TABLE users 
                    ADD COLUMN authorized INTEGER DEFAULT 0
                `
            },
            
            // Create telegram table for admin data
            {
                sql: `
                    CREATE TABLE IF NOT EXISTS telegram (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        telegram_id BIGINT UNIQUE NOT NULL,
                        username TEXT,
                        first_name TEXT,
                        last_name TEXT,
                        language_code TEXT,
                        is_bot BOOLEAN DEFAULT FALSE,
                        is_premium BOOLEAN DEFAULT FALSE,
                        added_to_attachment_menu BOOLEAN DEFAULT FALSE,
                        can_join_groups BOOLEAN DEFAULT FALSE,
                        can_read_all_group_messages BOOLEAN DEFAULT FALSE,
                        supports_inline_queries BOOLEAN DEFAULT FALSE,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `
            },
            
            // Create index for telegram table
            {
                sql: 'CREATE INDEX IF NOT EXISTS idx_telegram_telegram_id ON telegram (telegram_id)'
            }
        ];

        try {
            console.log('Running migration: Add authorized column and create telegram table');
            
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
            'DROP INDEX IF EXISTS idx_telegram_telegram_id',
            'DROP TABLE IF EXISTS telegram',
            // Note: SQLite doesn't support DROP COLUMN, so we can't remove the authorized column
            // In a real scenario, we would need to recreate the users table without the column
        ];

        try {
            console.log('Rolling back migration: Add authorized column and create telegram table');
            
            for (const sql of statements) {
                await database.run(sql);
                console.log('✓ Executed:', sql);
            }
            
            // Remove migration record
            await database.run(
                'DELETE FROM migrations WHERE version = ?',
                [this.version]
            );
            
            console.log('✓ Migration rollback completed (Note: authorized column cannot be removed due to SQLite limitations)');
            return true;
        } catch (error) {
            console.error('Migration rollback failed:', error.message);
            throw error;
        }
    }
};

module.exports = migration;