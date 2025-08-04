import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import {
  fetchAllChats,
  fetchGroupChats,
  sendMessage,
  getAllMessages,
  createChat,
  deleteChat,
  getChatById,
  updateChat,
} from "../api/chat";

type UpdateChatPayload = {
  name?: string;
  logo?: File | null;
  addUserIds?: string[];
  removeUserIds?: string[];
};

// Get all one-to-one chats
export const useAllChats = () =>
  useQuery({
    queryKey: ["allChats"],
    queryFn: fetchAllChats,
  });

// Get group chats
export const useGroupChats = () =>
  useQuery({
    queryKey: ["groupChats"],
    queryFn: fetchGroupChats,
  });

export const useCreateChat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createChat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["one-to-one-chats"] });
    },
  });
};

export const useUpdateChat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      chatId,
      data,
    }: {
      chatId: string;
      data: UpdateChatPayload;
    }) => updateChat(chatId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(); // Invalidate chat query to refetch
    },
  });
};
export const useChatById = (chatId: string) => {
  return useQuery({
    queryKey: ["chat", chatId],
    queryFn: () => getChatById(chatId),
    enabled: !!chatId,
  });
};

export const useDeleteChat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteChat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allChats"] });
      queryClient.invalidateQueries({ queryKey: ["groupChats"] });
    },
  });
};

// Get messages for a specific chat
export const useMessages = (chatId: string | undefined) =>
  useInfiniteQuery({
    queryKey: ["messages", chatId],
    enabled: !!chatId,
    queryFn: ({ pageParam }) => getAllMessages(chatId!, pageParam),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor, // correct logic
  });

// hooks/chatHooks.ts

export const useSendMessage = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendMessage,
    onSuccess: (_, { chatId }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      if (onSuccessCallback) onSuccessCallback(); // <- important!
    },
  });
};
