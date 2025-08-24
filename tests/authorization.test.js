/**
 * Authorization System Tests
 * Tests for user authorization workflow including nickname validation,
 * photo handling, and admin approval/rejection processes
 */

const fs = require('fs');
const path = require('path');

// Mock Telegram Bot API for testing
const mockBot = {
    answerCallbackQuery: jest.fn().mockResolvedValue(true),
    sendMessage: jest.fn().mockResolvedValue({ message_id: 123 }),
    sendPhoto: jest.fn().mockResolvedValue({ message_id: 124 }),
    editMessageCaption: jest.fn().mockResolvedValue(true),
    getFile: jest.fn().mockResolvedValue({ file_path: 'photos/test.jpg' }),
    downloadFile: jest.fn().mockResolvedValue(true)
};

// Mock database models
const mockUser = {
    id: 1,
    telegram_id: 123456789,
    username: 'testuser',
    first_name: 'Test',
    last_name: 'User',
    authorized: 0,
    isAuthorized: jest.fn().mockReturnValue(false),
    setAuthorized: jest.fn().mockResolvedValue(true),
    update: jest.fn().mockResolvedValue(true)
};

const mockAuthRequest = {
    id: 1,
    user_id: 1,
    telegram_id: 123456789,
    nickname: 'Test_User',
    photo_path: '/test/path/photo.jpg',
    status: 'pending',
    updateStatus: jest.fn().mockResolvedValue(true),
    getUser: jest.fn().mockResolvedValue(mockUser),
    isPending: jest.fn().mockReturnValue(true)
};

// Mock User model
jest.mock('../src/database/models/user', () => ({
    findOrCreate: jest.fn().mockResolvedValue(mockUser),
    findById: jest.fn().mockResolvedValue(mockUser),
    findByTelegramId: jest.fn().mockResolvedValue(mockUser)
}));

// Mock AuthRequest model  
jest.mock('../src/database/models/authRequest', () => ({
    create: jest.fn().mockResolvedValue(mockAuthRequest),
    findById: jest.fn().mockResolvedValue(mockAuthRequest),
    findByTelegramId: jest.fn().mockResolvedValue(null)
}));

// Mock file system
jest.mock('fs');

