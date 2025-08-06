import { useState } from "react";
import { useRegister } from "../hooks/authHooks";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import TestAccountNote from "../components/TestAccountNote";
import logo from "../assets/logo1.png"; // ✅ Import your logo

const Register = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    gender: "",
  });

  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const { mutate: registerUser, isPending } = useRegister();

  const handleRegister = () => {
    const { name, email, password, gender } = form;

    if (!name || !email || !password || !gender) {
      toast.error("Please fill all fields");
      return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("password", password);
    formData.append("gender", gender);
    if (profilePic) {
      formData.append("profilePic", profilePic);
    }

    registerUser(formData, {
      onSuccess: () => {
        toast.success("Registration successful");
        navigate("/login");
      },
      onError: (err) => {
        const error = err as import("axios").AxiosError<{ message?: string }>;
        toast.error(error.response?.data?.message || "Registration failed");
      },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Register Form */}
        <div className="bg-white p-4 sm:py-4 sm:px-8 rounded-xl shadow-md space-y-4 w-full">
          {/* Logo Section */}
          <div className="flex items-center justify-center ">
            <img src={logo} className="h-10 w-10" />
            <div className="text-2xl font-bold ml-1 mt-1">
              <span className="text-blue-600">Com</span>
              <span className="text-blue-300">mune</span>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-semibold text-center text-gray-800">
            Create an Account
          </h2>
          <p className="text-sm text-center text-gray-500">
            Register to get started
          </p>

          <div className="space-y-4 text-sm">
            <input
              type="text"
              placeholder="Your name"
              className="w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <input
              type="email"
              placeholder="Your email"
              className="w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <input
              type="password"
              placeholder="Password"
              className="w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />

            <select
              className="w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Profile Picture (optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setProfilePic(file);
                    setPreviewUrl(URL.createObjectURL(file));
                  }
                }}
                className="w-full"
              />
              {previewUrl && (
                <div className="mt-3">
                  <p className="text-xs text-gray-600 mb-1">Preview:</p>
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-16 w-16 rounded-full object-cover border"
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleRegister}
              disabled={isPending}
              className={`w-full text-white font-medium py-2.5 rounded-md transition-colors ${
                isPending
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isPending ? "Registering..." : "Register"}
            </button>
          </div>

          <p className="text-sm text-center text-gray-600">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-blue-600 hover:underline font-medium"
            >
              Login here
            </Link>
          </p>
        </div>

        {/* Test Account Info */}
        <TestAccountNote />
      </div>
    </div>
  );
};

export default Register;
