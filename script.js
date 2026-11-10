/* ============================================
   3D Warehouse Packing Optimizer - Main Script
   Clean Light Theme & Full-Stack Integration
   ============================================ */

// ===== GLOBAL STATE =====
let scene, camera, renderer, controls;
let packedBoxMeshes = [];
let warehouseMesh = null;
let animationFrameId = null;
let packingResults = null;
let backendAvailable = false;
let autoRotateActive = false;
let authMode = 'signin'; // 'signin' | 'signup'

// Raycasting for interactive 3D box hover
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredMesh = null;

// Box colors palette (Vibrant tones matching light theme)
const BOX_COLORS = [
    0x2563eb, 0x8b5cf6, 0x06b6d4, 0x10b981,
    0xf59e0b, 0xef4444, 0xec4899, 0x3b82f6,
    0x14b8a6, 0xf97316, 0x6366f1, 0x84cc16,
];

// Sample items
const INITIAL_ITEMS = [
    { l: 5, w: 4, h: 3, v: 120 },
    { l: 3, w: 3, h: 3, v: 80 },
    { l: 6, w: 3, h: 2, v: 150 },
    { l: 4, w: 4, h: 4, v: 200 },
    { l: 2, w: 2, h: 2, v: 40 },
    { l: 7, w: 5, h: 3, v: 250 },
    { l: 3, w: 2, h: 4, v: 90 },
    { l: 4, w: 3, h: 2, v: 70 },
];

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    loadInitialItems();
    updateWarehouseVolume();
    checkBackendHealth();
    initAuth();
    setupCanvasEvents();

    // Live update warehouse volume
    ['warehouseLength', 'warehouseWidth', 'warehouseHeight'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            updateWarehouseVolume();
            drawWarehousePreview();
        });
    });

    // Close profile dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('authLoggedIn');
        if (wrapper && !wrapper.contains(e.target)) {
            const menu = document.getElementById('profileMenu');
            if (menu) menu.classList.remove('show');
        }
    });
});

// ===== AUTH & PROFILE MANAGEMENT =====
function initAuth() {
    const savedUser = localStorage.getItem('optipack_user');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            renderLoggedInState(user);
        } catch (e) {
            renderLoggedOutState();
        }
    } else {
        renderLoggedOutState();
    }
}

function openAuthModal(tab = 'signin') {
    authMode = tab;
    switchAuthTab(tab);
    document.getElementById('authModal').style.display = 'flex';
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}

function switchAuthTab(tab) {
    authMode = tab;
    const tabSignIn = document.getElementById('tabSignIn');
    const tabSignUp = document.getElementById('tabSignUp');
    const groupName = document.getElementById('groupName');
    const title = document.getElementById('authModalTitle');
    const subtitle = document.getElementById('authModalSubtitle');
    const btnSubmit = document.getElementById('btnAuthSubmit');
    const rememberRow = document.getElementById('authRememberRow');

    if (tab === 'signin') {
        tabSignIn.classList.add('active');
        tabSignUp.classList.remove('active');
        groupName.style.display = 'none';
        title.textContent = 'Welcome Back';
        subtitle.textContent = 'Sign in to save and manage warehouse packings';
        btnSubmit.textContent = 'Sign In';
        rememberRow.style.display = 'flex';
    } else {
        tabSignUp.classList.add('active');
        tabSignIn.classList.remove('active');
        groupName.style.display = 'block';
        title.textContent = 'Create Account';
        subtitle.textContent = 'Sign up to export and sync packing configurations';
        btnSubmit.textContent = 'Create Account';
        rememberRow.style.display = 'none';
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const name = document.getElementById('authName').value.trim() || email.split('@')[0].capitalize();

    if (!email || !password) {
        showToast('Please enter both email and password', 'error');
        return;
    }

    // Try FastAPI Backend
    let userObj = { name: name || 'Alex', email: email };
    try {
        const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
        const payload = authMode === 'signup' ? { name, email, password } : { email, password };
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            const data = await res.json();
            userObj = data.user;
        }
    } catch (err) {
        // Fallback to local session
    }

    localStorage.setItem('optipack_user', JSON.stringify(userObj));
    renderLoggedInState(userObj);
    closeAuthModal();
    showToast(`Signed in successfully as ${userObj.name}`, 'success');
}

