export interface Message {
  content: string;
  timestamp: string;
  senderId: string;
}

export interface MessageDetail {
  id: string;
  content: string;
  timestamp: string;
  senderId: string;
  chatId: string;
  sender: {
    name: string;
    profilePic: string | null;
  };
}
