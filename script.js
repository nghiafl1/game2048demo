// Game state với animation system
let gameState = {
    gridSize: 4,
    score: 0,
    best: localStorage.getItem('best2048') || 0,
    gameHistory: [],
    isVSMode: false,
    aiDifficulty: 'medium',
    timeLimit: 120,
    timeRemaining: 120,
    gameTimer: null,
    aiTimer: null,
    isAnimating: false,
    
    // Tile system với animation state
    tiles: [], // Mảng các tile objects
    nextTileId: 0,
    
    // Animation constants
    MOVE_DURATION: 150, // ms
    MERGE_DURATION: 150, // ms
    SPAWN_DURATION: 200, // ms
    
    // AI game state
    aiGame: null,
    aiTiles: [],
    aiNextTileId: 0,
    aiAnimationEngine: null
};

// Tile class với animation properties
class Tile {
    constructor(value, x, y, id) {
        this.id = id;
        this.value = value;
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.scale = 1.0;
        this.merging = false;
        this.isNew = true;
        this.mergedFrom = null;
        this.element = null;
    }
    
    clone() {
        const tile = new Tile(this.value, this.x, this.y, this.id);
        tile.targetX = this.targetX;
        tile.targetY = this.targetY;
        tile.scale = this.scale;
        tile.merging = this.merging;
        tile.isNew = false;
        return tile;
    }
}

// Animation engine
class AnimationEngine {
    constructor() {
        this.animations = [];
        this.running = false;
    }
    
    addAnimation(tile, property, from, to, duration, easing = 'easeOut') {
        this.animations.push({
            tile,
            property,
            from,
            to,
            duration,
            startTime: performance.now(),
            easing
        });
        
        if (!this.running) {
            this.running = true;
            this.animate();
        }
    }
    
    animate() {
        const now = performance.now();
        let hasActive = false;
        
        for (let i = this.animations.length - 1; i >= 0; i--) {
            const anim = this.animations[i];
            const elapsed = now - anim.startTime;
            const progress = Math.min(elapsed / anim.duration, 1);
            
            const easedProgress = this.ease(progress, anim.easing);
            const value = anim.from + (anim.to - anim.from) * easedProgress;
            
            anim.tile[anim.property] = value;
            
            if (progress >= 1) {
                this.animations.splice(i, 1);
            } else {
                hasActive = true;
            }
        }
        
        // Render based on which engine this is
        if (this === animationEngine) {
            renderTiles();
        } else if (this === aiAnimationEngine) {
            renderAITiles();
        }
        
        if (hasActive) {
            requestAnimationFrame(() => this.animate());
        } else {
            this.running = false;
            if (this === animationEngine) {
                gameState.isAnimating = false;
            }
        }
    }
    
    ease(t, type) {
        switch(type) {
            case 'easeOut':
                return 1 - Math.pow(1 - t, 3);
            case 'easeInOut':
                return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            default:
                return t;
        }
    }
    
    clear() {
        this.animations = [];
        this.running = false;
    }
}

const animationEngine = new AnimationEngine();
const aiAnimationEngine = new AnimationEngine();

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('best').textContent = gameState.best;
});

// Keyboard controls
document.addEventListener('keydown', handleKeyPress);

function handleKeyPress(e) {
    if (!document.querySelector('.game-screen').classList.contains('active')) return;
    if (gameState.isAnimating) return;
    
    let direction = null;
    
    switch(e.key) {
        case 'ArrowUp':
            e.preventDefault();
            direction = 'up';
            break;
        case 'ArrowDown':
            e.preventDefault();
            direction = 'down';
            break;
        case 'ArrowLeft':
            e.preventDefault();
            direction = 'left';
            break;
        case 'ArrowRight':
            e.preventDefault();
            direction = 'right';
            break;
    }
    
    if (direction) {
        makeMove(direction);
    }
}

// Navigation functions
function showMenu() {
    hideAllScreens();
    document.querySelector('.menu-screen').classList.add('active');
}

function showPlayOptions() {
    hideAllScreens();
    document.querySelector('.mode-select').classList.add('active');
}

function showSettings() {
    hideAllScreens();
    document.querySelector('.settings-screen').classList.add('active');
}

function showVSOptions() {
    hideAllScreens();
    document.querySelector('.vs-screen').classList.add('active');
}

function hideAllScreens() {
    document.querySelectorAll('.menu-screen, .settings-screen, .game-screen, .vs-screen, .mode-select').forEach(screen => {
        screen.classList.remove('active');
    });
}

// Settings
function saveSettings() {
    const selected = document.querySelector('input[name="gridSize"]:checked');
    gameState.gridSize = parseInt(selected.value);
    showInfoModal('Cài đặt đã lưu', 'Kích thước lưới: ' + gameState.gridSize + 'x' + gameState.gridSize, () => {
        showMenu();
    });
}

// Game initialization
function startSinglePlayer() {
    gameState.isVSMode = false;
    initGame();
    hideAllScreens();
    document.querySelector('.game-screen').classList.add('active');
    document.getElementById('singlePlayerGame').style.display = 'block';
    document.getElementById('vsGame').style.display = 'none';
    document.getElementById('gameTimer').style.display = 'none';
}

function startVSMode() {
    gameState.isVSMode = true;
    gameState.aiDifficulty = document.getElementById('difficulty').value;
    gameState.timeLimit = parseInt(document.getElementById('timeLimit').value);
    gameState.timeRemaining = gameState.timeLimit;
    // record start time for VS mode
    gameState.vsStartTime = Date.now();
    
    initGame();
    initAIGame();
    startTimer();
    
    hideAllScreens();
    document.querySelector('.game-screen').classList.add('active');
    document.getElementById('singlePlayerGame').style.display = 'none';
    document.getElementById('vsGame').style.display = 'block';
    document.getElementById('gameTimer').style.display = 'block';
}

