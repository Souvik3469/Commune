import api from "./axiosInstance";

export const register = (formData: FormData) =>
  api.post("/auth/register", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

export const login = (data: { email: string; password: string }) =>
  api.post("/auth/login", data);

export const logout = () => api.post("/auth/logout");

// The route is declared POST on the server; this was a GET, so requesting an
// OTP always 404'd.
export const sendOtp = (email: string) =>
  api.post(`/auth/send-otp?email=${encodeURIComponent(email)}`);

export const verifyOtp = (email: string, otp: string) =>
  api.post(`/auth/verify-otp?email=${encodeURIComponent(email)}`, { otp });
