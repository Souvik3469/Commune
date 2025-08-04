export type UserPreview = {
  id: string;
  name: string;
  email: string;
  profilePic: string;
  dob?: string;
};

export type ChatPreview = {
  id: string;
  isGroup: boolean;
  name?: string;
  logo?: string;
  userIds: string[];
  users: UserPreview[];
  adminId?: string;
};
