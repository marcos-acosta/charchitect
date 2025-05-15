import { RefObject } from "react";
import * as p2 from "p2-es";
import { IPoints } from "./interfaces";

// Colors for different body types
export const COLORS = {
  dynamic: "#000",
  static: "#000",
  kinematic: "#000",
  selected: "#F04747",
  highestPoint: "#F04747",
  rotationHandle: "#F04747",
  circleOutline: "rgba(150, 150, 150, 0.5)",
  handleOutline: "#fff",
  background: "#fff",
};

// Constants for rotation handle
export const ROTATION_HANDLE_RADIUS = 0.1; // Size of the handle in meters
export const ROTATION_HANDLE_DISTANCE = 0.8; // Distance from center in meters
export const ROTATION_HANDLE_HIT_RADIUS = 0.2; // Clickable area in meters

// Fixed timestep for physics simulation
export const FIXED_TIME_STEP = 1 / 60; // 60 fps
export const MAX_SUB_STEPS = 10; // Maximum sub steps to catch up if frame rate drops

export const computePixelsPerMeter = (pixels: number, meters: number) =>
  pixels / meters;

export const computeMetersPerPixel = (pixels: number, meters: number) =>
  meters / pixels;

// Convert page coordinates to physics world coordinates
export const getPhysicsCoord = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  pageX: number,
  pageY: number,
  pixelsPerMeter: number,
  height: number
): [number, number] => {
  const canvas = canvasRef.current;
  if (!canvas) return [0, 0];
  const rect = canvas.getBoundingClientRect();
  const x = (pageX - rect.left) / pixelsPerMeter;
  const y = height / pixelsPerMeter - (pageY - rect.top) / pixelsPerMeter;
  return [x, y];
};

export const setUpCanvas = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pixelsPerMeter: number
) => {
  ctx.reset();
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.translate(0, height);
  ctx.scale(pixelsPerMeter, -pixelsPerMeter);
};

export const drawHighestPoint = (
  ctx: CanvasRenderingContext2D,
  highestPointPixels: number,
  widthInMeters: number
) => {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, highestPointPixels);
  ctx.lineTo(widthInMeters, highestPointPixels);
  ctx.strokeStyle = COLORS.highestPoint;
  ctx.lineWidth = 0.02;
  ctx.stroke();
  ctx.restore();
};

export const drawBox = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) => {
  ctx.fillStyle = COLORS.dynamic;
  ctx.fillRect(-width / 2, -height / 2, width, height);
  ctx.strokeStyle = COLORS.dynamic;
  ctx.lineWidth = 0.02;
  ctx.strokeRect(-width / 2, -height / 2, width, height);
};

export const drawPolygon = (
  shape: p2.Convex,
  ctx: CanvasRenderingContext2D,
  color: string
) => {
  const vertices = shape.vertices;

  if (vertices.length > 0) {
    ctx.beginPath();
    ctx.moveTo(vertices[0][0], vertices[0][1]);

    for (let i = 1; i < vertices.length; i++) {
      ctx.lineTo(vertices[i][0], vertices[i][1]);
    }

    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.01;
    ctx.stroke();
  }
};

export const drawRotationHandle = (
  ctx: CanvasRenderingContext2D,
  bodyX: number,
  bodyY: number,
  handleX: number,
  handleY: number
) => {
  // Draw line from body center to handle
  ctx.beginPath();
  ctx.moveTo(bodyX, bodyY);
  ctx.lineTo(handleX, handleY);
  ctx.strokeStyle = COLORS.rotationHandle;
  ctx.lineWidth = 0.02;
  ctx.stroke();

  // Draw dotted circle to indicate rotation path
  ctx.beginPath();
  ctx.arc(bodyX, bodyY, ROTATION_HANDLE_DISTANCE, 0, 2 * Math.PI);
  ctx.setLineDash([0.1, 0.1]);
  ctx.strokeStyle = COLORS.circleOutline;
  ctx.lineWidth = 0.01;
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw rotation handle
  ctx.beginPath();
  ctx.arc(handleX, handleY, ROTATION_HANDLE_RADIUS, 0, 2 * Math.PI);
  ctx.fillStyle = COLORS.rotationHandle;
  ctx.fill();
  ctx.strokeStyle = COLORS.handleOutline;
  ctx.lineWidth = 0.02;
  ctx.stroke();
};
