import { ellipseFilled, ellipseOutline } from "../raster/raster";
import { makeShapeTool } from "./shape";
import type { Tool } from "./types";

export const ellipseTool: Tool = makeShapeTool(
  "ellipse",
  "o",
  "ellipse",
  "drag corner to corner. circle-ish comes free",
  ellipseOutline,
  ellipseFilled,
);