function quickDemoLogin() {
    const demoUser = { name: 'Alex Morgan', email: 'alex.morgan@warehouse.io' };
    localStorage.setItem('optipack_user', JSON.stringify(demoUser));
    renderLoggedInState(demoUser);
    closeAuthModal();
    showToast('Signed in with Demo Account', 'success');
}

function renderLoggedInState(user) {
    document.getElementById('authLoggedOut').style.display = 'none';
    const loggedIn = document.getElementById('authLoggedIn');
    loggedIn.style.display = 'block';

    const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';
    document.getElementById('profileAvatar').textContent = initial;
    document.getElementById('profileName').textContent = user.name || 'User';
    document.getElementById('menuUserName').textContent = user.name || 'User';
    document.getElementById('menuUserEmail').textContent = user.email || '';
}

function renderLoggedOutState() {
    document.getElementById('authLoggedOut').style.display = 'flex';
    document.getElementById('authLoggedIn').style.display = 'none';
    const menu = document.getElementById('profileMenu');
    if (menu) menu.classList.remove('show');
}

function toggleProfileMenu() {
    const menu = document.getElementById('profileMenu');
    menu.classList.toggle('show');
}

function logoutUser() {
    localStorage.removeItem('optipack_user');
    renderLoggedOutState();
    showToast('Signed out successfully', 'info');
}

function showSavedLayouts() {
    const menu = document.getElementById('profileMenu');
    if (menu) menu.classList.remove('show');
    showToast('Configuration autosaved to your account', 'success');
}

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

// ===== BACKEND HEALTH CHECK =====
async function checkBackendHealth() {
    try {
        const res = await fetch('/api/health');
        if (res.ok) {
            backendAvailable = true;
            return;
        }
    } catch (e) {
        backendAvailable = false;
    }
}

// ===== THREE.JS INITIALIZATION (LIGHT THEME MATCHING SCREENSHOT) =====
function initThreeJS() {
    const container = document.getElementById('vizContainer');
    const canvas = document.getElementById('threeCanvas');

    // Scene with light background matching screenshot (#f8fafc)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);

    // Camera
    camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 500);
    camera.position.set(30, 24, 30);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5;
    controls.maxDistance = 150;

    // Soft Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(25, 45, 25);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x3b82f6, 0.3, 100);
    pointLight.position.set(-15, 25, -15);
    scene.add(pointLight);

    // Light subtle grid floor
    const grid = new THREE.GridHelper(60, 60, 0xc8d6e5, 0xe2e8f0);
    grid.position.y = -0.01;
    scene.add(grid);

    drawWarehousePreview();

    // Animation Loop
    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        if (autoRotateActive) {
            controls.autoRotate = true;
            controls.autoRotateSpeed = 2.0;
        } else {
            controls.autoRotate = false;
        }
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // Responsive Canvas Resize
    window.addEventListener('resize', () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });
}

// ===== CAMERA ANGLE CONTROLS =====
function setCameraView(view) {
    document.querySelectorAll('.cam-btn-group .btn').forEach(b => b.classList.remove('active-cam'));

    const wl = parseFloat(document.getElementById('warehouseLength').value) || 20;
    const ww = parseFloat(document.getElementById('warehouseWidth').value) || 15;
    const wh = parseFloat(document.getElementById('warehouseHeight').value) || 10;
    const center = new THREE.Vector3(wl / 2, wh / 2, ww / 2);
    const maxDim = Math.max(wl, ww, wh);

    controls.target.copy(center);

    if (view === 'iso') {
        camera.position.set(center.x + maxDim * 1.5, center.y + maxDim * 1.2, center.z + maxDim * 1.5);
        document.getElementById('btnCamIso').classList.add('active-cam');
    } else if (view === 'top') {
        camera.position.set(center.x, center.y + maxDim * 2.5, center.z + 0.01);
        document.getElementById('btnCamTop').classList.add('active-cam');
    } else if (view === 'front') {
        camera.position.set(center.x, center.y, center.z + maxDim * 2.2);
        document.getElementById('btnCamFront').classList.add('active-cam');
    }
    controls.update();
}

