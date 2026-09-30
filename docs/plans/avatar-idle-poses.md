# Avatar idle poses: replace the mannequin rest with two looping idle poses

Status: planned, not started. Agreed with the owner 2026-09-30. Nothing in the
engine has changed yet; `scripts/prototypes/idle-poses.mjs` is a throwaway
render prototype that produced the numbers below.

## The problem

Every body stands in the same fixed rest pose whenever no clip plays
(`avatarMode.armRestPins`, applied by `pinArms` in `avatarGuideEngine.ts`):

- upper arm `ARM_REST_UPPER_Z = 1.15` rad (66° down from the T-pose, so the
  arms stand about 24° out from the body: an A-pose)
- forearm `ARM_REST_FORE_Z = 0.25` rad, bent in the frontal plane, not forward
- hand 0, and all 30 finger bones at identity: flat hands, straight fingers
  pointing at the floor
- one set of numbers for every family

![current rest pose, all 13 looks](assets/idle-poses/current-rest-pose.webp)

It reads as a mannequin, worst on bare-armed looks (Gishin; also Shibu, Shino
and Vita in short sleeves). On `/avatar` it is permanent: the `stage`
placement has no motion frame, so `motionsFor('stage', …)` is empty and the
idle clip rotation never runs (`avatarMotions.motionFrame`). In the chat
widget it shows between clips.

What the shipped motion-capture clips say a relaxed human stance is (first
and last frames, `public/avatar/animations/*.vrma`): upper arm 69–77° down,
elbow 6–17°, wrist about 20° (`idleLoop`), finger proximals 20–30° (`spin`,
`squat`, `modelPose`, `peaceSign` ends).

## The owner's two reference poses

Both come from a mobile gacha game's dressing room (owner's screenshots,
2026-09-30; not committed: third-party art). Both are Live2D-style looping
idles: the pose holds while breathing, sway and small head moves keep her
alive.

1. **Open hands.** Upper arms slightly out (about 20–25°), elbows nearly
   straight, forearms flaring a little further out, wrists turned so the
   palms face forward and down, hands just outside the thighs, fingers
   relaxed, loosely spread and slightly curled.
2. **Hands behind the back.** Upper arms back, elbows close to the body,
   hands low behind the hips and clasped like a real person's: one hand holds
   the other wrist. Owner's corrections on the prototype: the hands must not
   show from the front (first try had them too high), and the two hands must
   actually cross and hold, not just meet.

## Agreed plan

**A. Stage idle: loop the two poses.** When no clip plays on `/avatar`, she
holds one of the two poses with a looping life layer (breathing, weight
shift, occasional head tilt, small finger drift) and crossfades to the other
every 15–20s (**owner chose automatic alternation**, option 1). A visitor's
motion plays over it and blends back to the current idle pose. The
motion-capture `idleLoop` stays in the motions tab.

**B. The open-hands pose becomes the rest pose everywhere**, replacing the
A-pose, so the chat widget's between-clip rest is natural too.

- Define both poses as body-relative targets (which way each segment points,
  which way the palm faces), not raw Euler angles, and solve the joint
  rotations per body and per VRM version. That is what the prototype does
  (`basisQ`), and it works unchanged on 0.x and 1.0 files.
- The clasp is solved, not authored: the outer hand's arm directions are
  searched until its palm centre sits on the other wrist (2.5cm behind it).
- Measure per family, the way `rigProbe` already measures clips: hand and
  forearm skin against torso, hips, skirt and sleeves; for the back pose also
  "no hand visible from the front". Extend `rigProbe` and add tests for both
  poses on every offered family, so a new body or a changed angle that clips
  fails a test. The engine file's own history (2026-08-19) is why: hand-
  authored arm angles put hands inside heads until they were measured.

**C. Transitions.** Crossfade between clips and idle poses and between the
two poses, fingers included (today `stopMotion` → `pinArms` snaps every finger
to identity).

## Prototype results

Open hands, first try, looks right on Gishin, Pink and Victoria (bulky
sleeves). Gishin's hands can come in a little.

![open hands prototype](assets/idle-poses/open-prototype.webp)

Hands behind the back, second version (front, 50°, side, back per body):
hands 7–12cm below the hips bone and 11–15cm behind it, centred, hidden from
the front. Clasp solve error (outer palm to target): Gishin 0.6mm, Victoria
18mm, Pink 41mm. The last two hit the search bounds (`hd`, `hb`); give the
solver wrist twist and elbow flare as extra freedom. Pink's long hair covers
the back anyway, and every body's spring colliders include both arms and
hands (checked 2026-09-30), so hair drapes over the arms instead of through
them. The outer hand's fingers are partly hidden behind the other wrist and
its bracelet; curl them so the grip reads.

![hands behind back prototype](assets/idle-poses/behind-clasp-prototype.webp)

Known prototype-only artefact: Gishin's dress shows holes at the chest after
the prototype's crude 90-frame spring settle. The site's renderer does not
show this.

## Constraints

- `avatarMode.ts` and `avatarMotions.ts` are shared with vtuber-kit
  (`vtuber-kit/src/components/chat/shared-with-site.json`): sync both copies
  and run `npx tsx scripts/engine-drift.ts --update` there, then the kit tests.
- Keep every framing intact: phone HUD, desktop full body, the widget's
  waist-up and column frames. The open pose's reach must stay inside
  `stageLayout.REST_HALF_WIDTH` and the widget canvas.
- Changing the widget's rest pose affects the clearance data (`endWrist`
  waivers, motion handover); rerun `rigProbe`, `clearance` and
  `motionHandover` tests.
- Ask the owner about a changelog entry when done (CLAUDE.md).

## Verification

- All 13 looks × 2 poses rendered front, 45° and back, hands zoomed, compared
  by eye.
- Clearance numbers from `rigProbe`, held by tests.
- Phone and desktop framings on `/avatar`, and the chat widget, checked for
  cropping.
