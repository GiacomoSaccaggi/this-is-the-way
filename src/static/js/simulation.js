const canvas = document.getElementById("grid-canvas");
const ctx = canvas.getContext("2d");
let CELL = 28;
let currentMode = "maze";
let animationId = null;
let currentGrid = JSON.parse(JSON.stringify(GRID));

// ============ RANDOM MAZE GENERATOR (Recursive Backtracker) ============
function generateMaze(width, height, complexity) {
    const grid = Array.from({ length: height }, () => Array(width).fill(1));

    function carve(x, y) {
        grid[y][x] = 0;
        const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]].sort(() => Math.random() - 0.5);
        for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && grid[ny][nx] === 1) {
                grid[y + dy / 2][x + dx / 2] = 0;
                carve(nx, ny);
            }
        }
    }

    carve(1, 1);

    const extraOpenings = Math.floor((1 - complexity) * width * height * 0.15);
    for (let i = 0; i < extraOpenings; i++) {
        const rx = Math.floor(Math.random() * (width - 2)) + 1;
        const ry = Math.floor(Math.random() * (height - 2)) + 1;
        grid[ry][rx] = 0;
    }

    // Start is always top-left
    grid[0][0] = 0;
    if (grid[0][1] === 1 && grid[1][0] === 1) grid[0][1] = 0;

    // Collect all free cells (excluding start area)
    const freeCells = [];
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
            if (grid[y][x] === 0 && !(x === 0 && y === 0) && !(x <= 1 && y <= 1))
                freeCells.push([x, y]);

    // Pick a random exit that's far from start (at least 40% of grid diagonal away)
    const minDist = Math.sqrt(width * width + height * height) * 0.4;
    const farCells = freeCells.filter(([x, y]) => Math.sqrt(x * x + y * y) >= minDist);
    const exitPool = farCells.length > 0 ? farCells : freeCells;
    const exit = exitPool[Math.floor(Math.random() * exitPool.length)];

    const finalWalls = [];
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
            if (grid[y][x] === 1) finalWalls.push([x, y]);

    return { width, height, walls: finalWalls, start: [0, 0], end: exit };
}

function regenerateGrid() {
    if (currentMode === "ferrari") {
        generateTrack();
        initCanvas();
        return;
    }
    const slider = document.getElementById("complexity");
    const complexity = slider ? parseFloat(slider.value) : 0.5;

    if (currentMode === "google") {
        currentGrid = generateCityGrid(complexity);
    } else {
        const size = Math.max(13, Math.floor(11 + complexity * 10));
        const w = size % 2 === 0 ? size + 1 : size;
        currentGrid = generateMaze(w, w, complexity);
    }

    CELL = Math.max(14, Math.floor(420 / currentGrid.width));
    initCanvas();
}

// ============ CITY GRID GENERATOR (Google Maps mode) ============
function generateCityGrid(complexity) {
    // Creates a grid that looks like city blocks: buildings (walls) separated by streets
    const size = Math.max(15, Math.floor(15 + complexity * 8));
    const w = size, h = size;
    const grid = Array.from({ length: h }, () => Array(w).fill(0));

    // Street spacing: how many cells per block (smaller = more streets = easier)
    const blockSize = Math.max(2, Math.floor(2 + complexity * 2));
    const streetWidth = 1;

    // Lay out a city grid: horizontal and vertical streets at regular intervals
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const isHStreet = y % (blockSize + streetWidth) < streetWidth;
            const isVStreet = x % (blockSize + streetWidth) < streetWidth;
            if (!isHStreet && !isVStreet) {
                grid[y][x] = 1; // building
            }
        }
    }

    // Randomly remove some building cells to create alleys/plazas
    const alleyCount = Math.floor(w * h * 0.03 * (1 - complexity));
    for (let i = 0; i < alleyCount; i++) {
        const rx = Math.floor(Math.random() * w);
        const ry = Math.floor(Math.random() * h);
        grid[ry][rx] = 0;
    }

    // Randomly add some extra building cells in streets (roadworks, dead-ends)
    const blockCount = Math.floor(w * h * 0.02 * complexity);
    for (let i = 0; i < blockCount; i++) {
        const rx = Math.floor(Math.random() * w);
        const ry = Math.floor(Math.random() * h);
        if (rx !== 0 || ry !== 0) grid[ry][rx] = 1;
    }

    // Ensure start and end are free
    grid[0][0] = 0;
    grid[h - 1][w - 1] = 0;

    // Pick start/end on streets far apart
    const start = [0, 0];
    const end = [w - 1, h - 1];
    // Ensure end is accessible
    grid[h - 1][w - 1] = 0;
    if (grid[h - 1][w - 2] === 1 && grid[h - 2][w - 1] === 1) grid[h - 2][w - 1] = 0;

    const walls = [];
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
            if (grid[y][x] === 1) walls.push([x, y]);

    return { width: w, height: h, walls, start, end };
}

