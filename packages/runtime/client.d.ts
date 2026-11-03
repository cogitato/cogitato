// Types for the Vite plugin's virtual modules. Reference from the prototype:
//   /// <reference types="@cogitato/runtime/client" />
declare module "virtual:kit/kit" {
  import type { KitData } from "@cogitato/runtime";
  const kit: KitData;
  export default kit;
}

declare module "virtual:kit/tokens.css" {}