function initGame() {
    gameState.tiles = [];
    gameState.nextTileId = 0;
    gameState.score = 0;
    gameState.gameHistory = [];
    gameState.isAnimating = false;
    animationEngine.clear();
    
    createGameBoard();
    
    // Add initial tiles
    addRandomTile();
    addRandomTile();
    
    renderTiles();
    updateScore();
}

function initAIGame() {
    gameState.aiGame = {
        score: 0
    };
    gameState.aiTiles = [];
    gameState.aiNextTileId = 0;
    aiAnimationEngine.clear();
    
    createAIBoard();
    
    // Add initial tiles
    addRandomTileAI();
    addRandomTileAI();
    
    renderAITiles();
    updateAIScore();
    
    // Start AI playing
    startAIPlayer();
}

function createGameBoard() {
    const board = document.getElementById(gameState.isVSMode ? 'humanBoard' : 'gameBoard');
    board.innerHTML = '';
    
    const size = gameState.gridSize;
    const cellSize = gameState.isVSMode ? 60 : 80;
    const tileSize = gameState.isVSMode ? 50 : 70;
    
    board.style.width = (size * cellSize + 20) + 'px';
    board.style.height = (size * cellSize + 20) + 'px';
    
    // Create grid cells
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.style.width = tileSize + 'px';
            cell.style.height = tileSize + 'px';
            cell.style.left = (j * cellSize + 10) + 'px';
            cell.style.top = (i * cellSize + 10) + 'px';
            board.appendChild(cell);
        }
    }
}

function createAIBoard() {
    const board = document.getElementById('aiBoard');
    board.innerHTML = '';
    
    const size = gameState.gridSize;
    const cellSize = 60;
    const tileSize = 50;
    
    board.style.width = (size * cellSize + 20) + 'px';
    board.style.height = (size * cellSize + 20) + 'px';
    
    // Create grid cells for AI
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.style.width = tileSize + 'px';
            cell.style.height = tileSize + 'px';
            cell.style.left = (j * cellSize + 10) + 'px';
            cell.style.top = (i * cellSize + 10) + 'px';
            board.appendChild(cell);
        }
    }
}

function addRandomTile() {
    const emptyCells = [];
    const grid = tilesToGrid();
    
    for (let i = 0; i < gameState.gridSize; i++) {
        for (let j = 0; j < gameState.gridSize; j++) {
            if (grid[i][j] === 0) {
                emptyCells.push({x: j, y: i});
            }
        }
    }
    
    if (emptyCells.length > 0) {
        const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const value = Math.random() < 0.9 ? 2 : 4;
        const tile = new Tile(value, randomCell.x, randomCell.y, gameState.nextTileId++);
        tile.scale = 0;
        gameState.tiles.push(tile);
        
        // Animate spawn
        animationEngine.addAnimation(tile, 'scale', 0, 1, gameState.SPAWN_DURATION, 'easeOut');
    }
}

function addRandomTileAI() {
    const emptyCells = [];
    const grid = aiTilesToGrid();
    
    for (let i = 0; i < gameState.gridSize; i++) {
        for (let j = 0; j < gameState.gridSize; j++) {
            if (grid[i][j] === 0) {
                emptyCells.push({x: j, y: i});
            }
        }
    }
    
    if (emptyCells.length > 0) {
        const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const value = Math.random() < 0.9 ? 2 : 4;
        const tile = new Tile(value, randomCell.x, randomCell.y, gameState.aiNextTileId++);
        tile.scale = 0;
        gameState.aiTiles.push(tile);
        
        // Animate spawn
        aiAnimationEngine.addAnimation(tile, 'scale', 0, 1, gameState.SPAWN_DURATION, 'easeOut');
    }
}

function aiTilesToGrid() {
    const grid = [];
    for (let i = 0; i < gameState.gridSize; i++) {
        grid[i] = new Array(gameState.gridSize).fill(0);
    }
    
    for (const tile of gameState.aiTiles) {
        if (!tile.merging) {
            grid[tile.targetY][tile.targetX] = tile.value;
        }
    }
    
    return grid;
}

function renderAITiles() {
    const board = document.getElementById('aiBoard');
    const cellSize = 60;
    const tileSize = 50;
    const fontSize = tileSize * 0.4;
    
    // Remove old tile elements
    const oldTiles = board.querySelectorAll('.tile');
    oldTiles.forEach(el => {
        const tile = gameState.aiTiles.find(t => t.element === el);
        if (!tile) {
            el.remove();
        }
    });
    
    // Update or create tile elements
    for (const tile of gameState.aiTiles) {
        if (!tile.element) {
            tile.element = document.createElement('div');
            tile.element.className = `tile tile-${tile.value}`;
            board.appendChild(tile.element);
        }
        
        const element = tile.element;
        element.className = `tile tile-${tile.value}`;
        element.textContent = tile.value;
        element.style.width = tileSize + 'px';
        element.style.height = tileSize + 'px';
        element.style.fontSize = (tile.value > 512 ? fontSize * 0.8 : fontSize) + 'px';
        element.style.left = (tile.x * cellSize + 10) + 'px';
        element.style.top = (tile.y * cellSize + 10) + 'px';
        element.style.transform = `scale(${tile.scale})`;
    }
}

function updateAIScore() {
    document.getElementById('aiScore').textContent = gameState.aiGame.score;
}

