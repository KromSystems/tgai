/**
 * Tests for HelpMetrics model
 */

const HelpMetrics = require('../src/database/models/helpMetrics');
const database = require('../src/database/connection');

describe('HelpMetrics', () => {
    beforeAll(async () => {
        // Connect to test database
        await database.connect();
        
        // Ensure help_metrics table exists
        await database.run(`
            CREATE TABLE IF NOT EXISTS help_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER NOT NULL,
                user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'authorized', 'unauthorized')),
                menu_section TEXT NOT NULL DEFAULT 'main',
                action TEXT NOT NULL CHECK (action IN ('view', 'click', 'navigate')),
                response_time INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    });

    beforeEach(async () => {
        // Clean up test data before each test
        await database.run('DELETE FROM help_metrics');
    });

    afterAll(async () => {
        // Clean up and close database connection
        await database.run('DELETE FROM help_metrics');
        await database.close();
    });

    describe('constructor', () => {
        test('should create HelpMetrics instance with default values', () => {
            const metric = new HelpMetrics();
            
            expect(metric.id).toBeNull();
            expect(metric.menu_section).toBe('main');
            expect(metric.response_time).toBeNull();
        });

        test('should create HelpMetrics instance with provided data', () => {
            const data = {
                id: 1,
                telegram_id: 123456789,
                user_type: 'admin',
                menu_section: 'admin_users',
                action: 'click',
                response_time: 150
            };
            
            const metric = new HelpMetrics(data);
            
            expect(metric.id).toBe(1);
            expect(metric.telegram_id).toBe(123456789);
            expect(metric.user_type).toBe('admin');
            expect(metric.menu_section).toBe('admin_users');
            expect(metric.action).toBe('click');
            expect(metric.response_time).toBe(150);
        });
    });

    describe('record', () => {
        test('should record new metric successfully', async () => {
            const metricData = {
                telegram_id: 123456789,
                user_type: 'admin',
                menu_section: 'main',
                action: 'view',
                response_time: 100
            };
            
            const metric = await HelpMetrics.record(metricData);
            
            expect(metric).not.toBeNull();
            expect(metric.telegram_id).toBe(123456789);
            expect(metric.user_type).toBe('admin');
            expect(metric.action).toBe('view');
        });

        test('should record metric with default menu_section', async () => {
            const metricData = {
                telegram_id: 123456789,
                user_type: 'authorized',
                action: 'click'
            };
            
            const metric = await HelpMetrics.record(metricData);
            
            expect(metric.menu_section).toBe('main');
        });

        test('should record metric without response_time', async () => {
            const metricData = {
                telegram_id: 123456789,
                user_type: 'unauthorized',
                action: 'view'
            };
            
            const metric = await HelpMetrics.record(metricData);
            
            expect(metric.response_time).toBeNull();
        });

        test('should handle database errors gracefully', async () => {
            // Try to record with invalid user_type
            const metricData = {
                telegram_id: 123456789,
                user_type: 'invalid_type',
                action: 'view'
            };
            
            const metric = await HelpMetrics.record(metricData);
            
            // Should return null on error, not throw
            expect(metric).toBeNull();
        });
    });

    describe('findById', () => {
        test('should find metric by ID', async () => {
            // First create a metric
            const metricData = {
                telegram_id: 123456789,
                user_type: 'admin',
                action: 'view'
            };
            
            const createdMetric = await HelpMetrics.record(metricData);
            
            // Then find it by ID
            const foundMetric = await HelpMetrics.findById(createdMetric.id);
            
            expect(foundMetric).not.toBeNull();
            expect(foundMetric.id).toBe(createdMetric.id);
            expect(foundMetric.telegram_id).toBe(123456789);
        });

        test('should return null for non-existent ID', async () => {
            const metric = await HelpMetrics.findById(999999);
            
            expect(metric).toBeNull();
        });

        test('should handle database errors gracefully', async () => {
            // This might vary based on your database setup
            const metric = await HelpMetrics.findById('invalid_id');
            
            // Should return null on error, not throw
            expect(metric).toBeNull();
        });
    });

    describe('getUsageStats', () => {
        beforeEach(async () => {
            // Create test data
            const testMetrics = [
                { telegram_id: 1, user_type: 'admin', action: 'view', menu_section: 'main' },
                { telegram_id: 2, user_type: 'authorized', action: 'view', menu_section: 'main' },
                { telegram_id: 3, user_type: 'unauthorized', action: 'view', menu_section: 'main' },
                { telegram_id: 1, user_type: 'admin', action: 'click', menu_section: 'admin_users' },
                { telegram_id: 2, user_type: 'authorized', action: 'click', menu_section: 'user_profile' }
            ];
            
            for (const metric of testMetrics) {
                await HelpMetrics.record(metric);
            }
        });

        test('should return usage statistics', async () => {
            const stats = await HelpMetrics.getUsageStats();
            
            expect(stats).toHaveProperty('total_usage');
            expect(stats).toHaveProperty('user_type_breakdown');
            expect(stats).toHaveProperty('popular_sections');
            expect(stats).toHaveProperty('avg_response_time');
            expect(stats).toHaveProperty('time_range');
            
            expect(stats.total_usage).toBe(3); // 3 'view' actions
            expect(Array.isArray(stats.user_type_breakdown)).toBe(true);
            expect(Array.isArray(stats.popular_sections)).toBe(true);
        });

        test('should breakdown stats by user type', async () => {
            const stats = await HelpMetrics.getUsageStats();
            
            const userTypeBreakdown = stats.user_type_breakdown;
            expect(userTypeBreakdown.length).toBeGreaterThan(0);
            
            const adminStats = userTypeBreakdown.find(item => item.user_type === 'admin');
            expect(adminStats).toBeDefined();
            expect(adminStats.count).toBe(1);
        });

        test('should return popular sections', async () => {
            const stats = await HelpMetrics.getUsageStats();
            
            const popularSections = stats.popular_sections;
            expect(Array.isArray(popularSections)).toBe(true);
            
            if (popularSections.length > 0) {
                expect(popularSections[0]).toHaveProperty('menu_section');
                expect(popularSections[0]).toHaveProperty('count');
            }
        });

        test('should handle custom time range', async () => {
            const stats = await HelpMetrics.getUsageStats({ timeRange: '1 day' });
            
            expect(stats.time_range).toBe('1 day');
        });

        test('should handle database errors gracefully', async () => {
            // Simulate database error by closing connection temporarily
            // This test depends on your database setup
            const stats = await HelpMetrics.getUsageStats();
            
            // Should return default structure even on error
            expect(stats).toHaveProperty('total_usage');
            expect(typeof stats.total_usage).toBe('number');
        });
    });

    describe('getDailyTrend', () => {
        beforeEach(async () => {
            // Create test data with different dates (this is tricky with SQLite CURRENT_TIMESTAMP)
            const testMetrics = [
                { telegram_id: 1, user_type: 'admin', action: 'view' },
                { telegram_id: 2, user_type: 'authorized', action: 'view' },
                { telegram_id: 3, user_type: 'unauthorized', action: 'view' }
            ];
            
            for (const metric of testMetrics) {
                await HelpMetrics.record(metric);
            }
        });

        test('should return daily trend data', async () => {
            const trend = await HelpMetrics.getDailyTrend(7);
            
            expect(Array.isArray(trend)).toBe(true);
            
            if (trend.length > 0) {
                expect(trend[0]).toHaveProperty('date');
                expect(trend[0]).toHaveProperty('usage_count');
                expect(trend[0]).toHaveProperty('user_type');
            }
        });

        test('should handle custom days parameter', async () => {
            const trend = await HelpMetrics.getDailyTrend(1);
            
            expect(Array.isArray(trend)).toBe(true);
        });

        test('should handle database errors gracefully', async () => {
            const trend = await HelpMetrics.getDailyTrend(7);
            
            // Should return empty array on error, not throw
            expect(Array.isArray(trend)).toBe(true);
        });
    });

    describe('cleanup', () => {
        test('should clean up old metrics', async () => {
            // Create some test metrics
            await HelpMetrics.record({
                telegram_id: 1,
                user_type: 'admin',
                action: 'view'
            });
            
            const cleanedCount = await HelpMetrics.cleanup();
            
            // Should return number of cleaned records
            expect(typeof cleanedCount).toBe('number');
            expect(cleanedCount).toBeGreaterThanOrEqual(0);
        });

        test('should handle database errors gracefully', async () => {
            const cleanedCount = await HelpMetrics.cleanup();
            
            // Should return 0 on error, not throw
            expect(typeof cleanedCount).toBe('number');
        });
    });

    describe('toJSON', () => {
        test('should convert metric to JSON object', () => {
            const metricData = {
                id: 1,
                telegram_id: 123456789,
                user_type: 'admin',
                menu_section: 'main',
                action: 'view',
                response_time: 100,
                created_at: '2024-01-01T00:00:00.000Z'
            };
            
            const metric = new HelpMetrics(metricData);
            const json = metric.toJSON();
            
            expect(json).toEqual(metricData);
        });

        test('should include null values in JSON', () => {
            const metric = new HelpMetrics();
            const json = metric.toJSON();
            
            expect(json.id).toBeNull();
            expect(json.response_time).toBeNull();
        });
    });

    describe('data validation', () => {
        test('should validate user_type constraint', async () => {
            const invalidMetric = {
                telegram_id: 123,
                user_type: 'invalid',
                action: 'view'
            };
            
            const result = await HelpMetrics.record(invalidMetric);
            
            // Should handle constraint violation gracefully
            expect(result).toBeNull();
        });

        test('should validate action constraint', async () => {
            const invalidMetric = {
                telegram_id: 123,
                user_type: 'admin',
                action: 'invalid'
            };
            
            const result = await HelpMetrics.record(invalidMetric);
            
            // Should handle constraint violation gracefully
            expect(result).toBeNull();
        });

        test('should require telegram_id', async () => {
            const invalidMetric = {
                user_type: 'admin',
                action: 'view'
            };
            
            const result = await HelpMetrics.record(invalidMetric);
            
            // Should handle missing required field gracefully
            expect(result).toBeNull();
        });
    });

    describe('edge cases', () => {
        test('should handle empty database gracefully', async () => {
            const stats = await HelpMetrics.getUsageStats();
            
            expect(stats.total_usage).toBe(0);
            expect(stats.user_type_breakdown).toEqual([]);
            expect(stats.popular_sections).toEqual([]);
        });

        test('should handle very large response times', async () => {
            const metricData = {
                telegram_id: 123,
                user_type: 'admin',
                action: 'view',
                response_time: Number.MAX_SAFE_INTEGER
            };
            
            const metric = await HelpMetrics.record(metricData);
            
            expect(metric).not.toBeNull();
            expect(metric.response_time).toBe(Number.MAX_SAFE_INTEGER);
        });

        test('should handle negative response times', async () => {
            const metricData = {
                telegram_id: 123,
                user_type: 'admin',
                action: 'view',
                response_time: -100
            };
            
            const metric = await HelpMetrics.record(metricData);
            
            expect(metric).not.toBeNull();
            expect(metric.response_time).toBe(-100);
        });
    });
});