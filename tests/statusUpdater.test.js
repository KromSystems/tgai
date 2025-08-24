const { expect } = require('chai');
const sinon = require('sinon');
const StatusUpdaterService = require('../src/components/StatusUpdaterService');
const VehicleMatchingService = require('../src/components/VehicleMatchingService');
const ValidationService = require('../src/components/ValidationService');
const AuditLogger = require('../src/components/AuditLogger');
const Garage = require('../src/database/models/garage');
const database = require('../src/database/connection');

describe('StatusUpdaterService', function() {
    let statusUpdater;
    let dbStub;
    let garageStubs;

    beforeEach(async function() {
        statusUpdater = new StatusUpdaterService();
        
        // Создаем заглушки для базы данных
        dbStub = {
            get: sinon.stub(),
            all: sinon.stub(),
            run: sinon.stub()
        };
        
        // Заглушки для модели Garage
        garageStubs = {
            findById: sinon.stub(Garage, 'findById'),
            getAllCars: sinon.stub(Garage, 'getAllCars'),
            updateStatus: sinon.stub(Garage, 'updateStatus')
        };
        
        // Подключение к базе данных
        if (!database.isConnected()) {
            await database.connect();
        }
    });

    afterEach(function() {
        sinon.restore();
    });

    describe('normalizeStatus', function() {
        it('должен нормализовать русские статусы', function() {
            expect(statusUpdater.normalizeStatus('хорошее')).to.equal('Хорошее');
            expect(statusUpdater.normalizeStatus('среднее')).to.equal('Среднее');
            expect(statusUpdater.normalizeStatus('плохое')).to.equal('Плохое');
        });

        it('должен нормализовать английские статусы', function() {
            expect(statusUpdater.normalizeStatus('good')).to.equal('Хорошее');
            expect(statusUpdater.normalizeStatus('average')).to.equal('Среднее');
            expect(statusUpdater.normalizeStatus('bad')).to.equal('Плохое');
        });

        it('должен обрабатывать различные варианты написания', function() {
            expect(statusUpdater.normalizeStatus('ХОРОШЕЕ')).to.equal('Хорошее');
            expect(statusUpdater.normalizeStatus('  среднее  ')).to.equal('Среднее');
            expect(statusUpdater.normalizeStatus('ПлОхОе')).to.equal('Плохое');
        });

        it('должен выбрасывать ошибку для недопустимых статусов', function() {
            expect(() => statusUpdater.normalizeStatus('неизвестный')).to.throw();
            expect(() => statusUpdater.normalizeStatus('')).to.throw();
            expect(() => statusUpdater.normalizeStatus(null)).to.throw();
        });
    });

    describe('findVehicleByName', function() {
        beforeEach(function() {
            const mockCar = {
                car_id: 1,
                car_name: 'BMW 4-Series',
                status: 'Хорошее'
            };
            
            garageStubs.getAllCars.resolves([mockCar]);
        });

        it('должен найти автомобиль по точному названию', async function() {
            dbStub.get.resolves({
                car_id: 1,
                car_name: 'BMW 4-Series',
                status: 'Хорошее'
            });
            
            // Подменяем database в statusUpdater
            statusUpdater.findExactMatch = sinon.stub().resolves({
                car_id: 1,
                car_name: 'BMW 4-Series',
                status: 'Хорошее'
            });
            
            const result = await statusUpdater.findVehicleByName('BMW 4-Series');
            expect(result).to.not.be.null;
            expect(result.car_name).to.equal('BMW 4-Series');
        });

        it('должен вернуть null для несуществующего автомобиля', async function() {
            statusUpdater.findExactMatch = sinon.stub().resolves(null);
            statusUpdater.findCaseInsensitiveMatch = sinon.stub().resolves(null);
            statusUpdater.findFuzzyMatch = sinon.stub().resolves(null);
            
            const result = await statusUpdater.findVehicleByName('Несуществующий автомобиль');
            expect(result).to.be.null;
        });
    });

    describe('updateSingleVehicle', function() {
        const mockCar = {
            car_id: 1,
            car_name: 'BMW 4-Series',
            status: 'Среднее'
        };

        beforeEach(function() {
            statusUpdater.findVehicleByName = sinon.stub();
            statusUpdater.logStatusChange = sinon.stub();
        });

        it('должен успешно обновить статус автомобиля', async function() {
            statusUpdater.findVehicleByName.resolves(mockCar);
            garageStubs.updateStatus.resolves();
            
            const result = await statusUpdater.updateSingleVehicle('BMW 4-Series', 'хорошее');
            
            expect(result.success).to.be.true;
            expect(result.changed).to.be.true;
            expect(result.oldStatus).to.equal('Среднее');
            expect(result.newStatus).to.equal('Хорошее');
        });

        it('должен обработать случай, когда статус уже установлен', async function() {
            const mockCarGood = { ...mockCar, status: 'Хорошее' };
            statusUpdater.findVehicleByName.resolves(mockCarGood);
            
            const result = await statusUpdater.updateSingleVehicle('BMW 4-Series', 'хорошее');
            
            expect(result.success).to.be.true;
            expect(result.changed).to.be.false;
            expect(result.message).to.equal('Статус уже установлен');
        });

        it('должен обработать случай несуществующего автомобиля', async function() {
            statusUpdater.findVehicleByName.resolves(null);
            statusUpdater.getSimilarVehicleNames = sinon.stub().resolves(['BMW 3-Series', 'BMW 5-Series']);
            
            const result = await statusUpdater.updateSingleVehicle('BMW Несуществующий', 'хорошее');
            
            expect(result.success).to.be.false;
            expect(result.error).to.include('не найден');
            expect(result.suggestions).to.be.an('array');
        });
    });

    describe('updateVehicleStatuses', function() {
        const mockVehicleList = [
            { carName: 'BMW 4-Series', status: 'хорошее' },
            { carName: 'Audi RS6', status: 'среднее' },
            { carName: 'Несуществующий', status: 'плохое' }
        ];

        beforeEach(function() {
            statusUpdater.updateSingleVehicle = sinon.stub();
        });

        it('должен обработать массив обновлений', async function() {
            // Настраиваем результаты для каждого автомобиля
            statusUpdater.updateSingleVehicle
                .onCall(0).resolves({ success: true, changed: true, carName: 'BMW 4-Series', oldStatus: 'Среднее', newStatus: 'Хорошее' })
                .onCall(1).resolves({ success: true, changed: false, carName: 'Audi RS6', message: 'Статус уже установлен' })
                .onCall(2).resolves({ success: false, carName: 'Несуществующий', error: 'Автомобиль не найден' });

            const result = await statusUpdater.updateVehicleStatuses(mockVehicleList);
            
            expect(result.total).to.equal(3);
            expect(result.summary.updated).to.equal(1);
            expect(result.summary.unchanged).to.equal(1);
            expect(result.summary.failed).to.equal(1);
        });

        it('должен выбросить ошибку для недопустимого входного параметра', async function() {
            try {
                await statusUpdater.updateVehicleStatuses('не массив');
                expect.fail('Должна была быть выброшена ошибка');
            } catch (error) {
                expect(error.message).to.include('должен быть массивом');
            }
        });
    });

    describe('generateUpdateReport', function() {
        it('должен сгенерировать корректный отчет', function() {
            const mockReport = {
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                duration: 1000,
                total: 3,
                successful: [
                    { carName: 'BMW 4-Series', oldStatus: 'Среднее', newStatus: 'Хорошее' }
                ],
                failed: [
                    { carName: 'Несуществующий', error: 'Автомобиль не найден' }
                ],
                unchanged: [
                    { carName: 'Audi RS6', newStatus: 'Хорошее' }
                ],
                summary: {
                    updated: 1,
                    unchanged: 1,
                    failed: 1
                }
            };

            const report = statusUpdater.generateUpdateReport(mockReport);
            
            expect(report).to.be.a('string');
            expect(report).to.include('ОТЧЕТ ОБ ОБНОВЛЕНИИ');
            expect(report).to.include('Всего обработано: 3');
            expect(report).to.include('Обновлено: 1');
            expect(report).to.include('BMW 4-Series');
            expect(report).to.include('Несуществующий');
        });
    });
});

