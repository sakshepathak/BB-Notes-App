# Notes Backend - Setup Guide

I've built a modular, clean, and reusable backend for your personal notes service. It's structured to be beginner-friendly but also scales for your future UI and AI integrations.

## Features
- **Clean Text Processing**: Automatically removes extra spaces and messy formatting before saving.
- **RESTful API**: Ready for any frontend to connect.
- **Prisma + SQLite**: Clean data management with a file-based database.
- **Error Handling**: Graceful error responses for a smooth experience.

## Steps to Run the Backend

Please run these commands in your terminal one by one:

### 1. Install Dependencies
This will install Express, Prisma, and other necessary packages.
```bash
npm install
```

### 2. Initialize Database and Generate Prisma Client
This will create your SQLite database file (`dev.db`) and set up the tables.
```bash
npx prisma migrate dev --name init
```

### 3. Start the Server
Now you can start the development server with auto-reload:
```bash
npm run dev
```

The server will be running at [http://localhost:3000](http://localhost:3000).

## API Endpoints
- **GET** `/api/notes`: See all your notes.
- **POST** `/api/notes`: Add a note. (Body: `{"content": "your text here"}`)
- **GET** `/api/notes/:id`: Fetch a specific note by its ID.

---
**Enjoy your clean notes service! Ready for UI and AI whenever you are.**
