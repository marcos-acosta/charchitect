import * as p2 from "p2-es";
import {
  CANVAS_WIDTH_METERS,
  DESIRED_LETTER_WIDTH_METERS,
} from "./game-config";
import {
  createLetterFromPoints,
  velocityToSpeed,
  WOOD_MATERIAL,
} from "./p2-util";
import { IDimensions, ILetterPolygon, IPoints, LETTERS } from "./interfaces";
import { computeMetersPerPixel } from "./render-util";
import { AVG_LETTER_WIDTH_PIXELS } from "./letter-util";
import LETTER_POLYGONS from "./letters";
import { RefObject } from "react";

export const createWorld = (trialCanvas = false) => {
  // Create new physics world with gravity
  const newWorld = new p2.World({
    gravity: [0, trialCanvas ? -9.81 : 0],
  });

  // Add a ground plane
  const groundBody = new p2.Body({
    type: p2.Body.STATIC,
    position: [CANVAS_WIDTH_METERS / 2, -0.25],
  });
  const groundShape = new p2.Box({ width: CANVAS_WIDTH_METERS, height: 1 });
  groundBody.addShape(groundShape);
  newWorld.addBody(groundBody);

  const frictionContactMaterial = new p2.ContactMaterial(
    WOOD_MATERIAL,
    WOOD_MATERIAL,
    {
      friction: 10,
      stiffness: Math.max(),
    }
  );
  newWorld.addContactMaterial(frictionContactMaterial);

  return newWorld;
};

// Function to clone a body from one world to another
export const cloneBodyToWorld = (
  body: p2.Body,
  targetWorld: p2.World
): p2.Body => {
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

export const allLettersStill = (
  world: p2.World,
  linearThreshold: number,
  angularThreshold: number
) => {
  for (const body of world.bodies) {
    const linearSpeed = velocityToSpeed(body.velocity);
    const angularSpeed = body.angularVelocity;
    if (linearSpeed > linearThreshold || angularSpeed > angularThreshold) {
      return false;
    }
  }
  return true;
};

export const addLetterToWorld = (
  letter: ILetterPolygon,
  world: p2.World,
  dimensions: IDimensions
): number => {
  const metersPerPixel = computeMetersPerPixel(
    dimensions.width,
    CANVAS_WIDTH_METERS
  );
  const canvasHeightMeters = dimensions.height * metersPerPixel;
  const average_letter_width_meters = AVG_LETTER_WIDTH_PIXELS * metersPerPixel;
  const scalingRatio =
    (DESIRED_LETTER_WIDTH_METERS / average_letter_width_meters) *
    metersPerPixel;
  return createLetterFromPoints(
    letter.exterior,
    [0.5, canvasHeightMeters / 2],
    world,
    WOOD_MATERIAL,
    true,
    scalingRatio
  );
};

export const updateHighestPoint = (
  trialWorld: p2.World | null,
  highestPointRef: RefObject<number>
) => {
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
export const runSimulation = (
  sandboxWorldRef: RefObject<p2.World | null>,
  trialWorldRef: RefObject<p2.World | null>
) => {
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
