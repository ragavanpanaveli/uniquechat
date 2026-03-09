# UniqueChat Project Documentation

Welcome to **UniqueChat**, a modern, feature-rich real-time chat application built with a focus on premium user experience and AI integration.

## 🚀 Overview
UniqueChat is a full-stack communication platform that supports real-time 1-on-1 messaging, group chats, and a personal AI Best Friend chatbot. It leverages Supabase for real-time data synchronization and Google's Gemini AI for an interactive conversational experience.

---

## 🛠 Tech Stack

### **Frontend**
- **Library**: React.js with TypeScript
- **Build Tool**: Vite
- **Styling**: Vanilla CSS (Premium Glassmorphism & Dynamic Animations)
- **Icons**: Lucide-React
- **State/Auth**: Supabase Auth & Realtime SDK

### **Backend**
- **API Environment**: Vercel Serverless Functions (`/api`) & Express Node.js Server (`/server`)
- **AI Model**: Google Gemini 2.0 Flash
- **Image Generation**: Pollinations AI Integration

### **Database & Storage**
- **Provider**: Supabase (PostgreSQL)
- **Realtime**: Supabase Realtime for instant messaging
- **Storage**: Supabase Buckets for file and image sharing

---

## ✨ Key Features

1.  **Real-time Messaging**: Instant delivery of messages in 1-on-1 and group chats.
2.  **AI Best Friend**: A smart chatbot (UniqueChat AI) with:
    -   **Contextual Memory**: Remembers previous parts of the conversation.
    -   **Multilingual Support**: Speaks in English, Tamil, and Thanglish.
    -   **Image Recognition**: Can analyze images uploaded by users.
    -   **Image Generation**: Generate images using `/generate [prompt]` command.
3.  **Group Management**:
    -   Create groups with names and descriptions.
    -   Invite/Member management system.
4.  **Friend System**:
    -   Send/Accept/Reject friend requests.
    -   View online/offline status.
5.  **File Sharing**:
    -   Upload and share images, PDFs, and documents.
    -   Real-time download links and previews.
6.  **Premium UI/UX**:
    -   Glassmorphism effects and dynamic gradients.
    -   Browser-based Text-to-Speech (TTS) for AI replies.
    -   Message status indicators (Ticks: Sent/Seen).
    -   Responsive design for Mobile & Desktop.

---

## 📂 Project Structure

```text
uniquechat-monorepo/
├── api/                # Vercel Serverless Functions
│   └── chat.js         # AI Chat handling logic
├── client/             # Frontend React Application
│   ├── src/            # Components, styles, and main logic
│   ├── public/         # Static assets
│   └── index.html      # Main entry point
├── server/             # Express Backend (Alternative/Helper)
│   └── index.js        # Server logic
├── supabase_schema.sql # Database table definitions
└── documentation.md    # This file
```

---

## 🗄 Database Schema

The system uses the following core tables:
- **`profiles`**: Stores user metadata (usernames, avatars, status).
- **`messages`**: Stores all chat history for both direct and group chats.
- **`friends`**: Tracks friendship connections.
- **`friend_requests`**: Manages pending friend requests.
- **`chat_groups`**: Stores group metadata.
- **`chat_group_members`**: Tracks which users belong to which groups.

---

## ⚙️ Setup & Installation

### **1. Prerequisites**
- Node.js (v18+)
- Supabase Project (Active)
- Gemini API Key from Google AI Studio

### **2. Environment Variables**
Create `.env` files in both `client/` and `server/` (or `api/` for Vercel):

**Client (`client/.env`):**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_AI_URL=http://localhost:3000/api/chat  # Or production URL
```

**Server/API (`server/.env`):**
```env
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### **3. Running Locally**
1. Install dependencies:
   ```bash
   npm run install-all
   ```
2. Start the development server:
   ```bash
   cd client && npm run dev
   ```
3. (Optional) Start the backend server:
   ```bash
   cd server && node index.js
   ```

---

## 🚀 Deployment

The project is designed to be deployed on:
- **Frontend & AI API**: Vercel (Configured via `vercel.json` and `/api` folder).
- **Database**: Supabase.

---

**Notes:** 
- Make sure Row Level Security (RLS) is correctly enabled in Supabase as per `supabase_schema.sql`.
- AI personality is tuned to be friendly and supportive ("Machi" style).

---

Documentation prepared by **Antigravity AI**.
*Project Documentation for UniqueChat - Version 1.0 (Feb 2026)*

---
