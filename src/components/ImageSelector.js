/**
 * ImageSelector Component
 * Selects appropriate profile image based on user status
 */

const path = require('path');
const fs = require('fs');

class ImageSelector {
    constructor() {
        // Define image paths relative to project root
        this.imagePaths = {
            admin: path.join(__dirname, '..', '..', 'лидер.png'),
            authorized: path.join(__dirname, '..', '..', 'авторизованные.png'),
            unauthorized: path.join(__dirname, '..', '..', 'новички.png')
        };

        // Verify all image files exist during initialization
        this.validateImageFiles();
    }

    /**
     * Validate that all required image files exist
     * @throws {Error} If any image file is missing
     */
    validateImageFiles() {
        for (const [status, imagePath] of Object.entries(this.imagePaths)) {
            if (!fs.existsSync(imagePath)) {
                throw new Error(`Profile image for status '${status}' not found at: ${imagePath}`);
            }
        }
        console.log('All profile images validated successfully');
    }

    /**
     * Select profile image based on user status
     * @param {Object} statusInfo - Status information from UserDataRetriever
     * @returns {string} Path to the appropriate image file
     */
    selectProfileImage(statusInfo) {
        try {
            let selectedPath;

            switch (statusInfo.type) {
                case 'admin':
                    selectedPath = this.imagePaths.admin;
                    break;
                case 'authorized':
                    selectedPath = this.imagePaths.authorized;
                    break;
                case 'unauthorized':
                default:
                    selectedPath = this.imagePaths.unauthorized;
                    break;
            }

            // Double-check file exists before returning
            if (!fs.existsSync(selectedPath)) {
                console.error(`Selected image file not found: ${selectedPath}`);
                // Fallback to unauthorized image
                selectedPath = this.imagePaths.unauthorized;
                
                if (!fs.existsSync(selectedPath)) {
                    throw new Error('No fallback image available');
                }
            }

            return selectedPath;
        } catch (error) {
            throw new Error(`Failed to select profile image: ${error.message}`);
        }
    }

    /**
     * Get image buffer for sending via Telegram
     * @param {Object} statusInfo - Status information from UserDataRetriever
     * @returns {Buffer} Image buffer
     */
    getImageBuffer(statusInfo) {
        try {
            const imagePath = this.selectProfileImage(statusInfo);
            return fs.readFileSync(imagePath);
        } catch (error) {
            throw new Error(`Failed to read profile image: ${error.message}`);
        }
    }

    /**
     * Get image stream for sending via Telegram
     * @param {Object} statusInfo - Status information from UserDataRetriever
     * @returns {ReadStream} Image stream
     */
    getImageStream(statusInfo) {
        try {
            const imagePath = this.selectProfileImage(statusInfo);
            return fs.createReadStream(imagePath);
        } catch (error) {
            throw new Error(`Failed to create image stream: ${error.message}`);
        }
    }

    /**
     * Get image information for debugging
     * @param {Object} statusInfo - Status information from UserDataRetriever
     * @returns {Object} Image information
     */
    getImageInfo(statusInfo) {
        try {
            const imagePath = this.selectProfileImage(statusInfo);
            const stats = fs.statSync(imagePath);
            
            return {
                path: imagePath,
                size: stats.size,
                exists: true,
                statusType: statusInfo.type,
                fileName: path.basename(imagePath)
            };
        } catch (error) {
            return {
                path: null,
                size: 0,
                exists: false,
                statusType: statusInfo.type,
                fileName: null,
                error: error.message
            };
        }
    }

    /**
     * Get all available image paths
     * @returns {Object} All image paths
     */
    getAllImagePaths() {
        return { ...this.imagePaths };
    }

    /**
     * Check if image exists for specific status
     * @param {string} statusType - Status type (admin, authorized, unauthorized)
     * @returns {boolean} Whether image exists
     */
    hasImageForStatus(statusType) {
        const imagePath = this.imagePaths[statusType];
        return imagePath && fs.existsSync(imagePath);
    }

    /**
     * Get image filename for specific status
     * @param {string} statusType - Status type (admin, authorized, unauthorized)
     * @returns {string|null} Image filename or null if not found
     */
    getImageFileName(statusType) {
        const imagePath = this.imagePaths[statusType];
        return imagePath ? path.basename(imagePath) : null;
    }

    /**
     * Get status-to-image mapping for reference
     * @returns {Object} Status to image mapping
     */
    getStatusImageMapping() {
        return {
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
        };
    }

    /**
     * Validate specific image file
     * @param {string} statusType - Status type to validate
     * @returns {boolean} Whether the image is valid
     */
    validateStatusImage(statusType) {
        try {
            const imagePath = this.imagePaths[statusType];
            if (!imagePath) {
                console.error(`No image path defined for status: ${statusType}`);
                return false;
            }

            if (!fs.existsSync(imagePath)) {
                console.error(`Image file not found for status '${statusType}': ${imagePath}`);
                return false;
            }

            const stats = fs.statSync(imagePath);
            if (stats.size === 0) {
                console.error(`Image file is empty for status '${statusType}': ${imagePath}`);
                return false;
            }

            return true;
        } catch (error) {
            console.error(`Error validating image for status '${statusType}':`, error);
            return false;
        }
    }

    /**
     * Get health check information for all images
     * @returns {Object} Health check results
     */
    getHealthCheck() {
        const results = {
            overall: true,
            images: {}
        };

        for (const [statusType] of Object.entries(this.imagePaths)) {
            const isValid = this.validateStatusImage(statusType);
            results.images[statusType] = {
                valid: isValid,
                path: this.imagePaths[statusType],
                fileName: this.getImageFileName(statusType)
            };

            if (!isValid) {
                results.overall = false;
            }
        }

        return results;
    }
}

module.exports = ImageSelector;