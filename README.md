# Codab - Collaborate Code, Seamlessly

![Project Banner](https://img.shields.io/badge/version-1.0.0-blue) ![Node.js](https://img.shields.io/badge/node.js-18%2B-green) ![License](https://img.shields.io/badge/license-ISC-blue)

**Codab** is a real-time collaborative coding platform designed to enable seamless code collaboration with integrated chat and drawing capabilities. Multiple developers can write, compile, and discuss code together across 20+ programming languages—all in real-time.

---

## 🎯 Key Features

### 💻 Real-Time Collaborative Editing
- **Live Code Synchronization**: Write code simultaneously with multiple users with minimal latency and conflict resolution
- **Operational Transformation (OT)**: Ensures consistency when multiple users edit concurrently
- **Syntax-Aware Editor**: Supports 20+ programming languages with proper syntax highlighting
- **Cursor Position Tracking**: See where other collaborators are typing in real-time

### 🚀 Code Execution
- **In-Browser Compilation & Execution**: Run code without leaving the platform
- **Multi-Language Support**: Execute code in 20+ languages (Python, JavaScript, Java, C++, Go, Rust, etc.)
- **Piston API Integration**: Reliable, sandboxed code execution backend
- **Quick Feedback**: Get instant results with low-latency execution

### 🎨 Collaborative Drawing Board
- **Shared Canvas**: Draw, sketch, and visualize ideas together in real-time
- **Multiple Drawing Tools**: Use pen, eraser, and other drawing utilities
- **Color Selection**: Choose from a palette of colors for drawings
- **Persistent State**: Drawings are maintained and visible to all room members

### 💬 Built-In Chat System
- **Room-Based Communication**: Chat with all collaborators in your coding session
- **Message History**: Every message is tracked within the room
- **Real-Time Notifications**: Receive instant notifications of new messages

### 📁 File Management
- **Create New Files**: Generate new code files directly in the editor
- **Upload Files**: Import existing files from your system (up to 10MB)
- **Download Files**: Export your work as needed
- **File Organization**: Keep track of all files in the file explorer sidebar

### 👥 User Presence & Awareness
- **Live User List**: See who's online and actively collaborating
- **User Status Updates**: Get notified when users join or leave
- **Identification**: All actions are attributed to specific users

---

## 🏗️ Architecture

### Backend Stack
- **Framework**: Express.js (Node.js)
- **Real-Time Communication**: 
  - Socket.io (WebSocket wrapper)
  - Native WebSockets (ws library)
- **Real-Time Data Sync**: ShareDB with Operational Transformation
- **Code Execution**: Piston API
- **File Handling**: Multer (file upload middleware)
- **HTTP Client**: Axios

### Frontend Stack
- **Language**: Vanilla JavaScript
- **Real-Time Client**: Socket.io client library
- **WebSocket Support**: Reconnecting-WebSocket for resilience
- **Styling**: Custom CSS with Space Mono font
- **UI Icons**: Font Awesome

### Key Libraries
```json
{
  "production": {
    "express": "API framework",
    "socket.io": "Real-time bidirectional communication",
    "sharedb": "Real-time database with OT",
    "ws": "WebSocket implementation",
    "multer": "File upload handling",
    "cors": "Cross-origin resource sharing",
    "axios": "HTTP client for Piston API",
    "ot-text": "Text operation transformation"
  },
  "development": {
    "webpack": "Module bundler",
    "webpack-cli": "Webpack CLI"
  }
}
```

---

## 📋 Project Structure

```
Codab/
├── Server.js              # Main Express server with Socket.io setup
├── Script.js              # Landing page functionality (room creation/joining)
├── room.js                # Collaborative editor room logic
├── index.html             # Landing/login page
├── room.html              # Main collaborative editor interface
├── Style.css              # Landing page styles
├── room.css               # Editor interface styles
├── package.json           # Project dependencies
└── public/                # Static assets (auto-created)
    └── uploads/           # User file uploads (per-room)
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher)
- **Internet connection** (for Piston API access)

### Installation

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd Codab
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start the Server**
   ```bash
   npm start
   ```
   Or manually:
   ```bash
   node Server.js
   ```

4. **Access the Application**
   - Open your browser and navigate to: `http://localhost:3000`
   - You should see the Codab landing page

---

## 💡 How to Use

### Creating a New Room

1. **Enter Username**: Provide a unique username for collaboration
2. **Set Password**: Create a password to protect your coding room
3. **Generate Room ID**: Click "Generate Unique Room Id" to create a unique room identifier
4. **Join**: Click the "Create/Join" button to enter the collaborative editor

### Joining an Existing Room

1. **Enter Room ID**: Ask collaborators for the room ID
2. **Enter Username**: Provide your username
3. **Enter Password**: Use the room's password
4. **Submit**: Click "Create/Join" to enter

### In the Editor

#### Coding
- Create new files via the "New" button
- Upload existing files using the "Upload" button
- Select files from the file explorer to edit
- Code changes sync in real-time to all users

#### Drawing
- Click the "Draw" button to open the collaborative drawing board
- Select colors and drawing tools
- Drawings appear in real-time for all users

#### Chatting
- Click the "Chat" button to open the messaging panel
- Type messages to communicate with other collaborators
- Messages are broadcast to all room members instantly

#### Running Code
- Select a programming language
- Click "Run Code" to execute
- View results in the execution panel
- Supports input/output for interactive programs

#### Sharing
- Click "Copy ID" to copy the room ID to clipboard
- Share this ID with collaborators to invite them

---

## 🛡️ Security Features

- **Room Password Protection**: Each room is protected by a password
- **User Authentication**: Users are authenticated before joining rooms
- **XSS Prevention**: Filenames are sanitized to prevent malicious uploads
- **File Size Limits**: 10MB maximum file size for uploads
- **CORS Configuration**: Cross-origin requests are properly configured

---

## ⚙️ Configuration

### Server Configuration
- **Port**: Default `3000` (can be modified in Server.js)
- **CORS**: Enabled for all origins
- **Static Files**: Served from current directory
- **Uploads**: Default directory is `./uploads/`

### Code Execution
- **Timeout**: 10 seconds per execution
- **API**: Piston API (emkc.org)
- **Supported Languages**: 20+ languages (Python, JavaScript, Java, C++, Go, Rust, etc.)

### File Upload
- **Max Size**: 10MB
- **Storage**: Room-specific directories
- **Allowed Files**: All file types (with automatic binary detection)

---

## 🤝 Collaboration Workflow

1. **Initialize**: Create a room with a unique ID and password
2. **Invite**: Share room ID and password with team members
3. **Connect**: All users join the same collaborative session
4. **Code Together**: Write, edit, and discuss code in real-time
5. **Execute**: Test code implementations instantly
6. **Visualize**: Use the drawing board for architectural discussions
7. **Communicate**: Chat with team members without leaving the editor

---

**Happy Coding! 🚀 From Idea to Execution, Code Together, Seamlessly.**
