import * as p2 from "p2-es";
import { ILetterData, IPoint, LETTERS } from "./interfaces";
import axios from "axios";
import { GROUND_THICKNESS_METERS } from "./game-config";
import { isTrialLetter } from "./game-util";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3030";

export const submitScore = async (
  name: string,
  height: number,
  world: p2.World,
  lettersInUse: Record<number, LETTERS>,
  groundCenter: IPoint
) => {
  const groundTopCenter = [
    groundCenter[0],
    groundCenter[1] + GROUND_THICKNESS_METERS / 2,
  ];
  const letters = world.bodies.filter((body) => isTrialLetter(body));
  // Extract core data and normalize by center of ground
  const letterData: ILetterData[] = letters.map((letter) => ({
    letter: lettersInUse[letter.id],
    x: letter.position[0] - groundTopCenter[0],
    y: letter.position[1] - groundTopCenter[1],
    angle: letter.angle,
  }));
  const response = await axios.post(`${API_URL}/api/scores`, {
    playerName: name,
    score: height,
    letters: letterData,
  });
  return response.data;
};

export const getScores = async (topN: number) => {
  const response = await axios.get(`${API_URL}/api/scores`, {
    params: {
      topN,
    },
  });
  return response.data;
};
