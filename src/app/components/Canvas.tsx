import React, { useRef, useEffect, RefObject } from "react";
import styles from "./../styles.module.css";
import * as p2 from "p2-es";
import {
  ROTATION_HANDLE_DISTANCE,
  COLORS,
  ROTATION_HANDLE_RADIUS,
  FIXED_TIME_STEP,
  MAX_SUB_STEPS,
  getPhysicsCoord,
} from "../logic/render-util";
import {
  endInteraction,
  initMouseInteraction,
  startInteraction,
  updateInteraction,
} from "../logic/interaction-util";

interface CanvasProps {
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

export default function Canvas(props: CanvasProps) {
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

  // Convenience functions
  const _startInteraction = (worldPoint: [number, number]) => {
    startInteraction(
      worldPoint,
      Boolean(props.readOnly),
      props.worldRef,
      mouseBodyRef,
      mouseConstraintRef,
      selectedBodyRef,
      isRotatingRef,
      isDraggingRef,
      props.onRotationStart,
      props.onObjectSelected
    );
  };

  const _updateInteraction = (worldPoint: [number, number]) => {
    updateInteraction(
      worldPoint,
      Boolean(props.readOnly),
      mouseBodyRef,
      selectedBodyRef,
      isRotatingRef,
      isDraggingRef,
      props.onRotation
    );
  };

  const _endInteraction = () => {
    endInteraction(
      Boolean(props.readOnly),
      props.worldRef,
      mouseConstraintRef,
      selectedBodyRef,
      isRotatingRef,
      isDraggingRef,
      props.onRotationEnd
    );
  };

  const _initMouseInteraction = () => {
    initMouseInteraction(props.worldRef, Boolean(props.readOnly), mouseBodyRef);
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
        color = COLORS.selected; // Highlight selected body
      } else if (body.type === p2.Body.STATIC) {
        color = COLORS.static;
      } else if (body.type === p2.Body.KINEMATIC) {
        color = COLORS.kinematic;
      } else {
        color = COLORS.dynamic;
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
      ctx.strokeStyle = COLORS.rotationHandle;
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
      ctx.fillStyle = COLORS.rotationHandle;
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
      props.worldRef.current.step(FIXED_TIME_STEP, deltaTime, MAX_SUB_STEPS);

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
    const worldPoint = getPhysicsCoord(
      canvasRef,
      e.clientX,
      e.clientY,
      props.pixelsPerMeter,
      props.height
    );
    _startInteraction(worldPoint);
  };

  const handleMouseMove = (e: MouseEvent) => {
    const worldPoint = getPhysicsCoord(
      canvasRef,
      e.clientX,
      e.clientY,
      props.pixelsPerMeter,
      props.height
    );
    _updateInteraction(worldPoint);
  };

  const handleMouseUp = () => {
    _endInteraction();
  };

  // Add touch support for mobile
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const worldPoint = getPhysicsCoord(
        canvasRef,
        touch.clientX,
        touch.clientY,
        props.pixelsPerMeter,
        props.height
      );
      _startInteraction(worldPoint);
      e.preventDefault();
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const worldPoint = getPhysicsCoord(
        canvasRef,
        touch.clientX,
        touch.clientY,
        props.pixelsPerMeter,
        props.height
      );
      _updateInteraction(worldPoint);
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    _endInteraction();
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
        _initMouseInteraction();
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
