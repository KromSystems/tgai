/**
 * Tests for UserTypeDetector component
 */

const UserTypeDetector = require('../src/components/UserTypeDetector');

describe('UserTypeDetector', () => {
    let userTypeDetector;
    const ADMIN_ID = 111111111;

    beforeEach(() => {
        userTypeDetector = new UserTypeDetector(ADMIN_ID);
    });

    describe('detectUserType', () => {
        test('should detect admin user correctly', () => {
            const result = userTypeDetector.detectUserType(ADMIN_ID, null);
            expect(result).toBe('admin');
        });

        test('should detect authorized user correctly', () => {
            const authorizedUser = {
                isAuthorized: () => true
            };
            
            const result = userTypeDetector.detectUserType(123456789, authorizedUser);
            expect(result).toBe('authorized');
        });

        test('should detect unauthorized user correctly', () => {
            const unauthorizedUser = {
                isAuthorized: () => false
            };
            
            const result = userTypeDetector.detectUserType(123456789, unauthorizedUser);
            expect(result).toBe('unauthorized');
        });

        test('should detect unauthorized when user is null', () => {
            const result = userTypeDetector.detectUserType(123456789, null);
            expect(result).toBe('unauthorized');
        });

        test('should prioritize admin status over authorization', () => {
            const adminUser = {
                isAuthorized: () => true // Even if authorized
            };
            
            const result = userTypeDetector.detectUserType(ADMIN_ID, adminUser);
            expect(result).toBe('admin'); // Should still be admin
        });
    });

    describe('isAdmin', () => {
        test('should return true for admin ID', () => {
            expect(userTypeDetector.isAdmin(ADMIN_ID)).toBe(true);
        });

        test('should return false for non-admin ID', () => {
            expect(userTypeDetector.isAdmin(123456789)).toBe(false);
        });

        test('should handle string admin ID', () => {
            expect(userTypeDetector.isAdmin(ADMIN_ID.toString())).toBe(false); // Should be strict
        });
    });

    describe('isAuthorized', () => {
        test('should return true for authorized user', () => {
            const user = { isAuthorized: () => true };
            expect(userTypeDetector.isAuthorized(user)).toBe(true);
        });

        test('should return false for unauthorized user', () => {
            const user = { isAuthorized: () => false };
            expect(userTypeDetector.isAuthorized(user)).toBe(false);
        });

        test('should return false for null user', () => {
            expect(userTypeDetector.isAuthorized(null)).toBe(false);
        });

        test('should return false for user without isAuthorized method', () => {
            const user = {};
            expect(userTypeDetector.isAuthorized(user)).toBe(false);
        });
    });

    describe('getUserPermissions', () => {
        test('should return admin permissions correctly', () => {
            const permissions = userTypeDetector.getUserPermissions('admin');
            
            expect(permissions.canViewAdminPanel).toBe(true);
            expect(permissions.canManageUsers).toBe(true);
            expect(permissions.canViewStatistics).toBe(true);
            expect(permissions.canChangeSettings).toBe(true);
            expect(permissions.canAccessBackup).toBe(true);
            expect(permissions.canApproveRequests).toBe(true);
            expect(permissions.level).toBe('admin');
        });

        test('should return authorized user permissions correctly', () => {
            const permissions = userTypeDetector.getUserPermissions('authorized');
            
            expect(permissions.canViewAdminPanel).toBe(false);
            expect(permissions.canManageUsers).toBe(false);
            expect(permissions.canEditProfile).toBe(true);
            expect(permissions.canViewHistory).toBe(true);
            expect(permissions.canContactSupport).toBe(true);
            expect(permissions.level).toBe('user');
        });

        test('should return unauthorized user permissions correctly', () => {
            const permissions = userTypeDetector.getUserPermissions('unauthorized');
            
            expect(permissions.canViewAdminPanel).toBe(false);
            expect(permissions.canEditProfile).toBe(false);
            expect(permissions.canRequestAuth).toBe(true);
            expect(permissions.canViewPublicInfo).toBe(true);
            expect(permissions.canContactSupport).toBe(true);
            expect(permissions.level).toBe('guest');
        });

        test('should return unauthorized permissions for unknown user type', () => {
            const permissions = userTypeDetector.getUserPermissions('unknown');
            expect(permissions.level).toBe('guest');
        });
    });

    describe('hasPermission', () => {
        test('should check admin permissions correctly', () => {
            expect(userTypeDetector.hasPermission('admin', 'canManageUsers')).toBe(true);
            expect(userTypeDetector.hasPermission('admin', 'canViewStatistics')).toBe(true);
            expect(userTypeDetector.hasPermission('admin', 'nonExistentPermission')).toBe(false);
        });

        test('should check authorized user permissions correctly', () => {
            expect(userTypeDetector.hasPermission('authorized', 'canEditProfile')).toBe(true);
            expect(userTypeDetector.hasPermission('authorized', 'canManageUsers')).toBe(false);
        });

        test('should check unauthorized user permissions correctly', () => {
            expect(userTypeDetector.hasPermission('unauthorized', 'canRequestAuth')).toBe(true);
            expect(userTypeDetector.hasPermission('unauthorized', 'canEditProfile')).toBe(false);
        });
    });

    describe('getAvailableMenuSections', () => {
        test('should return admin menu sections', () => {
            const sections = userTypeDetector.getAvailableMenuSections('admin');
            
            expect(sections).toContain('main');
            expect(sections).toContain('admin_users');
            expect(sections).toContain('admin_stats');
            expect(sections).toContain('admin_settings');
            expect(sections).toContain('admin_backup');
        });

        test('should return authorized user menu sections', () => {
            const sections = userTypeDetector.getAvailableMenuSections('authorized');
            
            expect(sections).toContain('main');
            expect(sections).toContain('user_profile');
            expect(sections).toContain('user_settings');
            expect(sections).toContain('user_history');
            expect(sections).not.toContain('admin_users');
        });

        test('should return unauthorized user menu sections', () => {
            const sections = userTypeDetector.getAvailableMenuSections('unauthorized');
            
            expect(sections).toContain('main');
            expect(sections).toContain('guest_about');
            expect(sections).toContain('guest_rules');
            expect(sections).toContain('guest_contacts');
            expect(sections).not.toContain('user_profile');
            expect(sections).not.toContain('admin_users');
        });

        test('should return unauthorized sections for unknown user type', () => {
            const sections = userTypeDetector.getAvailableMenuSections('unknown');
            expect(sections).toEqual(userTypeDetector.getAvailableMenuSections('unauthorized'));
        });
    });

    describe('getUserLevelName', () => {
        test('should return correct level names', () => {
            expect(userTypeDetector.getUserLevelName('admin')).toBe('Администратор');
            expect(userTypeDetector.getUserLevelName('authorized')).toBe('Авторизованный пользователь');
            expect(userTypeDetector.getUserLevelName('unauthorized')).toBe('Гость');
            expect(userTypeDetector.getUserLevelName('unknown')).toBe('Неизвестный');
        });
    });

    describe('getUserIcon', () => {
        test('should return correct icons', () => {
            expect(userTypeDetector.getUserIcon('admin')).toBe('👑');
            expect(userTypeDetector.getUserIcon('authorized')).toBe('✅');
            expect(userTypeDetector.getUserIcon('unauthorized')).toBe('🔒');
            expect(userTypeDetector.getUserIcon('unknown')).toBe('❓');
        });
    });

    describe('checkAccessWarning', () => {
        test('should allow admin access to admin sections', () => {
            const warning = userTypeDetector.checkAccessWarning('admin', 'admin_users');
            expect(warning.hasWarning).toBe(false);
        });

        test('should warn unauthorized user accessing user sections', () => {
            const warning = userTypeDetector.checkAccessWarning('unauthorized', 'user_profile');
            expect(warning.hasWarning).toBe(true);
            expect(warning.message).toContain('авторизованным пользователям');
            expect(warning.suggestedAction).toContain('авторизацию');
        });

        test('should warn authorized user accessing admin sections', () => {
            const warning = userTypeDetector.checkAccessWarning('authorized', 'admin_users');
            expect(warning.hasWarning).toBe(true);
            expect(warning.message).toContain('администраторам');
            expect(warning.suggestedAction).toContain('администратору');
        });

        test('should allow access to unprotected sections', () => {
            const warning = userTypeDetector.checkAccessWarning('unauthorized', 'main');
            expect(warning.hasWarning).toBe(false);
        });
    });

    describe('getAccessDeniedMessage', () => {
        test('should return correct message for unauthorized user', () => {
            const message = userTypeDetector.getAccessDeniedMessage('unauthorized', 'user_profile');
            expect(message).toContain('авторизованным пользователям');
            expect(message).toContain('авторизацию');
        });

        test('should return correct message for authorized user accessing admin section', () => {
            const message = userTypeDetector.getAccessDeniedMessage('authorized', 'admin_users');
            expect(message).toContain('администраторам');
        });

        test('should return generic message for other cases', () => {
            const message = userTypeDetector.getAccessDeniedMessage('unknown', 'unknown_section');
            expect(message).toContain('нет доступа');
        });
    });

    describe('getSuggestedAction', () => {
        test('should suggest authorization for unauthorized users', () => {
            const action = userTypeDetector.getSuggestedAction('unauthorized');
            expect(action).toContain('заявку на авторизацию');
        });

        test('should suggest contacting admin for authorized users', () => {
            const action = userTypeDetector.getSuggestedAction('authorized');
            expect(action).toContain('администратору');
        });

        test('should mention full access for admins', () => {
            const action = userTypeDetector.getSuggestedAction('admin');
            expect(action).toContain('полный доступ');
        });

        test('should provide fallback suggestion for unknown types', () => {
            const action = userTypeDetector.getSuggestedAction('unknown');
            expect(action).toContain('администратору');
        });
    });

    describe('edge cases', () => {
        test('should handle null user gracefully', () => {
            expect(() => {
                userTypeDetector.detectUserType(123, null);
                userTypeDetector.isAuthorized(null);
            }).not.toThrow();
        });

        test('should handle invalid admin ID', () => {
            const detector = new UserTypeDetector(null);
            expect(detector.isAdmin(123)).toBe(false);
        });

        test('should handle user without isAuthorized method', () => {
            const user = { authorized: 1 }; // Missing isAuthorized method
            expect(userTypeDetector.isAuthorized(user)).toBe(false);
        });
    });
});