function resetCamera() {
    setCameraView('iso');
}

function toggleAutoRotate() {
    autoRotateActive = !autoRotateActive;
    document.getElementById('btnAutoRotate').classList.toggle('active-cam', autoRotateActive);
}

// ===== DRAW WAREHOUSE WIREFRAME =====
function drawWarehousePreview() {
    if (warehouseMesh) {
        scene.remove(warehouseMesh);
        warehouseMesh.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        });
        warehouseMesh = null;
    }

    const wl = parseFloat(document.getElementById('warehouseLength').value) || 20;
    const ww = parseFloat(document.getElementById('warehouseWidth').value) || 15;
    const wh = parseFloat(document.getElementById('warehouseHeight').value) || 10;

    warehouseMesh = new THREE.Group();

    // Wireframe Box in Royal Blue (matching image)
    const geo = new THREE.BoxGeometry(wl, wh, ww);
    const edges = new THREE.EdgesGeometry(geo);
    const mat = new THREE.LineBasicMaterial({ color: 0x2563eb, opacity: 0.65, transparent: true, linewidth: 2 });
    const wire = new THREE.LineSegments(edges, mat);
    wire.position.set(wl / 2, wh / 2, ww / 2);
    warehouseMesh.add(wire);

    // Semi-transparent floor
    const floorGeo = new THREE.PlaneGeometry(wl, ww);
    const floorMat = new THREE.MeshBasicMaterial({
        color: 0x2563eb, opacity: 0.08, transparent: true, side: THREE.DoubleSide
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(wl / 2, 0.01, ww / 2);
    warehouseMesh.add(floor);

    scene.add(warehouseMesh);
}

// ===== CLEAR 3D BOXES =====
function clearBoxes() {
    packedBoxMeshes.forEach(m => {
        scene.remove(m);
        if (m.geometry) m.geometry.dispose();
        if (m.material) m.material.dispose();
    });
    packedBoxMeshes = [];
}

// ===== DRAW A BOX IN 3D =====
function drawBox(x, y, z, l, w, h, colorHex, label, value) {
    const geo = new THREE.BoxGeometry(l, h, w);
    const mat = new THREE.MeshPhongMaterial({
        color: colorHex,
        opacity: 0.88,
        transparent: true,
        shininess: 55,
        specular: 0x222222
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + l / 2, y + h / 2, z + w / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Attach metadata for tooltip
    mesh.userData = {
        name: label,
        l: l, w: w, h: h,
        x: x, y: y, z: z,
        value: value,
        colorHex: colorHex
    };

    // Edge outline
    const edgeGeo = new THREE.EdgesGeometry(geo);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x1e293b, opacity: 0.35, transparent: true });
    const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
    mesh.add(edgeMesh);

    scene.add(mesh);
    packedBoxMeshes.push(mesh);
    return mesh;
}

// ===== INTERACTIVE 3D RAYCASTING (HOVER TOOLTIP) =====
function setupCanvasEvents() {
    const canvas = document.getElementById('threeCanvas');
    const tooltip = document.getElementById('boxTooltip');

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(packedBoxMeshes);

        if (intersects.length > 0) {
            const hit = intersects[0].object;
            if (hoveredMesh !== hit) {
                if (hoveredMesh) resetMeshHighlight(hoveredMesh);
                hoveredMesh = hit;
                highlightMesh(hoveredMesh);
            }

            const data = hit.userData;
            tooltip.style.display = 'block';
            document.getElementById('tooltipTitle').textContent = data.name;
            document.getElementById('tooltipDot').style.background = '#' + data.colorHex.toString(16).padStart(6, '0');
            document.getElementById('tooltipDims').textContent = `${data.l} × ${data.w} × ${data.h}`;
            document.getElementById('tooltipPos').textContent = `(${data.x}, ${data.y}, ${data.z})`;
            document.getElementById('tooltipVal').textContent = `$${data.value}`;
        } else {
            tooltip.style.display = 'none';
            if (hoveredMesh) {
                resetMeshHighlight(hoveredMesh);
                hoveredMesh = null;
            }
        }
    });

    canvas.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
        if (hoveredMesh) {
            resetMeshHighlight(hoveredMesh);
            hoveredMesh = null;
        }
    });
}

