import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendOtp, verifyOtp, register, login, logout } from "../api/auth";
import { disconnectSocket } from "../lib/socket";

export const useRegister = () =>
  useMutation({
    mutationFn: (formData: FormData) => register(formData),
  });

export const useLogin = () =>
  useMutation({
    mutationFn: (data: { email: string; password: string }) => login(data),
  });

// `useCurrentUser` used to live here and call `GET /auth/me`, a route the API
// has never served. `useMyDetails` in userHooks is the one that works.

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // The socket authenticates with the stored token; it has to go too.
      disconnectSocket();
      localStorage.removeItem("accessToken");
      queryClient.clear();
    },
  });
};

export const useSendOtp = () =>
  useMutation({
    mutationFn: (email: string) => sendOtp(email),
  });

export const useVerifyOtp = () =>
  useMutation({
    mutationFn: ({ email, otp }: { email: string; otp: string }) =>
      verifyOtp(email, otp),
  });
