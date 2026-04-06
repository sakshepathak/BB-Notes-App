const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const aiService = require('../services/aiService');

/**
 * Sanitize user text: collapse whitespace, trim edges.
 * Returns empty string for null/undefined input.
 */
function cleanText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

const noteController = {
  /**
   * POST /api/notes — Create a new note.
   * Body: { title?: string, content: string }
   */
  addNote: async (req, res, next) => {
    try {
      const { title, content } = req.body;

      const cleanedTitle = cleanText(title) || 'Untitled';
      const cleanedContent = cleanText(content);

      const newNote = await prisma.note.create({
        data: {
          title: cleanedTitle,
          content: cleanedContent
        }
      });

      // Return immediately — don't block create on AI summarization
      res.status(201).json(newNote);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/notes/:id — Update an existing note.
   * Body: { title?: string, content?: string }
   */
  updateNote: async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const { title, content } = req.body;

      const data = {};
      if (title !== undefined) data.title = cleanText(title);
      if (content !== undefined) data.content = cleanText(content);

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'Nothing to update.' });
      }

      const updatedNote = await prisma.note.update({
        where: { id },
        data
      });

      res.json(updatedNote);
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Note not found.' });
      }
      next(error);
    }
  },

  /**
   * DELETE /api/notes/:id — Delete a note.
   */
  deleteNote: async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid note ID format.' });
      }

      await prisma.note.delete({ where: { id } });
      res.status(204).send();
    } catch (error) {
      // Prisma error code P2025: Record not found
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Note not found.' });
      }
      next(error);
    }
  },

  /**
   * GET /api/notes — Get all notes, with optional search via ?q=
   */
  getAllNotes: async (req, res, next) => {
    try {
      const { q } = req.query;

      const where = q
        ? {
            OR: [
              { title: { contains: q } },
              { content: { contains: q } },
              { summary: { contains: q } }
            ]
          }
        : {};

      const notes = await prisma.note.findMany({
        where,
        orderBy: { updatedAt: 'desc' }
      });

      res.json(notes);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/notes/:id/summarize — Generate AI summary for a note.
   */
  generateSummary: async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const note = await prisma.note.findUnique({ where: { id } });

      if (!note) {
        return res.status(404).json({ error: 'Note not found.' });
      }

      if (!note.content || note.content.trim().length < 10) {
        return res.status(400).json({
          error: 'Note content is too short to summarize.'
        });
      }

      const summary = await aiService.summarizeText(note.content);

      if (!summary) {
        return res.status(503).json({
          error: 'AI summary is unavailable. Check your GROQ_API_KEY in .env.'
        });
      }

      const updatedNote = await prisma.note.update({
        where: { id },
        data: { summary }
      });

      res.json(updatedNote);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/notes/rewrite — Rewrite AI-driven note content.
   * Body: { id?: number, content: string }
   * Note: This can take both a saved note ID or just raw content for speed.
   */
  rewriteNote: async (req, res, next) => {
    try {
      const { content } = req.body;

      if (!content || content.trim().length < 5) {
        return res.status(400).json({ error: 'Content too short to rewrite.' });
      }

      const rewritten = await aiService.rewriteText(content);

      if (!rewritten) {
        return res.status(503).json({
          error: 'AI rewrite failed. Check your GROQ_API_KEY in .env.'
        });
      }

      // We only return the rewritten content, we DON'T update the database automatically
      // to allow the user to review and undo if needed on the frontend.
      res.json({ rewritten });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/notes/:id — Get a single note by ID.
   */
  getNoteById: async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const note = await prisma.note.findUnique({ where: { id } });

      if (!note) {
        return res.status(404).json({ error: 'Note not found.' });
      }

      res.json(note);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = noteController;
