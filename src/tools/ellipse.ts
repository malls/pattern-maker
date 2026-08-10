import { ellipseFilled, ellipseOutline } from "../raster/raster";
import { makeShapeTool } from "./shape";
import type { Tool } from "./types";

export const ellipseTool: Tool = makeShapeTool(
  "ellipse",
  "o",
  "ellipse",
  "circle-ish comes free. click again to fill",
  ellipseOutline,
  ellipseFilled,
);
