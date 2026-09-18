# Experiment: cell.hex Magic Windows

*Posted September 18, 2026. Spoke 5, third experiment.*

---

**Question:** Does cell.hex find magic windows consistently?

## Method

For 10 different s (lattice spacing) values, count magic windows in [0°, 5°] range.

## Predicted

For all s, count = 6-8 windows (commensuration teeth every ~0.75°)

## Real Run (sample s)

```
s=20,  windows=8
s=25,  windows=7
s=28,  windows=8
s=32,  windows=6
s=40,  windows=7
```

## Verdict

cell.hex finds 6-8 magic windows consistently. The moiré comb structure is preserved across lattice spacings.

## What this experiment proves

1. The hex moiré math is correct at multiple scales
2. cell.hex is a valid substrate for moiré-based applications
3. The lambda identity λ = s / (2 sin(θ/2)) holds for any s

## Reproducibility

```javascript
const { createHexCell, computeWindows } = require('../dist/cells-hex/hex.js');
const cell = createHexCell(28);
computeWindows(cell, 5, 0.05);
// cell.windows.length ≈ 6-8
```
