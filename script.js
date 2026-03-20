// ─── Transit systems config ───────────────────────────────────────────────────
// To add a new system, add an entry here. The file must be in the routes/ folder.
const TRANSIT_SYSTEMS = [
    { id: 'VTA',  name: 'VTA — Santa Clara', file: 'routes/VTA.geojson' },
    { id: 'MUNI', name: 'Muni — San Francisco', file: 'routes/MUNI.geojson' },
];

// ─── Global state ─────────────────────────────────────────────────────────────
let map;
let routeLayer;
let darkTileLayer;
let blankTileLayer;
let isBlankMapActive = true;

let routeData = null;
let currentSystemId = null;

let targetRouteIndex = -1;
let targetRoute = null;
let gameOver = false;
let gaveUp = false;
let isDailyRound = true;
let isDailyRoute = true;
let wrongRouteIndices = [];
let guessCount = 0;

let sidebarOpen = true;

// ─── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────
function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function getDailySeed() {
    const now = new Date();
    return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    initializeMap();
    buildSystemList();
    await switchSystem(TRANSIT_SYSTEMS[0].id);
});

function initializeMap() {
    map = L.map('map').setView([37.3382, -121.8863], 11);

    darkTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '© CartoDB', maxZoom: 19, minZoom: 8, detectRetina: true
    });

    blankTileLayer = L.tileLayer(
        'data:image/svg+xml;utf8,<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg"><rect width="256" height="256" fill="%231a1a1a"/></svg>',
        { attribution: '', maxZoom: 19, minZoom: 8 }
    );

    blankTileLayer.addTo(map);
    routeLayer = L.featureGroup().addTo(map);
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function buildSystemList() {
    const list = document.getElementById('systemList');
    list.innerHTML = '';
    TRANSIT_SYSTEMS.forEach(sys => {
        const btn = document.createElement('button');
        btn.className = 'system-btn';
        btn.textContent = sys.name;
        btn.setAttribute('data-system-id', sys.id);
        btn.onclick = () => switchSystem(sys.id);
        list.appendChild(btn);
    });
}

function updateSystemButtons() {
    document.querySelectorAll('.system-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-system-id') === currentSystemId);
    });
}

function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    document.getElementById('sidebar').classList.toggle('collapsed', !sidebarOpen);
}

// ─── System switching ─────────────────────────────────────────────────────────
async function switchSystem(systemId) {
    if (systemId === currentSystemId) return;
    currentSystemId = systemId;
    updateSystemButtons();

    const sys = TRANSIT_SYSTEMS.find(s => s.id === systemId);
    try {
        const resp = await fetch(`./${sys.file}`);
        if (!resp.ok) throw new Error(resp.statusText);
        routeData = await resp.json();
    } catch (err) {
        console.error(`Error loading ${sys.file}:`, err);
        alert(`Failed to load ${sys.name}: ${err.message}`);
        return;
    }

    // Re-center map on the new system's routes
    routeLayer.clearLayers();
    const allLines = L.geoJSON(routeData);
    const bounds = allLines.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });

    // Reset daily state for new system
    isDailyRound = true;

    createRouteButtons();
    startNewGame();
}

// ─── Game logic ───────────────────────────────────────────────────────────────
function selectTargetRoute(rng) {
    const rand = rng || Math.random.bind(Math);
    targetRouteIndex = Math.floor(rand() * routeData.features.length);
    targetRoute = routeData.features[targetRouteIndex];
}

function startNewGame() {
    if (!routeData) return;

    gameOver = false;
    gaveUp = false;
    wrongRouteIndices = [];
    guessCount = 0;

    if (isDailyRound) {
        // Mix system id into seed so different systems have different daily routes
        const daySeed = getDailySeed();
        const sysHash = currentSystemId.split('').reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0);
        selectTargetRoute(mulberry32(daySeed ^ sysHash));
        isDailyRoute = true;
        isDailyRound = false;
    } else {
        selectTargetRoute();
        isDailyRoute = false;
    }

    routeLayer.clearLayers();
    displayRouteWithColor(targetRoute, '#00ff41');

    document.getElementById('gamePrompt').textContent = 'Guess the route!';
    setBlankMap(true);

    document.querySelectorAll('.route-btn').forEach(btn => {
        btn.classList.remove('active', 'correct', 'wrong', 'disabled');
    });

    updateGameUI();
}

function displayRouteWithColor(route, color) {
    const layer = L.geoJSON(route, {
        style: { color, weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }
    });
    layer.addTo(routeLayer);
    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50] });
}

