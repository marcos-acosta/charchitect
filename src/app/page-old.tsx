"use client";

import { useEffect, useRef } from "react";
import styles from "./page.module.css";
import * as p2 from "p2-es";
import { Sandbox } from "@p2-es/sandbox";
import { createLetterFromPoints, IPoints } from "./util";
import { LETTER_A, LETTER_B, LETTER_C, LETTER_D } from "./letters";

export default function Home() {
  const world = useRef(new p2.World());
  const sandboxCanvasRef = useRef<HTMLDivElement>(null);

  // useEffect(() => {
  //   if (!world.current) {
  //     return;
  //   }
  //   const circleBody = new p2.Body({
  //     mass: 5,
  //     position: [0, 10],
  //   });
  //   const circleShape = new p2.Circle({ radius: 1 });
  //   circleBody.addShape(circleShape);

  //   const groundShape = new p2.Plane();
  //   const groundBody = new p2.Body({
  //     mass: 0,
  //   });
  //   groundBody.addShape(groundShape);
  //   world.current.addBody(circleBody);
  //   world.current.addBody(groundBody);

  //   const timeStep = 1 / 60;
  //   const intervalId = setInterval(function () {
  //     world.current.step(timeStep);
  //     // console.log("Circle x position: " + circleBody.position[0]);
  //     // console.log("Circle y position: " + circleBody.position[1]);
  //     // console.log("Circle angle: " + circleBody.angle);
  //   }, 1000 * timeStep);

  //   return () => clearInterval(intervalId);
  // }, []);

  useEffect(() => {
    console.log("here");
    if (sandboxCanvasRef.current) {
      new Sandbox(({ frame }) => {
        console.log("here 2");
        // Create the physics world
        // const world = new p2.World({
        //   gravity: [0, -10],
        // });

        // Set stiffness of contact & constraints
        world.current.setGlobalStiffness(1e4);

        // world.solver.iterations = 20;
        // world.solver.tolerance = 0.01;
        world.current.islandSplit = true;

        // Enable dynamic friction. A bit more expensive than without, but gives more accurate friction
        // world.solver.frictionIterations = 10;

        // Create ground
        const planeShape = new p2.Plane();
        const plane = new p2.Body({
          mass: 0, // static
          position: [0, -2],
        });
        plane.addShape(planeShape);
        world.current.addBody(plane);

        createLetterFromPoints(LETTER_A as IPoints, [0, 2], world.current);
        createLetterFromPoints(LETTER_B as IPoints, [1, 2], world.current);
        createLetterFromPoints(LETTER_C as IPoints, [2, 2], world.current);
        createLetterFromPoints(LETTER_D as IPoints, [3, 2], world.current);

        // Set camera position and zoom
        frame(0, 1, 6, 8);

        return {
          world: world.current,
          // Enable shape drawing
          // tools: {
          //   default: Tools.POLYGON,
          // },
        };
      }).mount(sandboxCanvasRef.current);
    }
  }, [sandboxCanvasRef.current === null]);

  return (
    <div className={styles.pageOuterContainer}>
      <div className={styles.sideBySidePanels}>
        <div className={styles.sandboxCanvas} ref={sandboxCanvasRef}></div>
      </div>
    </div>
  );
}
