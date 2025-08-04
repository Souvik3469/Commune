import api from "./axiosInstance";

export const myDetails = () =>
  api.get("/user/my-details").then((res) => {
    const user = res.data.message;
    const defaultProfilePic = `https://i.pravatar.cc/150?u=58`;
    return {
      ...user,
      profilePic: user.profilePic || defaultProfilePic,
    };
  });

export const searchUsers = async (query: string) => {
  const res = await api.get(`/user/search?query=${encodeURIComponent(query)}`);
  return res.data; // List of users
};

export const updateProfile = async (formData: FormData) => {
  const res = await api.patch("/user/update-profile", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};
