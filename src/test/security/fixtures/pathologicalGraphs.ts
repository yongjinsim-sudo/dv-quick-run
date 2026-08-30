export interface PathologicalGraphFixture {
  id: string;
  start: string;
  adjacency: Readonly<Record<string, readonly string[]>>;
}

const highFanOutTargets = Array.from({ length: 256 }, (_, index) => `target_${index}`);
const deepNodes = Array.from({ length: 64 }, (_, index) => `node_${index}`);
const deepAdjacency: Record<string, readonly string[]> = {};
for (let index = 0; index < deepNodes.length - 1; index += 1) {
  deepAdjacency[deepNodes[index]] = [deepNodes[index + 1]];
}
deepAdjacency[deepNodes[deepNodes.length - 1]] = [];

export const pathologicalGraphFixtures: readonly PathologicalGraphFixture[] = [
  { id: "self-cycle", start: "contact", adjacency: { contact: ["contact"] } },
  { id: "two-node-cycle", start: "contact", adjacency: { contact: ["account"], account: ["contact"] } },
  { id: "long-cycle", start: "a", adjacency: { a: ["b"], b: ["c"], c: ["d"], d: ["a"] } },
  { id: "diamond", start: "a", adjacency: { a: ["b", "c"], b: ["d"], c: ["d"], d: [] } },
  { id: "high-fan-out", start: "root", adjacency: { root: highFanOutTargets } },
  { id: "high-fan-in", start: "root", adjacency: { root: ["a", "b", "c", "d"], a: ["target"], b: ["target"], c: ["target"], d: ["target"], target: [] } },
  { id: "deep-beyond-normal-bound", start: deepNodes[0], adjacency: deepAdjacency },
  { id: "repeated-equivalent-branches", start: "root", adjacency: { root: ["a", "a", "a", "b", "b"], a: ["target"], b: ["target"], target: [] } }
] as const;
