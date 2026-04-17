const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Allow ALL origins
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(__dirname));

// MongoDB Connection
const MONGODB_URI = 'mongodb+srv://LucidAlgorithm:Lucid@cluster0.kcqdr6j.mongodb.net/?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
    dbName: 'lucidalgorithms'
})
  .then(() => console.log('✅ Connected to MongoDB - Lucid Algorithms'))
  .catch(err => console.error('MongoDB connection error:', err));

// ============= SCHEMAS =============
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    age: { type: Number, required: true },
    country: { type: String, required: true },
    countryCode: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    employmentStatus: { type: String, enum: ['Employed', 'Self-Employed', 'Unemployed', 'Student', 'Retired'], required: true },
    tradingExperience: { type: String, enum: ['Beginner', 'Intermediate', 'Expert'], required: true },
    fundsSource: { type: String, enum: ['Personal Savings', 'Business Revenue', 'Inheritance or Gift', 'Loan Proceeds', 'Investment from Partners/Investors', 'Sale of Assets'], required: true },
    balance: { type: Number, default: 0 },
    demoBalance: { type: Number, default: 10000 },
    totalDeposits: { type: Number, default: 0 },
    totalProfit: { type: Number, default: 0 },
    totalLoss: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    totalTrades: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    isAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    withdrawalAddress: { type: String, default: '' },
    termsAccepted: { type: Boolean, required: true },
    termsAcceptedAt: { type: Date },
    isFromUSA: { type: String, default: 'no' },
    expectedDeposit: { type: String, default: '' },
    aiApiKey: { type: String, default: '' }
});

const tradeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isDemo: { type: Boolean, default: false },
    symbol: { type: String, required: true },
    symbolName: { type: String, required: true },
    category: { type: String, required: true },
    side: { type: String, enum: ['buy', 'sell'], required: true },
    amount: { type: Number, required: true },
    leverage: { type: Number, default: 1 },
    duration: { type: String, required: true },
    durationMs: { type: Number, required: true },
    entryPrice: { type: Number, required: true },
    exitPrice: { type: Number, default: null },
    profit: { type: Number, default: null },
    profitMultiplier: { type: Number, default: 0.88 }, // Track multiplier used
    status: { type: String, enum: ['active', 'completed', 'stopped'], default: 'active' },
    analysis: { type: String, default: '' },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    aiPasskey: { type: String }
});

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isDemo: { type: Boolean, default: false },
    userName: { type: String, required: true },
    type: { type: String, enum: ['deposit', 'withdrawal', 'profit', 'trade', 'admin_deposit', 'admin_deduct'], required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
    transactionId: { type: String, unique: true },
    description: { type: String },
    adminName: { type: String },
    withdrawalFee: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const withdrawalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    amount: { type: Number, required: true },
    feeAmount: { type: Number, default: 0 },
    network: { type: String, required: true },
    walletAddress: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    processedBy: { type: String }
});

const depositRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    amount: { type: Number, required: true, min: 80 },
    crypto: { type: String, default: '' },
    network: { type: String, default: '' },
    walletAddress: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'completed', 'rejected'], default: 'pending' },
    transactionId: { type: String, unique: true },
    createdAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    processedBy: { type: String }
});

// Chat Message Schema - messages auto-delete after 2 days
const chatMessageSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    message: { type: String, required: true },
    sender: { type: String, enum: ['user', 'admin'], required: true },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: 172800 }
});

const User = mongoose.model('User', userSchema);
const Trade = mongoose.model('Trade', tradeSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
const DepositRequest = mongoose.model('DepositRequest', depositRequestSchema);
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

// ============= MIDDLEWARE =============
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });
    
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'lucid_algorithms_jwt_secret');
        req.user = verified;
        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid token' });
    }
};

