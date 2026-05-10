"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useSocket } from "./SocketProvider";
import { Copy, Check, Users } from "lucide-react";

export default function ChessGame({ onRoomJoin }: { onRoomJoin?: (id: string) => void }) {
  const { socket, isConnected } = useSocket();
  const [game, setGame] = useState(new Chess());
  const [roomId, setRoomId] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [playerColor, setPlayerColor] = useState<"w" | "b" | "spectator">("spectator");
  const [gameStarted, setGameStarted] = useState(false);
  const [status, setStatus] = useState("Waiting to join a room...");
  const [copied, setCopied] = useState(false);
  
  // Highlighting and clicking state
  const [moveSquares, setMoveSquares] = useState<{ [square: string]: React.CSSProperties }>({});
  const [optionSquares, setOptionSquares] = useState<{ [square: string]: React.CSSProperties }>({});
  const [sourceSquare, setSourceSquare] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get("room");
      if (roomParam) {
        setRoomId(roomParam);
      } else {
        setRoomId(Math.random().toString(36).substring(2, 8));
      }
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on("game_state", (data: { color: "w" | "b" | "spectator" }) => {
      setPlayerColor(data.color);
      if (data.color === "spectator") {
        setStatus("You are spectating.");
      } else {
        setStatus(`You joined as ${data.color === 'w' ? 'White' : 'Black'}. Waiting for opponent...`);
      }
    });

    socket.on("game_start", (data) => {
      setGameStarted(true);
      setStatus("Game started! White to move.");
    });

    socket.on("move_received", (move) => {
      setGame((g) => {
        const gameCopy = new Chess(g.fen());
        try {
          gameCopy.move(move);
          return gameCopy;
        } catch (e) {
          return g;
        }
      });
      setMoveSquares({});
      setOptionSquares({});
    });

    return () => {
      socket.off("game_state");
      socket.off("game_start");
      socket.off("move_received");
    };
  }, [socket]);

  // Update status when game changes
  useEffect(() => {
    if (gameStarted) {
      if (game.isGameOver()) {
        if (game.isCheckmate()) setStatus("Checkmate! Game Over.");
        else if (game.isDraw()) setStatus("Draw!");
        else setStatus("Game Over");
      } else {
        const turn = game.turn() === "w" ? "White" : "Black";
        setStatus(`${turn}'s turn`);
      }
    }
  }, [game, gameStarted]);

  // Save game result to local storage when game ends
  useEffect(() => {
    if (game.isGameOver() && inRoom && playerColor !== "spectator") {
      const storedMatches = localStorage.getItem("chess_matches");
      const matches = storedMatches ? JSON.parse(storedMatches) : [];
      
      let result = "draw";
      if (game.isCheckmate()) {
        result = game.turn() === playerColor ? "loss" : "win";
      }

      const newMatch = {
        opponentId: roomId,
        result,
        date: Date.now()
      };

      // Simple deduplication based on history count, better to use fen or game ids
      localStorage.setItem("chess_matches", JSON.stringify([...matches, newMatch]));
    }
  }, [game, inRoom, roomId, playerColor]);

  const joinRoom = () => {
    if (socket && roomId) {
      socket.emit("join_game", { roomId });
      setInRoom(true);
      if (onRoomJoin) onRoomJoin(roomId);
    }
  };

  const copyInviteLink = () => {
    if (typeof window !== "undefined") {
      const link = `${window.location.origin}?room=${roomId}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  function getMoveOptions(square: string) {
    const moves = game.moves({
      square,
      verbose: true,
    });
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares: { [square: string]: React.CSSProperties } = {};
    moves.map((move) => {
      newSquares[move.to] = {
        background:
          game.get(move.to as any) && game.get(move.to as any)?.color !== game.get(square as any)?.color
            ? "radial-gradient(circle, rgba(255,0,0,0.5) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,0.2) 25%, transparent 25%)",
        borderRadius: "50%",
      };
      return move;
    });
    newSquares[square] = {
      background: "rgba(255, 255, 0, 0.4)",
    };
    setOptionSquares(newSquares);
    return true;
  }

  const onSquareClick = (square: string) => {
    if (!gameStarted || game.turn() !== playerColor || playerColor === "spectator") return;

    // If a piece is already selected, try to move it to the clicked square
    if (sourceSquare && square !== sourceSquare) {
      const gameCopy = new Chess(game.fen());
      try {
        const move = gameCopy.move({
          from: sourceSquare,
          to: square,
          promotion: "q",
        });
        if (move) {
          setGame(gameCopy);
          setSourceSquare("");
          setOptionSquares({});
          setMoveSquares({});
          if (socket && inRoom) socket.emit("move", { roomId, move });
          return;
        }
      } catch (e) {
        // Invalid move, flow continues to select the new piece if it belongs to the player
      }
    }

    // Otherwise, select the piece (if it's theirs)
    const piece = game.get(square as any);
    if (piece && piece.color === playerColor) {
      setSourceSquare(square);
      const hasOptions = getMoveOptions(square);
      if (hasOptions) setMoveSquares({ [square]: { backgroundColor: "rgba(255, 255, 0, 0.4)" } });
    } else {
      setSourceSquare("");
      setOptionSquares({});
      setMoveSquares({});
    }
  };

  const onDrop = useCallback(
    (source: string, target: string, piece: string) => {
      if (!gameStarted || game.turn() !== playerColor || playerColor === "spectator") return false;

      const gameCopy = new Chess(game.fen());
      try {
        const move = gameCopy.move({
          from: source,
          to: target,
          promotion: piece[1]?.toLowerCase() ?? "q",
        });

        if (move === null) return false;

        setGame(gameCopy);
        setSourceSquare("");
        setMoveSquares({});
        setOptionSquares({});
        
        if (socket && inRoom) {
          socket.emit("move", { roomId, move });
        }
        
        return true;
      } catch (e) {
        return false;
      }
    },
    [game, gameStarted, playerColor, inRoom, roomId, socket]
  );

  return (
    <div className="flex flex-col items-center gap-6 p-4 w-full max-w-2xl mx-auto">
      <div className="glass-panel p-5 w-full flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users size={20} /> Match Status
          </h2>
          <p className={`text-sm mt-1 font-medium ${gameStarted ? 'text-green-500' : 'opacity-70'}`}>
            {status}
          </p>
        </div>

        {!inRoom ? (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter Room ID"
              className="px-3 py-1.5 w-28 rounded-md border border-[var(--panel-border)] bg-background text-foreground text-sm"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
            <button
              onClick={joinRoom}
              disabled={!isConnected}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-50"
            >
              Join Room
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider opacity-60">Room: {roomId}</span>
              <button
                onClick={copyInviteLink}
                className="flex items-center gap-1 px-2 py-1 bg-[var(--panel-border)] hover:opacity-80 rounded text-xs font-semibold"
              >
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy Link"}
              </button>
            </div>
            {playerColor !== "spectator" && (
              <span className={`text-xs px-3 py-1 rounded-full font-bold shadow-sm ${playerColor === 'w' ? 'bg-white text-black border border-gray-300' : 'bg-black text-white border border-gray-700'}`}>
                Playing as {playerColor === 'w' ? 'White' : 'Black'}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="w-full aspect-square rounded-lg overflow-hidden shadow-2xl bg-[var(--panel-border)] relative">
        {/* @ts-ignore */}
        <Chessboard
          position={game.fen()}
          onPieceDrop={onDrop}
          onSquareClick={onSquareClick}
          customSquareStyles={{ ...moveSquares, ...optionSquares }}
          boardOrientation={playerColor === "b" ? "black" : "white"}
          customDarkSquareStyle={{ backgroundColor: "var(--board-dark)" }}
          customLightSquareStyle={{ backgroundColor: "var(--board-light)" }}
        />
        {!gameStarted && inRoom && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="glass-panel p-6 flex flex-col items-center shadow-2xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="font-bold text-lg">Waiting for opponent...</p>
              <p className="text-sm opacity-70 mt-2">Send the invite link to start.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
