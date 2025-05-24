export interface IDimensions {
  width: number;
  height: number;
}

export type IPoint = [number, number];
export type IPoints = IPoint[];
export type IPolygons = IPoints[];

export enum LETTERS {
  A = "A",
  B = "B",
  C = "C",
  D = "D",
  E = "E",
  F = "F",
  G = "G",
  H = "H",
  I = "I",
  J = "J",
  K = "K",
  L = "L",
  M = "M",
  N = "N",
  O = "O",
  P = "P",
  Q = "Q",
  R = "R",
  S = "S",
  T = "T",
  U = "U",
  V = "V",
  W = "W",
  X = "X",
  Y = "Y",
  Z = "Z",
}

export interface ILetterData {
  letter: string;
  x: number;
  y: number;
  angle: number;
}

export interface IScore {
  playerName: string;
  score: number;
  letters: ILetterData[];
  timestamp: string;
  _id: string;
}

export enum Pages {
  HOMEPAGE = "HOMEPAGE",
  SANDBOX = "SANDBOX",
}
