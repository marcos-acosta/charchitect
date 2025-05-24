import { useEffect, useState } from "react";
import styles from "../styles.module.css";
import { IScore, Pages } from "../logic/interfaces";
import { getScores } from "../logic/server";
import RankedTower from "./RankedTower";

interface HomepageProps {
  setPage: (page: Pages) => void;
}

export default function Homepage(props: HomepageProps) {
  const [isFetching, setIsFetching] = useState(false);
  const [scores, setScores] = useState<IScore[]>([]);

  useEffect(() => {
    setIsFetching(true);
    getScores(10).then((scores) => {
      setScores(scores);
      setIsFetching(false);
    });
  }, []);

  return (
    <div className={styles.homepageContainer}>
      <button onClick={() => props.setPage(Pages.SANDBOX)}>Play</button>
      <div className={styles.scoresContainer}>
        {scores.map((score, index) => (
          <RankedTower
            key={score._id}
            rank={index + 1}
            height={score.score}
            screenName={score.playerName}
            date={new Date(score.timestamp)}
            letterData={score.letters}
          />
        ))}
      </div>
    </div>
  );
}
