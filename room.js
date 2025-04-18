// Get the server URL dynamically
const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:3000' 
  : `http://${window.location.hostname}:3000`;

const socket = io(serverUrl);

// DOM elements
const roomDetails = document.getElementById('roomDetails');
const messages = document.getElementById('messages');
const usersList = document.getElementById('usersList');
const userCount = document.getElementById('user-count');
const fileList = document.getElementById('file-list');
const editorTabs = document.getElementById('editor-tabs');
const editorContainer = document.getElementById('editor-container');
const newFileBtn = document.getElementById('new-file-btn');
const fileUpload = document.getElementById('file-upload');
const uploadBtn = document.getElementById('upload-btn');
const uploadStatus = document.getElementById('upload-status');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const drawboardBtn = document.getElementById('drawboard-btn');
const drawboardModal = document.getElementById('drawboard-modal');
const closeModalBtn = document.querySelector('.close-modal');
const drawingCanvas = document.getElementById('drawing-canvas');
const colorPicker = document.querySelectorAll('.color');
const penTypes = document.querySelectorAll('.pen-type');
const clearCanvasBtn = document.getElementById('clear-canvas');
const runCodeBtn = document.getElementById('execute-btn');
const executionResult = document.getElementById('execution-result');
const openChatBtn = document.getElementById('open-chat-btn');
const backFromChatBtn = document.getElementById('back-from-chat');
const sidebarContent = document.getElementById('sidebar-content');
const chatContainer = document.getElementById('chat-container');
const chatMessages = document.getElementById('chat-messages');
const sendBtn = document.getElementById('send-message-btn');

// Drawing state variables
let isDrawing = false;
let currentColor = 'black';
let currentPenSize = 2;
let lastX = 0;
let lastY = 0;
let currentTool = 'pen';

// Get room ID and username from URL
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');
const userName = urlParams.get('userName');

// Application state
let files = {};
let activeFileId = null;
let currentUsers = new Map();
let activeMessage = null;

// Add these variables at the top with other state variables
let unreadMessages = 0;
let isChatOpen = false;

// Add this near the top with other global variables
const userCursors = new Map();
const typingTimeouts = new Map();

// Initialize the room

if (roomId && userName) {
    socket.emit('join-room', roomId, userName);
    roomDetails.textContent = `Room ID: ${roomId}`;
}

if (roomId && userName) {
    socket.emit('join-room', roomId, userName);
    // Show the Room ID on the button itself (optional)

    // Add click listener to copy roomId when clicked
    roomDetails.addEventListener('click', () => {
        // Create a temporary input to copy text
        const tempInput = document.createElement('input');
        tempInput.value = roomId;
        document.body.appendChild(tempInput);
        tempInput.select();
        tempInput.setSelectionRange(0, 99999); // For mobile devices
        const success = document.execCommand('copy');
        document.body.removeChild(tempInput);

        if (success) {
            alert("Room ID copied!");
        } else {
            alert("Failed to copy Room ID.");
        }
    });
}

// Event listeners
newFileBtn.addEventListener('click', createNewFileHandler);
uploadBtn.addEventListener('click', () => fileUpload.click());
fileUpload.addEventListener('change', handleFileUpload);

document.querySelectorAll('.io-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs and panels
        document.querySelectorAll('.io-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.io-panel').forEach(p => p.classList.remove('active'));

        // Add active class to clicked tab and its corresponding panel
        tab.classList.add('active');
        const targetPanel = document.getElementById(tab.dataset.target);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }
    });
});

