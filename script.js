/* ============================================
   3D Warehouse Packing Optimizer - Main Script
   Greedy Heuristic 3D Knapsack Approximation
   ============================================ */

// ===== GLOBAL STATE =====
let scene, camera, renderer, controls;
let packedBoxMeshes = [];
let warehouseMesh = null;
let animationFrameId = null;
let packingResults = null;

// ===== SAMPLE DATA =====
const SAMPLE_ITEMS = [
    { l: 5, w: 4, h: 3, v: 120 },
    { l: 3, w: 3, h: 3, v: 80 },
    { l: 6, w: 3, h: 2, v: 150 },
    { l: 4, w: 4, h: 4, v: 200 },
    { l: 2, w: 2, h: 2, v: 40 },
    { l: 7, w: 5, h: 3, v: 250 },
    { l: 3, w: 2, h: 4, v: 90 },
    { l: 4, w: 3, h: 2, v: 70 },
];

// Box colors palette
const BOX_COLORS = [
    0x6366f1, 0xa855f7, 0xec4899, 0x06b6d4,
    0x22c55e, 0xf59e0b, 0xef4444, 0x3b82f6,
    0x14b8a6, 0xf97316, 0x8b5cf6, 0x10b981,
];

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    loadSampleItems();
    updateWarehouseVolume();
    initThreeJS();
    // Live update warehouse volume
    ['warehouseLength','warehouseWidth','warehouseHeight'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateWarehouseVolume);
    });
});

// ===== BACKGROUND PARTICLES =====
function createParticles() {
    const container = document.getElementById('bgParticles');
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        const size = Math.random() * 4 + 1;
        const colors = ['rgba(37,99,235,0.15)', 'rgba(124,58,237,0.12)', 'rgba(8,145,178,0.1)'];
        p.style.cssText = `
            width:${size}px;height:${size}px;
            left:${Math.random()*100}%;
            background:${colors[Math.floor(Math.random()*colors.length)]};
            animation-duration:${Math.random()*15+10}s;
            animation-delay:${Math.random()*10}s;
        `;
        container.appendChild(p);
    }
}

// ===== LOAD SAMPLE ITEMS =====
function loadSampleItems() {
    const list = document.getElementById('itemsList');
    list.innerHTML = '';
    SAMPLE_ITEMS.forEach((item, i) => addItemRow(item.l, item.w, item.h, item.v));
    updateItemSummary();
}

// ===== ADD ITEM ROW =====
function addItemRow(l, w, h, v) {
    const list = document.getElementById('itemsList');
    const idx = list.children.length + 1;
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
        <span class="item-num">${idx}</span>
        <input type="number" class="item-l" value="${l||1}" min="1" max="50" placeholder="L">
        <input type="number" class="item-w" value="${w||1}" min="1" max="50" placeholder="W">
        <input type="number" class="item-h" value="${h||1}" min="1" max="50" placeholder="H">
        <input type="number" class="item-v" value="${v||10}" min="1" max="9999" placeholder="$">
        <button class="btn-remove-item" onclick="removeItemRow(this)" title="Remove">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    `;
    list.appendChild(row);
    // Add listeners for summary update
    row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', updateItemSummary));
    updateItemSummary();
}

// ===== REMOVE ITEM ROW =====
function removeItemRow(btn) {
    btn.closest('.item-row').remove();
    reindexItems();
    updateItemSummary();
}

// ===== REINDEX ITEMS =====
function reindexItems() {
    document.querySelectorAll('.item-row').forEach((row, i) => {
        row.querySelector('.item-num').textContent = i + 1;
    });
}

// ===== CLEAR ALL ITEMS =====
function clearAllItems() {
    document.getElementById('itemsList').innerHTML = '';
    updateItemSummary();
    showToast('All items cleared', 'info');
}

// ===== UPDATE ITEM SUMMARY =====
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

// ===== UPDATE WAREHOUSE VOLUME =====
function updateWarehouseVolume() {
    const l = parseFloat(document.getElementById('warehouseLength').value) || 0;
    const w = parseFloat(document.getElementById('warehouseWidth').value) || 0;
    const h = parseFloat(document.getElementById('warehouseHeight').value) || 0;
    document.getElementById('warehouseVolume').textContent = (l*w*h).toLocaleString() + ' units³';
}

// ===== TOAST NOTIFICATIONS =====
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = {
        success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
    };
    toast.innerHTML = `${icons[type] || icons.info}<span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ===== ABOUT MODAL =====
function toggleAboutModal() {
    document.getElementById('aboutModal').classList.toggle('active');
}

// ===== THREE.JS INITIALIZATION =====
function initThreeJS() {
    const container = document.getElementById('vizContainer');
    const canvas = document.getElementById('threeCanvas');
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);
    // Camera
    camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 500);
    camera.position.set(30, 25, 30);
    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
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
    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 30, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const pointLight = new THREE.PointLight(0x6366f1, 0.3, 100);
    pointLight.position.set(-10, 20, -10);
    scene.add(pointLight);
    // Grid helper
    const grid = new THREE.GridHelper(60, 60, 0xc8d6e5, 0xe2e8f0);
    grid.position.y = -0.01;
    scene.add(grid);
    // Animate loop
    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
    // Resize
    window.addEventListener('resize', () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });
}

