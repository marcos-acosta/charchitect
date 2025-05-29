import { RefObject } from "react";
import * as p2 from "p2-es";
import {
  ROTATION_HANDLE_DISTANCE,
  ROTATION_HANDLE_HIT_RADIUS,
} from "./render-util";
import { getBodyAtPoint, isLetter, worldHasId } from "./p2-util";

// Check if a point is near the rotation handle
const isNearRotationHandle = (
  worldPoint: [number, number],
  panOffset: [number, number],
  selectedBodyRef: RefObject<p2.Body | null>
): boolean => {
  if (!selectedBodyRef.current) return false;

  const body = selectedBodyRef.current;

  // Calculate handle position in world coordinates
  const handleX =
    body.position[0] + Math.cos(body.angle) * ROTATION_HANDLE_DISTANCE;
  const handleY =
    body.position[1] + Math.sin(body.angle) * ROTATION_HANDLE_DISTANCE;

  // Calculate distance between point and handle
  const dx = worldPoint[0] - handleX - panOffset[0];
  const dy = worldPoint[1] - handleY - panOffset[1];
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance <= ROTATION_HANDLE_HIT_RADIUS;
};

// Calculate angle between body center and point
const calculateAngle = (
  bodyPosition: [number, number],
  point: [number, number],
  panOffset: [number, number]
): number => {
  const dx = point[0] - bodyPosition[0] - panOffset[0];
  const dy = point[1] - bodyPosition[1] - panOffset[1];
  return Math.atan2(dy, dx);
};

// Setup mouse interaction physics
export const initMouseInteraction = (
  worldRef: RefObject<p2.World | null>,
  mouseBodyRef: RefObject<p2.Body | null>
) => {
  // If the mouse body already exists, don't create a new one
  if (
    !worldRef.current ||
    (mouseBodyRef.current &&
      worldHasId(worldRef.current, mouseBodyRef.current.id))
  ) {
    return;
  }
  // Create a body for the mouse cursor
  const mouseBody = new p2.Body({
    type: p2.Body.KINEMATIC,
    collisionResponse: false,
  });
  worldRef.current.addBody(mouseBody);
  mouseBodyRef.current = mouseBody;
};

// Start drag or rotation
export const startInteraction = (
  worldPoint: [number, number],
  panOffset: [number, number],
  mouseEvent: MouseEvent | Touch,
  worldRef: RefObject<p2.World | null>,
  mouseBodyRef: RefObject<p2.Body | null>,
  mouseConstraintRef: RefObject<p2.Constraint | null>,
  selectedBodyRef: RefObject<p2.Body | null>,
  setIsRotating: ((b: boolean) => void) | undefined,
  setIsDragging: ((b: boolean) => void) | undefined,
  setIsPanning: ((b: boolean) => void) | undefined,
  lastPanPointRef: RefObject<[number, number] | null>
) => {
  // If readOnly, do nothing
  if (!worldRef.current || !mouseBodyRef.current) {
    return;
  }
  // First check if we're near the rotation handle
  if (
    selectedBodyRef.current &&
    isNearRotationHandle(worldPoint, panOffset, selectedBodyRef)
  ) {
    // Start rotation mode
    setIsRotating?.(true);
    return;
  }
  // Otherwise check for body selection/dragging
  const hitBody = getBodyAtPoint(worldRef, worldPoint, panOffset);
  if (hitBody && isLetter(hitBody)) {
    selectedBodyRef.current = hitBody;
    setIsDragging?.(true);
    // Position the mouse body at the click point
    mouseBodyRef.current.position = worldPoint;
    // Create a constraint between the body and the mouse
    const constraint = new p2.LockConstraint(mouseBodyRef.current, hitBody, {
      collideConnected: false,
    });
    // Set constraint parameters for smoother dragging
    constraint.setStiffness(Math.min()); // Spring stiffness
    constraint.setRelaxation(1); // Relaxation for soft constraint
    mouseConstraintRef.current = constraint;
    worldRef.current.addConstraint(constraint);
  } else {
    // Clicked on empty space, deselect
    selectedBodyRef.current = null;
    setIsPanning?.(true);
    lastPanPointRef.current = [mouseEvent.clientX, mouseEvent.clientY];
  }
};

// Update dragging or rotation
export const updateInteraction = (
  worldPoint: [number, number],
  panOffset: [number, number],
  mouseEvent: MouseEvent | Touch,
  mouseBodyRef: RefObject<p2.Body | null>,
  selectedBodyRef: RefObject<p2.Body | null>,
  isRotating: boolean | undefined,
  isDragging: boolean | undefined,
  isPanning: boolean | undefined,
  lastPanPointRef: RefObject<[number, number] | null>,
  pixelsPerMeter: number,
  onPanChange?: (fn: (offset: [number, number]) => [number, number]) => void
) => {
  if (isRotating && selectedBodyRef.current) {
    // We're in rotation mode
    const body = selectedBodyRef.current;
    // Calculate new angle based on mouse position relative to body center
    const newAngle = calculateAngle(
      body.position as [number, number],
      worldPoint,
      panOffset
    );
    // Apply the rotation
    body.angle = newAngle;
    body.angularVelocity = 0; // Stop any existing rotation
  } else if (isDragging && mouseBodyRef.current) {
    // Regular dragging mode - update mouse body position
    mouseBodyRef.current.position = worldPoint;
  } else if (isPanning && lastPanPointRef.current && onPanChange) {
    // Calculate pan delta in world coordinates
    const dx =
      (mouseEvent.clientX - lastPanPointRef.current[0]) / pixelsPerMeter;
    const dy =
      -(mouseEvent.clientY - lastPanPointRef.current[1]) / pixelsPerMeter;

    // Update pan offset
    onPanChange((panOffset: [number, number]) => [
      panOffset[0] + dx,
      panOffset[1] + dy,
    ]);

    lastPanPointRef.current = [mouseEvent.clientX, mouseEvent.clientY];
  }
};

// End dragging or rotation
export const endInteraction = (
  worldRef: RefObject<p2.World | null>,
  mouseConstraintRef: RefObject<p2.Constraint | null>,
  selectedBodyRef: RefObject<p2.Body | null>,
  isRotating: boolean | undefined,
  isDragging: boolean | undefined,
  isPanning: boolean | undefined,
  setIsRotating: ((b: boolean) => void) | undefined,
  setIsDragging: ((b: boolean) => void) | undefined,
  setIsPanning: ((b: boolean) => void) | undefined,
  lastPanPointRef: RefObject<[number, number] | null>
) => {
  if (isRotating && selectedBodyRef.current) {
    // End rotation mode
    if (setIsRotating) setIsRotating(false);
  } else if (isDragging && worldRef.current && mouseConstraintRef.current) {
    // End dragging mode
    worldRef.current.removeConstraint(mouseConstraintRef.current);
    mouseConstraintRef.current = null;
    if (setIsDragging) setIsDragging(false);
  } else if (isPanning) {
    if (setIsPanning) setIsPanning(false);
    lastPanPointRef.current = null;
  }
};

export const isPointOverLetter = (
  worldRef: RefObject<p2.World>,
  pointInWorld: [number, number],
  panOffset: [number, number]
) => {
  const hitBody = getBodyAtPoint(worldRef, pointInWorld, panOffset);
  return hitBody && isLetter(hitBody);
};