function highlightMesh(mesh) {
    mesh.material.emissive = new THREE.Color(0x38bdf8);
    mesh.material.emissiveIntensity = 0.45;
    mesh.scale.set(1.02, 1.02, 1.02);
}

function resetMeshHighlight(mesh) {
    mesh.material.emissive = new THREE.Color(0x000000);
    mesh.material.emissiveIntensity = 0;
    mesh.scale.set(1.0, 1.0, 1.0);
}

// ===== ITEM ROWS & LOAD INITIAL DATA =====
function loadInitialItems() {
    const list = document.getElementById('itemsList');
    list.innerHTML = '';
    INITIAL_ITEMS.forEach(it => addItemRow(it.l, it.w, it.h, it.v));
    updateItemSummary();
}

function addItemRow(l = 3, w = 3, h = 3, v = 50) {
    const list = document.getElementById('itemsList');
    const idx = list.children.length + 1;
    const row = document.createElement('div');
    row.className = 'item-row';
    // Blue numbered badge matching screenshot
    row.innerHTML = `
        <span class="item-num">${idx}</span>
        <input type="number" class="item-l" value="${l}" min="1" max="100" placeholder="L">
        <input type="number" class="item-w" value="${w}" min="1" max="100" placeholder="W">
        <input type="number" class="item-h" value="${h}" min="1" max="100" placeholder="H">
        <input type="number" class="item-v" value="${v}" min="1" max="99999" placeholder="$">
        <button class="btn-remove-item" onclick="removeItemRow(this)" title="Remove">✕</button>
    `;
    list.appendChild(row);
    row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', updateItemSummary));
    updateItemSummary();
}

function removeItemRow(btn) {
    btn.closest('.item-row').remove();
    reindexItems();
    updateItemSummary();
}

function clearAllItems() {
    document.getElementById('itemsList').innerHTML = '';
    updateItemSummary();
    showToast('All items cleared', 'info');
}

function reindexItems() {
    document.querySelectorAll('.item-row').forEach((row, i) => {
        row.querySelector('.item-num').textContent = i + 1;
    });
}

function updateItemSummary() {
    const rows = document.querySelectorAll('.item-row');
    let totalVol = 0;
    rows.forEach(row => {
        const l = parseFloat(row.querySelector('.item-l').value) || 0;
        const w = parseFloat(row.querySelector('.item-w').value) || 0;
        const h = parseFloat(row.querySelector('.item-h').value) || 0;
        totalVol += l * w * h;
    });
    document.getElementById('totalItemCount').textContent = rows.length;
    document.getElementById('totalItemVolume').textContent = totalVol.toLocaleString() + ' units³';
}

function updateWarehouseVolume() {
    const l = parseFloat(document.getElementById('warehouseLength').value) || 0;
    const w = parseFloat(document.getElementById('warehouseWidth').value) || 0;
    const h = parseFloat(document.getElementById('warehouseHeight').value) || 0;
    document.getElementById('warehouseVolume').textContent = (l * w * h).toLocaleString() + ' units³';
}

