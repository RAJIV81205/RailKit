import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

type Point = [number, number];
type RailGraph = {
  points: Point[];
  neighbors: Array<Array<[number, number]>>;
  grid: Map<string, number[]>;
  components: Int32Array;
  componentSizes: number[];
};

const GRID_SIZE = 0.05;
let graphPromise: Promise<RailGraph> | null = null;
const segmentCache = new Map<string, Point[]>();

function pointKey(point: Point) {
  return `${point[0].toFixed(3)},${point[1].toFixed(3)}`;
}

function gridKey(lat: number, lon: number) {
  return `${Math.floor(lat / GRID_SIZE)},${Math.floor(lon / GRID_SIZE)}`;
}

function distance(a: Point, b: Point) {
  const latScale = Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180);
  return Math.hypot((a[0] - b[0]) * 111, (a[1] - b[1]) * 111 * latScale);
}

function pathDistance(points: Point[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }
  return total;
}

async function loadGraph(): Promise<RailGraph> {
  if (graphPromise) return graphPromise;
  graphPromise = (async () => {
    const filePath = path.join(process.cwd(), "public", "data", "india-railways.json");
    const payload = JSON.parse(await fs.readFile(filePath, "utf8")) as { lines: Point[][] };
    const points: Point[] = [];
    const neighbors: Array<Array<[number, number]>> = [];
    const ids = new Map<string, number>();
    const grid = new Map<string, number[]>();

    const getId = (point: Point) => {
      const key = pointKey(point);
      const existing = ids.get(key);
      if (existing !== undefined) return existing;
      const id = points.length;
      points.push(point);
      neighbors.push([]);
      ids.set(key, id);
      const cell = gridKey(point[0], point[1]);
      const bucket = grid.get(cell) || [];
      bucket.push(id);
      grid.set(cell, bucket);
      return id;
    };

    for (const line of payload.lines) {
      for (let index = 1; index < line.length; index += 1) {
        const from = getId(line[index - 1]);
        const to = getId(line[index]);
        if (from === to) continue;
        const weight = distance(points[from], points[to]);
        neighbors[from].push([to, weight]);
        neighbors[to].push([from, weight]);
      }
    }
    const components = new Int32Array(points.length).fill(-1);
    const componentSizes: number[] = [];
    for (let start = 0; start < points.length; start += 1) {
      if (components[start] !== -1) continue;
      const component = componentSizes.length;
      const stack = [start];
      components[start] = component;
      let size = 0;
      while (stack.length) {
        const node = stack.pop()!;
        size += 1;
        for (const [next] of neighbors[node]) {
          if (components[next] !== -1) continue;
          components[next] = component;
          stack.push(next);
        }
      }
      componentSizes.push(size);
    }
    return { points, neighbors, grid, components, componentSizes };
  })();
  return graphPromise;
}

function nearestByComponent(graph: RailGraph, target: Point) {
  const baseLat = Math.floor(target[0] / GRID_SIZE);
  const baseLon = Math.floor(target[1] / GRID_SIZE);
  const nearest = new Map<number, { id: number; distance: number }>();
  for (let radius = 0; radius <= 6; radius += 1) {
    for (let latOffset = -radius; latOffset <= radius; latOffset += 1) {
      for (let lonOffset = -radius; lonOffset <= radius; lonOffset += 1) {
        if (radius > 0 && Math.abs(latOffset) !== radius && Math.abs(lonOffset) !== radius) continue;
        const ids = graph.grid.get(`${baseLat + latOffset},${baseLon + lonOffset}`) || [];
        for (const id of ids) {
          const candidateDistance = distance(target, graph.points[id]);
          const component = graph.components[id];
          const current = nearest.get(component);
          if (!current || candidateDistance < current.distance) nearest.set(component, { id, distance: candidateDistance });
        }
      }
    }
  }
  return nearest;
}