function tilesToGrid() {
    const grid = [];
    for (let i = 0; i < gameState.gridSize; i++) {
        grid[i] = new Array(gameState.gridSize).fill(0);
    }
    
    for (const tile of gameState.tiles) {
        if (!tile.merging) {
            grid[tile.targetY][tile.targetX] = tile.value;
        }
    }
    
    return grid;
}

function makeMove(direction) {
    if (gameState.isAnimating) return;
    
    saveGameState();
    
    const oldTiles = gameState.tiles.map(t => t.clone());
    const moved = processMove(direction);
    
    if (!moved) {
        return;
    }

    // Clear any existing hint when the player makes a real move
    const hintEl = document.getElementById('hintDisplay');
    if (hintEl) hintEl.textContent = '';
    
    gameState.isAnimating = true;
    
    // Animate movement
    for (const tile of gameState.tiles) {
        if (tile.x !== tile.targetX) {
            animationEngine.addAnimation(tile, 'x', tile.x, tile.targetX, gameState.MOVE_DURATION, 'easeOut');
            tile.x = tile.targetX;
        }
        if (tile.y !== tile.targetY) {
            animationEngine.addAnimation(tile, 'y', tile.y, tile.targetY, gameState.MOVE_DURATION, 'easeOut');
            tile.y = tile.targetY;
        }
        
        if (tile.merging) {
            animationEngine.addAnimation(tile, 'scale', 1, 1.2, gameState.MERGE_DURATION / 2, 'easeOut');
            setTimeout(() => {
                animationEngine.addAnimation(tile, 'scale', 1.2, 1, gameState.MERGE_DURATION / 2, 'easeOut');
            }, gameState.MERGE_DURATION / 2);
        }
    }
    
    // Add new tile after animations
    setTimeout(() => {
        // Remove merged tiles
        gameState.tiles = gameState.tiles.filter(t => !t.merging || t.mergedFrom);
        gameState.tiles.forEach(t => {
            t.merging = false;
            t.isNew = false;
        });
        
        addRandomTile();
        updateScore();
        checkGameOver();
    }, gameState.MOVE_DURATION + 50);
}

function processMove(direction) {
    const size = gameState.gridSize;
    let moved = false;

    // Build a local grid of tile references
    const grid = [];
    for (let i = 0; i < size; i++) {
        grid[i] = new Array(size).fill(null);
    }
    for (const tile of gameState.tiles) {
        grid[tile.y][tile.x] = tile;
    }

    const vectors = {
        'up': {x: 0, y: -1},
        'down': {x: 0, y: 1},
        'left': {x: -1, y: 0},
        'right': {x: 1, y: 0}
    };

    const vector = vectors[direction];
    const traversals = buildTraversals(vector);

    const tilesToRemove = [];
    const tilesToAdd = [];

    // Traverse in order and update local grid as we move/merge tiles
    for (const y of traversals.y) {
        for (const x of traversals.x) {
            const tile = grid[y][x];
            if (!tile) continue;

            // Find farthest available position
            let posX = x;
            let posY = y;
            let nextX = posX + vector.x;
            let nextY = posY + vector.y;

            while (withinBounds(nextX, nextY) && !grid[nextY][nextX]) {
                posX = nextX;
                posY = nextY;
                nextX = posX + vector.x;
                nextY = posY + vector.y;
            }

            // If next cell has a tile with same value and it's not already merging, merge
            if (withinBounds(nextX, nextY) && grid[nextY][nextX] && grid[nextY][nextX].value === tile.value && !grid[nextY][nextX].merging) {
                const other = grid[nextY][nextX];
                const merged = new Tile(tile.value * 2, nextX, nextY, gameState.nextTileId++);
                // Start animation from the moving tile's current position
                merged.x = tile.x;
                merged.y = tile.y;
                merged.targetX = nextX;
                merged.targetY = nextY;
                merged.merging = true;
                merged.mergedFrom = [tile, other];

                grid[y][x] = null;
                grid[nextY][nextX] = merged;
                tilesToAdd.push(merged);
                tilesToRemove.push(tile);
                tilesToRemove.push(other);
                gameState.score += merged.value;
                moved = true;
            } else {
                // Move tile to farthest position
                if (posX !== x || posY !== y) {
                    tile.targetX = posX;
                    tile.targetY = posY;
                    grid[posY][posX] = tile;
                    grid[y][x] = null;
                    moved = true;
                } else {
                    // stays in place
                }
            }
        }
    }

    // Add merged tiles to gameState.tiles and remove merged-from tiles
    for (const m of tilesToAdd) {
        gameState.tiles.push(m);
    }
    for (const t of tilesToRemove) {
        const index = gameState.tiles.indexOf(t);
        if (index > -1) gameState.tiles.splice(index, 1);
    }

    return moved;
}

function buildTraversals(vector) {
    const traversals = {x: [], y: []};
    
    for (let pos = 0; pos < gameState.gridSize; pos++) {
        traversals.x.push(pos);
        traversals.y.push(pos);
    }
    
    if (vector.x === 1) traversals.x = traversals.x.reverse();
    if (vector.y === 1) traversals.y = traversals.y.reverse();
    
    return traversals;
}

function findTileAt(x, y) {
    for (const tile of gameState.tiles) {
        if (tile.x === x && tile.y === y) {
            return tile;
        }
    }
    return null;
}

function findFarthestPosition(x, y, vector) {
    let previous;
    
    do {
        previous = {x, y};
        x = previous.x + vector.x;
        y = previous.y + vector.y;
    } while (withinBounds(x, y) && !findTileAt(x, y));
    
    return {
        farthest: previous,
        next: {x, y}
    };
}

function withinBounds(x, y) {
    return x >= 0 && x < gameState.gridSize && y >= 0 && y < gameState.gridSize;
}

