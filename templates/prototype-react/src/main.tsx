import "virtual:kit/tokens.css";
import "./styles/global.css";
import kit from "virtual:kit/kit";
import { mountPrototype, type ScreenDefinition } from "@cogitato/runtime";

// Every src/screens/**/screen.tsx registers one screen with defineScreen.
const screens = Object.values(
  import.meta.glob<ScreenDefinition>("./screens/**/screen.tsx", { eager: true, import: "default" }),
);

mountPrototype(document.getElementById("root"), { screens, kit });
