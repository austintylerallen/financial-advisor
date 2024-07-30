import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { usePlaidLink } from 'react-plaid-link';
import './App.css';

const App = () => {
    const [linkToken, setLinkToken] = useState(null);
    const [accessToken, setAccessToken] = useState('');
    const [transactions, setTransactions] = useState([]);
    const [auth, setAuth] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (auth) {
            const createLinkToken = async () => {
                try {
                    const response = await axios.post('http://localhost:5001/api/create_link_token', {}, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });
                    setLinkToken(response.data.link_token);
                } catch (error) {
                    console.error("Error creating link token:", error);
                }
            };
            createLinkToken();
        }
    }, [auth]);

    const onSuccess = async (public_token) => {
        try {
            const response = await axios.post('http://localhost:5001/api/exchange_public_token', { public_token }, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            setAccessToken(response.data.access_token);
        } catch (error) {
            console.error("Error exchanging public token:", error);
        }
    };

    const fetchTransactions = async () => {
        try {
            const response = await axios.post('http://localhost:5001/api/transactions', { access_token: accessToken }, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            setTransactions(response.data);
        } catch (error) {
            console.error("Error fetching transactions:", error);
        }
    };

    const register = async () => {
        try {
            const response = await axios.post('http://localhost:5001/api/register', { username, password, email: `${username}@gmail.com` });
            console.log('Registration Response:', response.data);
            login();
        } catch (error) {
            console.error("Error registering user:", error);
        }
    };

    const login = async () => {
        try {
            const response = await axios.post('http://localhost:5001/api/login', { username, password });
            console.log('Login Response:', response.data);
            localStorage.setItem('token', response.data.token);
            setAuth(true);
        } catch (error) {
            console.error("Error logging in:", error);
        }
    };

    const { open, ready } = usePlaidLink({
        token: linkToken,
        onSuccess,
    });

    return (
        <div className="App">
            <header className="App-header">
                <h1>AI-Powered Financial Advisor</h1>
                {!auth && (
                    <div>
                        <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        <button onClick={register}>Register</button>
                        <button onClick={login}>Login</button>
                    </div>
                )}
                {auth && linkToken && (
                    <button onClick={() => open()} disabled={!ready}>
                        Connect your bank account
                    </button>
                )}
                {auth && (
                    <button onClick={fetchTransactions} disabled={!accessToken}>Fetch Transactions</button>
                )}
                <div>
                    {transactions.map((transaction, index) => (
                        <div key={index}>
                            <p>{transaction.name}: {transaction.amount}</p>
                        </div>
                    ))}
                </div>
            </header>
        </div>
    );
};

export default App;