function renderTiles() {
    const board = document.getElementById(gameState.isVSMode ? 'humanBoard' : 'gameBoard');
    const cellSize = gameState.isVSMode ? 60 : 80;
    const tileSize = gameState.isVSMode ? 50 : 70;
    const fontSize = gameState.isVSMode ? (tileSize * 0.4) : (tileSize * 0.35);
    
    // Remove old tile elements
    const oldTiles = board.querySelectorAll('.tile');
    oldTiles.forEach(el => {
        const tile = gameState.tiles.find(t => t.element === el);
        if (!tile) {
            el.remove();
        }
    });
    
    // Update or create tile elements
    for (const tile of gameState.tiles) {
        if (!tile.element) {
            tile.element = document.createElement('div');
            tile.element.className = `tile tile-${tile.value}`;
            board.appendChild(tile.element);
        }
        
        const element = tile.element;
        element.className = `tile tile-${tile.value}`;
        element.textContent = tile.value;
        element.style.width = tileSize + 'px';
        element.style.height = tileSize + 'px';
        element.style.fontSize = (tile.value > 512 ? fontSize * 0.8 : fontSize) + 'px';
        element.style.left = (tile.x * cellSize + 10) + 'px';
        element.style.top = (tile.y * cellSize + 10) + 'px';
        element.style.transform = `scale(${tile.scale})`;
    }
}

function updateScore() {
    const scoreElement = document.getElementById(gameState.isVSMode ? 'humanScore' : 'score');
    scoreElement.textContent = gameState.score;
    
    if (gameState.score > gameState.best && !gameState.isVSMode) {
        gameState.best = gameState.score;
        localStorage.setItem('best2048', gameState.best);
        document.getElementById('best').textContent = gameState.best;
    }
}

function saveGameState() {
    const state = {
        tiles: gameState.tiles.map(t => ({
            value: t.value,
            x: t.x,
            y: t.y,
            id: t.id
        })),
        score: gameState.score,
        nextTileId: gameState.nextTileId
    };
    gameState.gameHistory.push(state);
    
    if (gameState.gameHistory.length > 10) {
        gameState.gameHistory.shift();
    }
}

function undoMove() {
    if (gameState.isAnimating) return;
    if (gameState.gameHistory.length === 0) {
        showInfoModal('Không thể undo', 'Không thể undo thêm!');
        return;
    }
    
    const previousState = gameState.gameHistory.pop();
    gameState.score = previousState.score;
    gameState.nextTileId = previousState.nextTileId;
    
    // Clear current tiles
    gameState.tiles.forEach(t => {
        if (t.element) {
            t.element.remove();
        }
    });
    
    // Restore tiles
    gameState.tiles = previousState.tiles.map(t => {
        const tile = new Tile(t.value, t.x, t.y, t.id);
        tile.isNew = false;
        return tile;
    });
    
    renderTiles();
    updateScore();
}

function getHint() {
    const directions = ['up', 'down', 'left', 'right'];
    let bestMove = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const direction of directions) {
        const score = evaluateMoveExpectimax(direction);
        if (score > bestScore) {
            bestScore = score;
            bestMove = direction;
        }
    }
    
    if (bestMove) {
        const directionText = {
            'up': 'LÊN',
            'down': 'XUỐNG',
            'left': 'TRÁI',
            'right': 'PHẢI'
        };
        // Show hint and keep it visible until the player actually makes a move
        document.getElementById('hintDisplay').textContent = 
            `Gợi ý: Thử di chuyển ${directionText[bestMove]}`;
    }
}

function evaluateMove(direction) {
    // Save current state
    const savedTiles = gameState.tiles.map(t => t.clone());
    const savedScore = gameState.score;
    
    // Try move
    const moved = processMove(direction);
    
    // If move didn't change the board, mark it as invalid so hint won't suggest it
    if (!moved) {
        return Number.NEGATIVE_INFINITY;
    }

    let score = 0;
    score += gameState.score - savedScore;

    const grid = tilesToGrid();
    const emptyCells = countEmptyCells(grid);
    score += emptyCells * 10;

    score += calculateMonotonicity(grid) * 5;
    score += calculateSmoothness(grid) * 3;
    
    // Restore state and re-render tiles so DOM shows the original numbers again
    gameState.tiles.forEach(t => {
        if (t.element) {
            t.element.remove();
        }
    });
    gameState.tiles = savedTiles;
    gameState.score = savedScore;
    // Recreate DOM elements for restored tiles
    renderTiles();
    
    return score;
}

function countEmptyCells(grid) {
    let count = 0;
    for (let i = 0; i < gameState.gridSize; i++) {
        for (let j = 0; j < gameState.gridSize; j++) {
            if (grid[i][j] === 0) count++;
        }
    }
    return count;
}

function calculateMonotonicity(grid) {
    let monotonicity = 0;
    
    for (let i = 0; i < gameState.gridSize; i++) {
        let increasing = 0;
        let decreasing = 0;
        for (let j = 1; j < gameState.gridSize; j++) {
            if (grid[i][j] > grid[i][j-1]) increasing++;
            if (grid[i][j] < grid[i][j-1]) decreasing++;
        }
        monotonicity += Math.max(increasing, decreasing);
    }
    
    for (let j = 0; j < gameState.gridSize; j++) {
        let increasing = 0;
        let decreasing = 0;
        for (let i = 1; i < gameState.gridSize; i++) {
            if (grid[i][j] > grid[i-1][j]) increasing++;
            if (grid[i][j] < grid[i-1][j]) decreasing++;
        }
        monotonicity += Math.max(increasing, decreasing);
    }
    
    return monotonicity;
}

