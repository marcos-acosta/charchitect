import React, { useRef, useEffect } from "react";
import styles from "./../styles.module.css";
import * as p2 from "p2-es";
import { paintCanvas } from "./CanvasPainter";
import { LETTERS, ILetterData } from "../logic/interfaces";
import LETTER_POLYGONS from "../logic/letters";
import { addLetterToWorld } from "../logic/game-util";

interface StaticStackProps {
  width: number;
  height: number;
  pixelsPerMeter: number;
  letters: ILetterData[];
  highestPoint?: number;
}

export default function StaticStack(props: StaticStackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<p2.World>(new p2.World({ gravity: [0, 0] }));

  useEffect(() => {
    // Clear existing bodies
    while (worldRef.current.bodies.length > 0) {
      worldRef.current.removeBody(worldRef.current.bodies[0]);
    }

    // Add letters to the world with their specified positions and angles
    props.letters.forEach((letterData) => {
      const letter = letterData.letter as LETTERS;
      addLetterToWorld(
        LETTER_POLYGONS[letter],
        worldRef.current,
        { width: props.width, height: props.height },
        [letterData.x, letterData.y],
        letterData.angle,
        true
      );
    });

    // Draw the static stack
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        paintCanvas({
          ctx,
          width: props.width,
          height: props.height,
          pixelsPerMeter: props.pixelsPerMeter,
          world: worldRef.current,
          panOffset: [0, 0],
          highestPoint: props.highestPoint,
          readOnly: true,
        });
      }
    }
  }, [props.letters, props.highestPoint]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: `${props.width}px`,
        height: `${props.height}px`,
      }}
      width={props.width}
      height={props.height}
    />
  );
}