runCodeBtn.addEventListener('click', async () => {
    if (!activeFileId) {
        executionResult.textContent = 'No active file to run.';
        return;
    }

    const code = files[activeFileId].content;
    const fileName = files[activeFileId].name;
    const lang = detectLanguageFromFile(fileName);
    const stdin = document.getElementById('custom-input')?.value || '';

    // Show immediate feedback
    executionResult.innerHTML = '<div class="loading-spinner"></div> Running code...';
    
    try {
        // Use AbortController to handle timeouts
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const res = await fetch('/run-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ 
                code, 
                language: lang, 
                stdin,
                timestamp: Date.now() // Add timestamp to prevent caching
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const result = await res.json();
        
        // Format and display the output
        let output = '';
        if (result.run?.stdout) {
            output = result.run.stdout;
        } else if (result.run?.stderr) {
            output = `Error: ${result.run.stderr}`;
        } else if (result.error) {
            output = `Error: ${result.error}`;
        } else {
            output = 'No output';
        }

        // Use a more efficient way to update the DOM
        const pre = document.createElement('pre');
        pre.textContent = output;
        executionResult.innerHTML = '';
        executionResult.appendChild(pre);

    } catch (err) {
        if (err.name === 'AbortError') {
            executionResult.textContent = 'Error: Code execution timed out after 10 seconds';
        } else {
            executionResult.textContent = 'Error: ' + (err.message || 'Failed to execute code');
        }
    }
});

function detectLanguageFromFile(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const languageMap = {
        'py': 'python3',
        'js': 'javascript',
        'java': 'java',
        'cpp': 'cpp',
        'cc': 'cpp',
        'c': 'c',
        'cs': 'csharp',
        'go': 'go',
        'rb': 'ruby',
        'php': 'php',
        'rs': 'rust',
        'ts': 'typescript',
        'kt': 'kotlin',
        'scala': 'scala',
        'swift': 'swift'
    };
    return languageMap[ext] || 'python3';
}

// File upload handler
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Basic client-side validation
    const allowedTypes = [
        'text/plain', 
        'application/javascript', 
        'text/html', 
        'text/css',
        'application/json',
        'text/markdown',
        'text/x-python',
        'text/x-java',
        'text/x-c',
        'text/x-c++',
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/octet-stream'
    ];
    
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(js|html|css|json|md|py|java|c|cpp|h|hpp)$/)) {
        showUploadStatus(`Error: ${file.type} files are not allowed. Only text, code, PDF, and image files are supported.`, 'error');
        fileUpload.value = '';
        return;
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        showUploadStatus('Error: File size exceeds 10MB limit', 'error');
        fileUpload.value = '';
        return;
    }

    showUploadStatus(`Uploading ${file.name}...`, 'loading');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', roomId);
    
    try {
        const response = await fetch(`/upload-file?roomId=${roomId}`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Upload failed');
        }
        
        if (data.success) {
            showUploadStatus(`Successfully uploaded ${file.name}`, 'success');
            
            // The file will be added through the socket.io 'file-created' event
            // but we can also add it here for immediate feedback
            if (!files[data.fileId]) {
                files[data.fileId] = {
                    id: data.fileId,
                    name: data.fileName,
                    content: data.content,
                    isBinary: data.isBinary,
                    isUploadedFile: true
                };
                createFileUI(data.fileId, data.fileName, data.content, true);
                switchToFile(data.fileId);
            }
        } else {
            showUploadStatus(`Upload failed: ${data.error || 'Unknown error'}`, 'error');
        }
    } catch (err) {
        console.error('Upload error:', err);
        showUploadStatus(`Upload failed: ${err.message}`, 'error');
    } finally {
        fileUpload.value = '';
    }
}

// Initialize drawing board
function initDrawingBoard() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    drawingCanvas.addEventListener('mousedown', startDrawing);
    drawingCanvas.addEventListener('mousemove', draw);
    drawingCanvas.addEventListener('mouseup', endDrawing);
    drawingCanvas.addEventListener('mouseout', endDrawing);

    colorPicker.forEach(color => {
        color.addEventListener('click', () => {
            currentColor = color.dataset.color;
            document.querySelector('.color.selected').classList.remove('selected');
            color.classList.add('selected');
        });
    });
    penTypes.forEach(pen => {
        pen.addEventListener('click', () => {
            currentPenSize = parseInt(pen.dataset.size);
            document.querySelector('.pen-type.selected').classList.remove('selected');
            pen.classList.add('selected');
        });
    });

    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentTool = btn.dataset.tool;
            document.querySelector('.tool-btn.selected').classList.remove('selected');
            btn.classList.add('selected');
            
            // Update canvas cursor
            if (currentTool === 'eraser') {
                drawingCanvas.classList.add('eraser-mode');
            } else {
                drawingCanvas.classList.remove('eraser-mode');
            }
        });
    });

    // Color and pen size
    document.getElementById('clear-canvas').addEventListener('click', clearCanvas);
    drawboardBtn.addEventListener('click', openDrawingBoard);
    closeModalBtn.addEventListener('click', closeDrawingBoard);
}