function calculateSmoothness(grid) {
    let smoothness = 0;
    
    for (let i = 0; i < gameState.gridSize; i++) {
        for (let j = 0; j < gameState.gridSize; j++) {
            if (grid[i][j] !== 0) {
                if (j < gameState.gridSize - 1 && grid[i][j+1] !== 0) {
                    smoothness -= Math.abs(Math.log2(grid[i][j]) - Math.log2(grid[i][j+1]));
                }
                if (i < gameState.gridSize - 1 && grid[i+1][j] !== 0) {
                    smoothness -= Math.abs(Math.log2(grid[i][j]) - Math.log2(grid[i+1][j]));
                }
            }
        }
    }
    
    return smoothness;
}

// --- Grid-based move simulation and expectimax-like evaluator ---
function applyMoveToGrid(grid, direction) {
    const size = gameState.gridSize;
    // deep copy
    const newGrid = grid.map(row => row.slice());
    let moved = false;
    let scoreGain = 0;

    function operateLine(line) {
        const arr = line.filter(v => v !== 0);
        const result = [];
        let i = 0;
        while (i < arr.length) {
            if (i + 1 < arr.length && arr[i] === arr[i + 1]) {
                const merged = arr[i] * 2;
                result.push(merged);
                scoreGain += merged;
                i += 2;
            } else {
                result.push(arr[i]);
                i += 1;
            }
        }
        while (result.length < size) result.push(0);
        return result;
    }

    if (direction === 'left' || direction === 'right') {
        for (let r = 0; r < size; r++) {
            let line = newGrid[r].slice();
            if (direction === 'right') line = line.reverse();
            const newLine = operateLine(line);
            if (direction === 'right') newLine.reverse();
            for (let c = 0; c < size; c++) {
                if (newGrid[r][c] !== newLine[c]) moved = true;
                newGrid[r][c] = newLine[c];
            }
        }
    } else {
        // up or down operate on columns
        for (let c = 0; c < size; c++) {
            let col = [];
            for (let r = 0; r < size; r++) col.push(newGrid[r][c]);
            if (direction === 'down') col = col.reverse();
            const newCol = operateLine(col);
            if (direction === 'down') newCol.reverse();
            for (let r = 0; r < size; r++) {
                if (newGrid[r][c] !== newCol[r]) moved = true;
                newGrid[r][c] = newCol[r];
            }
        }
    }

    return {grid: newGrid, moved, scoreGain};
}

function evaluateGridHeuristic(grid, scoreGain = 0) {
    // Heuristic combining empties, monotonicity and smoothness plus score gain
    const empties = countEmptyCells(grid);
    const mono = calculateMonotonicity(grid);
    const smooth = calculateSmoothness(grid);
    // weights tuned for reasonable behavior
    return scoreGain * 1.0 + empties * 150 + mono * 10 + smooth * 8;
}

function evaluateMoveExpectimax(direction) {
    const baseGrid = tilesToGrid();

    const first = applyMoveToGrid(baseGrid, direction);
    if (!first.moved) return Number.NEGATIVE_INFINITY;

    const afterGrid = first.grid;
    const immediateScore = evaluateGridHeuristic(afterGrid, first.scoreGain);

    // get empty cells
    const empties = [];
    for (let i = 0; i < gameState.gridSize; i++) {
        for (let j = 0; j < gameState.gridSize; j++) {
            if (afterGrid[i][j] === 0) empties.push({i, j});
        }
    }

    if (empties.length === 0) {
        return immediateScore;
    }

    // To limit cost, sample if too many empties
    const sample = empties.length > 8 ? shuffleArray(empties).slice(0, 8) : empties;

    let expected = 0;
    for (const cell of sample) {
        // 2 with prob 0.9, 4 with prob 0.1
        const candidates = [{v:2,p:0.9},{v:4,p:0.1}];
        let cellExpected = 0;
        for (const cand of candidates) {
            const g = afterGrid.map(row => row.slice());
            g[cell.i][cell.j] = cand.v;

            // now evaluate best subsequent move (one ply)
            let bestNext = Number.NEGATIVE_INFINITY;
            const dirs = ['up','down','left','right'];
            for (const d of dirs) {
                const res = applyMoveToGrid(g, d);
                if (!res.moved) continue;
                const val = evaluateGridHeuristic(res.grid, res.scoreGain);
                if (val > bestNext) bestNext = val;
            }
            // if no valid next move, evaluate current grid
            if (bestNext === Number.NEGATIVE_INFINITY) bestNext = evaluateGridHeuristic(g, 0);

            cellExpected += cand.p * bestNext;
        }
        expected += cellExpected;
    }

    // average over sampled empty positions
    expected = expected / sample.length;

    // combine immediate heuristic and expected future (give some weight to immediate)
    return immediateScore * 0.6 + expected * 0.4;
}

// small helper
function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// AI-specific expectimax evaluator (operates on AI grid) with a small cache and stronger sampling for hard difficulty
const expectimaxAICache = new Map();

function gridToKey(grid) {
    return grid.map(r => r.join(',')).join(';');
}

