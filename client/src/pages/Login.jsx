import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error, clearError } = useAuthStore();

  const handleSubmit = (e) => {
    e.preventDefault();
    login(email, password);
  };

  return (
    <div className="min-h-screen bg-deep flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center mb-8">
          <h1 className="font-display text-3xl text-gold">INFERNO DOMINI</h1>
        </Link>

        <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-lg p-8">
          <h2 className="font-display text-2xl text-parchment mb-6 text-center">Connexion</h2>

          {error && (
            <div className="bg-blood/20 border border-blood rounded p-3 mb-4 text-sm text-blood-glow">
              {error}
              <button onClick={clearError} className="float-right text-muted hover:text-parchment">&times;</button>
            </div>
          )}

          <label className="block mb-4">
            <span className="text-muted text-sm">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full bg-base border border-border rounded px-4 py-2 text-parchment
                         focus:border-blood focus:outline-none transition-colors"
              placeholder="seigneur@inferno.com"
            />
          </label>

          <label className="block mb-6">
            <span className="text-muted text-sm">Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full bg-base border border-border rounded px-4 py-2 text-parchment
                         focus:border-blood focus:outline-none transition-colors"
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blood border border-gold rounded font-display text-lg text-parchment
                       hover:bg-blood-light disabled:opacity-50 transition-all duration-300"
          >
            {loading ? 'Connexion...' : 'Entrer dans les Tnbres'}
          </button>

          <p className="mt-6 text-center text-sm text-muted">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-gold hover:text-gold-light transition-colors">
              Rejoindre le Pandmonium
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
