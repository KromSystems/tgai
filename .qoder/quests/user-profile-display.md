# User Profile Display Feature Design

## Overview
This design document outlines the implementation of a `/profile` command for the tgai Telegram bot that displays a visually appealing user profile with status-dependent imagery and comprehensive user information. The feature enhances user experience by providing personalized profile views based on authorization status.

## Technology Stack & Dependencies
- **Core Framework**: Node.js Telegram Bot application using `node-telegram-bot-api`
- **Database**: SQLite with existing User and TelegramModel tables
- **Image Processing**: Built-in file system operations for status-based image selection
- **UI Components**: Telegram inline keyboards and rich message formatting

## Architecture

### Component Structure
```mermaid
graph TB
    A[/profile Command] --> B[ProfileHandler]
    B --> C[UserDataRetriever]
    B --> D[ImageSelector]
    B --> E[ProfileFormatter]
    
    C --> F[User Model]
    C --> G[AuthRequest Model]
    C --> H[HelpMetrics Model]
    
    D --> I[Status Image Mapping]
    E --> J[Message Builder]
    E --> K[Inline Keyboard Builder]
    
    F --> L[SQLite Database]
    G --> L
    H --> L
    
    style A fill:#4CAF50
    style B fill:#2196F3
    style I fill:#FF9800
    style J fill:#9C27B0
```

### Profile Data Flow
```mermaid
sequenceDiagram
    participant U as User
    participant B as Bot
    participant PH as ProfileHandler
    participant UD as UserDataRetriever
    participant IS as ImageSelector
    participant PF as ProfileFormatter
    participant DB as Database
    
    U->>B: /profile command
    B->>PH: handleProfileCommand(msg)
    PH->>UD: getUserProfileData(telegramId)
    UD->>DB: findByTelegramId(telegramId)
    DB-->>UD: userData
    UD->>DB: getAuthRequestData(telegramId)
    DB-->>UD: authRequestData
    UD->>DB: getActivityMetrics(telegramId)
    DB-->>UD: metricsData
    UD-->>PH: completeProfileData
    PH->>IS: selectProfileImage(userStatus)
    IS-->>PH: imageBuffer/path
    PH->>PF: formatProfileMessage(profileData)
    PF-->>PH: formattedMessage + keyboard
    PH->>B: sendPhoto(image, message, keyboard)
    B-->>U: Profile Display
```

## Feature Implementation

### Profile Status Categories
The system categorizes users into three distinct profile types:

```mermaid
classDiagram
    class ProfileType {
        <<enumeration>>
        ADMIN_LEADER
        AUTHORIZED_USER
        UNAUTHORIZED_USER
    }
    
    class ProfileImageMapping {
        +ADMIN_LEADER: "лидер.png"
        +AUTHORIZED_USER: "авторизованные.png" 
        +UNAUTHORIZED_USER: "новички.png"
        +getImagePath(status) string
    }
    
    class UserProfileData {
        +telegram_id: number
        +username: string
        +first_name: string
        +last_name: string
        +authorization_status: number
        +registration_date: string
        +last_activity: string
        +profile_completeness: number
        +getDisplayName() string
        +getStatusBadge() string
        +getMemberSince() string
    }
    
    ProfileType --> ProfileImageMapping
    UserProfileData --> ProfileType
```

### Profile Display Components

#### Status-Based Visual Elements
Each profile type displays distinct visual characteristics:

| Profile Type | Image | Status Badge | Color Theme | Special Elements |
|--------------|-------|--------------|-------------|------------------|
| Admin Leader | лидер.png | 👑 Лидер | Gold/Yellow | Crown emoji, special privileges list |
| Authorized User | авторизованные.png | ✅ Авторизован | Green | Verification checkmark, access level |
| Unauthorized User | новички.png | 🔒 Не авторизован | Orange/Red | Lock icon, authorization prompt |

#### Profile Information Layout
```mermaid
graph TD
    A[Profile Header] --> B[User Avatar Image]
    A --> C[Status Badge]
    A --> D[Display Name]
    
    E[Personal Information] --> F[Telegram Username]
    E --> G[Full Name]
    E --> H[Language Setting]
    E --> I[Member Since Date]
    
    J[Status Information] --> K[Authorization Level]
    J --> L[Profile Completeness]
    J --> M[Last Activity]
    
    N[Interactive Elements] --> O[Quick Actions Keyboard]
    N --> P[Status-Specific Buttons]
    
    style A fill:#E3F2FD
    style E fill:#F3E5F5
    style J fill:#E8F5E8
    style N fill:#FFF3E0
```

### Message Formatting Structure

#### Profile Message Template
```markdown
[STATUS_EMOJI] **[USER_DISPLAY_NAME]**
[STATUS_BADGE]

👤 **Личная информация**
├── Имя: [FIRST_NAME] [LAST_NAME]
├── Username: @[USERNAME]
├── Язык: [LANGUAGE_CODE]
└── Участник с: [REGISTRATION_DATE]

📊 **Статус профиля**
├── Уровень доступа: [AUTHORIZATION_LEVEL]
├── Заполненность профиля: [COMPLETENESS]%
└── Последняя активность: [LAST_ACTIVITY]

[STATUS_SPECIFIC_INFORMATION]
```

#### Status-Specific Information Sections

**Admin Leader Profile:**
```markdown
👑 **Административные привилегии**
├── Управление пользователями
├── Просмотр заявок на авторизацию
├── Доступ к аналитике
└── Системные настройки
```

