import { IPoint, IPoints } from "./interfaces";
import * as p2 from "p2-es";
import { normalizePoints } from "./letter-util";

export const WOOD_MATERIAL = new p2.Material();

export const createLetterFromPoints = (
  points: IPoints,
  position: IPoint,
  world: p2.World,
  material: p2.Material,
  trial = false,
  normalizeFactor = 2000
) => {
  const concaveBody = new p2.Body({
    mass: 20,
    position: position,
    angularDamping: trial ? 1 : 0.01,
    damping: trial ? 1 : 0.1,
    collisionResponse: !trial,
    type: p2.Body.DYNAMIC,
  });
  const letterPath = normalizePoints(points, normalizeFactor);
  concaveBody.fromPolygon(letterPath);
  concaveBody.shapes.forEach((shape) => (shape.material = material));
  world.addBody(concaveBody);
};


export const velocityToSpeed = (velocity: p2.Vec2) =>
  Math.sqrt(Math.pow(velocity[0], 2) + Math.pow(velocity[1], 2));

// Handle rotation start
export const handleRotationStart = (body: p2.Body) => {
  if (body.type !== p2.Body.STATIC) {
    body.type = p2.Body.KINEMATIC;
  }
};

// Handle rotation update
export const handleRotation = (body: p2.Body) => {
  if (body) {
    body.angularVelocity = 0; // Prevent continued rotation
  }
};

// Handle rotation end
export const handleRotationEnd = (body: p2.Body) => {
  body.type = p2.Body.DYNAMIC;
};