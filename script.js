require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs' }});

document.addEventListener('DOMContentLoaded', function() {
    const hierarchyContent = document.getElementById('hierarchy-content');
    const gameCanvas = document.getElementById('game-canvas');
    const inspectorContent = document.getElementById('inspector-content');
    const prefabItems = document.querySelectorAll('.prefab-item');
    const runButton = document.getElementById('run-button');
    const pauseButton = document.getElementById('pause-button');
    const projectContent = document.getElementById('project-content');
    
    let gameObjects = [];
    let selectedObject = null;
    let nextId = 1;
    let isRunning = false;
    let isDragging = false;
    let dragStartX, dragStartY;
    let draggedObjectInitialX, draggedObjectInitialY;
    let dragAxis = null; // 'x', 'y', or null for both
    let customPrefabs = []; // Store custom prefabs like imported images
    let gameLoopInterval = null;
    let playerControls = {
        up: false,
        down: false,
        left: false,
        right: false,
        jump: false
    };
    
    // Define prefab types
    const prefabTypes = {
        cube: {
            render: (obj) => {
                return `<rect x="${obj.x - obj.size/2}" y="${obj.y - obj.size/2}" width="${obj.size}" height="${obj.size}" fill="${obj.color}" />`;
            },
            properties: {
                x: 150,
                y: 150,
                size: 50,
                color: '#4287f5'
            }
        },
        circle: {
            render: (obj) => {
                return `<circle cx="${obj.x}" cy="${obj.y}" r="${obj.radius}" fill="${obj.color}" />`;
            },
            properties: {
                x: 150,
                y: 150,
                radius: 25,
                color: '#f54242'
            }
        },
        triangle: {
            render: (obj) => {
                const size = obj.size;
                const halfSize = size / 2;
                const points = `${obj.x},${obj.y - halfSize} ${obj.x + halfSize},${obj.y + halfSize} ${obj.x - halfSize},${obj.y + halfSize}`;
                return `<polygon points="${points}" fill="${obj.color}" />`;
            },
            properties: {
                x: 150,
                y: 150,
                size: 50,
                color: '#42f557'
            }
        }
    };
    
    // Initialize draggable prefabs
    prefabItems.forEach(item => {
        item.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', this.getAttribute('data-type'));
        });
    });
    
    // Setup hierarchy drop zone
    hierarchyContent.addEventListener('dragover', function(e) {
        e.preventDefault();
    });
    
    hierarchyContent.addEventListener('drop', function(e) {
        e.preventDefault();
        const type = e.dataTransfer.getData('text/plain');
        
        if (prefabTypes[type]) {
            createGameObject(type);
        }
    });
    
    // Create a new game object
    function createGameObject(type) {
        const id = nextId++;
        const name = `${type.charAt(0).toUpperCase() + type.slice(1)}_${id}`;
        
        // Clone properties from prefab type
        const properties = JSON.parse(JSON.stringify(prefabTypes[type].properties));
        
        const gameObject = {
            id,
            name,
            type,
            ...properties
        };
        
        gameObjects.push(gameObject);
        renderHierarchy();
        renderGame();
        selectObject(gameObject);
    }
    
    // Add game canvas interaction events
    gameCanvas.addEventListener('mousedown', handleCanvasMouseDown);
    gameCanvas.addEventListener('mousemove', handleCanvasMouseMove);
    gameCanvas.addEventListener('mouseup', handleCanvasMouseUp);
    gameCanvas.addEventListener('click', handleCanvasClick);
    
    // Handle mouse down on game canvas
    function handleCanvasMouseDown(e) {
        if (!selectedObject) return;
        
        const rect = gameCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const xDist = Math.abs(mouseX - selectedObject.x);
        const yDist = Math.abs(mouseY - selectedObject.y);
        
        // Check if clicking on an axis arrow (within 15px of center on x or y axis)
        if (xDist <= 15 && yDist <= 15) {
            // Clicked near the center, start dragging freely
            isDragging = true;
            dragAxis = null;
        } else if (xDist <= 50 && yDist <= 10) {
            // Clicked on X axis arrow
            isDragging = true;
            dragAxis = 'x';
        } else if (xDist <= 10 && yDist <= 50) {
            // Clicked on Y axis arrow
            isDragging = true;
            dragAxis = 'y';
        } else {
            return;
        }
        
        dragStartX = mouseX;
        dragStartY = mouseY;
        draggedObjectInitialX = selectedObject.x;
        draggedObjectInitialY = selectedObject.y;
        
        e.preventDefault();
    }
    
    function handleCanvasMouseMove(e) {
        if (!isDragging) return;
        
        const rect = gameCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const deltaX = mouseX - dragStartX;
        const deltaY = mouseY - dragStartY;
        
        if (dragAxis === null || dragAxis === 'x') {
            selectedObject.x = draggedObjectInitialX + deltaX;
        }
        
        if (dragAxis === null || dragAxis === 'y') {
            selectedObject.y = draggedObjectInitialY + deltaY;
        }
        
        renderGame();
        renderInspector();
    }
    
    function handleCanvasMouseUp() {
        isDragging = false;
    }
    
    // Handle click on game canvas to select objects
    function handleCanvasClick(e) {
        if (isDragging) return; // Don't select if we were dragging
        
        const rect = gameCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Try to find the object that was clicked
        let clickedObject = null;
        
        // Search in reverse order so we select the top-most object
        for (let i = gameObjects.length - 1; i >= 0; i--) {
            const obj = gameObjects[i];
            if (isPointInObject(mouseX, mouseY, obj)) {
                clickedObject = obj;
                break;
            }
        }
        
        if (clickedObject) {
            selectObject(clickedObject);
        }
    }
    
    // Check if a point is inside an object
    function isPointInObject(x, y, obj) {
        if (obj.type === 'cube') {
            return x >= obj.x - obj.size/2 && 
                   x <= obj.x + obj.size/2 && 
                   y >= obj.y - obj.size/2 && 
                   y <= obj.y + obj.size/2;
        } else if (obj.type === 'circle') {
            const dx = x - obj.x;
            const dy = y - obj.y;
            return dx * dx + dy * dy <= obj.radius * obj.radius;
        } else if (obj.type === 'triangle') {
            const halfSize = obj.size / 2;
            // Simple triangle hit test
            const p1 = { x: obj.x, y: obj.y - halfSize };
            const p2 = { x: obj.x + halfSize, y: obj.y + halfSize };
            const p3 = { x: obj.x - halfSize, y: obj.y + halfSize };
            return isPointInTriangle(x, y, p1, p2, p3);
        } else if (obj.type.startsWith('image_')) {
            return x >= obj.x - obj.width/2 && 
                   x <= obj.x + obj.width/2 && 
                   y >= obj.y - obj.height/2 && 
                   y <= obj.y + obj.height/2;
        }
        return false;
    }
    
    // Helper function to check if a point is inside a triangle
    function isPointInTriangle(x, y, p1, p2, p3) {
        const area = 0.5 * Math.abs(
            (p1.x * (p2.y - p3.y) + 
             p2.x * (p3.y - p1.y) + 
             p3.x * (p1.y - p2.y))
        );
        
        const area1 = 0.5 * Math.abs((x * (p1.y - p2.y) + p1.x * (p2.y - y) + p2.x * (y - p1.y)));
        const area2 = 0.5 * Math.abs((x * (p2.y - p3.y) + p2.x * (p3.y - y) + p3.x * (y - p2.y)));
        const area3 = 0.5 * Math.abs((x * (p3.y - p1.y) + p3.x * (p1.y - y) + p1.x * (y - p3.y)));
        
        return Math.abs(area - (area1 + area2 + area3)) < 0.1; // Add small epsilon for floating point errors
    }
    
    // Render the hierarchy panel
    function renderHierarchy() {
        hierarchyContent.innerHTML = '';
        
        gameObjects.forEach(obj => {
            const itemEl = document.createElement('div');
            itemEl.className = 'hierarchy-item';
            if (selectedObject && selectedObject.id === obj.id) {
                itemEl.classList.add('selected');
            }
            
            let iconSvg = '';
            if (obj.type === 'cube') {
                iconSvg = '<svg viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" fill="#4287f5"></rect></svg>';
            } else if (obj.type === 'circle') {
                iconSvg = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="#f54242"></circle></svg>';
            } else if (obj.type === 'triangle') {
                iconSvg = '<svg viewBox="0 0 16 16"><polygon points="8,3 13,13 3,13" fill="#42f557"></polygon></svg>';
            }
            
            itemEl.innerHTML = iconSvg + obj.name;
            itemEl.addEventListener('click', () => selectObject(obj));
            
            hierarchyContent.appendChild(itemEl);
        });
    }
    
    // Render all game objects on the canvas
    function renderGame() {
        let svgContent = '';
        
        gameObjects.forEach(obj => {
            if (prefabTypes[obj.type] && prefabTypes[obj.type].render) {
                svgContent += prefabTypes[obj.type].render(obj);
                
                // Add selection highlight if this object is selected
                if (selectedObject && selectedObject.id === obj.id) {
                    if (obj.type.startsWith('image_')) {
                        // Selection highlight for image
                        svgContent += `<rect x="${obj.x - obj.width/2 - 2}" y="${obj.y - obj.height/2 - 2}" 
                                       width="${obj.width + 4}" height="${obj.height + 4}" 
                                       stroke="#55aaff" stroke-width="2" fill="none" stroke-dasharray="4,2" />`;
                    } else if (obj.type === 'cube') {
                        svgContent += `<rect x="${obj.x - obj.size/2 - 2}" y="${obj.y - obj.size/2 - 2}" 
                                         width="${obj.size + 4}" height="${obj.size + 4}" 
                                         stroke="#55aaff" stroke-width="2" fill="none" stroke-dasharray="4,2" />`;
                    } else if (obj.type === 'circle') {
                        svgContent += `<circle cx="${obj.x}" cy="${obj.y}" r="${obj.radius + 2}" 
                                            stroke="#55aaff" stroke-width="2" fill="none" stroke-dasharray="4,2" />`;
                    } else if (obj.type === 'triangle') {
                        const size = obj.size + 4;
                        const halfSize = size / 2;
                        const points = `${obj.x},${obj.y - halfSize} ${obj.x + halfSize},${obj.y + halfSize} ${obj.x - halfSize},${obj.y + halfSize}`;
                        svgContent += `<polygon points="${points}" stroke="#55aaff" stroke-width="2" fill="none" stroke-dasharray="4,2" />`;
                    }
                    
                    // Add movement gizmo (arrows)
                    svgContent += `
                        <line x1="${obj.x}" y1="${obj.y}" x2="${obj.x + 40}" y2="${obj.y}" 
                              stroke="#ff5555" stroke-width="2" />
                        <polygon points="${obj.x + 40},${obj.y - 5} ${obj.x + 50},${obj.y} ${obj.x + 40},${obj.y + 5}" 
                                 fill="#ff5555" />
                        
                        <line x1="${obj.x}" y1="${obj.y}" x2="${obj.x}" y2="${obj.y + 40}" 
                              stroke="#55ff55" stroke-width="2" />
                        <polygon points="${obj.x - 5},${obj.y + 40} ${obj.x},${obj.y + 50} ${obj.x + 5},${obj.y + 40}" 
                                 fill="#55ff55" />
                        
                        <circle cx="${obj.x}" cy="${obj.y}" r="4" fill="#55aaff" />
                    `;
                }
            }
        });
        
        gameCanvas.innerHTML = svgContent;
    }
    
    // Select an object and show its properties
    function selectObject(obj) {
        selectedObject = obj;
        renderHierarchy();
        renderInspector();
        renderGame();
    }
    
    // Render the inspector panel for the selected object
    function renderInspector() {
        inspectorContent.innerHTML = '';
        
        if (!selectedObject) {
            inspectorContent.innerHTML = '<p>No object selected</p>';
            return;
        }
        
        // Create name field
        createInspectorField('Name', 'text', 'name', selectedObject.name);
        
        // Create type-specific properties
        if (selectedObject.type.startsWith('image_')) {
            createInspectorField('X Position', 'number', 'x', selectedObject.x);
            createInspectorField('Y Position', 'number', 'y', selectedObject.y);
            createInspectorField('Width', 'number', 'width', selectedObject.width);
            createInspectorField('Height', 'number', 'height', selectedObject.height);
        } else if (selectedObject.type === 'cube') {
            createInspectorField('X Position', 'number', 'x', selectedObject.x);
            createInspectorField('Y Position', 'number', 'y', selectedObject.y);
            createInspectorField('Size', 'number', 'size', selectedObject.size);
            createInspectorField('Color', 'color', 'color', selectedObject.color);
        } else if (selectedObject.type === 'circle') {
            createInspectorField('X Position', 'number', 'x', selectedObject.x);
            createInspectorField('Y Position', 'number', 'y', selectedObject.y);
            createInspectorField('Radius', 'number', 'radius', selectedObject.radius);
            createInspectorField('Color', 'color', 'color', selectedObject.color);
        } else if (selectedObject.type === 'triangle') {
            createInspectorField('X Position', 'number', 'x', selectedObject.x);
            createInspectorField('Y Position', 'number', 'y', selectedObject.y);
            createInspectorField('Size', 'number', 'size', selectedObject.size);
            createInspectorField('Color', 'color', 'color', selectedObject.color);
        }
        
        // Render component properties
        renderComponentProperties();
        
        // Add component button
        const addComponentBtn = document.createElement('button');
        addComponentBtn.className = 'add-component-btn';
        addComponentBtn.innerHTML = '<i class="fas fa-plus"></i> Add Component';
        addComponentBtn.addEventListener('click', showComponentMenu);
        inspectorContent.appendChild(addComponentBtn);
    }
    
    // Show component menu
    function showComponentMenu(e) {
        e.preventDefault();
        
        // Create and show component menu
        const componentMenu = document.createElement('div');
        componentMenu.className = 'component-menu';
        componentMenu.innerHTML = `
            <div class="menu-item" id="menu-physics"><i class="fas fa-atom"></i> Physics</div>
            <div class="menu-item" id="menu-player"><i class="fas fa-gamepad"></i> Player</div>
        `;
        
        // Position menu below the button
        const rect = e.target.getBoundingClientRect();
        componentMenu.style.left = rect.left + 'px';
        componentMenu.style.top = rect.bottom + 'px';
        
        document.body.appendChild(componentMenu);
        
        // Handle clicking outside the menu
        function removeMenu(e) {
            if (!componentMenu.contains(e.target) && e.target !== e.currentTarget) {
                componentMenu.remove();
                document.removeEventListener('click', removeMenu);
            }
        }
        
        // Handle menu item clicks
        document.getElementById('menu-physics').addEventListener('click', function() {
            addComponentToObject('physics');
            componentMenu.remove();
        });
        
        document.getElementById('menu-player').addEventListener('click', function() {
            addComponentToObject('player');
            componentMenu.remove();
        });
        
        // Remove menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', removeMenu);
        }, 0);
    }
    
    // Add component to selected object
    function addComponentToObject(componentType) {
        if (!selectedObject) return;
        
        if (!selectedObject.components) {
            selectedObject.components = {};
        }
        
        if (componentType === 'physics') {
            selectedObject.components.physics = {
                enabled: true,
                gravity: 9.8,
                velocity: { x: 0, y: 0 },
                friction: 0.1,
                bounciness: 0.3,
                isStatic: false
            };
        } else if (componentType === 'player') {
            selectedObject.components.player = {
                enabled: true,
                speed: 5,
                canJump: true,
                jumpForce: 10
            };
        }
        
        renderInspector();
    }
    
    // Render component properties in inspector
    function renderComponentProperties() {
        if (!selectedObject || !selectedObject.components) return;
        
        // 遍历所有组件
        Object.entries(selectedObject.components).forEach(([componentName, component]) => {
            const componentDiv = document.createElement('div');
            componentDiv.className = 'component-section';
            
            // 根据组件类型创建不同的界面
            if (componentName === 'physics') {
                // Physics component UI (保持原有代码)
                componentDiv.innerHTML = `
                    <div class="component-header">
                        <h3>Physics Component</h3>
                        <button class="code-edit-btn" title="Edit Code" data-component="physics">
                            <i class="fas fa-code"></i>
                        </button>
                    </div>`;
                inspectorContent.appendChild(componentDiv);
                
                createInspectorField('Enabled', 'checkbox', 'components.physics.enabled', 
                                    component.enabled, componentDiv);
                createInspectorField('Gravity', 'number', 'components.physics.gravity', 
                                    component.gravity, componentDiv);
                createInspectorField('Friction', 'number', 'components.physics.friction', 
                                    component.friction, componentDiv);
                createInspectorField('Bounciness', 'number', 'components.physics.bounciness', 
                                    component.bounciness, componentDiv);
                createInspectorField('Is Static', 'checkbox', 'components.physics.isStatic', 
                                    component.isStatic, componentDiv);
            } else if (componentName === 'player') {
                // Player component UI (保持原有代码)
                componentDiv.innerHTML = `
                    <div class="component-header">
                        <h3>Player Component</h3>
                        <button class="code-edit-btn" title="Edit Code" data-component="player">
                            <i class="fas fa-code"></i>
                        </button>
                    </div>`;
                inspectorContent.appendChild(componentDiv);
                
                createInspectorField('Enabled', 'checkbox', 'components.player.enabled', 
                                    component.enabled, componentDiv);
                createInspectorField('Speed', 'number', 'components.player.speed', 
                                    component.speed, componentDiv);
                createInspectorField('Can Jump', 'checkbox', 'components.player.canJump', 
                                    component.canJump, componentDiv);
                createInspectorField('Jump Force', 'number', 'components.player.jumpForce', 
                                    component.jumpForce, componentDiv);
            } else {
                // 自定义脚本组件 UI
                componentDiv.innerHTML = `
                    <div class="component-header">
                        <h3>${componentName}</h3>
                        <button class="code-edit-btn" title="Edit Code" data-component="${componentName}">
                            <i class="fas fa-code"></i>
                        </button>
                    </div>`;
                inspectorContent.appendChild(componentDiv);
                
                // 显示所有公共属性
                Object.entries(component).forEach(([key, value]) => {
                    if (key !== 'code' && key !== 'instance' && typeof value !== 'function') {
                        createInspectorField(key, typeof value === 'boolean' ? 'checkbox' : 'text', 
                            `components.${componentName}.${key}`, value, componentDiv);
                    }
                });
            }
        });
    }
    
    // Create an inspector field with label and input
    function createInspectorField(label, type, property, value, parentElement = null) {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'inspector-field';
        
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        
        let inputEl;
        if (type === 'checkbox') {
            inputEl = document.createElement('input');
            inputEl.type = 'checkbox';
            inputEl.checked = value;
        } else {
            inputEl = document.createElement('input');
            inputEl.type = type;
            inputEl.value = value;
        }
        
        inputEl.addEventListener('change', () => {
            let newValue;
            if (type === 'checkbox') {
                newValue = inputEl.checked;
            } else if (type === 'number') {
                newValue = parseFloat(inputEl.value);
            } else {
                newValue = inputEl.value;
            }
            
            if (selectedObject) {
                // Handle nested properties (e.g., "components.physics.enabled")
                if (property.includes('.')) {
                    const parts = property.split('.');
                    let obj = selectedObject;
                    for (let i = 0; i < parts.length - 1; i++) {
                        obj = obj[parts[i]];
                    }
                    obj[parts[parts.length - 1]] = newValue;
                } else {
                    selectedObject[property] = newValue;
                }
                
                renderHierarchy();
                renderGame();
            }
        });
        
        fieldDiv.appendChild(labelEl);
        fieldDiv.appendChild(inputEl);
        
        if (parentElement) {
            parentElement.appendChild(fieldDiv);
        } else {
            inspectorContent.appendChild(fieldDiv);
        }
    }
    
    // Handle run button click
    runButton.addEventListener('click', function() {
        isRunning = true;
        runButton.classList.add('active');
        pauseButton.classList.remove('active');
        document.body.classList.add('running-mode');
        
        // 记录所有对象的当前位置作为初始位置
        gameObjects.forEach(obj => {
            obj.initialPosition = {
                x: obj.x,
                y: obj.y
            };
            
            // 调用所有组件的 start 方法
            if (obj.components) {
                Object.entries(obj.components).forEach(([name, component]) => {
                    if (component.enabled && component.instance && component.instance.start) {
                        component.instance.start(obj);
                    }
                });
            }
        });
        
        // Start game loop
        if (!gameLoopInterval) {
            startGameLoop();
        }
        
        // Add keyboard event listeners
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
    });
    
    // Handle pause button click
    pauseButton.addEventListener('click', function() {
        isRunning = false;
        runButton.classList.remove('active');
        pauseButton.classList.add('active');
        document.body.classList.remove('running-mode');
        
        // Stop game loop
        if (gameLoopInterval) {
            clearInterval(gameLoopInterval);
            gameLoopInterval = null;
        }
        
        // 重置所有对象到初始位置
        gameObjects.forEach(obj => {
            if (obj.initialPosition) {
                obj.x = obj.initialPosition.x;
                obj.y = obj.initialPosition.y;
                
                // 重置物理组件的速度
                if (obj.components && obj.components.physics) {
                    obj.components.physics.velocity = { x: 0, y: 0 };
                }
            }
        });
        
        // 重新渲染游戏场景
        renderGame();
        
        // 移除键盘事件监听器
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
    });
    
    // Game loop
    function startGameLoop() {
        const FPS = 60;
        gameLoopInterval = setInterval(updateGame, 1000 / FPS);
    }
    
    // Update game state
    function updateGame() {
        if (!isRunning) return;
        
        // 更新所有对象
        gameObjects.forEach(obj => {
            // 执行所有组件的更新
            if (obj.components) {
                Object.entries(obj.components).forEach(([name, component]) => {
                    if (component.enabled && component.instance) {
                        // 调用 update 方法
                        if (component.instance.update) {
                            component.instance.update(obj, playerControls);
                        }
                    }
                });
            }
        });
        
        // 现有的物理和玩家控制更新
        gameObjects.forEach(updateObjectPhysics);
        gameObjects.forEach(updatePlayerControls);
        
        renderGame();
    }
    
    // Update physics for an object
    function updateObjectPhysics(obj) {
        if (!obj.components || !obj.components.physics || !obj.components.physics.enabled) return;
        
        const physics = obj.components.physics;
        
        // Skip static objects
        if (physics.isStatic) return;
        
        // Apply gravity
        physics.velocity.y += physics.gravity * 0.1; // Scale down for smoother movement
        
        // Apply friction
        physics.velocity.x *= (1 - physics.friction);
        
        // Update position
        obj.x += physics.velocity.x;
        obj.y += physics.velocity.y;
        
        // Bounce off canvas edges
        const canvasBounds = gameCanvas.getBoundingClientRect();
        const objectRadius = obj.radius || obj.size/2 || Math.max(obj.width, obj.height)/2 || 20;
        
        // Bottom boundary
        if (obj.y + objectRadius > canvasBounds.height) {
            obj.y = canvasBounds.height - objectRadius;
            physics.velocity.y = -physics.velocity.y * physics.bounciness;
            // Apply additional friction when on ground
            physics.velocity.x *= (1 - physics.friction);
        }
        
        // Left and right boundaries
        if (obj.x - objectRadius < 0) {
            obj.x = objectRadius;
            physics.velocity.x = -physics.velocity.x * physics.bounciness;
        } else if (obj.x + objectRadius > canvasBounds.width) {
            obj.x = canvasBounds.width - objectRadius;
            physics.velocity.x = -physics.velocity.x * physics.bounciness;
        }
    }
    
    // Handle key down events
    function handleKeyDown(e) {
        switch(e.key.toLowerCase()) {
            case 'w':
                playerControls.up = true;
                break;
            case 'a':
                playerControls.left = true;
                break;
            case 's':
                playerControls.down = true;
                break;
            case 'd':
                playerControls.right = true;
                break;
            case ' ':
                playerControls.jump = true;
                break;
        }
    }
    
    // Handle key up events
    function handleKeyUp(e) {
        switch(e.key.toLowerCase()) {
            case 'w':
                playerControls.up = false;
                break;
            case 'a':
                playerControls.left = false;
                break;
            case 's':
                playerControls.down = false;
                break;
            case 'd':
                playerControls.right = false;
                break;
            case ' ':
                playerControls.jump = false;
                break;
        }
    }
    
    // Update player controls
    function updatePlayerControls(obj) {
        if (!obj.components || !obj.components.player || !obj.components.player.enabled) return;
        
        const player = obj.components.player;
        const speed = player.speed;
        
        if (playerControls.left) {
            obj.x -= speed;
        }
        if (playerControls.right) {
            obj.x += speed;
        }
        if (playerControls.up) {
            obj.y -= speed;
        }
        if (playerControls.down) {
            obj.y += speed;
        }
        
        // Handle jump if object has physics
        if (playerControls.jump && player.canJump && obj.components.physics) {
            const physics = obj.components.physics;
            
            // Only jump if close to ground
            const canvasBounds = gameCanvas.getBoundingClientRect();
            const objectRadius = obj.radius || obj.size/2 || Math.max(obj.width, obj.height)/2 || 20;
            const isNearGround = obj.y + objectRadius >= canvasBounds.height - 10;
            
            if (isNearGround) {
                physics.velocity.y = -player.jumpForce;
            }
        }
    }
    
    // Setup right-click context menu for project window
    projectContent.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        
        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.innerHTML = `
            <div class="menu-item" id="menu-import"><i class="fas fa-file-import"></i> Import</div>
            <div class="menu-item" id="menu-new-script"><i class="fas fa-code"></i> New Script</div>
            <div class="menu-item" id="menu-delete"><i class="fas fa-trash"></i> Delete</div>
            <div class="menu-item" id="menu-create"><i class="fas fa-plus"></i> Create</div>
        `;
        
        // Position menu at mouse position
        contextMenu.style.left = e.clientX + 'px';
        contextMenu.style.top = e.clientY + 'px';
        
        document.body.appendChild(contextMenu);
        
        // Handle clicking outside the menu
        function removeMenu(e) {
            if (!contextMenu.contains(e.target)) {
                contextMenu.remove();
                document.removeEventListener('click', removeMenu);
            }
        }
        
        // Handle menu item clicks
        document.getElementById('menu-import').addEventListener('click', function() {
            importImage();
            contextMenu.remove();
        });
        
        document.getElementById('menu-new-script').addEventListener('click', function() {
            createNewScript();
            contextMenu.remove();
        });
        
        document.getElementById('menu-delete').addEventListener('click', function() {
            // To be implemented
            contextMenu.remove();
        });
        
        document.getElementById('menu-create').addEventListener('click', function() {
            // To be implemented
            contextMenu.remove();
        });
        
        // Remove menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', removeMenu);
        }, 0);
    });
    
    // Import image functionality
    function importImage() {
        // Create a hidden file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        // Trigger click on the file input
        fileInput.click();
        
        // Handle file selection
        fileInput.addEventListener('change', function() {
            if (fileInput.files && fileInput.files[0]) {
                const file = fileInput.files[0];
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    const imageData = e.target.result;
                    
                    // Create a new custom prefab
                    const prefabName = file.name.split('.')[0]; // Use filename without extension
                    
                    // Create new prefab type
                    const prefabId = 'image_' + Date.now();
                    prefabTypes[prefabId] = {
                        render: (obj) => {
                            return `<image x="${obj.x - obj.width/2}" y="${obj.y - obj.height/2}" 
                                    width="${obj.width}" height="${obj.height}" 
                                    href="${obj.imageUrl}" />`;
                        },
                        properties: {
                            x: 150,
                            y: 150,
                            width: 100,
                            height: 100,
                            imageUrl: imageData
                        }
                    };
                    
                    // Add to custom prefabs list
                    customPrefabs.push({
                        id: prefabId,
                        name: prefabName,
                        imageUrl: imageData
                    });
                    
                    // Create prefab item in the project panel
                    createPrefabItem(prefabId, prefabName, imageData);
                };
                
                reader.readAsDataURL(file);
            }
            
            // Remove the file input
            document.body.removeChild(fileInput);
        });
    }
    
    // Create a prefab item in the project panel
    function createPrefabItem(prefabId, name, imageUrl) {
        const prefabItem = document.createElement('div');
        prefabItem.className = 'prefab-item';
        prefabItem.setAttribute('data-type', prefabId);
        prefabItem.setAttribute('draggable', 'true');
        
        prefabItem.innerHTML = `
            <div class="prefab-preview">
                <img src="${imageUrl}" alt="${name}" style="max-width: 50px; max-height: 50px;">
            </div>
            <div class="prefab-name">${name}</div>
        `;
        
        // Setup drag functionality
        prefabItem.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', this.getAttribute('data-type'));
        });
        
        projectContent.appendChild(prefabItem);
    }

    // 修改 createCodeEditor 函数
    function createCodeEditor(component, code) {
        const dialog = document.createElement('div');
        dialog.className = 'code-editor-dialog';
        dialog.innerHTML = `
            <div class="code-editor-header">
                <h3>${component}</h3>
                <button class="code-editor-close">×</button>
            </div>
            <div class="code-editor-content">
                <div id="monaco-editor" style="height: 400px;"></div>
            </div>
            <div class="code-editor-actions">
                <button class="code-editor-button code-editor-cancel">Cancel</button>
                <button class="code-editor-button code-editor-save">Save</button>
            </div>
        `;
        document.body.appendChild(dialog);

        // 创建 Monaco Editor
        require(['vs/editor/editor.main'], function() {
            const editor = monaco.editor.create(document.getElementById('monaco-editor'), {
                value: code,
                language: 'javascript',
                theme: 'vs-dark',
                minimap: { enabled: true },
                automaticLayout: true,
                fontSize: 14,
                scrollBeyondLastLine: false,
                roundedSelection: false,
                renderIndentGuides: true,
                fixedOverflowWidgets: true,
                suggestOnTriggerCharacters: true,
                lineNumbers: 'on',
                glyphMargin: false,
                folding: true,
                lineDecorationsWidth: 0,
                lineNumbersMinChars: 3,
            });

            // 处理关闭
            dialog.querySelector('.code-editor-close').onclick = () => {
                editor.dispose(); // 清理编辑器
                dialog.remove();
            };
            
            // 处理取消
            dialog.querySelector('.code-editor-cancel').onclick = () => {
                editor.dispose(); // 清理编辑器
                dialog.remove();
            };
            
            // 处理保存
            dialog.querySelector('.code-editor-save').onclick = () => {
                const newCode = editor.getValue();
                try {
                    const classDefinition = `
                        (function() {
                            ${newCode}
                            return ${component};
                        })()
                    `;
                    
                    const ScriptClass = eval(classDefinition);
                    
                    if (componentTemplates[component.toLowerCase()]) {
                        componentTemplates[component.toLowerCase()] = newCode;
                    } else {
                        const scriptItem = document.querySelector(`[data-script-name="${component}"]`);
                        if (scriptItem) {
                            scriptItem.setAttribute('data-code', newCode);
                        }
                        
                        if (selectedObject && selectedObject.components && 
                            selectedObject.components[component.toLowerCase()]) {
                            const instance = new ScriptClass();
                            const oldValues = { ...selectedObject.components[component.toLowerCase()] };
                            
                            selectedObject.components[component.toLowerCase()] = {
                                ...instance,
                                ...oldValues,
                                code: newCode,
                                instance: instance
                            };
                            
                            if (isRunning && instance.start) {
                                instance.start(selectedObject);
                            }
                        }
                    }
                    editor.dispose(); // 清理编辑器
                    dialog.remove();
                    renderInspector();
                } catch (error) {
                    alert('Invalid code: ' + error.message);
                }
            };
        });

        return dialog;
    }

    // 添加创建组件实例的函数
    function createComponentInstance(gameObject, componentName) {
        const component = gameObject.components[componentName];
        if (!component || !component.code) return;

        try {
            // 执行代码以确保类被定义
            eval(component.code);
            
            // 获取类名
            const className = component.code.match(/class\s+(\w+)/)[1];
            
            // 创建新实例
            const instance = new (eval(className))();
            
            // 保存所有现有的值
            const oldValues = { ...component };
            
            // 更新组件，保持现有值
            gameObject.components[componentName] = {
                ...instance,
                ...oldValues,
                code: component.code,
                instance: instance  // 保存实例以便调用方法
            };

            // 如果游戏正在运行，立即执行 start 方法
            if (isRunning && instance.start) {
                instance.start(gameObject);
            }
        } catch (error) {
            console.error('Error creating component instance:', error);
        }
    }

    // 修改 createNewScript 函数
    function createNewScript() {
        const scriptName = prompt('Enter script name:', 'NewScript');
        if (!scriptName) return;
        
        const scriptTemplate = `class ${scriptName} {
    constructor() {
        // 初始化组件
        this.enabled = true;
    }

    start() {
        // 在这里添加初始化逻辑
    }

    update() {
        // 在这里添加每帧更新逻辑
    }
}`;

        // 创建脚本预制体
        const scriptItem = document.createElement('div');
        scriptItem.className = 'prefab-item script-item';
        scriptItem.setAttribute('data-type', 'script');
        scriptItem.setAttribute('data-script-name', scriptName);
        scriptItem.setAttribute('data-code', scriptTemplate);
        scriptItem.setAttribute('draggable', 'true');
        
        scriptItem.innerHTML = `
            <div class="prefab-preview">
                <i class="fas fa-file-code" style="font-size: 24px; color: #007acc;"></i>
            </div>
            <div class="prefab-name">${scriptName}</div>
        `;
        
        // 添加双击编辑功能
        scriptItem.addEventListener('dblclick', () => {
            const code = scriptItem.getAttribute('data-code') || scriptTemplate;
            createCodeEditor(scriptName, code);
        });
        
        // 添加拖拽功能
        scriptItem.addEventListener('dragstart', (e) => {
            const code = scriptItem.getAttribute('data-code') || scriptTemplate;
            e.dataTransfer.setData('application/script', JSON.stringify({
                name: scriptName,
                code: code
            }));
        });
        
        projectContent.appendChild(scriptItem);
    }

    // 修改 setupCodeEditor 函数
    function setupCodeEditor() {
        // 组件代码模板
        window.componentTemplates = {  // 使其可全局访问
            physics: `class PhysicsComponent {
                constructor() {
                    this.enabled = true;
                    this.gravity = 9.8;
                    this.velocity = { x: 0, y: 0 };
                    this.friction = 0.1;
                    this.bounciness = 0.3;
                    this.isStatic = false;
                }

                update(gameObject) {
                    if (!this.enabled || this.isStatic) return;

                    // Apply gravity
                    this.velocity.y += this.gravity * 0.1;

                    // Apply friction
                    this.velocity.x *= (1 - this.friction);

                    // Update position
                    gameObject.x += this.velocity.x;
                    gameObject.y += this.velocity.y;

                    // Handle collisions with canvas bounds
                    this.handleBoundaryCollisions(gameObject);
                }

                handleBoundaryCollisions(gameObject) {
                    const canvas = document.getElementById('game-canvas');
                    const bounds = canvas.getBoundingClientRect();
                    const radius = gameObject.radius || gameObject.size/2 || 20;

                    // Bottom boundary
                    if (gameObject.y + radius > bounds.height) {
                        gameObject.y = bounds.height - radius;
                        this.velocity.y = -this.velocity.y * this.bounciness;
                        this.velocity.x *= (1 - this.friction);
                    }

                    // Left and right boundaries
                    if (gameObject.x - radius < 0) {
                        gameObject.x = radius;
                        this.velocity.x = -this.velocity.x * this.bounciness;
                    } else if (gameObject.x + radius > bounds.width) {
                        gameObject.x = bounds.width - radius;
                        this.velocity.x = -this.velocity.x * this.bounciness;
                    }
                }
            }`,
            player: `class PlayerComponent {
                constructor() {
                    this.enabled = true;
                    this.speed = 5;
                    this.canJump = true;
                    this.jumpForce = 10;
                }

                update(gameObject, input) {
                    if (!this.enabled) return;

                    // Handle horizontal movement
                    if (input.left) gameObject.x -= this.speed;
                    if (input.right) gameObject.x += this.speed;

                    // Handle vertical movement
                    if (input.up) gameObject.y -= this.speed;
                    if (input.down) gameObject.y += this.speed;

                    // Handle jump
                    if (input.jump && this.canJump) {
                        const physics = gameObject.components.physics;
                        if (physics && this.isNearGround(gameObject)) {
                            physics.velocity.y = -this.jumpForce;
                        }
                    }
                }

                isNearGround(gameObject) {
                    const canvas = document.getElementById('game-canvas');
                    const bounds = canvas.getBoundingClientRect();
                    const radius = gameObject.radius || gameObject.size/2 || 20;
                    return gameObject.y + radius >= bounds.height - 10;
                }
            }`
        };

        // 添加事件监听器
        document.addEventListener('click', (e) => {
            if (e.target.closest('.code-edit-btn')) {
                const btn = e.target.closest('.code-edit-btn');
                const componentType = btn.dataset.component;
                let code;
                
                if (componentTemplates[componentType]) {
                    code = componentTemplates[componentType];
                } else if (selectedObject && selectedObject.components[componentType]) {
                    // 获取自定义脚本的代码
                    code = selectedObject.components[componentType].code;
                }
                
                if (code) {
                    createCodeEditor(componentType, code);
                }
            }
        });
    }

    // 修改 inspector 面板以接受脚本拖放
    function setupInspectorDropZone() {
        inspectorContent.addEventListener('dragover', (e) => {
            const data = e.dataTransfer.types.includes('application/script');
            if (data) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }
        });

        inspectorContent.addEventListener('drop', (e) => {
            e.preventDefault();
            const scriptData = e.dataTransfer.getData('application/script');
            if (scriptData && selectedObject) {
                const { name, code } = JSON.parse(scriptData);
                
                if (!selectedObject.components) {
                    selectedObject.components = {};
                }
                
                try {
                    // 将代码包装在一个立即执行的函数中，以创建一个新的作用域
                    const classDefinition = `
                        (function() {
                            ${code}
                            return ${name};
                        })()
                    `;
                    
                    // 执行代码并获取类定义
                    const ScriptClass = eval(classDefinition);
                    
                    // 创建类的新实例
                    const instance = new ScriptClass();
                    
                    // 添加组件
                    selectedObject.components[name.toLowerCase()] = {
                        ...instance,  // 这会复制所有实例属性
                        enabled: true,
                        code: code,
                        instance: instance  // 保存实例引用
                    };
                    
                    // 如果游戏正在运行，立即执行 start 方法
                    if (isRunning && instance.start) {
                        instance.start(selectedObject);
                    }
                    
                    renderInspector();
                } catch (error) {
                    console.error('Error creating script component:', error);
                    alert('Error creating script component: ' + error.message);
                }
            }
        });
    }

    // 在文档加载完成后初始化代码编辑器
    setupCodeEditor();
    setupInspectorDropZone();
});