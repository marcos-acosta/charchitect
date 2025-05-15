import { RefObject } from "react";

// Colors for different body types
export const COLORS = {
  dynamic: "#000",
  static: "#000",
  kinematic: "#000",
  selected: "#F04747", // Color for selected objects
  rotationHandle: "#F04747", // Color for rotation handle
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
export const getPhysicsCoord = (canvasRef: RefObject<HTMLCanvasElement | null>, pageX: number, pageY: number, pixelsPerMeter: number, height: number): [number, number] => {
  const canvas = canvasRef.current;
  if (!canvas) return [0, 0];
  const rect = canvas.getBoundingClientRect();
  const x = (pageX - rect.left) / pixelsPerMeter;
  const y =
    height / pixelsPerMeter -
    (pageY - rect.top) / pixelsPerMeter;
  return [x, y];
};