function updateGameUI() {
    document.getElementById('guessCount').textContent = guessCount;

    const badge = document.getElementById('dailyBadge');
    badge.style.display = isDailyRoute ? 'inline-block' : 'none';

    const shareBtn = document.getElementById('btnShare');

    if (gameOver) {
        document.getElementById('gamePrompt').style.display = 'none';
        document.getElementById('routeDetails').style.display = 'flex';
        document.getElementById('btnNextRoute').style.display = 'block';
        document.getElementById('btnGiveUp').style.display = 'none';
        shareBtn.style.display = 'block';
        shareBtn.textContent = isDailyRoute ? 'Share Daily 📋' : 'Share 📋';
    } else {
        document.getElementById('gamePrompt').style.display = 'block';
        document.getElementById('routeDetails').style.display = 'none';
        document.getElementById('btnNextRoute').style.display = 'none';
        document.getElementById('btnGiveUp').style.display = 'block';
        shareBtn.style.display = 'none';
    }
}

function updateRouteInfo(properties) {
    document.getElementById('routeNumber').textContent = properties.lineabbr;
    document.getElementById('routeName').textContent = properties.linename;
    document.getElementById('routeCategory').textContent = properties.category;
}

function setBlankMap(active) {
    if (active && !isBlankMapActive) {
        map.removeLayer(darkTileLayer);
        blankTileLayer.addTo(map);
        isBlankMapActive = true;
    } else if (!active && isBlankMapActive) {
        map.removeLayer(blankTileLayer);
        darkTileLayer.addTo(map);
        isBlankMapActive = false;
    }
}

function createRouteButtons() {
    if (!routeData) return;
    const container = document.getElementById('routesContainer');
    container.innerHTML = '';
    routeData.features.forEach((feature, index) => {
        const btn = document.createElement('button');
        btn.className = 'route-btn';
        btn.textContent = feature.properties.lineabbr;
        btn.setAttribute('data-index', index);
        btn.onclick = () => onRouteButtonClick(index);
        container.appendChild(btn);
    });
}

function onRouteButtonClick(routeIndex) {
    if (!routeData || gameOver) return;

    const btn = document.querySelector(`[data-index="${routeIndex}"]`);
    if (btn && btn.classList.contains('disabled')) return;

    guessCount++;
    updateGameUI();

    if (routeIndex === targetRouteIndex) {
        gameOver = true;
        updateRouteInfo(targetRoute.properties);
        updateGameUI();
        if (btn) btn.classList.add('correct');
        document.querySelectorAll('.route-btn').forEach(b => b.classList.add('disabled'));
        setBlankMap(false);
    } else {
        if (!wrongRouteIndices.includes(routeIndex)) wrongRouteIndices.push(routeIndex);
        if (btn) btn.classList.add('wrong', 'disabled');
        displayRouteWithColor(routeData.features[routeIndex], '#ff1744');
    }
}

function giveUp() {
    if (gameOver) return;
    gameOver = true;
    gaveUp = true;
    updateRouteInfo(targetRoute.properties);
    updateGameUI();
    document.getElementById('gamePrompt').textContent = 'Better luck next time!';
    document.getElementById('gamePrompt').style.display = 'block';
    const btn = document.querySelector(`[data-index="${targetRouteIndex}"]`);
    if (btn) btn.classList.add('correct');
    document.querySelectorAll('.route-btn').forEach(b => b.classList.add('disabled'));
    setBlankMap(false);
}

function shareResult() {
    const sys = TRANSIT_SYSTEMS.find(s => s.id === currentSystemId);
    const routeName = targetRoute.properties.lineabbr;
    const squares = wrongRouteIndices.map(() => '🟥').join('');
    const prefix = isDailyRoute ? `🚌 RoutleClone — Daily (${sys.name})` : `🚌 RoutleClone (${sys.name})`;
    let text;
    if (gaveUp) {
        text = `${prefix}\nRoute ${routeName} — gave up after ${guessCount} guess${guessCount !== 1 ? 'es' : ''}\n${squares}`;
    } else {
        text = `${prefix}\nRoute ${routeName} — solved in ${guessCount} guess${guessCount !== 1 ? 'es' : ''}!\n${squares}🟩`;
    }

    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('btnShare');
        btn.textContent = 'Copied! ✓';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = isDailyRoute ? 'Share Daily 📋' : 'Share 📋';
            btn.classList.remove('copied');
        }, 2000);
    });
}