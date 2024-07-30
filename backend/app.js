const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const plaid = require('plaid');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
dotenv.config();

const app = express();
app.use(bodyParser.json());

// CORS configuration
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3002'],  // Your frontend URLs
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Error connecting to MongoDB:', err.message);
});

// Define User schema and model
const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    email: String
});

const User = mongoose.model('User', userSchema);

// Define Transaction schema and model
const transactionSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    name: String,
    amount: Number,
    date: Date
});

const Transaction = mongoose.model('Transaction', transactionSchema);

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = 'sandbox';  // Use 'sandbox' for testing

const client = new plaid.PlaidApi(new plaid.Configuration({
    basePath: plaid.PlaidEnvironments[PLAID_ENV],
    baseOptions: {
        headers: {
            'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
            'PLAID-SECRET': PLAID_SECRET,
        },
    },
}));


// Middleware to verify token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: 'No token provided' });
    
    const tokenParts = token.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
        return res.status(401).json({ error: 'Invalid token format' });
    }

    const authToken = tokenParts[1];

    jwt.verify(authToken, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(500).json({ error: 'Failed to authenticate token' });
        req.userId = decoded.id;
        next();
    });
};

// User Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const passwordIsValid = await bcrypt.compare(password, user.password);
    if (!passwordIsValid) return res.status(401).json({ error: 'Invalid password' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: 86400 });
    res.json({ auth: true, token });
});


// User Registration
app.post('/api/register', async (req, res) => {
    const { username, password, email } = req.body;
    const hashedPassword = await bcrypt.hash(password, 8);
    const user = new User({ username, password: hashedPassword, email });
    await user.save();
    res.json({ message: 'User registered successfully' });
});

// User Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const passwordIsValid = await bcrypt.compare(password, user.password);
    if (!passwordIsValid) return res.status(401).json({ error: 'Invalid password' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: 86400 });
    res.json({ auth: true, token });
});

// Secured API Routes
app.post('/api/create_link_token', verifyToken, async (req, res) => {
    const configs = {
        user: {
            client_user_id: req.userId.toString(),
        },
        client_name: 'Your App Name',
        products: ['auth', 'transactions'],
        country_codes: ['US'],
        language: 'en',
    };
    try {
        const response = await client.linkTokenCreate(configs);
        res.json(response.data);
    } catch (error) {
        console.error('Error creating link token:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/exchange_public_token', verifyToken, async (req, res) => {
    const { public_token } = req.body;
    try {
        const response = await client.itemPublicTokenExchange({ public_token });
        const access_token = response.data.access_token;
        const item_id = response.data.item_id;
        res.json({ access_token, item_id });
    } catch (error) {
        console.error('Error exchanging public token:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/transactions', verifyToken, async (req, res) => {
    const { access_token } = req.body;
    try {
        const response = await client.transactionsGet({
            access_token,
            start_date: '2023-01-01',
            end_date: '2023-12-31',
        });
        const transactions = response.data.transactions;
        const transactionDocs = transactions.map(t => ({
            userId: req.userId,
            name: t.name,
            amount: t.amount,
            date: t.date
        }));
        await Transaction.insertMany(transactionDocs);
        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(5001, () => {
    console.log('Server is running on port 5001');
});
