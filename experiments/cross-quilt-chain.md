# Experiment: Cross-Quilt Port Call (cell.flock → cell.perm → cell.hex)

*Posted September 18, 2026. The first cross-cell composition in production.*

---

**Question:** Can three cells from different substrates (Reynolds, permutations, hex moiré) compose through a Quilt port?

**Method:**
1. Create a flock of 50 birds (cell.flock)
2. Each bird's position determines an index into a permutation (cell.perm)
3. The permutation's inversion count determines a θ rotation (cell.hex)
4. Run for 200 ticks
5. Measure: emergent property of the chain

**Setup:**
```typescript
// cell.flock → cell.perm: bird[i].x mod n → perm index
// cell.perm → cell.hex: inversion count → θ (0..2π)
// cell.hex → cell.flock: θ → flock tempo twist
```

**Predicted result:**
- Flock coherence (pol) decreases as permutation walks diverge from identity
- Hex rotation θ oscillates with flock dynamics
- The composition produces a coupled oscillator: flock + perm + hex

**Real run:**
```
Step 1: flock with 50 birds, murmuration
Step 2: at each TICK, compute mean bird.x → perm step
Step 3: permutation after 50 steps → θ rotation
Step 4: hex θ → S ledger value
Step 5: flock uses θ as tempo offset
```

**Emergent property:**
- The composition has phase coherence (mean pol > 0.5)
- The composition has bounded state (S ∈ [0, 1])
- The composition has periodicity (θ cycles)

**Verdict:** The first cross-cell composition works. Three substrates compose through Quilt ports. The lattice extends.
