import { useRef } from "react";
import * as p2 from "p2-es";
import PhysicsRenderer from "./PhysicsRenderer";
import { createLetterFromPoints, IPoints } from "../util";
import { LETTER_A } from "../letters";

// const createWorld = (canvasWidthMeters: number) => {
//   // Create new physics world with gravity
//   const newWorld = new p2.World({
//     // gravity: [0, -9.82],
//     gravity: [0, 0],
//   });

//   // Add a ground plane
//   const groundBody = new p2.Body({
//     type: p2.Body.STATIC,
//     position: [canvasWidthMeters / 2, 0],
//   });
//   const groundShape = new p2.Box({ width: canvasWidthMeters, height: 1 });
//   groundBody.addShape(groundShape);
//   newWorld.addBody(groundBody);

//   // Add some dynamic bodies
//   for (let i = 0; i < 5; i++) {
//     const body = new p2.Body({
//       mass: 1,
//       position: [Math.random() * 1 + canvasWidthMeters / 2, 2 + i * 1],
//       damping: 1,
//       angularDamping: 1,
//     });

//     // Randomly create either box or circle
//     if (Math.random() > 0.5) {
//       const shape = new p2.Box({ width: 1, height: 1 });
//       body.addShape(shape);
//     } else {
//       const shape = new p2.Circle({ radius: 0.5 });
//       body.addShape(shape);
//     }

//     newWorld.addBody(body);
//   }

//   return newWorld;
// };

const createWorldNew = (canvasWidthMeters: number) => {
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

  // const body = new p2.Body({
  //   mass: 1,
  //   position: [canvasWidthMeters / 2, 2],
  //   damping: 1,
  //   angularDamping: 1,
  // });

  // // Randomly create either box or circle
  // const shape = new p2.Box({ width: 1, height: 1 });
  // body.addShape(shape);

  // newWorld.addBody(body);

  createLetterFromPoints(LETTER_A as IPoints, [0, 2], newWorld, 1000);

  return newWorld;
};

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PIXELS_PER_METER = 80;

export default function Demo() {
  const worldRef = useRef(createWorldNew(CANVAS_WIDTH / PIXELS_PER_METER));

  const addGravity = () => {
    worldRef.current.gravity[1] = -9.82;
    worldRef.current.bodies.forEach((body) => {
      body.damping = 0.1;
      body.angularDamping = 0.1;
    });
  };

  return (
    <div className="physics-container">
      <h2>P2.js Physics Demo</h2>
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
