import { useState } from "react";
import { sendOtp, verifyOtp } from "../api/auth";
import toast from "react-hot-toast";
import { AxiosError } from "axios";

interface Props {
  onVerified: (email: string) => void;
}

const OtpVerification: React.FC<Props> = ({ onVerified }) => {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"input" | "verify">("input");

  const handleSendOtp = async () => {
    try {
      await sendOtp(email);
      toast.success("OTP sent");
      setStep("verify");
    } catch (err: unknown) {
      const error = err as AxiosError<{ message?: string }>;
      const msg = error.response?.data?.message || "Failed to send OTP";
      toast.error(msg);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      await verifyOtp(email, otp);
      toast.success("OTP verified");
      onVerified(email);
    } catch (err: unknown) {
      const error = err as AxiosError<{ message?: string }>;
      const msg = error.response?.data?.message || "Invalid OTP";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4 w-full max-w-md mx-auto bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold text-gray-700">
        Email Verification
      </h2>
      <input
        type="email"
        className="w-full border px-3 py-2 rounded"
        placeholder="Enter email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={step === "verify"}
      />
      {step === "verify" && (
        <input
          type="text"
          className="w-full border px-3 py-2 rounded"
          placeholder="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />
      )}
      <button
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        onClick={step === "input" ? handleSendOtp : handleVerifyOtp}
      >
        {step === "input" ? "Send OTP" : "Verify OTP"}
      </button>
    </div>
  );
};

export default OtpVerification;
