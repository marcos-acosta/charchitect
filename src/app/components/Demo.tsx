import { RefObject, useEffect, useRef, useState } from "react";
import * as p2 from "p2-es";
import PhysicsRenderer from "./PhysicsRenderer";
import {
  AVG_LETTER_WIDTH_PIXELS,
  computeMetersPerPixel,
  computePixelsPerMeter,
  createLetterFromPoints,
  IPoints,
} from "../util";
import LETTERS from "../letters";
import styles from "./../styles.module.css";
import { IDimensions } from "../interfaces";

const CANVAS_WIDTH_METERS = 10;
const DESIRED_LETTER_WIDTH_METERS = 1;

const createWorld = (
  canvasWidthPixels: number,
  canvasHeightPixels: number,
  trialCanvas = false
) => {
  const canvasWidthMeters = CANVAS_WIDTH_METERS;
  const metersPerPixel = computeMetersPerPixel(
    canvasWidthPixels,
    canvasWidthMeters
  );
  const canvasHeightMeters = canvasHeightPixels * metersPerPixel;

  const average_letter_width_meters = AVG_LETTER_WIDTH_PIXELS * metersPerPixel;
  const scaling_ratio =
    (DESIRED_LETTER_WIDTH_METERS / average_letter_width_meters) *
    metersPerPixel;

  // Create new physics world with gravity
  const newWorld = new p2.World({
    gravity: [0, trialCanvas ? -9.81 : 0],
  });

  // Add a ground plane
  const groundBody = new p2.Body({
    type: p2.Body.STATIC,
    position: [canvasWidthMeters / 2, 0],
  });
  const groundShape = new p2.Box({ width: canvasWidthMeters, height: 1 });
  groundBody.addShape(groundShape);
  newWorld.addBody(groundBody);

  const woodMaterial = new p2.Material();

  // Only add initial letters if requested
  if (!trialCanvas) {
    createLetterFromPoints(
      LETTERS.A as IPoints,
      [1 * (canvasWidthMeters / 8), canvasHeightMeters - 1],
      newWorld,
      woodMaterial,
      true,
      scaling_ratio
    );

    createLetterFromPoints(
      LETTERS.B as IPoints,
      [2 * (canvasWidthMeters / 8), canvasHeightMeters - 1],
      newWorld,
      woodMaterial,
      true,
      scaling_ratio
    );

    createLetterFromPoints(
      LETTERS.C as IPoints,
      [3 * (canvasWidthMeters / 8), canvasHeightMeters - 1],
      newWorld,
      woodMaterial,
      true,
      scaling_ratio
    );

    createLetterFromPoints(
      LETTERS.D as IPoints,
      [4 * (canvasWidthMeters / 8), canvasHeightMeters - 1],
      newWorld,
      woodMaterial,
      true,
      scaling_ratio
    );

    createLetterFromPoints(
      LETTERS.E as IPoints,
      [5 * (canvasWidthMeters / 8), canvasHeightMeters - 1],
      newWorld,
      woodMaterial,
      true,
      scaling_ratio
    );

    createLetterFromPoints(
      LETTERS.F as IPoints,
      [6 * (canvasWidthMeters / 8), canvasHeightMeters - 1],
      newWorld,
      woodMaterial,
      true,
      scaling_ratio
    );
  }

  const frictionContactMaterial = new p2.ContactMaterial(
    woodMaterial,
    woodMaterial,
    {
      friction: 10,
      stiffness: Math.max(),
    }
  );
  newWorld.addContactMaterial(frictionContactMaterial);

  return newWorld;
};

// Function to clone a body from one world to another
const cloneBodyToWorld = (body: p2.Body, targetWorld: p2.World): p2.Body => {
  // Skip cloning static ground bodies
  if (
    body.type === p2.Body.STATIC &&
    body.shapes.some((s) => s instanceof p2.Box && (s as p2.Box).width > 10)
  ) {
    return body;
  }

  // Create a new body with the same properties
  const newBody = new p2.Body({
    mass: body.mass,
    position: [body.position[0], body.position[1]],
    angle: body.angle,
    velocity: [0, 0],
    angularVelocity: 0,
    damping: 0.01, // Set default damping for trial world
    angularDamping: 0.01, // Set default angular damping for trial world
    type: body.type,
  });

  // Clone all shapes from the original body
  body.shapes.forEach((shape) => {
    if (shape instanceof p2.Box) {
      const boxShape = new p2.Box({
        width: shape.width,
        height: shape.height,
      });
      newBody.addShape(boxShape, shape.position, shape.angle);
    } else if (shape instanceof p2.Convex) {
      const convexShape = new p2.Convex({ vertices: [...shape.vertices] });
      newBody.addShape(convexShape, shape.position, shape.angle);
    }
  });

  // Add the new body to the target world
  targetWorld.addBody(newBody);
  return newBody;
};

