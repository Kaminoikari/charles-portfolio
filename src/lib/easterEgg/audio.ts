import type { AudioBus } from './types'

export function createAudioBus(): AudioBus {
  const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
  const ctx = new Ctor()
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  const reverb = ctx.createConvolver()
  reverb.buffer = makeReverbImpulse(ctx, 2.4, 3.5)
  const reverbSend = ctx.createGain()
  reverbSend.gain.value = 0.35
  reverbSend.connect(reverb)
  reverb.connect(master)

  return { ctx, master, reverbSend, reverb }
}

export function disposeAudioBus(bus: AudioBus) {
  try {
    bus.master.disconnect()
    bus.reverbSend.disconnect()
    bus.reverb.disconnect()
    bus.ctx.close()
  } catch {}
}

export function fadeMaster(bus: AudioBus, target: number, duration: number) {
  const now = bus.ctx.currentTime
  bus.master.gain.cancelScheduledValues(now)
  bus.master.gain.setValueAtTime(bus.master.gain.value, now)
  bus.master.gain.linearRampToValueAtTime(target, now + duration)
}

function makeReverbImpulse(ctx: AudioContext, duration: number, decay: number) {
  const sampleRate = ctx.sampleRate
  const length = Math.floor(sampleRate * duration)
  const buffer = ctx.createBuffer(2, length, sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
    }
  }
  return buffer
}

// ---------- per-beat scheduling helpers ----------

export function scheduleBeat1(bus: AudioBus, t0: number) {
  const drone = bus.ctx.createOscillator()
  drone.type = 'sine'
  drone.frequency.value = 30
  const droneGain = bus.ctx.createGain()
  droneGain.gain.setValueAtTime(0, t0)
  droneGain.gain.linearRampToValueAtTime(0.5, t0 + 1.0)
  drone.connect(droneGain).connect(bus.master)
  drone.start(t0)
  drone.stop(t0 + 12)

  const bell = bus.ctx.createOscillator()
  bell.type = 'sine'
  bell.frequency.value = 1760
  const bellGain = bus.ctx.createGain()
  bellGain.gain.setValueAtTime(0, t0 + 0.4)
  bellGain.gain.linearRampToValueAtTime(0.06, t0 + 0.45)
  bellGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6)
  bell.connect(bellGain).connect(bus.reverbSend)
  bell.start(t0 + 0.4)
  bell.stop(t0 + 1.7)
}

export function scheduleBeat2(bus: AudioBus, t0: number) {
  const noise = createNoise(bus.ctx, 1.8)
  const filter = bus.ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.4
  filter.frequency.setValueAtTime(200, t0)
  filter.frequency.exponentialRampToValueAtTime(2200, t0 + 1.4)
  const g = bus.ctx.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(0.22, t0 + 0.6)
  g.gain.linearRampToValueAtTime(0.0, t0 + 1.8)
  noise.connect(filter).connect(g)
  g.connect(bus.master)
  g.connect(bus.reverbSend)
  noise.start(t0)
  noise.stop(t0 + 1.9)

  const riser = bus.ctx.createOscillator()
  riser.type = 'sawtooth'
  riser.frequency.setValueAtTime(120, t0 + 0.4)
  riser.frequency.exponentialRampToValueAtTime(640, t0 + 1.7)
  const riserGain = bus.ctx.createGain()
  riserGain.gain.setValueAtTime(0, t0 + 0.4)
  riserGain.gain.linearRampToValueAtTime(0.05, t0 + 1.5)
  riserGain.gain.linearRampToValueAtTime(0, t0 + 1.8)
  const lp = bus.ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1500
  riser.connect(lp).connect(riserGain).connect(bus.master)
  riser.start(t0 + 0.4)
  riser.stop(t0 + 1.85)
}

export function scheduleBeat3(bus: AudioBus, t0: number) {
  // Sub braam stack
  const subFreqs = [55, 55 * 1.005, 55 * 0.995]
  for (const f of subFreqs) {
    const o = bus.ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f
    const lp = bus.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 220
    const g = bus.ctx.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(0.18, t0 + 0.08)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4)
    o.connect(lp).connect(g).connect(bus.master)
    o.start(t0)
    o.stop(t0 + 1.45)
  }

  // High pierce
  const pierce = bus.ctx.createOscillator()
  pierce.type = 'sine'
  pierce.frequency.value = 4000
  const lfo = bus.ctx.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = 7
  const lfoGain = bus.ctx.createGain()
  lfoGain.gain.value = 60
  lfo.connect(lfoGain).connect(pierce.frequency)
  const pg = bus.ctx.createGain()
  pg.gain.setValueAtTime(0, t0)
  pg.gain.linearRampToValueAtTime(0.04, t0 + 0.05)
  pg.gain.linearRampToValueAtTime(0.0, t0 + 1.0)
  pierce.connect(pg).connect(bus.master)
  pierce.start(t0)
  pierce.stop(t0 + 1.0)
  lfo.start(t0)
  lfo.stop(t0 + 1.0)
}

