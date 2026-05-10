"use client";

import React, { useState, useEffect } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useSocket } from "./SocketProvider";
import { Copy, Check, Users, Play } from "lucide-react";

export default function ChessGame({ onRoomJoin }: { onRoomJoin?: (id: string) => void }) {
  const { socket, isConnected } = useSocket();
  const [game, setGame] = useState(new Chess());
  const [roomId, setRoomId] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [playerColor, setPlayerColor] = useState<"w" | "b" | "spectator">("spectator");
  const [gameStarted, setGameStarted] = useState(false);
  const [status, setStatus] = useState("Waiting to join a room...");
  const [copied, setCopied] = useState(false);

  // Click-to-move state
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [highlightSquares, setHighlightSquares] = useState<Record<string, React.CSSProperties>>({});

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
    if (!gameStarted) return;
    if (game.isGameOver()) {
      if (game.isCheckmate()) {
        const winner = game.turn() === "w" ? "Black" : "White";
        setStatus(`🏆 Checkmate! ${winner} wins!`);
      } else if (game.isDraw()) {
        setStatus("🤝 Draw!");
      } else if (game.isStalemate()) {
        setStatus("🤝 Stalemate!");
      }
    } else {
      const isMyTurn = game.turn() === playerColor;
      const turnLabel = game.turn() === "w" ? "White" : "Black";
      if (isMyTurn) {
        setStatus(`🟢 Your turn (${turnLabel}). Tap a piece!`);
      } else {
        setStatus(`⏳ Waiting for ${turnLabel} to move...`);
      }
    }
  }, [game, gameStarted, playerColor]);

  // Save result on game over
  useEffect(() => {
    if (game.isGameOver() && inRoom && playerColor !== "spectator") {
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
  }, [game, inRoom, roomId, playerColor]);

  // ───── helpers ─────

  function clearHighlights() {
    setSelectedSquare(null);
    setHighlightSquares({});
  }

  function buildHighlights(square: string) {
    const moves = game.moves({ square: square as Square, verbose: true });
    if (moves.length === 0) return {};

    const styles: Record<string, React.CSSProperties> = {};

    // Highlight the selected piece
    styles[square] = { background: "rgba(255, 255, 0, 0.45)" };

    // Highlight every target square
    for (const m of moves) {
      const isCapture =
        game.get(m.to as Square) &&
        game.get(m.to as Square)!.color !== game.get(square as Square)!.color;

      styles[m.to] = {
        background: isCapture
          ? "radial-gradient(circle, rgba(255,50,50,0.55) 80%, transparent 80%)"
          : "radial-gradient(circle, rgba(0,0,0,0.22) 22%, transparent 22%)",
        borderRadius: "50%",
      };
    }
    return styles;
  }

  // ───── click handler ─────

  function handleSquareClick(square: string) {
    // Block if game hasn't started, game is over, or not your turn
    if (!gameStarted || game.isGameOver()) return;
    if (game.turn() !== playerColor || playerColor === "spectator") return;

    // ─ If a piece is already selected, attempt to move there ─
    if (selectedSquare && selectedSquare !== square) {
      const copy = new Chess(game.fen());
      try {
        const move = copy.move({ from: selectedSquare, to: square, promotion: "q" });
        if (move) {
          setGame(copy);
          clearHighlights();
          if (socket && inRoom) socket.emit("move", { roomId, move });
          return;
        }
      } catch {
        // Not a valid move to that square – fall through
      }
    }

    // ─ Select a new piece (must be the player's own color) ─
    const piece = game.get(square as Square);
    if (piece && piece.color === playerColor) {
      setSelectedSquare(square);
      setHighlightSquares(buildHighlights(square));
    } else {
      clearHighlights();
    }
  }

  // ───── actions ─────

  const joinRoom = () => {
    if (socket && roomId) {
      socket.emit("join_game", { roomId });
      setInRoom(true);
      if (onRoomJoin) onRoomJoin(roomId);
    }
  };

  const copyInviteLink = () => {
    if (typeof window === "undefined") return;
    const link = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ───── render ─────

  const isMyTurn = gameStarted && game.turn() === playerColor;

  return (
    <div className="flex flex-col items-center gap-5 p-4 w-full max-w-2xl mx-auto">
      {/* ── Status Bar ── */}
      <div className="glass-panel p-5 w-full flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users size={20} /> Match Status
          </h2>
          <p
            className={`text-sm mt-1 font-semibold ${
              game.isGameOver()
                ? "text-orange-400"
                : isMyTurn
                ? "text-green-400"
                : gameStarted
                ? "text-yellow-400"
                : "opacity-70"
            }`}
          >
            {status}
          </p>
        </div>

        {!inRoom ? (
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Room ID"
              className="px-3 py-2 w-28 rounded-md border border-[var(--panel-border)] bg-background text-foreground text-sm"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
            <button
              onClick={joinRoom}
              disabled={!isConnected}
              className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-50"
            >
              <Play size={14} /> Join
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider opacity-60">
                Room: {roomId}
              </span>
              <button
                onClick={copyInviteLink}
                className="flex items-center gap-1 px-2 py-1 bg-[var(--panel-border)] hover:opacity-80 rounded text-xs font-semibold"
              >
                {copied ? (
                  <Check size={12} className="text-green-500" />
                ) : (
                  <Copy size={12} />
                )}
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

      {/* ── Board ── */}
      <div className="w-full aspect-square rounded-lg overflow-hidden shadow-2xl bg-[var(--panel-border)] relative">
        {/* @ts-ignore */}
        <Chessboard
          position={game.fen()}
          onSquareClick={handleSquareClick}
          customSquareStyles={highlightSquares}
          boardOrientation={playerColor === "b" ? "black" : "white"}
          customDarkSquareStyle={{ backgroundColor: "var(--board-dark)" }}
          customLightSquareStyle={{ backgroundColor: "var(--board-light)" }}
          arePiecesDraggable={false}
        />

        {/* Overlay: waiting for opponent */}
        {!gameStarted && inRoom && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="glass-panel p-6 flex flex-col items-center shadow-2xl max-w-xs">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4" />
              <p className="font-bold text-lg text-center">Waiting for opponent…</p>
              <p className="text-sm opacity-70 mt-2 text-center">
                Copy and share the invite link above. The game starts automatically when your friend
                opens it.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── How-to-play hint ── */}
      {gameStarted && !game.isGameOver() && (
        <div className="glass-panel p-4 w-full text-sm opacity-80 flex items-start gap-3">
          <span className="text-lg">💡</span>
          <div>
            <p className="font-semibold mb-1">How to play</p>
            <p>
              <strong>Tap</strong> one of your pieces to see the squares it can move to (shown as
              dots). Then <strong>tap</strong> a highlighted square to make the move. Capturing
              squares are shown in red.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
