import React, { useRef, useEffect, RefObject } from "react";
import * as p2 from "p2-es";

interface PhysicsRendererProps {
  worldRef: RefObject<p2.World>;
  width: number;
  height: number;
  pixelsPerMeter: number;
}

// Colors for different body types
const colors = {
  dynamic: "#3498db",
  static: "#2ecc71",
  kinematic: "#e74c3c",
  selected: "#f39c12", // Color for selected objects
};

export default function PhysicsRenderer(props: PhysicsRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(-1);
  const previousTimeRef = useRef<number | null>(null);

  // Mouse interaction state
  const mouseConstraintRef = useRef<p2.Constraint | null>(null);
  const mouseBodyRef = useRef<p2.Body | null>(null);
  const selectedBodyRef = useRef<p2.Body | null>(null);
  const isDraggingRef = useRef<boolean>(false);

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

  // Setup mouse interaction physics
  const initMouseInteraction = () => {
    if (!props.worldRef.current) return;

    // Create a body for the mouse cursor
    const mouseBody = new p2.Body({
      type: p2.Body.KINEMATIC,
      collisionResponse: false,
    });
    props.worldRef.current.addBody(mouseBody);
    mouseBodyRef.current = mouseBody;
  };

  // Start dragging a body
  const startDrag = (worldPoint: [number, number]) => {
    if (!props.worldRef.current || !mouseBodyRef.current) return;

    const hitBody = getBodyAtPoint(worldPoint);

    if (hitBody && hitBody.type !== p2.Body.STATIC) {
      selectedBodyRef.current = hitBody;
      isDraggingRef.current = true;

      // Position the mouse body at the click point
      mouseBodyRef.current.position = worldPoint;

      // Create a constraint between the body and the mouse
      const constraint = new p2.LockConstraint(mouseBodyRef.current, hitBody, {
        // worldPivot: worldPoint,
        collideConnected: false,
      });

      // Set constraint parameters for smoother dragging
      constraint.setStiffness(Math.max()); // Spring stiffness
      constraint.setRelaxation(1); // Relaxation for soft constraint

      props.worldRef.current.addConstraint(constraint);
      mouseConstraintRef.current = constraint;
    }
  };

  // Update dragging
  const updateDrag = (worldPoint: [number, number]) => {
    if (isDraggingRef.current && mouseBodyRef.current) {
      mouseBodyRef.current.position = worldPoint;
    }
  };

  // End dragging
  const endDrag = () => {
    if (
      isDraggingRef.current &&
      props.worldRef.current &&
      mouseConstraintRef.current
    ) {
      props.worldRef.current.removeConstraint(mouseConstraintRef.current);
      mouseConstraintRef.current = null;
      selectedBodyRef.current = null;
      isDraggingRef.current = false;
    }
  };

  const drawWorld = (ctx: CanvasRenderingContext2D) => {
    ctx.reset();
    ctx.save();
    ctx.clearRect(0, 0, props.width, props.height);
    ctx.translate(0, props.height);
    ctx.scale(props.pixelsPerMeter, -props.pixelsPerMeter);

    props.worldRef.current.bodies.forEach((body) => {
      // Skip drawing the mouse body
      if (mouseBodyRef.current && body === mouseBodyRef.current) return;

      ctx.save();
      ctx.translate(body.position[0], body.position[1]);
      ctx.rotate(body.angle);

      // Determine color based on body type and selection state
      let color;
      if (selectedBodyRef.current === body) {
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
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 0.02;
          ctx.strokeRect(-width / 2, -height / 2, width, height);
        } else if (shape instanceof p2.Circle) {
          // Draw circle
          const radius = shape.radius;

          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 0.02;
          ctx.stroke();

          // Draw a line from center to edge to visualize rotation
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(radius, 0);
          ctx.strokeStyle = "#000";
          ctx.stroke();
        }

        ctx.restore(); // Restore after each shape
      });

      ctx.restore();
    });

    // Draw constraint if dragging
    if (
      isDraggingRef.current &&
      mouseBodyRef.current &&
      selectedBodyRef.current
    ) {
      ctx.beginPath();
      ctx.moveTo(
        mouseBodyRef.current.position[0],
        mouseBodyRef.current.position[1]
      );
      ctx.lineTo(
        selectedBodyRef.current.position[0],
        selectedBodyRef.current.position[1]
      );
      ctx.strokeStyle = "#f39c12";
      ctx.lineWidth = 0.03;
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
      // Set the canvas resolution correctly for high DPI displays
      const dpr = window.devicePixelRatio || 1;
      canvas.width = props.width * dpr;
      canvas.height = props.height * dpr;

      // Scale the CSS size
      canvas.style.width = `${props.width}px`;
      canvas.style.height = `${props.height}px`;

      // Scale the context
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      // Initialize mouse physics body
      initMouseInteraction();

      // Set up mouse event listeners
      const handleMouseDown = (e: MouseEvent) => {
        const worldPoint = getPhysicsCoord(e.clientX, e.clientY);
        startDrag(worldPoint);
      };

      const handleMouseMove = (e: MouseEvent) => {
        const worldPoint = getPhysicsCoord(e.clientX, e.clientY);
        updateDrag(worldPoint);
      };

      const handleMouseUp = () => {
        endDrag();
      };

      // Add touch support for mobile
      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length > 0) {
          const touch = e.touches[0];
          const worldPoint = getPhysicsCoord(touch.clientX, touch.clientY);
          startDrag(worldPoint);
          e.preventDefault();
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length > 0) {
          const touch = e.touches[0];
          const worldPoint = getPhysicsCoord(touch.clientX, touch.clientY);
          updateDrag(worldPoint);
          e.preventDefault();
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        endDrag();
        e.preventDefault();
      };

      // Add event listeners
      canvas.addEventListener("mousedown", handleMouseDown);
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      // Touch events
      canvas.addEventListener("touchstart", handleTouchStart);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleTouchEnd);

      // Start the animation loop
      requestRef.current = requestAnimationFrame(animate);

      // Clean up
      return () => {
        if (requestRef.current !== -1) {
          cancelAnimationFrame(requestRef.current);
        }

        // Remove all event listeners
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
  }, [props.width, props.height]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        background: "#f8f9fa",
      }}
    />
  );
}
