# User Authentication Bot Design

## Overview

This document outlines the design for implementing a comprehensive user authentication system in the Telegram bot. The system manages user authorization through a multi-step verification process involving nickname submission, photo proof, and administrative approval.

## Technology Stack & Dependencies

- **Runtime**: Node.js with existing sqlite3 database
- **Telegram API**: node-telegram-bot-api for bot interactions
- **Database**: SQLite with existing user authorization schema
- **Storage**: File system for photo storage
- **Authentication Flow**: Multi-step verification with admin approval

## Component Architecture

### Core Components

```mermaid
graph TB
    A[Telegram Bot] --> B[Auth Controller]
    B --> C[Auth Service]
    C --> D[User Model]
    C --> E[Auth Request Model]
    C --> F[Photo Storage Service]
    D --> G[SQLite Database]
    E --> G
    F --> H[File System]
    B --> I[Admin Panel Controller]
    I --> J[Admin Service]
    J --> E
```

### Component Hierarchy

1. **Telegram Bot Interface**
   - Message handlers for /start command
   - Inline keyboard management
   - Photo upload handling
   - Admin notification system

2. **Authentication Controller**
   - User status verification
   - Authorization flow orchestration
   - Response formatting

3. **Authentication Service**
   - Multi-step auth workflow management
   - Validation logic
   - State management

4. **Data Layer**
   - User model extensions
   - Authentication request tracking
   - Photo metadata storage

## Database Schema Extensions

### New Table: auth_requests

```sql
CREATE TABLE auth_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    telegram_id BIGINT NOT NULL,
    nickname TEXT NOT NULL,
    photo_path TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    admin_id INTEGER,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (admin_id) REFERENCES users(id)
);
```

### Extended User Model Properties

```mermaid
erDiagram
    USERS {
        integer id PK
        bigint telegram_id UK
        string username
        string first_name
        string last_name
        string language_code
        boolean is_bot
        integer authorized "0=unauthorized, 1=authorized"
        datetime created_at
        datetime updated_at
    }
    
    AUTH_REQUESTS {
        integer id PK
        integer user_id FK
        bigint telegram_id
        string nickname "Name_Surname format"
        string photo_path
        string status "pending/approved/rejected"
        integer admin_id FK
        datetime submitted_at
        datetime processed_at
    }
    
    USERS ||--o{ AUTH_REQUESTS : "submits"
    USERS ||--o{ AUTH_REQUESTS : "processes as admin"
```

## Authentication Flow Architecture

### User Authentication Workflow

```mermaid
sequenceDiagram
    participant U as User
    participant B as Bot
    participant AS as Auth Service
    participant DB as Database
    participant A as Admin
    
    U->>B: /start command
    B->>AS: Check user status
    AS->>DB: Query user.authorized
    
    alt User not authorized (status = 0)
        DB-->>AS: authorized = 0
        AS-->>B: Return unauthorized status
        B-->>U: Show "Авторизация" inline button
        
        U->>B: Click "Авторизация"
        B-->>U: Request nickname (Name_Surname)
        U->>B: Submit nickname
        B->>AS: Validate nickname format
        
        alt Valid nickname
            AS-->>B: Nickname accepted
            B-->>U: Request photo + instructions
            Note over U,B: Instructions: Write "/fam Это я", take screenshot with /time, send compressed photo
            
            U->>B: Send photo
            B->>AS: Process auth request
            AS->>DB: Store auth request
            AS->>B: Notify admin
            B->>A: Send approval request
            B-->>U: "Данные отправлены на проверку"
            
            alt Admin approves
                A->>B: Click "Принять"
                B->>AS: Process approval
                AS->>DB: Update user.authorized = 1
                AS->>DB: Update auth_request.status = 'approved'
                B-->>U: "Вы приняты"
                
            else Admin rejects
                A->>B: Click "Отказать"
                B->>AS: Process rejection
                AS->>DB: Update auth_request.status = 'rejected'
                B-->>U: "Вам отказано" + retry option
            end
            
        else Invalid nickname
            AS-->>B: Nickname invalid
            B-->>U: Error message + retry
        end
        
    else User authorized (status = 1)
        DB-->>AS: authorized = 1
        AS-->>B: Return authorized status
        B-->>U: Show main menu (no auth button)
    end
```

### Administrative Approval Interface

```mermaid
flowchart TD
    A[New Auth Request] --> B[Admin Notification]
    B --> C{Admin Decision}
    C -->|Approve| D[Update user.authorized = 1]
    C -->|Reject| E[Keep user.authorized = 0]
    D --> F[Send approval message to user]
    E --> G[Send rejection message + retry option]
    F --> H[Log approval in auth_requests]
    G --> I[Log rejection in auth_requests]
```

## API Endpoints & Message Handlers

### Bot Command Handlers

| Command/Action | Handler Function | Description |
|----------------|-----------------|-------------|
| `/start` | handleStartCommand | Check auth status, show appropriate interface |
| Inline Button: "Авторизация" | handleAuthButton | Initialize auth flow |
| Text Input | handleNicknameInput | Process nickname submission |
| Photo Upload | handlePhotoUpload | Process photo submission |
| Admin Button: "Принять" | handleApprovalButton | Approve auth request |
| Admin Button: "Отказать" | handleRejectionButton | Reject auth request |

### Service Methods

```javascript
// AuthService methods
class AuthService {
    async checkUserStatus(telegramId)
    async validateNickname(nickname) 
    async createAuthRequest(userId, nickname, photoPath)
    async processPhotoUpload(userId, photo)
    async sendAdminNotification(authRequest)
    async approveRequest(requestId, adminId)
    async rejectRequest(requestId, adminId)
    async getUserPendingRequest(userId)
}
```

