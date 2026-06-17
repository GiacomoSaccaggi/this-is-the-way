"""The Beskar Vault: executes untrusted code in an isolated Docker container."""

import json
import subprocess
import tempfile
from pathlib import Path

from django.conf import settings

RUNNER_WRAPPER = '''
import json, sys, time

class MazeEnv:
    def __init__(self, grid):
        self.width = grid["width"]
        self.height = grid["height"]
        self.walls = set(map(tuple, grid["walls"]))
        self.start = tuple(grid["start"])
        self.end = tuple(grid["end"])
    def get_start(self): return self.start
    def get_goal(self): return self.end
    def get_neighbors(self, node):
        x, y = node
        return [(nx,ny) for dx,dy in [(0,1),(0,-1),(1,0),(-1,0)]
                for nx,ny in [(x+dx,y+dy)]
                if 0<=nx<self.width and 0<=ny<self.height and (nx,ny) not in self.walls]
    def get_cost(self, f, t): return 1.0
    def is_goal(self, node): return node == self.end
    def heuristic(self, node):
        return abs(node[0]-self.end[0]) + abs(node[1]-self.end[1])

class GoogleMapsEnv(MazeEnv):
    def __init__(self, grid):
        super().__init__(grid)
        self.weights = {{}}
        for w in grid.get("weights", []):
            self.weights[tuple(w["pos"])] = w["cost"]
    def get_cost(self, f, t): return self.weights.get(t, 1.0)

class FerrariEnv:
    def __init__(self, track):
        import math
        self.track = track
        self.n = len(track)
        self.track_width = 25
        self._angles = []
        for i in range(self.n):
            cur = track[i]; nxt = track[(i+1)%self.n]
            self._angles.append(math.atan2(nxt['y']-cur['y'], nxt['x']-cur['x']))
    def get_start(self): return (0, True)
    def get_goal(self): return None
    def is_goal(self, node): return node[0] >= self.n
    def get_neighbors(self, node):
        import math
        pos, aligned = node
        if pos >= self.n: return []
        neighbors = [(pos+1, True)]  # turn: always valid
        if pos > 0:
            prev_angle = self._angles[pos-1]
            cur = self.track[pos]; nxt = self.track[(pos+1)%self.n]
            step_len = math.sqrt((nxt['x']-cur['x'])**2+(nxt['y']-cur['y'])**2)
            sx = cur['x']+math.cos(prev_angle)*step_len
            sy = cur['y']+math.sin(prev_angle)*step_len
            if any((sx-p['x'])**2+(sy-p['y'])**2 < self.track_width**2 for p in self.track):
                neighbors.append((pos+1, False))  # straight: only if on asphalt
        return neighbors
    def get_cost(self, f, t):
        return 1.0 if not t[1] else 3.0

class TrackedEnv:
    def __init__(self, env):
        self._env = env
        self.explored = []
        self._seen = set()
    def get_start(self):
        s = self._env.get_start()
        self._record(s)
        return s
    def get_goal(self): return self._env.get_goal()
    def get_neighbors(self, node):
        ns = self._env.get_neighbors(node)
        for n in ns: self._record(n)
        return ns
    def get_cost(self, f, t): return self._env.get_cost(f, t)
    def is_goal(self, node): return self._env.is_goal(node)
    def heuristic(self, node):
        return getattr(self._env, 'heuristic', lambda n: 0)(node)
    def _record(self, node):
        if node not in self._seen:
            self._seen.add(node)
            self.explored.append(node)

{user_code}

data = json.loads(sys.argv[1])
grid = data["grid"]

if "track_points" in grid:
    base_env = FerrariEnv(grid["track_points"])
elif grid.get("weights"):
    base_env = GoogleMapsEnv(grid)
else:
    base_env = MazeEnv(grid)

tracked = TrackedEnv(base_env)
try:
    t0 = time.perf_counter()
    path = solve(tracked)
    elapsed = time.perf_counter() - t0
    path = [list(p) if isinstance(p, tuple) else p for p in path]
    explored = [list(p) if isinstance(p, tuple) else p for p in tracked.explored]
    print(json.dumps({{"success": True, "path": path, "explored": explored, "time_ms": round(elapsed*1000, 2)}}))
except Exception as e:
    print(json.dumps({{"success": False, "error": str(e)}}))
'''

