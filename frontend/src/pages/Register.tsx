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

  const { mutate: registerUser, isPending } = useRegister();

  const handleRegister = () => {
    const { name, email, password, gender } = form;

    if (!name || !email || !password || !gender) {
      toast.error("Please fill all fields");
      return;
    }

    registerUser(form, {
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

        <input
          type="text"
          placeholder="Name"
          className="w-full border px-3 py-2 rounded"
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
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
        <select
          className="w-full border px-3 py-2 rounded"
          onChange={(e) => setForm({ ...form, gender: e.target.value })}
        >
          <option value="">Select Gender</option>
          <option>Male</option>
          <option>Female</option>
          <option>Other</option>
        </select>

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
