import { IPoint, IPoints, IPolygons } from "./interfaces";
import * as p2 from "p2-es";
import { normalizePoints } from "./letter-util";
import { RefObject } from "react";
import * as decomp from "poly-decomp-es";

export const WOOD_MATERIAL = new p2.Material();

const decomposePolygon = (polygon: IPoints): IPolygons => {
  // Copied from the source.
  const p = [];
  for (let i = 0; i < polygon.length; i++) {
    p[i] = p2.vec2.clone(polygon[i]);
  }
  decomp.makeCCW(p as decomp.Polygon);
  decomp.removeCollinearPoints(p as decomp.Polygon, 0.02);
  const convexes = decomp.quickDecomp(p as decomp.Polygon);
  return convexes as IPolygons;
};

export const createLetterFromPoints = (
  polygons: IPolygons,
  position: IPoint,
  world: p2.World,
  material: p2.Material,
  angle = 0,
  trial = false,
  isStatic = false,
  normalizeFactor = 2000
): number => {
  const concaveBody = new p2.Body({
    mass: 30,
    position: position,
    angularDamping: trial ? 1 : 0.01,
    damping: trial ? 1 : 0.1,
    collisionResponse: !trial,
    type: isStatic ? p2.Body.STATIC : p2.Body.DYNAMIC,
    angle: angle,
  });
  polygons.forEach((polygon) => {
    const cm = p2.vec2.create();
    decomposePolygon(normalizePoints(polygon, normalizeFactor)).forEach(
      (decomposedPolygon: IPoints) => {
        let c = new p2.Convex({
          vertices: decomposedPolygon,
          material: material,
        });
        for (let i = 0; i < c.vertices.length; i++) {
          const v = c.vertices[i];
          p2.vec2.subtract(v, v, c.centerOfMass);
        }
        p2.vec2.copy(cm, c.centerOfMass);
        c = new p2.Convex({ vertices: c.vertices });
        concaveBody.addShape(c, cm);
      }
    );
  });
  concaveBody.adjustCenterOfMass();

  world.addBody(concaveBody);
  return concaveBody.id;
};

export const velocityToSpeed = (velocity: p2.Vec2) =>
  Math.sqrt(Math.pow(velocity[0], 2) + Math.pow(velocity[1], 2));

// Handle rotation update
export const handleRotation = (body: p2.Body) => {
  if (body) {
    body.angularVelocity = 0; // Prevent continued rotation
  }
};

// Find the body under the given point
export const getBodyAtPoint = (
  worldRef: RefObject<p2.World | null>,
  worldPoint: [number, number],
  panOffset: [number, number]
): p2.Body | null => {
  const world = worldRef.current;
  if (!world) return null;

  // Use world.hitTest to find bodies at the given point
  const hitBodies = world.hitTest(
    [worldPoint[0] - panOffset[0], worldPoint[1] - panOffset[1]],
    world.bodies,
    0.1
  );

  return hitBodies.length > 0 ? hitBodies[0] : null;
};

export const isLetter = (body: p2.Body) => {
  return body.shapes.some((shape) => shape.type === p2.Shape.CONVEX);
};