## Business Logic Layer

### Authentication State Management

```mermaid
stateDiagram-v2
    [*] --> Unauthorized : New user
    Unauthorized --> NicknameInput : Click "Авторизация"
    NicknameInput --> PhotoUpload : Valid nickname
    NicknameInput --> NicknameInput : Invalid nickname
    PhotoUpload --> PendingApproval : Photo submitted
    PendingApproval --> Authorized : Admin approves
    PendingApproval --> Rejected : Admin rejects
    Rejected --> NicknameInput : User retries
    Authorized --> [*] : Process complete
```

### Validation Rules

1. **Nickname Format Validation**
   - Pattern: `^[A-Za-z]+_[A-Za-z]+$`
   - Example: "John_Smith", "Maria_Gonzalez"
   - No numbers, special characters, or spaces

2. **Photo Validation**
   - Must be compressed Telegram photo
   - File size limits as per Telegram API
   - Supported formats: JPG, PNG

3. **Admin Authorization**
   - Admin users identified by telegram_id in environment config
   - Only admins can process approval/rejection requests

### Error Handling

```mermaid
graph TD
    A[User Action] --> B{Validation}
    B -->|Pass| C[Process Request]
    B -->|Fail| D[Send Error Message]
    C --> E{Database Operation}
    E -->|Success| F[Send Success Response]
    E -->|Error| G[Log Error + Send Generic Error]
    D --> H[Allow Retry]
    G --> I[Admin Notification if Critical]
```

## Data Models & Storage

### Auth Request Model

```javascript
class AuthRequest {
    constructor(data = {}) {
        this.id = data.id || null;
        this.user_id = data.user_id;
        this.telegram_id = data.telegram_id;
        this.nickname = data.nickname;
        this.photo_path = data.photo_path;
        this.status = data.status || 'pending';
        this.admin_id = data.admin_id || null;
        this.submitted_at = data.submitted_at;
        this.processed_at = data.processed_at || null;
    }
    
    static async create(requestData)
    static async findByUserId(userId)
    static async findPendingRequests()
    async updateStatus(status, adminId)
    async getPhotoBuffer()
}
```

### Photo Storage Strategy

```mermaid
graph LR
    A[Photo Upload] --> B[Generate Unique Filename]
    B --> C[Store in /uploads/auth-photos/]
    C --> D[Save Path in Database]
    D --> E[Return File Reference]
    
    F[Admin Review] --> G[Display Photo from Path]
    H[Cleanup Job] --> I[Remove Rejected Photos After 30 days]
```

**Storage Structure:**
```
/uploads/
  /auth-photos/
    /{telegram_id}_{timestamp}.jpg
    /2024/01/
      /user_12345_20240115_143022.jpg
```

## User Interface Flow

### Unauthorized User Experience

1. **Initial Contact**
   ```
   User: /start
   Bot: Добро пожаловать! 
        [Авторизация] <- Inline Button
   ```

2. **Authentication Process**
   ```
   User: Click [Авторизация]
   Bot: Введите ваш никнейм в формате Name_Surname
   
   User: John_Smith
   Bot: Отправьте сжатую фотографию для Telegram.
        Инструкция: Напишите "/fam Это я", 
        выполните /time и отправьте скриншот боту.
   
   User: [sends photo]
   Bot: Данные отправлены на проверку информации
   ```

3. **Approval Notification**
   ```
   Bot: Вы приняты (if approved)
   Bot: Вам отказано. [Подать заявку повторно] (if rejected)
   ```

### Admin Interface

```
Admin receives:
Новая заявка от John_Smith
Telegram ID: 12345678
Username: @johnsmith
[Photo displayed]

[Принять] [Отказать] <- Inline buttons
```

## Middleware & State Management

### Session State Tracking

```javascript
// In-memory session store for auth flow
const authSessions = new Map();

class AuthSession {
    constructor(telegramId) {
        this.telegramId = telegramId;
        this.state = 'idle'; // idle, waiting_nickname, waiting_photo
        this.nickname = null;
        this.startedAt = Date.now();
    }
}
```

### Middleware Chain

```mermaid
graph LR
    A[Message Received] --> B[Auth Check Middleware]
    B --> C[Rate Limiting]
    C --> D[Input Validation]
    D --> E[Business Logic]
    E --> F[Response Formatter]
    F --> G[Send Response]
    
    B --> H{User Authorized?}
    H -->|No| I[Auth Flow Handler]
    H -->|Yes| J[Main App Handler]
```

## Testing Strategy

### Unit Tests

1. **AuthService Tests**
   - Nickname validation logic
   - Photo processing workflow
   - Admin notification formatting
   - Database operations

2. **Model Tests**
   - AuthRequest CRUD operations
   - User authorization status updates
   - Data validation rules

3. **Controller Tests**
   - Message handler routing
   - Inline keyboard generation
   - Error response formatting

### Integration Tests

1. **Auth Flow Tests**
   - Complete user registration workflow
   - Admin approval/rejection process
   - Photo upload and storage
   - State management across sessions

2. **Database Tests**
   - Migration validation
   - Transaction handling
   - Foreign key constraints
   - Data consistency checks

### Test Data Examples

```javascript
const testUsers = {
    unauthorized: { telegram_id: 12345, authorized: 0 },
    authorized: { telegram_id: 67890, authorized: 1 },
    admin: { telegram_id: 99999, authorized: 1, is_admin: true }
};

const testAuthRequests = {
    pending: { nickname: "John_Smith", status: "pending" },
    approved: { nickname: "Jane_Doe", status: "approved" },
    rejected: { nickname: "Bob_Wilson", status: "rejected" }
};
```