// Chat button event listeners
openChatBtn.addEventListener('click', () => {
    isChatOpen = true;
    unreadMessages = 0;
    document.querySelector('.notification-dot').classList.remove('active');
    chatContainer.classList.add('active');
    sidebarContent.style.display = 'none';
    // Scroll to bottom of chat when opened
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});

backFromChatBtn.addEventListener('click', () => {
    isChatOpen = false;
    chatContainer.classList.remove('active');
    sidebarContent.style.display = 'flex';
});

// Chat message handling
function sendMessage() {
    const message = messageInput.value.trim();
    if (message && roomId && userName) {
        socket.emit('chat-message', {
            roomId: roomId,
            message: message,
            sender: userName
        });
        messageInput.value = '';
        // Focus back on input after sending
        messageInput.focus();
    }
}

// Send message event listeners
sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Socket event listener for chat messages
socket.on('chat-message', (data) => {
    if (!chatMessages) return;

    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';

    const senderSpan = document.createElement('span');
    senderSpan.className = 'sender';
    senderSpan.textContent = `${data.sender}: `;

    const messageSpan = document.createElement('span');
    messageSpan.className = 'message-text';
    messageSpan.textContent = data.message;

    messageElement.appendChild(senderSpan);
    messageElement.appendChild(messageSpan);
    chatMessages.appendChild(messageElement);

    // Auto scroll to bottom when new message arrives
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    if (!isChatOpen) {
        showNotification();
        showToast(`New message from ${data.sender}`, 'info');
    }
});

function resizeCanvas() {
    const canvas = document.getElementById('drawing-canvas');
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

function startDrawing(e) {
    isDrawing = true;
    const pos = getCanvasPosition(e);
    [lastX, lastY] = [pos.x, pos.y];
}
function draw(e) {
    if (!isDrawing) return;
    
    const ctx = drawingCanvas.getContext('2d');
    const pos = getCanvasPosition(e);
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    
    if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentColor;
    }
    
    ctx.lineWidth = currentPenSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    // Send drawing data to server
    socket.emit('drawing', {
        roomId: roomId,
        startX: lastX,
        startY: lastY,
        endX: pos.x,
        endY: pos.y,
        color: currentTool === 'eraser' ? 'eraser' : currentColor,
        size: currentPenSize,
        tool: currentTool
    });
    
    [lastX, lastY] = [pos.x, pos.y];
}

function endDrawing() {
    isDrawing = false;
}

