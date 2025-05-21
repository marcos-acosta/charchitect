import React, { useRef, useEffect, RefObject } from "react";
import styles from "./../styles.module.css";
import * as p2 from "p2-es";
import {
  ROTATION_HANDLE_DISTANCE,
  COLORS,
  FIXED_TIME_STEP,
  MAX_SUB_STEPS,
  getPhysicsCoord,
  setUpCanvas,
  drawHighestPoint,
  drawBox,
  drawPolygon,
  drawRotationHandle,
} from "../logic/render-util";
import {
  endInteraction,
  initMouseInteraction,
  startInteraction,
  updateInteraction,
} from "../logic/interaction-util";
import { getBodyAtPoint } from "../logic/p2-util";

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
  panOffset: [number, number]; // Current pan offset
  onPanChange: (fn: (offset: [number, number]) => [number, number]) => void; // Callback to update pan offset
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
  const isPanningRef = useRef<boolean>(false);
  const lastPanPointRef = useRef<[number, number] | null>(null);

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
      props.worldRef,
      mouseConstraintRef,
      selectedBodyRef,
      isRotatingRef,
      isDraggingRef,
      props.onRotationEnd
    );
  };

  const _initMouseInteraction = () => {
    initMouseInteraction(props.worldRef, mouseBodyRef);
  };

  const handleMouseDown = (e: MouseEvent) => {
    const worldPoint = getPhysicsCoord(
      canvasRef,
      e.clientX,
      e.clientY,
      props.pixelsPerMeter,
      props.height
    );

    // Check if we clicked on a body
    const hitBody = getBodyAtPoint(props.worldRef, worldPoint);

    if (hitBody) {
      _startInteraction(worldPoint);
    } else {
      // Start panning
      isPanningRef.current = true;
      lastPanPointRef.current = [e.clientX, e.clientY];
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isPanningRef.current && lastPanPointRef.current) {
      // Calculate pan delta in world coordinates
      const dx =
        (e.clientX - lastPanPointRef.current[0]) / props.pixelsPerMeter;
      const dy =
        -(e.clientY - lastPanPointRef.current[1]) / props.pixelsPerMeter;

      // Update pan offset
      props.onPanChange((panOffset: [number, number]) => [
        panOffset[0] + dx,
        panOffset[1] + dy,
      ]);

      lastPanPointRef.current = [e.clientX, e.clientY];
      return;
    }

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
    if (isPanningRef.current) {
      isPanningRef.current = false;
      lastPanPointRef.current = null;
    } else {
      _endInteraction();
    }
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

      // Check if we touched a body
      const hitBody = getBodyAtPoint(props.worldRef, worldPoint);

      if (hitBody) {
        _startInteraction(worldPoint);
      } else {
        // Start panning
        isPanningRef.current = true;
        lastPanPointRef.current = [touch.clientX, touch.clientY];
      }
      e.preventDefault();
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];

      if (isPanningRef.current && lastPanPointRef.current) {
        // Calculate pan delta in world coordinates
        const dx =
          (touch.clientX - lastPanPointRef.current[0]) / props.pixelsPerMeter;
        const dy =
          -(touch.clientY - lastPanPointRef.current[1]) / props.pixelsPerMeter;

        // Update pan offset
        props.onPanChange((panOffset: [number, number]) => [
          panOffset[0] + dx,
          panOffset[1] + dy,
        ]);

        lastPanPointRef.current = [touch.clientX, touch.clientY];
        e.preventDefault();
        return;
      }

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
    if (isPanningRef.current) {
      isPanningRef.current = false;
      lastPanPointRef.current = null;
    } else {
      _endInteraction();
    }
    e.preventDefault();
  };

  const drawWorld = (ctx: CanvasRenderingContext2D) => {
    setUpCanvas(ctx, props.width, props.height, props.pixelsPerMeter);

    // Apply pan offset
    ctx.translate(props.panOffset[0], props.panOffset[1]);

    // Draw highest point line if provided
    if (props.highestPoint && props.highestPoint.current > 0) {
      // Convert highest point to canvas coordinates
      const lineY = props.highestPoint.current;
      drawHighestPoint(ctx, lineY, props.width / props.pixelsPerMeter);
    }

    props.worldRef.current.bodies.forEach((body) => {
      // Skip drawing the mouse body
      if (mouseBodyRef.current && body === mouseBodyRef.current) return;

      ctx.save();
      ctx.translate(body.interpolatedPosition[0], body.interpolatedPosition[1]);
      ctx.rotate(body.angle);

      body.shapes.forEach((shape) => {
        const shapeOffset = shape.position;
        const shapeAngle = shape.angle;
        ctx.save();
        ctx.translate(shapeOffset[0], shapeOffset[1]);
        ctx.rotate(shapeAngle);
        if (shape instanceof p2.Box) {
          /** BOX */
          const width = shape.width;
          const height = shape.height;
          if (body.type !== p2.Body.STATIC) {
            drawBox(ctx, width, height);
          }
        } else if (shape instanceof p2.Convex) {
          /** POLYGON */
          const color =
            selectedBodyRef.current === body ? COLORS.selected : COLORS.dynamic;
          drawPolygon(shape, ctx, color);
        }
        ctx.restore(); // Restore after each shape
      });
      ctx.restore();
    });

    // Only draw rotation handle in interactive mode (not readOnly)
    if (!props.readOnly && selectedBodyRef.current) {
      const body = selectedBodyRef.current;
      const bodyX = body.interpolatedPosition[0];
      const bodyY = body.interpolatedPosition[1];

      // Calculate handle position
      const handleX = bodyX + Math.cos(body.angle) * ROTATION_HANDLE_DISTANCE;
      const handleY = bodyY + Math.sin(body.angle) * ROTATION_HANDLE_DISTANCE;

      drawRotationHandle(ctx, bodyX, bodyY, handleX, handleY);
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

  useEffect(() => {
    // Set up canvas and start animation loop
    const canvas = canvasRef.current;
    if (canvas) {
      // Scale the CSS size
      canvas.style.width = `${props.width}px`;
      canvas.style.height = `${props.height}px`;

      // Initialize mouse physics body (only for interactive mode)
      _initMouseInteraction();

      // Add event listeners
      canvas.addEventListener("mousedown", handleMouseDown);
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      // Touch events
      canvas.addEventListener("touchstart", handleTouchStart);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleTouchEnd);

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
  }, [props.width, props.height, props.panOffset]);

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
