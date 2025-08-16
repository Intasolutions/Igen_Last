const Button = ({ onClick, children }) => {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
    >
      {children}
    </button>
  );
};

export default Button;
