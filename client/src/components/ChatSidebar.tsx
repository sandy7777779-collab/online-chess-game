"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSocket } from "./SocketProvider";
import { X, Send, MessageSquare } from "lucide-react";

interface ChatMessage {
  fromId: string;
  fromName: string;
  message: string;
  timestamp: number;
  type: "room" | "dm";
}

export default function ChatSidebar({ currentRoom }: { currentRoom: string }) {
  const { socket, socketId, userName } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatType, setChatType] = useState<"room" | "dm">("room");
  const [targetId, setTargetId] = useState(""); // For DM
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    const handleChat = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on("chat_received", handleChat);
    return () => {
      socket.off("chat_received", handleChat);
    };
  }, [socket]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    const payload = {
      message: input.trim(),
      fromName: userName,
      targetId: chatType === "dm" ? targetId : undefined,
      roomId: chatType === "room" ? currentRoom : undefined,
    };

    // Optimistically add to UI
    setMessages((prev) => [
      ...prev,
      {
        fromId: socketId || "me",
        fromName: userName,
        message: input.trim(),
        timestamp: Date.now(),
        type: chatType,
      },
    ]);

    socket.emit("chat_message", payload);
    setInput("");
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-blue-600 text-white rounded-full shadow-2xl hover:bg-blue-700 transition-transform hover:scale-105 z-40"
      >
        <MessageSquare size={24} />
      </button>

      {/* Sliding Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-80 glass-panel shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex justify-between items-center p-4 border-b border-[var(--panel-border)] bg-[var(--panel-bg)]">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <MessageSquare size={18} /> Chat
          </h3>
          <button onClick={() => setIsOpen(false)} className="hover:opacity-70 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex p-2 gap-2 border-b border-[var(--panel-border)] bg-background/50">
          <button
            onClick={() => setChatType("room")}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md ${
              chatType === "room" ? "bg-blue-600 text-white" : "bg-transparent hover:bg-[var(--panel-border)]"
            }`}
          >
            Room
          </button>
          <button
            onClick={() => setChatType("dm")}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md ${
              chatType === "dm" ? "bg-blue-600 text-white" : "bg-transparent hover:bg-[var(--panel-border)]"
            }`}
          >
            Direct
          </button>
        </div>

        {chatType === "dm" && (
          <div className="p-3 bg-[var(--panel-bg)] border-b border-[var(--panel-border)]">
            <input
              type="text"
              placeholder="Friend's Connection ID..."
              className="w-full px-3 py-2 text-sm rounded border border-[var(--panel-border)] bg-background"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            />
          </div>
        )}

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages
            .filter((m) => m.type === chatType)
            .map((msg, idx) => {
              const isMe = msg.fromId === socketId;
              return (
                <div key={idx} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <span className="text-xs opacity-60 mb-1 px-1">{isMe ? "You" : msg.fromName}</span>
                  <div
                    className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm ${
                      isMe ? "bg-blue-600 text-white rounded-br-none" : "bg-[var(--panel-border)] text-foreground rounded-bl-none"
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              );
            })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={sendMessage} className="p-3 border-t border-[var(--panel-border)] bg-[var(--panel-bg)] flex gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 rounded-full border border-[var(--panel-border)] bg-background text-sm focus:outline-none focus:border-blue-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={chatType === "dm" && !targetId.trim()}
            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
        />
      )}
    </>
  );
}
