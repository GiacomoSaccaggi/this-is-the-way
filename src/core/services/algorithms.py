"""Generic algorithms that work on ANY Environment.

Each function takes an Environment and returns a path (list of nodes).
The algorithm doesn't know if it's solving a maze, driving, or navigating."""

from collections import deque
import heapq


def bfs(env):
    """Breadth-First Search: explores in waves. Uniform cost only."""
    start = env.get_start()
    queue = deque([start])
    came_from = {start: None}

    while queue:
        current = queue.popleft()
        if env.is_goal(current):
            return _reconstruct(came_from, current)
        for neighbor in env.get_neighbors(current):
            if neighbor not in came_from:
                came_from[neighbor] = current
                queue.append(neighbor)
    return []


def dfs(env):
    """Depth-First Search: dives deep, backtracks on dead ends."""
    start = env.get_start()
    stack = [start]
    came_from = {start: None}

    while stack:
        current = stack.pop()
        if env.is_goal(current):
            return _reconstruct(came_from, current)
        for neighbor in env.get_neighbors(current):
            if neighbor not in came_from:
                came_from[neighbor] = current
                stack.append(neighbor)
    return []


def dijkstra(env):
    """Dijkstra: always expands the cheapest node. Handles variable costs."""
    start = env.get_start()
    frontier = [(0, start)]
    came_from = {start: None}
    cost_so_far = {start: 0}

    while frontier:
        current_cost, current = heapq.heappop(frontier)
        if env.is_goal(current):
            return _reconstruct(came_from, current)
        if current_cost > cost_so_far.get(current, float("inf")):
            continue
        for neighbor in env.get_neighbors(current):
            new_cost = cost_so_far[current] + env.get_cost(current, neighbor)
            if new_cost < cost_so_far.get(neighbor, float("inf")):
                cost_so_far[neighbor] = new_cost
                came_from[neighbor] = current
                heapq.heappush(frontier, (new_cost, neighbor))
    return []


def a_star(env):
    """A*: Dijkstra + heuristic. Requires env to have a heuristic() method."""
    start = env.get_start()
    h = getattr(env, "heuristic", lambda n: 0)
    frontier = [(h(start), 0, start)]
    came_from = {start: None}
    cost_so_far = {start: 0}

    while frontier:
        _, current_cost, current = heapq.heappop(frontier)
        if env.is_goal(current):
            return _reconstruct(came_from, current)
        if current_cost > cost_so_far.get(current, float("inf")):
            continue
        for neighbor in env.get_neighbors(current):
            new_cost = cost_so_far[current] + env.get_cost(current, neighbor)
            if new_cost < cost_so_far.get(neighbor, float("inf")):
                cost_so_far[neighbor] = new_cost
                came_from[neighbor] = current
                priority = new_cost + h(neighbor)
                heapq.heappush(frontier, (priority, new_cost, neighbor))
    return []


def _reconstruct(came_from, current):
    """Walk back from goal to start using came_from pointers."""
    path = []
    while current is not None:
        path.append(current)
        current = came_from[current]
    path.reverse()
    return path
