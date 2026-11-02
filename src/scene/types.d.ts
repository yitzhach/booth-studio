// The scene's methods live by area in src/scene/ and are installed on
// BoothScene's prototype by `mixin` (SCENE_SPLIT_PHASE.md), which a type
// checker cannot follow. This tells it: the class has every area's methods,
// with their own signatures, and each area's `this` is the class
// (`@satisfies {ThisType<BoothScene>}` above each object). Nothing imports
// it; tsconfig.app.json reads it (TYPING_PHASE.md).
import type { build } from "./build.js";
import type { camera } from "./camera.js";
import type { exportPasses } from "./export.js";
import type { interaction } from "./interaction.js";
import type { lightRig } from "./light-rig.js";
import type { measureTools } from "./measure-tools.js";
import type { props } from "./props.js";
import type { renderLoop } from "./render-loop.js";
import type { video } from "./video.js";
import type * as T from "three";

type Build = typeof build;
type Camera = typeof camera;
type ExportPasses = typeof exportPasses;
type Interaction = typeof interaction;
type LightRig = typeof lightRig;
type MeasureTools = typeof measureTools;
type Props = typeof props;
type RenderLoop = typeof renderLoop;
type Video = typeof video;

declare module "../scene.js" {
  interface BoothScene extends Build, Camera, ExportPasses, Interaction, LightRig, MeasureTools, Props, RenderLoop, Video {
    // The state the areas set and read that the constructor does not
    // create: each is assigned first inside a method, so the class alone
    // does not declare it. Optional (`?`) where the code reads it before
    // the first assignment can have run, behind `||`, `||=` or `?.`. Loose where the value is a project's own shape,
    // which validateProject (src/model.js) checks at run time instead.
    /** The project being drawn, as `update` was last handed it. */
    p: any;
    /** The selected artwork's id, and the rest of a multiple selection. */
    selected: string | null;
    also?: string[];
    /** Bumped by every `update`; a load that finds it moved on is stale. */
    revision?: number;
    /** Textures still loading, counted by `texture`. */
    loading: number;
    initialized: boolean;
    // The booth as built: walls, artwork and their frames, the row, models.
    wallObjects: T.Object3D[];
    rowWallObjects: T.Object3D[];
    artObjects: T.Object3D[];
    artGroups: Map<string, any>;
    frames: Record<string, any>;
    modelFrames: Record<string, any>;
    modelCache?: Map<string, Promise<T.Object3D>>;
    showGroup: T.Object3D | null;
    showChanged: boolean;
    orthoSpan: number;
    lastDepthRange: { near: number; far: number };
    // The selection's outline and handles.
    selectionObjects: T.Object3D[];
    selectionEdge: T.Object3D | null;
    resizeHandles: T.Object3D[];
    scaleId: string | null;
    // A gesture in progress.
    down: number[] | null;
    drag: any;
    applyDrag: (e: PointerEvent) => void;
    pendingMove: PointerEvent | null;
    lastTap: any;
    lastSnap: any;
    walking: { minDistance: number; maxDistance: number; maxPolar: number; before: any } | null;
    autoPanStop: ((finished?: boolean) => void) | null;
    stopPreview: ((options?: { keep?: boolean }) => void) | null;
    previewFrame: number;
    momentShown: boolean;
    // Guides, the Box tool, the clearance check (main.js hands the issues over).
    guides: T.Group;
    snapGuides: T.Object3D | null;
    snapNotes?: { at: T.Vector3; text: string; kind?: string }[];
    boxPreview: T.Object3D | null;
    /** The Box tool's drag: where it started, or null while not drawing. */
    drawingBox: { start: any } | null;
    onDrawBox?: (r: { x: number; z: number; width: number; depth: number }) => void;
    clearance?: any[];
    /** Where the export frame sits, as fractions of the viewport (main.js draws the guide). */
    onRenderRect?: (rect: { x: number; y: number; width: number; height: number } | null) => void;
    // The render loop's bookkeeping.
    looping: boolean;
    lastTick: number;
    drawnAt: number;
    touchedAt: number;
    framesOwed?: number;
    kick: ReturnType<typeof setTimeout> | null;
    shadowsOwed: boolean;
    smallShadows: boolean;
    dragShadowSkip: boolean;
    groupDrawn: boolean;
    fitAspectFactor: number;
    overlayCache: any;
    retired?: T.Object3D[];
    retiredAt: number;
  }
}