// ============ FERRARI: CIRCULAR TRACK WITH CURVES ============
let trackPoints = [];   // The center line of the track [{x, y, angle, curvature}]
let trackWidth = 30;

function generateTrack() {
    const complexity = parseFloat(document.getElementById("complexity").value) || 0.5;
    const cx = 210, cy = 210;
    const numPoints = 80;
    const baseRadius = 130;
    trackPoints = [];

    // Generate random curves in BOTH directions (inward + outward)
    const numBumps = 3 + Math.floor(complexity * 6);
    const bumps = [];
    for (let i = 0; i < numBumps; i++) {
        bumps.push({
            angle: Math.random() * Math.PI * 2,
            amplitude: (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 45 * complexity),
            width: 0.4 + Math.random() * 0.6
        });
    }

    for (let i = 0; i < numPoints; i++) {
        const t = (i / numPoints) * Math.PI * 2;
        let r = baseRadius;
        for (const b of bumps) {
            const dist = Math.min(Math.abs(t - b.angle), Math.PI * 2 - Math.abs(t - b.angle));
            if (dist < b.width) {
                r += b.amplitude * Math.cos((dist / b.width) * Math.PI / 2);
            }
        }
        // Clamp radius so track doesn't self-intersect
        r = Math.max(50, Math.min(190, r));
        trackPoints.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
    }

    // Calculate curvature at each point (angle change between segments)
    for (let i = 0; i < trackPoints.length; i++) {
        const prev = trackPoints[(i - 1 + trackPoints.length) % trackPoints.length];
        const curr = trackPoints[i];
        const next = trackPoints[(i + 1) % trackPoints.length];

        const a1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
        const a2 = Math.atan2(next.y - curr.y, next.x - curr.x);
        let diff = a2 - a1;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        trackPoints[i].curvature = Math.abs(diff);
        trackPoints[i].angle = a2;
    }

    trackWidth = 28 - complexity * 8; // narrower track = harder
}

