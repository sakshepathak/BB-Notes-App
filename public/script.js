/**
 * Bread & Butter [bb] — Notes App
 * Frontend Application Logic
 *
 * Architecture:
 *   - All state is managed in `app.state`
 *   - All DOM references are resolved once in `app.initElements()`
 *   - API calls go through a single `app.request()` helper
 *   - UI rendering and interaction handlers are separate, reusable methods
 */

const app = {
  // ─── State ──────────────────────────────────────────────
  state: {
    notes: [],
    activeNoteId: null,
    previousContent: null, // Store content before rewrite for undo
    timeouts: {}
  },

  // ─── DOM Element References (populated in initElements) ─
  el: {},

  // ─── Initialization ─────────────────────────────────────
  init() {
    this.initElements();
    this.bindEvents();
    this.fetchNotes();
    this.renderIcons();
  },

  /** Resolve all DOM references once, after the DOM is ready. */
  initElements() {
    this.el = {
      notesList:       document.getElementById('notes-list'),
      noteTitle:       document.getElementById('note-title'),
      noteContent:     document.getElementById('note-content'),
      breadcrumbTitle: document.getElementById('breadcrumb-title'),
      searchInput:     document.getElementById('search-input'),
      newNoteBtn:      document.getElementById('new-note-btn'),
      createFirstNote: document.getElementById('create-first-note'),
      summarizeBtn:    document.getElementById('summarize-btn'),
      rewriteBtn:      document.getElementById('rewrite-btn'),
      undoRewriteBtn:  document.getElementById('undo-rewrite-btn'),
      deleteNoteBtn:   document.getElementById('delete-note-btn'),
      saveStatus:      document.getElementById('save-status'),
      emptyState:      document.getElementById('empty-state'),
      editorView:      document.getElementById('editor-view'),
      summaryDrawer:   document.getElementById('summary-drawer'),
      summaryContent:  document.getElementById('summary-content'),
      closeSummary:    document.getElementById('close-summary'),
      notifications:   document.getElementById('notifications'),
      confirmModal:    document.getElementById('confirm-modal'),
      confirmCancel:   document.getElementById('confirm-cancel'),
      confirmOk:       document.getElementById('confirm-ok'),
      toolbarBtns:     document.querySelectorAll('.toolbar-btn, .color-btn')
    };
  },

  /** Attach all event listeners. */
  bindEvents() {
    this.el.newNoteBtn.addEventListener('click', () => this.createNote());
    this.el.createFirstNote.addEventListener('click', () => this.createNote());

    this.el.searchInput.addEventListener('input', (e) => {
      this.debounce('search', () => this.fetchNotes(e.target.value), 300);
    });

    this.el.noteTitle.addEventListener('input', () => {
      this.updateBreadcrumb();
      this.scheduleSave();
    });

    this.el.noteContent.addEventListener('input', () => this.scheduleSave());

    this.el.summarizeBtn.addEventListener('click', () => this.generateSummary());
    this.el.rewriteBtn.addEventListener('click', () => this.rewriteNote());
    this.el.undoRewriteBtn.addEventListener('click', () => this.undoRewrite());
    this.el.deleteNoteBtn.addEventListener('click', () => this.deleteNote());
    this.el.closeSummary.addEventListener('click', () => this.toggleSummary(false));

    // Toolbar events
    this.el.toolbarBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const format = btn.dataset.format;
        const value = btn.dataset.value;
        this.formatNote(format, value);
      });
    });

    // Handle special keys in editor
    this.el.noteContent.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        let node = range.startContainer;
        if (node.nodeType === 3) node = node.parentElement;
        
        const heading = node.closest('h1, h2');
        
        if (heading) {
          e.preventDefault();
          // Force a new paragraph after the heading
          document.execCommand('insertParagraph', false, null);
          document.execCommand('formatBlock', false, 'p');
          // Clear any inherited styles (like bold/heading styles)
          document.execCommand('removeFormat', false, null);
          this.scheduleSave();
        }
      }
    });

    // Handle checkbox clicks in the editor
    this.el.noteContent.addEventListener('change', (e) => {
      if (e.target && e.target.type === 'checkbox') {
        this.scheduleSave();
      }
    });

    // Handle paste as plain text (optional, but cleaner)
    this.el.noteContent.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    });
  },

  // ─── API Layer ──────────────────────────────────────────
  /**
   * Centralized fetch wrapper with error handling.
   * Returns parsed JSON, or `null` for 204 / errors.
   */
  async request(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || response.statusText);
      }

      // 204 No Content (e.g. delete) — nothing to parse
      if (response.status === 204) return { ok: true };

      return await response.json();
    } catch (err) {
      this.notify(err.message, 'error');
      console.error('[API]', err);
      return null;
    }
  },

  // ─── Core Actions ───────────────────────────────────────
  async fetchNotes(query = '') {
    const url = query
      ? `/api/notes?q=${encodeURIComponent(query)}`
      : '/api/notes';

    const notes = await this.request(url);
    if (notes) {
      this.state.notes = notes;
      this.renderNotesList();
    }
  },

  async createNote() {
    const note = await this.request('/api/notes', {
      method: 'POST',
      body: JSON.stringify({ title: 'Untitled', content: ' ' })
    });

    if (note) {
      this.state.notes.unshift(note);
      this.renderNotesList();
      this.selectNote(note.id);
      this.el.noteTitle.focus();
      this.el.noteTitle.select();
    }
  },

  async saveNote() {
    if (!this.state.activeNoteId) return;

    this.setSaveStatus('saving');

    const updated = await this.request(`/api/notes/${this.state.activeNoteId}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: this.el.noteTitle.value,
        content: this.el.noteContent.innerHTML
      })
    });

    if (updated) {
      const idx = this.state.notes.findIndex(n => n.id === updated.id);
      if (idx !== -1) {
        this.state.notes[idx] = updated;
        this.updateSidebarItem(updated);
      }
      this.setSaveStatus('saved');
    } else {
      this.setSaveStatus('error');
    }
  },

  async deleteNote() {
    const idToDelete = this.state.activeNoteId;
    if (idToDelete === null || idToDelete === undefined) {
      console.warn('[Delete] No active note ID to delete.');
      return;
    }

    this.showConfirmDialog(
      'Delete Note',
      'Are you sure you want to delete this note? This will permanently remove it from your workspace.',
      async () => {
        try {
          // Cancel any pending save
          this.debounce('save', () => {}, 0);

          // Optimistic UI: Remove it from state immediately
          // Use != to handle potential string/number mismatches
          this.state.notes = this.state.notes.filter(n => n.id != idToDelete);
          this.state.activeNoteId = null;
          
          // Update UI immediately
          this.renderNotesList();
          this.showView('empty');
          this.toggleSummary(false);

          const result = await this.request(
            `/api/notes/${idToDelete}`,
            { method: 'DELETE' }
          );

          if (result) {
            this.notify('Note deleted');
          } else {
            // If the API call failed, reload notes to stay in sync
            console.error('[Delete] Server-side deletion failed for ID:', idToDelete);
            this.fetchNotes();
          }
        } catch (err) {
          console.error('[Delete] Async operation failed:', err);
          this.fetchNotes();
        }
      }
    );
  },

  showConfirmDialog(title, message, onConfirm) {
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;

    this.el.confirmModal.classList.remove('hidden');

    // Remove any previous listeners to avoid stacking
    const oldOk = this.el.confirmOk;
    const oldCancel = this.el.confirmCancel;
    
    const newOk = oldOk.cloneNode(true);
    const newCancel = oldCancel.cloneNode(true);
    
    oldOk.parentNode.replaceChild(newOk, oldOk);
    oldCancel.parentNode.replaceChild(newCancel, oldCancel);
    
    // Update references in this.el
    this.el.confirmOk = newOk;
    this.el.confirmCancel = newCancel;

    const cleanup = () => {
      this.el.confirmModal.classList.add('hidden');
    };

    this.el.confirmOk.addEventListener('click', () => {
      cleanup();
      onConfirm();
    }, { once: true });

    this.el.confirmCancel.addEventListener('click', () => {
      cleanup();
    }, { once: true });
  },

  async generateSummary() {
    if (!this.state.activeNoteId) return;

    this.el.summarizeBtn.disabled = true;
    this.el.summarizeBtn.innerHTML =
      '<span class="loading-spinner-small"></span> Summarizing…';

    const updated = await this.request(
      `/api/notes/${this.state.activeNoteId}/summarize`,
      { method: 'POST' }
    );

    if (updated && updated.summary) {
      this.el.summaryContent.textContent = updated.summary;
      this.toggleSummary(true);

      const idx = this.state.notes.findIndex(n => n.id === updated.id);
      if (idx !== -1) this.state.notes[idx] = updated;
      this.notify('Summary generated');
    }

    this.el.summarizeBtn.disabled = false;
    this.el.summarizeBtn.innerHTML =
      '<i data-lucide="sparkles" style="width:16px;height:16px"></i> Summarize';
    this.renderIcons();
  },

  async rewriteNote() {
    const content = this.el.noteContent.innerHTML;
    
    if (!content || content.trim().length < 5) {
      this.notify('Content too short to rewrite', 'error');
      return;
    }

    this.el.rewriteBtn.disabled = true;
    const originalText = this.el.rewriteBtn.innerHTML;
    this.el.rewriteBtn.innerHTML = '<span class="loading-spinner-small"></span> Rewriting...';

    const result = await this.request('/api/notes/rewrite', {
      method: 'POST',
      body: JSON.stringify({ content })
    });

    if (result && result.rewritten) {
      // Save current content for undo
      this.state.previousContent = content;
      
      // Update editor with rewritten content
      this.el.noteContent.innerHTML = result.rewritten;
      
      // Show undo button
      this.el.undoRewriteBtn.classList.remove('hidden');
      
      this.notify('Note rewritten by AI');
      this.scheduleSave();
    }

    this.el.rewriteBtn.disabled = false;
    this.el.rewriteBtn.innerHTML = originalText;
    this.renderIcons();
  },

  undoRewrite() {
    if (this.state.previousContent !== null) {
      this.el.noteContent.innerHTML = this.state.previousContent;
      this.state.previousContent = null;
      this.el.undoRewriteBtn.classList.add('hidden');
      this.notify('Changes undone');
      this.scheduleSave();
    }
  },

  formatNote(format, value = null) {
    this.el.noteContent.focus();
    
    switch(format) {
      case 'bold':
        document.execCommand('bold', false, null);
        break;
      case 'italic':
        document.execCommand('italic', false, null);
        break;
      case 'h1':
      case 'h2':
        {
          const currentBlock = document.queryCommandValue('formatBlock');
          if (currentBlock === format.toLowerCase()) {
            document.execCommand('formatBlock', false, 'p');
          } else {
            document.execCommand('formatBlock', false, format.toUpperCase());
          }
        }
        break;
      case 'p':
        document.execCommand('formatBlock', false, 'p');
        document.execCommand('removeFormat', false, null);
        break;
      case 'unorderedList':
        document.execCommand('insertUnorderedList', false, null);
        break;
      case 'orderedList':
        document.execCommand('insertOrderedList', false, null);
        break;
      case 'hiliteColor':
        if (value === 'transparent') {
          // Effectively remove highlight/background
          document.execCommand('hiliteColor', false, 'white'); // Falls back to white/transparent
          document.execCommand('removeFormat', false, null); // Nuclear option for clearing
        } else {
          document.execCommand('hiliteColor', false, value);
        }
        break;
      case 'checkbox':
        // More robust checkbox structure
        // Using a more standard structure for better compatibility
        const checkboxHtml = '<div class="todo-item" contenteditable="false"><input type="checkbox"> <span contenteditable="true" class="todo-text">New Task</span></div><p> </p>';
        document.execCommand('insertHTML', false, checkboxHtml);
        break;
    }
    
    this.scheduleSave();
  },

  // ─── UI Rendering ───────────────────────────────────────
  renderNotesList() {
    const { notes, activeNoteId } = this.state;

    if (notes.length === 0) {
      this.el.notesList.innerHTML =
        '<div class="loading-spinner">No notes yet</div>';
      return;
    }

    this.el.notesList.innerHTML = '';

    notes.forEach(note => {
      const item = document.createElement('div');
      item.className = `note-item${note.id === activeNoteId ? ' active' : ''}`;
      item.dataset.id = note.id;
      item.innerHTML = `
        <div class="note-icon">
          <i data-lucide="file-text" style="width:14px;height:14px"></i>
        </div>
        <div class="note-item-title">${this.escapeHtml(note.title || 'Untitled')}</div>
      `;
      item.addEventListener('click', () => this.selectNote(note.id));
      this.el.notesList.appendChild(item);
    });

    this.renderIcons();
  },

  selectNote(id) {
    this.state.activeNoteId = id;
    const note = this.state.notes.find(n => n.id === id);
    if (!note) return;

    this.el.noteTitle.value = note.title || '';
    this.el.noteContent.innerHTML = note.content || '';
    this.updateBreadcrumb();

    if (note.summary) {
      this.el.summaryContent.textContent = note.summary;
    } else {
      this.toggleSummary(false);
    }

    // Reset undo state when switching notes
    this.state.previousContent = null;
    this.el.undoRewriteBtn.classList.add('hidden');

    this.showView('editor');

    // Highlight active item in sidebar
    document.querySelectorAll('.note-item').forEach(el => {
      el.classList.toggle('active', parseInt(el.dataset.id) === id);
    });
  },

  // ─── UI Helpers ─────────────────────────────────────────
  updateSidebarItem(note) {
    const titleEl = document.querySelector(
      `.note-item[data-id="${note.id}"] .note-item-title`
    );
    if (titleEl) titleEl.textContent = note.title || 'Untitled';
  },

  updateBreadcrumb() {
    this.el.breadcrumbTitle.textContent =
      this.el.noteTitle.value || 'Untitled';
  },

  showView(view) {
    const isEditor = view === 'editor';
    this.el.emptyState.classList.toggle('hidden', isEditor);
    this.el.editorView.classList.toggle('hidden', !isEditor);
  },

  toggleSummary(show) {
    this.el.summaryDrawer.classList.toggle('open', show);
  },

  setSaveStatus(status) {
    const el = this.el.saveStatus;
    el.classList.add('visible');

    const icons = {
      saving:  '<span class="loading-spinner-small"></span> Saving…',
      saved:   '<i data-lucide="check" style="width:12px;height:12px"></i> Saved',
      error:   '<i data-lucide="alert-circle" style="width:12px;height:12px;color:var(--danger-color)"></i> Error'
    };

    el.innerHTML = icons[status] || '';
    this.renderIcons();

    if (status === 'saved') {
      setTimeout(() => el.classList.remove('visible'), 2000);
    }
  },

  // ─── Utilities ──────────────────────────────────────────
  scheduleSave() {
    this.debounce('save', () => this.saveNote(), 800);
  },

  debounce(key, fn, delay) {
    clearTimeout(this.state.timeouts[key]);
    this.state.timeouts[key] = setTimeout(fn, delay);
  },

  notify(message, type = 'info') {
    const el = document.createElement('div');
    el.className = 'notification';
    const icon = type === 'error' ? 'alert-circle' : 'check-circle';
    el.innerHTML = `
      <i data-lucide="${icon}" style="width:16px;height:16px"></i>
      <span>${this.escapeHtml(message)}</span>
    `;
    this.el.notifications.appendChild(el);
    this.renderIcons();

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  },

  /** Prevent XSS when inserting user-provided text into innerHTML. */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /** Render all Lucide icons on the page. */
  renderIcons() {
    if (window.lucide) window.lucide.createIcons();
  }
};

// ─── Bootstrap ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => app.init());
