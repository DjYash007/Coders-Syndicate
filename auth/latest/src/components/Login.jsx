import { loginWithGoogle } from "../services/auth";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Login = () => {
  const handleLogin = async () => {
    const user = await loginWithGoogle();
    const token = await user.getIdToken();

    await fetch(`${API_URL}/api/auth`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    window.location.href = "/profile";
  };

  return (
    <div>
      <h2>Login</h2>
      <button onClick={handleLogin}>
        Continue with Google
      </button>
    </div>
  );
};

export default Login;