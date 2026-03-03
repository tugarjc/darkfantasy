// ============================================================
// INFERNO DOMINI — Hex Grid Utilities (Axial coordinates)
// Uses axial coordinates (q, r) with cube constraint s = -q - r
// ============================================================

// Hex distance between two axial coordinates
function hexDistance(q1, r1, q2, r2) {
  return Math.max(
    Math.abs(q1 - q2),
    Math.abs(r1 - r2),
    Math.abs((q1 + r1) - (q2 + r2))
  );
}

// Get all 6 neighbors of a hex
function hexNeighbors(q, r) {
  return [
    [q + 1, r], [q - 1, r],
    [q, r + 1], [q, r - 1],
    [q + 1, r - 1], [q - 1, r + 1],
  ];
}

// Get all hexes within radius of center
function hexesInRadius(cq, cr, radius) {
  const results = [];
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      results.push([cq + dq, cr + dr]);
    }
  }
  return results;
}

// Convert axial to pixel (flat-top hexagons, size = distance center to corner)
function hexToPixel(q, r, size = 50) {
  const x = size * (3 / 2 * q);
  const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, y };
}

// Convert pixel to axial (for click detection)
function pixelToHex(x, y, size = 50) {
  const q = (2 / 3 * x) / size;
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / size;
  // Round to nearest hex
  return hexRound(q, r);
}

function hexRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);

  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }
  return { q: rq, r: rr };
}

module.exports = {
  hexDistance,
  hexNeighbors,
  hexesInRadius,
  hexToPixel,
  pixelToHex,
  hexRound,
};
