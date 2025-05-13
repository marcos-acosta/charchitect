import React, { useRef, useEffect, RefObject, useState } from "react";
import styles from "./../styles.module.css";
import * as p2 from "p2-es";

interface PhysicsRendererProps {
  worldRef: RefObject<p2.World>;
  width: number;
  height: number;
  pixelsPerMeter: number;
  readOnly?: boolean; // New prop to control if canvas is interactive
  onObjectSelected?: (body: p2.Body | null) => void;
  onRotationStart?: (body: p2.Body) => void;
  onRotation?: (body: p2.Body, angle: number) => void;
  onRotationEnd?: (body: p2.Body) => void;
  highestPoint?: RefObject<number>; // Optional highest point to display
  onAfterStep?: () => void; // Callback after each physics step
}

// Colors for different body types
const colors = {
  dynamic: "#000",
  static: "#000",
  kinematic: "#000",
  selected: "#F04747", // Color for selected objects
  rotationHandle: "#F04747", // Color for rotation handle
};

// Constants for rotation handle
const ROTATION_HANDLE_RADIUS = 0.1; // Size of the handle in meters
const ROTATION_HANDLE_DISTANCE = 0.8; // Distance from center in meters
const ROTATION_HANDLE_HIT_RADIUS = 0.2; // Clickable area in meters