describe('VehicleMatchingService', function() {
    let vehicleMatcher;
    let garageStubs;

    beforeEach(async function() {
        vehicleMatcher = new VehicleMatchingService();
        
        garageStubs = {
            getAllCars: sinon.stub(Garage, 'getAllCars')
        };
        
        if (!database.isConnected()) {
            await database.connect();
        }
    });

    afterEach(function() {
        sinon.restore();
    });

    describe('normalizeVehicleName', function() {
        it('должен нормализовать название автомобиля', function() {
            expect(vehicleMatcher.normalizeVehicleName('  BMW 4-Series  ')).to.equal('bmw 4-series');
            expect(vehicleMatcher.normalizeVehicleName('Mercedes-Benz C63S')).to.equal('mercedes-benz c63s');
            expect(vehicleMatcher.normalizeVehicleName('Audi@RS6!')).to.equal('audi rs6');
        });

        it('должен обработать пустые значения', function() {
            expect(vehicleMatcher.normalizeVehicleName('')).to.equal('');
            expect(vehicleMatcher.normalizeVehicleName(null)).to.equal('');
            expect(vehicleMatcher.normalizeVehicleName(undefined)).to.equal('');
        });
    });

    describe('calculateSimilarity', function() {
        it('должен вычислить правильную схожесть', function() {
            expect(vehicleMatcher.calculateSimilarity('BMW', 'BMW')).to.equal(1.0);
            expect(vehicleMatcher.calculateSimilarity('BMW 4-Series', 'BMW 4-Series')).to.equal(1.0);
            expect(vehicleMatcher.calculateSimilarity('BMW', 'Audi')).to.be.lessThan(0.5);
        });

        it('должен быть устойчив к регистру', function() {
            expect(vehicleMatcher.calculateSimilarity('BMW', 'bmw')).to.equal(1.0);
            expect(vehicleMatcher.calculateSimilarity('BMW 4-Series', 'bmw 4-series')).to.equal(1.0);
        });
    });

    describe('findFuzzyMatches', function() {
        const mockCars = [
            { car_name: 'BMW 4-Series', status: 'Хорошее' },
            { car_name: 'BMW M3 Touring', status: 'Среднее' },
            { car_name: 'Audi RS6', status: 'Плохое' }
        ];

        beforeEach(function() {
            garageStubs.getAllCars.resolves(mockCars);
        });

        it('должен найти точные совпадения', async function() {
            const matches = await vehicleMatcher.findFuzzyMatches('BMW 4-Series');
            
            expect(matches).to.have.length.greaterThan(0);
            expect(matches[0].similarity).to.equal(1.0);
            expect(matches[0].matchType).to.equal('exact');
        });

        it('должен найти частичные совпадения', async function() {
            const matches = await vehicleMatcher.findFuzzyMatches('BMW', 0.3);
            
            expect(matches).to.have.length.greaterThan(0);
            const bmwMatches = matches.filter(m => m.vehicle.car_name.includes('BMW'));
            expect(bmwMatches).to.have.length.greaterThan(0);
        });
    });
});

