const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const fetch = require('node-fetch');
const app = express();
const server = http.createServer(app);
const axios = require('axios');
const roomCanvasStates = new Map();
// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const roomId = req.body.roomId || req.query.roomId;
    if (!roomId) {
      return cb(new Error('Room ID is required'), null);
    }
    
    const roomPath = path.join(__dirname, 'uploads', roomId);
    
    if (!fs.existsSync(roomPath)) {
      fs.mkdirSync(roomPath, { recursive: true });
    }
    cb(null, roomPath);
  },
  filename: (req, file, cb) => {
    const sanitizedName = file.originalname.replace(/[^a-z0-9\.]/gi, '_').toLowerCase();
    cb(null, Date.now() + '-' + sanitizedName);
  }
});


// Initialize multer upload middleware
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.post('/run-code', async (req, res) => {
    const { code, language, stdin = '' } = req.body;

    // Validate input
    if (!code || !language) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        // Set response headers for better performance
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        
        // Execute with timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Execution timed out')), 10000);
        });

        const executionPromise = axios.post('https://emkc.org/api/v2/piston/execute', {
            language,
            version: "*",  // optional but recommended
            stdin,
            files: [{ name: "main", content: code }]
        });

        // Race between execution and timeout
        const result = await Promise.race([executionPromise, timeoutPromise]);
        
        // Send response immediately
        res.json(result.data);
    } catch (err) {
        // Handle specific error types
        if (err.message === 'Execution timed out') {
            res.status(408).json({ error: 'Code execution timed out' });
        } else if (err.response?.data) {
            res.status(err.response.status || 500).json(err.response.data);
        } else {
            res.status(500).json({ error: 'Execution failed: ' + (err.message || 'Unknown error') });
        }
    }
});

