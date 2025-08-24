const database = require('../connection');

class User {
    constructor(data = {}) {
        this.id = data.id || null;
        this.telegram_id = data.telegram_id || null;
        this.username = data.username || null;
        this.first_name = data.first_name || null;
        this.last_name = data.last_name || null;
        this.language_code = data.language_code || null;
        this.is_bot = data.is_bot || false;
        this.authorized = data.authorized || 0;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    /**
     * Create a new user
     * @param {Object} userData - User data from Telegram
     * @returns {Promise<User>}
     */
    static async create(userData) {
        const sql = `
            INSERT INTO users (telegram_id, username, first_name, last_name, language_code, is_bot, authorized)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            userData.telegram_id,
            userData.username || null,
            userData.first_name || null,
            userData.last_name || null,
            userData.language_code || null,
            userData.is_bot || false,
            userData.authorized || 0
        ];

        try {
            const result = await database.run(sql, params);
            const newUser = await User.findById(result.id);
            return newUser;
        } catch (error) {
            throw new Error(`Failed to create user: ${error.message}`);
        }
    }

    /**
     * Find user by ID
     * @param {number} id - User ID
     * @returns {Promise<User|null>}
     */
    static async findById(id) {
        const sql = 'SELECT * FROM users WHERE id = ?';
        try {
            const row = await database.get(sql, [id]);
            return row ? new User(row) : null;
        } catch (error) {
            throw new Error(`Failed to find user by ID: ${error.message}`);
        }
    }

    /**
     * Find user by Telegram ID
     * @param {number} telegramId - Telegram user ID
     * @returns {Promise<User|null>}
     */
    static async findByTelegramId(telegramId) {
        const sql = 'SELECT * FROM users WHERE telegram_id = ?';
        try {
            const row = await database.get(sql, [telegramId]);
            return row ? new User(row) : null;
        } catch (error) {
            throw new Error(`Failed to find user by Telegram ID: ${error.message}`);
        }
    }

    /**
     * Find user by username
     * @param {string} username - Telegram username
     * @returns {Promise<User|null>}
     */
    static async findByUsername(username) {
        const sql = 'SELECT * FROM users WHERE username = ?';
        try {
            const row = await database.get(sql, [username]);
            return row ? new User(row) : null;
        } catch (error) {
            throw new Error(`Failed to find user by username: ${error.message}`);
        }
    }

    /**
     * Get all users
     * @param {Object} options - Query options (limit, offset)
     * @returns {Promise<Array<User>>}
     */
    static async findAll(options = {}) {
        let sql = 'SELECT * FROM users ORDER BY created_at DESC';
        const params = [];

        if (options.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }

        if (options.offset) {
            sql += ' OFFSET ?';
            params.push(options.offset);
        }

        try {
            const rows = await database.all(sql, params);
            return rows.map(row => new User(row));
        } catch (error) {
            throw new Error(`Failed to find all users: ${error.message}`);
        }
    }

    /**
     * Update user information
     * @param {Object} updateData - Data to update
     * @returns {Promise<User>}
     */
    async update(updateData) {
        const allowedFields = ['username', 'first_name', 'last_name', 'language_code', 'authorized'];
        const updates = [];
        const params = [];

        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                params.push(updateData[key]);
                this[key] = updateData[key];
            }
        });

        if (updates.length === 0) {
            return this;
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(this.id);

        const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

        try {
            await database.run(sql, params);
            this.updated_at = new Date().toISOString();
            return this;
        } catch (error) {
            throw new Error(`Failed to update user: ${error.message}`);
        }
    }

    /**
     * Delete user
     * @returns {Promise<boolean>}
     */
    async delete() {
        const sql = 'DELETE FROM users WHERE id = ?';
        try {
            const result = await database.run(sql, [this.id]);
            return result.changes > 0;
        } catch (error) {
            throw new Error(`Failed to delete user: ${error.message}`);
        }
    }

    /**
     * Find or create user (upsert operation)
     * @param {Object} userData - User data from Telegram
     * @returns {Promise<User>}
     */
    static async findOrCreate(userData) {
        try {
            let user = await User.findByTelegramId(userData.telegram_id);
            
            if (user) {
                // Update existing user with new information
                const updateData = {};
                if (userData.username !== user.username) updateData.username = userData.username;
                if (userData.first_name !== user.first_name) updateData.first_name = userData.first_name;
                if (userData.last_name !== user.last_name) updateData.last_name = userData.last_name;
                if (userData.language_code !== user.language_code) updateData.language_code = userData.language_code;
                if (userData.authorized !== undefined && userData.authorized !== user.authorized) updateData.authorized = userData.authorized;

                if (Object.keys(updateData).length > 0) {
                    user = await user.update(updateData);
                }
            } else {
                // Create new user
                user = await User.create(userData);
            }

            return user;
        } catch (error) {
            throw new Error(`Failed to find or create user: ${error.message}`);
        }
    }

    /**
     * Get user's full name
     * @returns {string}
     */
    getFullName() {
        const parts = [];
        if (this.first_name) parts.push(this.first_name);
        if (this.last_name) parts.push(this.last_name);
        return parts.join(' ') || this.username || `User ${this.telegram_id}`;
    }

    /**
     * Get user's display name for mentions
     * @returns {string}
     */
    getDisplayName() {
        return this.username ? `@${this.username}` : this.getFullName();
    }

    /**
     * Set user authorization status
     * @param {number} authorized - Authorization status (0 or 1)
     * @returns {Promise<User>}
     */
    async setAuthorized(authorized) {
        const sql = 'UPDATE users SET authorized = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        try {
            await database.run(sql, [authorized, this.id]);
            this.authorized = authorized;
            this.updated_at = new Date().toISOString();
            return this;
        } catch (error) {
            throw new Error(`Failed to set authorization status: ${error.message}`);
        }
    }

    /**
     * Check if user is authorized
     * @returns {boolean}
     */
    isAuthorized() {
        return this.authorized === 1;
    }

    /**
     * Find all authorized users
     * @returns {Promise<Array<User>>}
     */
    static async findAuthorized() {
        const sql = 'SELECT * FROM users WHERE authorized = 1 ORDER BY created_at DESC';
        try {
            const rows = await database.all(sql);
            return rows.map(row => new User(row));
        } catch (error) {
            throw new Error(`Failed to find authorized users: ${error.message}`);
        }
    }

    /**
     * Find all unauthorized users
     * @returns {Promise<Array<User>>}
     */
    static async findUnauthorized() {
        const sql = 'SELECT * FROM users WHERE authorized = 0 ORDER BY created_at DESC';
        try {
            const rows = await database.all(sql);
            return rows.map(row => new User(row));
        } catch (error) {
            throw new Error(`Failed to find unauthorized users: ${error.message}`);
        }
    }

    /**
     * Convert to JSON
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            telegram_id: this.telegram_id,
            username: this.username,
            first_name: this.first_name,
            last_name: this.last_name,
            language_code: this.language_code,
            is_bot: this.is_bot,
            authorized: this.authorized,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

module.exports = User;