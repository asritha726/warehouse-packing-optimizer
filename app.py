"""
Warehouse Packing Optimizer - Backend API
FastAPI backend for 3D Bin Packing and space optimization.
"""

import os
import io
import csv
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

app = FastAPI(
    title="Warehouse Packing Optimizer API",
    description="3D Bin Packing and warehouse space optimization API.",
    version="1.0.0"
)

# Enable CORS for local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


# --- Request & Response Models ---
class ItemModel(BaseModel):
    name: str = "Item"
    l: float
    w: float
    h: float
    v: float = 10.0


class WarehouseModel(BaseModel):
    length: float
    width: float
    height: float


class OptimizeRequest(BaseModel):
    warehouse: WarehouseModel
    items: List[ItemModel]
    allow_rotation: bool = True


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


# --- Packing Algorithm (Greedy Heuristic) ---
def get_orientations(l: float, w: float, h: float, allow_rotation: bool):
    if not allow_rotation:
        return [(l, w, h)]
    perms = [
        (l, w, h), (l, h, w),
        (w, l, h), (w, h, l),
        (h, l, w), (h, w, l)
    ]
    seen = set()
    result = []
    for p in perms:
        if p not in seen:
            seen.add(p)
            result.append(p)
    return result


def overlaps(px, py, pz, bl, bh, bw, placed):
    for p in placed:
        if (px < p['x'] + p['pl'] and px + bl > p['x'] and
            py < p['y'] + p['ph'] and py + bh > p['y'] and
            pz < p['z'] + p['pw'] and pz + bw > p['z']):
            return True
    return False


def find_placement(bl, bh, bw, wl, wh, ww, placed):
    candidates = [(0.0, 0.0, 0.0)]
    for p in placed:
        candidates.append((p['x'] + p['pl'], p['y'], p['z']))
        candidates.append((p['x'], p['y'] + p['ph'], p['z']))
        candidates.append((p['x'], p['y'], p['z'] + p['pw']))

    candidates.sort(key=lambda c: (c[1], c[0], c[2]))

    seen = set()
    for c in candidates:
        if c in seen:
            continue
        seen.add(c)
        cx, cy, cz = c
        if cx + bl <= wl and cy + bh <= wh and cz + bw <= ww:
            if not overlaps(cx, cy, cz, bl, bh, bw, placed):
                return {'x': cx, 'y': cy, 'z': cz}
    return None


@app.get("/api/health")
def health_check():
    return {"status": "ok", "backend": "FastAPI (Python)"}


@app.post("/api/auth/login")
def auth_login(req: LoginRequest):
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password required")
    name = req.email.split("@")[0].capitalize()
    return {
        "status": "success",
        "token": "demo-jwt-token-xyz",
        "user": {
            "name": name if name else "Alex",
            "email": req.email
        }
    }


@app.post("/api/auth/signup")
def auth_signup(req: SignupRequest):
    if not req.email or not req.password or not req.name:
        raise HTTPException(status_code=400, detail="All fields required")
    return {
        "status": "success",
        "token": "demo-jwt-token-xyz",
        "user": {
            "name": req.name,
            "email": req.email
        }
    }


@app.post("/api/optimize")
def optimize_packing(req: OptimizeRequest):
    wl, ww, wh = req.warehouse.length, req.warehouse.width, req.warehouse.height
    if wl <= 0 or ww <= 0 or wh <= 0:
        raise HTTPException(status_code=400, detail="Invalid warehouse dimensions")

    # Sort items by value-to-volume ratio descending
    items_with_ratio = []
    for idx, it in enumerate(req.items):
        vol = it.l * it.w * it.h
        ratio = (it.v / vol) if vol > 0 else 0
        items_with_ratio.append({
            "name": it.name or f"Item {idx + 1}",
            "l": it.l, "w": it.w, "h": it.h, "v": it.v,
            "volume": vol, "ratio": round(ratio, 2)
        })

    items_with_ratio.sort(key=lambda x: x["ratio"], reverse=True)

    placed = []
    unpacked = []

    for item in items_with_ratio:
        orientations = get_orientations(item["l"], item["w"], item["h"], req.allow_rotation)
        best_pos = None
        best_orient = None

        for ol, ow, oh in orientations:
            pos = find_placement(ol, oh, ow, wl, wh, ww, placed)
            if pos:
                best_pos = pos
                best_orient = (ol, ow, oh)
                break

        if best_pos and best_orient:
            ol, ow, oh = best_orient
            placed.append({
                **item,
                "x": best_pos["x"],
                "y": best_pos["y"],
                "z": best_pos["z"],
                "pl": ol, "pw": ow, "ph": oh
            })
        else:
            unpacked.append({
                **item,
                "reason": "No space available"
            })

    warehouse_volume = wl * ww * wh
    packed_volume = sum(p["pl"] * p["pw"] * p["ph"] for p in placed)
    total_value = sum(p["v"] for p in placed)
    space_utilization = round((packed_volume / warehouse_volume) * 100, 1) if warehouse_volume > 0 else 0

    return {
        "placed": placed,
        "unpacked": unpacked,
        "stats": {
            "total_value": total_value,
            "space_utilization": space_utilization,
            "packed_count": len(placed),
            "total_count": len(req.items),
            "packed_volume": packed_volume,
            "warehouse_volume": warehouse_volume
        }
    }


@app.post("/api/export")
def export_csv(req: OptimizeRequest):
    # Run optimization and return downloadable CSV report
    opt_result = optimize_packing(req)
    placed = opt_result["placed"]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Item", "Length", "Width", "Height", "Pos X", "Pos Y", "Pos Z", "Volume", "Value ($)"])
    for p in placed:
        writer.writerow([p["name"], p["pl"], p["pw"], p["ph"], p["x"], p["y"], p["z"], p["volume"], p["v"]])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=packing_report.csv"}
    )


# Serve Static Frontend Files
app.mount("/static", StaticFiles(directory=BASE_DIR), name="static")


@app.get("/")
def serve_index():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))


@app.get("/{path_name}")
def serve_root_files(path_name: str):
    file_path = os.path.join(BASE_DIR, path_name)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print("🚀 Starting Warehouse Packing Optimizer Server...")
    print(f"📍 Open in browser: http://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
