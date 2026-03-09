# UniqueChat Architectural Diagrams & Process Flows

This document provides a visual representation of how **UniqueChat** works, including its system architecture, database structure, and key process flows using Mermaid diagrams.

---

## 1. High-Level System Architecture

This diagram shows the interaction between the frontend, the backend services, and external APIs.

```mermaid
graph TD
    subgraph Client_Side [Frontend - React/Vite]
        UI[User Interface]
        SC[Supabase Client]
        AC[AI Client - Fetch]
    end

    subgraph Backend_Services [Backend]
        Vercel[Vercel Serverless API /api/chat]
        Express[Node.js Express Server]
    end

    subgraph Database_Storage [Supabase Cloud]
        Auth[Supabase Auth]
        DB[(PostgreSQL Database)]
        Realtime[Realtime Engine]
        Storage[Supabase Buckets]
    end

    subgraph External_APIs [AI Providers]
        Gemini[Google Gemini 2.0 Flash]
        Pollinations[Pollinations AI - Image Gen]
    end

    UI <--> SC
    SC <--> Auth
    SC <--> DB
    SC <--> Realtime
    SC <--> Storage

    UI <--> AC
    AC <--> Vercel
    AC <--> Express
    Vercel <--> Gemini
    Vercel <--> Pollinations
```

---

## 2. Database Schema (ER Diagram)

Representing the relationships between users, messages, friends, and groups.

```mermaid
erDiagram
    PROFILES ||--o{ FRIENDS : "has"
    PROFILES ||--o{ FRIEND_REQUESTS : "sends/receives"
    PROFILES ||--o{ CHAT_GROUPS : "creates"
    PROFILES ||--o{ CHAT_GROUP_MEMBERS : "belongs to"
    PROFILES ||--o{ MESSAGES : "sends"
    
    CHAT_GROUPS ||--o{ CHAT_GROUP_MEMBERS : "contains"
    CHAT_GROUPS ||--o{ MESSAGES : "has"

    PROFILES {
        uuid id PK
        string username
        string avatar_url
        string description
        timestamp created_at
    }

    FRIENDS {
        uuid id PK
        uuid user_id FK
        uuid friend_id FK
        timestamp created_at
    }

    CHAT_GROUPS {
        uuid id PK
        string name
        string description
        uuid created_by FK
    }

    MESSAGES {
        uuid id PK
        uuid sender_id FK
        uuid receiver_id FK
        uuid group_id FK
        text content
        boolean is_seen
        timestamp created_at
    }
```

---

## 3. Real-time Messaging Flow

How messages are delivered instantly without page refreshes.

```mermaid
sequenceDiagram
    participant S as Sender (Client)
    participant DB as Supabase DB
    participant RT as Supabase Realtime
    participant R as Receiver (Client)

    S->>DB: Insert Message into 'messages' table
    Note over DB: Postgres Trigger/WAL Log
    DB->>RT: Notify Change
    RT->>R: Broadcast Event (Subscription)
    R->>R: Update UI state & Play notification
```

---

## 4. AI Best Friend Interaction Flow

Processing chat messages, image analysis, and image generation.

```mermaid
flowchart TD
    Start([User sends message to AI]) --> Type{Is it a command?}
    
    Type -- "/generate [prompt]" --> GenImage[Call Pollinations AI API]
    GenImage --> ReturnImage[Return Image URL to UI]
    
    Type -- Normal Chat --> HasImage{Has Image Upload?}
    
    HasImage -- Yes --> Vision[Send Image + Text to Gemini 2.0 Flash]
    HasImage -- No --> Memory[Send History + Text to Gemini 2.0 Flash]
    
    Vision --> Response[AI generates reply]
    Memory --> Response
    
    Response --> Display([Display AI Reply in Chat UI])
```

---

## 5. File Sharing Process

Handling uploads and sharing documents/images in chat.

```mermaid
sequenceDiagram
    participant U as User
    participant S as Supabase Storage
    participant DB as Supabase DB
    participant R as Recipient

    U->>S: Upload file to 'chat-files' bucket
    S-->>U: Return Public URL
    U->>DB: Send Message with File URL & Metadata
    DB-->>R: Realtime Update
    R->>R: Display Preview / Download Button
```

---

## 6. Authentication & Authorization

```mermaid
graph LR
    User -->|Login/Signup| Auth[Supabase Auth]
    Auth -->|JWT Token| Client[Browser]
    Client -->|Check RLS| DB[PostgreSQL]
    DB -->|Filters Data| Client
```

---

Documentation prepared by **Antigravity AI**.
*Architecture & Process Diagrams for UniqueChat*