function drawFerrariCanvas(carIdx = -1, crashed = false, crashIdx = -1) {
    const W = 420, H = 420;
    canvas.width = W;
    canvas.height = H;

    // Grass background
    ctx.fillStyle = "#2d5a27";
    ctx.fillRect(0, 0, W, H);
    // Grass texture
    for (let i = 0; i < 200; i++) {
        ctx.fillStyle = `rgba(${30 + Math.random() * 20}, ${70 + Math.random() * 30}, ${20 + Math.random() * 20}, 0.5)`;
        ctx.fillRect(Math.random() * W, Math.random() * H, 3, 3);
    }

    // Draw track (asphalt)
    ctx.strokeStyle = "#333";
    ctx.lineWidth = trackWidth * 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(trackPoints[0].x, trackPoints[0].y);
    for (let i = 1; i <= trackPoints.length; i++) {
        const p = trackPoints[i % trackPoints.length];
        ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();

    // Track inner detail (center line dashes)
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 12]);
    ctx.beginPath();
    ctx.moveTo(trackPoints[0].x, trackPoints[0].y);
    for (let i = 1; i <= trackPoints.length; i++) {
        const p = trackPoints[i % trackPoints.length];
        ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Track edges (curbs) - red/white on sharp curves
    for (let i = 0; i < trackPoints.length; i++) {
        const p = trackPoints[i];
        if (p.curvature > 0.08) {
            const next = trackPoints[(i + 1) % trackPoints.length];
            const nx = -(next.y - p.y), ny = (next.x - p.x);
            const len = Math.sqrt(nx * nx + ny * ny) || 1;
            const ox = (nx / len) * trackWidth, oy = (ny / len) * trackWidth;
            ctx.fillStyle = i % 4 < 2 ? "#cc0000" : "#fff";
            ctx.fillRect(p.x + ox - 2, p.y + oy - 2, 4, 4);
            ctx.fillRect(p.x - ox - 2, p.y - oy - 2, 4, 4);
        }
    }

    // Start/finish line
    const sp = trackPoints[0];
    const snext = trackPoints[1];
    const sa = Math.atan2(snext.y - sp.y, snext.x - sp.x) + Math.PI / 2;
    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.rotate(sa);
    for (let r = -trackWidth; r < trackWidth; r += 5) {
        for (let c = -3; c < 3; c += 5) {
            ctx.fillStyle = (Math.floor(r / 5) + Math.floor(c / 5)) % 2 === 0 ? "#fff" : "#000";
            ctx.fillRect(r, c, 5, 5);
        }
    }
    ctx.restore();

    // Danger zones (highlight sharp curves)
    for (let i = 0; i < trackPoints.length; i++) {
        const p = trackPoints[i];
        if (p.curvature > 0.12) {
            ctx.fillStyle = "rgba(255, 100, 0, 0.15)";
            ctx.beginPath();
            ctx.arc(p.x, p.y, trackWidth + 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Draw car
    if (carIdx >= 0) {
        const p = trackPoints[carIdx % trackPoints.length];
        const angle = p.angle;

        if (crashed && carIdx === crashIdx) {
            // Crash: car spins off
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(angle + Math.random() * 2);
            ctx.fillStyle = "#ff4400";
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = "20px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("💥", 0, 5);
            ctx.restore();
            // Tire marks flying off
            ctx.strokeStyle = "rgba(30,30,30,0.6)";
            ctx.lineWidth = 2;
            for (let s = 0; s < 3; s++) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + Math.cos(angle + s) * 25, p.y + Math.sin(angle + s) * 25);
                ctx.stroke();
            }
        } else {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(angle);
            // Car body
            ctx.fillStyle = "#dc2626";
            ctx.beginPath();
            ctx.roundRect(-12, -6, 24, 12, 3);
            ctx.fill();
            // Windshield
            ctx.fillStyle = "#1a3a5c";
            ctx.fillRect(4, -4, 5, 8);
            // Wheels
            ctx.fillStyle = "#111";
            ctx.fillRect(-10, -8, 6, 3);
            ctx.fillRect(-10, 5, 6, 3);
            ctx.fillRect(4, -8, 6, 3);
            ctx.fillRect(4, 5, 6, 3);
            // Number
            ctx.fillStyle = "#fff";
            ctx.font = "bold 6px monospace";
            ctx.textAlign = "center";
            ctx.fillText("F1", -2, 3);
            ctx.restore();

            // Tire marks behind
            if (carIdx > 2) {
                ctx.strokeStyle = "rgba(40,40,40,0.4)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                const pprev = trackPoints[(carIdx - 3) % trackPoints.length];
                ctx.moveTo(pprev.x, pprev.y);
                for (let b = carIdx - 2; b <= carIdx; b++) {
                    const bp = trackPoints[b % trackPoints.length];
                    ctx.lineTo(bp.x, bp.y);
                }
                ctx.stroke();
            }
        }
    }

    // Speed info overlay
    if (carIdx >= 0 && !crashed) {
        const p = trackPoints[carIdx % trackPoints.length];
        const speed = Math.max(80, 320 - p.curvature * 2000);
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(10, H - 40, 120, 30);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`${Math.floor(speed)} km/h`, 18, H - 20);
        // Curvature indicator
        const danger = p.curvature > 0.10;
        ctx.fillStyle = danger ? "#ff4444" : "#44ff44";
        ctx.fillRect(100, H - 35, 20, 20);
        ctx.fillStyle = "#000";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(danger ? "⚠" : "OK", 110, H - 22);
    }
}

