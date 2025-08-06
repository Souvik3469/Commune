import api from "./axiosInstance";

// One-to-one chats
export const fetchAllChats = async () => {
  const res = await api.get("/chat/get-chats");
  return res.data;
};

// Group chats
export const fetchGroupChats = async () => {
  const res = await api.get("/chat/get-rooms");
  return res.data;
};

// Create new chat (group or one-to-one)
export const createChat = async (data: {
  isGroup: boolean;
  userIds?: string[];
  name?: string;
  logo?: File | null;
  usernames?: string[];
}) => {
  const formData = new FormData();
  formData.append("isGroup", data.isGroup.toString());

  if (data.name) formData.append("name", data.name);
  if (data.logo) formData.append("logo", data.logo); // append file

  if (data.userIds && data.userIds.length > 0) {
    data.userIds.forEach((id) => formData.append("userIds", id));
  }

  if (data.usernames && data.usernames.length > 0) {
    data.usernames.forEach((username) =>
      formData.append("usernames", username)
    );
  }

  const res = await api.post("/chat/create", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data;
};

export const updateChat = async (
  chatId: string,
  data: {
    name?: string;
    logo?: File | null;
    addUserIds?: string[];
    removeUserIds?: string[];
  }
) => {
  const formData = new FormData();

  if (data.name) formData.append("name", data.name);
  if (data.logo) formData.append("logo", data.logo);

  data.addUserIds?.forEach((id) => formData.append("addUserIds[]", id));
  data.removeUserIds?.forEach((id) => formData.append("removeUserIds[]", id));

  const res = await api.patch(`/chat/${chatId}/update`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
};

export const getChatById = async (chatId: string) => {
  const res = await api.get(`/chat/${chatId}`);
  return res.data;
};

// Delete chat
export const deleteChat = async (chatId: string) => {
  const res = await api.delete(`/chat/${chatId}`);
  return res.data;
};

// Send message
export const sendMessage = async (data: {
  chatId: string;
  content: string;
}) => {
  const res = await api.post("/chat/send", data);
  return res.data;
};

// Get all messages
export const getAllMessages = async (chatId: string, cursor?: string) => {
  const res = await api.get(`/chat/${chatId}/messages`, {
    params: { cursor },
  });

  return {
    messages: res.data.messages,
    nextCursor: res.data.nextCursor,
  };
};

// Get unread messages
export const getUnreadMessages = async (chatId: string) => {
  const res = await api.get(`/chat/${chatId}/unread`);
  return res.data;
};

// Update message status
export const updateMessageStatus = async (chatId: string, status: string) => {
  const res = await api.put(`/chat/${chatId}/status`, { status });
  return res.data;
};

// Update group chat (name, etc.)
// export const updateGroupChat = async (chatId: string, data: any) => {
//   const res = await api.patch(`/chat/${chatId}/update`, data);
//   return res.data;
// };

// Remove members from group
export const removeGroupMembers = async (chatId: string, userIds: string[]) => {
  const res = await api.patch(`/chat/${chatId}/remove-members`, { userIds });
  return res.data;
};

// Generate invite link
export const generateInviteLink = async (chatId: string) => {
  const res = await api.post(`/chat/${chatId}/invite-link`);
  return res.data;
};

// Accept invite link
export const acceptInviteLink = async (inviteToken: string) => {
  const res = await api.post(`/chat/accept-invite/${inviteToken}`);
  return res.data;
};
