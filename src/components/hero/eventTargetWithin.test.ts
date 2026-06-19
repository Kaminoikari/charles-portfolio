import { describe, it, expect, beforeEach } from 'vitest'

import { eventTargetWithin } from './faceHero'

// The hero laser must only fire when the click's real DOM target is inside the
// hero subtree — geometry let overlays (chat widget) and below-hero sections
// trigger the beam. This guards that containment logic.
describe('eventTargetWithin', () => {
  let heroRoot: HTMLElement
  let insideEl: HTMLElement
  let outsideEl: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = ''
    heroRoot = document.createElement('section')
    heroRoot.setAttribute('data-face-hero', '')
    insideEl = document.createElement('div') // e.g. the hero backdrop the canvas sits in
    heroRoot.appendChild(insideEl)
    outsideEl = document.createElement('button') // e.g. the chat widget / a project card
    document.body.append(heroRoot, outsideEl)
  })

  it('is true for a target inside the hero root', () => {
    expect(eventTargetWithin(insideEl, heroRoot)).toBe(true)
    expect(eventTargetWithin(heroRoot, heroRoot)).toBe(true)
  })

  it('is false for a target outside the hero (chat widget, project card, etc.)', () => {
    expect(eventTargetWithin(outsideEl, heroRoot)).toBe(false)
  })

  it('is false for a null target or missing root', () => {
    expect(eventTargetWithin(null, heroRoot)).toBe(false)
    expect(eventTargetWithin(insideEl, null)).toBe(false)
  })
})