describe('ValidationService', function() {
    let validator;
    let garageStubs;

    beforeEach(async function() {
        validator = new ValidationService();
        
        garageStubs = {
            getAllCars: sinon.stub(Garage, 'getAllCars')
        };
        
        if (!database.isConnected()) {
            await database.connect();
        }
    });

    afterEach(function() {
        sinon.restore();
    });

    describe('validateStatus', function() {
        it('должен валидировать корректные статусы', function() {
            const result1 = validator.validateStatus('Хорошее');
            expect(result1.isValid).to.be.true;
            expect(result1.normalizedStatus).to.equal('Хорошее');

            const result2 = validator.validateStatus('хорошее');
            expect(result2.isValid).to.be.true;
            expect(result2.normalizedStatus).to.equal('Хорошее');

            const result3 = validator.validateStatus('good');
            expect(result3.isValid).to.be.true;
            expect(result3.normalizedStatus).to.equal('Хорошее');
        });

        it('должен отклонять некорректные статусы', function() {
            const result1 = validator.validateStatus('неизвестный');
            expect(result1.isValid).to.be.false;
            expect(result1.error).to.include('Неизвестный статус');

            const result2 = validator.validateStatus('');
            expect(result2.isValid).to.be.false;

            const result3 = validator.validateStatus(null);
            expect(result3.isValid).to.be.false;
        });
    });

    describe('validateStatusTransition', function() {
        it('должен разрешать все переходы статусов', function() {
            const result = validator.validateStatusTransition('Плохое', 'Хорошее');
            expect(result.isValid).to.be.true;
            expect(result.isUpgrade).to.be.true;
        });

        it('должен обнаруживать отсутствие изменений', function() {
            const result = validator.validateStatusTransition('Хорошее', 'Хорошее');
            expect(result.isValid).to.be.true;
            expect(result.isNoChange).to.be.true;
        });

        it('должен обнаруживать ухудшение статуса', function() {
            const result = validator.validateStatusTransition('Хорошее', 'Плохое');
            expect(result.isValid).to.be.true;
            expect(result.isDowngrade).to.be.true;
            expect(result.warning).to.include('Ухудшение');
        });
    });

    describe('validateCarName', function() {
        it('должен валидировать корректные названия', function() {
            const result = validator.validateCarName('BMW 4-Series');
            expect(result.isValid).to.be.true;
            expect(result.normalizedName).to.equal('BMW 4-Series');
        });

        it('должен отклонять некорректные названия', function() {
            const result1 = validator.validateCarName('');
            expect(result1.isValid).to.be.false;

            const result2 = validator.validateCarName('A');
            expect(result2.isValid).to.be.false;

            const result3 = validator.validateCarName('A'.repeat(101));
            expect(result3.isValid).to.be.false;
        });

        it('должен предупреждать о подозрительных символах', function() {
            const result = validator.validateCarName('BMW<script>');
            expect(result.isValid).to.be.true;
            expect(result.warnings).to.have.length.greaterThan(0);
        });
    });
});

