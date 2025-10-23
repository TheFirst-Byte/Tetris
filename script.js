document.addEventListener("DOMContentLoaded", () => {
    const startButton = document.getElementById("start-button");
    const pauseButton = document.getElementById("pause-button");
    const restartButton = document.getElementById("restart-button");
    const startScreen = document.getElementById("start-screen");
    const gameScreen = document.getElementById("game-screen");
    const gameOverScreen = document.getElementById("game-over-screen");
    const scoreDisplay = document.getElementById("score");
    const levelDisplay = document.getElementById("level");
    const finalScoreDisplay = document.getElementById("final-score");
    const gameOverOverlay = document.getElementById('game-over-overlay');
    const finalScoreOverlay = document.getElementById('final-score-overlay');
    const restartOverlay = document.getElementById('restart-overlay');

    let score = 0;
    let level = 1;
    let gameInterval;

    const canvas = document.getElementById("game-board");
    const ctx = canvas.getContext("2d");
    const rows = 20;
    const cols = 10;
    const blockSize = 45; // Increased from 30 to 45 for a larger play area

    canvas.width = cols * blockSize;
    canvas.height = rows * blockSize;

    const tetrominoes = {
        I: [[1, 1, 1, 1]],
        O: [
            [1, 1],
            [1, 1],
        ],
        T: [
            [0, 1, 0],
            [1, 1, 1],
        ],
        S: [
            [0, 1, 1],
            [1, 1, 0],
        ],
        Z: [
            [1, 1, 0],
            [0, 1, 1],
        ],
        J: [
            [1, 0, 0],
            [1, 1, 1],
        ],
        L: [
            [0, 0, 1],
            [1, 1, 1],
        ],
    };

    let board = Array.from({ length: rows }, () => Array(cols).fill(0));
    let currentTetromino = null;
    let currentPosition = { x: 3, y: 0 };

    // --- Vibration ---
    function vibrate(pattern) {
        if (vibrationEnabled && 'vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }

    // --- Preferences ---
    let vibrationEnabled = JSON.parse(localStorage.getItem('vibrationEnabled') ?? 'true');
    let darkMode = JSON.parse(localStorage.getItem('darkMode') ?? 'false');

    // --- UI Toggles ---
    const vibrationToggle = document.getElementById('vibration-toggle');
    const darkModeToggle = document.getElementById('darkmode-toggle');
    if (vibrationToggle) {
        vibrationToggle.onclick = () => {
            vibrationEnabled = !vibrationEnabled;
            localStorage.setItem('vibrationEnabled', vibrationEnabled);
            vibrationToggle.textContent = vibrationEnabled ? '📳' : '🔕';
        };
        vibrationToggle.textContent = vibrationEnabled ? '📳' : '🔕';
    }
    if (darkModeToggle) {
        darkModeToggle.onclick = () => {
            darkMode = !darkMode;
            localStorage.setItem('darkMode', darkMode);
            document.body.classList.toggle('dark', darkMode);
        };
        document.body.classList.toggle('dark', darkMode);
    }

    // --- Line Clearing ---
    function clearLines() {
        let linesCleared = 0;
        for (let r = rows - 1; r >= 0; r--) {
            if (board[r].every(cell => cell)) {
                board.splice(r, 1);
                board.unshift(Array(cols).fill(0));
                linesCleared++;
                r++;
            }
        }
        if (linesCleared) {
            score += linesCleared * 100;
            vibrate(100);
            updateScore();
            if (score >= level * 1000) {
                level++;
                vibrate([200, 100, 200]);
                updateLevel();
            }
        }
    }

    // --- Collision & Merge ---
    function isValidMove(tetromino, pos) {
        for (let r = 0; r < tetromino.length; r++) {
            for (let c = 0; c < tetromino[r].length; c++) {
                if (tetromino[r][c]) {
                    let x = pos.x + c;
                    let y = pos.y + r;
                    if (x < 0 || x >= cols || y >= rows || (y >= 0 && board[y][x])) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    function mergeTetromino() {
        currentTetromino.forEach((row, r) => {
            row.forEach((cell, c) => {
                if (cell) {
                    let x = currentPosition.x + c;
                    let y = currentPosition.y + r;
                    if (y >= 0) board[y][x] = 1;
                }
            });
        });
        clearLines();
        spawnTetromino();
        if (!isValidMove(currentTetromino, currentPosition)) {
            vibrate([300, 100, 300]);
            gameOver();
        }
    }

    // --- Rotation ---
    function rotateTetromino() {
        let rotated = currentTetromino[0].map((_, i) => currentTetromino.map(row => row[i])).reverse();
        if (isValidMove(rotated, currentPosition)) {
            currentTetromino = rotated;
            drawBoard();
            drawTetromino();
        }
    }

    // --- Move ---
    function moveTetromino(dx, dy) {
        let newPos = { x: currentPosition.x + dx, y: currentPosition.y + dy };
        if (isValidMove(currentTetromino, newPos)) {
            currentPosition = newPos;
            drawBoard();
            drawTetromino();
        } else if (dy === 1) {
            mergeTetromino();
        }
    }

    // --- Touch Controls ---
    let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
    canvas.addEventListener('touchstart', e => {
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchStartTime = Date.now();
    });
    canvas.addEventListener('touchend', e => {
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        const dt = Date.now() - touchStartTime;
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 30) moveTetromino(1, 0); // swipe right
            else if (dx < -30) moveTetromino(-1, 0); // swipe left
        } else {
            if (dy > 30) moveTetromino(0, 1); // swipe down
        }
        if (dt < 200 && Math.abs(dx) < 10 && Math.abs(dy) < 10) rotateTetromino(); // tap
        if (dt > 500) while (isValidMove(currentTetromino, { x: currentPosition.x, y: currentPosition.y + 1 })) moveTetromino(0, 1); // long press drop
    });

    // --- Keyboard Controls ---
    document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") moveTetromino(-1, 0);
        if (e.key === "ArrowRight") moveTetromino(1, 0);
        if (e.key === "ArrowDown") moveTetromino(0, 1);
        if (e.key === "ArrowUp") rotateTetromino();
        if (e.key === " ") while (isValidMove(currentTetromino, { x: currentPosition.x, y: currentPosition.y + 1 })) moveTetromino(0, 1); // space for hard drop
    });

    // --- Game Loop ---
    function gameLoop() {
        moveTetromino(0, 1);
    }

    // --- Username Modal & Player Name ---
    const usernameModal = document.getElementById('username-modal');
    const usernameInput = document.getElementById('username-input');
    const usernameSubmit = document.getElementById('username-submit');
    const playerNameDisplay = document.getElementById('player-name');
    const playerHighscoreDisplay = document.getElementById('player-highscore');
    function setCookie(name, value, days = 365) {
        let expires = '';
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days*24*60*60*1000));
            expires = '; expires=' + date.toUTCString();
        }
        document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/';
    }

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
        return '';
    }

    let playerName = getCookie('tetrisPlayerName') || '';
    let playerHighscore = parseInt(getCookie('tetrisHighscore') || '0');

    function showUsernameModal() {
        usernameModal.style.display = 'flex';
    }
    function hideUsernameModal() {
        usernameModal.style.display = 'none';
    }
    function setPlayerName(name) {
        playerName = name;
        setCookie('tetrisPlayerName', name);
        playerNameDisplay.textContent = `Player: ${name}`;
        updateHighscoreDisplay();
    }
    function updateHighscoreDisplay() {
        if (playerHighscoreDisplay) {
            playerHighscoreDisplay.textContent = `High Score: ${playerHighscore}`;
            playerHighscoreDisplay.style.display = 'block';
        }
        setCookie('tetrisHighscore', playerHighscore);
    }
    updateHighscoreDisplay();

    if (!playerName) {
        showUsernameModal();
    } else {
        setPlayerName(playerName);
    }
    usernameSubmit.addEventListener('click', () => {
        const name = usernameInput.value.trim() || 'Player';
        setPlayerName(name);
        hideUsernameModal();
    });
    usernameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            usernameSubmit.click();
        }
    });

    // --- Session Persistence ---
    function saveSession() {
        localStorage.setItem('tetrisBoard', JSON.stringify(board));
        localStorage.setItem('tetrisScore', score);
        localStorage.setItem('tetrisLevel', level);
    }
    function loadSession() {
        const savedBoard = localStorage.getItem('tetrisBoard');
        if (savedBoard) board = JSON.parse(savedBoard);
        score = parseInt(localStorage.getItem('tetrisScore') ?? '0');
        level = parseInt(localStorage.getItem('tetrisLevel') ?? '1');
        updateScore();
        updateLevel();
    }
    window.addEventListener('beforeunload', saveSession);
    function startGame() {
        startScreen.classList.add("hidden");
        gameScreen.classList.remove("hidden");
        gameOverScreen.classList.add("hidden");
        board = Array.from({ length: rows }, () => Array(cols).fill(0));
        score = 0;
        level = 1;
        updateScore();
        updateLevel();
        // loadSession(); // Removed to ensure fresh start
        spawnTetromino();
        drawBoard();
        drawTetromino();
        if (gameInterval) clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, Math.max(100, 1000 - (level - 1) * 100));
    }

    startButton.addEventListener("click", startGame);
    restartButton.addEventListener("click", startGame);

    // --- Next Tetromino Preview ---
    const nextCanvas = document.getElementById("next-board");
    const nextCtx = nextCanvas.getContext("2d");
    nextCanvas.width = 4 * blockSize;
    nextCanvas.height = 4 * blockSize;
    let nextTetromino = null;

    function drawNextTetromino() {
        nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
        if (!nextTetromino) return;
        nextCtx.fillStyle = "green";
        nextTetromino.forEach((row, r) => {
            row.forEach((cell, c) => {
                if (cell) {
                    nextCtx.fillRect(c * blockSize, r * blockSize, blockSize, blockSize);
                    nextCtx.strokeStyle = "black";
                    nextCtx.strokeRect(c * blockSize, r * blockSize, blockSize, blockSize);
                }
            });
        });
    }

    function getRandomTetromino() {
        const keys = Object.keys(tetrominoes);
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        return tetrominoes[randomKey];
    }

    function spawnTetromino() {
        if (!nextTetromino) {
            nextTetromino = getRandomTetromino();
        }
        currentTetromino = nextTetromino;
        currentPosition = { x: 3, y: 0 };
        nextTetromino = getRandomTetromino();
        drawNextTetromino();
    }

    // --- Pause Button Logic ---
    let paused = false;
    pauseButton.addEventListener("click", () => {
        if (paused) {
            gameInterval = setInterval(gameLoop, Math.max(100, 1000 - (level - 1) * 100));
            pauseButton.textContent = "Pause";
        } else {
            clearInterval(gameInterval);
            pauseButton.textContent = "Resume";
        }
        paused = !paused;
    });

    // --- Visual Effects ---
    // Add CSS classes for animations (e.g., .line-clear, .level-up, .game-over) in style.css
    // Trigger them here as needed

    function updateScore() {
        scoreDisplay.textContent = `Score: ${score}`;
    }

    function updateLevel() {
        levelDisplay.textContent = `Level: ${level}`;
    }

    function drawBoard() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c]) {
                    ctx.fillStyle = "blue";
                    ctx.fillRect(c * blockSize, r * blockSize, blockSize, blockSize);
                    ctx.strokeStyle = "black";
                    ctx.strokeRect(c * blockSize, r * blockSize, blockSize, blockSize);
                }
            }
        }
    }

    function drawTetromino() {
        if (!currentTetromino) return;
        ctx.fillStyle = "red";
        currentTetromino.forEach((row, r) => {
            row.forEach((cell, c) => {
                if (cell) {
                    const x = (currentPosition.x + c) * blockSize;
                    const y = (currentPosition.y + r) * blockSize;
                    ctx.fillRect(x, y, blockSize, blockSize);
                    ctx.strokeStyle = "black";
                    ctx.strokeRect(x, y, blockSize, blockSize);
                }
            });
        });
    }

    // --- On-screen Controls ---
    const leftBtn = document.getElementById('left-btn');
    const rightBtn = document.getElementById('right-btn');
    const downBtn = document.getElementById('down-btn');
    const rotateBtn = document.getElementById('rotate-btn');
    const dropBtn = document.getElementById('drop-btn');

    if (leftBtn) leftBtn.addEventListener('click', () => moveTetromino(-1, 0));
    if (rightBtn) rightBtn.addEventListener('click', () => moveTetromino(1, 0));
    if (downBtn) downBtn.addEventListener('click', () => moveTetromino(0, 1));
    if (rotateBtn) rotateBtn.addEventListener('click', () => rotateTetromino());
    if (dropBtn) dropBtn.addEventListener('click', () => {
        while (isValidMove(currentTetromino, { x: currentPosition.x, y: currentPosition.y + 1 })) moveTetromino(0, 1);
    });

    // Optional: Add touchstart for mobile responsiveness
    [leftBtn, rightBtn, downBtn, rotateBtn, dropBtn].forEach(btn => {
        if (btn) btn.addEventListener('touchstart', e => {
            e.preventDefault();
            btn.click();
        });
    });

    // --- Game Over Logic ---
    function gameOver() {
        clearInterval(gameInterval);
        gameInterval = null;
        gameScreen.classList.add("hidden");
        gameOverScreen.classList.add("hidden");
        gameOverOverlay.classList.remove("hidden");
        finalScoreOverlay.textContent = `Your Score: ${score}`;
        if (score > playerHighscore) {
            playerHighscore = score;
            localStorage.setItem('tetrisHighscore', playerHighscore);
            updateHighscoreDisplay();
        }
    }

    if (restartOverlay) {
        restartOverlay.addEventListener("click", () => {
            gameOverOverlay.classList.add("hidden");
            score = 0;
            level = 1;
            board = Array.from({ length: rows }, () => Array(cols).fill(0));
            updateScore();
            updateLevel();
            startGame();
        });
    }

    // --- Matrix Rain Animation ---
    const matrixCanvas = document.getElementById('matrix-bg');
    const mtxCtx = matrixCanvas.getContext('2d');
    function resizeMatrixCanvas() {
        matrixCanvas.width = window.innerWidth;
        matrixCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeMatrixCanvas);
    resizeMatrixCanvas();

    const matrixChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&';
    const fontSize = 18;
    const columns = Math.floor(window.innerWidth / fontSize);
    let drops = Array(columns).fill(1);
    let matrixSpeed = 0.5;
    let lastMatrixTime = 0;
    let tailLength = 18;

    // Ensure drops start after every 3 character spaces
    for (let i = 0; i < drops.length; i++) {
        if (i % 3 === 0) drops[i] = Math.random() * tailLength;
    }

    function drawMatrixRain(now) {
        if (!lastMatrixTime) lastMatrixTime = now;
        const delta = now - lastMatrixTime;
        if (delta < 40) {
            requestAnimationFrame(drawMatrixRain);
            return;
        }
        lastMatrixTime = now;
        mtxCtx.clearRect(0, 0, matrixCanvas.width, matrixCanvas.height);
        mtxCtx.fillStyle = 'rgba(0, 51, 0, 0.25)';
        mtxCtx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
        mtxCtx.font = fontSize + 'px monospace';
        for (let i = 0; i < drops.length; i++) {
            for (let t = tailLength; t >= 0; t--) {
                const text = matrixChars[Math.floor(Math.random() * matrixChars.length)];
                let y = (drops[i] - t) * fontSize;
                if (y < 0) continue;
                let opacity = 0.3 * (t === 0 ? 1 : (1-t/tailLength)); // 30% max opacity
                mtxCtx.fillStyle = t === 0 ? 'rgba(255,255,255,0.3)' : `rgba(0,255,0,${opacity})`;
                mtxCtx.fillText(text, i * fontSize, y);
            }
            if (drops[i] * fontSize > matrixCanvas.height && Math.random() > 0.975) {
                drops[i] = Math.random() * tailLength;
            }
            drops[i] += matrixSpeed;
        }
        requestAnimationFrame(drawMatrixRain);
    }
    requestAnimationFrame(drawMatrixRain);
});