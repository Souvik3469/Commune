import React from "react";
import IncomingCallPopup from "./IncomingCallPopup";
import CallDialog from "./CallDialog";

const GlobalCallUI: React.FC = () => {
  return (
    <>
      <IncomingCallPopup />
      <CallDialog />
    </>
  );
};

export default GlobalCallUI;
