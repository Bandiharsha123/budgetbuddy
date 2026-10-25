import { useState } from 'react';
import axios from 'axios';

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'STUDENT',
  });
  const [token, setToken] = useState(localStorage.getItem('access_token') || null);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      if (isLogin) {
        const response = await axios.post('http://127.0.0.1:8000/api/auth/login/', {
          username: formData.username,
          password: formData.password,
        });
        localStorage.setItem('access_token', response.data.access);
        localStorage.setItem('refresh_token', response.data.refresh);
        setToken(response.data.access);
        setMessage('Logged in successfully!');
      } else {
        const response = await axios.post('http://127.0.0.1:8000/api/auth/register/', formData);
        localStorage.setItem('access_token', response.data.access);
        localStorage.setItem('refresh_token', response.data.refresh);
        setToken(response.data.access);
        setMessage('Registered and logged in successfully!');
      }
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.detail || 'Authentication failed'));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setToken(null);
    setMessage('Logged out.');
  };

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', fontFamily: 'sans-serif', padding: '24px', border: '1px solid #ccc', borderRadius: '8px', background: '#fff', color: '#333' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>BudgetBuddy</h2>
      
      {token ? (
        <div>
          <p style={{ color: 'green', fontWeight: 'bold' }}>✓ Authenticated with JWT</p>
          <div style={{ wordBreak: 'break-all', fontSize: '11px', background: '#f5f5f5', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>
            <strong>Access Token:</strong><br />{token}
          </div>
          <button onClick={handleLogout} style={{ width: '100%', padding: '10px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Logout
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <h3 style={{ marginTop: 0 }}>{isLogin ? 'Login' : 'Create Account'}</h3>
          
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Username</label>
            <input type="text" name="username" value={formData.username} onChange={handleChange} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }} />
          </div>

          {!isLogin && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Role</label>
                <select name="role" value={formData.role} onChange={handleChange} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}>
                  <option value="STUDENT">Student</option>
                  <option value="PREMIUM">Premium User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Password</label>
            <input type="password" name="password" value={formData.password} onChange={handleChange} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }} />
          </div>

          <button type="submit" style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            {isLogin ? 'Login' : 'Register'}
          </button>

          <p style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span onClick={() => { setIsLogin(!isLogin); setMessage(''); }} style={{ color: '#2563eb', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}>
              {isLogin ? 'Register' : 'Login'}
            </span>
          </p>
        </form>
      )}

      {message && <p style={{ marginTop: '15px', textAlign: 'center', fontSize: '14px', color: message.startsWith('Error') ? '#e53e3e' : '#16a34a' }}>{message}</p>}
    </div>
  );
}

export default App;