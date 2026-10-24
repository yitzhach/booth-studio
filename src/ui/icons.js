// The app's icons. lucide's icons are imported one by one, `icon(name)` writes
// one into the HTML as its finished SVG (built once per name and kept), `btn`
// writes a toolbar or panel button with its icon, and `refreshIcons` converts
// a stray lucide placeholder, should any markup still write one. All three
// are returned. It reads none of boot's state, so it takes no `ctx`; main.js
// calls it first, before `ctx` is made. Moved out of src/main.js's boot() as
// it was (MAIN_SPLIT_PHASE.md, seam 21), with the lucide import from the top
// of main.js.
import {
  createIcons,
  Shapes,
  RotateCw,
  AlignStartHorizontal,
  ListOrdered,
  ArrowLeft,
  Box,
  ImagePlus,
  LayoutPanelLeft,
  Lightbulb,
  Download,
  Undo2,
  Redo2,
  MousePointer2,
  Move,
  Grid2X2,
  Copy,
  Trash2,
  Plus,
  Minus,
  ChevronDown,
  Maximize,
  FolderOpen,
  Save,
  HelpCircle,
  Camera,
  Image as ImageIcon,
  Check,
  Sun,
  PanelLeftClose,
  X,
  AlignCenter,
  ArrowUpToLine,
  Layers,
  RotateCcw,
  Play,
  Pause,
  Building2,
  Columns2,
  Ruler,
  Zap,
  Lock,
  LockOpen,
  ArrowLeftToLine,
  ArrowRightToLine,
  Eye,
  EyeOff,
  Video,
  UserRound,
  SlidersHorizontal,
  Footprints,
  Search,
  Bookmark,
  Tags,
  Magnet,
  Square,
  Map as MapIcon,
  Plug,
  Upload,
  Send,
  AlignHorizontalDistributeCenter,
  AlignStartVertical,
  SkipBack,
  SkipForward,
  Images,
  Crop,
  ArrowUp,
  Route,
  DoorOpen,
  LayoutTemplate,
  FlipHorizontal2,
  FlipVertical2,
  Hand,
  Sparkles,
  MessageCircle,
  Ellipsis,
  ShieldCheck,
  ClipboardCopy,
} from "lucide";
import { escapeHTML as e } from "../model.js";

export function createIconSet() {
  const icons = {
    ShieldCheck,
    ClipboardCopy,
    FlipHorizontal2,
    FlipVertical2,
    Hand,
    Grid2x2: Grid2X2,
    SkipBack,
    SkipForward,
    Images,
    Crop,
    ArrowUp,
    Box,
    ImagePlus,
    LayoutPanelLeft,
    Lightbulb,
    Download,
    Undo2,
    Redo2,
    MousePointer2,
    Move,
    Grid2X2,
    Copy,
    Trash2,
    Plus,
  Minus,
    ChevronDown,
    Maximize,
    FolderOpen,
    Save,
    HelpCircle,
    Camera,
    Image: ImageIcon,
    Check,
    Sun,
    PanelLeftClose,
    X,
    AlignCenter,
    ArrowUpToLine,
    Layers,
    RotateCcw,
    Play,
    Pause,
    Building2,
    Columns2,
    Ruler,
    Zap,
    Lock,
    LockOpen,
    Eye,
    EyeOff,
    ArrowLeftToLine,
    ArrowRightToLine,
    Video,
    UserRound,
    SlidersHorizontal,
    Footprints,
    Search,
    Bookmark,
    Tags,
    Magnet,
    Square,
    Map: MapIcon,
    Plug,
    Upload,
    Send,
    AlignHorizontalDistributeCenter,
    AlignStartVertical,
    Shapes,
    RotateCw,
    AlignStartHorizontal,
    ListOrdered,
    ArrowLeft,
    Route,
    DoorOpen,
    LayoutTemplate,
    Sparkles,
    MessageCircle,
    Ellipsis,
  };
  // An icon is written into the HTML as its finished SVG. lucide's
  // createIcons scans the whole document for placeholders and builds each
  // one as DOM nodes, and every inspector redraw paid for that again — a
  // visible share of what a click cost on a slow machine. The markup is built
  // once per icon name and reused as a string.
  const iconMarkup = new Map();
  const icon = (n) => {
    let svg = iconMarkup.get(n);
    if (svg === undefined) {
      const node = icons[n.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())];
      const attrs = (o) => Object.entries(o).map(([k, v]) => ` ${k}="${v}"`).join("");
      svg = node
        ? `<svg${attrs({ xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 1.6, "stroke-linecap": "round", "stroke-linejoin": "round", class: `lucide lucide-${n}`, "aria-hidden": "true" })}>${node[2].map(([tag, a]) => `<${tag}${attrs(a)}/>`).join("")}</svg>`
        : "";
      iconMarkup.set(n, svg);
    }
    return svg;
  };
  const btn = (action, label, ic, cls = "") =>
    `<button data-action="${action}" class="${cls}" title="${e(label)}" aria-label="${e(label)}">${ic ? icon(ic) : ""}<span>${label}</span></button>`;
  // Icons arrive as SVG already (see `icon`). This only converts a stray
  // lucide placeholder, should any markup still write one.
  function refreshIcons() {
    if (document.querySelector("i[data-lucide]")) createIcons({ icons, attrs: { "stroke-width": 1.6 } });
  }
  return { icon, btn, refreshIcons };
}
