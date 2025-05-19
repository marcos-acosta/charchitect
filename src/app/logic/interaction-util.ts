import { RefObject } from "react";
import * as p2 from "p2-es";
import {
  ROTATION_HANDLE_DISTANCE,
  ROTATION_HANDLE_HIT_RADIUS,
} from "./render-util";
import { getBodyAtPoint } from "./p2-util";

// Check if a point is near the rotation handle
const isNearRotationHandle = (
  worldPoint: [number, number],
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
  const dx = worldPoint[0] - handleX;
  const dy = worldPoint[1] - handleY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance <= ROTATION_HANDLE_HIT_RADIUS;
};

// Calculate angle between body center and point
const calculateAngle = (
  bodyPosition: [number, number],
  point: [number, number]
): number => {
  const dx = point[0] - bodyPosition[0];
  const dy = point[1] - bodyPosition[1];
  return Math.atan2(dy, dx);
};

// Setup mouse interaction physics
export const initMouseInteraction = (
  worldRef: RefObject<p2.World | null>,
  readOnly: boolean,
  mouseBodyRef: RefObject<p2.Body | null>
) => {
  if (!worldRef.current || readOnly) return;

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
  readOnly: boolean,
  worldRef: RefObject<p2.World | null>,
  mouseBodyRef: RefObject<p2.Body | null>,
  mouseConstraintRef: RefObject<p2.Constraint | null>,
  selectedBodyRef: RefObject<p2.Body | null>,
  isRotatingRef: RefObject<boolean>,
  isDraggingRef: RefObject<boolean>,
  onRotationStart?: (body: p2.Body) => void,
  onObjectSelected?: (body: p2.Body | null) => void
) => {
  // If readOnly, do nothing
  if (readOnly || !worldRef.current || !mouseBodyRef.current) {
    return;
  }
  // First check if we're near the rotation handle
  if (
    selectedBodyRef.current &&
    isNearRotationHandle(worldPoint, selectedBodyRef)
  ) {
    // Start rotation mode
    isRotatingRef.current = true;
    // Notify parent component about rotation start
    if (onRotationStart) {
      onRotationStart(selectedBodyRef.current);
    }
    return;
  }
  // Otherwise check for body selection/dragging
  const hitBody = getBodyAtPoint(worldRef, worldPoint);
  if (hitBody && hitBody.type !== p2.Body.STATIC) {
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
  } else if (!hitBody) {
    // Clicked on empty space, deselect
    selectedBodyRef.current = null;
    if (onObjectSelected) {
      onObjectSelected(null);
    }
  }
};

// Update dragging or rotation
export const updateInteraction = (
  worldPoint: [number, number],
  readOnly: boolean,
  mouseBodyRef: RefObject<p2.Body | null>,
  selectedBodyRef: RefObject<p2.Body | null>,
  isRotatingRef: RefObject<boolean>,
  isDraggingRef: RefObject<boolean>,
  onRotation?: (body: p2.Body, angle: number) => void
) => {
  // If readOnly, do nothing
  if (readOnly) {
    return;
  }
  if (isRotatingRef.current && selectedBodyRef.current) {
    // We're in rotation mode
    const body = selectedBodyRef.current;
    // Calculate new angle based on mouse position relative to body center
    const newAngle = calculateAngle(
      body.position as [number, number],
      worldPoint
    );
    // Apply the rotation
    body.angle = newAngle;
    body.angularVelocity = 0; // Stop any existing rotation
    // Notify parent component about rotation
    if (onRotation) {
      onRotation(body, newAngle);
    }
  } else if (isDraggingRef.current && mouseBodyRef.current) {
    // Regular dragging mode
    mouseBodyRef.current.position = worldPoint;
  }
};

// End dragging or rotation
export const endInteraction = (
  readOnly: boolean,
  worldRef: RefObject<p2.World | null>,
  mouseConstraintRef: RefObject<p2.Constraint | null>,
  selectedBodyRef: RefObject<p2.Body | null>,
  isRotatingRef: RefObject<boolean>,
  isDraggingRef: RefObject<boolean>,
  onRotationEnd?: (body: p2.Body) => void
) => {
  // If readOnly, do nothing
  if (readOnly) return;

  if (isRotatingRef.current && selectedBodyRef.current) {
    // End rotation mode
    isRotatingRef.current = false;

    // Notify parent component
    if (onRotationEnd) {
      onRotationEnd(selectedBodyRef.current);
    }
  } else if (
    isDraggingRef.current &&
    worldRef.current &&
    mouseConstraintRef.current
  ) {
    // End dragging mode
    worldRef.current.removeConstraint(mouseConstraintRef.current);
    mouseConstraintRef.current = null;
    isDraggingRef.current = false;
  }
};
