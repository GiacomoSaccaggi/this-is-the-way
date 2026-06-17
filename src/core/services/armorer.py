"""The Armorer: translates English pseudocode into executable Python.

Generates a single generic `solve(env)` function that works on ANY environment.
"""

from django.conf import settings

SYSTEM_PROMPT = """You are The Armorer, an AI that translates English pseudocode into Python code.

The user's code will run against an Environment object that provides these methods:
- env.get_start() → starting node (tuple or int)
- env.get_goal() → goal node (or None)
- env.get_neighbors(node) → list of reachable nodes from this node
- env.get_cost(from_node, to_node) → float cost of traversal
- env.is_goal(node) → bool
- env.heuristic(node) → estimated distance to goal (may not exist on all envs)

You must produce a function called `solve(env)` that:
- Receives an Environment object
- Returns a list of nodes (the path from start to goal)
- Uses ONLY the env methods above — never accesses internals directly

The algorithm should reflect the user's pseudocode strategy.
Standard library imports allowed: collections, heapq, math.

Only output the Python function. No explanation. No markdown. Just raw Python code."""


def translate_pseudocode(pseudocode: str) -> str:
    if not settings.OPENAI_API_KEY:
        return _fallback_translation(pseudocode)

    import openai

    client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.chat.completions.create(
        model=settings.AI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Pseudocode:\n{pseudocode}"},
        ],
        temperature=0.2,
    )
    return response.choices[0].message.content.strip()


def _fallback_translation(pseudocode: str) -> str:
    """Keyword-based heuristic. Generates a generic solve(env)."""
    p = pseudocode.lower()

    if any(w in p for w in ["a*", "a star", "astar", "heuristic", "estimated", "manhattan"]):
        return '''def solve(env):
    from heapq import heappush, heappop
    start = env.get_start()
    h = getattr(env, 'heuristic', lambda n: 0)
    frontier = [(h(start), 0, start)]
    came_from = {start: None}
    cost_so_far = {start: 0}
    while frontier:
        _, cost, current = heappop(frontier)
        if env.is_goal(current):
            path = []
            while current is not None:
                path.append(current)
                current = came_from[current]
            path.reverse()
            return path
        if cost > cost_so_far.get(current, float("inf")):
            continue
        for neighbor in env.get_neighbors(current):
            new_cost = cost_so_far[current] + env.get_cost(current, neighbor)
            if new_cost < cost_so_far.get(neighbor, float("inf")):
                cost_so_far[neighbor] = new_cost
                came_from[neighbor] = current
                heappush(frontier, (new_cost + h(neighbor), new_cost, neighbor))
    return []
'''

    if any(w in p for w in ["priority", "cost", "cheapest", "weight", "dijkstra", "lowest"]):
        return '''def solve(env):
    from heapq import heappush, heappop
    start = env.get_start()
    frontier = [(0, start)]
    came_from = {start: None}
    cost_so_far = {start: 0}
    while frontier:
        cost, current = heappop(frontier)
        if env.is_goal(current):
            path = []
            while current is not None:
                path.append(current)
                current = came_from[current]
            path.reverse()
            return path
        if cost > cost_so_far.get(current, float("inf")):
            continue
        for neighbor in env.get_neighbors(current):
            new_cost = cost_so_far[current] + env.get_cost(current, neighbor)
            if new_cost < cost_so_far.get(neighbor, float("inf")):
                cost_so_far[neighbor] = new_cost
                came_from[neighbor] = current
                heappush(frontier, (new_cost, neighbor))
    return []
'''

    if any(w in p for w in ["stack", "deep", "dive", "last-in", "dfs", "depth"]):
        return '''def solve(env):
    start = env.get_start()
    stack = [start]
    came_from = {start: None}
    while stack:
        current = stack.pop()
        if env.is_goal(current):
            path = []
            while current is not None:
                path.append(current)
                current = came_from[current]
            path.reverse()
            return path
        for neighbor in env.get_neighbors(current):
            if neighbor not in came_from:
                came_from[neighbor] = current
                stack.append(neighbor)
    return []
'''

    return '''def solve(env):
    from collections import deque
    start = env.get_start()
    queue = deque([start])
    came_from = {start: None}
    while queue:
        current = queue.popleft()
        if env.is_goal(current):
            path = []
            while current is not None:
                path.append(current)
                current = came_from[current]
            path.reverse()
            return path
        for neighbor in env.get_neighbors(current):
            if neighbor not in came_from:
                came_from[neighbor] = current
                queue.append(neighbor)
    return []
'''