function evaluateMoveExpectimaxAI(direction) {
    const baseGrid = aiTilesToGrid();

    const cacheKey = gridToKey(baseGrid) + '|' + direction + '|' + gameState.aiDifficulty;
    if (expectimaxAICache.has(cacheKey)) return expectimaxAICache.get(cacheKey);

    const first = applyMoveToGrid(baseGrid, direction);
    if (!first.moved) return Number.NEGATIVE_INFINITY;

    const afterGrid = first.grid;
    const immediateScore = evaluateGridHeuristic(afterGrid, first.scoreGain);

    // get empty cells
    const empties = [];
    for (let i = 0; i < gameState.gridSize; i++) {
        for (let j = 0; j < gameState.gridSize; j++) {
            if (afterGrid[i][j] === 0) empties.push({i, j});
        }
    }

    if (empties.length === 0) {
        expectimaxAICache.set(cacheKey, immediateScore);
        return immediateScore;
    }

    // sample size depends on difficulty: hard samples more positions for deeper look
    let sampleCap = 8;
    if (gameState.aiDifficulty === 'hard') sampleCap = 12;
    const sample = empties.length > sampleCap ? shuffleArray(empties).slice(0, sampleCap) : empties;

    let expected = 0;
    for (const cell of sample) {
        const candidates = [{v:2,p:0.9},{v:4,p:0.1}];
        let cellExpected = 0;
        for (const cand of candidates) {
            const g = afterGrid.map(row => row.slice());
            g[cell.i][cell.j] = cand.v;

            let bestNext = Number.NEGATIVE_INFINITY;
            const dirs = ['up','down','left','right'];
            for (const d of dirs) {
                const res = applyMoveToGrid(g, d);
                if (!res.moved) continue;
                const val = evaluateGridHeuristic(res.grid, res.scoreGain);
                if (val > bestNext) bestNext = val;
            }
            if (bestNext === Number.NEGATIVE_INFINITY) bestNext = evaluateGridHeuristic(g, 0);

            cellExpected += cand.p * bestNext;
        }
        expected += cellExpected;
    }

    expected = expected / sample.length;
    const result = immediateScore * 0.6 + expected * 0.4;
    // cache moderately
    expectimaxAICache.set(cacheKey, result);
    if (expectimaxAICache.size > 2000) {
        const it = expectimaxAICache.keys();
        expectimaxAICache.delete(it.next().value);
    }
    return result;
}

function checkGameOver() {
    const grid = tilesToGrid();
    
    // Check for empty cells
    for (let i = 0; i < gameState.gridSize; i++) {
        for (let j = 0; j < gameState.gridSize; j++) {
            if (grid[i][j] === 0) return false;
        }
    }
    
    // Check for possible merges
    for (let i = 0; i < gameState.gridSize; i++) {
        for (let j = 0; j < gameState.gridSize; j++) {
            const current = grid[i][j];
            if (j < gameState.gridSize - 1 && grid[i][j + 1] === current) return false;
            if (i < gameState.gridSize - 1 && grid[i + 1][j] === current) return false;
        }
    }
    
    showInfoModal('Game Over', 'Điểm cuối cùng: ' + gameState.score);
    return true;
}

function restartGame() {
    showConfirmModal('Bạn có chắc muốn chơi lại?', () => {
        initGame();
    });
}

function startAIPlayer() {
    const aiSpeed = {
        easy: 1000,
        medium: 750,
        hard: 500
    };
    
    gameState.aiTimer = setInterval(() => {
        makeAIMoveAnimated();
    }, aiSpeed[gameState.aiDifficulty]);
}

function makeAIMoveAnimated() {
    const directions = ['up', 'down', 'left', 'right'];
    let bestMove = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const direction of directions) {
        let score;
        if (gameState.aiDifficulty === 'hard') {
            // stronger expectimax-like evaluator for hard mode using AI grid
            score = evaluateMoveExpectimaxAI(direction);
        } else {
            // medium and easy still use evaluateMoveAI (which contains some randomness)
            score = evaluateMoveAI(direction);
        }

        // small tie-breaker randomness to avoid deterministic loops
        if (score !== Number.NEGATIVE_INFINITY) score += Math.random() * 0.0001;

        if (score > bestScore) {
            bestScore = score;
            bestMove = direction;
        }
    }
    
    if (bestMove) {
        processAIMove(bestMove);
    }
}

function processAIMove(direction) {
    const size = gameState.gridSize;
    let moved = false;

    // Build local grid
    const grid = [];
    for (let i = 0; i < size; i++) grid[i] = new Array(size).fill(null);
    for (const tile of gameState.aiTiles) grid[tile.y][tile.x] = tile;

    const vectors = {
        'up': {x: 0, y: -1},
        'down': {x: 0, y: 1},
        'left': {x: -1, y: 0},
        'right': {x: 1, y: 0}
    };
    const vector = vectors[direction];
    const traversals = buildTraversals(vector);

    const tilesToRemove = [];
    const tilesToAdd = [];

    for (const y of traversals.y) {
        for (const x of traversals.x) {
            const tile = grid[y][x];
            if (!tile) continue;

            let posX = x;
            let posY = y;
            let nextX = posX + vector.x;
            let nextY = posY + vector.y;

            while (withinBounds(nextX, nextY) && !grid[nextY][nextX]) {
                posX = nextX;
                posY = nextY;
                nextX = posX + vector.x;
                nextY = posY + vector.y;
            }

            if (withinBounds(nextX, nextY) && grid[nextY][nextX] && grid[nextY][nextX].value === tile.value && !grid[nextY][nextX].merging) {
                const other = grid[nextY][nextX];
                const merged = new Tile(tile.value * 2, nextX, nextY, gameState.aiNextTileId++);
                merged.x = tile.x;
                merged.y = tile.y;
                merged.targetX = nextX;
                merged.targetY = nextY;
                merged.merging = true;
                merged.mergedFrom = [tile, other];

                grid[y][x] = null;
                grid[nextY][nextX] = merged;
                tilesToAdd.push(merged);
                tilesToRemove.push(tile);
                tilesToRemove.push(other);
                gameState.aiGame.score += merged.value;
                moved = true;
            } else {
                if (posX !== x || posY !== y) {
                    tile.targetX = posX;
                    tile.targetY = posY;
                    grid[posY][posX] = tile;
                    grid[y][x] = null;
                    moved = true;
                }
            }
        }
    }

    for (const m of tilesToAdd) gameState.aiTiles.push(m);
    for (const t of tilesToRemove) {
        const index = gameState.aiTiles.indexOf(t);
        if (index > -1) gameState.aiTiles.splice(index, 1);
    }

    if (!moved) return;

    for (const tile of gameState.aiTiles) {
        if (tile.x !== tile.targetX) {
            aiAnimationEngine.addAnimation(tile, 'x', tile.x, tile.targetX, gameState.MOVE_DURATION, 'easeOut');
            tile.x = tile.targetX;
        }
        if (tile.y !== tile.targetY) {
            aiAnimationEngine.addAnimation(tile, 'y', tile.y, tile.targetY, gameState.MOVE_DURATION, 'easeOut');
            tile.y = tile.targetY;
        }

        if (tile.merging) {
            aiAnimationEngine.addAnimation(tile, 'scale', 1, 1.2, gameState.MERGE_DURATION / 2, 'easeOut');
            setTimeout(() => {
                aiAnimationEngine.addAnimation(tile, 'scale', 1.2, 1, gameState.MERGE_DURATION / 2, 'easeOut');
            }, gameState.MERGE_DURATION / 2);
        }
    }

    setTimeout(() => {
        gameState.aiTiles = gameState.aiTiles.filter(t => !t.merging || t.mergedFrom);
        gameState.aiTiles.forEach(t => {
            t.merging = false;
            t.isNew = false;
        });

        addRandomTileAI();
        updateAIScore();
    }, gameState.MOVE_DURATION + 50);
}

