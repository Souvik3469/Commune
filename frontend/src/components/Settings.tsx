import { FC, useState, ChangeEvent, FormEvent, useEffect } from "react";
import { useUpdateProfile, useMyDetails } from "../hooks/userHooks";
import toast from "react-hot-toast";

type SettingsProps = {
  className?: string;
};

const Settings: FC<SettingsProps> = ({ className }) => {
  const { data: user } = useMyDetails();
  const { mutate: updateProfile, isPending } = useUpdateProfile();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    gender: "",
  });

  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        email: user.email || "",
        password: "",
        gender: user.gender || "",
      });
      if (user.profilePic) setPreviewUrl(user.profilePic);
    }
  }, [user]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const { name, email, gender } = form;

    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("gender", gender);
    if (form.password) formData.append("password", form.password);
    if (profilePic) formData.append("profilePic", profilePic);

    updateProfile(formData, {
      onSuccess: () => toast.success("Profile updated successfully"),
      onError: () => toast.error("Failed to update profile"),
    });
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePic(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center px-4 ${className}`}
    >
      <div className="w-full max-w-xl bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
          Edit Profile
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* Name */}
          <div>
            <label className="block mb-1 text-gray-700 dark:text-gray-300">
              Full Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring focus:ring-blue-500/50 transition"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block mb-1 text-gray-700 dark:text-gray-300">
              Email Address
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring focus:ring-blue-500/50 transition"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block mb-1 text-gray-700 dark:text-gray-300">
              Password
            </label>
            <input
              type="password"
              placeholder="Leave blank to keep same"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring focus:ring-blue-500/50 transition"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block mb-1 text-gray-700 dark:text-gray-300">
              Gender
            </label>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring focus:ring-blue-500/50 transition"
              required
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Profile Picture */}
          <div>
            <label className="block mb-1 text-gray-700 dark:text-gray-300">
              Profile Picture
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="text-sm text-gray-600 dark:text-gray-300"
              />
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Profile Preview"
                  className="h-16 w-16 rounded-full border border-gray-300 dark:border-gray-600 object-cover"
                />
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isPending}
              className={`w-full py-2 text-sm font-medium rounded-md text-white transition ${
                isPending
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-400"
              }`}
            >
              {isPending ? "Updating..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