**Authorized User Profile:**
```markdown
✅ **Права доступа**
├── Полный доступ к боту
├── Использование всех команд
└── Участие в активностях
```

**Unauthorized User Profile:**
```markdown
🔒 **Статус авторизации**
├── Ограниченный доступ
├── Подача заявки: [REQUEST_STATUS]
└── Необходима авторизация
```

### Interactive Profile Elements

#### Dynamic Keyboard Layout
```mermaid
graph LR
    A[Profile Actions] --> B[Admin Actions]
    A --> C[User Actions]
    A --> D[Guest Actions]
    
    B --> E[👥 Управление пользователями]
    B --> F[📊 Аналитика]
    B --> G[⚙️ Настройки]
    
    C --> H[📝 Редактировать профиль]
    C --> I[📊 Моя статистика]
    C --> J[🔔 Уведомления]
    
    D --> K[🔐 Подать заявку]
    D --> L[❓ Помощь]
    D --> M[📋 Статус заявки]
    
    style B fill:#FFE0B2
    style C fill:#C8E6C9
    style D fill:#FFCDD2
```

## Database Integration

### Data Retrieval Strategy
```mermaid
erDiagram
    USER {
        number id PK
        number telegram_id UK
        string username
        string first_name
        string last_name
        string language_code
        number authorized
        datetime created_at
        datetime updated_at
    }
    
    AUTH_REQUEST {
        number id PK
        number user_id FK
        number telegram_id
        string status
        datetime submitted_at
        datetime processed_at
    }
    
    HELP_METRICS {
        number id PK
        number telegram_id
        string user_type
        datetime created_at
    }
    
    USER ||--o{ AUTH_REQUEST : "has"
    USER ||--o{ HELP_METRICS : "generates"
```

### Profile Data Aggregation
The profile command aggregates data from multiple sources:

1. **User Table**: Basic profile information and authorization status
2. **AuthRequest Table**: Current authorization request status for unauthorized users
3. **HelpMetrics Table**: Activity data for last activity calculation
4. **TelegramModel Table**: Admin-specific information for leaders

## Error Handling & Edge Cases

### User State Validation
```mermaid
flowchart TD
    A[/profile Command] --> B{User Exists?}
    B -->|No| C[Create User Profile]
    B -->|Yes| D{Data Complete?}
    
    C --> E[Show Basic Profile]
    D -->|No| F[Fetch Missing Data]
    D -->|Yes| G[Display Full Profile]
    
    F --> H{Fetch Successful?}
    H -->|No| I[Show Partial Profile]
    H -->|Yes| G
    
    G --> J[Send Profile Image]
    E --> J
    I --> J
    
    J --> K{Image Send Success?}
    K -->|No| L[Send Text-Only Profile]
    K -->|Yes| M[Profile Displayed]
    
    style C fill:#FFF3E0
    style F fill:#FFF3E0
    style I fill:#FFEBEE
    style L fill:#FFEBEE
```

### Fallback Mechanisms
- **Image Loading Failure**: Display text-based profile with emoji indicators
- **Database Connection Issues**: Show cached profile information if available
- **Incomplete User Data**: Display available information with placeholders for missing fields
- **Permission Errors**: Graceful degradation with appropriate user feedback

## Testing Strategy

### Unit Testing Components
```mermaid
graph TB
    A[Profile Feature Tests] --> B[ProfileHandler Tests]
    A --> C[UserDataRetriever Tests]
    A --> D[ImageSelector Tests]
    A --> E[ProfileFormatter Tests]
    
    B --> F[Command Recognition]
    B --> G[User Type Detection]
    B --> H[Error Handling]
    
    C --> I[Data Aggregation]
    C --> J[Query Optimization]
    C --> K[Missing Data Handling]
    
    D --> L[Image Path Resolution]
    D --> M[Status Mapping]
    D --> N[Fallback Images]
    
    E --> O[Message Formatting]
    E --> P[Keyboard Generation]
    E --> Q[Localization]
    
    style A fill:#E1F5FE
    style B fill:#E8F5E8
    style C fill:#FFF3E0
    style D fill:#F3E5F5
    style E fill:#FFEBEE
```

### Test Scenarios
1. **Admin Profile Display**: Verify crown image, admin privileges, and management tools
2. **Authorized User Profile**: Confirm green checkmark, full access indicators
3. **Unauthorized User Profile**: Test lock icon, authorization prompt, request status
4. **Edge Cases**: Missing usernames, incomplete registration, database errors
5. **Performance**: Response time under various load conditions
6. **Localization**: Profile display in different languages

## Implementation Considerations

### Performance Optimization
- **Image Caching**: Pre-load status images to reduce response time
- **Database Queries**: Single query to fetch all profile-related data
- **Message Formatting**: Template-based approach for consistent performance
- **Memory Management**: Efficient handling of user session data

### Security Measures
- **Data Sanitization**: Prevent injection attacks in profile display
- **Access Control**: Verify user permissions before displaying sensitive information
- **Privacy Protection**: Mask sensitive data for unauthorized viewers
- **Rate Limiting**: Prevent profile command abuse

### Scalability Features
- **Modular Design**: Easy addition of new profile sections and status types
- **Configuration-Driven**: Status mappings and templates in external configuration
- **Extensible Data Model**: Support for future profile enhancement features
- **Caching Strategy**: Implement profile data caching for high-frequency requests