import { RefObject, useEffect, useRef, useState } from "react";
import * as p2 from "p2-es";
import PhysicsRenderer from "./PhysicsRenderer";
import LETTER_POLYGONS from "../logic/letters";
import styles from "./../styles.module.css";
import { IDimensions, IPoints, LETTERS } from "../logic/interfaces";
import LetterButton from "./LetterButton";
import { createLetterFromPoints, handleRotation, handleRotationEnd, handleRotationStart, velocityToSpeed, WOOD_MATERIAL } from "../logic/p2-util";
import { computeMetersPerPixel, computePixelsPerMeter } from "../logic/render-util";
import { AVG_LETTER_WIDTH_PIXELS } from "../logic/letter-util";
import { ANGULAR_SPEED_THRESHOLD, CANVAS_WIDTH_METERS, DESIRED_LETTER_WIDTH_METERS, LINEAR_SPEED_THRESHOLD, MIN_SECONDS_STABLE } from "../logic/game-config";
import { addLetterToWorld, allLettersStill, cloneBodyToWorld, createWorld, runSimulation, updateHighestPoint } from "../logic/game-util";

export default function Game() {
  /** REFS */
  // Create sandbox world (left side - interactive)
  const sandboxWorldRef = useRef<p2.World | null>(null);
  // Create trial world (right side - read-only with gravity)
  const trialWorldRef = useRef<p2.World | null>(null);
  // Track the highest point in the trial world
  const highestPointRef = useRef<number>(0);
  // Canvas container dimensions
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  // Whether all letters are currently still
  const allLettersStillRef = useRef<boolean>(true);
  // Timeout to detect stability
  const stabilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  /** STATES */
  // The current canvas container dimensions
  const [canvasContainerDimensions, setCanvasContainerDimensions] =
    useState<IDimensions | null>(null);
  // The letters currently in use
  const [lettersUsed, setLettersUsed] = useState<Set<LETTERS>>(new Set());
  // Whether all letters are currently still
  const [allLettersStillState, setAllLettersStillState] = useState(true);
  // Whether the letters have been still for some time
  const [stabilized, setStabilized] = useState(true);

  const pixelsPerMeter = canvasContainerDimensions
    ? computePixelsPerMeter(
        canvasContainerDimensions.width,
        CANVAS_WIDTH_METERS
      )
    : undefined;

  /** HELPER FUNCTIONS */

  // Function to measure container and update dimensions
  const updateDimensions = () => {
    if (!canvasContainerRef.current) return;

    const { width, height } =
      canvasContainerRef.current.getBoundingClientRect();
    setCanvasContainerDimensions({
      width: Math.floor(width),
      height: Math.floor(height),
    });

    if (sandboxWorldRef.current === null) {
      sandboxWorldRef.current = createWorld(false);
      trialWorldRef.current = createWorld(true);
    }
  };

  const addLetterToTrial = (letter: LETTERS) => {
    if (!sandboxWorldRef.current || !canvasContainerDimensions) {
      return;
    }
    addLetterToWorld(letter, sandboxWorldRef.current, canvasContainerDimensions);
    setLettersUsed(new Set([...lettersUsed, letter]));
  };

  const handleKeypress = (event: KeyboardEvent) => {
    if (event.metaKey || event.altKey || event.ctrlKey) {
      return;
    }
    const letter = event.key.toUpperCase();
    if (Object.keys(LETTERS).includes(letter)) {
      const letterEnum = LETTERS[letter as keyof typeof LETTERS];
      addLetterToTrial(letterEnum);
    }
  };

  /** EFFECTS */

  // Set up keyboard event listeners
  useEffect(() => {
    addEventListener("keydown", handleKeypress);
    return () => removeEventListener("keydown", handleKeypress);
  }, [sandboxWorldRef.current, lettersUsed]);

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

  const updateAllLettersStill = () => {
    if (trialWorldRef.current) {
      const allLettersStillResult = allLettersStill(
        trialWorldRef.current,
        LINEAR_SPEED_THRESHOLD,
        ANGULAR_SPEED_THRESHOLD
      );
      if (allLettersStillResult != allLettersStillRef.current) {
        setAllLettersStillState(allLettersStillResult);
        if (allLettersStillResult) {
          const timeout: NodeJS.Timeout = setTimeout(
            () => setStabilized(true),
            MIN_SECONDS_STABLE * 1000
          );
          stabilityTimeoutRef.current = timeout;
        } else {
          if (stabilityTimeoutRef.current) {
            clearTimeout(stabilityTimeoutRef.current);
          }
          stabilityTimeoutRef.current = null;
          setStabilized(false);
        }
      }
      allLettersStillRef.current = allLettersStillResult;
    }
  };

  const afterStep = () => {
    updateHighestPoint(trialWorldRef.current, highestPointRef);
    updateAllLettersStill();
  };

  const runSimulationCallback = () => {
    runSimulation(sandboxWorldRef, trialWorldRef);
  }

  return (
    <div className={styles.pageOuterContainer}>
      <div className={styles.coreGameContainer}>
        <div className={styles.letterSelectorAndCanvasesContainer}>
          <div className={styles.letterSelectionContainer}>
            {Object.values(LETTERS).map((letter) => (
              <LetterButton
                letter={letter}
                used={lettersUsed.has(letter)}
                onClick={() => addLetterToTrial(letter)}
                key={letter}
              />
            ))}
          </div>
          <div className={styles.canvasesAndControls}>
            <div className={styles.controlsContainer}>
              <button onClick={runSimulationCallback} className={styles.controlsButton}>
                <div className={styles.buttonText}>RUN TRIAL</div>
                <div className={styles.shortcut}>[enter]</div>
              </button>
              <div className={styles.statusDivider}>
                <hr />
              </div>
              <div className={styles.statusContainer}>
                <div className={styles.objectsMovingContainer}>
                  {allLettersStillState
                    ? "All letters still"
                    : "Some letters still moving"}
                </div>
                <div className={styles.fullyStableContainer}>
                  {stabilized ? "Fully stabilized" : "Not yet stabilized"}
                </div>
              </div>
            </div>
            <div className={styles.canvasContainer} ref={canvasContainerRef}>
              {sandboxWorldRef.current &&
                canvasContainerDimensions &&
                pixelsPerMeter && (
                  <PhysicsRenderer
                    worldRef={sandboxWorldRef as RefObject<p2.World>}
                    width={canvasContainerDimensions?.width}
                    height={canvasContainerDimensions?.height}
                    pixelsPerMeter={pixelsPerMeter}
                    onRotationStart={handleRotationStart}
                    onRotation={handleRotation}
                    onRotationEnd={handleRotationEnd}
                  />
                )}
            </div>
            <div className={styles.canvasContainer}>
              {trialWorldRef.current &&
                canvasContainerDimensions &&
                pixelsPerMeter && (
                  <PhysicsRenderer
                    worldRef={trialWorldRef as RefObject<p2.World>}
                    width={canvasContainerDimensions?.width}
                    height={canvasContainerDimensions?.height}
                    pixelsPerMeter={pixelsPerMeter}
                    readOnly={true} // Make trial canvas read-only
                    highestPoint={highestPointRef} // Pass the highest point
                    onAfterStep={afterStep}
                  />
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
