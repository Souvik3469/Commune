import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { getAllMessages, sendMessage } from "../api/message";

export const useMessages = (chatId: string | undefined) =>
  useInfiniteQuery({
    queryKey: ["messages", chatId],
    enabled: !!chatId,
    queryFn: ({ pageParam }) => getAllMessages(chatId!, pageParam),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

export const useSendMessage = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendMessage,
    onSuccess: (_, { chatId }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      if (onSuccessCallback) onSuccessCallback();
    },
  });
};
