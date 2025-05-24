import { RefObject, useEffect, useRef, useState } from "react";
import * as p2 from "p2-es";
import Canvas from "./Canvas";
import styles from "./../styles.module.css";
import { IDimensions, IPolygons, LETTERS } from "../logic/interfaces";
import LetterButton from "./LetterButton";
import { handleRotation } from "../logic/p2-util";
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
  runSimulation,
  startShakeTest,
  updateHighestPoint,
} from "../logic/game-util";
import LETTER_POLYGONS from "../logic/letters";
import { submitScore } from "../logic/server";

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
  // Ref to track the ground in the trial world
  const trialGroundRef = useRef<p2.Body>(null);
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
  // Mapping of trial world body IDs to letters
  const [trialBodyIdToLetterMapping, setTrialBodyIdToLetterMapping] = useState<
    Record<number, LETTERS>
  >({});
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
  // The player's name
  const [playerName, setPlayerName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("playerName") || "";
    }
    return "";
  });

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
      sandboxWorldRef.current = createWorld(false)[0];
      const [trialWorld, trialGroundBody] = createWorld(true);
      trialWorldRef.current = trialWorld;
      trialGroundRef.current = trialGroundBody;
    }
  };

  const addLetterToTrial = (letterEnum: LETTERS, letterPolygons: IPolygons) => {
    if (!sandboxWorldRef.current || !canvasContainerDimensions) {
      return;
    }
    const letterId = addLetterToWorld(
      letterPolygons,
      sandboxWorldRef.current,
      canvasContainerDimensions
    );
    setLettersInUse({ ...lettersInUse, [letterId]: letterEnum });
  };

  const removeLetterFromTrial = (letterEnum: LETTERS) => {
    if (!sandboxWorldRef.current) {
      return;
    }
    removeLetterFromWorld(letterEnum, lettersInUse, sandboxWorldRef.current);
    setLettersInUse((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([_, value]) => value !== letterEnum)
      )
    );
  };

  const toggleLetter = (letterEnum: LETTERS) => {
    if (!sandboxWorldRef.current) {
      return;
    }
    if (Object.values(lettersInUse).includes(letterEnum)) {
      removeLetterFromTrial(letterEnum);
    } else {
      addLetterToTrial(letterEnum, LETTER_POLYGONS[letterEnum]);
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

  /** EFFECTS */

  // Set up keyboard event listeners
  useEffect(() => {
    addEventListener("keydown", handleKeypress);
    return () => removeEventListener("keydown", handleKeypress);
  }, [sandboxWorldRef.current, lettersInUse]);

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
    updateHighestPoint(trialWorldRef.current, highestPointRef);
    updateAllLettersStill();
  };

  const runSimulationCallback = () => {
    if (!gravityTrialRun) {
      setGravityTrialRun(true);
    }
    const newMapping = runSimulation(
      sandboxWorldRef,
      trialWorldRef,
      lettersInUse
    );
    setTrialBodyIdToLetterMapping(newMapping);
    setStabilityTestStarted(false);
    lastSimulationTimeRef.current = Date.now();
  };

  const runShakeTestCallback = () => {
    if (trialGroundRef.current) {
      startShakeTest(trialGroundRef.current);
      setStabilityTestStarted(true);
      lastShakeTestTimeRef.current = Date.now();
    }
  };

  const submitScoreCallback = () => {
    if (trialWorldRef.current) {
      setShowNamePopup(true);
    }
  };

  const handleNameSubmit = () => {
    if (!playerName.trim()) return;

    localStorage.setItem("playerName", playerName);
    setIsSubmitting(true);
    if (trialWorldRef.current) {
      submitScore(
        playerName,
        highestPointRef.current,
        trialWorldRef.current,
        trialBodyIdToLetterMapping
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
                onClick={runSimulationCallback}
                className={styles.controlsButton}
              >
                <div className={styles.buttonText}>RUN TRIAL</div>
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
            </div>
            <div className={styles.canvasContainer} ref={canvasContainerRef}>
              {sandboxWorldRef.current &&
                canvasContainerDimensions &&
                pixelsPerMeter && (
                  <Canvas
                    worldRef={sandboxWorldRef as RefObject<p2.World>}
                    width={canvasContainerDimensions?.width}
                    height={canvasContainerDimensions?.height}
                    pixelsPerMeter={pixelsPerMeter}
                    onRotation={handleRotation}
                    panOffset={panOffset}
                    onPanChange={setPanOffset}
                    lettersInUse={lettersInUse}
                  />
                )}
            </div>
            <div className={styles.canvasContainer}>
              {trialWorldRef.current &&
                canvasContainerDimensions &&
                pixelsPerMeter && (
                  <Canvas
                    worldRef={trialWorldRef as RefObject<p2.World>}
                    width={canvasContainerDimensions?.width}
                    height={canvasContainerDimensions?.height}
                    pixelsPerMeter={pixelsPerMeter}
                    readOnly={true} // Make trial canvas read-only
                    highestPoint={highestPointRef} // Pass the highest point
                    onAfterStep={afterStep}
                    panOffset={panOffset}
                    onPanChange={setPanOffset}
                    lettersInUse={trialBodyIdToLetterMapping}
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