const isAdmin = async (req, res, next) => {
    const user = await User.findById(req.user.id);
    if (!user || !user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    next();
};

function generatePasskey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let passkey = '';
    for (let i = 0; i < 12; i++) {
        passkey += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return passkey;
}

// ============= PROFIT MULTIPLIER FUNCTION =============
function calculateProfitMultiplier(amount, durationMs) {
    // Convert duration to hours for comparison
    const durationHours = durationMs / (1000 * 60 * 60);
    
    // Check if duration is 1 hour or more
    const isLongDuration = durationHours >= 1;
    
    // Default multiplier (88% profit = 0.88x)
    let multiplier = 0.88;
    
    if (isLongDuration) {
        if (amount >= 2000) {
            multiplier = 3.0; // 300% profit (3x)
        } else if (amount >= 500) {
            multiplier = 2.0; // 200% profit (2x)
        }
    }
    
    return multiplier;
}

// ============= AUTH ROUTES =============
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, fullName, age, country, countryCode, phoneNumber, employmentStatus, tradingExperience, fundsSource, termsAccepted, isFromUSA, expectedDeposit } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'Email already registered' });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = new User({
            email,
            password: hashedPassword,
            fullName,
            age,
            country,
            countryCode,
            phoneNumber,
            employmentStatus,
            tradingExperience,
            fundsSource,
            termsAccepted,
            termsAcceptedAt: new Date(),
            isFromUSA: isFromUSA || 'no',
            expectedDeposit: expectedDeposit || '',
            balance: 0,
            demoBalance: 10000,
            isAdmin: email === 'admin@lucidalgorithms.com'
        });
        
        await user.save();
        
        const token = jwt.sign({ id: user._id, email: user.email, isAdmin: user.isAdmin }, process.env.JWT_SECRET || 'lucid_algorithms_jwt_secret');
        
        res.status(201).json({ 
            success: true, 
            token, 
            user: { id: user._id, email: user.email, fullName: user.fullName, balance: user.balance, demoBalance: user.demoBalance, isAdmin: user.isAdmin }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'Invalid email or password' });
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid email or password' });
        
        if (!user.isActive) {
            return res.status(400).json({ error: 'Account is deactivated. Contact support.' });
        }
        
        user.lastLogin = new Date();
        await user.save();
        
        const token = jwt.sign({ id: user._id, email: user.email, isAdmin: user.isAdmin }, process.env.JWT_SECRET || 'lucid_algorithms_jwt_secret');
        
        res.json({ 
            success: true, 
            token, 
            user: { id: user._id, email: user.email, fullName: user.fullName, balance: user.balance, demoBalance: user.demoBalance, isAdmin: user.isAdmin }
        });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// FORCE ADMIN LOGIN
app.post('/api/admin/force-login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) return res.status(400).json({ error: 'User not found' });
        if (!user.isAdmin) return res.status(400).json({ error: 'Not an admin account' });
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });
        
        if (!user.isActive) {
            user.isActive = true;
            await user.save();
        }
        
        user.lastLogin = new Date();
        await user.save();
        
        const token = jwt.sign({ id: user._id, email: user.email, isAdmin: true }, process.env.JWT_SECRET || 'lucid_algorithms_jwt_secret');
        
        res.json({ success: true, token, user: { id: user._id, email: user.email, fullName: user.fullName, balance: user.balance, demoBalance: user.demoBalance, isAdmin: true } });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// RESET ADMIN ACCOUNT
app.post('/api/admin/reset-admin', async (req, res) => {
    try {
        const { secret } = req.body;
        const ADMIN_SECRET = 'LucidAdmin2024!';
        
        if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Invalid secret key' });
        
        await User.deleteOne({ email: 'admin@lucidalgorithms.com' });
        
        const hashedPassword = await bcrypt.hash('Admin123!', 10);
        const admin = new User({
            email: 'admin@lucidalgorithms.com',
            password: hashedPassword,
            fullName: 'System Administrator',
            age: 30,
            country: 'United States',
            countryCode: '+1',
            phoneNumber: '1234567890',
            employmentStatus: 'Employed',
            tradingExperience: 'Expert',
            fundsSource: 'Business Revenue',
            termsAccepted: true,
            isAdmin: true,
            isActive: true,
            balance: 10000,
            demoBalance: 10000,
            aiApiKey: 'ADMIN2024KEY'
        });
        
        await admin.save();
        res.json({ success: true, message: 'Admin account created!', credentials: { email: 'admin@lucidalgorithms.com', password: 'Admin123!' } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reset admin' });
    }
});

// ============= USER PROFILE =============
app.get('/api/user/balance', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({ realBalance: user.balance, demoBalance: user.demoBalance });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch balance' });
    }
});

