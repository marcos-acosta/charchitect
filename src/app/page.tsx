"use client";

import { useState, useEffect } from "react";
import Game from "./components/Game";
import Homepage from "./components/Homepage";
import { Pages } from "./logic/interfaces";

export default function App() {
  const [page, setPage] = useState<Pages>(Pages.HOMEPAGE);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const savedPage = localStorage.getItem("currentPage") as Pages;
    if (Object.values(Pages).includes(savedPage)) {
      setPage(savedPage);
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem("currentPage", page);
    }
  }, [page, isClient]);

  if (!isClient) {
    return null; // or a loading state if you prefer
  }

  return (
    <>
      {page === Pages.HOMEPAGE && <Homepage setPage={setPage} />}
      {page === Pages.SANDBOX && <Game setPage={setPage} />}
    </>
  );
}
