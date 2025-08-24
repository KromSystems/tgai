/**
 * Tests for MenuBuilder component
 */

const MenuBuilder = require('../src/components/MenuBuilder');
const User = require('../src/database/models/user');

describe('MenuBuilder', () => {
    let menuBuilder;
    let mockUser;
    let mockAuthRequest;

    beforeEach(() => {
        menuBuilder = new MenuBuilder();
        
        // Mock user object
        mockUser = {
            id: 1,
            telegram_id: 123456789,
            username: 'testuser',
            first_name: 'Test',
            last_name: 'User',
            authorized: 1,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-02T12:00:00.000Z',
            getFullName: () => 'Test User',
            isAuthorized: () => true
        };
        
        // Mock auth request
        mockAuthRequest = {
            id: 1,
            status: 'pending',
            getFormattedSubmissionDate: () => '01.01.2024, 10:00'
        };
    });

    describe('buildAdminMenu', () => {
        test('should build admin menu with correct structure', () => {
            const result = menuBuilder.buildAdminMenu(mockUser);
            
            expect(result).toHaveProperty('text');
            expect(result).toHaveProperty('keyboard');
            expect(result.text).toContain('ПАНЕЛЬ АДМИНИСТРАТОРА');
            expect(result.text).toContain('👑');
            expect(result.keyboard.inline_keyboard).toBeDefined();
            expect(result.keyboard.inline_keyboard.length).toBeGreaterThan(0);
        });

        test('should include all admin sections in keyboard', () => {
            const result = menuBuilder.buildAdminMenu(mockUser);
            const buttons = result.keyboard.inline_keyboard.flat();
            const buttonTexts = buttons.map(btn => btn.text);
            
            expect(buttonTexts.some(text => text.includes('Пользователи'))).toBe(true);
            expect(buttonTexts.some(text => text.includes('Статистика'))).toBe(true);
            expect(buttonTexts.some(text => text.includes('Настройки'))).toBe(true);
        });

        test('should have correct callback data for admin buttons', () => {
            const result = menuBuilder.buildAdminMenu(mockUser);
            const buttons = result.keyboard.inline_keyboard.flat();
            const callbackData = buttons.map(btn => btn.callback_data);
            
            expect(callbackData).toContain('help_admin_users');
            expect(callbackData).toContain('help_admin_stats');
            expect(callbackData).toContain('help_admin_settings');
        });
    });

    describe('buildUserMenu', () => {
        test('should build user menu with personalized greeting', () => {
            const result = menuBuilder.buildUserMenu(mockUser);
            
            expect(result.text).toContain('ДОБРО ПОЖАЛОВАТЬ');
            expect(result.text).toContain('Test'); // First name
            expect(result.text).toContain('Авторизованный пользователь');
            expect(result.keyboard.inline_keyboard).toBeDefined();
        });

        test('should include user-specific sections', () => {
            const result = menuBuilder.buildUserMenu(mockUser);
            const buttons = result.keyboard.inline_keyboard.flat();
            const buttonTexts = buttons.map(btn => btn.text);
            
            expect(buttonTexts.some(text => text.includes('Профиль'))).toBe(true);
            expect(buttonTexts.some(text => text.includes('Настройки'))).toBe(true);
            expect(buttonTexts.some(text => text.includes('Поддержка'))).toBe(true);
        });

        test('should show last login date when available', () => {
            const result = menuBuilder.buildUserMenu(mockUser);
            expect(result.text).toMatch(/Последний вход:/);
        });
    });

    describe('buildGuestMenu', () => {
        test('should build guest menu without user', () => {
            const result = menuBuilder.buildGuestMenu(null);
            
            expect(result.text).toContain('ДОБРО ПОЖАЛОВАТЬ В СИСТЕМУ');
            expect(result.text).toContain('не авторизованы');
            expect(result.keyboard.inline_keyboard).toBeDefined();
        });

        test('should show auth request status when provided', () => {
            const result = menuBuilder.buildGuestMenu(null, mockAuthRequest);
            
            expect(result.text).toContain('заявка находится на рассмотрении');
            expect(result.text).toContain('01.01.2024, 10:00');
        });

        test('should include authorization button', () => {
            const result = menuBuilder.buildGuestMenu(null);
            const buttons = result.keyboard.inline_keyboard.flat();
            const authButton = buttons.find(btn => btn.text.includes('Авторизоваться'));
            
            expect(authButton).toBeDefined();
            expect(authButton.callback_data).toBe('start_authorization');
        });

        test('should handle rejected auth request', () => {
            const rejectedRequest = { ...mockAuthRequest, status: 'rejected' };
            const result = menuBuilder.buildGuestMenu(null, rejectedRequest);
            
            expect(result.text).toContain('была отклонена');
        });
    });

    describe('buildAdminUsersMenu', () => {
        test('should build admin users menu with stats', () => {
            const stats = { total: 100, authorized: 85, blocked: 5 };
            const pendingRequests = [{ id: 1 }, { id: 2 }];
            
            const result = menuBuilder.buildAdminUsersMenu(pendingRequests, stats);
            
            expect(result.text).toContain('УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ');
            expect(result.text).toContain('100'); // total users
            expect(result.text).toContain('85'); // authorized users
            expect(result.text).toContain('2'); // pending requests count
        });

        test('should show notification when there are pending requests', () => {
            const pendingRequests = [{ id: 1 }, { id: 2 }, { id: 3 }];
            const result = menuBuilder.buildAdminUsersMenu(pendingRequests, {});
            
            expect(result.text).toContain('3 новых заявок');
        });

        test('should show all processed message when no pending requests', () => {
            const result = menuBuilder.buildAdminUsersMenu([], {});
            
            expect(result.text).toContain('Все заявки обработаны');
        });
    });

    describe('buildUserProfileMenu', () => {
        test('should build profile menu with user data', () => {
            const result = menuBuilder.buildUserProfileMenu(mockUser);
            
            expect(result.text).toContain('МОЙ ПРОФИЛЬ');
            expect(result.text).toContain('Test User'); // Full name
            expect(result.text).toContain('123456789'); // Telegram ID
            expect(result.text).toContain('Авторизован');
        });

        test('should include profile management buttons', () => {
            const result = menuBuilder.buildUserProfileMenu(mockUser);
            const buttons = result.keyboard.inline_keyboard.flat();
            const buttonTexts = buttons.map(btn => btn.text);
            
            expect(buttonTexts.some(text => text.includes('Редактировать'))).toBe(true);
            expect(buttonTexts.some(text => text.includes('История'))).toBe(true);
        });
    });

    describe('buildAboutSystemMenu', () => {
        test('should build system info menu', () => {
            const result = menuBuilder.buildAboutSystemMenu();
            
            expect(result.text).toContain('О СИСТЕМЕ');
            expect(result.text).toContain('Цель проекта');
            expect(result.text).toContain('Возможности');
            expect(result.text).toContain('Технологии');
        });

        test('should include documentation links', () => {
            const result = menuBuilder.buildAboutSystemMenu();
            const buttons = result.keyboard.inline_keyboard.flat();
            const buttonTexts = buttons.map(btn => btn.text);
            
            expect(buttonTexts.some(text => text.includes('документация'))).toBe(true);
        });
    });

    describe('buildRulesMenu', () => {
        test('should build rules menu with numbered rules', () => {
            const result = menuBuilder.buildRulesMenu();
            
            expect(result.text).toContain('ПРАВИЛА СООБЩЕСТВА');
            expect(result.text).toContain('1️⃣');
            expect(result.text).toContain('2️⃣');
            expect(result.text).toContain('Уважение к участникам');
        });
    });

    describe('buildContactsMenu', () => {
        test('should build contacts menu with admin info', () => {
            const result = menuBuilder.buildContactsMenu();
            
            expect(result.text).toContain('КОНТАКТЫ');
            expect(result.text).toContain('Администратор');
            expect(result.text).toContain('@admin_username');
            expect(result.text).toContain('Время ответа');
        });

        test('should include contact buttons with URLs', () => {
            const result = menuBuilder.buildContactsMenu();
            const buttons = result.keyboard.inline_keyboard.flat();
            const urlButtons = buttons.filter(btn => btn.url);
            
            expect(urlButtons.length).toBeGreaterThan(0);
            expect(urlButtons.some(btn => btn.url.includes('t.me'))).toBe(true);
        });
    });

    describe('buildFAQMenu', () => {
        test('should build FAQ menu with common questions', () => {
            const result = menuBuilder.buildFAQMenu();
            
            expect(result.text).toContain('ЧАСТО ЗАДАВАЕМЫЕ ВОПРОСЫ');
            expect(result.text).toContain('❓');
            expect(result.text).toContain('авторизацию');
            expect(result.text).toContain('24 часа');
        });

        test('should include FAQ interaction buttons', () => {
            const result = menuBuilder.buildFAQMenu();
            const buttons = result.keyboard.inline_keyboard.flat();
            const buttonTexts = buttons.map(btn => btn.text);
            
            expect(buttonTexts.some(text => text.includes('Поиск'))).toBe(true);
            expect(buttonTexts.some(text => text.includes('вопрос'))).toBe(true);
        });
    });

    describe('menu validation', () => {
        test('all menus should have back button', () => {
            const menus = [
                menuBuilder.buildAboutSystemMenu(),
                menuBuilder.buildRulesMenu(),
                menuBuilder.buildContactsMenu(),
                menuBuilder.buildFAQMenu(),
                menuBuilder.buildUserProfileMenu(mockUser)
            ];

            menus.forEach(menu => {
                const buttons = menu.keyboard.inline_keyboard.flat();
                const hasBackButton = buttons.some(btn => 
                    btn.text.includes('Назад') || btn.callback_data === 'help_main'
                );
                expect(hasBackButton).toBe(true);
            });
        });

        test('all menus should have non-empty text', () => {
            const menus = [
                menuBuilder.buildAdminMenu(mockUser),
                menuBuilder.buildUserMenu(mockUser),
                menuBuilder.buildGuestMenu(null),
                menuBuilder.buildAboutSystemMenu(),
                menuBuilder.buildRulesMenu(),
                menuBuilder.buildContactsMenu(),
                menuBuilder.buildFAQMenu()
            ];

            menus.forEach(menu => {
                expect(menu.text).toBeTruthy();
                expect(menu.text.length).toBeGreaterThan(10);
            });
        });

        test('all menus should have valid keyboard structure', () => {
            const menus = [
                menuBuilder.buildAdminMenu(mockUser),
                menuBuilder.buildUserMenu(mockUser),
                menuBuilder.buildGuestMenu(null)
            ];

            menus.forEach(menu => {
                expect(menu.keyboard).toHaveProperty('inline_keyboard');
                expect(Array.isArray(menu.keyboard.inline_keyboard)).toBe(true);
                
                menu.keyboard.inline_keyboard.forEach(row => {
                    expect(Array.isArray(row)).toBe(true);
                    row.forEach(button => {
                        expect(button).toHaveProperty('text');
                        expect(button.text.length).toBeGreaterThan(0);
                        expect(button).toSatisfy(btn => 
                            btn.hasOwnProperty('callback_data') || btn.hasOwnProperty('url')
                        );
                    });
                });
            });
        });
    });
});