// ============ MAZE DRAWING ============
function initCanvas() {
    if (currentMode === "ferrari") {
        drawFerrariCanvas();
        return;
    }
    canvas.width = currentGrid.width * CELL;
    canvas.height = currentGrid.height * CELL;
    drawGrid();
}

function drawGrid(highlights = [], progressIdx = -1) {
    switch (currentMode) {
        case "ferrari": drawFerrariCanvas(progressIdx); break;
        case "google": drawGoogleMap(highlights, progressIdx); break;
        default: drawMazeGrid(highlights, progressIdx); break;
    }
}

function drawMazeGrid(highlights, progressIdx) {
    const walls = new Set(currentGrid.walls.map(w => `${w[0]},${w[1]}`));
    const hl = new Set(highlights.map(p => `${p[0]},${p[1]}`));

    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < currentGrid.height; y++) {
        for (let x = 0; x < currentGrid.width; x++) {
            const key = `${x},${y}`;
            const px = x * CELL, py = y * CELL;
            if (walls.has(key)) {
                ctx.fillStyle = "#2d333b";
                ctx.fillRect(px, py, CELL - 1, CELL - 1);
                ctx.fillStyle = "#22272e";
                ctx.fillRect(px + 1, py + 1, CELL / 2 - 1, CELL / 2 - 1);
                ctx.fillRect(px + CELL / 2, py + CELL / 2, CELL / 2 - 2, CELL / 2 - 2);
            } else if (hl.has(key)) {
                ctx.fillStyle = "#1f6feb";
                ctx.fillRect(px + 2, py + 2, CELL - 5, CELL - 5);
            } else {
                ctx.fillStyle = "#161b22";
                ctx.fillRect(px, py, CELL - 1, CELL - 1);
            }
        }
    }
    drawStartEnd();
    if (progressIdx >= 0 && progressIdx < highlights.length) drawMazeHunter(highlights[progressIdx]);
}