// ===== RESET CAMERA =====
function resetCamera() {
    const wl = parseFloat(document.getElementById('warehouseLength').value) || 20;
    const ww = parseFloat(document.getElementById('warehouseWidth').value) || 15;
    const wh = parseFloat(document.getElementById('warehouseHeight').value) || 10;
    const maxDim = Math.max(wl, ww, wh);
    camera.position.set(maxDim * 1.5, maxDim * 1.2, maxDim * 1.5);
    controls.target.set(wl / 2, wh / 2, ww / 2);
    controls.update();
}

// ===== CLEAR 3D SCENE (boxes only) =====
function clearScene() {
    packedBoxMeshes.forEach(m => {
        scene.remove(m);
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
            if (Array.isArray(m.material)) m.material.forEach(mt => mt.dispose());
            else m.material.dispose();
        }
    });
    packedBoxMeshes = [];
    if (warehouseMesh) {
        scene.remove(warehouseMesh);
        warehouseMesh.geometry.dispose();
        warehouseMesh.material.dispose();
        warehouseMesh = null;
    }
    // Remove edge helpers
    scene.children.filter(c => c.userData && c.userData.isPackingObj).forEach(c => {
        scene.remove(c);
    });
}

// ===== DRAW WAREHOUSE WIREFRAME =====
function drawWarehouse(wl, ww, wh) {
    const geo = new THREE.BoxGeometry(wl, wh, ww);
    const edges = new THREE.EdgesGeometry(geo);
    const mat = new THREE.LineBasicMaterial({ color: 0x2563eb, opacity: 0.6, transparent: true });
    warehouseMesh = new THREE.LineSegments(edges, mat);
    warehouseMesh.position.set(wl / 2, wh / 2, ww / 2);
    warehouseMesh.userData.isPackingObj = true;
    scene.add(warehouseMesh);
    // Semi-transparent floor
    const floorGeo = new THREE.PlaneGeometry(wl, ww);
    const floorMat = new THREE.MeshBasicMaterial({
        color: 0x2563eb, opacity: 0.08, transparent: true, side: THREE.DoubleSide
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(wl / 2, 0.01, ww / 2);
    floor.userData.isPackingObj = true;
    scene.add(floor);
    geo.dispose();
}

// ===== DRAW A BOX IN 3D =====
function drawBox(x, y, z, l, w, h, colorHex, label) {
    const geo = new THREE.BoxGeometry(l, h, w);
    const mat = new THREE.MeshPhongMaterial({
        color: colorHex, opacity: 0.82, transparent: true,
        shininess: 60, specular: 0x222222,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + l / 2, y + h / 2, z + w / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isPackingObj = true;
    scene.add(mesh);
    packedBoxMeshes.push(mesh);
    // Edges
    const edgeGeo = new THREE.EdgesGeometry(geo);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x334155, opacity: 0.25, transparent: true });
    const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
    edgeMesh.position.copy(mesh.position);
    edgeMesh.userData.isPackingObj = true;
    scene.add(edgeMesh);
    packedBoxMeshes.push(edgeMesh);
    return mesh;
}

// =============================================
// 3D BIN PACKING ALGORITHM (Greedy Heuristic)
// =============================================

/**
 * Generate all rotation orientations for a box.
 * Returns array of {l, w, h} combinations.
 */
function getOrientations(l, w, h) {
    const set = new Set();
    const perms = [[l,w,h],[l,h,w],[w,l,h],[w,h,l],[h,l,w],[h,w,l]];
    const result = [];
    perms.forEach(([a, b, c]) => {
        const key = `${a},${b},${c}`;
        if (!set.has(key)) { set.add(key); result.push({ l: a, w: b, h: c }); }
    });
    return result;
}

/**
 * Check if a box at position (px, py, pz) with dims (bl, bw, bh)
 * overlaps with any placed box.
 */
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

/**
 * Find valid placement for a box inside warehouse.
 * Uses a candidate-point approach: tries corners of already-placed boxes.
 */
function findPlacement(bl, bw, bh, wl, ww, wh, placed) {
    // Generate candidate positions (extreme points / corners)
    const candidates = [{ x: 0, y: 0, z: 0 }];
    for (const p of placed) {
        candidates.push({ x: p.x + p.pl, y: p.y, z: p.z });  // right
        candidates.push({ x: p.x, y: p.y + p.ph, z: p.z });  // top
        candidates.push({ x: p.x, y: p.y, z: p.z + p.pw });  // front
    }
    // Sort candidates: prefer lower y, then smaller x, then smaller z (layer-by-layer)
    candidates.sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z);
    // Remove duplicates
    const seen = new Set();
    const unique = [];
    for (const c of candidates) {
        const key = `${c.x},${c.y},${c.z}`;
        if (!seen.has(key)) { seen.add(key); unique.push(c); }
    }
    for (const c of unique) {
        // Check bounds
        if (c.x + bl <= wl && c.y + bh <= wh && c.z + bw <= ww) {
            // Check no overlap
            if (!overlaps(c.x, c.y, c.z, bl, bw, bh, placed)) {
                return { x: c.x, y: c.y, z: c.z };
            }
        }
    }
    return null;
}

/**
 * Main packing algorithm.
 * Greedy: sort items by value/volume ratio (descending), then try to place each.
 */
function packItems(items, wl, ww, wh, allowRotation) {
    // Compute value-to-volume ratio and sort descending
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
        // Try orientations
        const orientations = allowRotation
            ? getOrientations(item.l, item.w, item.h)
            : [{ l: item.l, w: item.w, h: item.h }];
        for (const orient of orientations) {
            const pos = findPlacement(orient.l, orient.w, orient.h, wl, ww, wh, placed);
            if (pos) {
                bestPos = pos;
                bestOrient = orient;
                break; // Use first valid orientation
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
    return { placed, unpacked };
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
            row.querySelectorAll('input').forEach(inp => {
                if (!parseFloat(inp.value) || parseFloat(inp.value) <= 0) inp.classList.add('input-error');
                else inp.classList.remove('input-error');
            });
        } else {
            row.querySelectorAll('input').forEach(inp => inp.classList.remove('input-error'));
            items.push({ l, w, h, v, name: `Item ${i + 1}` });
        }
    });
    if (!valid) {
        showToast('Some items have invalid values (highlighted in red)', 'error');
        return null;
    }
    return { wl, ww, wh, items };
}

