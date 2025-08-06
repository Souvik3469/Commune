const TestAccountNote = () => {
  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-md w-full text-center">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        Want to Try Without Registering?
      </h3>
      <p className="text-sm text-gray-600 leading-relaxed">
        You can use one of the following test accounts to explore the app:
      </p>
      <div className="mt-3 text-blue-600 font-medium text-sm">
        user1@gmail.com - user5@gmail.com
      </div>
      <p className="text-xs text-gray-400 mt-1">
        Password is same as the email.
      </p>
    </div>
  );
};

export default TestAccountNote;
