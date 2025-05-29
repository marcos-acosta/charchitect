import { RefObject, useEffect, useRef, useState } from "react";
import * as p2 from "p2-es";
import Canvas from "./Canvas";
import styles from "./../styles.module.css";
import { IDimensions, IPolygons, LETTERS, Pages } from "../logic/interfaces";
import LetterButton from "./LetterButton";
import { computePixelsPerMeter } from "../logic/render-util";
import {
  ANGULAR_SPEED_THRESHOLD,
  CANVAS_WIDTH_METERS,
  LINEAR_SPEED_THRESHOLD,
  MIN_SECONDS_STABLE,
} from "../logic/game-config";
import {
  addLetterToWorld,
  allLettersStill,
  createWorld,
  removeLetterFromWorld,
  startShakeTest,
  startSimulation,
  stopSimulation,
  updateHighestPoint,
} from "../logic/game-util";
import LETTER_POLYGONS from "../logic/letters";
import { submitScore } from "../logic/server";
import { combineClasses } from "../logic/util";

interface GameProps {
  setPage: (page: Pages) => void;
}

export default function Game(props: GameProps) {
  /** REFS */
  // Create single world reference
  const worldRef = useRef<p2.World | null>(null);
  // Track the highest point
  const highestPointRef = useRef<number | null>(null);
  // Canvas container dimensions
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  // Whether all letters are currently still
  const allLettersStillRef = useRef<boolean>(true);
  // Timeout to detect stability
  const stabilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to track the ground
  const groundRef = useRef<p2.Body>(null);
  // Track last simulation run time
  const lastSimulationTimeRef = useRef<number>(0);
  // Track last shake test time
  const lastShakeTestTimeRef = useRef<number>(0);
  /** STATES */
  // Whether any gravity trial has been run
  const [gravityTrialRun, setGravityTrialRun] = useState(false);
  // Whether the stability test has started
  const [stabilityTestStarted, setStabilityTestStarted] = useState(false);
  // The current canvas container dimensions
  const [canvasContainerDimensions, setCanvasContainerDimensions] =
    useState<IDimensions | null>(null);
  // The letters currently in use
  const [lettersInUse, setLettersInUse] = useState<Record<number, LETTERS>>({});
  // Whether all letters are currently still
  const [allLettersStillState, setAllLettersStillState] = useState(true);
  // Whether the letters have been still for some time
  const [stabilized, setStabilized] = useState(false);
  // Add panning state
  const [panOffset, setPanOffset] = useState<[number, number]>([0, 0]);
  // Whether the score is being submitted
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Whether to show the name input popup
  const [showNamePopup, setShowNamePopup] = useState(false);
  // Whether the user is hovering over something grabbable
  const [canGrab, setCanGrab] = useState(false);
  // The player's name
  const [playerName, setPlayerName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("playerName") || "";
    }
    return "";
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  // Whether we're in trial mode
  const [isTrialMode, setIsTrialMode] = useState(false);

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

    if (worldRef.current === null) {
      const [world, groundBody] = createWorld(false);
      worldRef.current = world;
      groundRef.current = groundBody;
    }
  };

  const handleAddLetter = (letterEnum: LETTERS, letterPolygons: IPolygons) => {
    if (!worldRef.current || !canvasContainerDimensions) {
      return;
    }
    const letterId = addLetterToWorld(
      letterPolygons,
      worldRef.current,
      canvasContainerDimensions,
      undefined, // position
      undefined // angle
    );
    setLettersInUse((prev) => ({ ...prev, [letterId]: letterEnum }));
  };

  const handleRemoveLetter = (letterEnum: LETTERS) => {
    if (!worldRef.current) {
      return;
    }
    removeLetterFromWorld(letterEnum, lettersInUse, worldRef.current);
    setLettersInUse((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([_, value]) => value !== letterEnum)
      )
    );
  };

  const toggleLetter = (letterEnum: LETTERS) => {
    if (!worldRef.current) {
      return;
    }
    if (Object.values(lettersInUse).includes(letterEnum)) {
      handleRemoveLetter(letterEnum);
    } else {
      handleAddLetter(letterEnum, LETTER_POLYGONS[letterEnum]);
    }
  };

  const handleKeypress = (event: KeyboardEvent) => {
    if (event.metaKey || event.altKey || event.ctrlKey) {
      return;
    }
    const letter = event.key.toUpperCase();
    if (Object.keys(LETTERS).includes(letter)) {
      const letterEnum = LETTERS[letter as keyof typeof LETTERS];
      toggleLetter(letterEnum);
    }
  };

  const passGravityTrial = () => {
    setStabilized(true);
  };

  const unpassGravityTrial = () => {
    setStabilized(false);
  };

  const toggleTrialMode = () => {
    if (!isTrialMode) {
      // Switching to trial mode
      startSimulation(worldRef.current as p2.World);
      setStabilityTestStarted(false);
      lastSimulationTimeRef.current = Date.now();
    } else {
      // Switching back to sandbox mode
      stopSimulation(worldRef.current as p2.World);
      highestPointRef.current = null;
    }
    setIsTrialMode(!isTrialMode);
  };

  /** EFFECTS */

  // Set up keyboard event listeners
  useEffect(() => {
    addEventListener("keydown", handleKeypress);
    return () => removeEventListener("keydown", handleKeypress);
  }, [worldRef.current, lettersInUse]);

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
    if (worldRef.current) {
      const allLettersStillResult = allLettersStill(
        worldRef.current,
        LINEAR_SPEED_THRESHOLD,
        ANGULAR_SPEED_THRESHOLD
      );
      if (allLettersStillResult != allLettersStillRef.current) {
        setAllLettersStillState(allLettersStillResult);
        if (allLettersStillResult) {
          const timeout: NodeJS.Timeout = setTimeout(
            passGravityTrial,
            MIN_SECONDS_STABLE * 1000
          );
          stabilityTimeoutRef.current = timeout;
        } else {
          if (stabilityTimeoutRef.current) {
            clearTimeout(stabilityTimeoutRef.current);
          }
          stabilityTimeoutRef.current = null;
          unpassGravityTrial();
        }
      }
      allLettersStillRef.current = allLettersStillResult;
    }
  };

  const afterStep = () => {
    updateHighestPoint(worldRef.current, highestPointRef);
    updateAllLettersStill();
  };

  const runShakeTestCallback = () => {
    if (groundRef.current) {
      startShakeTest(groundRef.current);
      setStabilityTestStarted(true);
      lastShakeTestTimeRef.current = Date.now();
    }
  };

  const submitScoreCallback = () => {
    if (worldRef.current) {
      setShowNamePopup(true);
    }
  };

  const handleNameSubmit = () => {
    if (!playerName.trim()) return;

    localStorage.setItem("playerName", playerName);
    setIsSubmitting(true);
    if (worldRef.current) {
      submitScore(
        playerName,
        highestPointRef.current ?? 0,
        worldRef.current,
        lettersInUse
      ).then(() => {
        setIsSubmitting(false);
        setShowNamePopup(false);
      });
    }
  };

  const isInGracePeriod = (lastTime: number, gracePeriodMs: number) => {
    return Date.now() - lastTime < gracePeriodMs;
  };

  /** BUTTON STATES */
  const canRunShakeTest =
    !stabilityTestStarted &&
    stabilized &&
    gravityTrialRun &&
    !isInGracePeriod(lastSimulationTimeRef.current, 1000);

  const canSubmitScore =
    stabilityTestStarted &&
    stabilized &&
    gravityTrialRun &&
    !isSubmitting &&
    !isInGracePeriod(lastShakeTestTimeRef.current, 1000);

  return (
    <div className={styles.pageOuterContainer}>
      <div className={styles.coreGameContainer}>
        <div className={styles.letterSelectorAndCanvasesContainer}>
          <div className={styles.letterSelectionContainer}>
            {Object.values(LETTERS).map((letter) => (
              <LetterButton
                letter={letter}
                used={Object.values(lettersInUse).includes(letter)}
                onClick={() => toggleLetter(letter)}
                key={letter}
              />
            ))}
          </div>
          <div className={styles.canvasesAndControls}>
            <div className={styles.controlsContainer}>
              <button
                onClick={toggleTrialMode}
                className={styles.controlsButton}
              >
                <div className={styles.buttonText}>
                  {isTrialMode ? "EXIT TRIAL" : "RUN TRIAL"}
                </div>
                <div className={styles.shortcut}>[enter]</div>
              </button>
              <button
                onClick={runShakeTestCallback}
                className={styles.controlsButton}
                disabled={!canRunShakeTest}
              >
                <div className={styles.buttonText}>RUN STABILITY TEST</div>
              </button>
              <button
                onClick={submitScoreCallback}
                className={styles.controlsButton}
                disabled={!canSubmitScore}
              >
                <div className={styles.buttonText}>
                  {isSubmitting ? "SUBMITTING..." : "SUBMIT"}
                </div>
              </button>
              <button
                onClick={() => setPanOffset([0, 0])}
                className={styles.controlsButton}
              >
                <div className={styles.buttonText}>RESET VIEW</div>
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
                <div className={styles.stabilityTestStatusContainer}>
                  {stabilityTestStarted
                    ? "Stability test started"
                    : "Stability test not started"}
                </div>
              </div>
              <button onClick={() => props.setPage(Pages.HOMEPAGE)}>
                Back to Homepage
              </button>
            </div>
            <div
              className={combineClasses(
                styles.canvasContainer,
                isDragging
                  ? styles.dragging
                  : isRotating
                  ? styles.rotating
                  : isPanning
                  ? styles.panning
                  : canGrab
                  ? styles.canGrab
                  : styles.move
              )}
              ref={canvasContainerRef}
            >
              {worldRef.current &&
                canvasContainerDimensions &&
                pixelsPerMeter && (
                  <Canvas
                    worldRef={worldRef as RefObject<p2.World>}
                    width={canvasContainerDimensions?.width}
                    height={canvasContainerDimensions?.height}
                    pixelsPerMeter={pixelsPerMeter}
                    panOffset={panOffset}
                    onPanChange={setPanOffset}
                    lettersInUse={lettersInUse}
                    isDragging={isDragging}
                    isRotating={isRotating}
                    isPanning={isPanning}
                    setIsDragging={setIsDragging}
                    setIsRotating={setIsRotating}
                    setIsPanning={setIsPanning}
                    isTrialMode={isTrialMode}
                    highestPoint={highestPointRef}
                    onAfterStep={afterStep}
                    canGrab={canGrab}
                    setCanGrab={setCanGrab}
                  />
                )}
            </div>
          </div>
        </div>
      </div>
      {showNamePopup && (
        <div className={styles.submissionDialogContainer}>
          <div className={styles.submissionDialogContent}>
            <input
              type="text"
              value={playerName}
              onChange={(e) => {
                e.preventDefault();
                setPlayerName(e.target.value);
              }}
              placeholder="Enter your screen name"
            />
            <button onClick={handleNameSubmit} disabled={!playerName.trim()}>
              Submit Score
            </button>
            <button onClick={() => setShowNamePopup(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
