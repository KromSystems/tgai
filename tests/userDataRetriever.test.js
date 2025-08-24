/**
 * Unit tests for UserDataRetriever component
 */

const UserDataRetriever = require('../src/components/UserDataRetriever');
const User = require('../src/database/models/user');
const TelegramModel = require('../src/database/models/telegram');
const AuthRequest = require('../src/database/models/authRequest');
const HelpMetrics = require('../src/database/models/helpMetrics');

// Mock database models
jest.mock('../src/database/models/user');
jest.mock('../src/database/models/telegram');
jest.mock('../src/database/models/authRequest');
jest.mock('../src/database/models/helpMetrics');

describe('UserDataRetriever', () => {
    let userDataRetriever;
    let adminId;

    beforeEach(() => {
        adminId = 12345;
        userDataRetriever = new UserDataRetriever(adminId);
        
        // Reset all mocks
        jest.clearAllMocks();
    });

    describe('Constructor', () => {
        test('should initialize with admin ID', () => {
            expect(userDataRetriever.adminId).toBe(adminId);
        });
    });

    describe('getUserProfileData', () => {
        test('should return complete profile data for admin user', async () => {
            const telegramId = adminId;
            const mockUserData = {
                telegram_id: telegramId,
                username: 'admin',
                first_name: 'Admin',
                last_name: 'User',
                authorized: 1,
                created_at: '2023-01-01T00:00:00Z',
                updated_at: '2023-12-01T00:00:00Z'
            };

            const mockAuthRequest = {
                status: 'none',
                submittedAt: null,
                hasRequest: false
            };

            const mockHelpMetric = {
                created_at: '2023-12-01T10:00:00Z'
            };

            User.findByTelegramId.mockResolvedValue({ toJSON: () => mockUserData });
            AuthRequest.findByTelegramId.mockResolvedValue(null);
            HelpMetrics.findRecentByTelegramId.mockResolvedValue(mockHelpMetric);

            const result = await userDataRetriever.getUserProfileData(telegramId);

            expect(result).toEqual(expect.objectContaining({
                telegram_id: telegramId,
                username: 'admin',
                first_name: 'Admin',
                last_name: 'User',
                authorized: 1,
                isAdmin: true,
                authRequest: mockAuthRequest,
                lastActivity: expect.any(String),
                memberSince: expect.any(String),
                profileCompleteness: expect.any(Number),
                statusInfo: expect.objectContaining({
                    type: 'admin',
                    badge: '👑 Лидер',
                    emoji: '👑',
                    level: 'Администратор'
                })
            }));
        });

        test('should return complete profile data for authorized user', async () => {
            const telegramId = 67890;
            const mockUserData = {
                telegram_id: telegramId,
                username: 'testuser',
                first_name: 'Test',
                last_name: 'User',
                authorized: 1,
                created_at: '2023-06-01T00:00:00Z'
            };

            User.findByTelegramId.mockResolvedValue({ toJSON: () => mockUserData });
            AuthRequest.findByTelegramId.mockResolvedValue(null);
            HelpMetrics.findRecentByTelegramId.mockResolvedValue(null);

            const result = await userDataRetriever.getUserProfileData(telegramId);

            expect(result).toEqual(expect.objectContaining({
                telegram_id: telegramId,
                isAdmin: false,
                statusInfo: expect.objectContaining({
                    type: 'authorized',
                    badge: '✅ Авторизован',
                    emoji: '✅',
                    level: 'Авторизованный пользователь'
                })
            }));
        });

        test('should return complete profile data for unauthorized user', async () => {
            const telegramId = 99999;
            const mockUserData = {
                telegram_id: telegramId,
                username: 'newuser',
                first_name: 'New',
                authorized: 0,
                created_at: '2023-12-01T00:00:00Z'
            };

            User.findByTelegramId.mockResolvedValue({ toJSON: () => mockUserData });
            AuthRequest.findByTelegramId.mockResolvedValue(null);
            HelpMetrics.findRecentByTelegramId.mockResolvedValue(null);

            const result = await userDataRetriever.getUserProfileData(telegramId);

            expect(result).toEqual(expect.objectContaining({
                telegram_id: telegramId,
                isAdmin: false,
                statusInfo: expect.objectContaining({
                    type: 'unauthorized',
                    badge: '🔒 Не авторизован',
                    emoji: '🔒',
                    level: 'Новичок'
                })
            }));
        });

        test('should throw error when user not found', async () => {
            const telegramId = 99999;
            
            User.findByTelegramId.mockResolvedValue(null);
            TelegramModel.findByTelegramId.mockResolvedValue(null);

            await expect(userDataRetriever.getUserProfileData(telegramId))
                .rejects.toThrow('Failed to retrieve user profile data: User not found');
        });

        test('should create user from telegram data if user not found', async () => {
            const telegramId = 88888;
            const mockTelegramData = {
                telegram_id: telegramId,
                username: 'fromtelegram',
                first_name: 'Telegram',
                last_name: 'User'
            };

            const mockCreatedUser = {
                telegram_id: telegramId,
                username: 'fromtelegram',
                first_name: 'Telegram',
                last_name: 'User',
                authorized: 0,
                created_at: '2023-12-01T00:00:00Z'
            };

            User.findByTelegramId.mockResolvedValue(null);
            TelegramModel.findByTelegramId.mockResolvedValue(mockTelegramData);
            User.create.mockResolvedValue({ toJSON: () => mockCreatedUser });
            AuthRequest.findByTelegramId.mockResolvedValue(null);
            HelpMetrics.findRecentByTelegramId.mockResolvedValue(null);

            const result = await userDataRetriever.getUserProfileData(telegramId);

            expect(User.create).toHaveBeenCalledWith({
                telegram_id: telegramId,
                username: 'fromtelegram',
                first_name: 'Telegram',
                last_name: 'User',
                authorized: 0
            });
            expect(result.telegram_id).toBe(telegramId);
        });
    });

    describe('getUserData', () => {
        test('should return user data when user exists', async () => {
            const telegramId = 12345;
            const mockUser = {
                toJSON: () => ({ telegram_id: telegramId, username: 'test' })
            };

            User.findByTelegramId.mockResolvedValue(mockUser);

            const result = await userDataRetriever.getUserData(telegramId);

            expect(result).toEqual({ telegram_id: telegramId, username: 'test' });
            expect(User.findByTelegramId).toHaveBeenCalledWith(telegramId);
        });

        test('should return null when user does not exist', async () => {
            const telegramId = 99999;
            
            User.findByTelegramId.mockResolvedValue(null);
            TelegramModel.findByTelegramId.mockResolvedValue(null);

            const result = await userDataRetriever.getUserData(telegramId);

            expect(result).toBeNull();
        });

        test('should handle database errors', async () => {
            const telegramId = 12345;
            const error = new Error('Database connection failed');
            
            User.findByTelegramId.mockRejectedValue(error);

            await expect(userDataRetriever.getUserData(telegramId))
                .rejects.toThrow('Failed to get user data: Database connection failed');
        });
    });

    describe('getAuthRequestData', () => {
        test('should return auth request data when request exists', async () => {
            const telegramId = 12345;
            const mockAuthRequest = {
                status: 'pending',
                submitted_at: '2023-12-01T00:00:00Z'
            };

            AuthRequest.findByTelegramId.mockResolvedValue(mockAuthRequest);

            const result = await userDataRetriever.getAuthRequestData(telegramId);

            expect(result).toEqual({
                status: 'pending',
                submittedAt: '2023-12-01T00:00:00Z',
                hasRequest: true
            });
        });

        test('should return no request data when no request exists', async () => {
            const telegramId = 12345;
            
            AuthRequest.findByTelegramId.mockResolvedValue(null);

            const result = await userDataRetriever.getAuthRequestData(telegramId);

            expect(result).toEqual({
                status: 'none',
                submittedAt: null,
                hasRequest: false
            });
        });

        test('should handle auth request errors gracefully', async () => {
            const telegramId = 12345;
            const error = new Error('Auth request query failed');
            
            AuthRequest.findByTelegramId.mockRejectedValue(error);

            const result = await userDataRetriever.getAuthRequestData(telegramId);

            expect(result).toEqual({
                status: 'unknown',
                submittedAt: null,
                hasRequest: false
            });
        });
    });

    describe('getLastActivity', () => {
        test('should return formatted last activity from help metrics', async () => {
            const telegramId = 12345;
            const mockHelpMetric = {
                created_at: new Date().toISOString()
            };

            HelpMetrics.findRecentByTelegramId.mockResolvedValue(mockHelpMetric);

            const result = await userDataRetriever.getLastActivity(telegramId);

            expect(result).toBe('Только что');
            expect(HelpMetrics.findRecentByTelegramId).toHaveBeenCalledWith(telegramId);
        });

        test('should fallback to user updated_at when no help metrics', async () => {
            const telegramId = 12345;
            const mockUser = {
                updated_at: new Date().toISOString()
            };

            HelpMetrics.findRecentByTelegramId.mockResolvedValue(null);
            User.findByTelegramId.mockResolvedValue(mockUser);

            const result = await userDataRetriever.getLastActivity(telegramId);

            expect(result).toBe('Только что');
        });

        test('should return unknown when no activity data available', async () => {
            const telegramId = 12345;

            HelpMetrics.findRecentByTelegramId.mockResolvedValue(null);
            User.findByTelegramId.mockResolvedValue(null);

            const result = await userDataRetriever.getLastActivity(telegramId);

            expect(result).toBe('Неизвестно');
        });
    });

    describe('calculateProfileCompleteness', () => {
        test('should calculate 100% for complete profile', () => {
            const userData = {
                telegram_id: 12345,
                username: 'test',
                first_name: 'Test',
                last_name: 'User',
                language_code: 'ru'
            };

            const completeness = userDataRetriever.calculateProfileCompleteness(userData);

            expect(completeness).toBe(100);
        });

        test('should calculate 60% for partial profile', () => {
            const userData = {
                telegram_id: 12345,
                username: 'test',
                first_name: 'Test',
                last_name: null,
                language_code: null
            };

            const completeness = userDataRetriever.calculateProfileCompleteness(userData);

            expect(completeness).toBe(60);
        });

        test('should calculate 20% for minimal profile', () => {
            const userData = {
                telegram_id: 12345,
                username: null,
                first_name: null,
                last_name: null,
                language_code: null
            };

            const completeness = userDataRetriever.calculateProfileCompleteness(userData);

            expect(completeness).toBe(20);
        });
    });

    describe('getStatusInfo', () => {
        test('should return admin status info', () => {
            const userData = { authorized: 1 };
            const isAdmin = true;

            const statusInfo = userDataRetriever.getStatusInfo(userData, isAdmin);

            expect(statusInfo).toEqual({
                type: 'admin',
                badge: '👑 Лидер',
                emoji: '👑',
                level: 'Администратор',
                description: 'Полные административные права'
            });
        });

        test('should return authorized status info', () => {
            const userData = { authorized: 1 };
            const isAdmin = false;

            const statusInfo = userDataRetriever.getStatusInfo(userData, isAdmin);

            expect(statusInfo).toEqual({
                type: 'authorized',
                badge: '✅ Авторизован',
                emoji: '✅',
                level: 'Авторизованный пользователь',
                description: 'Полный доступ к функциям бота'
            });
        });

        test('should return unauthorized status info', () => {
            const userData = { authorized: 0 };
            const isAdmin = false;

            const statusInfo = userDataRetriever.getStatusInfo(userData, isAdmin);

            expect(statusInfo).toEqual({
                type: 'unauthorized',
                badge: '🔒 Не авторизован',
                emoji: '🔒',
                level: 'Новичок',
                description: 'Ограниченный доступ'
            });
        });
    });

    describe('formatMemberSince', () => {
        test('should return "Сегодня" for today', () => {
            const today = new Date().toISOString();
            const result = userDataRetriever.formatMemberSince(today);
            expect(result).toBe('Сегодня');
        });

        test('should return "Вчера" for yesterday', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const result = userDataRetriever.formatMemberSince(yesterday.toISOString());
            expect(result).toBe('Вчера');
        });

        test('should return days for recent dates', () => {
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            const result = userDataRetriever.formatMemberSince(threeDaysAgo.toISOString());
            expect(result).toBe('3 дней назад');
        });

        test('should return "Неизвестно" for invalid date', () => {
            const result = userDataRetriever.formatMemberSince(null);
            expect(result).toBe('Неизвестно');
        });

        test('should handle date parsing errors', () => {
            const result = userDataRetriever.formatMemberSince('invalid-date');
            expect(result).toBe('Неизвестно');
        });
    });

    describe('formatLastActivity', () => {
        test('should return "Только что" for very recent activity', () => {
            const now = new Date().toISOString();
            const result = userDataRetriever.formatLastActivity(now);
            expect(result).toBe('Только что');
        });

        test('should return minutes for recent activity', () => {
            const fiveMinutesAgo = new Date();
            fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
            const result = userDataRetriever.formatLastActivity(fiveMinutesAgo.toISOString());
            expect(result).toBe('5 мин назад');
        });

        test('should return "Неизвестно" for null timestamp', () => {
            const result = userDataRetriever.formatLastActivity(null);
            expect(result).toBe('Неизвестно');
        });
    });

    describe('getDisplayName', () => {
        test('should return full name when available', () => {
            const userData = { first_name: 'John', last_name: 'Doe' };
            const result = userDataRetriever.getDisplayName(userData);
            expect(result).toBe('John Doe');
        });

        test('should return first name only when last name missing', () => {
            const userData = { first_name: 'John', last_name: null };
            const result = userDataRetriever.getDisplayName(userData);
            expect(result).toBe('John');
        });

        test('should return username when name missing', () => {
            const userData = { first_name: null, last_name: null, username: 'johndoe' };
            const result = userDataRetriever.getDisplayName(userData);
            expect(result).toBe('@johndoe');
        });

        test('should return fallback when all data missing', () => {
            const userData = { telegram_id: 12345 };
            const result = userDataRetriever.getDisplayName(userData);
            expect(result).toBe('Пользователь 12345');
        });
    });

    describe('getUsername', () => {
        test('should return username with @ prefix', () => {
            const userData = { username: 'johndoe' };
            const result = userDataRetriever.getUsername(userData);
            expect(result).toBe('@johndoe');
        });

        test('should return fallback when username missing', () => {
            const userData = { username: null };
            const result = userDataRetriever.getUsername(userData);
            expect(result).toBe('Не указан');
        });
    });

    describe('getLanguageDisplay', () => {
        test('should return Russian display name', () => {
            const result = userDataRetriever.getLanguageDisplay('ru');
            expect(result).toBe('🇷🇺 Русский');
        });

        test('should return English display name', () => {
            const result = userDataRetriever.getLanguageDisplay('en');
            expect(result).toBe('🇺🇸 English');
        });

        test('should return unknown language code as is', () => {
            const result = userDataRetriever.getLanguageDisplay('unknown');
            expect(result).toBe('unknown');
        });

        test('should return fallback for null language code', () => {
            const result = userDataRetriever.getLanguageDisplay(null);
            expect(result).toBe('Не указан');
        });
    });
});