import { useState } from "react";
import { useRegister } from "../hooks/authHooks";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";

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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="space-y-4 w-full max-w-md bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold text-gray-700 text-center">
          Register
        </h2>

        {/* Name */}
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          className="w-full border px-3 py-2 rounded"
          placeholder="Your name"
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        {/* Email */}
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          className="w-full border px-3 py-2 rounded"
          placeholder="Your email"
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        {/* Password */}
        <label className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          type="password"
          className="w-full border px-3 py-2 rounded"
          placeholder="Password"
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        {/* Gender */}
        <label className="block text-sm font-medium text-gray-700">
          Gender
        </label>
        <select
          className="w-full border px-3 py-2 rounded"
          value={form.gender}
          onChange={(e) => setForm({ ...form, gender: e.target.value })}
        >
          <option value="">Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>

        {/* Profile Picture */}
        <label className="block text-sm font-medium text-gray-700">
          Profile Picture (optional)
        </label>
        <input
          type="file"
          accept="image/*"
          className="w-full"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setProfilePic(file);
              setPreviewUrl(URL.createObjectURL(file));
            }
          }}
        />

        {/* Image Preview */}
        {previewUrl && (
          <div className="mt-2">
            <p className="text-sm text-gray-600 mb-1">Preview:</p>
            <img
              src={previewUrl}
              alt="Preview"
              className="h-20 w-20 object-cover rounded-full border"
            />
          </div>
        )}

        {/* Register Button */}
        <button
          className={`w-full text-white py-2 rounded ${
            isPending
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
          onClick={handleRegister}
          disabled={isPending}
        >
          {isPending ? "Registering..." : "Register"}
        </button>

        {/* Link to Login */}
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
    </div>
  );
};

export default Register;