// ===== OPTIMIZE PACKING (Main Entry) =====
function optimizePacking() {
    const input = validateInputs();
    if (!input) return;
    const { wl, ww, wh, items } = input;
    const allowRotation = document.getElementById('allowRotation').checked;
    const animate = document.getElementById('animatePacking').checked;
    // Run algorithm
    const result = packItems(items, wl, ww, wh, allowRotation);
    packingResults = result;
    // Update UI
    updateStats(result, wl, ww, wh, items.length);
    updateResultsTable(result);
    // 3D Visualization
    clearScene();
    drawWarehouse(wl, ww, wh);
    resetCamera();
    document.getElementById('vizOverlay').classList.add('hidden');
    if (animate) {
        animateBoxPlacement(result.placed);
    } else {
        result.placed.forEach((item, i) => {
            const color = BOX_COLORS[i % BOX_COLORS.length];
            drawBox(item.x, item.y, item.z, item.pl, item.pw, item.ph, color, item.name);
        });
    }
    const msg = result.placed.length === items.length
        ? `All ${items.length} items packed successfully!`
        : `${result.placed.length} of ${items.length} items packed`;
    showToast(msg, result.placed.length > 0 ? 'success' : 'error');
}

// ===== ANIMATE BOX PLACEMENT =====
function animateBoxPlacement(placed) {
    let i = 0;
    function placeNext() {
        if (i >= placed.length) return;
        const item = placed[i];
        const color = BOX_COLORS[i % BOX_COLORS.length];
        const mesh = drawBox(item.x, item.y, item.z, item.pl, item.pw, item.ph, color, item.name);
        // Drop animation
        const targetY = mesh.position.y;
        mesh.position.y = targetY + 15;
        mesh.material.opacity = 0;
        const startTime = performance.now();
        const duration = 500;
        function anim(now) {
            const t = Math.min((now - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
            mesh.position.y = targetY + 15 * (1 - ease);
            mesh.material.opacity = 0.82 * ease;
            if (t < 1) requestAnimationFrame(anim);
        }
        requestAnimationFrame(anim);
        i++;
        if (i < placed.length) setTimeout(placeNext, 350);
    }
    placeNext();
}

// ===== UPDATE STATS =====
function updateStats(result, wl, ww, wh, totalItems) {
    const warehouseVol = wl * ww * wh;
    const packedVol = result.placed.reduce((s, item) => s + item.pl * item.pw * item.ph, 0);
    const totalVal = result.placed.reduce((s, item) => s + item.v, 0);
    const utilization = ((packedVol / warehouseVol) * 100).toFixed(1);
    animateNumber('statTotalValue', `$${totalVal.toLocaleString()}`);
    animateNumber('statSpaceUsed', `${utilization}%`);
    animateNumber('statItemsPacked', `${result.placed.length} / ${totalItems}`);
    animateNumber('statVolumePacked', `${packedVol.toLocaleString()} units³`);
}

function animateNumber(elId, finalText) {
    const el = document.getElementById(elId);
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => {
        el.textContent = finalText;
        el.style.transition = 'all 0.5s ease';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
    }, 100);
}

// ===== UPDATE RESULTS TABLE =====
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
                <td>${item.ratio.toFixed(2)}</td>
            `;
            tr.style.animation = `slideIn 0.3s ease ${i * 0.05}s both`;
            tbody.appendChild(tr);
        });
    } else {
        table.style.display = 'none';
        empty.style.display = 'block';
        badge.style.display = 'none';
    }
    // Unpacked items
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

// ===== RESET ALL =====
function resetAll() {
    clearScene();
    document.getElementById('warehouseLength').value = 20;
    document.getElementById('warehouseWidth').value = 15;
    document.getElementById('warehouseHeight').value = 10;
    updateWarehouseVolume();
    loadSampleItems();
    // Reset stats
    document.getElementById('statTotalValue').textContent = '$0';
    document.getElementById('statSpaceUsed').textContent = '0%';
    document.getElementById('statItemsPacked').textContent = '0 / 0';
    document.getElementById('statVolumePacked').textContent = '0 units³';
    // Reset results
    document.getElementById('resultsTable').style.display = 'none';
    document.getElementById('resultsEmpty').style.display = 'block';
    document.getElementById('resultsBadge').style.display = 'none';
    document.getElementById('unpackedSection').style.display = 'none';
    document.getElementById('vizOverlay').classList.remove('hidden');
    packingResults = null;
    showToast('Reset complete — sample data restored', 'info');
}
