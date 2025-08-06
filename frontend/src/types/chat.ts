import { Message } from "./message";
import { UserPreview } from "./user";

export type ChatPreview = {
  id: string;
  isGroup: boolean;
  name?: string;
  logo?: string;
  userIds: string[];
  users: UserPreview[];
  adminId?: string;
};

export interface Chat {
  id: string;
  name?: string;
  logo?: string;
  users: UserPreview[];
  messages?: Message[];
}

export interface ExtendedChat extends Chat {
  adminId?: string;
}

export type TransformedChat = {
  id: string;
  chatId: string;
  name: string;
  message: string;
  time: string;
  avatarSrc: string;
  seen: boolean;
  fullChat: ChatPreview;
};

export type ChatDetail = {
  name: string;
  message: string;
  time: string;
  avatarSrc: string;
  seen: boolean;
  id: string;
  chatId: string;
  fullChat: ChatPreview;
};

export type UpdateChatPayload = {
  name?: string;
  logo?: File | null;
  addUserIds?: string[];
  removeUserIds?: string[];
};
