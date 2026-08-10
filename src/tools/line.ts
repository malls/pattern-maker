import { line } from "../raster/raster";
import { makeShapeTool } from "./shape";
import type { Tool } from "./types";

export const lineTool: Tool = makeShapeTool(
  "line",
  "l",
  "line",
  "drag to place a straight line",
  line,
);