export default function Demo() {
  // Create sandbox world (left side - interactive)
  const sandboxWorldRef = useRef<p2.World | null>(null);
  // Create trial world (right side - read-only with gravity)
  const trialWorldRef = useRef<p2.World | null>(null);
  // Store original body type when switching to kinematic
  const originalBodyTypeRef = useRef<
    | typeof p2.Body.DYNAMIC
    | typeof p2.Body.STATIC
    | typeof p2.Body.KINEMATIC
    | null
  >(null);
  // Track the highest point in the trial world
  const highestPointRef = useRef<number>(0);
  // Canvas container dimensions
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasContainerDimensions, setCanvasContainerDimensions] =
    useState<IDimensions | null>(null);

  const pixelsPerMeter = canvasContainerDimensions
    ? computePixelsPerMeter(
        canvasContainerDimensions.width,
        CANVAS_WIDTH_METERS
      )
    : undefined;

  // Function to measure container and update dimensions
  const updateDimensions = () => {
    if (!canvasContainerRef.current) return;

    const { width, height } =
      canvasContainerRef.current.getBoundingClientRect();
    setCanvasContainerDimensions({
      width: Math.floor(width),
      height: Math.floor(height),
    });

    if (sandboxWorldRef.current === null) {
      sandboxWorldRef.current = createWorld(width, height, false);
      trialWorldRef.current = createWorld(width, height, true);
    }
  };

  useEffect(() => {
    if (!canvasContainerRef.current) return;

    // Initial size measurement
    updateDimensions();

    // Set up resize observer
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(canvasContainerRef.current);

    return () => resizeObserver.disconnect();
  }, [canvasContainerRef.current]);

  // Handle rotation start
  const handleRotationStart = (body: p2.Body) => {
    if (body && body.type !== p2.Body.STATIC) {
      originalBodyTypeRef.current = body.type;
      body.type = p2.Body.KINEMATIC;
    }
  };

  // Handle rotation update
  const handleRotation = (body: p2.Body) => {
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

  const updateHighestPoint = () => {
    const trialWorld = trialWorldRef.current;
    if (!trialWorld || trialWorld.bodies.length <= 1) {
      // Only ground body or no bodies
      highestPointRef.current = 0;
      return;
    }

    let highestPoint = 0;
    trialWorld.bodies.forEach((body) => {
      // Skip ground body
      if (body.type === p2.Body.STATIC) {
        return;
      }

      // Find the highest point of this body
      body.updateAABB();
      const bodyHeight = body.aabb.upperBound[1];
      if (bodyHeight > highestPoint) {
        highestPoint = bodyHeight;
      }
    });

    highestPointRef.current = highestPoint;
  };

  // Copy the sandbox world to the trial world
  const runSimulation = () => {
    const sandboxWorld = sandboxWorldRef.current;
    const trialWorld = trialWorldRef.current;

    if (!sandboxWorld || !trialWorld) return;

    // Clear existing non-ground bodies from trial world
    const bodiesToRemove = [];
    for (let i = 0; i < trialWorld.bodies.length; i++) {
      const body = trialWorld.bodies[i];
      // Skip ground body
      if (body.type === p2.Body.STATIC) {
        continue;
      }
      bodiesToRemove.push(body);
    }

    // Remove bodies from trial world
    bodiesToRemove.forEach((body) => {
      trialWorld.removeBody(body);
    });

    // Copy bodies from sandbox to trial
    sandboxWorld.bodies.forEach((body) => {
      cloneBodyToWorld(body, trialWorld);
    });
  };

  return (
    <div className={styles.pageOuterContainer}>
      <div className={styles.coreGameContainer}>
        <div className={styles.letterSelectorAndCanvasesContainer}>
          <div className={styles.letterSelectionContainer}>
            Letters go here...
          </div>
          <div className={styles.canvasesAndControls}>
            <div className={styles.controlsContainer}>
              <button onClick={runSimulation} className={styles.controlsButton}>
                run [r]
              </button>
            </div>
            <div className={styles.canvasContainer} ref={canvasContainerRef}>
              {sandboxWorldRef.current &&
                canvasContainerDimensions &&
                pixelsPerMeter && (
                  <PhysicsRenderer
                    worldRef={sandboxWorldRef as RefObject<p2.World>}
                    width={canvasContainerDimensions?.width}
                    height={canvasContainerDimensions?.height}
                    pixelsPerMeter={pixelsPerMeter}
                    onRotationStart={handleRotationStart}
                    onRotation={handleRotation}
                    onRotationEnd={handleRotationEnd}
                  />
                )}
            </div>
            <div className={styles.canvasContainer}>
              {trialWorldRef.current &&
                canvasContainerDimensions &&
                pixelsPerMeter && (
                  <PhysicsRenderer
                    worldRef={trialWorldRef as RefObject<p2.World>}
                    width={canvasContainerDimensions?.width}
                    height={canvasContainerDimensions?.height}
                    pixelsPerMeter={pixelsPerMeter}
                    readOnly={true} // Make trial canvas read-only
                    highestPoint={highestPointRef} // Pass the highest point
                    onAfterStep={updateHighestPoint} // Calculate after each physics step
                  />
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
