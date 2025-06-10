import { useEffect, useState, Fragment } from "react";
import styles from "../styles.module.css";
import { IScore, Pages } from "../logic/interfaces";
import { getScores } from "../logic/server";
import StaticStack from "./StaticStack";
import { combineClasses, formatNumber } from "../logic/util";
import ActionButton from "./ActionButton";

interface HomepageProps {
  setPage: (page: Pages) => void;
}

export default function Homepage(props: HomepageProps) {
  const [isFetching, setIsFetching] = useState(false);
  const [scores, setScores] = useState<IScore[]>([]);
  const [selectedScoreId, setSelectedScoreId] = useState<string | null>(null);
  const [previewedScoreId, setPreviewedScoreId] = useState<string | null>(null);

  useEffect(() => {
    setIsFetching(true);
    getScores(10).then((scores) => {
      setScores(scores);
      setIsFetching(false);
    });
  }, []);

  const preferredId = previewedScoreId || selectedScoreId;
  const scoreToShow = scores.length
    ? scores.find((score) => score._id === preferredId) || scores[0]
    : null;

  return (
    <div className={styles.fullPageContainer}>
      <div className={styles.sidePanel}>
        <div
          className={combineClasses(
            styles.titleContainer,
            styles.marginBottomSmall
          )}
        >
          Typesetter
        </div>
        <div className={styles.sideBarInnerContainer}>
          <div
            className={combineClasses(
              styles.description,
              styles.marginBottomMedium
            )}
          >
            So much information is conveyed with written language. Words are
            constructed using the building blocks of the alphabet. But what if
            letters were assembled not with the intent of conveying information,
            but purely for structural integrity?
          </div>
          <div className={styles.marginBottomMedium}>
            <ActionButton
              text={"Build"}
              callback={() => props.setPage(Pages.SANDBOX)}
            />
          </div>
          <div className={styles.leaderboardContainer}>
            <div
              className={styles.leaderboardTable}
              onMouseLeave={() => setPreviewedScoreId(null)}
            >
              <div
                className={combineClasses(styles.leaderboardRow, styles.header)}
              >
                <div className={styles.leaderboardHeaderCell}>Rank</div>
                <div className={styles.leaderboardHeaderCell}>Height</div>
                <div className={styles.leaderboardHeaderCell}>By</div>
              </div>
              {scores.map((score, i) => (
                <div
                  className={combineClasses(
                    styles.leaderboardRow,
                    ((selectedScoreId && score._id === selectedScoreId) ||
                      (!selectedScoreId && i === 0)) &&
                      styles.selected,
                    previewedScoreId &&
                      score._id === previewedScoreId &&
                      styles.previewed
                  )}
                  key={score._id}
                  onClick={() => setSelectedScoreId(score._id)}
                  onMouseEnter={() => setPreviewedScoreId(score._id)}
                >
                  <div className={styles.leaderboardCell}>#{i + 1}</div>
                  <div className={styles.leaderboardCell}>{`${formatNumber(
                    score.score,
                    2
                  )}m`}</div>
                  <div className={styles.leaderboardCell}>
                    {score.playerName.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className={styles.previewContainer}>
        {scoreToShow && (
          <StaticStack
            letters={scoreToShow.letters}
            highestPoint={scoreToShow.score}
            width={300}
            height={500}
            pixelsPerMeter={30}
          />
        )}
      </div>
    </div>
  );
}