function getCanvasPosition(e) {
    const rect = drawingCanvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function clearCanvas() {
    const ctx = drawingCanvas.getContext('2d');
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    socket.emit('clear-canvas', { roomId: roomId });
}

function openDrawingBoard() {
    drawboardModal.style.display = 'block';
    initDrawingBoard();
    resizeCanvas(); // Make sure the canvas fits container

    // Ask server to send current canvas state
    socket.emit('request-canvas-state', roomId);
}

function closeDrawingBoard() {
    drawboardModal.style.display = 'none';
}

function showUploadStatus(message, type = 'info') {
    uploadStatus.textContent = message;
    uploadStatus.className = 'status-message';
    
    if (type === 'loading') {
        uploadStatus.innerHTML = `<span class="loading-spinner"></span> ${message}`;
    } else if (type === 'success') {
        uploadStatus.classList.add('success-message');
    } else if (type === 'error') {
        uploadStatus.classList.add('error-message');
    }
    
    if (type !== 'loading') {
        setTimeout(() => {
            uploadStatus.textContent = '';
            uploadStatus.className = 'status-message';
        }, type === 'error' ? 5000 : 3000);
    }
}

// File management functions
function createNewFileHandler() {
    const fileName = prompt("Enter file name (with extension):");
    if (fileName) {
        createNewFile(fileName);
    }
}

function createNewFile(fileName) {
    const fileId = 'file-' + Date.now();
    
    files[fileId] = {
        id: fileId,
        name: fileName,
        content: '',
        isUploadedFile: false
    };
    
    createFileUI(fileId, fileName);
    switchToFile(fileId);
    
    socket.emit('file-created', {
        roomId: roomId,
        fileId: fileId,
        fileName: fileName,
        isUploadedFile: false
    });
}

function createFileUI(fileId, fileName, initialContent = '', isUploadedFile = false) {
    // Create editor tab
    const tab = document.createElement('div');
    tab.className = 'editor-tab';
    tab.dataset.fileId = fileId;
    
    const tabName = document.createElement('span');
    tabName.textContent = fileName;
    tab.appendChild(tabName);
    
    // Add tab actions (download + close)
    const tabActions = document.createElement('div');
    tabActions.className = 'tab-actions';
    
    const downloadBtn = document.createElement('span');
    downloadBtn.className = 'download-btn';
    downloadBtn.textContent = '⭳';
    downloadBtn.onclick = (e) => {
        e.stopPropagation();
        downloadFile(fileId, fileName);
    };
    tabActions.appendChild(downloadBtn);
    
    const closeBtn = document.createElement('span');
    closeBtn.className = 'tab-btn';
    closeBtn.innerHTML = '×';
    closeBtn.title = 'Close this file';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeFile(fileId);
    });
    tabActions.appendChild(closeBtn);
    
    tab.appendChild(tabActions);
    tab.addEventListener('click', () => switchToFile(fileId));
    editorTabs.appendChild(tab);
    
    // Create editor container
    const editorDiv = document.createElement('div');
    editorDiv.className = 'editor-content';
    editorDiv.dataset.fileId = fileId;
    editorContainer.appendChild(editorDiv);

    // Check if file is binary
    const isBinary = files[fileId]?.isBinary || initialContent === '[Binary file content]';
    
    if (isBinary) {
        // For binary files, show a message instead of editor
        const binaryMessage = document.createElement('div');
        binaryMessage.className = 'binary-file-message';
        binaryMessage.innerHTML = `
            <p>This is a binary file and cannot be displayed in the editor.</p>
            <p>You can download it using the download button (⭳) in the tab.</p>
        `;
        editorDiv.appendChild(binaryMessage);
    } else {
        // Initialize Monaco editor for text files
        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs' }});
        require(['vs/editor/editor.main'], function() {
            const editor = monaco.editor.create(editorDiv, {
                value: initialContent || '',
                language: detectLanguageFromFile(fileName),
                theme: 'vs-dark',
                automaticLayout: true,
                lineNumbers: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
                fontFamily: "'Space Mono', monospace",
                lineHeight: 1.5,
                tabSize: 4,
                renderWhitespace: 'selection',
                wordWrap: 'on',
                padding: { top: 15, bottom: 15 },
                // Performance optimizations
                quickSuggestions: false,
                parameterHints: { enabled: false },
                suggestOnTriggerCharacters: false,
                acceptSuggestionOnEnter: 'off',
                hideCursorInOverviewRuler: true,
                overviewRulerBorder: false,
                renderLineHighlight: 'none',
                occurrencesHighlight: false,
                cursorBlinking: 'solid',
                formatOnType: false,
                formatOnPaste: false,
                selectionHighlight: false,
                matchBrackets: 'never',
                renderIndentGuides: false
            });

            // Store editor instance
            editorDiv.editor = editor;

            // Add cursor position tracking
            editor.onDidChangeCursorPosition((e) => {
                socket.emit('cursor-position', {
                    roomId: roomId,
                    fileId: fileId,
                    position: {
                        lineNumber: e.position.lineNumber,
                        column: e.position.column
                    }
                });
            });

            // Add a flag to prevent infinite loops
            let isUpdatingContent = false;
            let updateTimeout = null;

            // Handle content changes with optimized debouncing
            editor.onDidChangeModelContent((event) => {
                if (isUpdatingContent) return;
                
                const content = editor.getValue();
                files[fileId].content = content; // Update local state immediately
                
                // Clear existing timeout
                if (updateTimeout) clearTimeout(updateTimeout);
                
                // Set new timeout for network update
                updateTimeout = setTimeout(() => {
                    handleFileEdit(fileId, content);
                }, 50); // Very short delay for local typing
            });

            // Optimized update method
            editorDiv.updateContent = (content) => {
                if (editor.getValue() === content) return; // Skip if content hasn't changed
                
                isUpdatingContent = true;
                const viewState = editor.saveViewState();
                editor.setValue(content);
                if (viewState) editor.restoreViewState(viewState);
                isUpdatingContent = false;
            };

            // Move the cursor position update handler to the global scope (outside any function)
            socket.on('cursor-position-update', (data) => {
                if (!data.fileId || !data.position) return;
                
                const editorDiv = document.querySelector(`.editor-content[data-file-id="${data.fileId}"]`);
                if (!editorDiv?.editor) return;
                
                const editor = editorDiv.editor;
                
                // Create or update cursor element
                let cursorElement = userCursors.get(data.userId);
                if (!cursorElement) {
                    cursorElement = document.createElement('div');
                    cursorElement.className = 'remote-cursor';
                    cursorElement.style.position = 'absolute';
                    cursorElement.style.width = '2px';
                    cursorElement.style.height = '20px';
                    cursorElement.style.backgroundColor = getRandomColor(data.userId);
                    cursorElement.style.zIndex = '10';
                    cursorElement.style.pointerEvents = 'none';
                    cursorElement.style.opacity = '0';
                    cursorElement.style.transition = 'opacity 0.2s ease-in-out';
                    
                    // Create username label
                    const usernameLabel = document.createElement('div');
                    usernameLabel.className = 'cursor-username';
                    usernameLabel.textContent = data.userName;
                    usernameLabel.style.position = 'absolute';
                    usernameLabel.style.top = '-20px';
                    usernameLabel.style.left = '4px';
                    usernameLabel.style.backgroundColor = 'var(--bg-color)';
                    usernameLabel.style.padding = '2px 6px';
                    usernameLabel.style.borderRadius = '4px';
                    usernameLabel.style.fontSize = '12px';
                    usernameLabel.style.whiteSpace = 'nowrap';
                    usernameLabel.style.color = 'var(--text-color)';
                    usernameLabel.style.border = '1px solid var(--border-color)';
                    usernameLabel.style.opacity = '0';
                    usernameLabel.style.transition = 'opacity 0.2s ease-in-out';
                    
                    cursorElement.appendChild(usernameLabel);
                    editor.getDomNode().appendChild(cursorElement);
                    userCursors.set(data.userId, cursorElement);
                }

                // Update cursor position
                const position = editor.getScrolledVisiblePosition({
                    lineNumber: data.position.lineNumber,
                    column: data.position.column
                });
                
                if (position) {
                    cursorElement.style.top = `${position.top}px`;
                    cursorElement.style.left = `${position.left}px`;
                    
                    // Show cursor and username label
                    cursorElement.style.opacity = '1';
                    const usernameLabel = cursorElement.querySelector('.cursor-username');
                    usernameLabel.style.opacity = '1';
                    
                    // Clear existing timeout
                    if (typingTimeouts.has(data.userId)) {
                        clearTimeout(typingTimeouts.get(data.userId));
                    }
                    
                    // Set new timeout to hide cursor and username
                    typingTimeouts.set(data.userId, setTimeout(() => {
                        cursorElement.style.opacity = '0';
                        usernameLabel.style.opacity = '0';
                    }, 2000)); // Hide after 2 seconds of inactivity
                }
            });

            // Clean up cursors when users disconnect
            socket.on('user-disconnected', (userId) => {
                const cursorElement = userCursors.get(userId);
                if (cursorElement) {
                    cursorElement.remove();
                    userCursors.delete(userId);
                }
                if (typingTimeouts.has(userId)) {
                    clearTimeout(typingTimeouts.get(userId));
                    typingTimeouts.delete(userId);
                }
            });

            // Helper function to generate consistent random colors
            function getRandomColor(userId) {
                const colors = [
                    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
                    '#D4A5A5', '#9B59B6', '#3498DB', '#1ABC9C', '#F1C40F'
                ];
                const index = Math.abs(hashCode(userId)) % colors.length;
                return colors[index];
            }

            function hashCode(str) {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    hash = ((hash << 5) - hash) + str.charCodeAt(i);
                    hash = hash & hash;
                }
                return hash;
            }
        });
    }
    
    // Add to file list
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.dataset.fileId = fileId;
    
    const fileItemName = document.createElement('span');
    fileItemName.className = 'file-item-name';
    fileItemName.textContent = fileName;
    fileItem.appendChild(fileItemName);
    
    // Add file actions
    const fileActions = document.createElement('div');
    fileActions.className = 'file-actions';
    
    const downloadBtnFile = document.createElement('span');
    downloadBtnFile.className = 'file-btn download-btn';
    downloadBtnFile.innerHTML = '↓';
    downloadBtnFile.title = 'Download this file';
    downloadBtnFile.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadFile(fileId, fileName);
    });
    fileActions.appendChild(downloadBtnFile);
    
    const closeBtnFile = document.createElement('span');
    closeBtnFile.className = 'file-btn';
    closeBtnFile.innerHTML = '×';
    closeBtnFile.title = 'Close this file';
    closeBtnFile.addEventListener('click', (e) => {
        e.stopPropagation();
        closeFile(fileId);
    });
    fileActions.appendChild(closeBtnFile);
    
    fileItem.appendChild(fileActions);
    fileItem.addEventListener('click', () => switchToFile(fileId));
    fileList.appendChild(fileItem);
}

