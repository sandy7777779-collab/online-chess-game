"use client";

import React, { useState, useEffect } from "react";
import { UserPlus, User, Swords } from "lucide-react";

interface Friend {
  id: string;
  name: string;
}

interface MatchHistory {
  opponentId: string;
  result: "win" | "loss" | "draw";
  date: number;
}

export default function FriendDashboard({ onChallenge }: { onChallenge: (friendId: string) => void }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [matches, setMatches] = useState<MatchHistory[]>([]);
  const [newFriendId, setNewFriendId] = useState("");
  const [newFriendName, setNewFriendName] = useState("");

  useEffect(() => {
    // Load friends from local storage
    const storedFriends = localStorage.getItem("chess_friends");
    if (storedFriends) {
      setFriends(JSON.parse(storedFriends));
    }
    const storedMatches = localStorage.getItem("chess_matches");
    if (storedMatches) {
      setMatches(JSON.parse(storedMatches));
    }
  }, []);

  const saveFriends = (updatedFriends: Friend[]) => {
    setFriends(updatedFriends);
    localStorage.setItem("chess_friends", JSON.stringify(updatedFriends));
  };

  const addFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendId || !newFriendName) return;

    const newFriend = { id: newFriendId, name: newFriendName };
    if (!friends.find(f => f.id === newFriendId)) {
      saveFriends([...friends, newFriend]);
    }
    setNewFriendId("");
    setNewFriendName("");
  };

  const removeFriend = (id: string) => {
    saveFriends(friends.filter(f => f.id !== id));
  };

  return (
    <div className="glass-panel p-6 w-full max-w-sm flex flex-col gap-4">
      <h3 className="text-xl font-bold flex items-center gap-2">
        <User size={24} /> Friends
      </h3>
      
      <form onSubmit={addFriend} className="flex flex-col gap-2">
        <input 
          className="p-2 text-sm rounded border border-[var(--panel-border)] bg-background text-foreground"
          placeholder="Friend's Name" 
          value={newFriendName}
          onChange={(e) => setNewFriendName(e.target.value)}
        />
        <input 
          className="p-2 text-sm rounded border border-[var(--panel-border)] bg-background text-foreground"
          placeholder="Friend's Connection ID" 
          value={newFriendId}
          onChange={(e) => setNewFriendId(e.target.value)}
        />
        <button type="submit" className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors text-sm font-semibold">
          <UserPlus size={16} /> Add Friend
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-2">
        {friends.length === 0 ? (
          <p className="text-sm opacity-60 text-center py-4">No friends added yet.</p>
        ) : (
          friends.map(friend => {
            const friendMatches = matches.filter(m => m.opponentId === friend.id);
            const wins = friendMatches.filter(m => m.result === "win").length;
            const losses = friendMatches.filter(m => m.result === "loss").length;
            const total = friendMatches.length;
            const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

            return (
              <div key={friend.id} className="flex flex-col gap-2 p-3 rounded bg-[var(--background)] border border-[var(--panel-border)]">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{friend.name}</p>
                    <p className="text-xs opacity-60">ID: {friend.id}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onChallenge(friend.id)}
                      className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                      title="Challenge"
                    >
                      <Swords size={16} />
                    </button>
                    <button 
                      onClick={() => removeFriend(friend.id)}
                      className="p-2 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                      title="Remove"
                    >
                      &times;
                    </button>
                  </div>
                </div>
                {total > 0 && (
                  <div className="mt-2 pt-2 border-t border-[var(--panel-border)] text-xs">
                    <p className="font-bold text-blue-500 mb-1">Rivalry Stats</p>
                    <p>Games Played: {total}</p>
                    <p>Win Rate: {winRate}% ({wins}W - {losses}L)</p>
                    {winRate < 40 && <p className="text-red-500 font-semibold mt-1">Nemesis Alert: They have your number!</p>}
                    {winRate > 60 && <p className="text-green-500 font-semibold mt-1">You dominate this matchup.</p>}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
