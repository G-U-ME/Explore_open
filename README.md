# Explore - AI Hierarchical Conversation Tool

## 🌟 Overview

Explore is a dynamic, card-based knowledge exploration tool that revolutionizes AI conversations. By transforming ideas and thoughts into an interactive, hierarchical stack of cards, Explore breaks free from the linear constraints of traditional chat interfaces, enabling truly creative and structured knowledge exploration.

### The Problem with Traditional AI Chat

Traditional AI dialogs are confined to linear, command-line style interfaces reminiscent of teleprinter technology. Users face significant challenges when dealing with:

- **Complex AI responses** containing unfamiliar terms that require individual lookups
- **Multiple solution paths** that need to be explored in parallel
- **Non-linear thought processes** that demand flexible exploration
- **Memory limitations** when trying to build upon previous discussions

### The Hierarchical Solution

Explore introduces a groundbreaking non-linear, tree-based conversation structure that mirrors how humans naturally think and explore:

- **Card-based Exploration**: Each conversation branch becomes an individual card
- **Visual Space Navigation**: See your entire knowledge tree at a glance
- **Contextual Continuity**: Each card maintains full conversation history
- **Flexible Organization**: Group explorations into distinct projects

## ✨ Key Features

### 🎯 Core Functionality
- **Hierarchical Card Stack**: Navigate through conversations as a 3D stack of cards with parent-child relationships
- **Real-time AI Streaming**: Watch responses build in real-time with thinking time indicators
- **Term-Extraction System**: @@marked terms@@ become clickable explanations
- **Preview Cards**: Instant pop-up explanations without disrupting flow
- **Project Organization**: Manage multiple distinct exploration threads

### 🔧 Technical Features
- **Guest-Free Usage**: No login required, works offline
- **Model Flexibility**: Supports any OpenAI-compatible API endpoint
- **Rich Media Support**: Text, images, and document attachments
- **Web Search Integration**: Enable real-time information retrieval
- **Customizable Prompts**: System prompts for different interaction styles

### 🎨 User Experience
- **Responsive Design**: Optimized for desktop and mobile devices
- **Touch Gestures**: Native mobile interaction support
- **Animation System**: Smooth transitions between conversation states
- **Visual Feedback**: Live thinking indicators and progress tracking

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v16 or later)
- **npm**, **yarn**, or **pnpm**
- **AI API Access** (OpenAI-compatible endpoint recommended)

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/G-U-ME/Explore_open.git
   cd Explore_open
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start the Application**
   ```bash
   npm run dev
   ```
4. **Begin exploring!**

## 📖 Usage Guide

### 🔄 Basic Conversation Flow

1. **Create Project**: Use the left panel to create a new project workspace
2. **Start Dialog**: Send your first message to AI
3. **Explore Depth**: Click terms marked @@like this@@ to see instant explanations
4. **Branch Topics**: Select text and create new cards for deeper exploration
5. **Navigate Tree**: Use the right panel to visualize and jump between conversation branches

### 🎯 Advanced Features

#### Term Exploration
- AI automatically marks unfamiliar terms with @@special formatting@@
- Click any marked term for an instant preview explanation
- Drag preview explanations into new conversation cards

#### Card Management
- **Create New Card**: Click the "+" button on any card
- **From Selection**: Highlight text and create focused sub-conversations
- **Navigate Stack**: Click parent cards in the background to switch context

#### Project Organization
- Multiple project support for different topics
- Drag to reorder projects
- Independent conversation trees per project

## 🛠️ Technical Architecture

### Frontend Stack
```
- React 18 + TypeScript - Modern web framework
- Vite - Fast build tool and dev server
- Zustand - Lightweight state management
- Tailwind CSS - Utility-first styling
- Three.js + React Three Fiber - 3D card animations
- DND-kit - Drag & drop functionality
- React Markdown + KaTeX - Rich text rendering
```

### Key Components

#### CardStack.tsx - Main Conversational Interface
- 3D card visualization with physics-based positioning
- Touch gesture support for mobile devices
- Real-time content streaming and updates
- Animation system for smooth state transitions

#### Stores (State Management)
- **projectStore.ts**: Project and card hierarchy management
- **cardStore.ts**: Individual card conversations and AI interactions
- **settingsStore.ts**: User preferences and API configuration

#### InputArea.tsx - Message Input System
- Rich text input with file attachment support
- Model selection and web search toggles
- Streaming response handling with typing indicators

#### TreeNavigation.tsx - Visual Tree Explorer
- Hierarchical conversation tree visualization
- Quick navigation between any conversation branch
- Progress tracking and overview

## 🔌 API Configuration

### Supported Endpoints
Explore works with any OpenAI-compatible API endpoint:

```javascript
// Example configuration
{
  "apiUrl": "https://api.deepseek.com/v1/chat/completions",
  "apiKey": "sk-your-api-key-here",
  "models": ["deepseek-reasoner", "deepseek-chat"],
  "activeModel": "deepseek-reasoner"
}
```

### Default Models
- **DeepSeek-V3-0324**: Advanced reasoning with thinking traces
- **Custom Models**: Add any OpenAI-compatible model

### Advanced Settings

#### Web Search
- Enable/disable real-time information retrieval
- Configurable search providers
- Background context integration

## 📊 Data Model

### Conversation Flow
1. **Root Card**: Initial conversation entry
2. **Child Cards**: Branched explorations from parent contexts
3. **Hierarchy Depth**: Unlimited nesting levels
4. **Context Preservation**: Each card maintains full conversation history

## 🌐 Browser Compatibility

- **Chrome/Edge**: Full feature support
- **Firefox**: Full feature support
- **Safari**: Full feature support
- **Mobile Browsers**: Touch-optimized experience

## 🔧 Development

### Project Structure
```
/src
├── components/     # UI Components
│   ├── CardStack.tsx
│   ├── InputArea.tsx
│   ├── ProjectPanel.tsx
│   └── TreeNavigation.tsx
├── stores/         # State Management
│   ├── cardStore.ts
│   ├── projectStore.ts
│   └── settingsStore.ts
├── hooks/          # Custom Hooks
├── App.tsx         # Main Application
└── main.tsx        # React Entry Point
```

## 🙏 Acknowledgments

- Built with modern web technologies
- Inspired by the need for better knowledge exploration tools
- Designed for researchers, educators, and curious minds

---

**Experience the future of conversations - break free from linear thinking with Explore!**
