import * as p2 from "p2-es";
import {
  CANVAS_HEIGHT_METERS,
  DESIRED_LETTER_WIDTH_METERS,
  GROUND_HEIGHT_METERS,
  GROUND_MASS,
  GROUND_THICKNESS_METERS,
  GROUND_WIDTH_METERS,
  PUSH_VELOCITY,
  SANDBOX_DAMPING,
  SPRING_DAMPING,
  SPRING_STIFFNESS,
  TRIAL_DAMPING,
  WOOD_MATERIAL_FRICTION,
} from "./game-config";
import {
  createLetterFromPoints,
  isLetter,
  velocityToSpeed,
  WOOD_MATERIAL,
} from "./p2-util";
import { IDimensions, IPoint, IPolygons, LETTERS } from "./interfaces";
import { computeMetersPerPixel } from "./render-util";
import { AVG_LETTER_WIDTH_PIXELS } from "./letter-util";
import { RefObject } from "react";

const getGroundCenter = (dimensionsInMeters: IDimensions) => {
  return dimensionsInMeters.width / 2;
};

export const createWorld = (
  gravity: boolean,
  dimensionsInMeters: IDimensions
): [p2.World, p2.Body] => {
  // Create new physics world with gravity
  const newWorld = new p2.World({
    gravity: gravity ? [0, -9.81] : [0, 0],
  });

  const groundCenter = getGroundCenter(dimensionsInMeters);
  const groundEnd = groundCenter + GROUND_WIDTH_METERS / 2;
  // Add a ground plane
  const groundBody = new p2.Body({
    type: p2.Body.DYNAMIC,
    mass: GROUND_MASS,
    position: [groundCenter, GROUND_HEIGHT_METERS],
    fixedY: true,
    fixedRotation: true,
  });
  const groundShape = new p2.Box({
    width: GROUND_WIDTH_METERS,
    height: GROUND_THICKNESS_METERS,
  });
  groundBody.addShape(groundShape);
  newWorld.addBody(groundBody);
  // Add spring hook
  const springHook = new p2.Body({
    type: p2.Body.STATIC,
    position: [dimensionsInMeters.width, GROUND_HEIGHT_METERS],
  });
  newWorld.addBody(springHook);
  // Add spring
  const spring = new p2.LinearSpring(groundBody, springHook, {
    stiffness: SPRING_STIFFNESS,
    damping: SPRING_DAMPING,
    localAnchorA: [GROUND_WIDTH_METERS / 2, 0],
    localAnchorB: [0, 0],
    restLength: dimensionsInMeters.width - groundEnd,
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
  const trialLetters = world.bodies.filter((body) => isTrialLetter(body));
  if (trialLetters.length === 0) {
    return false;
  }
  for (const body of trialLetters) {
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
  dimensions: IDimensions,
  position?: [number, number],
  angle?: number,
  tallestPoint?: IPoint
): number => {
  const metersPerPixel = computeMetersPerPixel(
    dimensions.height,
    CANVAS_HEIGHT_METERS
  );
  const average_letter_width_meters = AVG_LETTER_WIDTH_PIXELS * metersPerPixel;
  const scalingRatio =
    (DESIRED_LETTER_WIDTH_METERS / average_letter_width_meters) *
    metersPerPixel;
  const groundCenter = getGroundCenter({
    width: dimensions.width * metersPerPixel,
    height: dimensions.height * metersPerPixel,
  });
  const positionToSet: IPoint = position
    ? [position[0], position[1]]
    : tallestPoint
    ? [tallestPoint[0], tallestPoint[1] + 0.1]
    : [groundCenter, GROUND_HEIGHT_METERS + GROUND_THICKNESS_METERS / 2];
  return createLetterFromPoints(
    letterPolygons,
    positionToSet,
    world,
    WOOD_MATERIAL,
    true,
    false,
    p2.Body.DYNAMIC,
    angle || 0,
    scalingRatio
  );
};

export const isManipulableLetter = (body: p2.Body) => {
  return (
    isLetter(body) &&
    body.damping === SANDBOX_DAMPING &&
    body.type === p2.Body.DYNAMIC
  );
};

export const isShadowLetter = (body: p2.Body) => {
  return isLetter(body) && body.type === p2.Body.STATIC;
};

export const isTrialLetter = (body: p2.Body) => {
  return (
    isLetter(body) &&
    body.damping === TRIAL_DAMPING &&
    body.type === p2.Body.DYNAMIC
  );
};

const clearAllTrialLetters = (world: p2.World) => {
  const bodiesToRemove = [];
  for (const body of world.bodies) {
    if (isLetter(body) && isTrialLetter(body)) {
      bodiesToRemove.push(body);
    }
  }
  bodiesToRemove.forEach((body) => {
    world.removeBody(body);
  });
};

export const hasManipulableLetters = (world: p2.World) =>
  world.bodies.some((body) => isManipulableLetter(body));

export const deleteAllManipulableLetters = (world: p2.World) => {
  const lettersToDelete: p2.Body[] = [];
  for (const body of world.bodies) {
    if (isManipulableLetter(body)) {
      lettersToDelete.push(body);
    }
  }
  for (const letter of lettersToDelete) {
    world.removeBody(letter);
  }
};

const makeManipulableLettersStatic = (world: p2.World) => {
  for (const body of world.bodies) {
    if (isManipulableLetter(body)) {
      body.type = p2.Body.STATIC;
    }
  }
};

const makeTrialCopy = (
  body: p2.Body,
  newType:
    | typeof p2.Body.DYNAMIC
    | typeof p2.Body.STATIC
    | typeof p2.Body.KINEMATIC,
  collisionResponse?: boolean
) => {
  const newBody = new p2.Body({
    mass: body.mass,
    position: [body.position[0], body.position[1]],
    angle: body.angle,
    velocity: [0, 0],
    angularVelocity: 0,
    damping: TRIAL_DAMPING,
    angularDamping: TRIAL_DAMPING,
    collisionResponse: collisionResponse,
    type: newType,
  });
  for (const shape of body.shapes) {
    if (shape instanceof p2.Convex) {
      const newShape = new p2.Convex({ vertices: [...shape.vertices] });
      newBody.addShape(newShape, shape.position, shape.angle);
    }
  }
  return newBody;
};

export const makeTrialLetters = (
  world: p2.World,
  sandboxLetterIdMap: Record<number, LETTERS>,
  setTrialLetterIdMap: (m: Record<number, LETTERS>) => void
) => {
  const newTrialIdMap: Record<number, LETTERS> = {};
  const trialLetters = [];
  for (let i = 0; i < world.bodies.length; i++) {
    const body = world.bodies[i];
    if (isManipulableLetter(body)) {
      const letter = sandboxLetterIdMap[body.id];
      const trialLetter = makeTrialCopy(body, p2.Body.DYNAMIC, true);
      newTrialIdMap[trialLetter.id] = letter;
      trialLetters.push(trialLetter);
    }
  }
  makeManipulableLettersStatic(world);
  for (const letter of trialLetters) {
    world.addBody(letter);
  }
  setTrialLetterIdMap(newTrialIdMap);
};

export const startSimulation = (
  world: p2.World,
  sandboxLetterIdMap: Record<number, LETTERS>,
  setTrialLetterIdMap: (m: Record<number, LETTERS>) => void
) => {
  clearAllTrialLetters(world);
  makeTrialLetters(world, sandboxLetterIdMap, setTrialLetterIdMap);
  world.gravity[1] = -9.81;
};

const makeGhostLettersManipulable = (world: p2.World) => {
  for (const body of world.bodies) {
    if (isShadowLetter(body)) {
      body.type = p2.Body.DYNAMIC;
    }
  }
};

export const stopSimulation = (world: p2.World) => {
  clearAllTrialLetters(world);
  makeGhostLettersManipulable(world);
  world.gravity[1] = 0;
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

export const findHighestBody = (
  world: p2.World,
  isSandbox?: boolean
): [p2.Body | null, number] => {
  let highestPoint = 0;
  let highestBody: p2.Body | null = null;
  const bodiesOfInterest = world.bodies.filter((body) =>
    (isSandbox ? isManipulableLetter : isTrialLetter)(body)
  );
  bodiesOfInterest.forEach((body) => {
    // Find the highest point of this body
    if (body.aabbNeedsUpdate) {
      body.updateAABB();
    }
    const bodyHeight = body.aabb.upperBound[1];
    if (bodyHeight > highestPoint) {
      highestPoint = bodyHeight;
      highestBody = body;
    }
  });
  return [highestBody, highestPoint];
};

export const updateHighestPoint = (
  trialWorld: p2.World | null,
  highestPointRef: RefObject<number | null>
) => {
  if (!trialWorld) {
    return;
  }
  const [highestBody, highestPoint] = findHighestBody(trialWorld);
  if (!highestBody) {
    return;
  }
  highestPointRef.current = highestPoint;
};

export const startShakeTest = (body: p2.Body) => {
  body.velocity[0] = PUSH_VELOCITY;
};

export const adjustHeightByGroundHeight = (height: number) =>
  height - GROUND_HEIGHT_METERS - GROUND_THICKNESS_METERS / 2;
