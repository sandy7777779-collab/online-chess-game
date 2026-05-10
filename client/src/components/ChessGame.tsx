"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useSocket } from "./SocketProvider";
import { Copy, Check, Users, Play, Monitor, Move } from "lucide-react";

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
  const [hasRoomParam, setHasRoomParam] = useState(false);
  const autoJoinedRef = useRef(false);

  // Highlight/selection state
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [highlightSquares, setHighlightSquares] = useState<Record<string, React.CSSProperties>>({});

  // Read room from URL on first load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get("room");
      if (roomParam) {
        setRoomId(roomParam);
        setHasRoomParam(true);
      } else {
        setRoomId(Math.random().toString(36).substring(2, 8));
      }
    }
  }, []);

  // Auto-join if opened via invite link (?room=xxx) once socket connects
  useEffect(() => {
    if (hasRoomParam && isConnected && socket && !autoJoinedRef.current && mode === "none") {
      autoJoinedRef.current = true;
      setMode("online");
      socket.emit("join_game", { roomId });
      if (onRoomJoin) onRoomJoin(roomId);
      setStatus("Joining room from invite link...");
    }
  }, [hasRoomParam, isConnected, socket, roomId, mode, onRoomJoin]);

  // Socket listeners for online mode
  useEffect(() => {
    if (!socket) return;

    const onGameState = (data: { color: "w" | "b" | "spectator" }) => {
      setPlayerColor(data.color);
      if (data.color === "spectator") {
        setStatus("Room is full. You are spectating.");
      } else {
        setStatus(`You joined as ${data.color === "w" ? "White" : "Black"}. Waiting for opponent...`);
      }
    };

    const onGameStart = () => {
      setGameStarted(true);
      setStatus("Game started! White to move.");
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
        setStatus(`🟢 ${turn}'s turn — tap or drag a ${turn.toLowerCase()} piece`);
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
      setStatus(isMyTurn ? `🟢 Your turn (${turnLabel}). Tap or drag!` : `⏳ Waiting for ${turnLabel} to move...`);
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

  // ───── Logic Helpers ─────

  function clearHighlights() {
    setSelectedSquare(null);
    setHighlightSquares({});
  }

  function buildHighlights(square: string) {
    const moves = game.moves({ square: square as Square, verbose: true });
    const styles: Record<string, React.CSSProperties> = {};
    styles[square] = { background: "rgba(255, 255, 0, 0.45)" }; // selected

    for (const m of moves) {
      const targetPiece = game.get(m.to as Square);
      const sourcePiece = game.get(square as Square);
      const isCapture = targetPiece && sourcePiece && targetPiece.color !== sourcePiece.color;

      styles[m.to] = {
        background: isCapture
          ? "radial-gradient(circle, rgba(255,50,50,0.6) 80%, transparent 80%)"
          : "radial-gradient(circle, rgba(0,0,0,0.25) 22%, transparent 22%)",
        borderRadius: "50%",
      };
    }
    return styles;
  }

  const canInteract = useCallback((): boolean => {
    if (game.isGameOver()) return false;
    if (mode === "practice") return true;
    if (mode === "online" && gameStarted && game.turn() === playerColor && playerColor !== "spectator") return true;
    return false;
  }, [game, mode, gameStarted, playerColor]);

  const isOwnPiece = useCallback((square: string): boolean => {
    const piece = game.get(square as Square);
    if (!piece) return false;
    if (mode === "practice") return piece.color === game.turn();
    return piece.color === playerColor;
  }, [game, mode, playerColor]);

  // ───── Core Move Execution Logic ─────
  const makeMove = useCallback((source: string, target: string): boolean => {
    if (!canInteract()) return false;

    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({
        from: source,
        to: target,
        promotion: "q", // automatically promote to queen for simplicity
      });

      if (move) {
        setGame(gameCopy);
        clearHighlights();
        if (mode === "online" && socket) {
          socket.emit("move", { roomId, move });
        }
        return true;
      }
    } catch (err) {
      // Not a legal move
    }
    return false;
  }, [game, canInteract, mode, socket, roomId]);

  // ───── Event Handlers ─────

  // Handler for Tap-to-move
  function handleSquareClick(square: string) {
    if (!canInteract()) return;

    // If a square is already selected and we click a DIFFERENT square, try to move there
    if (selectedSquare && selectedSquare !== square) {
      const success = makeMove(selectedSquare, square);
      if (success) return;
      // If move failed but clicked on another piece of our own color, select that one instead.
    }

    // Select new piece
    if (isOwnPiece(square)) {
      setSelectedSquare(square);
      setHighlightSquares(buildHighlights(square));
    } else {
      clearHighlights();
    }
  }

  // Handler for Drag-and-Drop
  function handlePieceDrop(sourceSquare: string, targetSquare: string): boolean {
    if (!canInteract()) return false;
    
    // Ensure they are dragging their own piece
    if (!isOwnPiece(sourceSquare)) return false;

    return makeMove(sourceSquare, targetSquare);
  }

  // ───── Action Handlers ─────

  function startPractice() {
    setMode("practice");
    setPlayerColor("w");
    setGame(new Chess());
    clearHighlights();
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
  }

  const copyInviteLink = () => {
    if (typeof window === "undefined") return;
    const link = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ───── Render ─────

  return (
    <div className="flex flex-col items-center gap-5 p-4 w-full max-w-2xl mx-auto">

      {/* ── Mode Selector Screen ── */}
      {mode === "none" && (
        <div className="glass-panel p-6 w-full flex flex-col items-center gap-5 animate-in fade-in duration-300">
          <h2 className="text-2xl font-bold tracking-tight text-center">♟️ Welcome to Chess</h2>
          <p className="text-sm opacity-75 text-center max-w-md">
            Challenge a friend in a <strong>Live Match</strong> or sharpen your skills in <strong>Practice Mode</strong>.
          </p>

          <div className="w-full max-w-sm space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide opacity-60 px-1">Match Room Code</label>
              <input
                type="text"
                placeholder="Enter custom code or leave as is"
                className="w-full px-4 py-3 rounded-lg border border-[var(--panel-border)] bg-background text-foreground text-lg text-center font-mono shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={startPractice}
                className="flex-1 flex flex-col items-center justify-center gap-2 px-4 py-5 bg-background/50 hover:bg-emerald-600/10 border border-emerald-600/20 hover:border-emerald-500/50 rounded-xl transition-all group"
              >
                <Monitor size={24} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-emerald-500 text-sm">Practice</span>
              </button>
              <button
                onClick={joinOnline}
                disabled={!isConnected}
                className="flex-1 flex flex-col items-center justify-center gap-2 px-4 py-5 bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/20 rounded-xl transition-all shadow-lg shadow-blue-600/20 group disabled:opacity-50 disabled:pointer-events-none"
              >
                <Play size={24} className="group-hover:translate-x-0.5 transition-transform" />
                <span className="font-semibold text-sm">Play Online</span>
              </button>
            </div>
          </div>

          {!isConnected && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-2.5 text-xs text-yellow-300 max-w-sm">
              <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 mt-1 animate-pulse flex-shrink-0" />
              <span>Connecting to backend server... You can start <strong>Practice Mode</strong> immediately while we connect.</span>
            </div>
          )}
        </div>
      )}

      {/* ── Game UI Header ── */}
      {mode !== "none" && (
        <div className="glass-panel p-4 w-full flex flex-col md:flex-row justify-between items-center gap-4 border-b-2 border-blue-500/10">
          <div className="flex-1">
            <h2 className="text-sm font-bold uppercase tracking-wider opacity-50 flex items-center gap-1.5 mb-1">
              {mode === "practice" ? <Monitor size={14} /> : <Users size={14} />}
              {mode === "practice" ? "Practice Mode" : "Live Match"}
            </h2>
            <p className={`text-base font-bold flex items-center gap-2 ${
              game.isGameOver() ? "text-orange-400" : canInteract() ? "text-green-400" : "text-foreground"
            }`}>
              {status}
            </p>
          </div>

          {mode === "practice" && (
            <button
              onClick={resetGame}
              className="px-4 py-2 bg-secondary hover:bg-secondary/80 border border-[var(--panel-border)] text-foreground text-sm font-semibold rounded-lg transition-colors"
            >
              Reset Board
            </button>
          )}

          {mode === "online" && (
            <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono opacity-70 px-2 py-1 bg-background/50 rounded">Room: {roomId}</span>
                <button
                  onClick={copyInviteLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied!" : "Invite Friend"}
                </button>
              </div>
              {playerColor !== "spectator" && (
                <span className={`text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-sm border ${
                  playerColor === "w" ? "bg-white text-black border-gray-200" : "bg-neutral-900 text-white border-neutral-700"
                }`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${playerColor === "w" ? "bg-neutral-200" : "bg-neutral-700"} border border-current`} />
                  Playing as {playerColor === "w" ? "White" : "Black"}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Main Chess Board ── */}
      {mode !== "none" && (
        <div className="w-full aspect-square rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-[var(--panel-border)] relative bg-neutral-800">
          {/* @ts-ignore */}
          <Chessboard
            position={game.fen()}
            onSquareClick={handleSquareClick}
            onPieceDrop={handlePieceDrop}
            customSquareStyles={highlightSquares}
            boardOrientation={mode === "online" && playerColor === "b" ? "black" : "white"}
            customDarkSquareStyle={{ backgroundColor: "var(--board-dark)" }}
            customLightSquareStyle={{ backgroundColor: "var(--board-light)" }}
            arePiecesDraggable={true}
            animationDuration={250}
          />

          {/* Waiting Overlay */}
          {mode === "online" && !gameStarted && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-20">
              <div className="glass-panel p-7 flex flex-col items-center shadow-2xl max-w-xs text-center border-blue-500/30">
                <div className="relative mb-5">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur animate-pulse opacity-75"></div>
                  <div className="relative bg-background rounded-full p-3">
                     <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
                  </div>
                </div>
                <h3 className="font-bold text-xl mb-2">Waiting for opponent</h3>
                <p className="text-sm opacity-75 mb-5 leading-relaxed">
                  Send the **Invite Link** at the top to your friend. Once they open it, the game will automatically start.
                </p>
                <div className="flex flex-col w-full gap-2">
                   <button onClick={copyInviteLink} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold shadow-lg flex items-center justify-center gap-2">
                     <Copy size={16}/> {copied ? "Copied!" : "Copy Invite Link"}
                   </button>
                   <button
                     onClick={() => { setMode("none"); setGameStarted(false); }}
                     className="text-xs text-foreground/60 hover:text-foreground underline transition-colors py-2"
                   >
                     Go back to main menu
                   </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── How-to-play Hint ── */}
      {mode !== "none" && !game.isGameOver() && (
        <div className="w-full text-xs md:text-sm opacity-75 text-center flex items-center justify-center gap-2 p-2">
          <Move size={16} className="opacity-60" />
          <span>You can either <strong>drag and drop</strong> pieces, OR <strong>tap to select and move</strong>.</span>
        </div>
      )}
    </div>
  );
}
