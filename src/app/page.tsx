"use client";

import { useState } from "react";
import Game from "./components/Game";
import Homepage from "./components/Homepage";
import { Pages } from "./logic/interfaces";

export default function App() {
  const [page, setPage] = useState(Pages.HOMEPAGE);
  return (
    <>
      {page === Pages.HOMEPAGE && <Homepage setPage={setPage} />}
      {page === Pages.SANDBOX && <Game setPage={setPage} />}
    </>
  );
}
