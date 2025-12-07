import api from "./axiosInstance";

const DEFAULT_PROFILE_PIC =
  "https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small_2x/default-avatar-icon-of-social-media-user-vector.jpg";

export const myDetails = () =>
  api.get("/user/my-details").then((res) => {
    const user = res.data.message;

    return {
      ...user,
      profilePic: user.profilePic || DEFAULT_PROFILE_PIC,
    };
  });

export const searchUsers = async (query: string) => {
  const res = await api.get(`/user/search?query=${encodeURIComponent(query)}`);
  return res.data;
};

export const updateProfile = async (formData: FormData) => {
  const res = await api.patch("/user/update-profile", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};
