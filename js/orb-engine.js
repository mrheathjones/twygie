/* ═══ orb-engine.js ═══ Soft Collision Avoidance Engine ═══
 *
 * A reusable physics engine for orb/bubble avoidance during drag.
 * Framework-agnostic — works with any rendering layer.
 *
 * ARCHITECTURE:
 *   OrbEngine manages a set of orbs with position, velocity, home,
 *   and radius. A requestAnimationFrame loop runs continuously when
 *   orbs are displaced, applying:
 *     1. Repulsion from the actively-dragged orb
 *     2. Orb-to-orb separation (no overlap)
 *     3. Spring return toward home position
 *     4. Velocity damping for smooth deceleration
 *     5. Boundary clamping
 *
 * USAGE:
 *   const engine = new OrbEngine({ onUpdate: (orbs) => redraw(orbs) });
 *   engine.addOrb({ id, x, y, radius });
 *   engine.dragStart(id);
 *   engine.dragMove(x, y);
 *   engine.dragEnd();
 *
 * ═══════════════════════════════════════════════════════════════════ */

class OrbEngine {

  // ─── TUNABLE PARAMETERS ──────────────────────────────────────────
  static DEFAULTS = {
    repulsionRadius:   120,   // how far the dragged orb's influence extends
    minimumSeparation: 48,    // hard minimum distance between any two orb edges
    springStrength:    0.06,  // how fast orbs return home (0-1, lower = softer)
    damping:           0.82,  // velocity decay per frame (0-1, higher = more slide)
    pushStrength:      0.8,   // force multiplier for repulsion
    maxVelocity:       12,    // cap to prevent instability
    edgePadding:       20,    // min distance from container bounds
    returnBias:        0.03,  // gentle constant pull toward home
    dragInfluenceFalloff: 2,  // exponent for distance falloff (2 = inverse square)
  };

  constructor(config = {}) {
    this.config = { ...OrbEngine.DEFAULTS, ...config };
    this.orbs = new Map();        // id → orb state
    this.draggedId = null;        // currently dragged orb id
    this.animId = null;           // rAF handle
    this.running = false;
    this.onUpdate = config.onUpdate || null;  // callback: (orbsArray) => void
    this.bounds = config.bounds || null;       // {x, y, width, height} or null
  }

  // ─── ORB MANAGEMENT ────────────────────────────────────────────────

  addOrb({ id, x, y, radius = 8 }) {
    this.orbs.set(id, {
      id,
      x, y,               // current position
      homeX: x, homeY: y, // resting position
      vx: 0, vy: 0,       // velocity
      radius,
      displaced: false,    // true when pushed away from home
    });
  }

  removeOrb(id) {
    this.orbs.delete(id);
  }

  updateHome(id, x, y) {
    const orb = this.orbs.get(id);
    if (orb) { orb.homeX = x; orb.homeY = y; }
  }

  updatePosition(id, x, y) {
    const orb = this.orbs.get(id);
    if (orb) { orb.x = x; orb.y = y; orb.homeX = x; orb.homeY = y; }
  }

  clear() {
    this.orbs.clear();
    this.stop();
  }

  getOrb(id) { return this.orbs.get(id); }
  getAllOrbs() { return [...this.orbs.values()]; }

  // ─── DRAG INTERFACE ────────────────────────────────────────────────

  dragStart(id) {
    this.draggedId = id;
    this.start();
  }

  dragMove(x, y) {
    if (!this.draggedId) return;
    const orb = this.orbs.get(this.draggedId);
    if (orb) {
      orb.x = x;
      orb.y = y;
    }
  }

  dragEnd() {
    this.draggedId = null;
    // Don't stop — let orbs spring back
  }

  // ─── ANIMATION LOOP ───────────────────────────────────────────────

  start() {
    if (this.running) return;
    this.running = true;
    this._tick();
  }

