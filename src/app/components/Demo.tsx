import { useRef, useState } from "react";
import * as p2 from "p2-es";
import PhysicsRenderer from "./PhysicsRenderer";
import { createLetterFromPoints, IPoints } from "../util";
import LETTERS from "../letters";

const createWorld = (canvasWidthMeters: number, canvasHeightMeters: number) => {
  // Create new physics world with gravity
  const newWorld = new p2.World({
    gravity: [0, 0],
  });

  // Add a ground plane
  const groundBody = new p2.Body({
    type: p2.Body.STATIC,
    position: [canvasWidthMeters / 2, 0],
  });
  const groundShape = new p2.Box({ width: canvasWidthMeters, height: 1 });
  groundBody.addShape(groundShape);
  newWorld.addBody(groundBody);

  createLetterFromPoints(
    LETTERS.A as IPoints,
    [1 * (canvasWidthMeters / 8), canvasHeightMeters - 1],
    newWorld,
    true
  );

  createLetterFromPoints(
    LETTERS.B as IPoints,
    [2 * (canvasWidthMeters / 8), canvasHeightMeters - 1],
    newWorld,
    true
  );

  createLetterFromPoints(
    LETTERS.C as IPoints,
    [3 * (canvasWidthMeters / 8), canvasHeightMeters - 1],
    newWorld,
    true
  );

  createLetterFromPoints(
    LETTERS.D as IPoints,
    [4 * (canvasWidthMeters / 8), canvasHeightMeters - 1],
    newWorld,
    true
  );

  createLetterFromPoints(
    LETTERS.E as IPoints,
    [5 * (canvasWidthMeters / 8), canvasHeightMeters - 1],
    newWorld,
    true
  );

  createLetterFromPoints(
    LETTERS.F as IPoints,
    [6 * (canvasWidthMeters / 8), canvasHeightMeters - 1],
    newWorld,
    true
  );

  return newWorld;
};

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PIXELS_PER_METER = 80;

export default function Demo() {
  const worldRef = useRef(
    createWorld(
      CANVAS_WIDTH / PIXELS_PER_METER,
      CANVAS_HEIGHT / PIXELS_PER_METER
    )
  );
  // Add state to track if we have a selected body (for UI rendering)
  const [lastSelectedBodyId, setLastSelectedBodyId] = useState<number | null>(
    null
  );
  // Reference to track the last selected body
  const lastSelectedBodyRef = useRef<p2.Body | null>(null);
  // Store original body type when switching to kinematic
  const originalBodyTypeRef = useRef<
    | typeof p2.Body.DYNAMIC
    | typeof p2.Body.STATIC
    | typeof p2.Body.KINEMATIC
    | null
  >(null);

  // Update the selected body
  const updateSelectedBody = (body: p2.Body | null) => {
    lastSelectedBodyRef.current = body;
    if (body) {
      setLastSelectedBodyId(body.id);
    } else {
      setLastSelectedBodyId(null);
    }
  };

  // Handle rotation start
  const handleRotationStart = (body: p2.Body) => {
    if (body && body.type !== p2.Body.STATIC) {
      originalBodyTypeRef.current = body.type;
      body.type = p2.Body.KINEMATIC;
    }
  };

  // Handle rotation update
  const handleRotation = (body: p2.Body, angle: number) => {
    if (body) {
      body.angularVelocity = 0; // Prevent continued rotation
    }
  };

  // Handle rotation end
  const handleRotationEnd = (body: p2.Body) => {
    if (body && originalBodyTypeRef.current !== null) {
      body.type = originalBodyTypeRef.current;
      originalBodyTypeRef.current = null;
    }
  };

  const addGravity = () => {
    worldRef.current.gravity[1] = -9.82;
    worldRef.current.bodies.forEach((body) => {
      body.damping = 0.01;
      body.angularDamping = 0.01;
    });
  };

  return (
    <div className="physics-container">
      <PhysicsRenderer
        worldRef={worldRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        pixelsPerMeter={PIXELS_PER_METER}
        onObjectSelected={updateSelectedBody}
        onRotationStart={handleRotationStart}
        onRotation={handleRotation}
        onRotationEnd={handleRotationEnd}
      />

      <div className="controls">
        <button onClick={addGravity}>Gravity</button>
      </div>
    </div>
  );
}
