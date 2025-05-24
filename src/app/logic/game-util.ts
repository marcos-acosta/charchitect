import * as p2 from "p2-es";
import {
  CANVAS_WIDTH_METERS,
  DESIRED_LETTER_WIDTH_METERS,
  GROUND_HEIGHT_METERS,
  GROUND_MASS,
  GROUND_THICKNESS_METERS,
  PUSH_VELOCITY,
  SPRING_DAMPING,
  SPRING_HOOK_WIDTH_METERS,
  SPRING_STIFFNESS,
  WOOD_MATERIAL_FRICTION,
} from "./game-config";
import {
  createLetterFromPoints,
  velocityToSpeed,
  WOOD_MATERIAL,
} from "./p2-util";
import { IDimensions, IPolygons, LETTERS } from "./interfaces";
import { computeMetersPerPixel } from "./render-util";
import { AVG_LETTER_WIDTH_PIXELS } from "./letter-util";
import { RefObject } from "react";
export const createWorld = (trialCanvas = false): [p2.World, p2.Body] => {
  // Create new physics world with gravity
  const newWorld = new p2.World({
    gravity: [0, trialCanvas ? -9.81 : 0],
  });

  const GROUND_WIDTH = CANVAS_WIDTH_METERS * 0.9;
  const REMAINING_WIDTH = CANVAS_WIDTH_METERS - GROUND_WIDTH;
  // Add a ground plane
  const groundBody = new p2.Body({
    type: p2.Body.DYNAMIC,
    mass: GROUND_MASS,
    position: [CANVAS_WIDTH_METERS / 2, GROUND_HEIGHT_METERS],
    // fixedX: true,
    fixedY: true,
    fixedRotation: true,
  });
  const groundShape = new p2.Box({
    width: GROUND_WIDTH,
    height: GROUND_THICKNESS_METERS,
  });
  groundBody.addShape(groundShape);
  newWorld.addBody(groundBody);
  // Add spring hook
  const springHook = new p2.Body({
    type: p2.Body.STATIC,
    position: [
      CANVAS_WIDTH_METERS + SPRING_HOOK_WIDTH_METERS / 2,
      GROUND_HEIGHT_METERS,
    ],
  });
  const springShape = new p2.Box({
    width: SPRING_HOOK_WIDTH_METERS,
    height: SPRING_HOOK_WIDTH_METERS,
  });
  springHook.addShape(springShape);
  newWorld.addBody(springHook);
  // Add spring
  const spring = new p2.LinearSpring(groundBody, springHook, {
    stiffness: SPRING_STIFFNESS,
    damping: SPRING_DAMPING,
    localAnchorA: [GROUND_WIDTH / 2, 0],
    localAnchorB: [-SPRING_HOOK_WIDTH_METERS / 2, 0],
    restLength: REMAINING_WIDTH / 2,
  });
  newWorld.addSpring(spring);

  const frictionContactMaterial = new p2.ContactMaterial(
    WOOD_MATERIAL,
    WOOD_MATERIAL,
    {
      friction: WOOD_MATERIAL_FRICTION,
      stiffness: 1e9,
    }
  );
  newWorld.addContactMaterial(frictionContactMaterial);

  return [newWorld, groundBody];
};

// Function to clone a body from one world to another
export const cloneBodyToWorld = (
  body: p2.Body,
  targetWorld: p2.World
): p2.Body | null => {
  // Create a new body with the same properties
  const newBody = new p2.Body({
    mass: body.mass,
    position: [body.position[0], body.position[1]],
    angle: body.angle,
    velocity: [0, 0],
    angularVelocity: 0,
    damping: 0.01,
    angularDamping: 0.01,
    type: body.type,
    fixedX: body.fixedX,
    fixedY: body.fixedY,
    fixedRotation: body.fixedRotation,
  });

  // Only clone bodies with convex shape
  if (
    !(
      body.shapes.length &&
      body.shapes[0] &&
      body.shapes[0].type === p2.Shape.CONVEX
    )
  ) {
    return null;
  }

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
  letterPolygons: IPolygons,
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
    letterPolygons,
    [0.5, canvasHeightMeters / 2],
    world,
    WOOD_MATERIAL,
    true,
    scalingRatio
  );
};

export const removeLetterFromWorld = (
  letterEnum: LETTERS,
  lettersInUse: Record<number, LETTERS>,
  world: p2.World
) => {
  const letterId = Object.entries(lettersInUse).find(
    ([_, value]) => value === letterEnum
  )?.[0];
  if (!letterId) {
    return;
  }
  const letterBody = world.bodies.find(
    (body) => body.id === parseInt(letterId)
  );
  if (!letterBody) {
    return;
  }
  world.removeBody(letterBody);
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
  trialWorldRef: RefObject<p2.World | null>,
  lettersInUse: Record<number, LETTERS>
): Record<number, LETTERS> => {
  const sandboxWorld = sandboxWorldRef.current;
  const trialWorld = trialWorldRef.current;

  if (!sandboxWorld || !trialWorld) return {};

  // Clear existing non-static bodies from trial world
  const bodiesToRemove = [];
  for (let i = 0; i < trialWorld.bodies.length; i++) {
    const body = trialWorld.bodies[i];
    if (body.shapes[0] && body.shapes[0].type === p2.Shape.BOX) {
      continue;
    }
    bodiesToRemove.push(body);
  }

  // Remove bodies from trial world
  bodiesToRemove.forEach((body) => {
    trialWorld.removeBody(body);
  });

  // Create a mapping of trial body IDs to original letters
  const trialBodyIdToLetterMapping: Record<number, LETTERS> = {};

  // Copy bodies from sandbox to trial
  sandboxWorld.bodies.forEach((body) => {
    const newBody = cloneBodyToWorld(body, trialWorld);
    if (newBody && lettersInUse[body.id]) {
      trialBodyIdToLetterMapping[newBody.id] = lettersInUse[body.id];
    }
  });

  return trialBodyIdToLetterMapping;
};

export const startShakeTest = (body: p2.Body) => {
  // body.applyImpulse([100, 0], body.position);
  body.velocity[0] = PUSH_VELOCITY;
};
