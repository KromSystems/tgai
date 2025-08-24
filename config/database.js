const path = require('path');

const config = {
    development: {
        database: process.env.DATABASE_PATH || './data/bot.sqlite',
        options: {
            verbose: true,
            cache: {
                size: 100
            }
        }
    },
    
    test: {
        database: ':memory:', // Use in-memory database for tests
        options: {
            verbose: false
        }
    },
    
    production: {
        database: process.env.DATABASE_PATH || './data/bot.sqlite',
        options: {
            verbose: false,
            cache: {
                size: 200
            }
        }
    }
};

const environment = process.env.NODE_ENV || 'development';

module.exports = {
    ...config[environment],
    environment,
    
    // Migration settings
    migrations: {
        directory: path.join(__dirname, '../database/migrations'),
        tableName: 'migrations'
    },
    
    // Common database settings
    pragmas: {
        foreign_keys: 'ON',
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
        temp_store: 'MEMORY'
    }
};