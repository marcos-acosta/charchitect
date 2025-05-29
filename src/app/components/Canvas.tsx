import React, { useRef, useEffect, RefObject } from "react";
import styles from "./../styles.module.css";
import * as p2 from "p2-es";
import {
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
import { paintCanvas } from "./CanvasPainter";

interface CanvasProps {
  worldRef: RefObject<p2.World>;
  width: number;
  height: number;
  pixelsPerMeter: number;
  highestPoint?: RefObject<number | null>;
  onAfterStep?: () => void;
  panOffset: [number, number];
  onPanChange: (fn: (offset: [number, number]) => [number, number]) => void;
  lettersInUse?: Record<number, string>;
  isDragging?: boolean;
  isRotating?: boolean;
  isPanning?: boolean;
  setIsDragging?: (b: boolean) => void;
  setIsRotating?: (b: boolean) => void;
  setIsPanning?: (b: boolean) => void;
  isTrialMode?: boolean;
}

export default function Canvas(props: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(-1);
  const previousTimeRef = useRef<number | null>(null);

  // Mouse interaction state
  const mouseConstraintRef = useRef<p2.Constraint | null>(null);
  const mouseBodyRef = useRef<p2.Body | null>(null);
  const selectedBodyRef = useRef<p2.Body | null>(null);
  const lastPanPointRef = useRef<[number, number] | null>(null);

  // Reset interaction refs when lettersInUse changes
  useEffect(() => {
    mouseConstraintRef.current = null;
    selectedBodyRef.current = null;
    if (props.setIsDragging) props.setIsDragging(false);
    if (props.setIsRotating) props.setIsRotating(false);
    if (props.setIsPanning) props.setIsPanning(false);
  }, [props.lettersInUse]);

  // Convenience functions
  const _startInteraction = (
    worldPoint: [number, number],
    e: MouseEvent | Touch
  ) => {
    if (props.isTrialMode) return; // Disable interaction in trial mode
    startInteraction(
      worldPoint,
      props.panOffset,
      e,
      props.worldRef,
      mouseBodyRef,
      mouseConstraintRef,
      selectedBodyRef,
      props.setIsRotating,
      props.setIsDragging,
      props.setIsPanning,
      lastPanPointRef
    );
  };

  const _updateInteraction = (
    worldPoint: [number, number],
    e: MouseEvent | Touch
  ) => {
    if (props.isTrialMode) return; // Disable interaction in trial mode
    updateInteraction(
      worldPoint,
      props.panOffset,
      e,
      mouseBodyRef,
      selectedBodyRef,
      props.isRotating,
      props.isDragging,
      props.isPanning,
      lastPanPointRef,
      props.pixelsPerMeter,
      props.onPanChange
    );
  };

  const _endInteraction = () => {
    if (props.isTrialMode) return; // Disable interaction in trial mode
    endInteraction(
      props.worldRef,
      mouseConstraintRef,
      selectedBodyRef,
      props.isRotating,
      props.isDragging,
      props.isPanning,
      props.setIsRotating,
      props.setIsDragging,
      props.setIsPanning,
      lastPanPointRef
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

    _startInteraction(worldPoint, e);
  };

  const handleMouseMove = (e: MouseEvent) => {
    const worldPoint = getPhysicsCoord(
      canvasRef,
      e.clientX,
      e.clientY,
      props.pixelsPerMeter,
      props.height
    );
    _updateInteraction(worldPoint, e);
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
      _startInteraction(worldPoint, touch);
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
      _updateInteraction(worldPoint, touch);
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    _endInteraction();
  };

  // Animation loop using requestAnimationFrame
  const animate = (time: number) => {
    if (previousTimeRef.current === null) {
      previousTimeRef.current = time;
    }
    // Calculate time elapsed since last frame
    const deltaTime = (time - previousTimeRef.current) / 1000; // in seconds
    previousTimeRef.current = time;

    // Step the world
    if (props.worldRef.current) {
      props.worldRef.current.step(FIXED_TIME_STEP, deltaTime, MAX_SUB_STEPS);
      if (props.onAfterStep) {
        props.onAfterStep();
      }
    }

    // Draw the updated world
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Clear canvas
        ctx.clearRect(0, 0, props.width, props.height);

        // Draw world
        paintCanvas({
          ctx,
          width: props.width,
          height: props.height,
          pixelsPerMeter: props.pixelsPerMeter,
          world: props.worldRef.current,
          panOffset: props.panOffset,
          highestPoint: props.highestPoint?.current,
          selectedBody: selectedBodyRef.current,
          readOnly: props.isTrialMode,
          mouseBody: mouseBodyRef.current,
        });
      }
    }
    // Schedule the next frame
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    _initMouseInteraction();
  }, []);

  // Set up canvas and start animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Scale the CSS size
      canvas.style.width = `${props.width}px`;
      canvas.style.height = `${props.height}px`;

      // Add event listeners
      canvas.addEventListener("mousedown", handleMouseDown);
      canvas.addEventListener("mousemove", handleMouseMove);
      canvas.addEventListener("mouseup", handleMouseUp);

      // Touch events
      canvas.addEventListener("touchstart", handleTouchStart);
      canvas.addEventListener("touchmove", handleTouchMove);
      canvas.addEventListener("touchend", handleTouchEnd);

      // Start the animation loop (for both interactive and read-only)
      requestRef.current = requestAnimationFrame(animate);

      // Clean up animation and event listeners
      return () => {
        if (requestRef.current !== -1) {
          cancelAnimationFrame(requestRef.current);
        }

        canvas.removeEventListener("mousedown", handleMouseDown);
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("mouseup", handleMouseUp);

        // Touch events
        canvas.removeEventListener("touchstart", handleTouchStart);
        canvas.removeEventListener("touchmove", handleTouchMove);
        canvas.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [
    props.width,
    props.height,
    props.panOffset,
    props.isPanning,
    props.isDragging,
    props.isRotating,
    props.setIsPanning,
    props.setIsDragging,
    props.setIsRotating,
    props.isTrialMode,
    props.pixelsPerMeter,
  ]);

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
