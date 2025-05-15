import * as p2 from "p2-es";
import { CANVAS_WIDTH_METERS } from "./game-config";
import { velocityToSpeed, WOOD_MATERIAL } from "./p2-util";

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
export const cloneBodyToWorld = (body: p2.Body, targetWorld: p2.World): p2.Body => {
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
