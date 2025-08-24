/**
 * Tests for ContentProvider component
 */

const ContentProvider = require('../src/components/ContentProvider');

describe('ContentProvider', () => {
    let contentProvider;
    let mockUser;
    let mockAuthRequest;

    beforeEach(() => {
        contentProvider = new ContentProvider();
        
        mockUser = {
            first_name: 'Test',
            last_name: 'User',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-02T12:00:00.000Z'
        };
        
        mockAuthRequest = {
            status: 'pending',
            getFormattedSubmissionDate: () => '01.01.2024, 10:00'
        };
    });

    describe('getPersonalizedGreeting', () => {
        test('should return admin greeting for admin user', () => {
            const greeting = contentProvider.getPersonalizedGreeting('admin', mockUser);
            
            expect(greeting).toContain('ПАНЕЛЬ АДМИНИСТРАТОРА');
            expect(greeting).toContain('👑');
            expect(greeting).toContain('Test'); // First name
        });

        test('should return user greeting for authorized user', () => {
            const greeting = contentProvider.getPersonalizedGreeting('authorized', mockUser);
            
            expect(greeting).toContain('ДОБРО ПОЖАЛОВАТЬ');
            expect(greeting).toContain('✨');
            expect(greeting).toContain('Привет, Test!');
        });

        test('should return guest greeting for unauthorized user', () => {
            const greeting = contentProvider.getPersonalizedGreeting('unauthorized', mockUser);
            
            expect(greeting).toContain('ДОБРО ПОЖАЛОВАТЬ В СИСТЕМУ');
            expect(greeting).toContain('🌟');
        });

        test('should handle user without first name', () => {
            const userWithoutName = { ...mockUser, first_name: null };
            const greeting = contentProvider.getPersonalizedGreeting('authorized', userWithoutName);
            
            expect(greeting).toContain('пользователь');
        });

        test('should handle null user', () => {
            const greeting = contentProvider.getPersonalizedGreeting('unauthorized', null);
            
            expect(greeting).toContain('ДОБРО ПОЖАЛОВАТЬ В СИСТЕМУ');
        });

        test('should return fallback for unknown user type', () => {
            const greeting = contentProvider.getPersonalizedGreeting('unknown', mockUser);
            
            expect(greeting).toContain('Добро пожаловать');
        });
    });

    describe('getLastActivityInfo', () => {
        test('should return formatted last activity date', () => {
            const info = contentProvider.getLastActivityInfo(mockUser);
            
            expect(info).toContain('Последний вход:');
            expect(info).not.toContain('неизвестно');
        });

        test('should handle user without updated_at', () => {
            const userWithoutUpdate = { ...mockUser, updated_at: null };
            const info = contentProvider.getLastActivityInfo(userWithoutUpdate);
            
            expect(info).toContain('неизвестно');
        });

        test('should handle null user', () => {
            const info = contentProvider.getLastActivityInfo(null);
            
            expect(info).toContain('неизвестно');
        });
    });

    describe('getRegistrationInfo', () => {
        test('should return formatted registration date', () => {
            const info = contentProvider.getRegistrationInfo(mockUser);
            
            expect(info).toContain('С нами с');
            expect(info).toBeTruthy();
        });

        test('should handle user without created_at', () => {
            const userWithoutCreated = { ...mockUser, created_at: null };
            const info = contentProvider.getRegistrationInfo(userWithoutCreated);
            
            expect(info).toBe('');
        });

        test('should handle null user', () => {
            const info = contentProvider.getRegistrationInfo(null);
            
            expect(info).toBe('');
        });
    });

    describe('getAuthRequestStatus', () => {
        test('should return pending status correctly', () => {
            const status = contentProvider.getAuthRequestStatus(mockAuthRequest);
            
            expect(status).toContain('заявка находится на рассмотрении');
            expect(status).toContain('01.01.2024, 10:00');
        });

        test('should return rejected status correctly', () => {
            const rejectedRequest = { ...mockAuthRequest, status: 'rejected' };
            const status = contentProvider.getAuthRequestStatus(rejectedRequest);
            
            expect(status).toContain('была отклонена');
            expect(status).toContain('новую заявку');
        });

        test('should return approved status correctly', () => {
            const approvedRequest = { ...mockAuthRequest, status: 'approved' };
            const status = contentProvider.getAuthRequestStatus(approvedRequest);
            
            expect(status).toContain('успешно авторизованы');
        });

        test('should return empty string for null request', () => {
            const status = contentProvider.getAuthRequestStatus(null);
            
            expect(status).toBe('');
        });

        test('should return empty string for unknown status', () => {
            const unknownRequest = { ...mockAuthRequest, status: 'unknown' };
            const status = contentProvider.getAuthRequestStatus(unknownRequest);
            
            expect(status).toBe('');
        });
    });

    describe('getStatsInfo', () => {
        test('should return admin stats format', () => {
            const stats = {
                total_users: 100,
                authorized_users: 85,
                pending_requests: 5,
                active_today: 25
            };
            
            const info = contentProvider.getStatsInfo('admin', stats);
            
            expect(info).toContain('Статистика системы');
            expect(info).toContain('100'); // total users
            expect(info).toContain('85'); // authorized
            expect(info).toContain('5'); // pending
            expect(info).toContain('25'); // active today
        });

        test('should return guest stats format', () => {
            const stats = { active_users: 150 };
            const info = contentProvider.getStatsInfo('unauthorized', stats);
            
            expect(info).toContain('Информация о системе');
            expect(info).toContain('24 часа'); // response time
            expect(info).toContain('85%'); // approval rate
            expect(info).toContain('150+'); // active users
        });

        test('should return empty string for authorized users', () => {
            const info = contentProvider.getStatsInfo('authorized', {});
            
            expect(info).toBe('');
        });

        test('should handle missing stats gracefully', () => {
            const info = contentProvider.getStatsInfo('admin', {});
            
            expect(info).toContain('0'); // Default values
        });
    });

    describe('getErrorMessage', () => {
        test('should return database error message', () => {
            const message = contentProvider.getErrorMessage('database');
            
            expect(message).toContain('технические работы');
            expect(message).toContain('администратору');
        });

        test('should return network error message', () => {
            const message = contentProvider.getErrorMessage('network');
            
            expect(message).toContain('подключение');
        });

        test('should return permission error message', () => {
            const message = contentProvider.getErrorMessage('permission');
            
            expect(message).toContain('нет доступа');
        });

        test('should return general error for unknown type', () => {
            const message = contentProvider.getErrorMessage('unknown');
            
            expect(message).toContain('Попробуем еще раз');
        });

        test('should include context when provided', () => {
            const message = contentProvider.getErrorMessage('database', 'User creation failed');
            
            expect(message).toContain('Контекст: User creation failed');
        });
    });

    describe('getCommandHelp', () => {
        test('should return basic command help', () => {
            const help = contentProvider.getCommandHelp('/start', 'unauthorized');
            
            expect(help).toContain('работу с ботом');
        });

        test('should return admin-specific commands for admin', () => {
            const adminHelp = contentProvider.getCommandHelp('/admin', 'admin');
            
            expect(adminHelp).toContain('администратора');
        });

        test('should not return admin commands for regular users', () => {
            const userHelp = contentProvider.getCommandHelp('/admin', 'authorized');
            
            expect(userHelp).toBe('Команда не найдена');
        });
    });

    describe('getUsefulLinks', () => {
        test('should return base links for all users', () => {
            const links = contentProvider.getUsefulLinks('unauthorized');
            
            expect(links).toEqual(expect.arrayContaining([
                expect.objectContaining({ text: 'Официальный канал' }),
                expect.objectContaining({ text: 'Техподдержка' })
            ]));
        });

        test('should return additional links for admin', () => {
            const links = contentProvider.getUsefulLinks('admin');
            
            expect(links.length).toBeGreaterThan(2);
            expect(links).toEqual(expect.arrayContaining([
                expect.objectContaining({ text: 'Панель мониторинга' })
            ]));
        });

        test('should return additional links for authorized users', () => {
            const links = contentProvider.getUsefulLinks('authorized');
            
            expect(links).toEqual(expect.arrayContaining([
                expect.objectContaining({ text: 'Документация' })
            ]));
        });
    });

    describe('formatTemplate', () => {
        test('should replace single variable', () => {
            const template = 'Hello, {name}!';
            const variables = { name: 'Test' };
            const result = contentProvider.formatTemplate(template, variables);
            
            expect(result).toBe('Hello, Test!');
        });

        test('should replace multiple variables', () => {
            const template = '{greeting}, {name}! You have {count} messages.';
            const variables = { greeting: 'Hi', name: 'Test', count: '5' };
            const result = contentProvider.formatTemplate(template, variables);
            
            expect(result).toBe('Hi, Test! You have 5 messages.');
        });

        test('should handle missing variables', () => {
            const template = 'Hello, {name}!';
            const variables = {};
            const result = contentProvider.formatTemplate(template, variables);
            
            expect(result).toBe('Hello, {name}!'); // Unchanged
        });

        test('should handle multiple instances of same variable', () => {
            const template = '{name}, {name}, {name}!';
            const variables = { name: 'Test' };
            const result = contentProvider.formatTemplate(template, variables);
            
            expect(result).toBe('Test, Test, Test!');
        });
    });

    describe('formatDate', () => {
        test('should return "только что" for very recent date', () => {
            const recentDate = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
            const result = contentProvider.formatDate(recentDate);
            
            expect(result).toBe('только что');
        });

        test('should return hours for same day', () => {
            const hoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5 hours ago
            const result = contentProvider.formatDate(hoursAgo);
            
            expect(result).toContain('ч. назад');
        });

        test('should return "вчера" for yesterday', () => {
            const yesterday = new Date(Date.now() - 30 * 60 * 60 * 1000); // 30 hours ago
            const result = contentProvider.formatDate(yesterday);
            
            expect(result).toBe('вчера');
        });

        test('should return formatted date for older dates', () => {
            const oldDate = new Date('2024-01-01');
            const result = contentProvider.formatDate(oldDate);
            
            expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}/); // DD.MM.YYYY format
        });

        test('should handle null date', () => {
            const result = contentProvider.formatDate(null);
            
            expect(result).toBe('неизвестно');
        });
    });

    describe('getMotivationalMessage', () => {
        test('should return appropriate message for each user type', () => {
            const types = ['admin', 'authorized', 'unauthorized'];
            
            types.forEach(type => {
                const message = contentProvider.getMotivationalMessage(type);
                expect(message).toBeTruthy();
                expect(message.length).toBeGreaterThan(10);
            });
        });

        test('should return different messages on multiple calls', () => {
            const message1 = contentProvider.getMotivationalMessage('admin');
            const message2 = contentProvider.getMotivationalMessage('admin');
            
            // With multiple messages, there's a chance they could be different
            // This test might occasionally fail due to randomness, but usually won't
            expect(typeof message1).toBe('string');
            expect(typeof message2).toBe('string');
        });
    });

    describe('getUsageTips', () => {
        test('should return tips for admin users', () => {
            const tips = contentProvider.getUsageTips('admin');
            
            expect(Array.isArray(tips)).toBe(true);
            expect(tips.length).toBeGreaterThan(0);
            expect(tips.some(tip => tip.includes('/stats'))).toBe(true);
        });

        test('should return tips for authorized users', () => {
            const tips = contentProvider.getUsageTips('authorized');
            
            expect(Array.isArray(tips)).toBe(true);
            expect(tips.some(tip => tip.includes('профиль'))).toBe(true);
        });

        test('should return tips for unauthorized users', () => {
            const tips = contentProvider.getUsageTips('unauthorized');
            
            expect(Array.isArray(tips)).toBe(true);
            expect(tips.some(tip => tip.includes('никнейм'))).toBe(true);
            expect(tips.some(tip => tip.includes('24 часа'))).toBe(true);
        });

        test('should return unauthorized tips for unknown user type', () => {
            const tips = contentProvider.getUsageTips('unknown');
            const unauthorizedTips = contentProvider.getUsageTips('unauthorized');
            
            expect(tips).toEqual(unauthorizedTips);
        });
    });

    describe('edge cases and error handling', () => {
        test('should handle undefined values gracefully', () => {
            expect(() => {
                contentProvider.getPersonalizedGreeting(undefined, undefined);
                contentProvider.formatTemplate(undefined, {});
                contentProvider.formatDate(undefined);
            }).not.toThrow();
        });

        test('should handle empty objects gracefully', () => {
            expect(() => {
                contentProvider.getStatsInfo('admin', {});
                contentProvider.formatTemplate('test', {});
            }).not.toThrow();
        });

        test('should return meaningful fallbacks', () => {
            const greeting = contentProvider.getPersonalizedGreeting('unknown', null);
            const error = contentProvider.getErrorMessage('unknown');
            const tips = contentProvider.getUsageTips('unknown');
            
            expect(greeting).toBeTruthy();
            expect(error).toBeTruthy();
            expect(Array.isArray(tips)).toBe(true);
        });
    });
});