describe('Интеграционные тесты', function() {
    let statusUpdater;
    let originalCars;

    before(async function() {
        if (!database.isConnected()) {
            await database.connect();
        }
        
        // Сохраняем исходное состояние
        originalCars = await Garage.getAllCars();
    });

    beforeEach(function() {
        statusUpdater = new StatusUpdaterService();
    });

    after(async function() {
        // Восстанавливаем исходное состояние
        for (const car of originalCars) {
            await Garage.updateStatus(car.car_id, car.status);
        }
        
        await database.close();
    });

    it('должен выполнить полный цикл обновления статусов', async function() {
        this.timeout(10000); // Увеличиваем таймаут для интеграционного теста
        
        const testUpdates = [
            { carName: 'BMW 4-Series', status: 'среднее' },
            { carName: 'Audi RS6', status: 'плохое' }
        ];

        // Получаем начальное состояние
        const initialCars = await Garage.getAllCars();
        const bmwInitial = initialCars.find(car => car.car_name === 'BMW 4-Series');
        const audiInitial = initialCars.find(car => car.car_name === 'Audi RS6');

        // Выполняем обновления
        const result = await statusUpdater.updateVehicleStatuses(testUpdates);
        
        expect(result.summary.updated).to.be.greaterThan(0);
        expect(result.summary.failed).to.equal(0);

        // Проверяем, что статусы изменились
        const updatedCars = await Garage.getAllCars();
        const bmwUpdated = updatedCars.find(car => car.car_name === 'BMW 4-Series');
        const audiUpdated = updatedCars.find(car => car.car_name === 'Audi RS6');

        if (bmwInitial.status !== 'Среднее') {
            expect(bmwUpdated.status).to.equal('Среднее');
        }
        
        if (audiInitial.status !== 'Плохое') {
            expect(audiUpdated.status).to.equal('Плохое');
        }
    });

    it('должен корректно обрабатывать ошибки валидации', async function() {
        const invalidUpdates = [
            { carName: 'Несуществующий автомобиль', status: 'хорошее' },
            { carName: 'BMW 4-Series', status: 'недопустимый статус' }
        ];

        const result = await statusUpdater.updateVehicleStatuses(invalidUpdates);
        
        expect(result.summary.failed).to.equal(2);
        expect(result.summary.updated).to.equal(0);
    });
});