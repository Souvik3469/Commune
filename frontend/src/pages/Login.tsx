import { useState } from "react";
import { useLogin } from "../hooks/authHooks";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });

  const { mutate: loginUser, isPending } = useLogin();

  const handleLogin = () => {
    loginUser(form, {
      onSuccess: (res) => {
        const token = res.data?.message?.accessToken;
        if (token) {
          localStorage.setItem("accessToken", token);
          toast.success("Logged in");
          navigate("/chat");
        } else {
          toast.error("No token received");
        }
      },
      onError: (err) => {
        const error = err as import("axios").AxiosError<{ message?: string }>;
        toast.error(error.response?.data?.message || "Login failed");
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="space-y-4 w-full max-w-md bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold text-gray-700">Login</h2>
        <input
          type="email"
          placeholder="Email"
          className="w-full border px-3 py-2 rounded"
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full border px-3 py-2 rounded"
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button
          className={`w-full text-white py-2 rounded ${
            isPending
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
          onClick={handleLogin}
          disabled={isPending}
        >
          {isPending ? "Logging in..." : "Login"}
        </button>

        <p className="text-sm text-center text-gray-600">
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            className="text-blue-600 hover:underline font-medium"
          >
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
