# Installation & Setup Guide

## Prerequisites
- Node.js 18+
- npm or yarn
- Modern web browser (Chrome, Firefox, Safari, Edge)

## Installation Steps

### 1. Install Dependencies
```bash
npm install
```

This will install all packages including the new ones:
- `dexie` - Database management
- `fuse.js` - Search functionality  
- `jspdf` & `html2canvas` - Export features
- `zustand` - State management
- `use-debounce` - Performance optimization
- `clsx` - Utility styling

### 2. Start Development Server
```bash
# Start both Vite dev server and Node server
npm run dev:all

# Or run separately:
npm run dev      # Vite (port 5173)
npm run server   # Node server (port 3001)
```

### 3. Build for Production
```bash
npm run build
```

### 4. Build for Desktop (Electron)
```bash
npm run build:desktop
```

---

## New Features Setup

### Dark Mode
- Automatically detects system preference
- Saves preference to localStorage
- Keyboard shortcut: `Ctrl+D`
- Toggle button in top-right corner

### Database
- Uses IndexedDB (built-in browser database)
- No external database needed
- Automatic schema creation on first run
- Data persists across sessions

### Export Functionality
- Requires browser support for:
  - Blob API
  - File download API
  - Canvas API (for HTML to image)

### Search
- Uses Fuse.js fuzzy matching
- Searches across:
  - Conversation topics
  - Tags
  - Summaries
  - Saved metadata

### Authentication (SQLite)
- Uses a local SQLite database managed by the Node server
- Default DB path: `./data/nexus-auth.sqlite`
- Env overrides:
  - `SQLITE_PATH` - absolute or relative path for the SQLite file
- `AUTH_TOKEN_TTL_DAYS` - session expiry in days (default: 30)
- Client override for the auth server:
  - `VITE_API_BASE_URL` - base URL for the Node server (default: `http://localhost:3001`)
- API endpoints:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `POST /api/auth/logout`
- Client data is isolated per user with a dedicated local SQL.js database key:
  - `nexus_agents_db_<userId>`

---

## Configuration

### API Keys (in Settings Modal)
1. Google Gemini API Key
2. OpenAI API Key
3. Anthropic API Key
4. Groq API Key
5. XAI API Key
6. Local Model Base URL

### Local Storage
- `darkMode` - Theme preference
- `authToken` - Login session token
- `reaction-{messageId}` - Message reactions

### IndexedDB Storage
- Conversations table
- Messages table
- Templates table
- Metrics table
- Quotas table

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+F` | Open search |
| `Ctrl+N` | New conversation |
| `Ctrl+D` | Toggle dark mode |
| `Escape` | Close modal |

---

## Browser Requirements

### Minimum
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Features Used
- IndexedDB ✅
- LocalStorage ✅
- Blob API ✅
- Canvas API ✅
- File API ✅
- Fetch API ✅
- WebSocket (optional) ⚙️

---

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5173 (Vite)
npx kill-port 5173

# Kill process on port 3001 (Node)
npx kill-port 3001
```

### Database Issues
```javascript
// Open browser DevTools > Application > IndexedDB
// Look for "NexusAgentStudio" database
// Clear if having issues: DevTools > Storage > Clear all
```

### Export Not Working
- Check browser console for errors
- Verify browser allows downloads
- Disable ad blockers that might interfere

### Dark Mode Not Applying
- Clear localStorage: `localStorage.clear()`
- Refresh page
- Check browser dark mode support

---

## Performance Tips

1. **Limit Conversation Size**
   - Keep conversations under 100 messages for optimal performance
   - Archive old conversations periodically

2. **Clear Metrics Data**
   - Remove old metrics via browser DevTools if DB gets large
   - IndexedDB has size limits per domain

3. **Browser Cache**
   - Clear cache if experiencing issues
   - Cookies/storage doesn't need clearing for this app

---

## Security Considerations

1. **API Keys**
   - Never commit API keys to version control
   - Use environment variables for sensitive data
   - Store keys securely in settings

2. **Local Data**
   - All conversation data stays on your device
   - IndexedDB is client-side only
   - No automatic cloud sync (manual export recommended)

3. **Privacy**
   - Disable web analytics if privacy-focused
   - Use private browsing for sensitive conversations
   - Regularly export and backup important conversations

---

## Updating

### Update Dependencies
```bash
npm update
```

### Check for New Versions
```bash
npm outdated
```

### Major Version Update
```bash
npm install [package-name]@latest
```

---

## Development

### Add New Export Format
Edit `services/exportService.ts`:
```typescript
export async function exportToYourFormat(
  conversation: AgentConversationMessage[],
  options: ExportOptions
): Promise<void> {
  // Your export logic
  downloadFile(blob, `${options.filename}.ext`);
}
```

### Extend Keyboard Shortcuts
Edit `hooks/useKeyboardShortcuts.ts`:
```typescript
export const COMMON_SHORTCUTS = {
  YOURSHORTCUT: { key: 'y', ctrl: true, shift: false }
};
```

---

## Support

For issues and feature requests:
1. Check FEATURES.md for detailed feature documentation
2. Review browser console for errors
3. Check IndexedDB status in DevTools
4. Verify all dependencies are installed

---

**Version:** 2.0.0  
**Last Updated:** February 2026