export default function PhysicsRenderer(props: PhysicsRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(-1);
  const previousTimeRef = useRef<number | null>(null);

  // Mouse interaction state
  const mouseConstraintRef = useRef<p2.Constraint | null>(null);
  const mouseBodyRef = useRef<p2.Body | null>(null);
  const selectedBodyRef = useRef<p2.Body | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // Rotation state
  const isRotatingRef = useRef<boolean>(false);
  const rotationStartAngleRef = useRef<number>(0);

  // Fixed timestep for physics simulation
  const fixedTimeStep = 1 / 60; // 60 fps
  const maxSubSteps = 10; // Maximum sub steps to catch up if frame rate drops

  // Convert page coordinates to physics world coordinates
  const getPhysicsCoord = (pageX: number, pageY: number): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];

    const rect = canvas.getBoundingClientRect();
    const x = (pageX - rect.left) / props.pixelsPerMeter;
    const y =
      props.height / props.pixelsPerMeter -
      (pageY - rect.top) / props.pixelsPerMeter;
    return [x, y];
  };

  // Find the body under the given point
  const getBodyAtPoint = (worldPoint: [number, number]): p2.Body | null => {
    const world = props.worldRef.current;
    if (!world) return null;

    // Use world.hitTest to find bodies at the given point
    const hitBodies = world.hitTest(worldPoint, world.bodies, 0.1);

    if (hitBodies.length > 0) {
      // Filter out static bodies if you don't want to drag them
      const dynamicBodies = hitBodies.filter((b) => b.type !== p2.Body.STATIC);
      return dynamicBodies.length > 0 ? dynamicBodies[0] : null;
    }

    return null;
  };

  // Check if a point is near the rotation handle
  const isNearRotationHandle = (worldPoint: [number, number]): boolean => {
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
  const initMouseInteraction = () => {
    if (!props.worldRef.current || props.readOnly) return;

    // Create a body for the mouse cursor
    const mouseBody = new p2.Body({
      type: p2.Body.KINEMATIC,
      collisionResponse: false,
    });
    props.worldRef.current.addBody(mouseBody);
    mouseBodyRef.current = mouseBody;
  };

  // Start drag or rotation
  const startInteraction = (worldPoint: [number, number]) => {
    // If readOnly, do nothing
    if (props.readOnly) return;

    if (!props.worldRef.current || !mouseBodyRef.current) return;

    // First check if we're near the rotation handle
    if (selectedBodyRef.current && isNearRotationHandle(worldPoint)) {
      // Start rotation mode
      isRotatingRef.current = true;

      // Notify parent component about rotation start
      if (props.onRotationStart) {
        props.onRotationStart(selectedBodyRef.current);
      }

      return;
    }

    // Otherwise check for body selection/dragging
    const hitBody = getBodyAtPoint(worldPoint);

    if (hitBody && hitBody.type !== p2.Body.STATIC) {
      selectedBodyRef.current = hitBody;
      isDraggingRef.current = true;

      // Notify parent component about the selected body
      if (props.onObjectSelected) {
        props.onObjectSelected(hitBody);
      }

      // Position the mouse body at the click point
      mouseBodyRef.current.position = worldPoint;

      // Create a constraint between the body and the mouse
      const constraint = new p2.LockConstraint(mouseBodyRef.current, hitBody, {
        collideConnected: false,
      });

      // Set constraint parameters for smoother dragging
      constraint.setStiffness(Math.max()); // Spring stiffness
      constraint.setRelaxation(1); // Relaxation for soft constraint

      props.worldRef.current.addConstraint(constraint);
      mouseConstraintRef.current = constraint;
    } else if (!hitBody) {
      // Clicked on empty space, deselect
      selectedBodyRef.current = null;
      if (props.onObjectSelected) {
        props.onObjectSelected(null);
      }
    }
  };

  // Update dragging or rotation
  const updateInteraction = (worldPoint: [number, number]) => {
    // If readOnly, do nothing
    if (props.readOnly) return;

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
      if (props.onRotation) {
        props.onRotation(body, newAngle);
      }
    } else if (isDraggingRef.current && mouseBodyRef.current) {
      // Regular dragging mode
      mouseBodyRef.current.position = worldPoint;
    }
  };

  // End dragging or rotation
  const endInteraction = () => {
    // If readOnly, do nothing
    if (props.readOnly) return;

    if (isRotatingRef.current && selectedBodyRef.current) {
      // End rotation mode
      isRotatingRef.current = false;

      // Notify parent component
      if (props.onRotationEnd) {
        props.onRotationEnd(selectedBodyRef.current);
      }
    } else if (
      isDraggingRef.current &&
      props.worldRef.current &&
      mouseConstraintRef.current
    ) {
      // End dragging mode
      props.worldRef.current.removeConstraint(mouseConstraintRef.current);
      mouseConstraintRef.current = null;
      isDraggingRef.current = false;
    }
  };

  const drawWorld = (ctx: CanvasRenderingContext2D) => {
    ctx.reset();
    ctx.save();
    ctx.clearRect(0, 0, props.width, props.height);
    ctx.translate(0, props.height);
    ctx.scale(props.pixelsPerMeter, -props.pixelsPerMeter);

    // Draw highest point line if provided
    if (props.highestPoint && props.highestPoint.current > 0) {
      // console.log("here!", props.highestPoint);
      ctx.save();
      // Convert highest point to canvas coordinates
      const lineY = props.highestPoint.current;

      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(props.width / props.pixelsPerMeter, lineY);
      ctx.strokeStyle = "red";
      ctx.lineWidth = 0.02;
      ctx.stroke();

      ctx.restore();
    }

    props.worldRef.current.bodies.forEach((body) => {
      // Skip drawing the mouse body
      if (mouseBodyRef.current && body === mouseBodyRef.current) return;

      ctx.save();
      ctx.translate(body.position[0], body.position[1]);
      ctx.rotate(body.angle);

      // Determine color based on body type and selection state
      let color;
      if (!props.readOnly && selectedBodyRef.current === body) {
        color = colors.selected; // Highlight selected body
      } else if (body.type === p2.Body.STATIC) {
        color = colors.static;
      } else if (body.type === p2.Body.KINEMATIC) {
        color = colors.kinematic;
      } else {
        color = colors.dynamic;
      }

      body.shapes.forEach((shape) => {
        const shapeOffset = shape.position;
        const shapeAngle = shape.angle;

        ctx.save();
        ctx.translate(shapeOffset[0], shapeOffset[1]);
        ctx.rotate(shapeAngle);

        if (shape instanceof p2.Box) {
          // Draw box
          const width = shape.width;
          const height = shape.height;

          ctx.fillStyle = color;
          ctx.fillRect(-width / 2, -height / 2, width, height);
          ctx.strokeStyle = color;
          ctx.lineWidth = 0.02;
          ctx.strokeRect(-width / 2, -height / 2, width, height);
        } else if (shape instanceof p2.Circle) {
          // Draw circle
          const radius = shape.radius;

          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 0.02;
          ctx.stroke();

          // Draw a line from center to edge to visualize rotation
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(radius, 0);
          ctx.strokeStyle = color;
          ctx.stroke();
        } else if (shape instanceof p2.Convex) {
          // Draw convex polygon
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
        }

        ctx.restore(); // Restore after each shape
      });

      ctx.restore();
    });

    // Only draw rotation handle in interactive mode (not readOnly)
    if (!props.readOnly && selectedBodyRef.current) {
      const body = selectedBodyRef.current;
      const bodyX = body.position[0];
      const bodyY = body.position[1];

      // Calculate handle position
      const handleX = bodyX + Math.cos(body.angle) * ROTATION_HANDLE_DISTANCE;
      const handleY = bodyY + Math.sin(body.angle) * ROTATION_HANDLE_DISTANCE;

      // Draw line from body center to handle
      ctx.beginPath();
      ctx.moveTo(bodyX, bodyY);
      ctx.lineTo(handleX, handleY);
      ctx.strokeStyle = colors.rotationHandle;
      ctx.lineWidth = 0.02;
      ctx.stroke();

      // Draw dotted circle to indicate rotation path
      ctx.beginPath();
      ctx.arc(bodyX, bodyY, ROTATION_HANDLE_DISTANCE, 0, 2 * Math.PI);
      ctx.setLineDash([0.1, 0.1]);
      ctx.strokeStyle = "rgba(150, 150, 150, 0.5)";
      ctx.lineWidth = 0.01;
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw rotation handle
      ctx.beginPath();
      ctx.arc(handleX, handleY, ROTATION_HANDLE_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = colors.rotationHandle;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 0.02;
      ctx.stroke();
    }

    ctx.restore();
  };

  // Animation loop using requestAnimationFrame
  const animate = (time: number) => {
    if (previousTimeRef.current === null) {
      previousTimeRef.current = time;
    }

    // Calculate time elapsed since last frame
    const deltaTime = (time - previousTimeRef.current) / 1000; // in seconds
    previousTimeRef.current = time;

    // Step the physics world forward
    if (props.worldRef.current) {
      props.worldRef.current.step(fixedTimeStep, deltaTime, maxSubSteps);

      // Call onAfterStep callback if provided
      if (props.onAfterStep) {
        props.onAfterStep();
      }
    }

    // Draw the updated world
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        drawWorld(ctx);
      }
    }

    // Schedule the next frame
    requestRef.current = requestAnimationFrame(animate);
  };

  const handleMouseDown = (e: MouseEvent) => {
    const worldPoint = getPhysicsCoord(e.clientX, e.clientY);
    startInteraction(worldPoint);
  };

  const handleMouseMove = (e: MouseEvent) => {
    const worldPoint = getPhysicsCoord(e.clientX, e.clientY);
    updateInteraction(worldPoint);
  };

  const handleMouseUp = () => {
    endInteraction();
  };

  // Add touch support for mobile
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const worldPoint = getPhysicsCoord(touch.clientX, touch.clientY);
      startInteraction(worldPoint);
      e.preventDefault();
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const worldPoint = getPhysicsCoord(touch.clientX, touch.clientY);
      updateInteraction(worldPoint);
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    endInteraction();
    e.preventDefault();
  };

  useEffect(() => {
    // Set up canvas and start animation loop
    const canvas = canvasRef.current;
    if (canvas) {
      // Scale the CSS size
      canvas.style.width = `${props.width}px`;
      canvas.style.height = `${props.height}px`;

      // Initialize mouse physics body (only for interactive mode)
      if (!props.readOnly) {
        initMouseInteraction();
      }

      if (!props.readOnly) {
        // Add event listeners
        canvas.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        // Touch events
        canvas.addEventListener("touchstart", handleTouchStart);
        window.addEventListener("touchmove", handleTouchMove);
        window.addEventListener("touchend", handleTouchEnd);
      }

      // Start the animation loop (for both interactive and read-only)
      requestRef.current = requestAnimationFrame(animate);

      // Clean up animation and physics objects on unmount
      return () => {
        if (requestRef.current !== -1) {
          cancelAnimationFrame(requestRef.current);
        }

        canvas.removeEventListener("mousedown", handleMouseDown);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);

        // Touch events
        canvas.removeEventListener("touchstart", handleTouchStart);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleTouchEnd);

        // Clean up physics objects
        if (props.worldRef.current && mouseBodyRef.current) {
          // Remove constraint if it exists
          if (mouseConstraintRef.current) {
            props.worldRef.current.removeConstraint(mouseConstraintRef.current);
          }
          // Remove mouse body
          props.worldRef.current.removeBody(mouseBodyRef.current);
        }
      };
    }
  }, [props.width, props.height, props.readOnly]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      style={{
        width: `${props.width}px`,
        height: `${props.height}px`,
      }}
      width={props.width}
      height={props.height}
    />
  );
}