function connectedPair(graph: RailGraph, from: Point, to: Point) {
  const starts = nearestByComponent(graph, from);
  const ends = nearestByComponent(graph, to);
  let best: { start: number; end: number; score: number } | null = null;
  for (const [component, start] of starts) {
    const end = ends.get(component);
    if (!end || graph.componentSizes[component] < 5) continue;
    const score = start.distance + end.distance - Math.min(5, Math.log10(graph.componentSizes[component] + 1));
    if (!best || score < best.score) best = { start: start.id, end: end.id, score };
  }
  return best;
}

class MinHeap {
  private values: Array<[number, number]> = [];

  push(value: [number, number]) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent][0] <= value[0]) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }

  pop() {
    if (!this.values.length) return null;
    const root = this.values[0];
    const tail = this.values.pop();
    if (!this.values.length || !tail) return root;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.values.length) break;
      const child = right < this.values.length && this.values[right][0] < this.values[left][0] ? right : left;
      if (this.values[child][0] >= tail[0]) break;
      this.values[index] = this.values[child];
      index = child;
    }
    this.values[index] = tail;
    return root;
  }
}

function findPath(graph: RailGraph, start: number, goal: number) {
  if (start === goal) return [graph.points[start]];
  const queue = new MinHeap();
  const costs = new Map<number, number>([[start, 0]]);
  const previous = new Map<number, number>();
  queue.push([distance(graph.points[start], graph.points[goal]), start]);
  let visited = 0;

  while (visited < 100_000) {
    const item = queue.pop();
    if (!item) break;
    const current = item[1];
    if (current === goal) {
      const ids = [goal];
      let node = goal;
      while (previous.has(node)) {
        node = previous.get(node)!;
        ids.push(node);
      }
      ids.reverse();
      return ids.map((id) => graph.points[id]);
    }
    visited += 1;
    const currentCost = costs.get(current)!;
    for (const [next, weight] of graph.neighbors[current]) {
      const nextCost = currentCost + weight;
      if (nextCost >= (costs.get(next) ?? Number.POSITIVE_INFINITY)) continue;
      costs.set(next, nextCost);
      previous.set(next, current);
      queue.push([nextCost + distance(graph.points[next], graph.points[goal]), next]);
    }
  }
  return [];
}

export async function routeAlongRailways(waypoints: Point[]) {
  const graph = await loadGraph();
  const route: Point[] = [];
  for (let index = 1; index < waypoints.length; index += 1) {
    const from = waypoints[index - 1];
    const to = waypoints[index];
    const directDistance = distance(from, to);
    const pair = connectedPair(graph, from, to);
    if (!pair) {
      route.push(...(route.length ? [to] : [from, to]));
      continue;
    }
    const { start, end } = pair;
    const cacheKey = `${start}:${end}`;
    const reverseKey = `${end}:${start}`;
    let segment = segmentCache.get(cacheKey);
    if (!segment) {
      const reverse = segmentCache.get(reverseKey);
      segment = reverse ? [...reverse].reverse() : findPath(graph, start, end);
      if (segment.length) {
        if (segmentCache.size >= 500) segmentCache.delete(segmentCache.keys().next().value!);
        segmentCache.set(cacheKey, segment);
      }
    }
    const snappedSegment = segment.length ? [from, ...segment, to] : [];
    const snapDistance = distance(from, graph.points[start]) + distance(graph.points[end], to);
    const railDistance = pathDistance(snappedSegment);
    const maxSnapDistance = Math.max(8, directDistance * 0.3);
    const maxRailDistance = Math.max(directDistance + 15, directDistance * 1.75 + 5);
    const usableRailSegment = snappedSegment.length > 2
      && snapDistance <= maxSnapDistance
      && railDistance <= maxRailDistance;
    const chosenSegment = usableRailSegment ? snappedSegment : [from, to];
    route.push(...(route.length ? chosenSegment.slice(1) : chosenSegment));
  }
  return route;
}
