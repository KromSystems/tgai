/**
 * Migration: Create help_metrics table
 * Stores analytics data for /help command usage
 */

const database = require('../connection');

async function up() {
    const sql = `
        CREATE TABLE IF NOT EXISTS help_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER NOT NULL,
            user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'authorized', 'unauthorized')),
            menu_section TEXT NOT NULL DEFAULT 'main',
            action TEXT NOT NULL CHECK (action IN ('view', 'click', 'navigate')),
            response_time INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;

    try {
        await database.run(sql);
        
        // Create indices for better performance
        await database.run('CREATE INDEX IF NOT EXISTS idx_help_metrics_telegram_id ON help_metrics(telegram_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_help_metrics_user_type ON help_metrics(user_type)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_help_metrics_created_at ON help_metrics(created_at)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_help_metrics_action ON help_metrics(action)');
        
        console.log('✅ help_metrics table created successfully');
        return true;
    } catch (error) {
        console.error('❌ Error creating help_metrics table:', error);
        throw error;
    }
}

async function down() {
    const sql = 'DROP TABLE IF EXISTS help_metrics';
    
    try {
        await database.run(sql);
        console.log('✅ help_metrics table dropped successfully');
        return true;
    } catch (error) {
        console.error('❌ Error dropping help_metrics table:', error);
        throw error;
    }
}

module.exports = {
    up,
    down,
    description: 'Create help_metrics table for storing /help command analytics'
};