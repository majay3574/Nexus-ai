# Quick Reference Guide - Nexus Agent Studio v2.0

## 🎯 Main Features at a Glance

### 🤖 Multi-Agent Conversations
- Start with 2 agents, add unlimited more
- Agents respond in round-robin order
- Human can join the conversation
- Real-time sentiment tracking

### 💾 Save & Manage Conversations
- Save conversations with tags and summaries
- Search across all saved conversations  
- Export to JSON, CSV, Markdown, or PDF
- Download as image for sharing

### 🌙 Dark Mode
- **Toggle:** Press `Ctrl+D` or click moon icon
- Auto-saves your preference
- Perfect for night mode usage

### 💭 Message Reactions
- Hover over agent messages to see options
- React with: 👍 Helpful | 👎 Not Helpful | 💡 Insightful
- Your reactions are saved locally

### ⌨️ Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Ctrl+F` | Search conversations |
| `Ctrl+N` | New conversation |
| `Ctrl+D` | Dark mode toggle |
| `Escape` | Close modals |

### 📋 Conversation Templates
1. Set up agents and settings
2. Click template icon
3. Save as reusable template
4. Quickly load same setup later

### 👤 Human Participation
1. Click "Add Human Input"
2. Type your message
3. Agents automatically respond
4. Continue the conversation

### 📊 API Quota Monitoring
- View usage for all providers
- See visual quota bars
- Track reset times
- Get alerts when limits near

---

## 🚀 Getting Started

### First Time Setup
```bash
npm install
npm run dev:all
```

### Add API Keys
1. Click ⚙️ (Settings) in sidebar
2. Enter your API keys
3. Save and refresh

### Start First Conversation
1. Click "Multi-Agent Conversation" button
2. Select 2+ agents
3. Enter conversation topic
4. Click "Start Conversation"

---

## 💡 Tips & Tricks

### Export for Sharing
```
1. Click "Export" dropdown
2. Choose format:
   - JSON: For data analysis
   - CSV: For spreadsheets
   - PDF: For reports
   - Markdown: For documentation
```

### Organize Conversations
```
1. Save conversation
2. Add relevant tags (e.g., "ai", "discussion")
3. Use search to find by tags later
```

### Track Agent Performance
```
1. Open Metrics Dashboard (📊 icon)
2. View API usage per provider
3. Monitor quota consumption
4. Check reset times
```

### Create Workflow Templates
```
1. Set up agents you use frequently
2. Save as template
3. Load template for quick setup
4. Saves time on repetitive setups
```

---

## 🎨 Customization

### Dark Mode
- Auto-detects system preference
- Manual toggle saves preference
- Applies instantly

### Message Display
- Copy messages instantly
- Play text-to-speech
- React with emotions
- Timestamps show automatically

### Export Options
- Include metadata
- Auto-generated filenames
- Multiple format support
- Full conversation history

---

## 📱 Browser Support

Works best on:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

All data stored locally - no cloud sync by default.

---

## ⚠️ Important Notes

1. **Local Storage Only**
   - Conversations saved in browser's IndexedDB
   - No automatic cloud backup
   - Export conversations regularly

2. **API Keys**
   - Stored in settings, not synced
   - Keep them secret
   - Never share your saved conversations

3. **Data Limits**
   - Browser storage ~50MB per domain
   - Archive old conversations if needed
   - Clear metrics occasionally

---

## 🆘 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Dark mode not saving | Clear localStorage, try again |
| Export button greyed out | Start conversation first |
| Agents not responding | Check API keys in settings |
| Search not working | Ensure conversations are saved |
| Templates empty | Create and save one first |

---

## 📧 Getting Help

1. Check FEATURES.md for detailed docs
2. See INSTALLATION.md for setup help
3. Review browser console for errors
4. Check IndexedDB in Chrome DevTools

---

**Quick Tip:** Pin this guide for quick reference while using the app!

**Version:** 2.0.0  
**Last Updated:** February 2026
