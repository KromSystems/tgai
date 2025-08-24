/**
 * Unit tests for ProfileHandler component
 */

const ProfileHandler = require('../src/components/ProfileHandler');
const UserDataRetriever = require('../src/components/UserDataRetriever');
const ImageSelector = require('../src/components/ImageSelector');
const ProfileFormatter = require('../src/components/ProfileFormatter');

// Mock dependencies
jest.mock('../src/components/UserDataRetriever');
jest.mock('../src/components/ImageSelector');
jest.mock('../src/components/ProfileFormatter');

describe('ProfileHandler', () => {
    let profileHandler;
    let mockBot;
    let adminId;

    beforeEach(() => {
        adminId = 12345;
        profileHandler = new ProfileHandler(adminId);
        
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock bot
        mockBot = {
            sendChatAction: jest.fn().mockResolvedValue(),
            sendPhoto: jest.fn().mockResolvedValue(),
            sendMessage: jest.fn().mockResolvedValue(),
            answerCallbackQuery: jest.fn().mockResolvedValue(),
            deleteMessage: jest.fn().mockResolvedValue()
        };

        // Mock UserDataRetriever
        UserDataRetriever.prototype.getUserProfileData = jest.fn();
        UserDataRetriever.prototype.getUserData = jest.fn();
        UserDataRetriever.prototype.getStatusInfo = jest.fn();
        UserDataRetriever.prototype.formatMemberSince = jest.fn();
        
        // Mock ImageSelector
        ImageSelector.prototype.getImageStream = jest.fn();
        ImageSelector.prototype.getHealthCheck = jest.fn().mockReturnValue({ overall: true });
        
        // Mock ProfileFormatter
        ProfileFormatter.prototype.formatProfileMessage = jest.fn();
        ProfileFormatter.prototype.formatSimpleProfile = jest.fn();
        ProfileFormatter.prototype.formatErrorMessage = jest.fn();
    });

    describe('Constructor', () => {
        test('should initialize with admin ID', () => {
            expect(profileHandler.adminId).toBe(adminId);
            expect(profileHandler.userDataRetriever).toBeInstanceOf(UserDataRetriever);
            expect(profileHandler.imageSelector).toBeInstanceOf(ImageSelector);
            expect(profileHandler.profileFormatter).toBeInstanceOf(ProfileFormatter);
        });

        test('should validate components during initialization', () => {
            expect(ImageSelector.prototype.getHealthCheck).toHaveBeenCalled();
        });
    });

    describe('handleProfileCommand', () => {
        test('should handle profile command successfully for admin user', async () => {
            const mockMsg = {
                chat: { id: 123 },
                from: { id: adminId }
            };

            const mockProfileData = {
                telegram_id: adminId,
                first_name: 'Admin',
                username: 'admin',
                authorized: 1,
                statusInfo: { type: 'admin', emoji: '👑', badge: '👑 Лидер' }
            };

            const mockFormattedProfile = {
                message: 'Formatted profile message',
                keyboard: { inline_keyboard: [] },
                parseMode: 'HTML'
            };

            const mockImageStream = 'mock-image-stream';

            UserDataRetriever.prototype.getUserProfileData.mockResolvedValue(mockProfileData);
            ProfileFormatter.prototype.formatProfileMessage.mockReturnValue(mockFormattedProfile);
            ImageSelector.prototype.getImageStream.mockReturnValue(mockImageStream);

            await profileHandler.handleProfileCommand(mockMsg, mockBot);

            expect(mockBot.sendChatAction).toHaveBeenCalledWith(123, 'typing');
            expect(UserDataRetriever.prototype.getUserProfileData).toHaveBeenCalledWith(adminId);
            expect(ProfileFormatter.prototype.formatProfileMessage).toHaveBeenCalledWith(mockProfileData);
            expect(ImageSelector.prototype.getImageStream).toHaveBeenCalledWith(mockProfileData.statusInfo);
            expect(mockBot.sendPhoto).toHaveBeenCalledWith(123, mockImageStream, {
                caption: mockFormattedProfile.message,
                parse_mode: mockFormattedProfile.parseMode,
                reply_markup: mockFormattedProfile.keyboard
            });
        });

        test('should handle profile command successfully for authorized user', async () => {
            const userId = 67890;
            const mockMsg = {
                chat: { id: 456 },
                from: { id: userId }
            };

            const mockProfileData = {
                telegram_id: userId,
                first_name: 'User',
                username: 'testuser',
                authorized: 1,
                statusInfo: { type: 'authorized', emoji: '✅', badge: '✅ Авторизован' }
            };

            UserDataRetriever.prototype.getUserProfileData.mockResolvedValue(mockProfileData);
            ProfileFormatter.prototype.formatProfileMessage.mockReturnValue({
                message: 'User profile',
                keyboard: { inline_keyboard: [] },
                parseMode: 'HTML'
            });
            ImageSelector.prototype.getImageStream.mockReturnValue('user-image-stream');

            await profileHandler.handleProfileCommand(mockMsg, mockBot);

            expect(UserDataRetriever.prototype.getUserProfileData).toHaveBeenCalledWith(userId);
            expect(mockBot.sendPhoto).toHaveBeenCalled();
        });

        test('should handle profile command successfully for unauthorized user', async () => {
            const userId = 99999;
            const mockMsg = {
                chat: { id: 789 },
                from: { id: userId }
            };

            const mockProfileData = {
                telegram_id: userId,
                first_name: 'Newbie',
                username: 'newuser',
                authorized: 0,
                statusInfo: { type: 'unauthorized', emoji: '🔒', badge: '🔒 Не авторизован' }
            };

            UserDataRetriever.prototype.getUserProfileData.mockResolvedValue(mockProfileData);
            ProfileFormatter.prototype.formatProfileMessage.mockReturnValue({
                message: 'Newbie profile',
                keyboard: { inline_keyboard: [] },
                parseMode: 'HTML'
            });
            ImageSelector.prototype.getImageStream.mockReturnValue('newbie-image-stream');

            await profileHandler.handleProfileCommand(mockMsg, mockBot);

            expect(UserDataRetriever.prototype.getUserProfileData).toHaveBeenCalledWith(userId);
            expect(mockBot.sendPhoto).toHaveBeenCalled();
        });

        test('should handle errors and send fallback message', async () => {
            const userId = 11111;
            const mockMsg = {
                chat: { id: 999 },
                from: { id: userId }
            };

            const error = new Error('Database connection failed');
            UserDataRetriever.prototype.getUserProfileData.mockRejectedValue(error);
            
            // Mock fallback data
            UserDataRetriever.prototype.getUserData.mockResolvedValue({
                telegram_id: userId,
                first_name: 'User',
                authorized: 0
            });
            UserDataRetriever.prototype.getStatusInfo.mockReturnValue({
                type: 'unauthorized',
                emoji: '🔒'
            });
            UserDataRetriever.prototype.formatMemberSince.mockReturnValue('Сегодня');
            ProfileFormatter.prototype.formatSimpleProfile.mockReturnValue('Simple profile');

            await profileHandler.handleProfileCommand(mockMsg, mockBot);

            expect(mockBot.sendMessage).toHaveBeenCalledWith(999, 'Simple profile', expect.any(Object));
        });
    });

    describe('handleProfileRefresh', () => {
        test('should refresh profile successfully', async () => {
            const mockCallbackQuery = {
                id: 'callback123',
                message: { chat: { id: 123 }, message_id: 456 },
                from: { id: adminId }
            };

            const mockProfileData = {
                telegram_id: adminId,
                statusInfo: { type: 'admin' }
            };

            UserDataRetriever.prototype.getUserProfileData.mockResolvedValue(mockProfileData);
            ProfileFormatter.prototype.formatProfileMessage.mockReturnValue({
                message: 'Refreshed profile',
                keyboard: { inline_keyboard: [] },
                parseMode: 'HTML'
            });
            ImageSelector.prototype.getImageStream.mockReturnValue('image-stream');

            await profileHandler.handleProfileRefresh(mockCallbackQuery, mockBot);

            expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback123', {
                text: 'Обновляю профиль...'
            });
            expect(mockBot.deleteMessage).toHaveBeenCalledWith(123, 456);
            expect(mockBot.sendPhoto).toHaveBeenCalled();
        });

        test('should handle refresh errors', async () => {
            const mockCallbackQuery = {
                id: 'callback456',
                message: { chat: { id: 123 }, message_id: 456 },
                from: { id: adminId }
            };

            const error = new Error('Refresh failed');
            UserDataRetriever.prototype.getUserProfileData.mockRejectedValue(error);

            await profileHandler.handleProfileRefresh(mockCallbackQuery, mockBot);

            expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback456', {
                text: 'Ошибка обновления профиля',
                show_alert: true
            });
        });
    });

    describe('getProfilePreview', () => {
        test('should return profile preview for user', async () => {
            const userId = 12345;
            const mockProfileData = {
                telegram_id: userId,
                first_name: 'Test',
                last_name: 'User',
                authorized: 1,
                statusInfo: {
                    badge: '✅ Авторизован',
                    emoji: '✅',
                    level: 'Авторизованный пользователь'
                }
            };

            UserDataRetriever.prototype.getUserProfileData.mockResolvedValue(mockProfileData);
            ProfileFormatter.prototype.getDisplayName.mockReturnValue('Test User');

            const preview = await profileHandler.getProfilePreview(userId);

            expect(preview).toEqual({
                displayName: 'Test User',
                statusBadge: '✅ Авторизован',
                statusEmoji: '✅',
                level: 'Авторизованный пользователь',
                isAuthorized: true,
                isAdmin: false
            });
        });

        test('should return error preview when data retrieval fails', async () => {
            const userId = 99999;
            const error = new Error('User not found');
            
            UserDataRetriever.prototype.getUserProfileData.mockRejectedValue(error);

            const preview = await profileHandler.getProfilePreview(userId);

            expect(preview).toEqual({
                displayName: `Пользователь ${userId}`,
                statusBadge: '❓ Неизвестно',
                statusEmoji: '❓',
                level: 'Неизвестно',
                isAuthorized: false,
                isAdmin: false,
                error: 'User not found'
            });
        });
    });

    describe('canAccessProfile', () => {
        test('should return true when user exists', async () => {
            const userId = 12345;
            UserDataRetriever.prototype.getUserData.mockResolvedValue({ telegram_id: userId });

            const canAccess = await profileHandler.canAccessProfile(userId);

            expect(canAccess).toBe(true);
        });

        test('should return false when user does not exist', async () => {
            const userId = 99999;
            UserDataRetriever.prototype.getUserData.mockResolvedValue(null);

            const canAccess = await profileHandler.canAccessProfile(userId);

            expect(canAccess).toBe(false);
        });

        test('should return false when error occurs', async () => {
            const userId = 12345;
            UserDataRetriever.prototype.getUserData.mockRejectedValue(new Error('Database error'));

            const canAccess = await profileHandler.canAccessProfile(userId);

            expect(canAccess).toBe(false);
        });
    });

    describe('handleProfileCallback', () => {
        test('should handle refresh_profile callback', async () => {
            const mockCallbackQuery = {
                id: 'callback123',
                data: 'refresh_profile',
                message: { chat: { id: 123 }, message_id: 456 },
                from: { id: adminId }
            };

            UserDataRetriever.prototype.getUserProfileData.mockResolvedValue({
                telegram_id: adminId,
                statusInfo: { type: 'admin' }
            });
            ProfileFormatter.prototype.formatProfileMessage.mockReturnValue({
                message: 'Profile',
                keyboard: { inline_keyboard: [] },
                parseMode: 'HTML'
            });
            ImageSelector.prototype.getImageStream.mockReturnValue('stream');

            const handled = await profileHandler.handleProfileCallback(mockCallbackQuery, mockBot);

            expect(handled).toBe(true);
            expect(mockBot.answerCallbackQuery).toHaveBeenCalled();
        });

        test('should handle unknown callback', async () => {
            const mockCallbackQuery = {
                id: 'callback123',
                data: 'unknown_action',
                from: { id: adminId }
            };

            const handled = await profileHandler.handleProfileCallback(mockCallbackQuery, mockBot);

            expect(handled).toBe(false);
        });

        test('should handle edit_profile callback with development message', async () => {
            const mockCallbackQuery = {
                id: 'callback123',
                data: 'edit_profile',
                from: { id: adminId }
            };

            const handled = await profileHandler.handleProfileCallback(mockCallbackQuery, mockBot);

            expect(handled).toBe(true);
            expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback123', {
                text: 'Функция редактирования профиля в разработке',
                show_alert: true
            });
        });
    });

    describe('getHealthStatus', () => {
        test('should return healthy status when all components are working', () => {
            ImageSelector.prototype.getHealthCheck.mockReturnValue({
                overall: true,
                images: { admin: { valid: true }, authorized: { valid: true }, unauthorized: { valid: true } }
            });

            const health = profileHandler.getHealthStatus();

            expect(health.overall).toBe(true);
            expect(health.components.userDataRetriever.status).toBe('healthy');
            expect(health.components.profileFormatter.status).toBe('healthy');
            expect(health.timestamp).toBeDefined();
        });

        test('should return unhealthy status when image selector fails', () => {
            ImageSelector.prototype.getHealthCheck.mockReturnValue({
                overall: false,
                images: { admin: { valid: false } }
            });

            const health = profileHandler.getHealthStatus();

            expect(health.overall).toBe(false);
        });

        test('should handle health check errors', () => {
            ImageSelector.prototype.getHealthCheck.mockImplementation(() => {
                throw new Error('Health check failed');
            });

            const health = profileHandler.getHealthStatus();

            expect(health.overall).toBe(false);
            expect(health.error).toBe('Health check failed');
        });
    });
});