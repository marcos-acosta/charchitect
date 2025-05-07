import { useRef } from "react";
import * as p2 from "p2-es";
import PhysicsRenderer from "./PhysicsRenderer";
import { createLetterFromPoints, IPoints } from "../util";
import LETTERS from "../letters";

const createWorld = (canvasWidthMeters: number) => {
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
    [canvasWidthMeters / 2, 2],
    newWorld,
    true
  );

  createLetterFromPoints(
    LETTERS.B as IPoints,
    [canvasWidthMeters / 2, 3],
    newWorld,
    true
  );

  createLetterFromPoints(
    LETTERS.C as IPoints,
    [canvasWidthMeters / 2, 4],
    newWorld,
    true
  );

  return newWorld;
};

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PIXELS_PER_METER = 80;

export default function Demo() {
  const worldRef = useRef(createWorld(CANVAS_WIDTH / PIXELS_PER_METER));

  const addGravity = () => {
    worldRef.current.gravity[1] = -9.82;
    worldRef.current.bodies.forEach((body) => {
      body.damping = 0;
      body.angularDamping = 0;
    });
  };

  return (
    <div className="physics-container">
      <PhysicsRenderer
        worldRef={worldRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        pixelsPerMeter={PIXELS_PER_METER}
      />
      <button onClick={addGravity}>Gravity</button>
    </div>
  );
}