function findAITileAt(x, y) {
    for (const tile of gameState.aiTiles) {
        if (tile.x === x && tile.y === y) {
            return tile;
        }
    }
    return null;
}

function findFarthestPositionAI(x, y, vector) {
    let previous;
    
    do {
        previous = {x, y};
        x = previous.x + vector.x;
        y = previous.y + vector.y;
    } while (withinBounds(x, y) && !findAITileAt(x, y));
    
    return {
        farthest: previous,
        next: {x, y}
    };
}

function evaluateMoveAI(direction) {
    const savedTiles = gameState.aiTiles.map(t => t.clone());
    const savedScore = gameState.aiGame.score;
    
    const moved = testProcessAIMove(direction);
    
    // If AI move doesn't change the board, treat as invalid
    if (!moved) {
        return Number.NEGATIVE_INFINITY;
    }

    let score = 0;
    score += gameState.aiGame.score - savedScore;

    const grid = aiTilesToGrid();
    const emptyCells = countEmptyCells(grid);
    if (gameState.aiDifficulty === 'hard') {
        score += emptyCells * 200;
        score += calculateMonotonicity(grid) * 25;
        score += calculateSmoothness(grid) * 10;
    } else {
        score += emptyCells * 10;
        score += calculateMonotonicity(grid) * 5;

        if (gameState.aiDifficulty === 'easy') {
            score += Math.random() * 100;
        } else if (gameState.aiDifficulty === 'medium') {
            score += Math.random() * 50;
        }
    }
    
    // Restore AI tiles and re-render to avoid disappearing numbers after simulation
    gameState.aiTiles.forEach(t => {
        if (t.element) {
            t.element.remove();
        }
    });
    gameState.aiTiles = savedTiles;
    gameState.aiGame.score = savedScore;
    renderAITiles();
    
    return score;
}

function testProcessAIMove(direction) {
    const size = gameState.gridSize;
    let moved = false;

    const grid = [];
    for (let i = 0; i < size; i++) grid[i] = new Array(size).fill(null);
    for (const tile of gameState.aiTiles) grid[tile.y][tile.x] = tile;

    const vectors = {
        'up': {x: 0, y: -1},
        'down': {x: 0, y: 1},
        'left': {x: -1, y: 0},
        'right': {x: 1, y: 0}
    };
    const vector = vectors[direction];
    const traversals = buildTraversals(vector);

    const tilesToRemove = [];
    const tilesToAdd = [];

    for (const y of traversals.y) {
        for (const x of traversals.x) {
            const tile = grid[y][x];
            if (!tile) continue;

            let posX = x;
            let posY = y;
            let nextX = posX + vector.x;
            let nextY = posY + vector.y;

            while (withinBounds(nextX, nextY) && !grid[nextY][nextX]) {
                posX = nextX;
                posY = nextY;
                nextX = posX + vector.x;
                nextY = posY + vector.y;
            }

            if (withinBounds(nextX, nextY) && grid[nextY][nextX] && grid[nextY][nextX].value === tile.value && !grid[nextY][nextX].merging) {
                const other = grid[nextY][nextX];
                const merged = new Tile(tile.value * 2, nextX, nextY, gameState.aiNextTileId++);
                merged.merging = true;

                grid[y][x] = null;
                grid[nextY][nextX] = merged;
                tilesToAdd.push(merged);
                tilesToRemove.push(tile);
                tilesToRemove.push(other);
                gameState.aiGame.score += merged.value;
                moved = true;
            } else {
                if (posX !== x || posY !== y) {
                    tile.targetX = posX;
                    tile.targetY = posY;
                    tile.x = tile.targetX;
                    tile.y = tile.targetY;
                    grid[posY][posX] = tile;
                    grid[y][x] = null;
                    moved = true;
                }
            }
        }
    }

    for (const m of tilesToAdd) gameState.aiTiles.push(m);
    for (const t of tilesToRemove) {
        const index = gameState.aiTiles.indexOf(t);
        if (index > -1) gameState.aiTiles.splice(index, 1);
    }

    return moved;
}