function closeFile(fileId) {
    if (!files[fileId]) return;

    // Delete physical file if it was an uploaded file
    if (files[fileId]?.isUploadedFile && files[fileId]?.path) {
        const storedFilename = files[fileId].path.split('/').pop();
        fetch(`/delete-file/${roomId}/${storedFilename}`, {
            method: 'DELETE'
        }).catch(console.error);
    }

    delete files[fileId];
    document.querySelectorAll(`[data-file-id="${fileId}"]`).forEach(el => el.remove());
    
    if (activeFileId === fileId) {
        activeFileId = null;
        const remainingFiles = Object.keys(files);
        if (remainingFiles.length > 0) {
            switchToFile(remainingFiles[0]);
        } else {
            editorContainer.innerHTML = '';
            editorTabs.innerHTML = '';
        }
    }
    
    try {
        socket.emit('file-deleted', {
            roomId: roomId,
            fileId: fileId
        });
    } catch (error) {
        console.error('Error emitting file-deleted:', error);
    }
}

function switchToFile(fileId) {
    document.querySelectorAll('.editor-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.fileId === fileId);
    });
    
    document.querySelectorAll('.editor-content').forEach(editorDiv => {
        const isActive = editorDiv.dataset.fileId === fileId;
        editorDiv.style.display = isActive ? 'block' : 'none';
        
        if (isActive && editorDiv.editor) {
            editorDiv.editor.setValue(files[fileId].content);
            editorDiv.editor.layout();
        }
    });
    
    activeFileId = fileId;
}