// File upload endpoint
app.post('/upload-file', upload.single('file'), async (req, res) => {
  try {
    const roomId = req.body.roomId || req.query.roomId;
    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    const room = rooms.get(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Initialize files object if it doesn't exist
    if (!room.files) {
      room.files = {};
    }
    
    // Read the uploaded file's content
    const filePath = path.join(__dirname, 'uploads', roomId, req.file.filename);
    let fileContent;
    
    try {
      // Try to read as text first
      fileContent = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      // If it fails to read as text, treat as binary
      fileContent = '[Binary file content]';
    }

    const fileId = 'file-' + Date.now();
    
    room.files[fileId] = {
      id: fileId,
      name: req.file.originalname,
      content: fileContent,
      path: path.join(roomId, req.file.filename),
      isUploadedFile: true,
      isBinary: fileContent === '[Binary file content]'
    };
    
    io.to(roomId).emit('file-created', {
      fileId,
      fileName: req.file.originalname,
      content: fileContent,
      isUploadedFile: true,
      isBinary: fileContent === '[Binary file content]',
      path: path.join(roomId, req.file.filename),
      roomId
    });
    
    res.json({ 
      success: true, 
      fileId, 
      fileName: req.file.originalname,
      content: fileContent,
      isBinary: fileContent === '[Binary file content]'
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// File download endpoint
app.get('/download-file/:roomId/:fileId', (req, res) => {
  try {
      const room = rooms.get(req.params.roomId);
      if (!room) return res.status(404).send('Room not found');
      
      const file = room.files[req.params.fileId];
      if (!file) return res.status(404).send('File not found');
      
      res.setHeader('Content-disposition', `attachment; filename=${file.name}`);
      res.setHeader('Content-type', 'text/plain');
      res.send(file.content);
  } catch (err) {
      res.status(500).send(err.message);
  }
});

// File delete endpoint
app.delete('/delete-file/:roomId/:filename', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'uploads', req.params.roomId, req.params.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/create-room", (req, res) => {
    const { password, userName } = req.body;
  
    if (!password || !userName) {
      return res.status(400).json({ error: "Password and username are required!" });
    }
  
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let roomId;
    do {
      roomId = '';
      for (let i = 0; i < 10; i++) {
        roomId += characters.charAt(Math.floor(Math.random() * characters.length));
      }
    } while (rooms.has(roomId));
  
    rooms.set(roomId, { password, users: [], code: "" });
  
    res.json({ roomId: roomId });
  });
  

io.on("connection", (socket) => {
    console.log("A new user connected");

    socket.on('join-room', (roomId, userName) => {
        try {
            socket.join(roomId);
            console.log(`User ${userName} joined room: ${roomId}`);
    
            const isNewRoom = !rooms.has(roomId);
            
            // Initialize room if it doesn't exist
            if (isNewRoom) {
                rooms.set(roomId, {
                    password: '',
                    users: [],
                    files: {},
                    code: ""
                });
                console.log(`New room created: ${roomId}`);
            }
    
            const room = rooms.get(roomId);
            
            // Initialize files object if it doesn't exist
            if (!room.files) {
                room.files = {};
            }

            const state = roomCanvasStates.get(roomId) || { strokes: [] };
            socket.emit('load-strokes', state.strokes);

            // Add default file ONLY if this is a brand new room
            if (isNewRoom && Object.keys(room.files).length === 0) {
                const defaultFileId = 'file-' + Date.now();
                room.files[defaultFileId] = {
                    id: defaultFileId,
                    name: 'main.js',
                    content: ''
                };
                console.log(`Created default file for new room ${roomId}`);
            }
    
            // Add user to room if not already present
            const userExists = room.users.some(u => u.id === socket.id);
            if (!userExists) {
                room.users.push({ id: socket.id, name: userName });
            }
    
            // Send complete room state to the joining user
            socket.emit('room-state', {
                files: room.files,
                users: room.users.map(u => ({ id: u.id, name: u.name }))
            });
    
            // Notify others about new user (except the joining user)
            if (!userExists) {
                socket.to(roomId).emit('message', `${userName} joined the room`);
                socket.to(roomId).emit('user-joined', { 
                    userId: socket.id, 
                    userName 
                });
                
                // Update user list for everyone except the joining user
                socket.to(roomId).emit('user-list', room.users.map(u => ({ 
                    id: u.id, 
                    name: u.name 
                })));
            }
    
        } catch (error) {
            console.error('Error in join-room:', error);
            socket.emit('error', 'Failed to join room');
        }
    });


    socket.on('drawing', (data) => {
        try {
        if (!roomCanvasStates.has(data.roomId)) {
                roomCanvasStates.set(data.roomId, {
                    strokes: []
                });
        }

            // Store the stroke with tool information
            roomCanvasStates.get(data.roomId).strokes.push({
                startX: data.startX,
                startY: data.startY,
                endX: data.endX,
                endY: data.endY,
                color: data.color,
                size: data.size,
                tool: data.tool
            });
            
        socket.to(data.roomId).emit('drawing', data);
        } catch (error) {
            console.error('Error handling drawing event:', error);
        }
    });
    
 
    socket.on('clear-canvas', (data) => {
        try {
            // Clear the stored strokes
            if (roomCanvasStates.has(data.roomId)) {
                roomCanvasStates.delete(data.roomId);
            }
            
            // Broadcast to other users
            socket.to(data.roomId).emit('clear-canvas', data);
        } catch (error) {
            console.error('Error handling clear-canvas event:', error);
        }
    });

    socket.on('request-canvas-state', (roomId) => {
        try {
        if (roomCanvasStates.has(roomId)) {
                socket.emit('canvas-state', {
                    roomId,
                    strokes: roomCanvasStates.get(roomId).strokes
                });
            }
        } catch (error) {
            console.error('Error handling canvas state request:', error);
        }
    });

    

    socket.on('file-created', (data) => {
        try {
            const room = rooms.get(data.roomId);
            if (!room) {
                console.log(`Room ${data.roomId} not found`);
                return;
            }

            // Ensure files object exists
            if (!room.files) {
                room.files = {};
            }

            if (!room.files[data.fileId]) {
                room.files[data.fileId] = {
                    id: data.fileId,
                    name: data.fileName,
                    content: ''
                };
                socket.to(data.roomId).emit('file-created', {
                    fileId: data.fileId,
                    fileName: data.fileName
                });
                console.log(`Created new file ${data.fileName} in room ${data.roomId}`);
            }
        } catch (error) {
            console.error('Error in file-created:', error);
        }
    });

    socket.on('file-update', (data) => {
        try {
            const room = rooms.get(data.roomId);
            if (room && room.files && room.files[data.fileId]) {
                room.files[data.fileId].content = data.content;
                socket.to(data.roomId).emit('file-updated', {
                    roomId: data.roomId,
                    fileId: data.fileId,
                    content: data.content
                });
            }
        } catch (error) {
            console.error('Error in file-update:', error);
        }
    });

    // Handle cursor position updates
    socket.on('cursor-position', (data) => {
        try {
            const room = rooms.get(data.roomId);
            if (room) {
                // Find the user in the room's users array
                const user = room.users.find(u => u.id === socket.id);
                if (user) {
                    socket.to(data.roomId).emit('cursor-position-update', {
                        userId: socket.id,
                        fileId: data.fileId,
                        position: data.position,
                        userName: user.name
                    });
                }
            }
        } catch (error) {
            console.error('Error in cursor-position:', error);
        }
    });

    // Add this in your server's socket.io handlers
socket.on('file-deleted', (data) => {
    try {
        const room = rooms.get(data.roomId);
        if (room && room.files && room.files[data.fileId]) {
            // Remove the file from server's room state
            delete room.files[data.fileId];
            
            // Broadcast to all other clients in the room
            socket.to(data.roomId).emit('file-closed', {
                roomId: data.roomId,  // Include roomId
                fileId: data.fileId
            });
        }
    } catch (error) {
        console.error('Error in file-deleted:', error);
    }
});
socket.on('disconnect', () => {
    console.log('User disconnected');

    for (const [roomId, room] of rooms) {
        const userIndex = room.users.findIndex(u => u.id === socket.id);
        if (userIndex !== -1) {
            const userName = room.users[userIndex].name;
            room.users.splice(userIndex, 1);

            io.to(roomId).emit('message', `${userName} left the room`);
            io.to(roomId).emit('user-left', { userId: socket.id, userName });
            io.to(roomId).emit('user-list', room.users.map(u => ({ id: u.id, name: u.name })));

            // ✅ If no users left in the room, delete it
            if (room.users.length === 0) {
                rooms.delete(roomId);
                console.log(`Room ${roomId} deleted because it's empty.`);
            }

            break; // Stop searching rooms
        }
    }
});


    socket.on('chat-message', ({ roomId, message, sender }) => {
        io.to(roomId).emit('chat-message', { message, sender });
    });
      

});
app.use(express.static(__dirname));

app.post("/join-room", (req, res) => {
    const { roomId, password, userName } = req.body;
    
    if (!roomId || !password || !userName) {
        return res.status(400).json({ error: "Room ID, password and username are required!" });
    }

    // Check if room exists
    if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        // Verify password
        if (room.password !== password) {
            return res.status(401).json({ error: "Incorrect password!" });
        }
        // Room exists and password is correct
        return res.status(200).json({ success: true });
    }
    
    // Room doesn't exist
    return res.status(404).json({ error: "Room not found" });
});

app.post("/create-room", (req, res) => {
    const { roomId, password, userName } = req.body;
    
    if (!roomId || !password || !userName) {
        return res.status(400).json({ error: "Room ID, password and username are required!" });
    }

    // Check if room already exists
    if (rooms.has(roomId)) {
        return res.status(409).json({ error: "Room already exists!" });
    }
    
    // Create new room
    rooms.set(roomId, {
        password,
        users: [],
        files: {},
        code: ""
    });
    
    res.status(200).json({ success: true });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the application at http://localhost:${PORT}`);
  console.log(`For network access, use your computer's IP address: http://<your-ip>:${PORT}`);
});