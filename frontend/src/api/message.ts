import api from "./axiosInstance";

export const sendMessage = async (data: {
  chatId: string;
  content: string;
}) => {
  const res = await api.post("/chat/send", data);
  return res.data;
};

export const getAllMessages = async (chatId: string, cursor?: string) => {
  const res = await api.get(`/chat/${chatId}/messages`, {
    params: { cursor },
  });

  return {
    messages: res.data.messages,
    nextCursor: res.data.nextCursor,
  };
};

export const getUnreadMessages = async (chatId: string) => {
  const res = await api.get(`/chat/${chatId}/unread`);
  return res.data;
};

export const updateMessageStatus = async (chatId: string, status: string) => {
  const res = await api.put(`/chat/${chatId}/status`, { status });
  return res.data;
};
