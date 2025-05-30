import { RefObject, useEffect, useRef, useState, useCallback } from "react";
import * as p2 from "p2-es";
import Canvas from "./Canvas";
import styles from "./../styles.module.css";
import {
  IDimensions,
  IPolygons,
  LETTERS,
  Pages,
  TrialStage,
} from "../logic/interfaces";
import LetterButton from "./LetterButton";
import {
  computeDimensionsInMeters,
  computePixelsPerMeter,
} from "../logic/render-util";
import {
  ANGULAR_SPEED_THRESHOLD,
  CANVAS_HEIGHT_METERS,
  LINEAR_SPEED_THRESHOLD,
  MIN_SECONDS_STABLE,
} from "../logic/game-config";
import {
  addLetterToWorld,
  allLettersStill,
  createWorld,
  deleteAllManipulableLetters,
  findHighestBody,
  hasManipulableLetters,
  removeLetterFromWorld,
  startShakeTest,
  startSimulation,
  stopSimulation,
  updateHighestPoint,
} from "../logic/game-util";
import LETTER_POLYGONS from "../logic/letters";
import { submitScore } from "../logic/server";
import { combineClasses } from "../logic/util";
import ActionButton from "./ActionButton";

interface GameProps {
  setPage: (page: Pages) => void;
}

const STAGE_TO_DESCRIPTION = {
  [TrialStage.NOT_STARTED]: "Not started",
  [TrialStage.APPLIED_GRAVITY]: "Applied gravity",
  [TrialStage.LETTERS_STILL_AFTER_GRAVITY]: "All letters still",
  [TrialStage.STABLE_AFTER_GRAVITY]: "3 seconds elapsed",
  [TrialStage.APPLIED_EARTHQUAKE]: "Applied earthquake",
  [TrialStage.LETTERS_STILL_AFTER_EARTHQUAKE]: "All letters still",
  [TrialStage.STABLE_AFTER_EARTHQUAKE]: "3 seconds elapsed",
};