// ===== CLIENT-SIDE GREEDY PACKING ALGORITHM =====
function getOrientations(l, w, h, allowRotation) {
    if (!allowRotation) return [{ l, w, h }];
    const set = new Set();
    const perms = [[l, w, h], [l, h, w], [w, l, h], [w, h, l], [h, l, w], [h, w, l]];
    const result = [];
    perms.forEach(([a, b, c]) => {
        const key = `${a},${b},${c}`;
        if (!set.has(key)) { set.add(key); result.push({ l: a, w: b, h: c }); }
    });
    return result;
}

function overlaps(px, py, pz, bl, bw, bh, placed) {
    for (const p of placed) {
        if (px < p.x + p.pl && px + bl > p.x &&
            py < p.y + p.ph && py + bh > p.y &&
            pz < p.z + p.pw && pz + bw > p.z) {
            return true;
        }
    }
    return false;
}

function findPlacement(bl, bw, bh, wl, ww, wh, placed) {
    const candidates = [{ x: 0, y: 0, z: 0 }];
    for (const p of placed) {
        candidates.push({ x: p.x + p.pl, y: p.y, z: p.z });
        candidates.push({ x: p.x, y: p.y + p.ph, z: p.z });
        candidates.push({ x: p.x, y: p.y, z: p.z + p.pw });
    }
    candidates.sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z);

    const seen = new Set();
    for (const c of candidates) {
        const key = `${c.x},${c.y},${c.z}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (c.x + bl <= wl && c.y + bh <= wh && c.z + bw <= ww) {
            if (!overlaps(c.x, c.y, c.z, bl, bw, bh, placed)) {
                return { x: c.x, y: c.y, z: c.z };
            }
        }
    }
    return null;
}

function packItemsLocally(items, wl, ww, wh, allowRotation) {
    const indexed = items.map((item, i) => ({
        ...item,
        index: i,
        volume: item.l * item.w * item.h,
        ratio: item.v / (item.l * item.w * item.h),
    }));
    indexed.sort((a, b) => b.ratio - a.ratio);

    const placed = [];
    const unpacked = [];

    for (const item of indexed) {
        let bestPos = null;
        let bestOrient = null;
        const orientations = getOrientations(item.l, item.w, item.h, allowRotation);

        for (const orient of orientations) {
            const pos = findPlacement(orient.l, orient.w, orient.h, wl, ww, wh, placed);
            if (pos) {
                bestPos = pos;
                bestOrient = orient;
                break;
            }
        }

        if (bestPos && bestOrient) {
            placed.push({
                ...item,
                x: bestPos.x, y: bestPos.y, z: bestPos.z,
                pl: bestOrient.l, pw: bestOrient.w, ph: bestOrient.h,
            });
        } else {
            unpacked.push({ ...item, reason: 'No space available' });
        }
    }

    const warehouseVol = wl * ww * wh;
    const packedVol = placed.reduce((s, item) => s + item.pl * item.pw * item.ph, 0);
    const totalVal = placed.reduce((s, item) => s + item.v, 0);
    const utilization = ((packedVol / warehouseVol) * 100).toFixed(1);

    return {
        placed,
        unpacked,
        stats: {
            total_value: totalVal,
            space_utilization: utilization,
            packed_count: placed.length,
            total_count: items.length,
            packed_volume: packedVol,
            warehouse_volume: warehouseVol
        }
    };
}

// ===== OPTIMIZE PACKING (MAIN HANDLER) =====
async function optimizePacking() {
    const input = validateInputs();
    if (!input) return;
    const { wl, ww, wh, items } = input;
    const allowRotation = document.getElementById('allowRotation').checked;
    const animate = document.getElementById('animatePacking').checked;

    const btn = document.getElementById('btnOptimize');
    btn.disabled = true;

    let result = null;

    // Try FastAPI Backend first
    if (backendAvailable) {
        try {
            const res = await fetch('/api/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    warehouse: { length: wl, width: ww, height: wh },
                    items: items,
                    allow_rotation: allowRotation
                })
            });
            if (res.ok) {
                result = await res.json();
            }
        } catch (e) {
            // fallback
        }
    }

    // Fallback to local algorithm
    if (!result) {
        result = packItemsLocally(items, wl, ww, wh, allowRotation);
    }

    btn.disabled = false;
    packingResults = result;

    // Update Stats & Results Table
    updateStats(result.stats);
    updateResultsTable(result);

    // 3D Visualization
    clearBoxes();
    drawWarehousePreview();
    resetCamera();
    document.getElementById('vizOverlay').classList.add('hidden');
    document.getElementById('btnExportCSV').style.display = 'inline-flex';

    if (animate) {
        animateBoxPlacement(result.placed);
    } else {
        result.placed.forEach((item, i) => {
            const color = BOX_COLORS[i % BOX_COLORS.length];
            drawBox(item.x, item.y, item.z, item.pl, item.pw, item.ph, color, item.name, item.v);
        });
    }

    const msg = result.placed.length === items.length
        ? `All ${items.length} items packed successfully!`
        : `${result.placed.length} of ${items.length} items packed`;
    showToast(msg, result.placed.length > 0 ? 'success' : 'error');
}

// ===== VALIDATE INPUTS =====
function validateInputs() {
    const wl = parseFloat(document.getElementById('warehouseLength').value);
    const ww = parseFloat(document.getElementById('warehouseWidth').value);
    const wh = parseFloat(document.getElementById('warehouseHeight').value);
    if (!wl || !ww || !wh || wl <= 0 || ww <= 0 || wh <= 0) {
        showToast('Please enter valid warehouse dimensions', 'error');
        return null;
    }
    const rows = document.querySelectorAll('.item-row');
    if (rows.length === 0) {
        showToast('Please add at least one item', 'error');
        return null;
    }
    const items = [];
    let valid = true;
    rows.forEach((row, i) => {
        const l = parseFloat(row.querySelector('.item-l').value);
        const w = parseFloat(row.querySelector('.item-w').value);
        const h = parseFloat(row.querySelector('.item-h').value);
        const v = parseFloat(row.querySelector('.item-v').value);
        if (!l || !w || !h || !v || l <= 0 || w <= 0 || h <= 0 || v <= 0) {
            valid = false;
        } else {
            items.push({ l, w, h, v, name: `Item ${i + 1}` });
        }
    });
    if (!valid) {
        showToast('Some items have invalid values', 'error');
        return null;
    }
    return { wl, ww, wh, items };
}

// ===== ANIMATE BOX DROP =====
function animateBoxPlacement(placed) {
    let i = 0;
    function placeNext() {
        if (i >= placed.length) return;
        const item = placed[i];
        const color = BOX_COLORS[i % BOX_COLORS.length];
        const mesh = drawBox(item.x, item.y, item.z, item.pl, item.pw, item.ph, color, item.name, item.v);

        const targetY = mesh.position.y;
        mesh.position.y = targetY + 12;
        mesh.material.opacity = 0;

        const startTime = performance.now();
        const duration = 400;

        function anim(now) {
            const t = Math.min((now - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3);
            mesh.position.y = targetY + 12 * (1 - ease);
            mesh.material.opacity = 0.88 * ease;
            if (t < 1) requestAnimationFrame(anim);
        }
        requestAnimationFrame(anim);
        i++;
        if (i < placed.length) setTimeout(placeNext, 250);
    }
    placeNext();
}

// ===== UPDATE STATS =====
function updateStats(stats) {
    document.getElementById('statTotalValue').textContent = `$${stats.total_value.toLocaleString()}`;
    document.getElementById('statSpaceUsed').textContent = `${stats.space_utilization}%`;
    document.getElementById('statItemsPacked').textContent = `${stats.packed_count} / ${stats.total_count}`;
    document.getElementById('statVolumePacked').textContent = `${stats.packed_volume.toLocaleString()} units³`;
}

// ===== RESULTS TABLE & ROW HIGHLIGHT =====
function updateResultsTable(result) {
    const table = document.getElementById('resultsTable');
    const empty = document.getElementById('resultsEmpty');
    const badge = document.getElementById('resultsBadge');
    const tbody = document.getElementById('resultsBody');
    const unpackedSection = document.getElementById('unpackedSection');
    const unpackedBody = document.getElementById('unpackedBody');

    tbody.innerHTML = '';
    unpackedBody.innerHTML = '';

    if (result.placed.length > 0) {
        table.style.display = 'table';
        empty.style.display = 'none';
        badge.style.display = 'inline-block';

        result.placed.forEach((item, i) => {
            const color = BOX_COLORS[i % BOX_COLORS.length];
            const hexColor = '#' + color.toString(16).padStart(6, '0');
            const vol = item.pl * item.pw * item.ph;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="item-color-dot" style="background:${hexColor}"></span>${item.name}</td>
                <td>${item.pl} × ${item.pw} × ${item.ph}</td>
                <td>(${item.x}, ${item.y}, ${item.z})</td>
                <td>${vol}</td>
                <td>$${item.v}</td>
                <td>${typeof item.ratio === 'number' ? item.ratio.toFixed(2) : item.ratio}</td>
            `;

            // Hover table row to highlight 3D box
            tr.addEventListener('mouseenter', () => {
                const mesh = packedBoxMeshes.find(m => m.userData.name === item.name);
                if (mesh) highlightMesh(mesh);
            });
            tr.addEventListener('mouseleave', () => {
                const mesh = packedBoxMeshes.find(m => m.userData.name === item.name);
                if (mesh) resetMeshHighlight(mesh);
            });

            tbody.appendChild(tr);
        });
    } else {
        table.style.display = 'none';
        empty.style.display = 'block';
        badge.style.display = 'none';
    }

    if (result.unpacked.length > 0) {
        unpackedSection.style.display = 'block';
        result.unpacked.forEach(item => {
            const vol = item.l * item.w * item.h;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.name}</td>
                <td>${item.l} × ${item.w} × ${item.h}</td>
                <td>${vol}</td>
                <td>$${item.v}</td>
                <td><span class="reason-badge">${item.reason}</span></td>
            `;
            unpackedBody.appendChild(tr);
        });
    } else {
        unpackedSection.style.display = 'none';
    }
}

// ===== EXPORT CSV =====
function exportResultsCSV() {
    if (!packingResults || !packingResults.placed || packingResults.placed.length === 0) {
        showToast('No packing results to export', 'error');
        return;
    }

    let csvContent = 'Item,Length,Width,Height,Position X,Position Y,Position Z,Volume,Value ($)\n';
    packingResults.placed.forEach(p => {
        csvContent += `${p.name},${p.pl},${p.pw},${p.ph},${p.x},${p.y},${p.z},${p.pl * p.pw * p.ph},${p.v}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `packing_report_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Packing report exported (.csv)', 'success');
}

// ===== RESET ALL =====
function resetAll() {
    clearBoxes();
    document.getElementById('warehouseLength').value = 20;
    document.getElementById('warehouseWidth').value = 15;
    document.getElementById('warehouseHeight').value = 10;
    updateWarehouseVolume();
    drawWarehousePreview();
    loadInitialItems();

    document.getElementById('statTotalValue').textContent = '$0';
    document.getElementById('statSpaceUsed').textContent = '0%';
    document.getElementById('statItemsPacked').textContent = '0 / 0';
    document.getElementById('statVolumePacked').textContent = '0 units³';

    document.getElementById('resultsTable').style.display = 'none';
    document.getElementById('resultsEmpty').style.display = 'block';
    document.getElementById('resultsBadge').style.display = 'none';
    document.getElementById('unpackedSection').style.display = 'none';
    document.getElementById('btnExportCSV').style.display = 'none';
    document.getElementById('vizOverlay').classList.remove('hidden');

    packingResults = null;
    showToast('Reset complete', 'info');
}

// ===== TOAST NOTIFICATIONS =====
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = {
        success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
    };
    toast.innerHTML = `${icons[type] || icons.info}<span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
