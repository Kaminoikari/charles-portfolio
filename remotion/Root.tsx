import { Composition } from "remotion";
import { PathDemo } from "./PathDemo";

const FPS = 30;
const DURATION_SECONDS = 15;

export const Root = () => {
  return (
    <Composition
      id="PathDemo"
      component={PathDemo}
      durationInFrames={FPS * DURATION_SECONDS}
      fps={FPS}
      width={1404}
      height={1128}
    />
  );
};
