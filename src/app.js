const path = require('path');
const express = require('express');
const cors = require('cors');
const noteRoutes = require('./routes/noteRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve the frontend from the 'public' folder using an absolute path
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/notes', noteRoutes);

// Serve index.html for the root route (SPA-style)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong on the server.",
    message: err.message
  });
});

module.exports = app;
