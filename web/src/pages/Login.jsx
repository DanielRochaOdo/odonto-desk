import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { user, signInWithPassword, signUp, signInWithOtp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/app", { replace: true });
    }
  }, [user, navigate]);

  const handleSignIn = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const { error } = await signInWithPassword(email, password);
    if (error) setMessage(error.message);
    setLoading(false);
  };

  const handleSignUp = async () => {
    setLoading(true);
    setMessage("");
    const { error } = await signUp(email, password);
    if (error) setMessage(error.message);
    else setMessage("Conta criada! Verifique seu email para confirmação.");
    setLoading(false);
  };

  const handleMagicLink = async () => {
    setLoading(true);
    setMessage("");
    const { error } = await signInWithOtp(email);
    if (error) setMessage(error.message);
    else setMessage("Link mágico enviado para o seu email.");
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="card max-w-md w-full">
        <h1 className="font-display text-3xl mb-2">Odonto Desk</h1>
        <p className="text-sm text-mist/70 mb-6">
          Acesso remoto com consentimento explícito e foco em qualidade.
        </p>
        <form className="space-y-4" onSubmit={handleSignIn}>
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            Entrar
          </button>
        </form>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" className="btn-secondary" onClick={handleSignUp} disabled={loading}>
            Criar conta
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleMagicLink}
            disabled={loading}
          >
            Enviar link mágico
          </button>
        </div>
        {message && <p className="mt-4 text-sm text-mist/60">{message}</p>}
      </div>
    </div>
  );
}
