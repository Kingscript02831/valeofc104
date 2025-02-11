
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Search, Facebook, Instagram, Share2 } from "lucide-react";
import { Input } from "../components/ui/input";
import BottomNav from "../components/BottomNav";
import type { Chat, ChatParticipant } from "../types/chat";

export default function Conversations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [username, setUsername] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("conversations");
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      setCurrentUserId(session.user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, name')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setUsername(profile.name || profile.username || 'Usuário');
      }
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim()) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, name, avatar_url')
          .or(`name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
          .limit(10);

        if (!error && data) {
          setSearchResults(data);
        }
      } else {
        setSearchResults([]);
      }
    };

    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const { data: chats, isLoading } = useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const { data: chatsData, error: chatsError } = await supabase
        .from("chats")
        .select(`
          *,
          participants:chat_participants(
            *,
            profile:profiles(username, avatar_url, name, online_status, last_seen)
          ),
          messages:messages(*)
        `)
        .order('updated_at', { ascending: false });

      if (chatsError) throw chatsError;
      return chatsData as Chat[];
    },
    enabled: !!currentUserId,
  });

  const handleUserClick = async (userId: string) => {
    try {
      const { data: chatId, error: createChatError } = await supabase
        .rpc('create_private_chat', { other_user_id: userId });

      if (createChatError) {
        console.error('Error creating chat:', createChatError);
        return;
      }

      if (chatId) {
        await queryClient.invalidateQueries({ queryKey: ["chats"] });
        setIsSearching(false);
        setSearchQuery("");
        navigate('/chat', { state: { selectedChat: chatId } });
      }
    } catch (error) {
      console.error('Error handling user click:', error);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getOtherParticipant = (chat: Chat) => {
    return (chat.participants as ChatParticipant[]).find(p => p.user_id !== currentUserId)?.profile;
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: "Vale Notícias",
        url: window.location.href,
      });
    } catch (err) {
      console.error("Error sharing:", err);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white pb-16">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-teal-500 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">{username}</h1>
          <div className="flex gap-4">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-white/80"
            >
              <Facebook className="w-6 h-6" />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-white/80"
            >
              <Instagram className="w-6 h-6" />
            </a>
            <button 
              onClick={handleShare}
              className="text-white hover:text-white/80"
            >
              <Share2 className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-[#202C33] flex text-center border-b border-gray-700">
        <button 
          onClick={() => setActiveTab('conversations')}
          className={`flex-1 py-4 ${activeTab === 'conversations' ? 'text-green-500 border-b-2 border-green-500' : 'text-gray-400'}`}
        >
          Conversas
        </button>
        <button 
          onClick={() => setActiveTab('status')}
          className={`flex-1 py-4 ${activeTab === 'status' ? 'text-green-500 border-b-2 border-green-500' : 'text-gray-400'}`}
        >
          Status
        </button>
        <button 
          onClick={() => setActiveTab('reels')}
          className={`flex-1 py-4 ${activeTab === 'reels' ? 'text-green-500 border-b-2 border-green-500' : 'text-gray-400'}`}
        >
          Reels
        </button>
      </div>

      {/* Search */}
      <div className="absolute bottom-20 right-4 z-10">
        <Button 
          size="icon"
          className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg"
          onClick={() => setIsSearching(true)}
        >
          <Search className="h-6 w-6" />
        </Button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-400">Carregando conversas...</div>
        ) : chats?.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            Nenhuma conversa ainda. Comece uma busca por usuários!
          </div>
        ) : (
          chats?.map((chat) => {
            const otherParticipant = getOtherParticipant(chat);
            const lastMessage = chat.messages?.[0];

            return (
              <div
                key={chat.id}
                onClick={() => navigate("/chat", { state: { selectedChat: chat.id } })}
                className="px-4 py-3 hover:bg-[#202C33] cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                    {otherParticipant?.avatar_url ? (
                      <img
                        src={otherParticipant.avatar_url}
                        alt={otherParticipant.name || "Avatar"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg text-white">
                        {otherParticipant?.name?.[0] || "?"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-white">
                          {otherParticipant?.name || otherParticipant?.username || "Usuário"}
                        </h3>
                        {lastMessage && (
                          <p className="text-sm text-gray-400 truncate">
                            {lastMessage.content}
                          </p>
                        )}
                      </div>
                      {lastMessage && (
                        <span className="text-xs text-gray-400">
                          {formatTimestamp(lastMessage.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Search Overlay */}
      {isSearching && (
        <div className="absolute inset-0 bg-black/95 z-20">
          <div className="p-4 flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsSearching(false);
                setSearchQuery("");
              }}
              className="text-white"
            >
              <Search className="h-5 w-5" />
            </Button>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar usuários..."
              className="flex-1 bg-transparent border-none text-white placeholder:text-gray-400 focus:ring-0"
              autoFocus
            />
          </div>

          <div className="p-4">
            {searchResults.map((user) => (
              <div
                key={user.id}
                onClick={() => {
                  handleUserClick(user.id);
                }}
                className="flex items-center gap-3 p-3 hover:bg-gray-800 rounded-lg cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name || "Avatar"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg text-white">
                      {user.name?.[0] || user.username?.[0] || "?"}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-white">{user.name || user.username}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Encryption Notice */}
      <div className="p-4 text-center text-sm text-gray-500 bg-black">
        Suas mensagens pessoais são protegidas com{" "}
        <span className="text-green-500">
          criptografia de ponta a ponta
        </span>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
