#!/usr/bin/env node

/**
 * Database Migration Runner
 * Manages database schema migrations
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const database = require('../src/database/connection');

class MigrationRunner {
    constructor() {
        this.migrationsDir = path.join(__dirname, '../src/database/migrations');
    }

    /**
     * Get list of migration files
     * @returns {Array<string>}
     */
    getMigrationFiles() {
        try {
            return fs.readdirSync(this.migrationsDir)
                .filter(file => file.endsWith('.js'))
                .sort();
        } catch (error) {
            console.error('Error reading migrations directory:', error.message);
            return [];
        }
    }

    /**
     * Get applied migrations from database
     * @returns {Promise<Array<string>>}
     */
    async getAppliedMigrations() {
        try {
            const rows = await database.all('SELECT version FROM migrations ORDER BY version');
            return rows.map(row => row.version);
        } catch (error) {
            // Migrations table might not exist yet
            return [];
        }
    }

    /**
     * Run pending migrations
     * @returns {Promise<void>}
     */
    async migrate() {
        try {
            await database.connect();
            
            const migrationFiles = this.getMigrationFiles();
            const appliedMigrations = await this.getAppliedMigrations();
            
            console.log('🔄 Starting database migration...');
            console.log(`Found ${migrationFiles.length} migration files`);
            console.log(`${appliedMigrations.length} migrations already applied`);
            
            let migrationsRun = 0;
            
            for (const file of migrationFiles) {
                const migrationPath = path.join(this.migrationsDir, file);
                const migration = require(migrationPath);
                
                if (!appliedMigrations.includes(migration.version)) {
                    console.log(`\n📦 Running migration: ${migration.version} - ${migration.description}`);
                    
                    try {
                        await migration.up();
                        migrationsRun++;
                        console.log(`✅ Migration ${migration.version} completed`);
                    } catch (error) {
                        console.error(`❌ Migration ${migration.version} failed:`, error.message);
                        throw error;
                    }
                } else {
                    console.log(`⏭️  Skipping already applied migration: ${migration.version}`);
                }
            }
            
            if (migrationsRun === 0) {
                console.log('\n✨ Database is up to date! No migrations to run.');
            } else {
                console.log(`\n🎉 Successfully ran ${migrationsRun} migration(s)`);
            }
            
        } catch (error) {
            console.error('\n💥 Migration failed:', error.message);
            process.exit(1);
        } finally {
            await database.close();
        }
    }

    /**
     * Rollback last migration
     * @returns {Promise<void>}
     */
    async rollback() {
        try {
            await database.connect();
            
            const appliedMigrations = await this.getAppliedMigrations();
            
            if (appliedMigrations.length === 0) {
                console.log('📭 No migrations to rollback');
                return;
            }
            
            const lastMigration = appliedMigrations[appliedMigrations.length - 1];
            const migrationFiles = this.getMigrationFiles();
            
            const migrationFile = migrationFiles.find(file => {
                const migration = require(path.join(this.migrationsDir, file));
                return migration.version === lastMigration;
            });
            
            if (!migrationFile) {
                console.error(`❌ Migration file not found for version: ${lastMigration}`);
                return;
            }
            
            const migrationPath = path.join(this.migrationsDir, migrationFile);
            const migration = require(migrationPath);
            
            console.log(`🔄 Rolling back migration: ${migration.version} - ${migration.description}`);
            
            try {
                await migration.down();
                console.log(`✅ Migration ${migration.version} rolled back successfully`);
            } catch (error) {
                console.error(`❌ Rollback failed:`, error.message);
                throw error;
            }
            
        } catch (error) {
            console.error('\n💥 Rollback failed:', error.message);
            process.exit(1);
        } finally {
            await database.close();
        }
    }

    /**
     * Show migration status
     * @returns {Promise<void>}
     */
    async status() {
        try {
            await database.connect();
            
            const migrationFiles = this.getMigrationFiles();
            const appliedMigrations = await this.getAppliedMigrations();
            
            console.log('\n📊 Migration Status:');
            console.log('==================');
            
            if (migrationFiles.length === 0) {
                console.log('📭 No migration files found');
                return;
            }
            
            for (const file of migrationFiles) {
                const migrationPath = path.join(this.migrationsDir, file);
                const migration = require(migrationPath);
                const status = appliedMigrations.includes(migration.version) ? '✅ Applied' : '⏳ Pending';
                
                console.log(`${status} | ${migration.version} | ${migration.description}`);
            }
            
            console.log(`\nTotal: ${migrationFiles.length} migrations`);
            console.log(`Applied: ${appliedMigrations.length}`);
            console.log(`Pending: ${migrationFiles.length - appliedMigrations.length}`);
            
        } catch (error) {
            console.error('Error getting migration status:', error.message);
        } finally {
            await database.close();
        }
    }
}

// CLI interface
async function main() {
    const command = process.argv[2];
    const runner = new MigrationRunner();
    
    switch (command) {
        case 'migrate':
        case 'up':
            await runner.migrate();
            break;
            
        case 'rollback':
        case 'down':
            await runner.rollback();
            break;
            
        case 'status':
            await runner.status();
            break;
            
        default:
            console.log(`
📚 Database Migration Runner

Usage:
  node scripts/migrate.js <command>

Commands:
  migrate, up     Run pending migrations
  rollback, down  Rollback last migration
  status          Show migration status

Examples:
  node scripts/migrate.js migrate
  node scripts/migrate.js status
  node scripts/migrate.js rollback
            `);
            break;
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Migration runner error:', error.message);
        process.exit(1);
    });
}

module.exports = MigrationRunner;