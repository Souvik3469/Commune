// hooks/authHooks.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  sendOtp,
  verifyOtp,
  register,
  login,
  getCurrentUser,
  logout, // Uncomment if you have a logout API
} from "../api/auth";

// Send OTP
export const useSendOtp = () =>
  useMutation({
    mutationFn: (email: string) => sendOtp(email),
  });

// Verify OTP
export const useVerifyOtp = () =>
  useMutation({
    mutationFn: ({ email, otp }: { email: string; otp: string }) =>
      verifyOtp(email, otp),
  });

// Register
export const useRegister = () =>
  useMutation({
    mutationFn: (formData: FormData) => register(formData),
  });

// Login
export const useLogin = () =>
  useMutation({
    mutationFn: (data: { email: string; password: string }) => login(data),
  });

// Fetch current user
export const useCurrentUser = () =>
  useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await getCurrentUser();
      return res.data.user;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

// Logout (optional)

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["currentUser"] });
    },
  });
};
