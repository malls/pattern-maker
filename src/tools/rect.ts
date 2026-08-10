import { rectFilled, rectOutline } from "../raster/raster";
import { makeShapeTool } from "./shape";
import type { Tool } from "./types";

export const rectTool: Tool = makeShapeTool(
  "rect",
  "r",
  "rect",
  "drag corner to corner. click again to fill",
  rectOutline,
  rectFilled,
);