export function scheduleBeat4(bus: AudioBus, t0: number) {
  const stack = [60, 90, 150]
  for (const f of stack) {
    const o = bus.ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f
    const lp = bus.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 240
    const g = bus.ctx.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(0.07, t0 + 0.15)
    g.gain.linearRampToValueAtTime(0.05, t0 + 1.4)
    g.gain.linearRampToValueAtTime(0, t0 + 1.55)
    o.connect(lp).connect(g).connect(bus.master)
    o.start(t0)
    o.stop(t0 + 1.55)
  }

  const noise = createNoise(bus.ctx, 1.55)
  const hp = bus.ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 8000
  const ng = bus.ctx.createGain()
  ng.gain.setValueAtTime(0, t0)
  ng.gain.linearRampToValueAtTime(0.04, t0 + 0.4)
  ng.gain.linearRampToValueAtTime(0.0, t0 + 1.5)
  noise.connect(hp).connect(ng).connect(bus.master)
  noise.start(t0)
  noise.stop(t0 + 1.55)
}

export function scheduleBeat5(bus: AudioBus, t0: number) {
  const o = bus.ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(100, t0)
  o.frequency.exponentialRampToValueAtTime(2200, t0 + 0.32)
  const bp = bus.ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 4
  bp.frequency.setValueAtTime(400, t0)
  bp.frequency.exponentialRampToValueAtTime(3500, t0 + 0.32)
  const g = bus.ctx.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(0.18, t0 + 0.05)
  g.gain.linearRampToValueAtTime(0.0001, t0 + 0.7)
  o.connect(bp).connect(g)
  g.connect(bus.master)
  g.connect(bus.reverbSend)
  o.start(t0)
  o.stop(t0 + 0.75)
}

export function scheduleBeat6(bus: AudioBus, t0: number) {
  // Reverse-cymbal swell via filtered noise rising
  const noise = createNoise(bus.ctx, 1.5)
  const hp = bus.ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.setValueAtTime(800, t0)
  hp.frequency.exponentialRampToValueAtTime(5000, t0 + 1.4)
  const g = bus.ctx.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(0.16, t0 + 1.2)
  g.gain.linearRampToValueAtTime(0.0, t0 + 1.5)
  noise.connect(hp).connect(g)
  g.connect(bus.master)
  g.connect(bus.reverbSend)
  noise.start(t0)
  noise.stop(t0 + 1.5)

  // Doppler bend
  const o = bus.ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(220, t0)
  o.frequency.exponentialRampToValueAtTime(80, t0 + 1.4)
  const og = bus.ctx.createGain()
  og.gain.setValueAtTime(0, t0)
  og.gain.linearRampToValueAtTime(0.07, t0 + 0.3)
  og.gain.linearRampToValueAtTime(0.0, t0 + 1.5)
  o.connect(og).connect(bus.master)
  o.start(t0)
  o.stop(t0 + 1.5)
}

export function scheduleBeat7(bus: AudioBus, t0: number) {
  const o = bus.ctx.createOscillator()
  o.type = 'sine'
  o.frequency.value = 28
  const g = bus.ctx.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(0.45, t0 + 0.04)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6)
  o.connect(g).connect(bus.master)
  o.start(t0)
  o.stop(t0 + 0.65)

  const click = createNoise(bus.ctx, 0.04)
  const hp = bus.ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 2000
  const cg = bus.ctx.createGain()
  cg.gain.setValueAtTime(0.25, t0)
  cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04)
  click.connect(hp).connect(cg).connect(bus.master)
  click.start(t0)
  click.stop(t0 + 0.05)
}

export function scheduleBeat8(bus: AudioBus, t0: number) {
  const partials = [466, 932, 1397]
  for (const f of partials) {
    const o = bus.ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    const g = bus.ctx.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(0.07, t0 + 0.06)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4)
    o.connect(g)
    g.connect(bus.master)
    g.connect(bus.reverbSend)
    o.start(t0)
    o.stop(t0 + 1.45)
  }
}

export function scheduleBeat9(bus: AudioBus, t0: number) {
  const o = bus.ctx.createOscillator()
  o.type = 'sine'
  o.frequency.value = 110
  const g = bus.ctx.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(0.05, t0 + 0.06)
  g.gain.linearRampToValueAtTime(0.0, t0 + 0.4)
  o.connect(g).connect(bus.master)
  o.start(t0)
  o.stop(t0 + 0.5)
}

function createNoise(ctx: AudioContext, duration: number): AudioBufferSourceNode {
  const length = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buffer
  return src
}