app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        const activeTrades = await Trade.find({ userId: req.user.id, status: 'active' }).sort({ startedAt: -1 });
        const tradeHistory = await Trade.find({ userId: req.user.id, status: 'completed' }).sort({ endedAt: -1 }).limit(50);
        const withdrawalHistory = await Withdrawal.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(20);
        
        res.json({ user, activeTrades, tradeHistory, withdrawalHistory });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// ============= AI PASSKEY ROUTES =============
app.post('/api/admin/generate-passkey/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const newPasskey = generatePasskey();
        user.aiApiKey = newPasskey;
        await user.save();
        
        res.json({ success: true, passkey: newPasskey, message: `Passkey generated for ${user.fullName}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate passkey' });
    }
});

app.delete('/api/admin/delete-passkey/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        user.aiApiKey = '';
        await user.save();
        
        res.json({ success: true, message: `Passkey revoked for ${user.fullName}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete passkey' });
    }
});

app.post('/api/ai/save-passkey', authenticateToken, async (req, res) => {
    try {
        const { passkey } = req.body;
        if (!passkey || passkey.trim() === '') return res.status(400).json({ error: 'Passkey cannot be empty' });
        await User.findByIdAndUpdate(req.user.id, { aiApiKey: passkey });
        res.json({ success: true, message: 'Passkey saved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save passkey' });
    }
});

app.delete('/api/ai/delete-passkey', authenticateToken, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.id, { aiApiKey: '' });
        res.json({ success: true, message: 'Passkey deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete passkey' });
    }
});

app.get('/api/ai/get-passkey', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({ success: true, passkey: user.aiApiKey || '' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get passkey' });
    }
});

// ============= MARKET ANALYSIS =============
function analyzeMarket(symbol, currentPrice, change24h, volume, volatility) {
    const analysis = { decision: null, confidence: 0, reasons: [], signals: [] };
    const rsi = 30 + Math.random() * 70;
    const macd = (Math.random() - 0.5) * 2;
    
    analysis.reasons.push(`📊 RSI: ${rsi.toFixed(2)} - ${rsi < 30 ? 'Oversold' : rsi > 70 ? 'Overbought' : 'Neutral'}`);
    analysis.reasons.push(`📈 MACD: ${macd > 0 ? 'Bullish' : 'Bearish'}`);
    analysis.reasons.push(`💰 24h Change: ${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%`);
    analysis.reasons.push(`⚡ Volume: ${volume > 1000000 ? 'High' : 'Normal'}`);
    analysis.reasons.push(`📉 Volatility: ${volatility > 2 ? 'High' : 'Normal'}`);
    
    let buyScore = 0, sellScore = 0;
    if (rsi < 40) buyScore += 30;
    if (rsi > 60) sellScore += 30;
    if (macd > 0) buyScore += 25;
    if (macd < 0) sellScore += 25;
    if (change24h > 0) buyScore += 20;
    if (change24h < -2) sellScore += 20;
    if (volatility > 2) buyScore += 15;
    
    if (buyScore > sellScore) {
        analysis.decision = 'buy';
        analysis.confidence = Math.min(95, Math.max(55, 55 + (buyScore - sellScore)));
        analysis.signals.push('🚀 Bullish momentum detected');
    } else {
        analysis.decision = 'sell';
        analysis.confidence = Math.min(95, Math.max(55, 55 + (sellScore - buyScore)));
        analysis.signals.push('📉 Bearish pressure building');
    }
    return analysis;
}

