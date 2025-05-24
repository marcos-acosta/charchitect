import * as p2 from "p2-es";
import { isLetter } from "./p2-util";
import { ILetterData, LETTERS } from "./interfaces";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3030";

export const submitScore = async (
  name: string,
  height: number,
  world: p2.World,
  lettersInUse: Record<number, LETTERS>
) => {
  const letters = world.bodies.filter((body) => isLetter(body));
  const letterData: ILetterData[] = letters.map((letter) => ({
    letter: lettersInUse[letter.id],
    x: letter.position[0],
    y: letter.position[1],
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
