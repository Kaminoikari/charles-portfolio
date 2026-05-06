import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const MARS_ORANGE = "#E8652B";
const CYAN = "#00D9FF";
const NAVY_DEEP = "#0A0F1E";

const HERO_LEN = 45;
const FEATURES_LEN = 30;
const TRIP_LEN = 75;
const MAP_LEN = 75;
const COST_LEN = 75;
const OFFLINE_LEN = 75;
const LOGO_LEN = 75;

const SCENES = [
  { id: "hero", from: 0, len: HERO_LEN },
  { id: "features", from: HERO_LEN, len: FEATURES_LEN },
  { id: "trip", from: HERO_LEN + FEATURES_LEN, len: TRIP_LEN },
  { id: "map", from: HERO_LEN + FEATURES_LEN + TRIP_LEN, len: MAP_LEN },
  { id: "cost", from: HERO_LEN + FEATURES_LEN + TRIP_LEN + MAP_LEN, len: COST_LEN },
  { id: "offline", from: HERO_LEN + FEATURES_LEN + TRIP_LEN + MAP_LEN + COST_LEN, len: OFFLINE_LEN },
  { id: "logo", from: HERO_LEN + FEATURES_LEN + TRIP_LEN + MAP_LEN + COST_LEN + OFFLINE_LEN, len: LOGO_LEN },
] as const;

const CROSSFADE = 12;