  stop() {
    this.running = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  _tick() {
    if (!this.running) return;
    const moved = this._update();
    if (this.onUpdate) this.onUpdate(this.getAllOrbs());

    // Keep running while anything is displaced or being dragged
    if (moved || this.draggedId) {
      this.animId = requestAnimationFrame(() => this._tick());
    } else {
      this.running = false;
      this.animId = null;
    }
  }

  // ─── PHYSICS UPDATE (one frame) ───────────────────────────────────

  _update() {
    const {
      repulsionRadius, minimumSeparation, springStrength,
      damping, pushStrength, maxVelocity, edgePadding,
      returnBias, dragInfluenceFalloff
    } = this.config;

    const orbs = this.getAllOrbs();
    const dragged = this.draggedId ? this.orbs.get(this.draggedId) : null;
    let anyMoved = false;

    for (const orb of orbs) {
      // Skip the actively-dragged orb — it follows the pointer directly
      if (orb.id === this.draggedId) continue;

      let fx = 0, fy = 0; // accumulated force

      // ── 1. REPULSION FROM DRAGGED ORB ────────────────────────────
      if (dragged) {
        const dx = orb.x - dragged.x;
        const dy = orb.y - dragged.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const minDist = orb.radius + dragged.radius + minimumSeparation;
        const influenceRange = repulsionRadius + orb.radius + dragged.radius;

        if (dist < influenceRange) {
          // Normalized direction away from dragged orb
          const nx = dx / dist;
          const ny = dy / dist;

          // Force increases as distance decreases (inverse power falloff)
          const t = 1 - Math.min(1, dist / influenceRange);
          const force = pushStrength * Math.pow(t, dragInfluenceFalloff);

          fx += nx * force * 8;
          fy += ny * force * 8;

          // Hard separation: if overlapping, strong push
          if (dist < minDist) {
            const overlap = minDist - dist;
            fx += nx * overlap * 0.4;
            fy += ny * overlap * 0.4;
          }
        }
      }

      // ── 2. ORB-TO-ORB SEPARATION ─────────────────────────────────
      for (const other of orbs) {
        if (other.id === orb.id || other.id === this.draggedId) continue;
        const dx = orb.x - other.x;
        const dy = orb.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const minDist = orb.radius + other.radius + minimumSeparation * 0.5;

        if (dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          // Softer push between resting orbs
          fx += nx * overlap * 0.15;
          fy += ny * overlap * 0.15;
        }
      }

      // ── 3. SPRING RETURN TO HOME ─────────────────────────────────
      const hx = orb.homeX - orb.x;
      const hy = orb.homeY - orb.y;
      const homeDist = Math.sqrt(hx * hx + hy * hy);

      if (homeDist > 0.5) {
        // Spring force proportional to displacement
        fx += hx * springStrength;
        fy += hy * springStrength;

        // Constant gentle bias toward home (prevents floating)
        const hnx = hx / homeDist;
        const hny = hy / homeDist;
        fx += hnx * returnBias * 10;
        fy += hny * returnBias * 10;
      }

      // ── 4. APPLY FORCES TO VELOCITY ──────────────────────────────
      orb.vx += fx;
      orb.vy += fy;

      // ── 5. DAMPING ───────────────────────────────────────────────
      orb.vx *= damping;
      orb.vy *= damping;

      // ── 6. CLAMP VELOCITY ────────────────────────────────────────
      const speed = Math.sqrt(orb.vx * orb.vx + orb.vy * orb.vy);
      if (speed > maxVelocity) {
        orb.vx = (orb.vx / speed) * maxVelocity;
        orb.vy = (orb.vy / speed) * maxVelocity;
      }

      // ── 7. INTEGRATE POSITION ────────────────────────────────────
      orb.x += orb.vx;
      orb.y += orb.vy;

      // ── 8. BOUNDARY CLAMPING ─────────────────────────────────────
      if (this.bounds) {
        const b = this.bounds;
        orb.x = clamp(orb.x, b.x + orb.radius + edgePadding, b.x + b.width - orb.radius - edgePadding);
        orb.y = clamp(orb.y, b.y + orb.radius + edgePadding, b.y + b.height - orb.radius - edgePadding);
      }

      // ── 9. DISPLACEMENT CHECK ────────────────────────────────────
      const distFromHome = Math.sqrt(
        (orb.x - orb.homeX) ** 2 + (orb.y - orb.homeY) ** 2
      );
      orb.displaced = distFromHome > 0.5;

      // Kill tiny residual velocity near home
      if (distFromHome < 0.5 && speed < 0.1) {
        orb.x = orb.homeX;
        orb.y = orb.homeY;
        orb.vx = 0;
        orb.vy = 0;
        orb.displaced = false;
      } else {
        anyMoved = true;
      }
    }

    return anyMoved;
  }
}

// ─── UTILITY FUNCTIONS ─────────────────────────────────────────────

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
