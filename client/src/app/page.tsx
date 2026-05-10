"use client";

import React, { useState, useEffect } from "react";
import ChessGame from "../components/ChessGame";
import FriendDashboard from "../components/FriendDashboard";
import ChatSidebar from "../components/ChatSidebar";
import { useSocket } from "../components/SocketProvider";
import { Copy, Check, Edit2, User } from "lucide-react";

export default function Home() {
  const [theme, setTheme] = useState("default");
  const { socketId, userName, setUserName } = useSocket();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState("");
  const [currentRoom, setCurrentRoom] = useState("");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const copyId = () => {
    if (socketId) {
      navigator.clipboard.writeText(socketId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const saveName = () => {
    if (tempName.trim()) {
      setUserName(tempName.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen p-4 sm:p-8 pb-20 font-[family-name:var(--font-geist-sans)] transition-colors duration-300">
      <header className="max-w-6xl mx-auto w-full flex flex-col md:flex-row justify-between items-center mb-8 glass-panel p-4 gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Chess.Online</h1>
        
        {/* Profile Section */}
        <div className="flex-1 flex justify-center">
          <div className="bg-background/50 border border-[var(--panel-border)] rounded-lg p-3 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2">
              <User size={18} className="opacity-70" />
              {isEditing ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="px-2 py-1 bg-background border border-[var(--panel-border)] rounded text-sm w-32"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="Enter name"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  />
                  <button onClick={saveName} className="text-green-500 hover:opacity-80"><Check size={16}/></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{userName}</span>
                  <button onClick={() => { setTempName(userName); setIsEditing(true); }} className="opacity-50 hover:opacity-100">
                    <Edit2 size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="h-6 w-px bg-[var(--panel-border)] hidden sm:block"></div>

            <div className="flex items-center gap-2 text-sm">
              <span className="opacity-70">Connection ID:</span>
              <span className="font-mono bg-[var(--panel-border)] px-2 py-1 rounded text-xs">
                {socketId ? socketId.substring(0, 8) + "..." : "Connecting..."}
              </span>
              <button 
                onClick={copyId} 
                disabled={!socketId}
                className="hover:opacity-70 p-1"
                title="Copy full Connection ID"
              >
                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium opacity-70">Theme</label>
          <select 
            className="p-2 rounded border border-[var(--panel-border)] bg-background text-foreground cursor-pointer text-sm"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="default">Classic Wood</option>
            <option value="dark">Forest Dark</option>
            <option value="neon">Cyber Neon</option>
          </select>
        </div>
      </header>

      <main className="flex flex-col lg:flex-row items-start justify-center gap-8 w-full max-w-7xl mx-auto">
        <div className="w-full lg:w-[350px]">
          <FriendDashboard onChallenge={(id) => console.log("Challenge", id)} />
        </div>
        <div className="flex-1 w-full flex justify-center">
          <ChessGame onRoomJoin={(id) => setCurrentRoom(id)} />
        </div>
      </main>
      
      <ChatSidebar currentRoom={currentRoom} />
      
      <footer className="max-w-4xl mx-auto w-full text-center mt-12 text-sm opacity-60">
        Chess Game Implementation. Real-time gameplay & Local Storage features.
      </footer>
    </div>
  );
}
