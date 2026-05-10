"use client";

import React, { useState, useEffect } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useSocket } from "./SocketProvider";
import { Copy, Check, Users, Play, Monitor } from "lucide-react";

type GameMode = "none" | "practice" | "online";

export default function ChessGame({ onRoomJoin }: { onRoomJoin?: (id: string) => void }) {
  const { socket, isConnected } = useSocket();
  const [game, setGame] = useState(new Chess());
  const [roomId, setRoomId] = useState("");
  const [mode, setMode] = useState<GameMode>("none");
  const [playerColor, setPlayerColor] = useState<"w" | "b" | "spectator">("w");
  const [gameStarted, setGameStarted] = useState(false);
  const [status, setStatus] = useState("Choose a mode to start playing!");
  const [copied, setCopied] = useState(false);

  // Click-to-move state
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [highlightSquares, setHighlightSquares] = useState<Record<string, React.CSSProperties>>({});

  // Generate room ID from URL or random
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

  // Socket listeners for online mode
  useEffect(() => {
    if (!socket) return;

    const onGameState = (data: { color: "w" | "b" | "spectator" }) => {
      setPlayerColor(data.color);
      if (data.color === "spectator") {
        setStatus("Room is full. You are spectating.");
      } else {
        setStatus(`You are ${data.color === "w" ? "⬜ White" : "⬛ Black"}. Waiting for opponent...`);
      }
    };

    const onGameStart = () => {
      setGameStarted(true);
      setStatus("🟢 Game started! Tap a piece to see its moves.");
    };

    const onMoveReceived = (move: any) => {
      setGame((g) => {
        const copy = new Chess(g.fen());
        try {
          copy.move(move);
          return copy;
        } catch {
          return g;
        }
      });
      clearHighlights();
    };

    socket.on("game_state", onGameState);
    socket.on("game_start", onGameStart);
    socket.on("move_received", onMoveReceived);

    return () => {
      socket.off("game_state", onGameState);
      socket.off("game_start", onGameStart);
      socket.off("move_received", onMoveReceived);
    };
  }, [socket]);

  // Update status text whenever the board changes
  useEffect(() => {
    if (mode === "practice") {
      if (game.isGameOver()) {
        if (game.isCheckmate()) {
          const winner = game.turn() === "w" ? "Black" : "White";
          setStatus(`🏆 Checkmate! ${winner} wins!`);
        } else if (game.isDraw()) setStatus("🤝 Draw!");
        else if (game.isStalemate()) setStatus("🤝 Stalemate!");
      } else {
        const turn = game.turn() === "w" ? "White" : "Black";
        setStatus(`🟢 ${turn}'s turn — tap a ${turn.toLowerCase()} piece`);
      }
      return;
    }

    if (!gameStarted || mode !== "online") return;

    if (game.isGameOver()) {
      if (game.isCheckmate()) {
        const winner = game.turn() === "w" ? "Black" : "White";
        setStatus(`🏆 Checkmate! ${winner} wins!`);
      } else if (game.isDraw()) setStatus("🤝 Draw!");
      else if (game.isStalemate()) setStatus("🤝 Stalemate!");
    } else {
      const isMyTurn = game.turn() === playerColor;
      const turnLabel = game.turn() === "w" ? "White" : "Black";
      setStatus(isMyTurn ? `🟢 Your turn (${turnLabel}). Tap a piece!` : `⏳ Waiting for ${turnLabel} to move...`);
    }
  }, [game, gameStarted, playerColor, mode]);

  // Save result on game over
  useEffect(() => {
    if (game.isGameOver() && mode === "online" && playerColor !== "spectator") {
      const storedMatches = localStorage.getItem("chess_matches");
      const matches = storedMatches ? JSON.parse(storedMatches) : [];
      let result = "draw";
      if (game.isCheckmate()) {
        result = game.turn() === playerColor ? "loss" : "win";
      }
      localStorage.setItem(
        "chess_matches",
        JSON.stringify([...matches, { opponentId: roomId, result, date: Date.now() }])
      );
    }
  }, [game, mode, roomId, playerColor]);

  // ───── helpers ─────

  function clearHighlights() {
    setSelectedSquare(null);
    setHighlightSquares({});
  }

  function buildHighlights(square: string) {
    const moves = game.moves({ square: square as Square, verbose: true });
    if (moves.length === 0) return {};

    const styles: Record<string, React.CSSProperties> = {};
    styles[square] = { background: "rgba(255, 255, 0, 0.45)" };

    for (const m of moves) {
      const targetPiece = game.get(m.to as Square);
      const sourcePiece = game.get(square as Square);
      const isCapture = targetPiece && sourcePiece && targetPiece.color !== sourcePiece.color;

      styles[m.to] = {
        background: isCapture
          ? "radial-gradient(circle, rgba(255,50,50,0.55) 80%, transparent 80%)"
          : "radial-gradient(circle, rgba(0,0,0,0.22) 22%, transparent 22%)",
        borderRadius: "50%",
      };
    }
    return styles;
  }

  // Can the current user interact with the board?
  function canInteract(): boolean {
    if (game.isGameOver()) return false;
    if (mode === "practice") return true;
    if (mode === "online" && gameStarted && game.turn() === playerColor && playerColor !== "spectator") return true;
    return false;
  }

  // Does the piece on this square belong to the current player?
  function isOwnPiece(square: string): boolean {
    const piece = game.get(square as Square);
    if (!piece) return false;
    if (mode === "practice") return piece.color === game.turn();
    return piece.color === playerColor;
  }

  // ───── click handler ─────

  function handleSquareClick(square: string) {
    if (!canInteract()) return;

    // If a piece is already selected, try to move there
    if (selectedSquare && selectedSquare !== square) {
      const copy = new Chess(game.fen());
      try {
        const move = copy.move({ from: selectedSquare, to: square, promotion: "q" });
        if (move) {
          setGame(copy);
          clearHighlights();
          if (mode === "online" && socket) socket.emit("move", { roomId, move });
          return;
        }
      } catch {
        // Not a valid move — fall through to re-select
      }
    }

    // Select a new piece
    if (isOwnPiece(square)) {
      setSelectedSquare(square);
      setHighlightSquares(buildHighlights(square));
    } else {
      clearHighlights();
    }
  }

  // ───── actions ─────

  function startPractice() {
    setMode("practice");
    setPlayerColor("w");
    setGame(new Chess());
    clearHighlights();
    setStatus("🟢 White's turn — tap a white piece");
  }

  function joinOnline() {
    if (socket && roomId) {
      setMode("online");
      socket.emit("join_game", { roomId });
      if (onRoomJoin) onRoomJoin(roomId);
    }
  }

  function resetGame() {
    setGame(new Chess());
    clearHighlights();
    if (mode === "practice") {
      setStatus("🟢 White's turn — tap a white piece");
    }
  }

  const copyInviteLink = () => {
    if (typeof window === "undefined") return;
    const link = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ───── render ─────

  return (
    <div className="flex flex-col items-center gap-5 p-4 w-full max-w-2xl mx-auto">

      {/* ── Mode Selector (shown before joining) ── */}
      {mode === "none" && (
        <div className="glass-panel p-6 w-full flex flex-col items-center gap-5">
          <h2 className="text-2xl font-bold">♟️ Ready to Play?</h2>
          <p className="text-sm opacity-70 text-center max-w-md">
            Choose <strong>Practice</strong> to play on this device (both sides), or{" "}
            <strong>Play Online</strong> to challenge a friend in real-time.
          </p>
          <div className="flex gap-3 w-full max-w-sm">
            <button
              onClick={startPractice}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors"
            >
              <Monitor size={18} /> Practice
            </button>
            <button
              onClick={joinOnline}
              disabled={!isConnected}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              <Play size={18} /> Play Online
            </button>
          </div>
          {!isConnected && (
            <p className="text-xs text-yellow-400">⚠️ Connecting to server… Online play will be available once connected.</p>
          )}
        </div>
      )}

      {/* ── Status Bar (shown after joining) ── */}
      {mode !== "none" && (
        <div className="glass-panel p-5 w-full flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users size={20} />
              {mode === "practice" ? "Practice Mode" : "Live Match"}
            </h2>
            <p
              className={`text-sm mt-1 font-semibold ${
                game.isGameOver()
                  ? "text-orange-400"
                  : canInteract()
                  ? "text-green-400"
                  : "text-yellow-400"
              }`}
            >
              {status}
            </p>
          </div>

          {mode === "practice" && (
            <button
              onClick={resetGame}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-md transition-colors"
            >
              New Game
            </button>
          )}

          {mode === "online" && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wider opacity-60">
                  Room: {roomId}
                </span>
                <button
                  onClick={copyInviteLink}
                  className="flex items-center gap-1 px-2 py-1 bg-[var(--panel-border)] hover:opacity-80 rounded text-xs font-semibold"
                >
                  {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                  {copied ? "Copied" : "Invite Link"}
                </button>
              </div>
              {playerColor !== "spectator" && (
                <span
                  className={`text-xs px-3 py-1 rounded-full font-bold shadow-sm ${
                    playerColor === "w"
                      ? "bg-white text-black border border-gray-300"
                      : "bg-gray-900 text-white border border-gray-600"
                  }`}
                >
                  Playing as {playerColor === "w" ? "⬜ White" : "⬛ Black"}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Board ── */}
      {mode !== "none" && (
        <div className="w-full aspect-square rounded-lg overflow-hidden shadow-2xl bg-[var(--panel-border)] relative">
          {/* @ts-ignore */}
          <Chessboard
            position={game.fen()}
            onSquareClick={handleSquareClick}
            customSquareStyles={highlightSquares}
            boardOrientation={mode === "online" && playerColor === "b" ? "black" : "white"}
            customDarkSquareStyle={{ backgroundColor: "var(--board-dark)" }}
            customLightSquareStyle={{ backgroundColor: "var(--board-light)" }}
            arePiecesDraggable={false}
          />

          {/* Overlay: waiting for opponent (online only) */}
          {mode === "online" && !gameStarted && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="glass-panel p-6 flex flex-col items-center shadow-2xl max-w-xs">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4" />
                <p className="font-bold text-lg text-center">Waiting for opponent…</p>
                <p className="text-sm opacity-70 mt-2 text-center">
                  Copy the <strong>Invite Link</strong> above and send it to your friend. The game
                  starts when they open it.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── How-to-play hint ── */}
      {mode !== "none" && !game.isGameOver() && (
        <div className="glass-panel p-4 w-full text-sm opacity-80 flex items-start gap-3">
          <span className="text-lg">💡</span>
          <div>
            <p className="font-semibold mb-1">How to play</p>
            <p>
              <strong>Tap</strong> one of your pieces — dots will appear on every square it can move
              to. Then <strong>tap</strong> a dot to make the move. Red circles mean you can capture
              an opponent's piece there.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