function drawMazeHunter(pos) {
    const px = pos[0] * CELL + CELL / 2, py = pos[1] * CELL + CELL / 2;
    ctx.fillStyle = "#c9d1d9";
    ctx.beginPath();
    ctx.arc(px, py - 2, CELL * 0.32, Math.PI, 0);
    ctx.lineTo(px + CELL * 0.25, py + CELL * 0.25);
    ctx.lineTo(px - CELL * 0.25, py + CELL * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1f6feb";
    ctx.fillRect(px - CELL * 0.2, py - 4, CELL * 0.4, 3);
}

function drawStartEnd() {
    const [sx, sy] = currentGrid.start;
    const [ex, ey] = currentGrid.end;
    ctx.fillStyle = "#34d399";
    ctx.beginPath();
    ctx.arc(sx * CELL + CELL / 2, sy * CELL + CELL / 2, CELL * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0d1117";
    ctx.font = `bold ${CELL * 0.4}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("S", sx * CELL + CELL / 2, sy * CELL + CELL / 2);
    ctx.fillStyle = "#f87171";
    ctx.beginPath();
    ctx.arc(ex * CELL + CELL / 2, ey * CELL + CELL / 2, CELL * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0d1117";
    ctx.fillText("E", ex * CELL + CELL / 2, ey * CELL + CELL / 2);
}

// ============ GOOGLE MAPS DRAWING ============
function drawGoogleMap(highlights, progressIdx) {
    const walls = new Set(currentGrid.walls.map(w => `${w[0]},${w[1]}`));

    ctx.fillStyle = "#f2f2f2";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < currentGrid.height; y++) {
        for (let x = 0; x < currentGrid.width; x++) {
            const key = `${x},${y}`;
            const px = x * CELL, py = y * CELL;
            if (walls.has(key)) {
                const shade = 200 + Math.floor(Math.random() * 30);
                ctx.fillStyle = `rgb(${shade},${shade - 5},${shade - 10})`;
                ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
                ctx.fillStyle = "rgba(0,0,0,0.1)";
                ctx.fillRect(px + 3, py + CELL - 4, CELL - 4, 3);
            } else {
                ctx.fillStyle = "#fff";
                ctx.fillRect(px, py, CELL, CELL);
                ctx.strokeStyle = "#e8e8e8";
                ctx.strokeRect(px, py, CELL, CELL);
            }
        }
    }

    if (highlights.length > 0) {
        const limit = progressIdx >= 0 ? progressIdx + 1 : highlights.length;
        ctx.strokeStyle = "rgba(66,133,244,0.3)";
        ctx.lineWidth = Math.max(8, CELL * 0.5);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(highlights[0][0] * CELL + CELL / 2, highlights[0][1] * CELL + CELL / 2);
        for (let i = 1; i < limit; i++) ctx.lineTo(highlights[i][0] * CELL + CELL / 2, highlights[i][1] * CELL + CELL / 2);
        ctx.stroke();

        ctx.strokeStyle = "#4285f4";
        ctx.lineWidth = Math.max(4, CELL * 0.3);
        ctx.beginPath();
        ctx.moveTo(highlights[0][0] * CELL + CELL / 2, highlights[0][1] * CELL + CELL / 2);
        for (let i = 1; i < limit; i++) ctx.lineTo(highlights[i][0] * CELL + CELL / 2, highlights[i][1] * CELL + CELL / 2);
        ctx.stroke();
    }

    drawMapPin(currentGrid.start, "#34a853", "A");
    drawMapPin(currentGrid.end, "#ea4335", "B");

    if (progressIdx >= 0 && progressIdx < highlights.length) {
        const pos = highlights[progressIdx];
        ctx.fillStyle = "#4285f4";
        ctx.beginPath();
        ctx.arc(pos[0] * CELL + CELL / 2, pos[1] * CELL + CELL / 2, CELL * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(pos[0] * CELL + CELL / 2, pos[1] * CELL + CELL / 2, CELL * 0.15, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawMapPin(pos, color, label) {
    const px = pos[0] * CELL + CELL / 2, py = pos[1] * CELL + CELL / 4;
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(px, pos[1] * CELL + CELL - 2, CELL * 0.2, CELL * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, CELL * 0.3, Math.PI, 0);
    ctx.lineTo(px, pos[1] * CELL + CELL - 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(px, py, CELL * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = `bold ${CELL * 0.3}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, px, py + 1);
}

// ============ ANIMATIONS ============

function animateMaze(path, explored) {
    // Phase 1: show exploration (cells visited by algorithm, one by one)
    // Phase 2: show final solution path highlighted differently
    const exploreList = explored && explored.length > 0 ? explored : [];
    let i = 0;
    let phase = exploreList.length > 0 ? "explore" : "path";
    let pathIdx = 0;

    function drawExploration(exploredSoFar, pathSoFar) {
        const walls = new Set(currentGrid.walls.map(w => `${w[0]},${w[1]}`));
        const explored_set = new Set(exploredSoFar.map(p => `${p[0]},${p[1]}`));
        const path_set = new Set(pathSoFar.map(p => `${p[0]},${p[1]}`));

        ctx.fillStyle = "#0d1117";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let y = 0; y < currentGrid.height; y++) {
            for (let x = 0; x < currentGrid.width; x++) {
                const key = `${x},${y}`;
                const px = x * CELL, py = y * CELL;
                if (walls.has(key)) {
                    ctx.fillStyle = "#2d333b";
                    ctx.fillRect(px, py, CELL - 1, CELL - 1);
                } else if (path_set.has(key)) {
                    ctx.fillStyle = "#34d399";
                    ctx.fillRect(px + 2, py + 2, CELL - 5, CELL - 5);
                } else if (explored_set.has(key)) {
                    ctx.fillStyle = "rgba(31, 111, 235, 0.35)";
                    ctx.fillRect(px + 1, py + 1, CELL - 3, CELL - 3);
                } else {
                    ctx.fillStyle = "#161b22";
                    ctx.fillRect(px, py, CELL - 1, CELL - 1);
                }
            }
        }
        drawStartEnd();

        // Draw hunter at current exploration frontier
        if (phase === "explore" && exploredSoFar.length > 0) {
            drawMazeHunter(exploredSoFar[exploredSoFar.length - 1]);
        } else if (phase === "path" && pathSoFar.length > 0) {
            drawMazeHunter(pathSoFar[pathSoFar.length - 1]);
        }
    }

    // Speed: skip some frames if explored is very large
    const exploreSpeed = Math.max(1, Math.floor(exploreList.length / 150));

    animationId = setInterval(() => {
        if (phase === "explore") {
            i += exploreSpeed;
            if (i >= exploreList.length) {
                i = exploreList.length;
                phase = "path";
                pathIdx = 0;
            }
            drawExploration(exploreList.slice(0, i), []);
        } else {
            pathIdx++;
            if (pathIdx >= path.length) {
                clearInterval(animationId);
                drawExploration(exploreList, path);
                return;
            }
            drawExploration(exploreList, path.slice(0, pathIdx + 1));
        }
    }, 40);
}

