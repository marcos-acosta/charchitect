import { useRef, useState } from "react";
import * as p2 from "p2-es";
import PhysicsRenderer from "./PhysicsRenderer";
import { createLetterFromPoints, IPoints } from "../util";
import LETTERS from "../letters";
import CircularAnglePicker from "./AnglePicker";

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
  // Add state to track if we have a selected body (for UI rendering)
  const [lastSelectedBodyId, setLastSelectedBodyId] = useState<number | null>(
    null
  );
  // Reference to track the last selected body
  const lastSelectedBodyRef = useRef<p2.Body | null>(null);
  // State to track if we're actively rotating (slider is being interacted with)
  const [isRotating, setIsRotating] = useState(false);
  // State to track the current angle for the slider
  const [currentAngle, setCurrentAngle] = useState(0);
  // Store original body type when switching to kinematic
  const originalBodyTypeRef = useRef<
    | typeof p2.Body.DYNAMIC
    | typeof p2.Body.STATIC
    | typeof p2.Body.KINEMATIC
    | null
  >(null);

  // Convert radians to degrees for the slider
  const radiansToDegrees = (rad: number) => Math.round((rad * 180) / Math.PI);
  // Convert degrees to radians for p2.js
  const degreesToRadians = (deg: number) => (deg * Math.PI) / 180;

  // Update the angle state when a new body is selected
  const updateSelectedBody = (body: p2.Body | null) => {
    lastSelectedBodyRef.current = body;
    if (body) {
      setLastSelectedBodyId(body.id);
      // Update the slider value to match the body's current angle
      setCurrentAngle(radiansToDegrees(body.angle));
    }
  };

  // Start rotation mode
  const startRotation = () => {
    const body = lastSelectedBodyRef.current;
    if (body && body.type !== p2.Body.STATIC) {
      originalBodyTypeRef.current = body.type;
      body.type = p2.Body.KINEMATIC;
      setIsRotating(true);
    }
  };

  // Apply rotation based on slider value
  const updateRotation = (degrees: number) => {
    const body = lastSelectedBodyRef.current;
    if (body && isRotating) {
      const radians = degreesToRadians(degrees);
      body.angle = radians;
      body.angularVelocity = 0; // Prevent continued rotation
      setCurrentAngle(degrees);
    }
  };

  // End rotation mode
  const endRotation = () => {
    const body = lastSelectedBodyRef.current;
    if (body && isRotating && originalBodyTypeRef.current !== null) {
      body.type = originalBodyTypeRef.current;
      originalBodyTypeRef.current = null;
      setIsRotating(false);
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
      />

      <div className="controls">
        <div className="rotation-control">
          <div>
            <CircularAnglePicker
              angle={currentAngle}
              disabled={!lastSelectedBodyId}
              size={100}
              onChange={(angle) => updateRotation(angle)}
              onChangeStart={startRotation}
              onChangeEnd={endRotation}
              primaryColor="#367beb"
              secondaryColor="#aaa"
            />
          </div>
        </div>
        <button onClick={addGravity}>Gravity</button>
      </div>
    </div>
  );
}
