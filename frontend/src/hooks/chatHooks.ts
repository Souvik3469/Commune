import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllChats,
  fetchGroupChats,
  createChat,
  deleteChat,
  getChatById,
  updateChat,
} from "../api/chat";
import { UpdateChatPayload } from "../types/chat";

export const useAllChats = () =>
  useQuery({
    queryKey: ["allChats"],
    queryFn: fetchAllChats,
  });

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
      queryClient.invalidateQueries({ queryKey: ["allChats"] }); // ✅ correct key
      queryClient.invalidateQueries({ queryKey: ["groupChats"] }); // ✅ refresh list if needed
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
    onSuccess: (_, { chatId }) => {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] }); // ✅ specific chat
      queryClient.invalidateQueries({ queryKey: ["allChats"] }); // ✅ refresh list if needed
      queryClient.invalidateQueries({ queryKey: ["groupChats"] }); // ✅ refresh list if needed
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
    mutationFn: (chatId: string) => deleteChat(chatId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allChats"] });
      queryClient.invalidateQueries({ queryKey: ["groupChats"] });
    },
  });
};