function animateFerrari(pathIndices, explored) {
    // explored = [[pos, aligned], ...] all states the algorithm visited
    //   aligned=true means "turned to follow track" (expensive but safe)
    //   aligned=false means "went straight in previous direction" (cheap, might crash)
    // path = the optimal solution
    // Nodes in explored but NOT in path = dead ends the algorithm tried = visual crashes
    //
    // VISUAL: when aligned=false, show car going in STRAIGHT LINE (previous direction)
    //         when aligned=true, show car following the track curve
    //         when a node is a dead end (not in path), show car going straight OFF track → 💥
    const n = trackPoints.length;
    const pathSet = new Set(pathIndices.map(p => `${p[0]},${p[1]}`));

    // Precompute track angles
    const angles = [];
    for (let i = 0; i < n; i++) {
        const cur = trackPoints[i], nxt = trackPoints[(i+1)%n];
        angles.push(Math.atan2(nxt.y - cur.y, nxt.x - cur.x));
    }

    let trail = [];
    let idx = 0;
    let crashCount = 0;

    status.textContent = "\u{1F3CE}\uFE0F Exploring the track...";
    status.className = "status-bar loading";

    function drawScene(x, y, angle, isCrash) {
        drawFerrariCanvas(-1);
        // Success trail
        if (trail.length > 2) {
            ctx.strokeStyle = "rgba(56,189,248,0.4)";
            ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
            ctx.beginPath(); ctx.moveTo(trail[0].x, trail[0].y);
            for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
            ctx.stroke();
        }
        if (isCrash) {
            // Car went straight off track — show it flying off
            const crashX = x + Math.cos(angle) * 35;
            const crashY = y + Math.sin(angle) * 35;
            ctx.strokeStyle = "rgba(200,50,50,0.7)";
            ctx.lineWidth = 3; ctx.setLineDash([5,3]);
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(crashX, crashY); ctx.stroke();
            ctx.setLineDash([]);
            ctx.font = "30px sans-serif"; ctx.textAlign = "center";
            ctx.fillText("\u{1F4A5}", crashX, crashY);
        } else {
            ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
            ctx.fillStyle = "#dc2626";
            ctx.beginPath(); ctx.roundRect(-12, -6, 24, 12, 3); ctx.fill();
            ctx.fillStyle = "#1a3a5c"; ctx.fillRect(4, -4, 5, 8);
            ctx.fillStyle = "#111";
            ctx.fillRect(-10, -8, 6, 3); ctx.fillRect(-10, 5, 6, 3);
            ctx.fillRect(4, -8, 6, 3); ctx.fillRect(4, 5, 6, 3);
            ctx.restore();
        }
        ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(8, canvas.height-40, 220, 30);
        ctx.fillStyle = "#fff"; ctx.font = "bold 11px monospace"; ctx.textAlign = "left";
        ctx.fillText(`exploring ${idx}/${explored.length} | crashes: ${crashCount} | path: ${pathIndices.length}`, 12, canvas.height-20);
    }

    if (!explored || explored.length === 0) explored = pathIndices;

    animationId = setInterval(() => {
        if (idx >= explored.length) {
            clearInterval(animationId);
            // Draw final trail in green
            drawFerrariCanvas(-1);
            if (trail.length > 2) {
                ctx.strokeStyle = "rgba(52,211,153,0.7)";
                ctx.lineWidth = 4; ctx.lineCap = "round";
                ctx.beginPath(); ctx.moveTo(trail[0].x, trail[0].y);
                for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
                ctx.stroke();
            }
            status.textContent = `\u{1F3C1} Done! ${crashCount} crashes (went straight off track), path: ${pathIndices.length} steps`;
            status.className = "status-bar success";
            return;
        }

        const node = explored[idx];
        const pos = node[0], aligned = node[1];
        const key = `${pos},${aligned}`;
        const p = trackPoints[pos % n];

        if (pathSet.has(key)) {
            // Part of the solution — car is here successfully
            trail.push({x: p.x, y: p.y});
            if (trail.length > 80) trail.shift();
            const angle = aligned ? angles[pos % n] : (pos > 0 ? angles[(pos-1) % n] : angles[0]);
            drawScene(p.x, p.y, angle, false);
        } else {
            // Dead end — algorithm tried "go straight" here but it leads off track
            crashCount++;
            // Show crash: car at this position, going in PREVIOUS direction (= straight line)
            const straightAngle = pos > 0 ? angles[(pos-1) % n] : angles[0];
            drawScene(p.x, p.y, straightAngle, true);
        }

        idx++;
    }, 50);
}












