# Vehicle Status Updater Feature Design

## Overview

The Vehicle Status Updater is a new feature designed to systematically update vehicle conditions in the garage database. This feature addresses the need to synchronize the database with current vehicle states based on maintenance records, inspection results, or external assessments.

### Business Context
The current garage management system maintains vehicle records with status values (Хорошее, Среднее, Плохое), but requires manual mechanisms to bulk update these statuses based on real-world conditions or maintenance outcomes.

### Core Requirements
- Update vehicle statuses based on provided vehicle-status mappings
- Handle discrepancies between database records and provided data
- Maintain data integrity and audit trails
- Support both individual and batch status updates
- Validate status transitions and business rules

## Architecture

### System Integration
```mermaid
graph TB
    A[Vehicle Status Input] --> B[Status Updater Service]
    B --> C[Validation Layer]
    C --> D[Database Update Layer]
    D --> E[Garage Model]
    E --> F[SQLite Database]
    
    B --> G[Audit Logger]
    B --> H[Error Handler]
    
    C --> I[Business Rules Engine]
    I --> J[Status Validation]
    I --> K[Vehicle Existence Check]
    
    G --> L[Update History Table]
    H --> M[Error Log]
```

### Component Responsibilities

#### StatusUpdaterService
- Orchestrates the vehicle status update process
- Handles batch operations and transaction management
- Coordinates validation and database operations
- Manages error handling and rollback scenarios

#### ValidationLayer
- Validates vehicle names against database records
- Enforces business rules for status transitions
- Checks data format and consistency
- Handles fuzzy matching for vehicle name variations

#### DatabaseUpdateLayer
- Executes database update operations
- Manages transaction boundaries
- Implements atomic batch updates
- Handles database constraints and foreign key relationships

## Data Models & Status Management

### Current Database Schema
```mermaid
erDiagram
    GARAGE {
        integer car_id PK
        text car_name
        text status
        datetime last_maintenance
        datetime created_at
        datetime updated_at
    }
    
    GARAGE_REQUESTS {
        integer id PK
        integer car_id FK
        integer user_id FK
        text payment_status
        datetime processed_at
    }
    
    STATUS_UPDATE_LOG {
        integer id PK
        integer car_id FK
        text old_status
        text new_status
        text update_reason
        datetime updated_at
        text updated_by
    }
```

### Status Validation Rules
```mermaid
stateDiagram-v2
    [*] --> Хорошее
    [*] --> Среднее
    [*] --> Плохое
    
    Хорошее --> Среднее : Wear/Damage
    Хорошее --> Плохое : Major Issue
    Среднее --> Хорошее : Maintenance
    Среднее --> Плохое : Deterioration
    Плохое --> Среднее : Partial Repair
    Плохое --> Хорошее : Full Restoration
```

### Vehicle Mapping Strategy

#### Current Database Vehicles vs. Input Data
```mermaid
graph LR
    subgraph "Database Vehicles"
        A1[BMW 4-Series]
        A2[Audi RS6]
        A3[Mercedes G63AMG]
        A4[Tesla Model 3]
        A5[Chevrolet Camaro]
        A6[Other 9 vehicles...]
    end
    
    subgraph "Input Data"
        B1[BMW 4-Series]
        B2[Audi RS6]
        B3[Mercedes G63AMG x2]
        B4[Tesla Model 3]
        B5[Chevrolet Camaro]
        B6[Additional vehicles...]
    end
    
    A1 --> B1
    A2 --> B2
    A3 --> B3
    A4 --> B4
    A5 --> B5
```

## API Design

### StatusUpdater Interface
```mermaid
classDiagram
    class StatusUpdaterService {
        +updateVehicleStatuses(vehicleStatusMap)
        +updateSingleVehicle(vehicleName, status)
        +validateStatusUpdates(vehicleStatusMap)
        +generateUpdateReport()
        -handleDuplicateNames(duplicates)
        -logStatusChange(carId, oldStatus, newStatus)
    }
    
    class VehicleMatchingService {
        +findVehicleByName(name)
        +fuzzyMatchVehicle(name)
        +resolveDuplicates(name, candidates)
        +normalizeVehicleName(name)
    }
    
    class ValidationService {
        +validateStatus(status)
        +validateVehicleExists(name)
        +validateBusinessRules(carId, newStatus)
        +checkMaintenanceHistory(carId)
    }
    
    StatusUpdaterService --> VehicleMatchingService
    StatusUpdaterService --> ValidationService
    StatusUpdaterService --> Garage
```

### Input Data Processing

#### Vehicle Status Input Format
| Vehicle Name | Current Status | Proposed Status |
|-------------|---------------|-----------------|
| BMW 4-Series | Среднее | хорошее |
| Audi RS6 | Плохое | хорошее |
| Mercedes G63AMG | Плохое | хорошее/среднее |

#### Status Normalization Rules
```mermaid
flowchart TD
    A[Input Status] --> B{Normalize Text}
    B --> C[Convert to Title Case]
    C --> D{Map to Valid Status}
    D --> E[Хорошее] 
    D --> F[Среднее]
    D --> G[Плохое]
    
    H[хорошее/good] --> E
    I[среднее/average] --> F
    J[плохое/bad/poor] --> G
```

## Business Logic Layer