// Add debounce function at the top level
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Debounced file edit handler
const debouncedFileEdit = debounce((fileId, content) => {
    socket.emit('file-update', {
        roomId: roomId,
        fileId: fileId,
        content: content
    });
}, 100);  // Reduced from 500ms to 100ms for better responsiveness

function handleFileEdit(fileId, content) {
    if (!files[fileId]) return;
    
    // Update local state immediately for instant feedback
    files[fileId].content = content;
    
    // Debounce the socket emission to prevent flooding
    debouncedFileEdit(fileId, content);
}

function downloadFile(fileId, fileName) {
    // Works for both uploaded and created files
    fetch(`/download-file/${roomId}/${fileId}`)
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
}

// User interface functions
function showTemporaryMessage(message, duration = 3000) {
    if (activeMessage) {
        activeMessage.element.remove();
        clearTimeout(activeMessage.timeout);
    }
    
    const p = document.createElement("p");
    p.innerText = message;
    p.className = 'temp-message';
    messages.appendChild(p);
    
    const timeout = setTimeout(() => {
        p.classList.add('fade-out');
        setTimeout(() => {
            if (p.parentNode) p.remove();
            if (activeMessage?.element === p) activeMessage = null;
        }, 500);
    }, duration - 500);
    
    activeMessage = { element: p, timeout: timeout };
}