function animateGoogle(path, explored) {
    const exploreList = explored && explored.length > 0 ? explored : [];
    let i = 0;
    let phase = exploreList.length > 0 ? "explore" : "path";
    let pathIdx = 0;
    const exploreSpeed = Math.max(1, Math.floor(exploreList.length / 120));

    function drawGoogleExploration(exploredSoFar, pathSoFar) {
        const walls = new Set(currentGrid.walls.map(w => `${w[0]},${w[1]}`));
        const explored_set = new Set(exploredSoFar.map(p => `${p[0]},${p[1]}`));

        ctx.fillStyle = "#f2f2f2";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let y = 0; y < currentGrid.height; y++) {
            for (let x = 0; x < currentGrid.width; x++) {
                const key = `${x},${y}`;
                const px = x * CELL, py = y * CELL;
                if (walls.has(key)) {
                    const shade = 200 + Math.floor(Math.random() * 30);
                    ctx.fillStyle = `rgb(${shade},${shade - 5},${shade - 10})`;
                    ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
                } else if (explored_set.has(key)) {
                    ctx.fillStyle = "rgba(66, 133, 244, 0.15)";
                    ctx.fillRect(px, py, CELL, CELL);
                    ctx.strokeStyle = "#e8e8e8";
                    ctx.strokeRect(px, py, CELL, CELL);
                } else {
                    ctx.fillStyle = "#fff";
                    ctx.fillRect(px, py, CELL, CELL);
                    ctx.strokeStyle = "#e8e8e8";
                    ctx.strokeRect(px, py, CELL, CELL);
                }
            }
        }

        // Draw path line on top
        if (pathSoFar.length > 1) {
            ctx.strokeStyle = "rgba(66,133,244,0.3)";
            ctx.lineWidth = Math.max(8, CELL * 0.5);
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(pathSoFar[0][0] * CELL + CELL / 2, pathSoFar[0][1] * CELL + CELL / 2);
            for (let j = 1; j < pathSoFar.length; j++) ctx.lineTo(pathSoFar[j][0] * CELL + CELL / 2, pathSoFar[j][1] * CELL + CELL / 2);
            ctx.stroke();
            ctx.strokeStyle = "#4285f4";
            ctx.lineWidth = Math.max(4, CELL * 0.3);
            ctx.beginPath();
            ctx.moveTo(pathSoFar[0][0] * CELL + CELL / 2, pathSoFar[0][1] * CELL + CELL / 2);
            for (let j = 1; j < pathSoFar.length; j++) ctx.lineTo(pathSoFar[j][0] * CELL + CELL / 2, pathSoFar[j][1] * CELL + CELL / 2);
            ctx.stroke();
        }

        drawMapPin(currentGrid.start, "#34a853", "A");
        drawMapPin(currentGrid.end, "#ea4335", "B");

        // Navigation dot
        if (pathSoFar.length > 0) {
            const pos = pathSoFar[pathSoFar.length - 1];
            ctx.fillStyle = "#4285f4";
            ctx.beginPath();
            ctx.arc(pos[0] * CELL + CELL / 2, pos[1] * CELL + CELL / 2, CELL * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    status.textContent = "📍 Calculating route...";
    status.className = "status-bar loading";

    animationId = setInterval(() => {
        if (phase === "explore") {
            i += exploreSpeed;
            if (i >= exploreList.length) {
                i = exploreList.length;
                phase = "path";
                pathIdx = 0;
                const minutes = Math.ceil(path.length * 0.4);
                status.textContent = `📍 ${minutes} min (${path.length} blocks) · Fastest route found`;
                status.className = "status-bar success";
            }
            drawGoogleExploration(exploreList.slice(0, i), []);
        } else {
            pathIdx++;
            if (pathIdx >= path.length) {
                clearInterval(animationId);
                drawGoogleExploration(exploreList, path);
                status.textContent = `📍 You have arrived at your destination.`;
                return;
            }
            drawGoogleExploration(exploreList, path.slice(0, pathIdx + 1));
        }
    }, 40);
}

function animatePath(path, explored) {
    if (animationId) clearInterval(animationId);
    if (currentMode === "ferrari") {
        animateFerrari(path, explored);
    } else if (currentMode === "google") {
        animateGoogle(path, explored);
    } else {
        animateMaze(path, explored);
    }
}

// ============ EVENT HANDLERS ============

document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentMode = btn.dataset.mode;
        if (animationId) clearInterval(animationId);
        // Switch hint box
        document.querySelectorAll(".hint-box").forEach(h => h.classList.remove("active"));
        const hintEl = document.querySelector(`.hint-${currentMode}`);
        if (hintEl) hintEl.classList.add("active");
        if (currentMode === "ferrari") {
            generateTrack();
        } else {
            regenerateGrid();
        }
        initCanvas();
    });
});

