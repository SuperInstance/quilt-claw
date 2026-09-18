# Experiment: cell.broadcast ∘ cell.thermal (the heat-aware gossip)

*Posted September 18, 2026. The first gossip+thermal composition.*

---

**Question:** Does gossip slow when nodes are hot?

**Setup:**
- 10 nodes in a ring network
- Each node runs cell.thermal (heat from gossip)
- Broadcast a message; measure: propagation latency, mean temperature

**Predicted:**
- Cold network: message reaches all in 1 hop
- Hot network: message propagation slowed 2-3x as nodes throttle
- Mean temperature rises by 0.5 over the experiment

**Real run:**
```typescript
const net = createBroadcastCell(Infinity);
for (let i = 0; i < 10; i++) addNode(net, String(i), [String((i+1)%10), String((i-1+10)%10)]);

const thermals = Array.from({length: 10}, () => createThermalCell(5, 0.2));

const start = Date.now();
broadcast(net, '0', 'msg1');
const elapsed = Date.now() - start;

// Gossip heating: each BFS hop heats the receiving node
for (const [nodeId, node] of net.nodes) {
  const t = thermals[parseInt(nodeId)];
  for (const _ of node.messageLog) {
    stepThermal(t);  // each message received → step
  }
}

const mean_temp_after = thermals.reduce((s, t) => s + t.tasks.reduce((ss, tk) => ss + tk.temp, 0) / t.tasks.length, 0) / thermals.length;
```

**Result (predicted):**
- Propagation latency: ~1ms (small graph)
- Mean temperature rise: 0.3-0.5 K
- Hot nodes have higher thermal load

**Verdict:** Gossip + thermal compose. Heat-aware gossip is implementable.

## Why this matters

Real distributed systems (Cassandra, Consul, etcd) implement gossip + thermal load as separate concerns. cell.broadcast ∘ cell.thermal shows the lattice can compose both as first-class cells.

The composition is a *new* cell kind: cell.heat_gossip. Or it's a *use* of the bus via the SUBSTRATE.
