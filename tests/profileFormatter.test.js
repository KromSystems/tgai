/**
 * Unit tests for ProfileFormatter component
 */

const ProfileFormatter = require('../src/components/ProfileFormatter');

describe('ProfileFormatter', () => {
    let profileFormatter;

    beforeEach(() => {
        profileFormatter = new ProfileFormatter();
    });

    describe('Constructor', () => {
        test('should initialize with emoji constants', () => {
            expect(profileFormatter.emojis).toBeDefined();
            expect(profileFormatter.emojis.crown).toBe('👑');
            expect(profileFormatter.emojis.check).toBe('✅');
            expect(profileFormatter.emojis.lock).toBe('🔒');
        });
    });

    describe('formatProfileMessage', () => {
        test('should format complete admin profile message', () => {
            const mockProfileData = {
                telegram_id: 12345,
                username: 'admin',
                first_name: 'Admin',
                last_name: 'User',
                language_code: 'ru',
                authorized: 1,
                isAdmin: true,
                profileCompleteness: 100,
                memberSince: 'Сегодня',
                lastActivity: 'Только что',
                statusInfo: {
                    type: 'admin',
                    badge: '👑 Лидер',
                    emoji: '👑',
                    level: 'Администратор'
                },
                authRequest: {
                    hasRequest: false
                }
            };

            const result = profileFormatter.formatProfileMessage(mockProfileData);

            expect(result.message).toContain('👑 <b>Admin User</b>');
            expect(result.message).toContain('👑 Лидер');
            expect(result.message).toContain('👤 <b>Личная информация</b>');
            expect(result.message).toContain('📊 <b>Статус профиля</b>');
            expect(result.message).toContain('👑 <b>Административные привилегии</b>');
            expect(result.parseMode).toBe('HTML');
            expect(result.keyboard).toBeDefined();
            expect(result.keyboard.inline_keyboard).toBeDefined();
        });

        test('should format complete authorized user profile message', () => {
            const mockProfileData = {
                telegram_id: 67890,
                username: 'user',
                first_name: 'Test',
                last_name: 'User',
                language_code: 'en',
                authorized: 1,
                isAdmin: false,
                profileCompleteness: 80,
                memberSince: '3 дня назад',
                lastActivity: '2 ч назад',
                statusInfo: {
                    type: 'authorized',
                    badge: '✅ Авторизован',
                    emoji: '✅',
                    level: 'Авторизованный пользователь'
                },
                authRequest: {
                    hasRequest: false
                }
            };

            const result = profileFormatter.formatProfileMessage(mockProfileData);

            expect(result.message).toContain('✅ <b>Test User</b>');
            expect(result.message).toContain('✅ Авторизован');
            expect(result.message).toContain('✅ <b>Права доступа</b>');
            expect(result.message).toContain('🇺🇸 English');
            expect(result.keyboard.inline_keyboard[0]).toContainEqual(
                expect.objectContaining({ text: '📝 Редактировать профиль' })
            );
        });

        test('should format complete unauthorized user profile message', () => {
            const mockProfileData = {
                telegram_id: 99999,
                username: 'newbie',
                first_name: 'New',
                last_name: null,
                language_code: 'ru',
                authorized: 0,
                isAdmin: false,
                profileCompleteness: 60,
                memberSince: 'Неделю назад',
                lastActivity: 'Вчера',
                statusInfo: {
                    type: 'unauthorized',
                    badge: '🔒 Не авторизован',
                    emoji: '🔒',
                    level: 'Новичок'
                },
                authRequest: {
                    hasRequest: true,
                    status: 'pending'
                }
            };

            const result = profileFormatter.formatProfileMessage(mockProfileData);

            expect(result.message).toContain('🔒 <b>New</b>');
            expect(result.message).toContain('🔒 Не авторизован');
            expect(result.message).toContain('🔒 <b>Статус авторизации</b>');
            expect(result.message).toContain('Ожидает рассмотрения');
            expect(result.keyboard.inline_keyboard[0]).toContainEqual(
                expect.objectContaining({ text: '🔐 Подать заявку' })
            );
        });

        test('should handle error in message formatting', () => {
            const invalidProfileData = null;

            expect(() => profileFormatter.formatProfileMessage(invalidProfileData))
                .toThrow('Failed to format profile message');
        });
    });

    describe('buildInteractiveKeyboard', () => {
        test('should build admin keyboard', () => {
            const profileData = {
                statusInfo: { type: 'admin' },
                isAdmin: true
            };

            const keyboard = profileFormatter.buildInteractiveKeyboard(profileData);

            expect(keyboard.inline_keyboard).toHaveLength(2);
            expect(keyboard.inline_keyboard[0]).toContainEqual(
                expect.objectContaining({ text: '👥 Управление пользователями' })
            );
            expect(keyboard.inline_keyboard[0]).toContainEqual(
                expect.objectContaining({ text: '📊 Аналитика' })
            );
            expect(keyboard.inline_keyboard[1]).toContainEqual(
                expect.objectContaining({ text: '⚙️ Настройки' })
            );
        });

        test('should build authorized user keyboard', () => {
            const profileData = {
                statusInfo: { type: 'authorized' },
                isAdmin: false
            };

            const keyboard = profileFormatter.buildInteractiveKeyboard(profileData);

            expect(keyboard.inline_keyboard).toHaveLength(2);
            expect(keyboard.inline_keyboard[0]).toContainEqual(
                expect.objectContaining({ text: '📝 Редактировать профиль' })
            );
            expect(keyboard.inline_keyboard[0]).toContainEqual(
                expect.objectContaining({ text: '📊 Моя статистика' })
            );
        });

        test('should build unauthorized user keyboard', () => {
            const profileData = {
                statusInfo: { type: 'unauthorized' },
                isAdmin: false
            };

            const keyboard = profileFormatter.buildInteractiveKeyboard(profileData);

            expect(keyboard.inline_keyboard).toHaveLength(2);
            expect(keyboard.inline_keyboard[0]).toContainEqual(
                expect.objectContaining({ text: '🔐 Подать заявку' })
            );
            expect(keyboard.inline_keyboard[1]).toContainEqual(
                expect.objectContaining({ text: '❓ Помощь' })
            );
        });
    });

    describe('getDisplayName', () => {
        test('should return full name when available', () => {
            const profileData = { first_name: 'John', last_name: 'Doe' };
            const result = profileFormatter.getDisplayName(profileData);
            expect(result).toBe('John Doe');
        });

        test('should return first name only when last name missing', () => {
            const profileData = { first_name: 'John', last_name: null };
            const result = profileFormatter.getDisplayName(profileData);
            expect(result).toBe('John');
        });

        test('should return username when name missing', () => {
            const profileData = { 
                first_name: null, 
                last_name: null, 
                username: 'johndoe',
                telegram_id: 12345
            };
            const result = profileFormatter.getDisplayName(profileData);
            expect(result).toBe('@johndoe');
        });

        test('should return fallback when all data missing', () => {
            const profileData = { 
                first_name: null, 
                last_name: null, 
                username: null,
                telegram_id: 12345 
            };
            const result = profileFormatter.getDisplayName(profileData);
            expect(result).toBe('Пользователь 12345');
        });
    });

    describe('getUsername', () => {
        test('should return username with @ prefix', () => {
            const profileData = { username: 'johndoe' };
            const result = profileFormatter.getUsername(profileData);
            expect(result).toBe('@johndoe');
        });

        test('should return fallback when username missing', () => {
            const profileData = { username: null };
            const result = profileFormatter.getUsername(profileData);
            expect(result).toBe('<i>Не указан</i>');
        });
    });

    describe('getFullName', () => {
        test('should return full name when both names available', () => {
            const profileData = { first_name: 'John', last_name: 'Doe' };
            const result = profileFormatter.getFullName(profileData);
            expect(result).toBe('John Doe');
        });

        test('should return first name only when last name missing', () => {
            const profileData = { first_name: 'John', last_name: null };
            const result = profileFormatter.getFullName(profileData);
            expect(result).toBe('John');
        });

        test('should return fallback when both names missing', () => {
            const profileData = { first_name: null, last_name: null };
            const result = profileFormatter.getFullName(profileData);
            expect(result).toBe('<i>Не указано</i>');
        });
    });

    describe('getLanguageDisplay', () => {
        test('should return Russian display name', () => {
            const result = profileFormatter.getLanguageDisplay('ru');
            expect(result).toBe('🇷🇺 Русский');
        });

        test('should return English display name', () => {
            const result = profileFormatter.getLanguageDisplay('en');
            expect(result).toBe('🇺🇸 English');
        });

        test('should return Ukrainian display name', () => {
            const result = profileFormatter.getLanguageDisplay('uk');
            expect(result).toBe('🇺🇦 Українська');
        });

        test('should return unknown language code as is', () => {
            const result = profileFormatter.getLanguageDisplay('unknown');
            expect(result).toBe('unknown');
        });

        test('should return fallback for null language code', () => {
            const result = profileFormatter.getLanguageDisplay(null);
            expect(result).toBe('<i>Не указан</i>');
        });
    });

    describe('formatAuthRequestStatus', () => {
        test('should format pending status', () => {
            const authRequest = { hasRequest: true, status: 'pending' };
            const result = profileFormatter.formatAuthRequestStatus(authRequest);
            expect(result).toBe('Ожидает рассмотрения');
        });

        test('should format approved status', () => {
            const authRequest = { hasRequest: true, status: 'approved' };
            const result = profileFormatter.formatAuthRequestStatus(authRequest);
            expect(result).toBe('Одобрена');
        });

        test('should format rejected status', () => {
            const authRequest = { hasRequest: true, status: 'rejected' };
            const result = profileFormatter.formatAuthRequestStatus(authRequest);
            expect(result).toBe('Отклонена');
        });

        test('should format no request status', () => {
            const authRequest = { hasRequest: false };
            const result = profileFormatter.formatAuthRequestStatus(authRequest);
            expect(result).toBe('Не подана');
        });

        test('should handle unknown status', () => {
            const authRequest = { hasRequest: true, status: 'unknown' };
            const result = profileFormatter.formatAuthRequestStatus(authRequest);
            expect(result).toBe('Неизвестно');
        });
    });

    describe('formatProfileCompleteness', () => {
        test('should format 100% completeness with full progress bar', () => {
            const result = profileFormatter.formatProfileCompleteness(100);
            expect(result).toBe('100% [██████████]');
        });

        test('should format 50% completeness with half progress bar', () => {
            const result = profileFormatter.formatProfileCompleteness(50);
            expect(result).toBe('50% [█████░░░░░]');
        });

        test('should format 0% completeness with empty progress bar', () => {
            const result = profileFormatter.formatProfileCompleteness(0);
            expect(result).toBe('0% [░░░░░░░░░░]');
        });
    });

    describe('formatSimpleProfile', () => {
        test('should format simple profile for fallback', () => {
            const profileData = {
                first_name: 'John',
                last_name: 'Doe',
                memberSince: 'Вчера',
                lastActivity: 'Только что',
                statusInfo: {
                    emoji: '✅',
                    badge: '✅ Авторизован',
                    level: 'Авторизованный пользователь'
                }
            };

            const result = profileFormatter.formatSimpleProfile(profileData);

            expect(result).toContain('✅ John Doe');
            expect(result).toContain('Статус: ✅ Авторизован');
            expect(result).toContain('Уровень: Авторизованный пользователь');
            expect(result).toContain('Участник с: Вчера');
            expect(result).toContain('Последняя активность: Только что');
        });
    });

    describe('formatErrorMessage', () => {
        test('should format error message', () => {
            const errorMessage = 'Database connection failed';
            const result = profileFormatter.formatErrorMessage(errorMessage);

            expect(result).toContain('❌ <b>Ошибка загрузки профиля</b>');
            expect(result).toContain('Причина: Database connection failed');
            expect(result).toContain('Попробуйте позже или обратитесь к администратору.');
        });
    });

    describe('getProfileStats', () => {
        test('should return profile statistics', () => {
            const profileData = {
                profileCompleteness: 80,
                first_name: 'John',
                username: 'johndoe',
                created_at: '2023-01-01T00:00:00Z'
            };

            const stats = profileFormatter.getProfileStats(profileData);

            expect(stats).toEqual({
                completeness: 80,
                fieldsCompleted: 4,
                totalFields: 5,
                hasAvatar: true,
                hasUsername: true,
                memberDays: expect.any(Number)
            });
        });
    });

    describe('calculateMemberDays', () => {
        test('should calculate member days correctly', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            const days = profileFormatter.calculateMemberDays(yesterday.toISOString());
            
            expect(days).toBe(1);
        });

        test('should return 0 for invalid date', () => {
            const days = profileFormatter.calculateMemberDays(null);
            expect(days).toBe(0);
        });

        test('should handle date parsing errors', () => {
            const days = profileFormatter.calculateMemberDays('invalid-date');
            expect(days).toBe(0);
        });
    });
});