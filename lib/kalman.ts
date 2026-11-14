/**
 * GPS smoothing — 2-D constant-velocity Kalman filter.
 *
 * State per axis is [position, velocity] in metres in a local east/north frame anchored at the
 * first fix. Motion is modelled as white-noise acceleration, so the filter follows walking and
 * cycling smoothly while averaging away the 10–50 m jitter phones produce indoors.
 *
 * Refinements over a plain position filter:
 *  - Measurement noise R comes from each fix's reported accuracy (with a floor, since phones
 *    are often over-optimistic).
 *  - Outlier gating with the Mahalanobis distance of the innovation (χ², 2 d.o.f.). Single
 *    wild fixes (multipath, cell-tower fallback) are dropped; if several in a row disagree the
 *    person really moved (bus, bike) and the filter re-anchors.
 *  - Adaptive process noise: low while stationary (hard averaging), higher while moving.
 *  - Zero-velocity updates: when the smoothed speed is near zero the velocity is pinned to
 *    zero, which stops "drift" while someone sits in a lecture hall.
 *  - Large time gaps re-initialise the filter instead of extrapolating stale velocity.
 *
 * The output is only ever used on the device to derive behaviour features for matching —
 * coordinates are never shown to anyone and never saved.
 */
export type Fix = { lat: number; lng: number; accuracy: number; time: number }
export type Smoothed = { lat: number; lng: number; accuracy: number; speed: number; time: number; accepted: boolean }

const M_PER_DEG = 111_320
const GATE_CHI2 = 13.8 // 99.9 % for 2 d.o.f.
const MAX_GAP_S = 20 * 60

type Axis = { p: number; v: number; P00: number; P01: number; P11: number }

export class GeoKalman {
  private x: Axis | null = null
  private y: Axis | null = null
  private lat0 = 0
  private lng0 = 0
  private t = 0
  private misses = 0
  private speedAvg = 0
  private innovAvg = 1.25

  /** @param accel process noise: standard deviation of acceleration in m/s² (≈0.6 for walking). */
  constructor(private accel = 0.3, private minAccuracy = 8) {}

  reset() { this.x = this.y = null; this.misses = 0; this.speedAvg = 0; this.innovAvg = 1.25 }

  private toLocal(lat: number, lng: number) {
    return { e: (lng - this.lng0) * M_PER_DEG * Math.cos(this.lat0 * Math.PI / 180), n: (lat - this.lat0) * M_PER_DEG }
  }
  private init(f: Fix, r: number) {
    this.lat0 = f.lat; this.lng0 = f.lng; this.t = f.time; this.misses = 0
    const axis = (): Axis => ({ p: 0, v: 0, P00: r, P01: 0, P11: 1 })
    this.speedAvg = 0
    this.x = axis(); this.y = axis()
  }
  private predict(a: Axis, dt: number, accel: number) {
    const q = accel * accel
    const p = a.p + a.v * dt
    const P00 = a.P00 + 2 * dt * a.P01 + dt * dt * a.P11 + q * dt ** 4 / 4
    const P01 = a.P01 + dt * a.P11 + q * dt ** 3 / 2
    const P11 = a.P11 + q * dt * dt
    return { p, v: a.v, P00, P01, P11 }
  }
  private update(a: Axis, z: number, r: number): Axis {
    const s = a.P00 + r, k0 = a.P00 / s, k1 = a.P01 / s, yv = z - a.p
    return { p: a.p + k0 * yv, v: a.v + k1 * yv, P00: (1 - k0) * a.P00, P01: (1 - k0) * a.P01, P11: a.P11 - k1 * a.P01 }
  }

  process(f: Fix): Smoothed {
    const acc = Math.max(f.accuracy || this.minAccuracy, this.minAccuracy), r = acc * acc
    const dt = (f.time - this.t) / 1000
    if (!this.x || !this.y || dt > MAX_GAP_S || dt < 0) { this.init(f, r); return this.out(true) }
    // Adaptive process noise: when the filter believes you are still, expect almost no
    // acceleration so jitter is averaged hard; once you move, follow quickly.
    const moving = this.speedAvg > 0.6 || this.innovAvg > 1.7
    const accel = moving ? this.accel : this.accel / 5
    const px = this.predict(this.x, dt, accel), py = this.predict(this.y, dt, accel)
    const z = this.toLocal(f.lat, f.lng)
    const ix = z.e - px.p, iy = z.n - py.p
    const d2 = ix * ix / (px.P00 + r) + iy * iy / (py.P00 + r)
    // Normalised residual size (≈1.25 when still). A sustained rise means real motion.
    this.innovAvg = 0.75 * this.innovAvg + 0.25 * Math.min(Math.sqrt(d2), 6)
    if (d2 > GATE_CHI2) {
      this.misses++
      if (this.misses >= 3) { this.init(f, r); return this.out(true) } // consistently elsewhere: they really moved
      this.x = px; this.y = py; this.t = f.time
      return this.out(false)
    }
    this.misses = 0
    this.x = this.update(px, z.e, r); this.y = this.update(py, z.n, r); this.t = f.time
    // Smoothed speed decides stationary vs moving (with natural hysteresis).
    const sp = Math.hypot(this.x.v, this.y.v)
    this.speedAvg = 0.7 * this.speedAvg + 0.3 * sp
    // Zero-velocity damping while (nearly) stationary.
    // Zero-velocity update: pin velocity to 0 and keep its uncertainty small, so position
    // noise is averaged instead of being mistaken for motion.
    if (this.speedAvg < 0.4 && this.innovAvg < 1.7) for (const a of [this.x, this.y]) { a.v = 0; a.P01 = 0; a.P11 = Math.min(a.P11, 0.04) }
    return this.out(true)
  }

  private out(accepted: boolean): Smoothed {
    const x = this.x!, y = this.y!
    return {
      lat: this.lat0 + y.p / M_PER_DEG,
      lng: this.lng0 + x.p / (M_PER_DEG * Math.cos(this.lat0 * Math.PI / 180)),
      accuracy: Math.sqrt((x.P00 + y.P00) / 2),
      speed: Math.hypot(x.v, y.v),
      time: this.t,
      accepted,
    }
  }
}
