"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  socketId: string | null;
  userName: string;
  setUserName: (name: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  socketId: null,
  userName: "Guest",
  setUserName: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [userName, setUserNameState] = useState("Guest");

  useEffect(() => {
    // Load username from local storage
    const storedName = localStorage.getItem("chess_username");
    if (storedName) {
      setUserNameState(storedName);
    }

    const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsConnected(true);
      setSocketId(newSocket.id || null);
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
      setSocketId(null);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const setUserName = (name: string) => {
    setUserNameState(name);
    localStorage.setItem("chess_username", name);
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, socketId, userName, setUserName }}>
      {children}
    </SocketContext.Provider>
  );
};
