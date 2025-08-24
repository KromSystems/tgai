/**
 * Telegram model for admin data storage
 * Handles all operations related to telegram admin data
 */

const database = require('../connection');

class TelegramModel {
    constructor() {
        this.tableName = 'telegram';
    }

    /**
     * Create or update telegram admin data
     * @param {Object} telegramData - Telegram user data
     * @returns {Promise<Object>}
     */
    async createOrUpdate(telegramData) {
        const {
            telegram_id,
            username,
            first_name,
            last_name,
            language_code,
            is_bot,
            is_premium,
            added_to_attachment_menu,
            can_join_groups,
            can_read_all_group_messages,
            supports_inline_queries
        } = telegramData;

        try {
            // First, try to find existing record
            const existing = await this.findByTelegramId(telegram_id);
            
            if (existing) {
                // Update existing record
                console.log(`Updating existing telegram record for ID: ${telegram_id}`);
                const result = await database.run(
                    `UPDATE ${this.tableName} SET 
                        username = ?, 
                        first_name = ?, 
                        last_name = ?, 
                        language_code = ?, 
                        is_bot = ?, 
                        is_premium = ?, 
                        added_to_attachment_menu = ?, 
                        can_join_groups = ?, 
                        can_read_all_group_messages = ?, 
                        supports_inline_queries = ?, 
                        updated_at = CURRENT_TIMESTAMP 
                    WHERE telegram_id = ?`,
                    [
                        username, first_name, last_name, language_code, 
                        is_bot || false, is_premium || false, 
                        added_to_attachment_menu || false, can_join_groups || false, 
                        can_read_all_group_messages || false, supports_inline_queries || false, 
                        telegram_id
                    ]
                );
                
                console.log(`Successfully updated telegram record for ID: ${telegram_id}`);
                return await this.findByTelegramId(telegram_id);
            } else {
                // Create new record only if none exists
                console.log(`Creating new telegram record for ID: ${telegram_id}`);
                const result = await database.run(
                    `INSERT INTO ${this.tableName} (
                        telegram_id, username, first_name, last_name, language_code, 
                        is_bot, is_premium, added_to_attachment_menu, can_join_groups, 
                        can_read_all_group_messages, supports_inline_queries
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        telegram_id, username, first_name, last_name, language_code,
                        is_bot || false, is_premium || false, 
                        added_to_attachment_menu || false, can_join_groups || false,
                        can_read_all_group_messages || false, supports_inline_queries || false
                    ]
                );
                
                console.log(`Successfully created telegram record for ID: ${telegram_id}`);
                return await this.findById(result.id);
            }
        } catch (error) {
            console.error('Error creating/updating telegram data:', error);
            
            // If we get a UNIQUE constraint error, try to fetch the existing record
            if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE')) {
                console.log(`UNIQUE constraint hit, fetching existing record for ID: ${telegram_id}`);
                try {
                    const existing = await this.findByTelegramId(telegram_id);
                    if (existing) {
                        console.log(`Found existing record, returning it`);
                        return existing;
                    }
                } catch (fetchError) {
                    console.error('Error fetching existing record after UNIQUE constraint:', fetchError);
                }
            }
            
            throw error;
        }
    }

    /**
     * Find telegram data by ID
     * @param {number} id - Database ID
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        try {
            const result = await database.get(
                `SELECT * FROM ${this.tableName} WHERE id = ?`,
                [id]
            );
            return result || null;
        } catch (error) {
            console.error('Error finding telegram data by ID:', error);
            throw error;
        }
    }

    /**
     * Find telegram data by Telegram ID
     * @param {number} telegramId - Telegram user ID
     * @returns {Promise<Object|null>}
     */
    async findByTelegramId(telegramId) {
        try {
            const result = await database.get(
                `SELECT * FROM ${this.tableName} WHERE telegram_id = ?`,
                [telegramId]
            );
            return result || null;
        } catch (error) {
            console.error('Error finding telegram data by telegram ID:', error);
            throw error;
        }
    }

    /**
     * Get all telegram records
     * @returns {Promise<Array>}
     */
    async findAll() {
        try {
            const results = await database.all(`SELECT * FROM ${this.tableName} ORDER BY created_at DESC`);
            return results;
        } catch (error) {
            console.error('Error finding all telegram data:', error);
            throw error;
        }
    }

    /**
     * Delete telegram data by ID
     * @param {number} id - Database ID
     * @returns {Promise<boolean>}
     */
    async deleteById(id) {
        try {
            const result = await database.run(
                `DELETE FROM ${this.tableName} WHERE id = ?`,
                [id]
            );
            return result.changes > 0;
        } catch (error) {
            console.error('Error deleting telegram data:', error);
            throw error;
        }
    }

    /**
     * Delete telegram data by Telegram ID
     * @param {number} telegramId - Telegram user ID
     * @returns {Promise<boolean>}
     */
    async deleteByTelegramId(telegramId) {
        try {
            const result = await database.run(
                `DELETE FROM ${this.tableName} WHERE telegram_id = ?`,
                [telegramId]
            );
            return result.changes > 0;
        } catch (error) {
            console.error('Error deleting telegram data by telegram ID:', error);
            throw error;
        }
    }
}

module.exports = new TelegramModel();