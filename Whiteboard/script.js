document.addEventListener('DOMContentLoaded', () => {
    const whiteboard = document.getElementById('whiteboard');
    const addNoteBtn = document.getElementById('addNote');
    const penToggleBtn = document.getElementById('penToggle');
    const eraserToggleBtn = document.getElementById('eraserToggle');
    const eraserSettings = document.getElementById('eraserSettings');
    const eraserSizeRange = document.getElementById('eraserSizeRange');
    const eraserSizeVal = document.getElementById('eraserSizeVal');
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');

    let noteIdCounter = 0;
    let currentTool = null; // 'pen', 'eraser', or null
    let isDrawing = false;
    let eraserSize = 30;

    function resizeCanvas() {
        const rect = whiteboard.getBoundingClientRect();
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas, 0, 0);

        canvas.width = rect.width;
        canvas.height = rect.height;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        redrawCanvas(tempCanvas);
    }

    function redrawCanvas(tempCanvas) {
        if (tempCanvas) {
            ctx.drawImage(tempCanvas, 0, 0);
        }
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    loadWhiteboardState();

    // Eraser size slider logic
    eraserSizeRange.addEventListener('input', (e) => {
        eraserSize = parseInt(e.target.value);
        eraserSizeVal.innerText = eraserSize;
    });

    // Tool switching logic
    function setTool(toolName) {
        if (currentTool === toolName) {
            currentTool = null;
        } else {
            currentTool = toolName;
        }

        penToggleBtn.classList.remove('active-tool');
        eraserToggleBtn.classList.remove('active-tool');
        canvas.className = '';
        eraserSettings.classList.add('hidden');

        if (currentTool === 'pen') {
            penToggleBtn.classList.add('active-tool');
            canvas.classList.add('active-pen');
        } else if (currentTool === 'eraser') {
            eraserToggleBtn.classList.add('active-tool');
            canvas.classList.add('active-eraser');
            eraserSettings.classList.remove('hidden'); // Show gum settings popup right next to the gum button
        }
    }

    penToggleBtn.addEventListener('click', () => setTool('pen'));
    eraserToggleBtn.addEventListener('click', () => setTool('eraser'));

    // Drawing / Erasing on canvas
    canvas.addEventListener('mousedown', (e) => {
        if (!currentTool) return;
        isDrawing = true;
        ctx.beginPath();
        if (currentTool === 'pen') {
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 3;
            ctx.moveTo(e.offsetX, e.offsetY);
        } else if (currentTool === 'eraser') {
            ctx.clearRect(e.offsetX - eraserSize / 2, e.offsetY - eraserSize / 2, eraserSize, eraserSize);
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!currentTool || !isDrawing) return;
        if (currentTool === 'pen') {
            ctx.strokeStyle = '#333333';
            ctx.lineTo(e.offsetX, e.offsetY);
            ctx.stroke();
        } else if (currentTool === 'eraser') {
            ctx.clearRect(e.offsetX - eraserSize / 2, e.offsetY - eraserSize / 2, eraserSize, eraserSize);
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (!currentTool) return;
        if (isDrawing) {
            isDrawing = false;
            saveWhiteboardState();
        }
    });

    canvas.addEventListener('mouseleave', () => {
        if (isDrawing) {
            isDrawing = false;
            saveWhiteboardState();
        }
    });

    addNoteBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const sidebarRect = sidebar.getBoundingClientRect();
        const whiteboardRect = whiteboard.getBoundingClientRect();
        
        const x = sidebarRect.left - whiteboardRect.left - 220;
        const y = sidebarRect.top - whiteboardRect.top;

        const newNoteId = `note-${++noteIdCounter}`;
        createNote({ 
            id: newNoteId, 
            x: Math.max(20, x), 
            y: Math.max(20, y), 
            content: 'New Note', 
            checked: false 
        });
        saveWhiteboardState();
    });

    function createNote(noteData) {
        const note = document.createElement('div');
        note.classList.add('note');
        note.setAttribute('id', noteData.id);
        
        if (noteData.checked) {
            note.classList.add('checked');
        }

        note.style.transform = `translate3d(${noteData.x}px, ${noteData.y}px, 0)`;
        
        const checkbox = document.createElement('input');
        checkbox.setAttribute('type', 'checkbox');
        checkbox.classList.add('note-checkbox');
        checkbox.checked = noteData.checked;
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                note.classList.add('checked');
            } else {
                note.classList.remove('checked');
            }
            saveWhiteboardState();
        });

        const noteContent = document.createElement('div');
        noteContent.classList.add('note-content');
        noteContent.setAttribute('contenteditable', 'true');
        noteContent.innerText = noteData.content;
        noteContent.addEventListener('input', saveWhiteboardState);

        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-btn');
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Delete note';
        deleteBtn.addEventListener('click', () => {
            note.remove();
            saveWhiteboardState();
        });

        note.appendChild(checkbox);
        note.appendChild(noteContent);
        note.appendChild(deleteBtn);
        whiteboard.appendChild(note);

        makeDraggable(note);
    }

    function saveWhiteboardState() {
        const notes = [];
        document.querySelectorAll('.note').forEach(noteElement => {
            const noteId = noteElement.id;
            
            const transform = window.getComputedStyle(noteElement).transform;
            let x = 0;
            let y = 0;
            if (transform && transform !== 'none') {
                const matrix = transform.match(/matrix.*\((.+)\)/);
                if (matrix) {
                    const values = matrix[1].split(', ');
                    x = parseFloat(values[4]);
                    y = parseFloat(values[5]);
                }
            }

            const content = noteElement.querySelector('.note-content').innerText;
            const checked = noteElement.querySelector('.note-checkbox').checked;
            notes.push({ id: noteId, x, y, content, checked });
        });
        localStorage.setItem('whiteboardNotes', JSON.stringify(notes));

        const dataURL = canvas.toDataURL();
        localStorage.setItem('whiteboardDrawing', dataURL);
    }

    function loadWhiteboardState() {
        const savedNotes = localStorage.getItem('whiteboardNotes');
        let maxId = 0;
        if (savedNotes) {
            const notes = JSON.parse(savedNotes);
            notes.forEach(noteData => {
                createNote(noteData);
                const currentIdNum = parseInt(noteData.id.replace('note-', ''));
                if (currentIdNum > maxId) {
                    maxId = currentIdNum;
                }
            });
        }
        noteIdCounter = maxId;

        const savedDrawing = localStorage.getItem('whiteboardDrawing');
        if (savedDrawing) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
            };
            img.src = savedDrawing;
        }
    }

    function makeDraggable(element) {
        let isDragging = false;
        let initialX, initialY;
        let xOffset = 0;
        let yOffset = 0;

        const transform = window.getComputedStyle(element).transform;
        if (transform && transform !== 'none') {
            const matrix = transform.match(/matrix.*\((.+)\)/);
            if (matrix) {
                const values = matrix[1].split(', ');
                xOffset = parseFloat(values[4]);
                yOffset = parseFloat(values[5]);
            }
        }

        element.addEventListener('mousedown', dragStart);
        whiteboard.addEventListener('mousemove', drag);
        whiteboard.addEventListener('mouseup', dragEnd);

        function dragStart(e) {
            if (currentTool) return; // Disable note dragging when tools are active
            if (e.target.classList.contains('note-checkbox') || e.target.classList.contains('note-content') || e.target.classList.contains('delete-btn')) {
                return;
            }

            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
            element.style.cursor = 'grabbing';
        }

        function dragEnd(e) {
            if (isDragging) {
                isDragging = false;
                saveWhiteboardState();
                element.style.cursor = 'grab';
            }
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                const newX = e.clientX - initialX;
                const newY = e.clientY - initialY;

                xOffset = newX;
                yOffset = newY;

                setTranslate(newX, newY, element);
            }
        }

        function setTranslate(xPos, yPos, el) {
            el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
        }
    }
});