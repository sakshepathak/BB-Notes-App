const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');

// Define API endpoints
router.post('/', noteController.addNote);
router.get('/', noteController.getAllNotes);
router.get('/:id', noteController.getNoteById);
router.put('/:id', noteController.updateNote);
router.delete('/:id', noteController.deleteNote);
router.post('/rewrite', noteController.rewriteNote);
router.post('/:id/summarize', noteController.generateSummary);

module.exports = router;