// ============= UPDATE ACTIVE TRADES WITH NEW PROFIT LOGIC =============
async function updateActiveTrades() {
    const activeTrades = await Trade.find({ status: 'active' });
    const now = Date.now();
    
    for (const trade of activeTrades) {
        const startedAt = new Date(trade.startedAt).getTime();
        const elapsed = now - startedAt;
        
        let simulatedPrice = trade.entryPrice;
        
        if (trade.side === 'buy') {
            const movement = (Math.random() - 0.48) * 0.001;
            simulatedPrice = trade.entryPrice * (1 + (elapsed / trade.durationMs * 0.0005) + movement);
        } else {
            const movement = (Math.random() - 0.52) * 0.001;
            simulatedPrice = trade.entryPrice * (1 - (elapsed / trade.durationMs * 0.0005) + movement);
        }
        
        trade.exitPrice = simulatedPrice;
        
        if (elapsed >= trade.durationMs) {
            // Calculate profit multiplier based on amount and duration
            const multiplier = calculateProfitMultiplier(trade.amount, trade.durationMs);
            const isWin = Math.random() < 0.7;
            let profit = isWin ? trade.amount * multiplier : -10;
            
            trade.profit = profit;
            trade.profitMultiplier = multiplier;
            trade.status = 'completed';
            trade.endedAt = new Date();
            
            const user = await User.findById(trade.userId);
            if (user) {
                const amountToReturn = trade.amount + profit;
                
                if (trade.isDemo) {
                    user.demoBalance = user.demoBalance + amountToReturn;
                } else {
                    user.balance = user.balance + amountToReturn;
                }
                
                if (profit > 0) {
                    user.totalProfit = (user.totalProfit || 0) + profit;
                } else {
                    user.totalLoss = (user.totalLoss || 0) + Math.abs(profit);
                }
                user.totalTrades = (user.totalTrades || 0) + 1;
                
                const completedTrades = await Trade.find({ userId: trade.userId, status: 'completed' });
                const wins = completedTrades.filter(t => t.profit > 0).length;
                user.winRate = completedTrades.length > 0 ? (wins / completedTrades.length) * 100 : 0;
                
                await user.save();
                
                // Calculate profit percentage for display
                const profitPercent = (profit / trade.amount) * 100;
                const multiplierText = multiplier === 3 ? '300% (3x)' : multiplier === 2 ? '200% (2x)' : '88%';
                
                const transaction = new Transaction({
                    userId: user._id,
                    isDemo: trade.isDemo,
                    userName: user.fullName,
                    type: 'profit',
                    amount: Math.abs(profit),
                    transactionId: 'TRADE_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    description: `${trade.isDemo ? '[DEMO] ' : ''}${trade.side.toUpperCase()} trade on ${trade.symbolName} completed. ${profit >= 0 ? `WIN! +${profitPercent.toFixed(0)}% (${multiplierText} multiplier)` : `LOSS: -$${Math.abs(profit).toFixed(2)}`}`
                });
                await transaction.save();
                
                console.log(`Trade completed: $${trade.amount} @ ${multiplierText} multiplier → ${profit >= 0 ? 'WIN' : 'LOSS'} $${profit.toFixed(2)}`);
            }
        }
        await trade.save();
    }
}

setInterval(updateActiveTrades, 5000);