document.getElementById("regen-btn").addEventListener("click", () => {
    if (animationId) clearInterval(animationId);
    regenerateGrid();
});

document.getElementById("complexity").addEventListener("input", (e) => {
    document.getElementById("complexity-val").textContent = parseFloat(e.target.value).toFixed(1);
});

// Submit
const btn = document.getElementById("submit-btn");
const status = document.getElementById("status");
const codeOutput = document.getElementById("code-output");
const generatedCode = document.getElementById("generated-code");
const textarea = document.getElementById("pseudocode");

btn.addEventListener("click", async () => {
    const pseudocode = textarea.value.trim();
    if (!pseudocode) return;

    if (animationId) clearInterval(animationId);

    // Ferrari: regenerate track and send track_points as grid
    if (currentMode === "ferrari") {
        generateTrack();
        initCanvas();
    }

    btn.disabled = true;
    status.textContent = "⏳ Forging in the Beskar Vault...";
    status.className = "status-bar loading";
    codeOutput.style.display = "none";

    try {
        const gridData = currentMode === "ferrari"
            ? { track_points: trackPoints.map(p => ({x: p.x, y: p.y, curvature: p.curvature || 0})) }
            : currentGrid;
        const res = await fetch("/api/submit/", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": CSRF_TOKEN },
            body: JSON.stringify({ map_slug: MAP_SLUG, pseudocode, grid_override: gridData, mode: currentMode })
        });
        const data = await res.json();

        generatedCode.textContent = data.generated_code || "";
        codeOutput.style.display = "block";

        if (data.success && data.path) {
            const timeInfo = data.time_ms ? ` (${data.time_ms}ms)` : '';
            const exploredCount = data.explored ? data.explored.length : 0;
            status.textContent = `✓ Path found! ${data.path.length} steps, explored ${exploredCount} cells${timeInfo}`;
            status.className = "status-bar success";
            animatePath(data.path, data.explored);
        } else {
            status.textContent = `✗ ${data.error || "Path not found."}`;
            status.className = "status-bar error";
            drawGrid();
        }
    } catch (e) {
        status.textContent = `✗ Connection error: ${e.message}`;
        status.className = "status-bar error";
    } finally {
        btn.disabled = false;
    }
});

// Initialize
if (currentMode === "ferrari") generateTrack();
initCanvas();