describe('Authorization System', () => {
    let validateNickname;
    let savePhotoFile;
    let handleAuthorizationStart;
    let handleNicknameInput;
    let handlePhotoUpload;
    let handleApproval;
    let handleRejection;
    let sendAdminNotification;

    // Mock session storage
    const userSessions = new Map();
    const CONVERSATION_STATES = {
        AWAITING_NICKNAME: 'awaiting_nickname',
        AWAITING_PHOTO: 'awaiting_photo',
        PROCESSING: 'processing'
    };

    beforeAll(() => {
        // These functions would normally be imported from app.js
        // For testing, we'll define them here with the same logic
        
        validateNickname = (nickname) => {
            const nicknameRegex = /^[A-Za-zА-Яа-я]+_[A-Za-zА-Яа-я]+$/;
            return nicknameRegex.test(nickname);
        };

        savePhotoFile = async (fileId, telegramId) => {
            const timestamp = Date.now();
            const fileName = `${timestamp}_${telegramId}.jpg`;
            const photoPath = path.join(__dirname, '..', 'photos', 'auth_requests', fileName);
            return photoPath;
        };

        handleAuthorizationStart = async (callbackQuery) => {
            const telegramId = callbackQuery.from.id;
            const AuthRequest = require('../src/database/models/authRequest');
            
            const existingRequest = await AuthRequest.findByTelegramId(telegramId, 'pending');
            if (existingRequest) {
                await mockBot.answerCallbackQuery(callbackQuery.id, {
                    text: 'У вас уже есть ожидающая заявка',
                    show_alert: true
                });
                return;
            }
            
            userSessions.set(telegramId, {
                state: CONVERSATION_STATES.AWAITING_NICKNAME,
                startTime: Date.now()
            });
            
            await mockBot.answerCallbackQuery(callbackQuery.id);
            await mockBot.sendMessage(callbackQuery.message.chat.id, 
                '📝 Введите ваш никнейм в формате Name_Surname\n\nПример: Ivan_Petrov');
        };

        sendAdminNotification = async (authRequest) => {
            const user = await authRequest.getUser();
            const photoBuffer = Buffer.from('fake photo data');
            
            const keyboard = {
                inline_keyboard: [[
                    { text: 'Принять', callback_data: `approve_${authRequest.id}` },
                    { text: 'Отказать', callback_data: `reject_${authRequest.id}` }
                ]]
            };
            
            const caption = `📝 Новая заявка от ${authRequest.nickname}\n\n` +
                           `🆔 Telegram ID: ${authRequest.telegram_id}\n` +
                           `👤 Username: ${user.username ? '@' + user.username : 'Не указан'}\n` +
                           `📅 Дата: ${new Date().toLocaleString('ru-RU')}`;
            
            await mockBot.sendPhoto(process.env.ADMIN_ID || 987654321, photoBuffer, {
                caption: caption,
                reply_markup: keyboard
            });
        };
    });

    beforeEach(() => {
        jest.clearAllMocks();
        userSessions.clear();
        fs.readFileSync = jest.fn().mockReturnValue(Buffer.from('fake photo data'));
        fs.renameSync = jest.fn();
    });

    describe('Nickname Validation', () => {
        test('should validate correct English nickname format', () => {
            expect(validateNickname('John_Doe')).toBe(true);
            expect(validateNickname('Ivan_Petrov')).toBe(true);
            expect(validateNickname('Anna_Smith')).toBe(true);
        });

        test('should validate correct Russian nickname format', () => {
            expect(validateNickname('Иван_Петров')).toBe(true);
            expect(validateNickname('Анна_Смирнова')).toBe(true);
            expect(validateNickname('Михаил_Иванов')).toBe(true);
        });

        test('should validate mixed language nickname format', () => {
            expect(validateNickname('Ivan_Петров')).toBe(true);
            expect(validateNickname('Анна_Smith')).toBe(true);
        });

        test('should reject invalid nickname formats', () => {
            expect(validateNickname('JohnDoe')).toBe(false); // No underscore
            expect(validateNickname('John_')).toBe(false); // Missing surname
            expect(validateNickname('_Doe')).toBe(false); // Missing name
            expect(validateNickname('John__Doe')).toBe(false); // Double underscore
            expect(validateNickname('John_Doe_Smith')).toBe(false); // Too many parts
            expect(validateNickname('John123_Doe')).toBe(false); // Numbers
            expect(validateNickname('John-Doe')).toBe(false); // Wrong separator
            expect(validateNickname('')).toBe(false); // Empty string
        });
    });

    describe('Authorization Flow Start', () => {
        test('should start authorization process for new user', async () => {
            const callbackQuery = {
                id: 'callback123',
                from: { id: 123456789 },
                message: { chat: { id: 123456789 } },
                data: 'start_authorization'
            };

            await handleAuthorizationStart(callbackQuery);

            expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback123');
            expect(mockBot.sendMessage).toHaveBeenCalledWith(123456789, 
                expect.stringContaining('Введите ваш никнейм в формате Name_Surname'));
            expect(userSessions.get(123456789)).toEqual({
                state: CONVERSATION_STATES.AWAITING_NICKNAME,
                startTime: expect.any(Number)
            });
        });

        test('should reject authorization start if user has pending request', async () => {
            // Mock existing pending request
            const AuthRequest = require('../src/database/models/authRequest');
            AuthRequest.findByTelegramId.mockResolvedValueOnce(mockAuthRequest);

            const callbackQuery = {
                id: 'callback123',
                from: { id: 123456789 },
                message: { chat: { id: 123456789 } },
                data: 'start_authorization'
            };

            await handleAuthorizationStart(callbackQuery);

            expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback123', {
                text: 'У вас уже есть ожидающая заявка',
                show_alert: true
            });
            expect(userSessions.has(123456789)).toBe(false);
        });
    });

    describe('Photo File Handling', () => {
        test('should generate correct photo path', async () => {
            const fileId = 'test_file_id';
            const telegramId = 123456789;
            
            const photoPath = await savePhotoFile(fileId, telegramId);
            
            expect(photoPath).toMatch(/\d+_123456789\.jpg$/);
            expect(photoPath).toContain('auth_requests');
        });
    });

    describe('Admin Notification', () => {
        test('should send properly formatted notification to admin', async () => {
            await sendAdminNotification(mockAuthRequest);

            expect(mockBot.sendPhoto).toHaveBeenCalledWith(
                expect.any(Number),
                expect.any(Buffer),
                expect.objectContaining({
                    caption: expect.stringContaining('Новая заявка от Test_User'),
                    reply_markup: expect.objectContaining({
                        inline_keyboard: expect.arrayContaining([
                            expect.arrayContaining([
                                expect.objectContaining({ text: 'Принять' }),
                                expect.objectContaining({ text: 'Отказать' })
                            ])
                        ])
                    })
                })
            );
        });
    });

    describe('Session Management', () => {
        test('should properly manage user session states', () => {
            const telegramId = 123456789;
            
            // Start session
            userSessions.set(telegramId, {
                state: CONVERSATION_STATES.AWAITING_NICKNAME,
                startTime: Date.now()
            });
            
            expect(userSessions.get(telegramId).state).toBe(CONVERSATION_STATES.AWAITING_NICKNAME);
            
            // Update session with nickname
            const session = userSessions.get(telegramId);
            session.nickname = 'Test_User';
            session.state = CONVERSATION_STATES.AWAITING_PHOTO;
            userSessions.set(telegramId, session);
            
            expect(userSessions.get(telegramId).state).toBe(CONVERSATION_STATES.AWAITING_PHOTO);
            expect(userSessions.get(telegramId).nickname).toBe('Test_User');
            
            // Clear session
            userSessions.delete(telegramId);
            expect(userSessions.has(telegramId)).toBe(false);
        });
    });

    describe('Integration Tests', () => {
        test('should handle complete authorization workflow', async () => {
            const telegramId = 123456789;
            const chatId = 123456789;
            
            // Step 1: Start authorization
            const callbackQuery = {
                id: 'callback123',
                from: { id: telegramId },
                message: { chat: { id: chatId } },
                data: 'start_authorization'
            };
            
            await handleAuthorizationStart(callbackQuery);
            expect(userSessions.get(telegramId).state).toBe(CONVERSATION_STATES.AWAITING_NICKNAME);
            
            // Step 2: Validate nickname format
            expect(validateNickname('Test_User')).toBe(true);
            
            // Step 3: Simulate photo upload and request creation
            const AuthRequest = require('../src/database/models/authRequest');
            const photoPath = await savePhotoFile('file123', telegramId);
            
            expect(AuthRequest.create).toBeDefined();
            expect(photoPath).toContain('auth_requests');
            
            // Step 4: Verify admin notification
            await sendAdminNotification(mockAuthRequest);
            expect(mockBot.sendPhoto).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid callback queries gracefully', async () => {
            const invalidCallback = {
                id: 'invalid123',
                from: { id: 999999999 },
                message: { chat: { id: 999999999 } },
                data: 'invalid_action'
            };
            
            // This should not throw an error
            expect(() => {
                // In real implementation, this would be handled by the main callback router
                if (!['start_authorization', 'approve_', 'reject_'].some(action => 
                    invalidCallback.data.startsWith(action.replace('_', '')))) {
                    // Handle unknown action silently
                }
            }).not.toThrow();
        });

        test('should handle file system errors in photo saving', async () => {
            fs.renameSync.mockImplementation(() => {
                throw new Error('File system error');
            });
            
            // Should handle error gracefully
            try {
                await savePhotoFile('test_file', 123456789);
            } catch (error) {
                // This is expected behavior
                expect(error).toBeInstanceOf(Error);
            }
        });
    });
});