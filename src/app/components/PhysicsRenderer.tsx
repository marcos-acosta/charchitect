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
};

export default function PhysicsRenderer(props: PhysicsRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(-1);
  const previousTimeRef = useRef<number | null>(null);

  // Fixed timestep for physics simulation
  const fixedTimeStep = 1 / 60; // 60 fps
  const maxSubSteps = 10; // Maximum sub steps to catch up if frame rate drops

  const drawWorld = (ctx: CanvasRenderingContext2D) => {
    ctx.reset();
    ctx.save();
    ctx.clearRect(0, 0, props.width, props.height);
    ctx.translate(0, props.height);
    ctx.scale(props.pixelsPerMeter, -props.pixelsPerMeter);

    props.worldRef.current.bodies.forEach((body) => {
      ctx.save();
      ctx.translate(body.position[0], body.position[1]);
      ctx.rotate(body.angle);

      // Determine color based on body type
      let color;
      if (body.type === p2.Body.STATIC) {
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
        //  else if (shape instanceof p2.Convex) {
        //   // Draw convex polygon
        //   const vertices = shape.vertices;

        //   if (vertices.length > 0) {
        //     ctx.beginPath();
        //     ctx.moveTo(vertices[0][0], vertices[0][1]);

        //     for (let i = 1; i < vertices.length; i++) {
        //       ctx.lineTo(vertices[i][0], vertices[i][1]);
        //     }

        //     ctx.closePath();
        //     ctx.fillStyle = color;
        //     ctx.fill();
        //     ctx.strokeStyle = "#000";
        //     ctx.lineWidth = 0.02;
        //     ctx.stroke();
        //   }
        // }

        ctx.restore(); // Restore after each shape
      });

      ctx.restore();
    });
  };

  // Animation loop using requestAnimationFrame
  const animate = (time: number) => {
    if (previousTimeRef.current === undefined) {
      previousTimeRef.current = time;
    }

    // Calculate time elapsed since last frame
    const deltaTime = (time - (previousTimeRef.current || 0)) / 1000; // in seconds
    previousTimeRef.current = time;

    // Step the physics world forward
    props.worldRef.current.step(fixedTimeStep, deltaTime, maxSubSteps);

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

      // Start the animation loop
      requestRef.current = requestAnimationFrame(animate);
    } else {
      console.log("No canvas");
    }

    // Clean up
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [props.worldRef.current, props.width, props.height]); // Re-initialize if these props change

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
