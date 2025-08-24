/**
 * Create auth_requests table for user authentication workflow
 * This table tracks user authentication submissions including nickname, photo, and approval status
 */

const database = require('../connection');

const migration = {
    version: '003',
    description: 'Create auth_requests table for authentication workflow',
    
    async up() {
        const statements = [
            // Create auth_requests table
            {
                sql: `
                    CREATE TABLE IF NOT EXISTS auth_requests (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        telegram_id BIGINT NOT NULL,
                        nickname TEXT NOT NULL,
                        photo_path TEXT NOT NULL,
                        status TEXT DEFAULT 'pending',
                        admin_id INTEGER,
                        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        processed_at DATETIME,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
                        CHECK (status IN ('pending', 'approved', 'rejected'))
                    )
                `
            },
            
            // Create indexes for better performance
            {
                sql: 'CREATE INDEX IF NOT EXISTS idx_auth_requests_user_id ON auth_requests (user_id)'
            },
            {
                sql: 'CREATE INDEX IF NOT EXISTS idx_auth_requests_telegram_id ON auth_requests (telegram_id)'
            },
            {
                sql: 'CREATE INDEX IF NOT EXISTS idx_auth_requests_status ON auth_requests (status)'
            },
            {
                sql: 'CREATE INDEX IF NOT EXISTS idx_auth_requests_submitted_at ON auth_requests (submitted_at)'
            }
        ];

        try {
            console.log('Running migration: Create auth_requests table');
            
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
            'DROP INDEX IF EXISTS idx_auth_requests_submitted_at',
            'DROP INDEX IF EXISTS idx_auth_requests_status', 
            'DROP INDEX IF EXISTS idx_auth_requests_telegram_id',
            'DROP INDEX IF EXISTS idx_auth_requests_user_id',
            'DROP TABLE IF EXISTS auth_requests'
        ];

        try {
            console.log('Rolling back migration: Create auth_requests table');
            
            for (const statement of statements) {
                await database.run(statement);
                console.log('✓ Executed:', statement);
            }
            
            // Remove migration record
            await database.run(
                'DELETE FROM migrations WHERE version = ?',
                [this.version]
            );
            
            console.log('✓ Migration rollback completed successfully');
            return true;
        } catch (error) {
            console.error('Migration rollback failed:', error.message);
            throw error;
        }
    }
};

module.exports = migration;