/**
 * Unit tests for ImageSelector component
 */

const ImageSelector = require('../src/components/ImageSelector');
const fs = require('fs');
const path = require('path');

// Mock fs module
jest.mock('fs');

describe('ImageSelector', () => {
    let imageSelector;
    let mockImagePaths;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock image paths
        mockImagePaths = {
            admin: path.join(__dirname, '..', 'лидер.png'),
            authorized: path.join(__dirname, '..', 'авторизованные.png'),
            unauthorized: path.join(__dirname, '..', 'новички.png')
        };

        // Mock fs.existsSync to return true for all paths
        fs.existsSync.mockReturnValue(true);
        
        // Create image selector instance
        imageSelector = new ImageSelector();
    });

    describe('Constructor', () => {
        test('should initialize with correct image paths', () => {
            expect(imageSelector.imagePaths).toBeDefined();
            expect(imageSelector.imagePaths.admin).toContain('лидер.png');
            expect(imageSelector.imagePaths.authorized).toContain('авторизованные.png');
            expect(imageSelector.imagePaths.unauthorized).toContain('новички.png');
        });

        test('should validate image files during initialization', () => {
            expect(fs.existsSync).toHaveBeenCalledTimes(3);
        });

        test('should throw error if image file is missing', () => {
            fs.existsSync.mockReturnValue(false);
            
            expect(() => new ImageSelector()).toThrow(/Profile image for status .* not found at:/);
        });
    });

    describe('selectProfileImage', () => {
        test('should select admin image for admin status', () => {
            const statusInfo = { type: 'admin' };
            
            const imagePath = imageSelector.selectProfileImage(statusInfo);
            
            expect(imagePath).toBe(imageSelector.imagePaths.admin);
            expect(imagePath).toContain('лидер.png');
        });

        test('should select authorized image for authorized status', () => {
            const statusInfo = { type: 'authorized' };
            
            const imagePath = imageSelector.selectProfileImage(statusInfo);
            
            expect(imagePath).toBe(imageSelector.imagePaths.authorized);
            expect(imagePath).toContain('авторизованные.png');
        });

        test('should select unauthorized image for unauthorized status', () => {
            const statusInfo = { type: 'unauthorized' };
            
            const imagePath = imageSelector.selectProfileImage(statusInfo);
            
            expect(imagePath).toBe(imageSelector.imagePaths.unauthorized);
            expect(imagePath).toContain('новички.png');
        });

        test('should default to unauthorized image for unknown status', () => {
            const statusInfo = { type: 'unknown' };
            
            const imagePath = imageSelector.selectProfileImage(statusInfo);
            
            expect(imagePath).toBe(imageSelector.imagePaths.unauthorized);
        });

        test('should fallback to unauthorized image if selected image not found', () => {
            const statusInfo = { type: 'admin' };
            
            // Mock admin image as not existing, but unauthorized as existing
            fs.existsSync.mockImplementation((path) => {
                return !path.includes('лидер.png');
            });
            
            const imagePath = imageSelector.selectProfileImage(statusInfo);
            
            expect(imagePath).toBe(imageSelector.imagePaths.unauthorized);
        });

        test('should throw error if no fallback image available', () => {
            const statusInfo = { type: 'admin' };
            
            // Mock all images as not existing
            fs.existsSync.mockReturnValue(false);
            
            expect(() => imageSelector.selectProfileImage(statusInfo))
                .toThrow('Failed to select profile image: No fallback image available');
        });
    });

    describe('getImageBuffer', () => {
        test('should return image buffer for status', () => {
            const statusInfo = { type: 'admin' };
            const mockBuffer = Buffer.from('fake image data');
            
            fs.readFileSync.mockReturnValue(mockBuffer);
            
            const buffer = imageSelector.getImageBuffer(statusInfo);
            
            expect(buffer).toBe(mockBuffer);
            expect(fs.readFileSync).toHaveBeenCalledWith(imageSelector.imagePaths.admin);
        });

        test('should throw error if reading image fails', () => {
            const statusInfo = { type: 'admin' };
            const error = new Error('File read error');
            
            fs.readFileSync.mockImplementation(() => {
                throw error;
            });
            
            expect(() => imageSelector.getImageBuffer(statusInfo))
                .toThrow('Failed to read profile image: File read error');
        });
    });

    describe('getImageStream', () => {
        test('should return image stream for status', () => {
            const statusInfo = { type: 'authorized' };
            const mockStream = { pipe: jest.fn() };
            
            fs.createReadStream.mockReturnValue(mockStream);
            
            const stream = imageSelector.getImageStream(statusInfo);
            
            expect(stream).toBe(mockStream);
            expect(fs.createReadStream).toHaveBeenCalledWith(imageSelector.imagePaths.authorized);
        });

        test('should throw error if creating stream fails', () => {
            const statusInfo = { type: 'authorized' };
            const error = new Error('Stream creation error');
            
            fs.createReadStream.mockImplementation(() => {
                throw error;
            });
            
            expect(() => imageSelector.getImageStream(statusInfo))
                .toThrow('Failed to create image stream: Stream creation error');
        });
    });

    describe('getImageInfo', () => {
        test('should return image information for existing file', () => {
            const statusInfo = { type: 'admin' };
            const mockStats = { size: 1024 };
            
            fs.statSync.mockReturnValue(mockStats);
            
            const info = imageSelector.getImageInfo(statusInfo);
            
            expect(info).toEqual({
                path: imageSelector.imagePaths.admin,
                size: 1024,
                exists: true,
                statusType: 'admin',
                fileName: 'лидер.png'
            });
        });

        test('should return error information for non-existing file', () => {
            const statusInfo = { type: 'admin' };
            const error = new Error('File not found');
            
            fs.statSync.mockImplementation(() => {
                throw error;
            });
            
            const info = imageSelector.getImageInfo(statusInfo);
            
            expect(info).toEqual({
                path: null,
                size: 0,
                exists: false,
                statusType: 'admin',
                fileName: null,
                error: 'File not found'
            });
        });
    });

    describe('getAllImagePaths', () => {
        test('should return copy of all image paths', () => {
            const paths = imageSelector.getAllImagePaths();
            
            expect(paths).toEqual(imageSelector.imagePaths);
            expect(paths).not.toBe(imageSelector.imagePaths); // Should be a copy
        });
    });

    describe('hasImageForStatus', () => {
        test('should return true for existing status image', () => {
            const hasImage = imageSelector.hasImageForStatus('admin');
            
            expect(hasImage).toBe(true);
            expect(fs.existsSync).toHaveBeenCalledWith(imageSelector.imagePaths.admin);
        });

        test('should return false for non-existing status image', () => {
            fs.existsSync.mockReturnValue(false);
            
            const hasImage = imageSelector.hasImageForStatus('admin');
            
            expect(hasImage).toBe(false);
        });

        test('should return false for invalid status', () => {
            const hasImage = imageSelector.hasImageForStatus('invalid');
            
            expect(hasImage).toBe(false);
        });
    });

    describe('getImageFileName', () => {
        test('should return filename for valid status', () => {
            const fileName = imageSelector.getImageFileName('admin');
            
            expect(fileName).toBe('лидер.png');
        });

        test('should return null for invalid status', () => {
            const fileName = imageSelector.getImageFileName('invalid');
            
            expect(fileName).toBeNull();
        });
    });

    describe('getStatusImageMapping', () => {
        test('should return status to image mapping', () => {
            const mapping = imageSelector.getStatusImageMapping();
            
            expect(mapping).toEqual({
                admin: {
                    image: 'лидер.png',
                    description: 'Изображение для администраторов',
                    emoji: '👑'
                },
                authorized: {
                    image: 'авторизованные.png',
                    description: 'Изображение для авторизованных пользователей',
                    emoji: '✅'
                },
                unauthorized: {
                    image: 'новички.png',
                    description: 'Изображение для неавторизованных пользователей',
                    emoji: '🔒'
                }
            });
        });
    });

    describe('validateStatusImage', () => {
        test('should return true for valid status image', () => {
            const mockStats = { size: 1024 };
            fs.statSync.mockReturnValue(mockStats);
            
            const isValid = imageSelector.validateStatusImage('admin');
            
            expect(isValid).toBe(true);
            expect(fs.existsSync).toHaveBeenCalledWith(imageSelector.imagePaths.admin);
            expect(fs.statSync).toHaveBeenCalledWith(imageSelector.imagePaths.admin);
        });

        test('should return false for non-existing status image', () => {
            fs.existsSync.mockReturnValue(false);
            
            const isValid = imageSelector.validateStatusImage('admin');
            
            expect(isValid).toBe(false);
        });

        test('should return false for empty image file', () => {
            const mockStats = { size: 0 };
            fs.statSync.mockReturnValue(mockStats);
            
            const isValid = imageSelector.validateStatusImage('admin');
            
            expect(isValid).toBe(false);
        });

        test('should return false for invalid status type', () => {
            const isValid = imageSelector.validateStatusImage('invalid');
            
            expect(isValid).toBe(false);
        });

        test('should handle file system errors', () => {
            fs.statSync.mockImplementation(() => {
                throw new Error('File system error');
            });
            
            const isValid = imageSelector.validateStatusImage('admin');
            
            expect(isValid).toBe(false);
        });
    });

    describe('getHealthCheck', () => {
        test('should return healthy status when all images are valid', () => {
            const mockStats = { size: 1024 };
            fs.statSync.mockReturnValue(mockStats);
            
            const health = imageSelector.getHealthCheck();
            
            expect(health.overall).toBe(true);
            expect(health.images.admin.valid).toBe(true);
            expect(health.images.authorized.valid).toBe(true);
            expect(health.images.unauthorized.valid).toBe(true);
        });

        test('should return unhealthy status when some images are invalid', () => {
            const mockStats = { size: 1024 };
            fs.statSync.mockReturnValue(mockStats);
            fs.existsSync.mockImplementation((path) => {
                return !path.includes('лидер.png'); // Admin image missing
            });
            
            const health = imageSelector.getHealthCheck();
            
            expect(health.overall).toBe(false);
            expect(health.images.admin.valid).toBe(false);
            expect(health.images.authorized.valid).toBe(true);
            expect(health.images.unauthorized.valid).toBe(true);
        });

        test('should include file paths and names in health check', () => {
            const mockStats = { size: 1024 };
            fs.statSync.mockReturnValue(mockStats);
            
            const health = imageSelector.getHealthCheck();
            
            expect(health.images.admin.path).toBe(imageSelector.imagePaths.admin);
            expect(health.images.admin.fileName).toBe('лидер.png');
            expect(health.images.authorized.path).toBe(imageSelector.imagePaths.authorized);
            expect(health.images.authorized.fileName).toBe('авторизованные.png');
            expect(health.images.unauthorized.path).toBe(imageSelector.imagePaths.unauthorized);
            expect(health.images.unauthorized.fileName).toBe('новички.png');
        });
    });
});