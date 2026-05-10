"use client";

import React, { useState, useEffect } from "react";
import ChessGame from "../components/ChessGame";
import FriendDashboard from "../components/FriendDashboard";

export default function Home() {
  const [theme, setTheme] = useState("default");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="min-h-screen p-8 pb-20 sm:p-12 font-[family-name:var(--font-geist-sans)] transition-colors duration-300">
      <header className="max-w-4xl mx-auto w-full flex justify-between items-center mb-8 glass-panel p-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Chess.Online</h1>
        
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Theme:</label>
          <select 
            className="p-2 rounded border border-[var(--panel-border)] bg-background text-foreground cursor-pointer"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="default">Classic Wood</option>
            <option value="dark">Forest Dark</option>
            <option value="neon">Cyber Neon</option>
          </select>
        </div>
      </header>

      <main className="flex flex-col md:flex-row items-start justify-center gap-8 w-full max-w-6xl mx-auto">
        <FriendDashboard onChallenge={(id) => console.log("Challenge", id)} />
        <div className="flex-1 w-full">
          <ChessGame />
        </div>
      </main>
      
      <footer className="max-w-4xl mx-auto w-full text-center mt-12 text-sm opacity-60">
        Chess Game Implementation. Real-time gameplay & Local Storage features.
      </footer>
    </div>
  );
}