function addUserBox(userId, userName) {
    if (!currentUsers.has(userId)) {
        const userBox = document.createElement('div');
        userBox.className = 'user-box';
        userBox.id = `user-${userId}`;
        
        const userColor = document.createElement('div');
        userColor.className = 'user-color';
        userColor.style.backgroundColor = getRandomColor();
        
        const userNameElement = document.createElement('div');
        userNameElement.className = 'user-name';
        userNameElement.textContent = userName;
        
        userBox.appendChild(userColor);
        userBox.appendChild(userNameElement);
        usersList.appendChild(userBox);
        
        currentUsers.set(userId, userName);
        updateUserCount();
    }
}

function removeUserBox(userId) {
    if (currentUsers.has(userId)) {
        const userBox = document.getElementById(`user-${userId}`);
        if (userBox) userBox.remove();
        currentUsers.delete(userId);
        updateUserCount();
    }
}

function updateUserCount() {
    userCount.textContent = `${currentUsers.size} user(s) online`;
}

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Socket event handlers
socket.on('message', showTemporaryMessage);

socket.on('user-joined', ({ userId, userName }) => {
    addUserBox(userId, userName);
    showUserNotification(userName, 'join');
});

socket.on('user-left', ({ userId, userName }) => {
    removeUserBox(userId);
    showUserNotification(userName, 'leave');
});

socket.on('file-created', (data) => {
    if (!files[data.fileId]) {
      files[data.fileId] = {
        id: data.fileId,
        name: data.fileName,
        content: data.content || '',  // Ensure content is included
        isUploadedFile: data.isUploadedFile || false,
        path: data.path || ''
      };
      createFileUI(data.fileId, data.fileName, data.content, data.isUploadedFile);
      
      // Automatically switch to the new file
      switchToFile(data.fileId);
    }
  });

socket.on('file-updated', (data) => {
    if (!files[data.fileId]) return;
    
    // Update local state
    files[data.fileId].content = data.content;
    
    const editorDiv = document.querySelector(`.editor-content[data-file-id="${data.fileId}"]`);
    if (!editorDiv?.editor) return;
    
    const editor = editorDiv.editor;
    const model = editor.getModel();
    if (!model) return;
    
    // Skip update if content hasn't changed
    if (model.getValue() === data.content) return;
    
    // Performance optimization: Only preserve cursor and selection for active file
    if (activeFileId === data.fileId) {
        const position = editor.getPosition();
        const selections = editor.getSelections();
        
        editorDiv.updateContent(data.content);
        
        // Only restore cursor and selection if they exist
        if (position) editor.setPosition(position);
        if (selections?.length) editor.setSelections(selections);
    } else {
        // For non-active files, just update content
        editorDiv.updateContent(data.content);
    }
});

socket.on('file-closed', (data) => {
    if (data.roomId !== roomId) return;
    if (!files[data.fileId]) return;
    
    if (files[data.fileId]?.isUploadedFile && files[data.fileId]?.path) {
        const storedFilename = files[data.fileId].path.split('/').pop();
        fetch(`/delete-file/${roomId}/${storedFilename}`, {
            method: 'DELETE'
        }).catch(console.error);
    }

    delete files[data.fileId];
    document.querySelectorAll(`[data-file-id="${data.fileId}"]`).forEach(el => el.remove());
    
    if (activeFileId === data.fileId) {
        activeFileId = null;
        const remainingFiles = Object.keys(files);
        if (remainingFiles.length > 0) {
            switchToFile(remainingFiles[0]);
        } else {
            editorContainer.innerHTML = '';
            editorTabs.innerHTML = '';
        }
    }
});

