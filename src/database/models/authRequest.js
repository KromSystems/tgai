const database = require('../connection');
const fs = require('fs');
const path = require('path');

class AuthRequest {
    constructor(data = {}) {
        this.id = data.id || null;
        this.user_id = data.user_id;
        this.telegram_id = data.telegram_id;
        this.nickname = data.nickname;
        this.photo_path = data.photo_path;
        this.status = data.status || 'pending';
        this.admin_id = data.admin_id || null;
        this.submitted_at = data.submitted_at || null;
        this.processed_at = data.processed_at || null;
    }

    /**
     * Create a new authentication request
     * @param {Object} requestData - Authentication request data
     * @returns {Promise<AuthRequest>}
     */
    static async create(requestData) {
        const sql = `
            INSERT INTO auth_requests (user_id, telegram_id, nickname, photo_path, status)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const params = [
            requestData.user_id,
            requestData.telegram_id,
            requestData.nickname,
            requestData.photo_path,
            requestData.status || 'pending'
        ];

        try {
            const result = await database.run(sql, params);
            const newRequest = await AuthRequest.findById(result.id);
            return newRequest;
        } catch (error) {
            throw new Error(`Failed to create auth request: ${error.message}`);
        }
    }

    /**
     * Find authentication request by ID
     * @param {number} id - Request ID
     * @returns {Promise<AuthRequest|null>}
     */
    static async findById(id) {
        const sql = 'SELECT * FROM auth_requests WHERE id = ?';
        try {
            const row = await database.get(sql, [id]);
            return row ? new AuthRequest(row) : null;
        } catch (error) {
            throw new Error(`Failed to find auth request by ID: ${error.message}`);
        }
    }

    /**
     * Find authentication request by user ID
     * @param {number} userId - User ID
     * @param {string} status - Optional status filter
     * @returns {Promise<AuthRequest|null>}
     */
    static async findByUserId(userId, status = null) {
        let sql = 'SELECT * FROM auth_requests WHERE user_id = ?';
        const params = [userId];
        
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }
        
        sql += ' ORDER BY submitted_at DESC LIMIT 1';
        
        try {
            const row = await database.get(sql, params);
            return row ? new AuthRequest(row) : null;
        } catch (error) {
            throw new Error(`Failed to find auth request by user ID: ${error.message}`);
        }
    }

    /**
     * Find authentication request by Telegram ID
     * @param {number} telegramId - Telegram user ID
     * @param {string} status - Optional status filter
     * @returns {Promise<AuthRequest|null>}
     */
    static async findByTelegramId(telegramId, status = null) {
        let sql = 'SELECT * FROM auth_requests WHERE telegram_id = ?';
        const params = [telegramId];
        
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }
        
        sql += ' ORDER BY submitted_at DESC LIMIT 1';
        
        try {
            const row = await database.get(sql, params);
            return row ? new AuthRequest(row) : null;
        } catch (error) {
            throw new Error(`Failed to find auth request by Telegram ID: ${error.message}`);
        }
    }

    /**
     * Get all pending authentication requests
     * @returns {Promise<Array<AuthRequest>>}
     */
    static async findPending() {
        const sql = 'SELECT * FROM auth_requests WHERE status = ? ORDER BY submitted_at ASC';
        try {
            const rows = await database.all(sql, ['pending']);
            return rows.map(row => new AuthRequest(row));
        } catch (error) {
            throw new Error(`Failed to find pending auth requests: ${error.message}`);
        }
    }

    /**
     * Get all authentication requests by status
     * @param {string} status - Status to filter by
     * @returns {Promise<Array<AuthRequest>>}
     */
    static async findByStatus(status) {
        const sql = 'SELECT * FROM auth_requests WHERE status = ? ORDER BY submitted_at DESC';
        try {
            const rows = await database.all(sql, [status]);
            return rows.map(row => new AuthRequest(row));
        } catch (error) {
            throw new Error(`Failed to find auth requests by status: ${error.message}`);
        }
    }

    /**
     * Update authentication request status
     * @param {string} status - New status (pending, approved, rejected)
     * @param {number} adminId - ID of admin processing the request
     * @returns {Promise<AuthRequest>}
     */
    async updateStatus(status, adminId = null) {
        const validStatuses = ['pending', 'approved', 'rejected'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
        }

        const sql = `
            UPDATE auth_requests 
            SET status = ?, admin_id = ?, processed_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;

        try {
            await database.run(sql, [status, adminId, this.id]);
            this.status = status;
            this.admin_id = adminId;
            this.processed_at = new Date().toISOString();
            return this;
        } catch (error) {
            throw new Error(`Failed to update auth request status: ${error.message}`);
        }
    }

    /**
     * Check if photo file exists
     * @returns {boolean}
     */
    photoExists() {
        if (!this.photo_path) {
            return false;
        }
        return fs.existsSync(this.photo_path);
    }

    /**
     * Get photo file buffer
     * @returns {Promise<Buffer|null>}
     */
    async getPhotoBuffer() {
        if (!this.photoExists()) {
            return null;
        }

        try {
            return fs.readFileSync(this.photo_path);
        } catch (error) {
            throw new Error(`Failed to read photo file: ${error.message}`);
        }
    }

    /**
     * Delete photo file
     * @returns {Promise<boolean>}
     */
    async deletePhoto() {
        if (!this.photo_path) {
            return false;
        }

        try {
            if (fs.existsSync(this.photo_path)) {
                fs.unlinkSync(this.photo_path);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`Failed to delete photo file: ${error.message}`);
            return false;
        }
    }

    /**
     * Delete authentication request and associated photo
     * @returns {Promise<boolean>}
     */
    async delete() {
        const sql = 'DELETE FROM auth_requests WHERE id = ?';
        try {
            // Delete photo file first
            await this.deletePhoto();
            
            // Delete database record
            const result = await database.run(sql, [this.id]);
            return result.changes > 0;
        } catch (error) {
            throw new Error(`Failed to delete auth request: ${error.message}`);
        }
    }

    /**
     * Get user information associated with this request
     * @returns {Promise<Object|null>}
     */
    async getUser() {
        const User = require('./user');
        try {
            return await User.findById(this.user_id);
        } catch (error) {
            throw new Error(`Failed to get associated user: ${error.message}`);
        }
    }

    /**
     * Get admin information who processed this request
     * @returns {Promise<Object|null>}
     */
    async getAdmin() {
        if (!this.admin_id) {
            return null;
        }

        const User = require('./user');
        try {
            return await User.findById(this.admin_id);
        } catch (error) {
            throw new Error(`Failed to get processing admin: ${error.message}`);
        }
    }

    /**
     * Check if request is pending
     * @returns {boolean}
     */
    isPending() {
        return this.status === 'pending';
    }

    /**
     * Check if request is approved
     * @returns {boolean}
     */
    isApproved() {
        return this.status === 'approved';
    }

    /**
     * Check if request is rejected
     * @returns {boolean}
     */
    isRejected() {
        return this.status === 'rejected';
    }

    /**
     * Get formatted submission date
     * @returns {string}
     */
    getFormattedSubmissionDate() {
        if (!this.submitted_at) {
            return 'Unknown';
        }
        
        const date = new Date(this.submitted_at);
        return date.toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Convert to JSON
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            user_id: this.user_id,
            telegram_id: this.telegram_id,
            nickname: this.nickname,
            photo_path: this.photo_path,
            status: this.status,
            admin_id: this.admin_id,
            submitted_at: this.submitted_at,
            processed_at: this.processed_at
        };
    }
}

module.exports = AuthRequest;