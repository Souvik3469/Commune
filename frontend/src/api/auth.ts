import api from "./axiosInstance";

export const sendOtp = (email: string) =>
  api.get(`/auth/send-otp?email=${email}`);

export const verifyOtp = (email: string, otp: string) =>
  api.post(`/auth/verify-otp?email=${email}`, { otp });

export const register = (data: {
  name: string;
  email: string;
  password: string;
  gender: string;
}) => api.post("/auth/register", data);

export const login = (data: { email: string; password: string }) =>
  api.post("/auth/login", data);

export const getCurrentUser = () => api.get("/auth/me");

export const logout = () => api.post("/auth/logout");
