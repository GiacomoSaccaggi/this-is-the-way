"""Environment Interface: abstracts Maze, Ferrari, and Google Maps into a common graph API."""

from abc import ABC, abstractmethod
import math


class Environment(ABC):
    """Standard interface that ALL algorithms use. The algorithm doesn't know
    if it's solving a maze, driving a car, or navigating Google Maps."""

    @abstractmethod
    def get_start(self):
        """Return the starting node."""

    @abstractmethod
    def get_goal(self):
        """Return the goal node (or None if unknown, e.g. exploration)."""

    @abstractmethod
    def get_neighbors(self, node):
        """Return list of reachable nodes from this node."""

    @abstractmethod
    def get_cost(self, from_node, to_node) -> float:
        """Cost of moving from from_node to to_node."""

    @abstractmethod
    def is_goal(self, node) -> bool:
        """Check if node is the goal."""


class MazeEnv(Environment):
    """Grid-based maze. All steps cost 1. You know start but NOT where the exit is
    (it's hidden somewhere in the grid). You must explore to find it."""

    def __init__(self, grid: dict):
        self.width = grid["width"]
        self.height = grid["height"]
        self.walls = set(map(tuple, grid["walls"]))
        self.start = tuple(grid["start"])
        self.end = tuple(grid["end"])

    def get_start(self):
        return self.start

    def get_goal(self):
        return self.end

    def get_neighbors(self, node):
        x, y = node
        neighbors = []
        for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < self.width and 0 <= ny < self.height and (nx, ny) not in self.walls:
                neighbors.append((nx, ny))
        return neighbors

    def get_cost(self, from_node, to_node) -> float:
        return 1.0

    def is_goal(self, node) -> bool:
        return node == self.end


class FerrariEnv(Environment):
    """Circular track — geometric simulation.
    
    State: index along the track (0..N-1). At each position the car has the
    track's direction at that point. The car can:
      - Go straight (keep same angle as previous step) → costs 1 BUT only valid
        if the straight-line position is still on the asphalt
      - Turn (adopt track's direction at current pos) → costs 3, always valid
    
    "Going straight" means maintaining the PREVIOUS angle in world space.
    If the track curves but the car doesn't turn, it goes off-track = no neighbor.
    The algorithm must decide WHERE to turn (expensive) vs go straight (cheap).
    """

    def __init__(self, track_points: list):
        import math
        self.points = track_points
        self.n = len(track_points)
        self.track_width = 25
        # Precompute angles between consecutive points
        self._angles = []
        for i in range(self.n):
            cur = self.points[i]
            nxt = self.points[(i + 1) % self.n]
            self._angles.append(math.atan2(nxt['y'] - cur['y'], nxt['x'] - cur['x']))

    def get_start(self):
        # State = (position_index, is_aligned_with_track)
        # True = car is facing track direction, False = car is going straight (prev direction)
        return (0, True)

    def get_goal(self):
        return None

    def is_goal(self, node) -> bool:
        return node[0] >= self.n

    def get_neighbors(self, node):
        import math
        pos, aligned = node
        if pos >= self.n:
            return []

        neighbors = []
        # Option 1: TURN (align with track) — always works, costs more
        neighbors.append((pos + 1, True))

        # Option 2: GO STRAIGHT (keep previous direction) — only if still on asphalt
        # Check: if car goes in prev direction, is next position within track_width?
        if pos > 0:
            prev_angle = self._angles[pos - 1]
            cur = self.points[pos]
            # Where would the car be if it went straight?
            step_len = math.sqrt(
                (self.points[(pos+1)%self.n]['x'] - cur['x'])**2 +
                (self.points[(pos+1)%self.n]['y'] - cur['y'])**2
            )
            straight_x = cur['x'] + math.cos(prev_angle) * step_len
            straight_y = cur['y'] + math.sin(prev_angle) * step_len
            # Is this point within track_width of any track point?
            on_track = any(
                (straight_x - p['x'])**2 + (straight_y - p['y'])**2 < self.track_width**2
                for p in self.points
            )
            if on_track:
                neighbors.append((pos + 1, False))  # went straight, still on track

        return neighbors

    def get_cost(self, from_node, to_node) -> float:
        # Turn = expensive (3), straight = cheap (1)
        _, aligned = to_node
        return 1.0 if not aligned else 3.0


class GoogleMapsEnv(Environment):
    """Weighted grid: you know both start AND end. Different cells have different
    traversal costs (traffic, road type). Goal: find the shortest/fastest path."""

    def __init__(self, grid: dict):
        self.width = grid["width"]
        self.height = grid["height"]
        self.walls = set(map(tuple, grid["walls"]))
        self.start = tuple(grid["start"])
        self.end = tuple(grid["end"])
        # Weights: default=1, but some cells cost more (traffic)
        self.weights = {}
        for w in grid.get("weights", []):
            self.weights[tuple(w["pos"])] = w["cost"]

    def get_start(self):
        return self.start

    def get_goal(self):
        return self.end

    def get_neighbors(self, node):
        x, y = node
        neighbors = []
        for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < self.width and 0 <= ny < self.height and (nx, ny) not in self.walls:
                neighbors.append((nx, ny))
        return neighbors

    def get_cost(self, from_node, to_node) -> float:
        return self.weights.get(to_node, 1.0)

    def is_goal(self, node) -> bool:
        return node == self.end

    def heuristic(self, node) -> float:
        """Manhattan distance to goal. Useful for A*."""
        x, y = node
        gx, gy = self.end
        return abs(x - gx) + abs(y - gy)
