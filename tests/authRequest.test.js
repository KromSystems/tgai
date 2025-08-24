/**
 * AuthRequest Model Tests
 * Unit tests for the AuthRequest model functionality
 */

const AuthRequest = require('../src/database/models/authRequest');
const User = require('../src/database/models/user');
const database = require('../src/database/connection');

// Mock database connection
jest.mock('../src/database/connection', () => ({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn()
}));

// Mock User model
jest.mock('../src/database/models/user');

// Mock file system
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    unlinkSync: jest.fn()
}));

const fs = require('fs');

describe('AuthRequest Model', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Creating AuthRequest', () => {
        test('should create new auth request with valid data', async () => {
            const requestData = {
                user_id: 1,
                telegram_id: 123456789,
                nickname: 'Test_User',
                photo_path: '/path/to/photo.jpg',
                status: 'pending'
            };

            database.run.mockResolvedValue({ id: 1 });
            database.get.mockResolvedValue({
                id: 1,
                ...requestData,
                submitted_at: new Date().toISOString()
            });

            const authRequest = await AuthRequest.create(requestData);

            expect(database.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO auth_requests'),
                [1, 123456789, 'Test_User', '/path/to/photo.jpg', 'pending']
            );
            expect(authRequest).toBeInstanceOf(AuthRequest);
        });

        test('should set default status to pending if not provided', async () => {
            const requestData = {
                user_id: 1,
                telegram_id: 123456789,
                nickname: 'Test_User',
                photo_path: '/path/to/photo.jpg'
            };

            database.run.mockResolvedValue({ id: 1 });
            database.get.mockResolvedValue({
                id: 1,
                ...requestData,
                status: 'pending',
                submitted_at: new Date().toISOString()
            });

            await AuthRequest.create(requestData);

            expect(database.run).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining([1, 123456789, 'Test_User', '/path/to/photo.jpg', 'pending'])
            );
        });
    });

    describe('Finding AuthRequests', () => {
        test('should find auth request by ID', async () => {
            const requestData = {
                id: 1,
                user_id: 1,
                telegram_id: 123456789,
                nickname: 'Test_User',
                photo_path: '/path/to/photo.jpg',
                status: 'pending'
            };

            database.get.mockResolvedValue(requestData);

            const authRequest = await AuthRequest.findById(1);

            expect(database.get).toHaveBeenCalledWith(
                'SELECT * FROM auth_requests WHERE id = ?',
                [1]
            );
            expect(authRequest).toBeInstanceOf(AuthRequest);
            expect(authRequest.id).toBe(1);
            expect(authRequest.nickname).toBe('Test_User');
        });

        test('should return null if auth request not found', async () => {
            database.get.mockResolvedValue(null);

            const authRequest = await AuthRequest.findById(999);

            expect(authRequest).toBeNull();
        });

        test('should find auth request by telegram ID', async () => {
            const requestData = {
                id: 1,
                user_id: 1,
                telegram_id: 123456789,
                nickname: 'Test_User',
                status: 'pending'
            };

            database.get.mockResolvedValue(requestData);

            const authRequest = await AuthRequest.findByTelegramId(123456789);

            expect(database.get).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM auth_requests WHERE telegram_id = ?'),
                [123456789]
            );
            expect(authRequest.telegram_id).toBe(123456789);
        });

        test('should find pending auth requests', async () => {
            const pendingRequests = [
                { id: 1, status: 'pending', telegram_id: 123 },
                { id: 2, status: 'pending', telegram_id: 456 }
            ];

            database.all.mockResolvedValue(pendingRequests);

            const requests = await AuthRequest.findPending();

            expect(database.all).toHaveBeenCalledWith(
                'SELECT * FROM auth_requests WHERE status = ? ORDER BY submitted_at ASC',
                ['pending']
            );
            expect(requests).toHaveLength(2);
            expect(requests[0]).toBeInstanceOf(AuthRequest);
        });
    });

    describe('Updating AuthRequest Status', () => {
        test('should update request status to approved', async () => {
            const authRequest = new AuthRequest({
                id: 1,
                user_id: 1,
                telegram_id: 123456789,
                status: 'pending'
            });

            database.run.mockResolvedValue({ changes: 1 });

            await authRequest.updateStatus('approved', 999);

            expect(database.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE auth_requests'),
                ['approved', 999, 1]
            );
            expect(authRequest.status).toBe('approved');
            expect(authRequest.admin_id).toBe(999);
        });

        test('should update request status to rejected', async () => {
            const authRequest = new AuthRequest({
                id: 1,
                status: 'pending'
            });

            database.run.mockResolvedValue({ changes: 1 });

            await authRequest.updateStatus('rejected', 999);

            expect(authRequest.status).toBe('rejected');
            expect(authRequest.admin_id).toBe(999);
        });

        test('should throw error for invalid status', async () => {
            const authRequest = new AuthRequest({ id: 1 });

            await expect(authRequest.updateStatus('invalid_status')).rejects.toThrow(
                'Invalid status: invalid_status'
            );
        });
    });

    describe('Photo File Management', () => {
        test('should check if photo exists', () => {
            const authRequest = new AuthRequest({
                photo_path: '/path/to/photo.jpg'
            });

            fs.existsSync.mockReturnValue(true);

            expect(authRequest.photoExists()).toBe(true);
            expect(fs.existsSync).toHaveBeenCalledWith('/path/to/photo.jpg');
        });

        test('should return false if photo path is null', () => {
            const authRequest = new AuthRequest({
                photo_path: null
            });

            expect(authRequest.photoExists()).toBe(false);
        });

        test('should get photo buffer', async () => {
            const authRequest = new AuthRequest({
                photo_path: '/path/to/photo.jpg'
            });

            const mockBuffer = Buffer.from('photo data');
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(mockBuffer);

            const buffer = await authRequest.getPhotoBuffer();

            expect(buffer).toBe(mockBuffer);
            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/photo.jpg');
        });

        test('should return null if photo does not exist', async () => {
            const authRequest = new AuthRequest({
                photo_path: '/path/to/nonexistent.jpg'
            });

            fs.existsSync.mockReturnValue(false);

            const buffer = await authRequest.getPhotoBuffer();

            expect(buffer).toBeNull();
        });

        test('should delete photo file', async () => {
            const authRequest = new AuthRequest({
                photo_path: '/path/to/photo.jpg'
            });

            fs.existsSync.mockReturnValue(true);
            fs.unlinkSync.mockImplementation(() => {});

            const result = await authRequest.deletePhoto();

            expect(result).toBe(true);
            expect(fs.unlinkSync).toHaveBeenCalledWith('/path/to/photo.jpg');
        });
    });

    describe('Status Check Methods', () => {
        test('should correctly identify pending status', () => {
            const authRequest = new AuthRequest({ status: 'pending' });
            expect(authRequest.isPending()).toBe(true);
            expect(authRequest.isApproved()).toBe(false);
            expect(authRequest.isRejected()).toBe(false);
        });

        test('should correctly identify approved status', () => {
            const authRequest = new AuthRequest({ status: 'approved' });
            expect(authRequest.isPending()).toBe(false);
            expect(authRequest.isApproved()).toBe(true);
            expect(authRequest.isRejected()).toBe(false);
        });

        test('should correctly identify rejected status', () => {
            const authRequest = new AuthRequest({ status: 'rejected' });
            expect(authRequest.isPending()).toBe(false);
            expect(authRequest.isApproved()).toBe(false);
            expect(authRequest.isRejected()).toBe(true);
        });
    });

    describe('Associated Data', () => {
        test('should get associated user', async () => {
            const mockUser = { id: 1, telegram_id: 123456789 };
            User.findById.mockResolvedValue(mockUser);

            const authRequest = new AuthRequest({
                id: 1,
                user_id: 1
            });

            const user = await authRequest.getUser();

            expect(User.findById).toHaveBeenCalledWith(1);
            expect(user).toBe(mockUser);
        });

        test('should get processing admin', async () => {
            const mockAdmin = { id: 999, telegram_id: 987654321 };
            User.findById.mockResolvedValue(mockAdmin);

            const authRequest = new AuthRequest({
                id: 1,
                admin_id: 999
            });

            const admin = await authRequest.getAdmin();

            expect(User.findById).toHaveBeenCalledWith(999);
            expect(admin).toBe(mockAdmin);
        });

        test('should return null if no admin assigned', async () => {
            const authRequest = new AuthRequest({
                id: 1,
                admin_id: null
            });

            const admin = await authRequest.getAdmin();

            expect(admin).toBeNull();
            expect(User.findById).not.toHaveBeenCalled();
        });
    });

    describe('Deletion', () => {
        test('should delete auth request and photo', async () => {
            const authRequest = new AuthRequest({
                id: 1,
                photo_path: '/path/to/photo.jpg'
            });

            fs.existsSync.mockReturnValue(true);
            fs.unlinkSync.mockImplementation(() => {});
            database.run.mockResolvedValue({ changes: 1 });

            const result = await authRequest.delete();

            expect(fs.unlinkSync).toHaveBeenCalledWith('/path/to/photo.jpg');
            expect(database.run).toHaveBeenCalledWith(
                'DELETE FROM auth_requests WHERE id = ?',
                [1]
            );
            expect(result).toBe(true);
        });
    });

    describe('JSON Serialization', () => {
        test('should convert to JSON correctly', () => {
            const authRequest = new AuthRequest({
                id: 1,
                user_id: 1,
                telegram_id: 123456789,
                nickname: 'Test_User',
                photo_path: '/path/to/photo.jpg',
                status: 'pending',
                admin_id: null,
                submitted_at: '2023-01-01T00:00:00.000Z',
                processed_at: null
            });

            const json = authRequest.toJSON();

            expect(json).toEqual({
                id: 1,
                user_id: 1,
                telegram_id: 123456789,
                nickname: 'Test_User',
                photo_path: '/path/to/photo.jpg',
                status: 'pending',
                admin_id: null,
                submitted_at: '2023-01-01T00:00:00.000Z',
                processed_at: null
            });
        });
    });

    describe('Date Formatting', () => {
        test('should format submission date correctly', () => {
            const authRequest = new AuthRequest({
                submitted_at: '2023-12-25T15:30:00.000Z'
            });

            const formattedDate = authRequest.getFormattedSubmissionDate();

            expect(formattedDate).toMatch(/\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}/);
        });

        test('should return Unknown for null submission date', () => {
            const authRequest = new AuthRequest({
                submitted_at: null
            });

            const formattedDate = authRequest.getFormattedSubmissionDate();

            expect(formattedDate).toBe('Unknown');
        });
    });
});