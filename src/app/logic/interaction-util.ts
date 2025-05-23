import { RefObject } from "react";
import * as p2 from "p2-es";
import {
  ROTATION_HANDLE_DISTANCE,
  ROTATION_HANDLE_HIT_RADIUS,
} from "./render-util";
import { getBodyAtPoint, isLetter } from "./p2-util";

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
  if (!worldRef.current) return;

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
  readOnly: boolean,
  worldRef: RefObject<p2.World | null>,
  mouseBodyRef: RefObject<p2.Body | null>,
  mouseConstraintRef: RefObject<p2.Constraint | null>,
  selectedBodyRef: RefObject<p2.Body | null>,
  isRotatingRef: RefObject<boolean>,
  isDraggingRef: RefObject<boolean>,
  isPanningRef: RefObject<boolean>,
  lastPanPointRef: RefObject<[number, number] | null>,
  onObjectSelected?: (body: p2.Body | null) => void
) => {
  // If readOnly, do nothing
  if (!worldRef.current || !mouseBodyRef.current) {
    return;
  }
  // First check if we're near the rotation handle
  if (
    !readOnly &&
    selectedBodyRef.current &&
    isNearRotationHandle(worldPoint, panOffset, selectedBodyRef)
  ) {
    // Start rotation mode
    isRotatingRef.current = true;
    return;
  }
  // Otherwise check for body selection/dragging
  const hitBody = getBodyAtPoint(worldRef, worldPoint, panOffset);
  if (!readOnly && hitBody && isLetter(hitBody)) {
    selectedBodyRef.current = hitBody;
    isDraggingRef.current = true;
    // Notify parent component about the selected body
    if (onObjectSelected) {
      onObjectSelected(hitBody);
    }
    // Position the mouse body at the click point
    mouseBodyRef.current.position = worldPoint;
    // Create a constraint between the body and the mouse
    const constraint = new p2.LockConstraint(mouseBodyRef.current, hitBody, {
      collideConnected: false,
    });
    // Set constraint parameters for smoother dragging
    constraint.setStiffness(Math.min()); // Spring stiffness
    constraint.setRelaxation(1); // Relaxation for soft constraint
    worldRef.current.addConstraint(constraint);
    mouseConstraintRef.current = constraint;
  } else {
    // Clicked on empty space, deselect
    selectedBodyRef.current = null;
    if (onObjectSelected) {
      onObjectSelected(null);
    }
    isPanningRef.current = true;
    lastPanPointRef.current = [mouseEvent.clientX, mouseEvent.clientY];
  }
};

// Update dragging or rotation
export const updateInteraction = (
  worldPoint: [number, number],
  panOffset: [number, number],
  mouseEvent: MouseEvent | Touch,
  readOnly: boolean,
  mouseBodyRef: RefObject<p2.Body | null>,
  selectedBodyRef: RefObject<p2.Body | null>,
  isRotatingRef: RefObject<boolean>,
  isDraggingRef: RefObject<boolean>,
  isPanningRef: RefObject<boolean>,
  lastPanPointRef: RefObject<[number, number] | null>,
  pixelsPerMeter: number,
  onRotation?: (body: p2.Body, angle: number) => void,
  onPanChange?: (fn: (offset: [number, number]) => [number, number]) => void
) => {
  if (isRotatingRef.current && selectedBodyRef.current && !readOnly) {
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
    // Notify parent component about rotation
    if (onRotation) {
      onRotation(body, newAngle);
    }
  } else if (isDraggingRef.current && mouseBodyRef.current && !readOnly) {
    // Regular dragging mode
    mouseBodyRef.current.position = worldPoint;
  } else if (isPanningRef.current && lastPanPointRef.current && onPanChange) {
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
  isRotatingRef: RefObject<boolean>,
  isDraggingRef: RefObject<boolean>,
  isPanningRef: RefObject<boolean>,
  lastPanPointRef: RefObject<[number, number] | null>
) => {
  if (isRotatingRef.current && selectedBodyRef.current) {
    // End rotation mode
    isRotatingRef.current = false;
  } else if (
    isDraggingRef.current &&
    worldRef.current &&
    mouseConstraintRef.current
  ) {
    // End dragging mode
    worldRef.current.removeConstraint(mouseConstraintRef.current);
    mouseConstraintRef.current = null;
    isDraggingRef.current = false;
  } else if (isPanningRef.current) {
    isPanningRef.current = false;
    lastPanPointRef.current = null;
  }
};
