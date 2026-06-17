# This Is The Way 🛡️

Forging Python pathfinding algorithms from English pseudocode via AI and secure Docker sandboxing.

> *"I can bring you in warm, or I can bring you in cold."*
> — but your algorithm better find the way.

## What Is This?

An interactive web app where you describe pathfinding strategies in plain English, and an AI (The Armorer) forges them into executable Python code. The code runs in an isolated Docker sandbox (The Beskar Vault) against various environments — mazes, race tracks, weighted maps — with real-time animated visualization.

**The twist:** your algorithm doesn't know what kind of environment it's solving. It only gets a generic interface (`get_neighbors`, `get_cost`, `is_goal`). Write one strategy, watch it tackle any terrain.

## Challenges

| Mode | Description | You Know | You Don't Know |
|------|-------------|----------|----------------|
| 🏰 **Maze** | Grid with walls, find the hidden exit | Start position | Where the exit is |
| 🏎️ **Ferrari** | Circular track, minimize lap time | Track exists | Track shape ahead |
| 📍 **Google Maps** | Weighted grid, find optimal route | Start AND end | Which path is cheapest |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser (HUD)                                      │
│  ┌──────────────┐  ┌────────────────────────────┐   │
│  │ Pseudocode   │  │ Canvas Visualization        │   │
│  │ Editor       │  │ (grid/track/map + animation)│   │
│  └──────┬───────┘  └────────────────────────────┘   │
└─────────┼───────────────────────────────────────────┘
          │ POST /api/submit/
          ▼
┌─────────────────────────────────────────────────────┐
│  Django Backend                                     │
│                                                     │
│  ┌────────────┐    ┌──────────────┐                 │
│  │ The Armorer │───▶│ Beskar Vault │                 │
│  │ (AI/GPT)   │    │ (Docker)     │                 │
│  └────────────┘    └──────────────┘                 │
│   pseudocode →       generated code →                │
│   Python code        execution result                │
└─────────────────────────────────────────────────────┘
```

### Components

- **The Armorer** (`services/armorer.py`) — Translates English pseudocode into a `solve(env)` function via OpenAI. Falls back to keyword heuristics (detects BFS/DFS/Dijkstra/A* patterns) when no API key is configured.

- **The Beskar Vault** (`services/vault.py`) — Executes untrusted code in a Docker container with no network, read-only filesystem, memory/CPU limits, and a timeout. Falls back to local `exec()` for development.

- **Environments** (`services/environments.py`) — Abstract `Environment` interface with three implementations:
  - `MazeEnv` — uniform-cost grid
  - `FerrariEnv` — circular track with turn/straight cost tradeoffs
  - `GoogleMapsEnv` — weighted grid with heuristic support

- **Algorithms** (`services/algorithms.py`) — Reference implementations of BFS, DFS, Dijkstra, and A* that work on any `Environment`.

## Quick Start

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) package manager
- Docker (optional, for sandbox isolation)

### Run locally (no Docker)

```bash
# Install dependencies
uv sync

# Set up environment
cp .env.example .env
# Edit .env — add your OPENAI_API_KEY (optional, fallback works without it)

# Initialize database and load maps
uv run python src/manage.py migrate
uv run python src/manage.py load_maps

# Run the server
uv run python src/manage.py runserver
```

Open http://localhost:8000 — write pseudocode, hit Execute, watch the algorithm explore.

### Run with Docker (full sandbox isolation)

```bash
cp .env.example .env
# Edit .env with your settings

docker compose up --build
```

This builds both the Django app and the `beskar-vault` sandbox image.

## Environment Interface

Every algorithm receives an `env` object with this interface:

```python
env.get_start()              # → starting node
env.get_goal()               # → goal node (or None)
env.get_neighbors(node)      # → list of reachable nodes
env.get_cost(from, to)       # → float traversal cost
env.is_goal(node)            # → bool
env.heuristic(node)          # → estimated distance (optional)
```

Your `solve(env)` function must return a list of nodes (the path from start to goal).

## Example Pseudocode

```
Use a priority queue. Always expand the node with the lowest
estimated total cost (cost so far + manhattan distance to goal).
Track visited nodes to avoid cycles.
```

The Armorer turns this into A* and runs it against whatever environment is active.

## Project Structure

```
this-is-the-way/
├── src/
│   ├── config/              # Django settings, URLs, WSGI
│   ├── core/
│   │   ├── models.py        # Map and Submission models
│   │   ├── views.py         # HUD view + submission API
│   │   ├── services/
│   │   │   ├── armorer.py   # AI pseudocode → Python
│   │   │   ├── vault.py     # Isolated code execution
│   │   │   ├── environments.py  # Maze/Ferrari/GoogleMaps
│   │   │   └── algorithms.py    # Reference BFS/DFS/Dijkstra/A*
│   │   └── management/
│   │       └── commands/
│   │           └── load_maps.py
│   ├── templates/
│   │   ├── base.html
│   │   └── core/hud.html    # Interactive HUD interface
│   └── static/
│       ├── css/hud.css       # Dark-themed HUD styling
│       └── js/simulation.js  # Canvas rendering + animation
├── sandbox/
│   ├── Dockerfile.sandbox    # Minimal Alpine container
│   ├── runner.py             # Sandbox entrypoint
│   └── maps/                 # JSON map definitions
├── Dockerfile                # Django app container
├── docker-compose.yml        # Full-stack orchestration
├── pyproject.toml            # Dependencies (Django, OpenAI)
└── .env.example              # Environment variable template
```

## Security Model

The Beskar Vault provides defense-in-depth for executing AI-generated code:

1. **Network isolation** — `--network=none` (no outbound connections)
2. **Read-only filesystem** — `--read-only` (can't write to disk)
3. **Resource limits** — configurable memory (128MB) and CPU (0.5 cores)
4. **Timeout** — hard kill after 10 seconds (configurable)
5. **Unprivileged user** — runs as `runner`, not root
6. **Minimal image** — Python 3.12 Alpine, nothing else installed

## Tech Stack

- **Backend:** Django 5.1, Python 3.12
- **AI:** OpenAI API (GPT-4o-mini default)
- **Frontend:** Vanilla JS, HTML5 Canvas
- **Sandbox:** Docker with resource constraints
- **Package Manager:** uv

## License

MIT
