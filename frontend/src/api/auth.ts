import axios from "axios";

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/v1";

const api = axios.create({
  baseURL: BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

export const logout = () => api.post("/auth/logout"); // optional