export default function Game(props: GameProps) {
  /** REFS */
  // Create single world reference
  const worldRef = useRef<p2.World | null>(null);
  // Track the highest point
  const highestPointRef = useRef<number | null>(null);
  // Canvas container dimensions
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  // Whether all letters are currently still
  const allLettersStillRef = useRef<boolean>(false);
  // Timeout to detect stability
  const stabilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to track the ground
  const groundRef = useRef<p2.Body>(null);
  // Track current trial stage
  const trialStageRef = useRef<TrialStage>(TrialStage.NOT_STARTED);
  /** STATES */
  // The current canvas container dimensions
  const [canvasContainerDimensions, setCanvasContainerDimensions] =
    useState<IDimensions | null>(null);
  // The letters currently in use
  const [lettersInUse, setLettersInUse] = useState<Record<number, LETTERS>>({});
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
  // The current trial stage
  const [trialStage, setTrialStage] = useState(TrialStage.NOT_STARTED);

  const pixelsPerMeter = canvasContainerDimensions
    ? computePixelsPerMeter(
        canvasContainerDimensions.height,
        CANVAS_HEIGHT_METERS
      )
    : undefined;

  /** HELPER FUNCTIONS */

  // Function to measure container and update dimensions
  const updateDimensions = () => {
    if (!canvasContainerRef.current) return;

    const { width, height } =
      canvasContainerRef.current.getBoundingClientRect();
    const widthFloored = Math.floor(width);
    const heightFloored = Math.floor(height);
    setCanvasContainerDimensions({
      width: widthFloored,
      height: heightFloored,
    });
    const dimensionsInMeters = computeDimensionsInMeters({
      width: widthFloored,
      height: heightFloored,
    });

    if (worldRef.current === null && dimensionsInMeters) {
      const [world, groundBody] = createWorld(false, dimensionsInMeters);
      worldRef.current = world;
      groundRef.current = groundBody;
    }
  };

  const handleAddLetter = (letterEnum: LETTERS, letterPolygons: IPolygons) => {
    if (!worldRef.current || !canvasContainerDimensions) {
      return;
    }
    const [tallestLetter, tallestPoint] = findHighestBody(
      worldRef.current,
      true
    );
    const letterId = addLetterToWorld(
      letterPolygons,
      worldRef.current,
      canvasContainerDimensions,
      undefined, // position
      undefined, // angle
      tallestLetter ? [tallestLetter.position[0], tallestPoint] : undefined
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

  const verifySolidAfterNSeconds = () => {
    if (trialStageRef.current === TrialStage.LETTERS_STILL_AFTER_GRAVITY) {
      setTrialStage(TrialStage.APPLIED_EARTHQUAKE);
      setTimeout(runShakeTestCallback, 10);
    } else if (
      trialStageRef.current === TrialStage.LETTERS_STILL_AFTER_EARTHQUAKE
    ) {
      setTrialStage(TrialStage.STABLE_AFTER_EARTHQUAKE);
    }
  };

  const unVerifySolidAfterNSeconds = () => {
    if (trialStageRef.current < TrialStage.APPLIED_EARTHQUAKE) {
      setTrialStage(TrialStage.APPLIED_GRAVITY);
    } else {
      setTrialStage(TrialStage.APPLIED_EARTHQUAKE);
    }
  };

  const toggleTrialMode = () => {
    if (!isTrialMode) {
      // Switching to trial mode
      startSimulation(worldRef.current as p2.World);
      setTrialStage(TrialStage.APPLIED_GRAVITY);
    } else {
      // Switching back to sandbox mode
      stopSimulation(worldRef.current as p2.World);
      highestPointRef.current = null;
      setTrialStage(TrialStage.NOT_STARTED);
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

  // Update ref when state changes
  useEffect(() => {
    trialStageRef.current = trialStage;
  }, [trialStage]);

  const updateTrialStageWithAllLettersStill = () => {
    if (trialStageRef.current === TrialStage.APPLIED_GRAVITY) {
      setTrialStage(TrialStage.LETTERS_STILL_AFTER_GRAVITY);
    } else if (trialStageRef.current === TrialStage.APPLIED_EARTHQUAKE) {
      setTrialStage(TrialStage.LETTERS_STILL_AFTER_EARTHQUAKE);
    }
  };

  const updateAllLettersStill = () => {
    if (worldRef.current && isTrialMode) {
      const allLettersStillResult = allLettersStill(
        worldRef.current,
        LINEAR_SPEED_THRESHOLD,
        ANGULAR_SPEED_THRESHOLD
      );
      if (allLettersStillResult != allLettersStillRef.current) {
        if (allLettersStillResult) {
          updateTrialStageWithAllLettersStill();
          const timeout: NodeJS.Timeout = setTimeout(
            verifySolidAfterNSeconds,
            MIN_SECONDS_STABLE * 1000
          );
          stabilityTimeoutRef.current = timeout;
        } else {
          if (stabilityTimeoutRef.current) {
            clearTimeout(stabilityTimeoutRef.current);
          }
          stabilityTimeoutRef.current = null;
          unVerifySolidAfterNSeconds();
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
    }
  };

  const submitScoreCallback = () => {
    if (worldRef.current) {
      setShowNamePopup(true);
    }
  };

  const clearAllLettersCallback = () => {
    if (worldRef.current) {
      deleteAllManipulableLetters(worldRef.current);
      setLettersInUse({});
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

  const resetView = () => setPanOffset([0, 0]);

  /** BUTTON STATES */
  const canSubmitScore =
    !isSubmitting && trialStage === TrialStage.STABLE_AFTER_EARTHQUAKE;

  const isViewAtOrigin = panOffset[0] === 0 && panOffset[1] === 0;

  const worldHasManipulableLetters =
    worldRef.current && hasManipulableLetters(worldRef.current);

  const canRunTrial = isTrialMode || worldHasManipulableLetters;

  return (
    <>
      <div className={styles.pageOuterContainer}>
        <div
          className={combineClasses(
            styles.runTypeContainer,
            isTrialMode && styles.trialMode
          )}
        >
          <span
            className={combineClasses(
              "material-symbols-outlined",
              styles.runTypeIcon
            )}
          >
            {isTrialMode ? "directions_run" : "construction"}
          </span>
          <span>{isTrialMode ? "Testing" : "Building"}</span>
        </div>
        <div className={styles.commandSidebar}>
          <div
            className={combineClasses(
              styles.titleContainer,
              styles.marginBottomSmall
            )}
          >
            Typesetter
          </div>
          <div className={styles.paddingContainer}>
            <div
              className={combineClasses(
                styles.letterGrid,
                styles.marginBottomMedium
              )}
            >
              {Object.values(LETTERS).map((letter) => (
                <LetterButton
                  letter={letter}
                  used={Object.values(lettersInUse).includes(letter)}
                  onClick={() => toggleLetter(letter)}
                  key={letter}
                />
              ))}
            </div>
            <div
              className={combineClasses(
                styles.actionButtonContainer,
                styles.marginBottomMedium
              )}
            >
              <ActionButton
                text={"Reset view"}
                callback={resetView}
                disabled={isViewAtOrigin}
              />
              <ActionButton
                text={"Clear all letters"}
                callback={clearAllLettersCallback}
                disabled={isTrialMode || !worldHasManipulableLetters}
              />
              <ActionButton
                text={isTrialMode ? "Return to sandbox" : "Run trial"}
                callback={toggleTrialMode}
                disabled={!canRunTrial}
              />
            </div>
            <div
              className={combineClasses(
                styles.progressContainer,
                styles.marginBottomMedium
              )}
            >
              {Object.values(TrialStage)
                .filter((key) => !isNaN(Number(key)) && Number(key) > 0)
                .map((trialStage_) => (
                  <div className={styles.progressRow} key={trialStage_}>
                    {trialStage_ !== TrialStage.STABLE_AFTER_EARTHQUAKE && (
                      <div className={styles.statusLine} />
                    )}
                    <div className={styles.statusName}>
                      <div>
                        {STAGE_TO_DESCRIPTION[trialStage_ as TrialStage]}
                      </div>
                      {trialStage >= (trialStage_ as number) && (
                        <div className={styles.checkMarkContainer}>
                          <span
                            className={combineClasses(
                              styles.checkMark,
                              "material-symbols-outlined"
                            )}
                          >
                            check
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              <div
                className={styles.progressBall}
                style={{
                  top: `${
                    3 *
                      Math.min(
                        trialStage,
                        TrialStage.STABLE_AFTER_EARTHQUAKE - 1
                      ) -
                    0.5 +
                    1.5
                  }vw`,
                }}
              />
            </div>
            <ActionButton
              text={"Submit type stack"}
              callback={submitScoreCallback}
              disabled={!canSubmitScore}
            />
          </div>
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
          {worldRef.current && canvasContainerDimensions && pixelsPerMeter && (
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
    </>
  );
}