### Update Processing Workflow
```mermaid
sequenceDiagram
    participant Client
    participant StatusUpdater
    participant Validator
    participant Matcher
    participant Database
    participant Logger
    
    Client->>StatusUpdater: updateVehicleStatuses(list)
    StatusUpdater->>Validator: validateInputData(list)
    StatusUpdater->>Matcher: matchVehicleNames(list)
    
    loop For each vehicle
        StatusUpdater->>Database: getCurrentStatus(vehicleId)
        StatusUpdater->>Validator: validateStatusTransition(old, new)
        StatusUpdater->>Database: updateVehicleStatus(vehicleId, status)
        StatusUpdater->>Logger: logStatusChange(vehicleId, old, new)
    end
    
    StatusUpdater->>Client: updateReport
```

### Duplicate Handling Strategy
```mermaid
flowchart TD
    A[Vehicle Name Input] --> B{Check Database}
    B -->|Single Match| C[Direct Update]
    B -->|Multiple Matches| D[Duplicate Resolution]
    B -->|No Match| E[Fuzzy Search]
    
    D --> F{Resolution Strategy}
    F -->|By ID| G[Update by Car ID]
    F -->|By Status| H[Update by Current Status]
    F -->|Manual| I[Require User Selection]
    
    E --> J{Fuzzy Match Found}
    J -->|Yes| K[Confirm Match]
    J -->|No| L[Report Missing Vehicle]
```

### Error Handling and Recovery

#### Error Classification
```mermaid
graph TD
    A[Update Errors] --> B[Validation Errors]
    A --> C[Database Errors]
    A --> D[Business Logic Errors]
    
    B --> B1[Invalid Status Value]
    B --> B2[Vehicle Not Found]
    B --> B3[Invalid Transition]
    
    C --> C1[Connection Failure]
    C --> C2[Constraint Violation]
    C --> C3[Transaction Rollback]
    
    D --> D1[Duplicate Vehicle Names]
    D --> D2[Conflicting Updates]
    D --> D3[Maintenance Dependencies]
```

## Implementation Approach

### Phase 1: Core Status Update
- Implement basic status update functionality
- Handle exact vehicle name matches
- Support status validation and transition rules
- Create audit logging mechanism

### Phase 2: Advanced Matching
- Implement fuzzy name matching
- Handle duplicate vehicle name resolution
- Add batch processing capabilities
- Enhance error reporting

### Phase 3: Integration & UI
- Integrate with existing garage management system
- Add admin interface for bulk updates
- Implement approval workflow for sensitive changes
- Create reporting and analytics features

## Data Migration Strategy

### Handling Current Data Discrepancies

#### Analysis of Provided Vehicle List
```mermaid
pie title Vehicle Status Distribution
    "хорошее" : 13
    "среднее" : 1
    "Missing from DB" : 1
```

#### Migration Steps
1. **Data Analysis**: Compare input list with current database
2. **Vehicle Addition**: Add missing vehicles to database
3. **Status Mapping**: Map Russian status terms to database values
4. **Duplicate Resolution**: Handle Mercedes G63AMG duplicate entry
5. **Batch Update**: Execute validated status updates
6. **Verification**: Confirm all updates completed successfully

### Database Transaction Management
```mermaid
sequenceDiagram
    participant Service
    participant Database
    participant Rollback
    
    Service->>Database: BEGIN TRANSACTION
    
    loop For each vehicle update
        Service->>Database: UPDATE garage SET status = ?
        Database-->>Service: Success/Error
        
        alt Error occurs
            Service->>Rollback: ROLLBACK TRANSACTION
            Rollback-->>Service: Transaction cancelled
            break
        end
    end
    
    Service->>Database: COMMIT TRANSACTION
    Database-->>Service: All changes persisted
```

## Testing Strategy

### Unit Testing Requirements
- Status validation logic testing
- Vehicle matching algorithm testing
- Database update operation testing
- Error handling scenario testing

### Integration Testing Scenarios
- End-to-end update workflow testing
- Transaction rollback testing
- Concurrent update handling
- Database constraint validation

### Test Data Setup
```mermaid
graph TD
    A[Test Database] --> B[Sample Vehicles]
    A --> C[Various Status States]
    A --> D[Maintenance History]
    
    B --> B1[Exact Name Matches]
    B --> B2[Similar Name Variants]
    B --> B3[Duplicate Names]
    
    C --> C1[All Status Types]
    C --> C2[Recent Updates]
    C --> C3[Stale Records]
```

## Performance Considerations

### Batch Processing Optimization
- Implement database connection pooling
- Use prepared statements for bulk updates
- Optimize transaction batch sizes
- Monitor memory usage during large updates

### Scalability Measures
- Index optimization for vehicle name lookups
- Caching mechanism for frequent status checks
- Asynchronous processing for large batches
- Progress tracking for long-running operations

## Security and Audit

### Security Requirements
- Validate all input data to prevent SQL injection
- Implement access control for status update operations
- Log all administrative actions with user attribution
- Encrypt sensitive vehicle information if required

### Audit Trail Design
```mermaid
erDiagram
    STATUS_UPDATE_LOG {
        integer id PK
        integer car_id FK
        text old_status
        text new_status
        text update_reason
        text source_reference
        datetime updated_at
        text updated_by
        text client_info
    }
```

## Monitoring and Alerting

### Operational Metrics
- Update success/failure rates
- Processing time per vehicle
- Database transaction duration
- Error frequency by type

### Alert Conditions
- Failed batch updates
- Suspicious status change patterns
- Database connectivity issues
- Validation rule violations

This design provides a comprehensive framework for implementing the vehicle status updater while maintaining system integrity and providing robust error handling capabilities.