socket.on('drawing', (data) => {
    if (data.roomId !== roomId) return;
    
    const ctx = drawingCanvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(data.startX, data.startY);
    ctx.lineTo(data.endX, data.endY);
    
    if (data.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = data.color;
    }
    
    ctx.lineWidth = data.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
});

socket.on('load-strokes', (strokes) => {
    if (!drawingCanvas || !drawingCanvas.getContext) return;
    const ctx = drawingCanvas.getContext('2d');

    strokes.forEach(stroke => {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.beginPath();
        ctx.moveTo(stroke.startX, stroke.startY);
        ctx.lineTo(stroke.endX, stroke.endY);
        ctx.stroke();
    });
});

socket.on('clear-canvas', (data) => {
    if (data.roomId !== roomId) return;
    
    const ctx = drawingCanvas.getContext('2d');
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  });

  socket.on('canvas-state', (data) => {
    if (!drawingCanvas || !drawingCanvas.getContext) return;

    const ctx = drawingCanvas.getContext('2d');
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);

    if (data && data.strokes) {
        data.strokes.forEach(stroke => {
            ctx.beginPath();
            ctx.moveTo(stroke.startX, stroke.startY);
            ctx.lineTo(stroke.endX, stroke.endY);

            if (stroke.tool === 'eraser' || stroke.color === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.strokeStyle = 'rgba(0,0,0,1)';
            } else {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = stroke.color;
            }

            ctx.lineWidth = stroke.size;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
        });
    }
});

document.addEventListener('DOMContentLoaded', initDrawingBoard);
socket.on('room-state', (state) => {
    editorTabs.innerHTML = '';
    editorContainer.innerHTML = '';
    fileList.innerHTML = '';
    usersList.innerHTML = '';
    currentUsers.clear();
    
    files = state.files;
    Object.values(files).forEach(file => {
        createFileUI(file.id, file.name, file.content, file.isUploadedFile);
    });
    
    state.users.forEach(user => {
        addUserBox(user.id, user.name);
    });
    
    if (!activeFileId && Object.keys(files).length > 0) {
        switchToFile(Object.keys(files)[0]);
    }
});

// Add this function to handle notifications
function showNotification() {
    const notificationDot = document.querySelector('.notification-dot');
    if (!isChatOpen) {
        unreadMessages++;
        notificationDot.classList.add('active');
    }
}

// Add this function to handle toasts
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('notification-toast');
    const toastMessage = document.getElementById('toast-message');
    const icon = toast.querySelector('i');
    
    // Update icon based on type
    icon.className = 'fas';
    switch (type) {
        case 'success':
            icon.classList.add('fa-check-circle');
            break;
        case 'error':
            icon.classList.add('fa-exclamation-circle');
            break;
        default:
            icon.classList.add('fa-info-circle');
    }
    
    // Update toast content and style
    toastMessage.textContent = message;
    toast.className = `toast ${type}`;
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Hide toast after duration
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// Add this function to handle user notifications
function showUserNotification(userName, type) {
    const notification = document.getElementById('user-notification');
    const content = notification.querySelector('.user-notification-content');
    const icon = notification.querySelector('i');
    
    // Update icon based on type
    icon.className = 'fas';
    if (type === 'join') {
        icon.classList.add('fa-user-plus');
        notification.classList.add('join');
        notification.classList.remove('leave');
        content.innerHTML = `<span class="user-name">${userName}</span> joined the room`;
    } else {
        icon.classList.add('fa-user-minus');
        notification.classList.add('leave');
        notification.classList.remove('join');
        content.innerHTML = `<span class="user-name">${userName}</span> left the room`;
    }
    
    // Show notification
    notification.classList.add('show');
    
    // Hide after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}