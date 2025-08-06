import { useState } from "react";
import { useLogin } from "../hooks/authHooks";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import TestAccountNote from "../components/TestAccountNote";
import logo from "../assets/logo1.png"; // ✅ Logo import

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
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Login Form */}
        <div className="bg-white p-4 sm:py-4 sm:px-8 rounded-xl shadow-md space-y-4 w-full">
          {/* Logo Section */}
          <div className="flex items-center justify-center">
            <img src={logo} alt="Logo" className="h-10 w-10" />
            <div className="text-2xl font-bold ml-1 mt-1">
              <span className="text-blue-600">Com</span>
              <span className="text-blue-300">mune</span>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-semibold text-center text-gray-800">
            Welcome Back
          </h2>
          <p className="text-sm text-center text-gray-500">
            Please login to continue
          </p>

          <div className="space-y-4 text-sm">
            <input
              type="email"
              placeholder="Email"
              className="w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              className={`w-full text-white font-medium py-2.5 rounded-md transition-colors ${
                isPending
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
              onClick={handleLogin}
              disabled={isPending}
            >
              {isPending ? "Logging in..." : "Login"}
            </button>
          </div>

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

        {/* Test Note */}
        <TestAccountNote />
      </div>
    </div>
  );
};

export default Login;
