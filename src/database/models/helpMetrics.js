const database = require('../connection');

class HelpMetrics {
    constructor(data = {}) {
        this.id = data.id || null;
        this.telegram_id = data.telegram_id;
        this.user_type = data.user_type; // 'admin', 'authorized', 'unauthorized'
        this.menu_section = data.menu_section || 'main'; // main, admin_users, user_profile, etc.
        this.action = data.action; // 'view', 'click', 'navigate'
        this.response_time = data.response_time || null;
        this.created_at = data.created_at || null;
    }

    /**
     * Record a help command usage metric
     * @param {Object} metricData - Metric data
     * @returns {Promise<HelpMetrics>}
     */
    static async record(metricData) {
        const sql = `
            INSERT INTO help_metrics (telegram_id, user_type, menu_section, action, response_time)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const params = [
            metricData.telegram_id,
            metricData.user_type,
            metricData.menu_section || 'main',
            metricData.action,
            metricData.response_time || null
        ];

        try {
            const result = await database.run(sql, params);
            const newMetric = await HelpMetrics.findById(result.id);
            return newMetric;
        } catch (error) {
            // Don't throw errors for metrics - just log them
            console.error(`Failed to record help metric: ${error.message}`);
            return null;
        }
    }

    /**
     * Find metric by ID
     * @param {number} id - Metric ID
     * @returns {Promise<HelpMetrics|null>}
     */
    static async findById(id) {
        const sql = 'SELECT * FROM help_metrics WHERE id = ?';
        try {
            const row = await database.get(sql, [id]);
            return row ? new HelpMetrics(row) : null;
        } catch (error) {
            console.error(`Failed to find help metric by ID: ${error.message}`);
            return null;
        }
    }

    /**
     * Get usage statistics for admin dashboard
     * @param {Object} options - Query options
     * @returns {Promise<Object>}
     */
    static async getUsageStats(options = {}) {
        const timeRange = options.timeRange || '7 days';
        
        try {
            // Total usage count
            const totalUsageSql = `
                SELECT COUNT(*) as total_usage 
                FROM help_metrics 
                WHERE action = 'view' AND created_at >= datetime('now', '-${timeRange}')
            `;
            const totalUsage = await database.get(totalUsageSql);

            // Usage by user type
            const userTypeSql = `
                SELECT user_type, COUNT(*) as count 
                FROM help_metrics 
                WHERE action = 'view' AND created_at >= datetime('now', '-${timeRange}')
                GROUP BY user_type
            `;
            const userTypeStats = await database.all(userTypeSql);

            // Most popular sections
            const sectionsSql = `
                SELECT menu_section, COUNT(*) as count 
                FROM help_metrics 
                WHERE action = 'click' AND created_at >= datetime('now', '-${timeRange}')
                GROUP BY menu_section 
                ORDER BY count DESC 
                LIMIT 10
            `;
            const popularSections = await database.all(sectionsSql);

            // Average response time
            const responseSql = `
                SELECT AVG(response_time) as avg_response_time 
                FROM help_metrics 
                WHERE response_time IS NOT NULL AND created_at >= datetime('now', '-${timeRange}')
            `;
            const responseTime = await database.get(responseSql);

            return {
                total_usage: totalUsage.total_usage || 0,
                user_type_breakdown: userTypeStats,
                popular_sections: popularSections,
                avg_response_time: responseTime.avg_response_time || 0,
                time_range: timeRange
            };
        } catch (error) {
            console.error(`Failed to get usage stats: ${error.message}`);
            return {
                total_usage: 0,
                user_type_breakdown: [],
                popular_sections: [],
                avg_response_time: 0,
                time_range: timeRange
            };
        }
    }

    /**
     * Get daily usage trend
     * @param {number} days - Number of days to analyze
     * @returns {Promise<Array>}
     */
    static async getDailyTrend(days = 30) {
        const sql = `
            SELECT 
                DATE(created_at) as date, 
                COUNT(*) as usage_count,
                user_type
            FROM help_metrics 
            WHERE action = 'view' AND created_at >= datetime('now', '-${days} days')
            GROUP BY DATE(created_at), user_type
            ORDER BY date DESC
        `;

        try {
            const rows = await database.all(sql);
            return rows;
        } catch (error) {
            console.error(`Failed to get daily trend: ${error.message}`);
            return [];
        }
    }

    /**
     * Clean up old metrics (keep only last 90 days)
     * @returns {Promise<number>}
     */
    static async cleanup() {
        const sql = `DELETE FROM help_metrics WHERE created_at < datetime('now', '-90 days')`;
        
        try {
            const result = await database.run(sql);
            console.log(`Cleaned up ${result.changes} old help metrics`);
            return result.changes;
        } catch (error) {
            console.error(`Failed to cleanup help metrics: ${error.message}`);
            return 0;
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
            user_type: this.user_type,
            menu_section: this.menu_section,
            action: this.action,
            response_time: this.response_time,
            created_at: this.created_at
        };
    }
}

module.exports = HelpMetrics;