ENV_CODE = '''
class MazeEnv:
    def __init__(self, grid):
        self.width = grid["width"]
        self.height = grid["height"]
        self.walls = set(map(tuple, grid["walls"]))
        self.start = tuple(grid["start"])
        self.end = tuple(grid["end"])
    def get_start(self): return self.start
    def get_goal(self): return self.end
    def get_neighbors(self, node):
        x, y = node
        return [(nx,ny) for dx,dy in [(0,1),(0,-1),(1,0),(-1,0)]
                for nx,ny in [(x+dx,y+dy)]
                if 0<=nx<self.width and 0<=ny<self.height and (nx,ny) not in self.walls]
    def get_cost(self, f, t): return 1.0
    def is_goal(self, node): return node == self.end
    def heuristic(self, node):
        return abs(node[0]-self.end[0]) + abs(node[1]-self.end[1])

class GoogleMapsEnv(MazeEnv):
    def __init__(self, grid):
        super().__init__(grid)
        self.weights = {}
        for w in grid.get("weights", []):
            self.weights[tuple(w["pos"])] = w["cost"]
    def get_cost(self, f, t): return self.weights.get(t, 1.0)

class FerrariEnv:
    def __init__(self, track):
        import math
        self.track = track
        self.n = len(track)
        self.track_width = 25
        self._angles = []
        for i in range(self.n):
            cur = track[i]; nxt = track[(i+1)%self.n]
            self._angles.append(math.atan2(nxt['y']-cur['y'], nxt['x']-cur['x']))
    def get_start(self): return (0, True)
    def get_goal(self): return None
    def is_goal(self, node): return node[0] >= self.n
    def get_neighbors(self, node):
        import math
        pos, aligned = node
        if pos >= self.n: return []
        neighbors = [(pos+1, True)]  # turn: always valid
        if pos > 0:
            prev_angle = self._angles[pos-1]
            cur = self.track[pos]; nxt = self.track[(pos+1)%self.n]
            step_len = math.sqrt((nxt['x']-cur['x'])**2+(nxt['y']-cur['y'])**2)
            sx = cur['x']+math.cos(prev_angle)*step_len
            sy = cur['y']+math.sin(prev_angle)*step_len
            if any((sx-p['x'])**2+(sy-p['y'])**2 < self.track_width**2 for p in self.track):
                neighbors.append((pos+1, False))  # straight: only if on asphalt
        return neighbors
    def get_cost(self, f, t):
        return 1.0 if not t[1] else 3.0

class TrackedEnv:
    def __init__(self, env):
        self._env = env
        self.explored = []
        self._seen = set()
    def get_start(self):
        s = self._env.get_start()
        self._record(s)
        return s
    def get_goal(self): return self._env.get_goal()
    def get_neighbors(self, node):
        ns = self._env.get_neighbors(node)
        for n in ns: self._record(n)
        return ns
    def get_cost(self, f, t): return self._env.get_cost(f, t)
    def is_goal(self, node): return self._env.is_goal(node)
    def heuristic(self, node):
        return getattr(self._env, 'heuristic', lambda n: 0)(node)
    def _record(self, node):
        if node not in self._seen:
            self._seen.add(node)
            self.explored.append(node)
'''


def execute_in_vault(python_code: str, grid_json: dict) -> dict:
    """Try Docker first, fall back to local execution if Docker unavailable."""
    try:
        return _execute_docker(python_code, grid_json)
    except (FileNotFoundError, OSError):
        return _execute_local(python_code, grid_json)


def _execute_local(python_code: str, grid_json: dict) -> dict:
    """Execute in-process. Env chosen by grid shape."""
    import time

    exec_globals = {}
    try:
        exec(ENV_CODE, exec_globals)
        exec(python_code, exec_globals)

        solve_fn = exec_globals.get("solve")
        if not solve_fn:
            return {"success": False, "error": "No solve() function found", "path": None}

        if "track_points" in grid_json:
            base_env = exec_globals["FerrariEnv"](grid_json["track_points"])
        elif grid_json.get("weights"):
            base_env = exec_globals["GoogleMapsEnv"](grid_json)
        else:
            base_env = exec_globals["MazeEnv"](grid_json)

        tracked = exec_globals["TrackedEnv"](base_env)
        t0 = time.perf_counter()
        path = solve_fn(tracked)
        elapsed = time.perf_counter() - t0
        path = [list(p) if isinstance(p, tuple) else p for p in path]
        explored = [list(p) if isinstance(p, tuple) else p for p in tracked.explored]
        return {"success": True, "path": path, "explored": explored, "time_ms": round(elapsed * 1000, 2)}

    except Exception as e:
        return {"success": False, "error": str(e), "path": None}


def _execute_docker(python_code: str, grid_json: dict) -> dict:
    code = RUNNER_WRAPPER.format(user_code=python_code)

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(code)
        code_path = f.name

    payload = json.dumps({"grid": grid_json})

    try:
        result = subprocess.run(
            ["docker", "run", "--rm", "--network=none",
             f"--memory={settings.SANDBOX_MEMORY}", f"--cpus={settings.SANDBOX_CPU}",
             "--read-only", "-v", f"{code_path}:/sandbox/mission.py:ro",
             "--entrypoint", "python", settings.SANDBOX_IMAGE,
             "/sandbox/mission.py", payload],
            capture_output=True, text=True, timeout=settings.SANDBOX_TIMEOUT,
        )
        if result.returncode != 0:
            return {"success": False, "error": result.stderr[:500], "path": None}
        return json.loads(result.stdout)
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Execution timed out.", "path": None}
    except (json.JSONDecodeError, Exception) as e:
        return {"success": False, "error": str(e), "path": None}
    finally:
        Path(code_path).unlink(missing_ok=True)