const HeroScene: React.FC = () => {
  const localFrame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = interpolate(localFrame, [0, HERO_LEN], [1.0, 1.08], {
    extrapolateRight: "clamp",
  });
  const translateX = interpolate(localFrame, [0, HERO_LEN], [0, -28], {
    extrapolateRight: "clamp",
  });

  const tagY = spring({
    frame: localFrame - 12,
    fps,
    config: { damping: 18, stiffness: 90 },
    durationInFrames: 24,
  });
  const tagOpacity = interpolate(localFrame, [12, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: NAVY_DEEP }}>
      <AbsoluteFill style={{ transform: `scale(${scale}) translateX(${translateX}px)` }}>
        <Img src={staticFile("path-hero.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: "linear-gradient(180deg, rgba(10,15,30,0) 55%, rgba(10,15,30,0.78) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: 88,
          opacity: tagOpacity,
          transform: `translateY(${(1 - tagY) * 24}px)`,
        }}
      >
        <div
          style={{
            color: "white",
            fontFamily: "Space Grotesk, system-ui, sans-serif",
            fontSize: 38,
            letterSpacing: 6,
            textTransform: "uppercase",
            opacity: 0.85,
          }}
        >
          Offline-first trip planning
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

type CardBox = { x: number; y: number; w: number; h: number };
const FEATURE_BOXES: CardBox[] = [
  { x: 254, y: 611, w: 436, h: 124 },
  { x: 714, y: 611, w: 436, h: 124 },
  { x: 254, y: 758, w: 436, h: 101 },
  { x: 714, y: 758, w: 436, h: 101 },
];

const FeaturesScene: React.FC = () => {
  const localFrame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const drift = interpolate(localFrame, [0, FEATURES_LEN], [0, -12], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "white", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateY(${drift}px)` }}>
        <Img src={staticFile("path-features.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      {FEATURE_BOXES.map((box, i) => {
        const triggerFrame = 4 + i * 5;
        const pulse = spring({
          frame: localFrame - triggerFrame,
          fps,
          config: { damping: 14, stiffness: 130 },
          durationInFrames: 18,
        });
        const glow = interpolate(pulse, [0, 1], [0, 1]);
        const scaleBump = interpolate(pulse, [0, 1], [0.985, 1]);
        const alphaHex = (alpha: number) =>
          Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, "0");
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: box.x,
              top: box.y,
              width: box.w,
              height: box.h,
              borderRadius: 16,
              transform: `scale(${scaleBump})`,
              boxShadow: `0 0 0 2px ${CYAN}${alphaHex(glow * 0.78)}, 0 18px 38px ${CYAN}${alphaHex(glow * 0.24)}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

type FeatureSlideProps = {
  imageName: string;
  caption: string;
  subCaption?: string;
  durationFrames: number;
  zoom?: { fromScale: number; toScale: number; originX?: string; originY?: string };
  pan?: { fromX: number; toX: number; fromY: number; toY: number };
  captionPosition?: "bottom" | "top" | "right";
  accent?: string;
};

const FeatureSlide: React.FC<FeatureSlideProps> = ({
  imageName,
  caption,
  subCaption,
  durationFrames,
  zoom,
  pan,
  captionPosition = "bottom",
  accent = MARS_ORANGE,
}) => {
  const localFrame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const z = zoom ?? { fromScale: 1.0, toScale: 1.06, originX: "50%", originY: "50%" };
  const p = pan ?? { fromX: 0, toX: 0, fromY: 0, toY: 0 };

  const scale = interpolate(localFrame, [0, durationFrames], [z.fromScale, z.toScale], {
    extrapolateRight: "clamp",
  });
  const tx = interpolate(localFrame, [0, durationFrames], [p.fromX, p.toX], {
    extrapolateRight: "clamp",
  });
  const ty = interpolate(localFrame, [0, durationFrames], [p.fromY, p.toY], {
    extrapolateRight: "clamp",
  });

  const captionAppear = spring({
    frame: localFrame - 12,
    fps,
    config: { damping: 16, stiffness: 110 },
    durationInFrames: 24,
  });
  const captionOpacity = interpolate(localFrame, [12, 30, durationFrames - 8, durationFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionShift = (1 - captionAppear) * 20;

  const positionStyles: Record<string, React.CSSProperties> = {
    bottom: {
      alignItems: "center",
      justifyContent: "flex-end",
      paddingBottom: 64,
      transform: `translateY(${captionShift}px)`,
    },
    top: {
      alignItems: "center",
      justifyContent: "flex-start",
      paddingTop: 64,
      transform: `translateY(${-captionShift}px)`,
    },
    right: {
      alignItems: "flex-end",
      justifyContent: "center",
      paddingRight: 64,
      transform: `translateX(${captionShift}px)`,
    },
  };

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY_DEEP, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: `${z.originX ?? "50%"} ${z.originY ?? "50%"}`,
        }}
      >
        <Img src={staticFile(imageName)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            captionPosition === "top"
              ? "linear-gradient(180deg, rgba(10,15,30,0.78) 0%, rgba(10,15,30,0) 35%)"
              : captionPosition === "right"
                ? "linear-gradient(270deg, rgba(10,15,30,0.78) 0%, rgba(10,15,30,0) 35%)"
                : "linear-gradient(180deg, rgba(10,15,30,0) 60%, rgba(10,15,30,0.82) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          ...positionStyles[captionPosition],
          opacity: captionOpacity,
        }}
      >
        <div
          style={{
            backgroundColor: NAVY_DEEP,
            color: "white",
            padding: "18px 32px",
            borderRadius: 999,
            fontFamily: "Space Grotesk, system-ui, sans-serif",
            fontSize: 30,
            letterSpacing: 1.5,
            border: `2px solid ${accent}`,
            boxShadow: `0 24px 48px ${accent}55`,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span style={{ color: accent, fontFamily: "SF Mono, ui-monospace, monospace", fontSize: 22, letterSpacing: 3 }}>
            ●
          </span>
          <span>{caption}</span>
          {subCaption && (
            <span
              style={{
                fontFamily: "SF Mono, ui-monospace, monospace",
                fontSize: 18,
                opacity: 0.7,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginLeft: 4,
              }}
            >
              {subCaption}
            </span>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const LogoScene: React.FC = () => {
  const localFrame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({
    frame: localFrame - 8,
    fps,
    config: { damping: 12, stiffness: 100 },
    durationInFrames: 32,
  });
  const logoScale = interpolate(logoSpring, [0, 1], [0.78, 1]);
  const logoOpacity = interpolate(localFrame, [8, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineOpacity = interpolate(localFrame, [32, 56], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineY = interpolate(localFrame, [32, 56], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 50%, #1A0F0A 0%, ${NAVY_DEEP} 70%)`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, ${MARS_ORANGE}33 0%, transparent 50%)`,
          opacity: logoOpacity,
        }}
      />
      <div style={{ opacity: logoOpacity, transform: `scale(${logoScale})`, textAlign: "center" }}>
        <div
          style={{
            fontFamily: "Space Grotesk, system-ui, sans-serif",
            fontSize: 220,
            fontWeight: 700,
            color: "white",
            letterSpacing: -8,
            lineHeight: 1,
          }}
        >
          Path
        </div>
        <div
          style={{
            marginTop: 24,
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
            color: MARS_ORANGE,
            fontFamily: "SF Mono, ui-monospace, monospace",
            fontSize: 26,
            letterSpacing: 8,
            textTransform: "uppercase",
          }}
        >
          Plan offline · Travel anywhere
        </div>
      </div>
    </AbsoluteFill>
  );
};

const sceneOpacity = (frame: number, from: number, len: number) => {
  const start = from;
  const end = from + len;
  return interpolate(
    frame,
    [start - CROSSFADE, start, end, end + CROSSFADE],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
};

export const PathDemo: React.FC = () => {
  const frame = useCurrentFrame();

  const wrap = (id: string, from: number, len: number, child: React.ReactNode) => (
    <Sequence key={id} from={Math.max(0, from - CROSSFADE)} durationInFrames={len + CROSSFADE * 2}>
      <AbsoluteFill style={{ opacity: sceneOpacity(frame, from, len) }}>{child}</AbsoluteFill>
    </Sequence>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY_DEEP }}>
      {wrap("hero", SCENES[0].from, SCENES[0].len, <HeroScene />)}
      {wrap("features", SCENES[1].from, SCENES[1].len, <FeaturesScene />)}
      {wrap(
        "trip",
        SCENES[2].from,
        SCENES[2].len,
        <FeatureSlide
          imageName="path-trip.png"
          caption="行程卡片"
          subCaption="Drag · Drop · Plan"
          durationFrames={TRIP_LEN}
          zoom={{ fromScale: 1.02, toScale: 1.1, originX: "50%", originY: "30%" }}
          pan={{ fromX: 0, toX: 0, fromY: 0, toY: -40 }}
          captionPosition="bottom"
        />,
      )}
      {wrap(
        "map",
        SCENES[3].from,
        SCENES[3].len,
        <FeatureSlide
          imageName="path-map.png"
          caption="地圖模式"
          subCaption="Asia · 491 km"
          durationFrames={MAP_LEN}
          zoom={{ fromScale: 1.0, toScale: 1.18, originX: "60%", originY: "55%" }}
          captionPosition="top"
          accent={CYAN}
        />,
      )}
      {wrap(
        "cost",
        SCENES[4].from,
        SCENES[4].len,
        <FeatureSlide
          imageName="path-cost.png"
          caption="費用詳情"
          subCaption="NT$ 95,454"
          durationFrames={COST_LEN}
          zoom={{ fromScale: 1.04, toScale: 1.14, originX: "50%", originY: "40%" }}
          captionPosition="bottom"
        />,
      )}
      {wrap(
        "offline",
        SCENES[5].from,
        SCENES[5].len,
        <FeatureSlide
          imageName="path-offline.png"
          caption="離線模式"
          subCaption="No network · Full data"
          durationFrames={OFFLINE_LEN}
          zoom={{ fromScale: 1.0, toScale: 1.08, originX: "50%", originY: "10%" }}
          captionPosition="bottom"
          accent={MARS_ORANGE}
        />,
      )}
      {wrap("logo", SCENES[6].from, SCENES[6].len, <LogoScene />)}
    </AbsoluteFill>
  );
};