// ============= AI START TRADE =============
app.post('/api/ai/start-trade', authenticateToken, async (req, res) => {
    try {
        const { symbol, symbolName, category, amount, leverage, duration, durationMs, passkey, isDemo } = req.body;
        
        const user = await User.findById(req.user.id);
        
        if (user.aiApiKey !== passkey) {
            return res.status(400).json({ error: 'Invalid AI Passkey' });
        }
        
        if (amount < 115) {
            return res.status(400).json({ error: 'Minimum AI trade amount is $115 USD' });
        }
        
        const currentBalance = isDemo ? user.demoBalance : user.balance;
        if (amount > currentBalance) {
            return res.status(400).json({ error: `Insufficient ${isDemo ? 'demo' : 'real'} balance` });
        }
        
        let currentPrice = 0, change24h = 0, volume = 0;
        
        try {
            if (category === 'crypto') {
                const response = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
                currentPrice = parseFloat(response.data.lastPrice);
                change24h = parseFloat(response.data.priceChangePercent);
                volume = parseFloat(response.data.quoteVolume);
            } else {
                currentPrice = 100 + Math.random() * 900;
                change24h = (Math.random() - 0.5) * 3;
                volume = 1000000 + Math.random() * 10000000;
            }
        } catch (e) {
            currentPrice = 50000 + Math.random() * 20000;
            change24h = (Math.random() - 0.5) * 5;
            volume = 10000000;
        }
        
        const volatility = Math.abs(change24h);
        const analysis = analyzeMarket(symbol, currentPrice, change24h, volume, volatility);
        const side = analysis.decision;
        
        if (isDemo) {
            user.demoBalance = user.demoBalance - amount;
        } else {
            user.balance = user.balance - amount;
        }
        await user.save();
        
        let durationText = duration;
        switch(duration) {
            case '3m': durationText = '3 minutes'; break;
            case '5m': durationText = '5 minutes'; break;
            case '15m': durationText = '15 minutes'; break;
            case '30m': durationText = '30 minutes'; break;
            case '1h': durationText = '1 hour'; break;
            case '4h': durationText = '4 hours'; break;
            case '1d': durationText = '1 day'; break;
            case '1w': durationText = '1 week'; break;
        }
        
        const trade = new Trade({
            userId: user._id,
            isDemo: isDemo || false,
            symbol,
            symbolName,
            category,
            side,
            amount,
            leverage,
            duration: durationText,
            durationMs,
            entryPrice: currentPrice,
            analysis: analysis.reasons.join(' | '),
            aiPasskey: passkey,
            status: 'active'
        });
        
        await trade.save();
        
        // Calculate expected multiplier for display
        const expectedMultiplier = calculateProfitMultiplier(amount, durationMs);
        const expectedProfitPercent = expectedMultiplier * 100;
        
        res.json({
            success: true,
            trade: trade,
            analysis: {
                decision: side,
                confidence: analysis.confidence,
                reasons: analysis.reasons,
                signals: analysis.signals,
                entryPrice: currentPrice,
                expectedProfit: amount * expectedMultiplier,
                expectedReturn: `${expectedProfitPercent}%`
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to start AI trade' });
    }
});

app.post('/api/ai/stop-trade/:tradeId', authenticateToken, async (req, res) => {
    try {
        const trade = await Trade.findOne({ _id: req.params.tradeId, userId: req.user.id, status: 'active' });
        if (!trade) return res.status(404).json({ error: 'Active trade not found' });
        
        trade.status = 'stopped';
        trade.endedAt = new Date();
        
        const profit = -10;
        trade.profit = profit;
        
        const user = await User.findById(req.user.id);
        if (user) {
            const amountToReturn = trade.amount + profit;
            if (trade.isDemo) {
                user.demoBalance = user.demoBalance + amountToReturn;
            } else {
                user.balance = user.balance + amountToReturn;
            }
            user.totalLoss = (user.totalLoss || 0) + Math.abs(profit);
            await user.save();
        }
        await trade.save();
        res.json({ success: true, profit: profit });
    } catch (error) {
        res.status(500).json({ error: 'Failed to stop trade' });
    }
});

// ============= DEPOSIT REQUEST ROUTES =============
app.post('/api/deposit/request', authenticateToken, async (req, res) => {
    try {
        const { amount, email, network, crypto, walletAddress } = req.body;
        const user = await User.findById(req.user.id);
        
        if (amount < 80) return res.status(400).json({ error: 'Minimum deposit is $80 USD' });
        
        const depositId = 'DEP_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
        
        const depositRequest = new DepositRequest({
            userId: user._id,
            userName: user.fullName,
            userEmail: user.email,
            amount: amount,
            crypto: crypto || '',
            network: network || '',
            walletAddress: walletAddress || '',
            transactionId: depositId,
            status: 'pending'
        });
        await depositRequest.save();
        res.json({ success: true, depositId: depositRequest._id, message: 'Deposit request submitted. Admin will approve shortly.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create deposit request' });
    }
});

app.get('/api/deposit/status/:depositId', authenticateToken, async (req, res) => {
    try {
        const deposit = await DepositRequest.findOne({ _id: req.params.depositId, userId: req.user.id });
        if (!deposit) return res.status(404).json({ error: 'Deposit request not found' });
        res.json({ status: deposit.status, amount: deposit.amount, createdAt: deposit.createdAt });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check deposit status' });
    }
});

app.get('/api/admin/deposit-requests', authenticateToken, isAdmin, async (req, res) => {
    try {
        const deposits = await DepositRequest.find().sort({ createdAt: -1 });
        res.json(deposits);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch deposit requests' });
    }
});

app.post('/api/admin/deposit-requests/:depositId/approve', authenticateToken, isAdmin, async (req, res) => {
    try {
        const deposit = await DepositRequest.findById(req.params.depositId);
        if (!deposit) return res.status(404).json({ error: 'Deposit request not found' });
        if (deposit.status !== 'pending') return res.status(400).json({ error: 'Deposit already processed' });
        
        const user = await User.findById(deposit.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        user.balance = (user.balance || 0) + deposit.amount;
        user.totalDeposits = (user.totalDeposits || 0) + deposit.amount;
        await user.save();
        
        deposit.status = 'completed';
        deposit.processedAt = new Date();
        deposit.processedBy = req.user.email;
        await deposit.save();
        
        const transaction = new Transaction({
            userId: user._id,
            userName: user.fullName,
            type: 'deposit',
            amount: deposit.amount,
            status: 'completed',
            transactionId: deposit.transactionId,
            description: `Deposit approved by admin - $${deposit.amount} added`,
            adminName: req.user.email
        });
        await transaction.save();
        res.json({ success: true, message: `$${deposit.amount} added to ${user.fullName}'s balance` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to approve deposit' });
    }
});

app.post('/api/admin/deposit-requests/:depositId/reject', authenticateToken, isAdmin, async (req, res) => {
    try {
        const deposit = await DepositRequest.findById(req.params.depositId);
        if (!deposit) return res.status(404).json({ error: 'Deposit request not found' });
        if (deposit.status !== 'pending') return res.status(400).json({ error: 'Deposit already processed' });
        
        deposit.status = 'rejected';
        deposit.processedAt = new Date();
        deposit.processedBy = req.user.email;
        await deposit.save();
        res.json({ success: true, message: 'Deposit request rejected' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reject deposit' });
    }
});

// ============= WITHDRAWAL ROUTES (5% FEE) =============
app.post('/api/withdrawal/request', authenticateToken, async (req, res) => {
    try {
        const { amount, network, address } = req.body;
        const user = await User.findById(req.user.id);
        
        if (amount < 50) return res.status(400).json({ error: 'Minimum withdrawal is $50' });
        
        const feeAmount = amount * 0.05; // 5% withdrawal fee
        const netAmount = amount - feeAmount;
        
        if (amount > user.balance) return res.status(400).json({ error: 'Insufficient balance' });
        
        user.balance = user.balance - amount;
        await user.save();
        
        const withdrawal = new Withdrawal({
            userId: user._id,
            userName: user.fullName,
            amount: amount,
            feeAmount: feeAmount,
            network: network,
            walletAddress: address,
            status: 'pending'
        });
        await withdrawal.save();
        
        const transaction = new Transaction({
            userId: user._id,
            userName: user.fullName,
            type: 'withdrawal',
            amount: amount,
            withdrawalFee: feeAmount,
            transactionId: 'WD_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            description: `Withdrawal request to ${network} address (5% fee: $${feeAmount.toFixed(2)})`,
            status: 'pending'
        });
        await transaction.save();
        
        res.json({ success: true, message: 'Withdrawal request submitted', feeAmount: feeAmount, netAmount: netAmount });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process withdrawal' });
    }
});

// ============= CHAT ROUTES =============
app.get('/api/chat/messages', authenticateToken, async (req, res) => {
    try {
        const messages = await ChatMessage.find({ userId: req.user.id }).sort({ createdAt: 1 });
        await ChatMessage.updateMany({ userId: req.user.id, sender: 'admin', isRead: false }, { $set: { isRead: true } });
        res.json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

app.post('/api/chat/send', authenticateToken, async (req, res) => {
    try {
        const { message } = req.body;
        const user = await User.findById(req.user.id);
        if (!message || message.trim() === '') return res.status(400).json({ error: 'Message cannot be empty' });
        
        const chatMessage = new ChatMessage({
            userId: user._id,
            userName: user.fullName,
            userEmail: user.email,
            message: message.trim(),
            sender: 'user',
            isRead: false
        });
        await chatMessage.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message' });
    }
});

app.get('/api/chat/unread-count', authenticateToken, async (req, res) => {
    try {
        const count = await ChatMessage.countDocuments({ userId: req.user.id, sender: 'admin', isRead: false });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get unread count' });
    }
});

app.post('/api/chat/mark-read', authenticateToken, async (req, res) => {
    try {
        await ChatMessage.updateMany({ userId: req.user.id, sender: 'admin', isRead: false }, { $set: { isRead: true } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});

// ============= ADMIN CHAT ROUTES =============
app.get('/api/admin/chat/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const usersWithChats = await ChatMessage.aggregate([
            { $sort: { createdAt: -1 } },
            { $group: {
                _id: '$userId',
                userName: { $first: '$userName' },
                userEmail: { $first: '$userEmail' },
                lastMessage: { $first: '$message' },
                lastMessageTime: { $first: '$createdAt' },
                unreadCount: { $sum: { $cond: [{ $and: [{ $eq: ['$sender', 'user'] }, { $eq: ['$isRead', false] }] }, 1, 0] } }
            }},
            { $sort: { lastMessageTime: -1 } }
        ]);
        res.json({ success: true, users: usersWithChats });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch chat users' });
    }
});

app.get('/api/admin/chat/messages/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const messages = await ChatMessage.find({ userId: req.params.userId }).sort({ createdAt: 1 });
        await ChatMessage.updateMany({ userId: req.params.userId, sender: 'user', isRead: false }, { $set: { isRead: true } });
        res.json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

app.post('/api/admin/chat/send', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId, message } = req.body;
        const user = await User.findById(userId);
        if (!message || message.trim() === '') return res.status(400).json({ error: 'Message cannot be empty' });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const chatMessage = new ChatMessage({
            userId: user._id,
            userName: user.fullName,
            userEmail: user.email,
            message: message.trim(),
            sender: 'admin',
            isRead: false
        });
        await chatMessage.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send reply' });
    }
});

app.post('/api/admin/chat/mark-read/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        await ChatMessage.updateMany({ userId: req.params.userId, sender: 'user', isRead: false }, { $set: { isRead: true } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});

// ============= ADMIN ROUTES =============
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const users = await User.find({}, '-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.get('/api/admin/users/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        const transactions = await Transaction.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(20);
        res.json({ user, transactions });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
});

app.post('/api/admin/add-balance', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId, amount, description } = req.body;
        const admin = await User.findById(req.user.id);
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        user.balance = user.balance + amount;
        user.totalDeposits = (user.totalDeposits || 0) + amount;
        await user.save();
        
        const transaction = new Transaction({
            userId: user._id,
            userName: user.fullName,
            type: 'admin_deposit',
            amount: amount,
            transactionId: 'ADMIN_DEP_' + Date.now(),
            description: description || 'Admin deposit',
            adminName: admin.fullName
        });
        await transaction.save();
        res.json({ success: true, message: `Added $${amount} to ${user.fullName}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add balance' });
    }
});

app.post('/api/admin/deduct-balance', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId, amount, description } = req.body;
        const admin = await User.findById(req.user.id);
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });
        
        user.balance = user.balance - amount;
        await user.save();
        
        const transaction = new Transaction({
            userId: user._id,
            userName: user.fullName,
            type: 'admin_deduct',
            amount: amount,
            transactionId: 'ADMIN_WD_' + Date.now(),
            description: description || 'Admin deduction',
            adminName: admin.fullName
        });
        await transaction.save();
        res.json({ success: true, message: `Deducted $${amount} from ${user.fullName}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to deduct balance' });
    }
});

app.put('/api/admin/users/:userId/toggle-status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        user.isActive = !user.isActive;
        await user.save();
        res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

app.get('/api/admin/transactions', authenticateToken, isAdmin, async (req, res) => {
    try {
        const transactions = await Transaction.find().sort({ createdAt: -1 }).limit(100);
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const totalBalance = await User.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]);
        const totalProfit = await User.aggregate([{ $group: { _id: null, total: { $sum: '$totalProfit' } } }]);
        res.json({ totalUsers, activeUsers, totalBalance: totalBalance[0]?.total || 0, totalProfit: totalProfit[0]?.total || 0 });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.get('/api/admin/withdrawals', authenticateToken, isAdmin, async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find().sort({ createdAt: -1 });
        res.json(withdrawals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch withdrawals' });
    }
});

app.post('/api/admin/withdrawals/:withdrawalId/process', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const withdrawal = await Withdrawal.findById(req.params.withdrawalId);
        if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
        
        withdrawal.status = status;
        withdrawal.processedAt = new Date();
        withdrawal.processedBy = req.user.email;
        await withdrawal.save();
        
        if (status === 'rejected') {
            const user = await User.findById(withdrawal.userId);
            if (user) {
                user.balance = user.balance + withdrawal.amount;
                await user.save();
            }
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process withdrawal' });
    }
});

// ============= CREATE DEFAULT ADMIN =============
async function createDefaultAdmin() {
    try {
        const adminExists = await User.findOne({ email: 'admin@lucidalgorithms.com' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('Admin123!', 10);
            const admin = new User({
                email: 'admin@lucidalgorithms.com',
                password: hashedPassword,
                fullName: 'System Administrator',
                age: 30,
                country: 'United States',
                countryCode: '+1',
                phoneNumber: '1234567890',
                employmentStatus: 'Employed',
                tradingExperience: 'Expert',
                fundsSource: 'Business Revenue',
                termsAccepted: true,
                isAdmin: true,
                isActive: true,
                balance: 10000,
                demoBalance: 10000,
                aiApiKey: 'ADMIN2024KEY'
            });
            await admin.save();
            console.log('✅ Default admin created: admin@lucidalgorithms.com / Admin123!');
        } else {
            console.log('✅ Admin already exists');
            if (!adminExists.isActive) {
                adminExists.isActive = true;
                await adminExists.save();
                console.log('✅ Admin account activated');
            }
        }
    } catch (error) {
        console.error('Error creating admin:', error);
    }
}

// Clean up old messages
async function cleanupOldMessages() {
    try {
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        await ChatMessage.deleteMany({ createdAt: { $lt: twoDaysAgo } });
    } catch (error) {
        console.error('Error cleaning up messages:', error);
    }
}

setInterval(cleanupOldMessages, 6 * 60 * 60 * 1000);

// Serve HTML files
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/profile.html', (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/deposit', (req, res) => res.sendFile(path.join(__dirname, 'deposit.html')));
app.get('/deposit.html', (req, res) => res.sendFile(path.join(__dirname, 'deposit.html')));
app.get('/withdraw', (req, res) => res.sendFile(path.join(__dirname, 'withdraw.html')));
app.get('/withdraw.html', (req, res) => res.sendFile(path.join(__dirname, 'withdraw.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));
app.get('/terms.html', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));
app.get('/privacy.html', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));

app.listen(PORT, async () => {
    await createDefaultAdmin();
    console.log(`🚀 Lucid Algorithms Server running on http://localhost:${PORT}`);
    console.log(`✅ MongoDB: lucidalgorithms database`);
    console.log(`💰 New Profit Rules:`);
    console.log(`   - Trades $500+ with 1h+ duration → 200% profit (2x)`);
    console.log(`   - Trades $2000+ with 1h+ duration → 300% profit (3x)`);
    console.log(`   - Regular trades → 88% profit`);
    console.log(`💸 Withdrawal fee: 5% of total amount`);
    console.log(`🔐 Admin Login: admin@lucidalgorithms.com / Admin123!`);
});