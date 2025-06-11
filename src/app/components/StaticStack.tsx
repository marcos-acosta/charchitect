import React, { useRef, useEffect, useState } from "react";
import * as p2 from "p2-es";
import { paintCanvas } from "./CanvasPainter";
import { LETTERS, ILetterData, IDimensions } from "../logic/interfaces";
import LETTER_POLYGONS from "../logic/letters";
import { addLetterToWorld } from "../logic/game-util";
import styles from "./../styles.module.css";
import { computePixelsPerMeter } from "../logic/render-util";
import { CANVAS_HEIGHT_METERS } from "../logic/game-config";

interface StaticStackProps {
  letters: ILetterData[];
  highestPoint?: number;
}

export default function StaticStack(props: StaticStackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasContainerDimensions, setCanvasContainerDimensions] =
    useState<IDimensions | null>(null);
  const worldRef = useRef<p2.World>(new p2.World({ gravity: [0, 0] }));

  const pixelsPerMeter = canvasContainerDimensions
    ? computePixelsPerMeter(
        canvasContainerDimensions.height,
        CANVAS_HEIGHT_METERS
      )
    : undefined;

  useEffect(() => {
    if (!canvasContainerDimensions || !pixelsPerMeter) {
      return;
    }

    // Clear existing bodies
    while (worldRef.current.bodies.length > 0) {
      worldRef.current.removeBody(worldRef.current.bodies[0]);
    }

    const widthCenter = canvasContainerDimensions.width / pixelsPerMeter / 2;

    // Add letters to the world with their specified positions and angles
    props.letters.forEach((letterData) => {
      const letter = letterData.letter as LETTERS;
      addLetterToWorld(
        LETTER_POLYGONS[letter],
        worldRef.current,
        {
          width: canvasContainerDimensions.width,
          height: canvasContainerDimensions.height,
        },
        [letterData.x + widthCenter, letterData.y],
        letterData.angle
      );
    });

    // Draw the static stack
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        paintCanvas({
          ctx,
          width: canvasContainerDimensions.width,
          height: canvasContainerDimensions.height,
          pixelsPerMeter: pixelsPerMeter,
          world: worldRef.current,
          panOffset: [0, 0],
          highestPoint: props.highestPoint,
          readOnly: true,
        });
      }
    }
  }, [props.letters, props.highestPoint, canvasContainerDimensions]);

  // Function to measure container and update dimensions
  const updateDimensions = () => {
    if (!canvasContainerRef.current) return;

    const { width, height } =
      canvasContainerRef.current.getBoundingClientRect();
    const widthFloored = Math.floor(width) - 3;
    const heightFloored = Math.floor(height) - 3;
    setCanvasContainerDimensions({
      width: widthFloored,
      height: heightFloored,
    });
  };

  // Create canvas and listen for canvas size updates
  useEffect(() => {
    if (!canvasContainerRef.current) return;
    // Initial size measurement
    updateDimensions();
    // Set up resize observer
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(canvasContainerRef.current);
    // Clean up
    return () => resizeObserver.disconnect();
  }, [canvasContainerRef.current]);

  return (
    <div className={styles.staticCanvasContainer}>
      <div
        className={styles.staticCanvasInnerContainer}
        ref={canvasContainerRef}
      >
        {canvasContainerDimensions && (
          <canvas
            ref={canvasRef}
            style={{
              width: `${canvasContainerDimensions.width}px`,
              height: `${canvasContainerDimensions.height}px`,
            }}
            width={canvasContainerDimensions.width}
            height={canvasContainerDimensions.height}
          />
        )}
      </div>
    </div>
  );
}
