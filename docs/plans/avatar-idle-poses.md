# Avatar idle poses: replace the mannequin rest with two looping idle poses

Status: implemented 2026-09-30 (see "As built" at the end). The sections up
to "Prototype results" are the plan as agreed; `scripts/prototypes/idle-poses.mjs`
is the throwaway prototype behind them.

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

## As built (2026-09-30)

- `src/components/chat/idlePose.ts` solves both poses per body from its rest
  positions and VRM version. The engine solves them at load; `rigProbe`
  applies the same solver, so the tests measure what the engine draws.
- Both arms of the clasp are placed by two-bone IK. The held wrist sits
  behind the hips (across and back scaled by hip width); its height is
  whatever bends the held elbow to 65°, so long-armed bodies clasp lower.
  The holding hand takes the held wrist from her side of it, palm back,
  its palm 25mm in front of the wrist on every offered body.
- The arms are jointed the way arms are (`hinged` in `idlePose.ts`): the
  elbow bends only toward its crook, the upper arm's roll is whatever aims
  the crook at the forearm, and the forearm rolls for the hand so the wrist
  does not twist. Built segment by segment from guessed palm normals, the
  first version bent both elbows about 60° backwards and rolled the left
  forearm 166° ("both arms would break", owner, 2026-09-30); the unsigned
  elbow angle the tests read then counted a backwards elbow as a bent one.
  `rigProbe.probeArmJoints` now reads each joint in its parent's frame and
  the tests hold every look to human ranges: elbow 0–150° and within the
  carrying angle, shoulder and forearm rotation within 90°, wrist roll within 10°.
  Measured: elbows 61–74°, shoulder rotation 69–85°, forearm roll 80–85°,
  wrist roll at most 5.4°.
- The crossfade keeps the elbows jointed too: each forearm's bend and roll
  are blended apart (slerped whole, an elbow bent 18–19° sideways part way),
  and the upper arms swing out up to 12° mid-fade so the hands go round her
  hips (straight across, they cut 47mm into them).
- Owner's notes on the way, each now a test in `idlePose.test.ts`:
  "the arms behind are too straight" (elbows were 32–49°, now 61–74°),
  then "they should sit closer to the body" (elbows bent outward stood
  5–15cm past the shoulder joints and read as hands on hips; they now point
  back, the collarbones swing back 15°, and every elbow stands 6–34mm
  inside its shoulder joint; the test allows 3cm past it).
- Clipping is measured against capsules inscribed in the torso and thigh
  skin (`rigProbe.torsoCapsules`). A first try counted ray crossings, and
  real exports are not closed meshes: it read a hand behind Gishin's dress
  as 217mm inside her. Limit 8mm; milfy is waived to 25mm (measured 15.2mm
  behind her back, 10.7mm with open hands: sleeve on the hem of a
  bell-shaped hoodie, cloth on cloth).
- The open pose was narrowed from the prototype (upper arm 22°→16°,
  forearm 30°→24°, hand 58°→38° out): wrists 24–26cm from the midline
  (the test allows 20–28cm).
- The engine writes the pose every frame on the procedural share of the
  body, so clips settle back into it with the fingers; the stage clock
  alternates the poses every 15–20s and pauses under a clip; the stage now
  also plays the head and torso idle beats (it offered no clips, so the
  idle roll used to wait forever).
- vtuber-kit carries `idlePose.ts` as an eleventh shared module.
- The life layer's finger drift: each finger's base joint curls and opens
  up to 3° on its own 5–7s period; the holding hand keeps still while it
  grips.