function startTimer() {
    updateTimerDisplay();
    gameState.gameTimer = setInterval(() => {
        gameState.timeRemaining--;
        updateTimerDisplay();
        
        if (gameState.timeRemaining <= 0) {
            endGame();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(gameState.timeRemaining / 60);
    const seconds = gameState.timeRemaining % 60;
    document.getElementById('gameTimer').textContent = 
        `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function endGame(customTitle = null) {
    if (gameState.gameTimer) {
        clearInterval(gameState.gameTimer);
        gameState.gameTimer = null;
    }
    
    if (gameState.aiTimer) {
        clearInterval(gameState.aiTimer);
        gameState.aiTimer = null;
    }
    
    if (gameState.isVSMode) {
        let winner = ''; 
        if (customTitle) {
            winner = customTitle;
        } else {
            // Còn không thì mới so sánh điểm
            if (gameState.score > gameState.aiGame.score) {
                winner = 'BẠN THẮNG!';
            } else if (gameState.aiGame.score > gameState.score) {
                winner = 'MÁY THẮNG!';
            } else {
                winner = 'HÒA!';
            }
        }
        // calculate played time (fallback to timeLimit - timeRemaining if vsStartTime missing)
        let playedSeconds = 0;
        if (gameState.vsStartTime) {
            playedSeconds = Math.max(0, Math.floor((Date.now() - gameState.vsStartTime) / 1000));
        } else if (typeof gameState.timeLimit === 'number') {
            playedSeconds = Math.max(0, gameState.timeLimit - gameState.timeRemaining);
        }
        const minutes = Math.floor(playedSeconds / 60);
        const seconds = playedSeconds % 60;

        document.getElementById('winnerText').innerHTML = 
            `<div style="font-size: 32px; margin-bottom: 15px;">${winner}</div>` +
            `<div style="font-size: 20px;">Điểm của bạn: ${gameState.score}</div>` +
            `<div style="font-size: 20px;">Điểm của máy: ${gameState.aiGame.score}</div>` +
            `<div style="font-size: 18px; margin-top:12px; color: #ffd;">Thời gian chơi: ${minutes}:${seconds.toString().padStart(2,'0')}</div>`;
        document.getElementById('winnerAnnouncement').style.display = 'block';
    }
}

function endVSMode() {
    // Show custom confirmation modal
    const overlay = document.getElementById('confirmOverlay');
    overlay.style.display = 'flex';

    const cancelBtn = document.getElementById('confirmCancel');
    const endBtn = document.getElementById('confirmEnd');

    function cleanupHandlers() {
        cancelBtn.removeEventListener('click', onCancel);
        endBtn.removeEventListener('click', onEnd);
    }

    function onCancel() {
        overlay.style.display = 'none';
        cleanupHandlers();
    }

    function onEnd() {
        overlay.style.display = 'none';
        // stop timers and show end-game summary
        if (gameState.gameTimer) {
            clearInterval(gameState.gameTimer);
            gameState.gameTimer = null;
        }
        if (gameState.aiTimer) {
            clearInterval(gameState.aiTimer);
            gameState.aiTimer = null;
        }
        cleanupHandlers();
        endGame('Kết thúc!');
    }

    cancelBtn.addEventListener('click', onCancel);
    endBtn.addEventListener('click', onEnd);
}

function hideWinner() {
    document.getElementById('winnerAnnouncement').style.display = 'none';
    showPlayOptions();
}

// Modal helpers
function showInfoModal(title, message, onClose) {
    const overlay = document.getElementById('infoOverlay');
    const titleEl = document.getElementById('infoTitle');
    const bodyEl = document.getElementById('infoBody');
    const okBtn = document.getElementById('infoOk');

    titleEl.textContent = title || '';
    bodyEl.textContent = message || '';
    overlay.style.display = 'flex';

    function cleanup() {
        okBtn.removeEventListener('click', onOk);
    }

    function onOk() {
        overlay.style.display = 'none';
        cleanup();
        if (typeof onClose === 'function') onClose();
    }

    okBtn.addEventListener('click', onOk);
}

function showConfirmModal(message, onConfirm, onCancel) {
    const overlay = document.getElementById('confirmOverlay');
    overlay.style.display = 'flex';

    const cancelBtn = document.getElementById('confirmCancel');
    const endBtn = document.getElementById('confirmEnd');

    function cleanupHandlers() {
        cancelBtn.removeEventListener('click', onCancelInternal);
        endBtn.removeEventListener('click', onConfirmInternal);
    }

    function onCancelInternal() {
        overlay.style.display = 'none';
        cleanupHandlers();
        if (typeof onCancel === 'function') onCancel();
    }

    function onConfirmInternal() {
        overlay.style.display = 'none';
        cleanupHandlers();
        if (typeof onConfirm === 'function') onConfirm();
    }

    cancelBtn.addEventListener('click', onCancelInternal);
    endBtn.addEventListener('click', onConfirmInternal);
}

let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});

document.addEventListener('touchend', function(e) {
    if (!document.querySelector('.game-screen').classList.contains('active')) return;
    if (gameState.isAnimating) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;
    
    const minSwipeDistance = 50;
    
    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (Math.abs(diffX) > minSwipeDistance) {
            if (diffX > 0) {
                makeMove('left');
            } else {
                makeMove('right');
            }
        }
    } else {
        if (Math.abs(diffY) > minSwipeDistance) {
            if (diffY > 0) {
                makeMove('up');
            } else {
                makeMove('down');
            }
        }
    }
});