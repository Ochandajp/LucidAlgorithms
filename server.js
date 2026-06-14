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

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const MONGODB_URI = 'mongodb+srv://LucidAlgorithm:Lucid@cluster0.kcqdr6j.mongodb.net/?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, { dbName: 'lucidalgorithms' })
  .then(() => console.log('✅ Connected to MongoDB'))
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
    demoBalance: { type: Number, default: 5000 },
    totalDeposits: { type: Number, default: 0 },
    totalProfit: { type: Number, default: 0 },
    totalLoss: { type: Number, default: 0 },
    winRate: { type: Number, default: 100 },
    totalTrades: { type: Number, default: 0 },
    customWithdrawalMin: { type: Number, default: null },
    customInvestmentMin: { type: Number, default: null },   // NEW: per-user real investment min
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    isAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    withdrawalAddress: { type: String, default: '' },
    termsAccepted: { type: Boolean, required: true },
    termsAcceptedAt: { type: Date },
    isFromUSA: { type: String, default: 'no' },
    expectedDeposit: { type: String, default: '' },
    aiApiKey: { type: String, default: '' },
    kycStatus: { type: String, enum: ['not_submitted', 'pending', 'verified', 'rejected'], default: 'not_submitted' }
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
    profitMultiplier: { type: Number, default: 0.88 },
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
    amount: { type: Number, required: true, min: 50 },
    crypto: { type: String, default: '' },
    network: { type: String, default: '' },
    walletAddress: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'completed', 'rejected'], default: 'pending' },
    transactionId: { type: String, unique: true, sparse: true },
    createdAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    processedBy: { type: String }
});

const chatMessageSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    message: { type: String, required: true },
    sender: { type: String, enum: ['user', 'admin'], required: true },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: 172800 }
});

const walletAddressSchema = new mongoose.Schema({
    network: { type: String, required: true, unique: true },
    crypto: { type: String, required: true },
    address: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const systemSettingsSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: Date.now }
});

const kycSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    idType: { type: String, enum: ['passport', 'drivers_license', 'id_card'], required: true },
    dateOfBirth: { type: Date, required: true },
    fileName: { type: String, required: true },
    fileType: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    rejectionReason: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date },
    verifiedBy: { type: String }
});

const User = mongoose.model('User', userSchema);
const Trade = mongoose.model('Trade', tradeSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
const DepositRequest = mongoose.model('DepositRequest', depositRequestSchema);
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
const WalletAddress = mongoose.model('WalletAddress', walletAddressSchema);
const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);
const KYC = mongoose.model('KYC', kycSchema);

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

function calculateProfitMultiplier(amount, durationMs) {
    const durationHours = durationMs / (1000 * 60 * 60);
    if (durationHours >= 1) {
        if (amount >= 2000) return 3.0;
        if (amount >= 500) return 2.0;
    }
    return 0.88;
}

// ============= AUTH ROUTES =============
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, fullName, age, country, countryCode, phoneNumber, employmentStatus, tradingExperience, fundsSource, termsAccepted, isFromUSA, expectedDeposit } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'Email already registered' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            email, password: hashedPassword, fullName, age, country, countryCode, phoneNumber,
            employmentStatus, tradingExperience, fundsSource, termsAccepted, termsAcceptedAt: new Date(),
            isFromUSA: isFromUSA || 'no', expectedDeposit: expectedDeposit || '',
            balance: 0, demoBalance: 5000, isAdmin: email === 'admin@lucidalgorithms.com',
            kycStatus: 'not_submitted'
        });
        await user.save();
        const token = jwt.sign({ id: user._id, email: user.email, isAdmin: user.isAdmin }, process.env.JWT_SECRET || 'lucid_algorithms_jwt_secret');
        res.status(201).json({ success: true, token, user: { id: user._id, email: user.email, fullName: user.fullName, balance: user.balance, demoBalance: user.demoBalance, isAdmin: user.isAdmin, kycStatus: user.kycStatus } });
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
        if (!user.isActive) return res.status(400).json({ error: 'Account is deactivated. Contact support.' });
        user.lastLogin = new Date();
        await user.save();
        const token = jwt.sign({ id: user._id, email: user.email, isAdmin: user.isAdmin }, process.env.JWT_SECRET || 'lucid_algorithms_jwt_secret');
        res.json({ success: true, token, user: { id: user._id, email: user.email, fullName: user.fullName, balance: user.balance, demoBalance: user.demoBalance, isAdmin: user.isAdmin, kycStatus: user.kycStatus } });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// ============= USER PROFILE =============
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        const activeTrades = await Trade.find({ userId: req.user.id, status: 'active' }).sort({ startedAt: -1 });
        const tradeHistory = await Trade.find({ userId: req.user.id, status: 'completed' }).sort({ endedAt: -1 }).limit(50);
        const withdrawalHistory = await Withdrawal.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(20);
        const kyc = await KYC.findOne({ userId: req.user.id });
        res.json({ user, activeTrades, tradeHistory, withdrawalHistory, kyc });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// ============= WALLET ADDRESS ROUTES =============
app.get('/api/wallet-addresses', authenticateToken, async (req, res) => {
    try {
        const addresses = await WalletAddress.find({ isActive: true });
        res.json({ success: true, addresses });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch wallet addresses' });
    }
});

app.get('/api/admin/wallet-addresses', authenticateToken, isAdmin, async (req, res) => {
    try {
        const addresses = await WalletAddress.find();
        res.json({ success: true, addresses });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch wallet addresses' });
    }
});

app.post('/api/admin/wallet-addresses', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { network, crypto, address } = req.body;
        if (!network || !crypto || !address) {
            return res.status(400).json({ error: 'Network, crypto, and address are required' });
        }
        await WalletAddress.findOneAndUpdate(
            { network: network },
            { network, crypto, address, isActive: true, updatedAt: new Date() },
            { upsert: true }
        );
        res.json({ success: true, message: `Wallet address for ${network} saved successfully` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save wallet address' });
    }
});

app.delete('/api/admin/wallet-addresses/:network', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { network } = req.params;
        await WalletAddress.findOneAndDelete({ network: network });
        res.json({ success: true, message: `Wallet address for ${network} deleted successfully` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete wallet address' });
    }
});

app.post('/api/admin/wallet-addresses/:network/toggle', authenticateToken, isAdmin, async (req, res) => {
    try {
        const wallet = await WalletAddress.findOne({ network: req.params.network });
        if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
        wallet.isActive = !wallet.isActive;
        wallet.updatedAt = new Date();
        await wallet.save();
        res.json({ success: true, message: `Wallet ${wallet.isActive ? 'activated' : 'deactivated'}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle wallet status' });
    }
});

// ============= WITHDRAWAL MINIMUM ROUTES =============
app.get('/api/user/withdrawal-min', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const globalSetting = await SystemSettings.findOne({ key: 'global_withdrawal_min' });
        const minAmount = user.customWithdrawalMin || (globalSetting ? globalSetting.value : 50);
        res.json({ minAmount });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get withdrawal minimum' });
    }
});

app.post('/api/admin/user/withdrawal-min/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { minAmount } = req.body;
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        user.customWithdrawalMin = minAmount;
        await user.save();
        res.json({ success: true, message: `Withdrawal minimum set to $${minAmount} for ${user.fullName}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to set withdrawal minimum' });
    }
});

app.get('/api/admin/global/withdrawal-min', authenticateToken, isAdmin, async (req, res) => {
    try {
        const setting = await SystemSettings.findOne({ key: 'global_withdrawal_min' });
        res.json({ minAmount: setting ? setting.value : 50 });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get global withdrawal minimum' });
    }
});

app.post('/api/admin/global/withdrawal-min', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { minAmount } = req.body;
        await SystemSettings.findOneAndUpdate(
            { key: 'global_withdrawal_min' },
            { key: 'global_withdrawal_min', value: minAmount, updatedAt: new Date() },
            { upsert: true }
        );
        res.json({ success: true, message: `Global withdrawal minimum set to $${minAmount}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to set global withdrawal minimum' });
    }
});

// ============= INVESTMENT MINIMUM ROUTES (NEW) =============
// For real account only – demo always $50
app.get('/api/user/investment-min', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const globalSetting = await SystemSettings.findOne({ key: 'global_investment_min' });
        // Default to 140 if nothing set
        const minAmount = user.customInvestmentMin || (globalSetting ? globalSetting.value : 140);
        res.json({ minAmount });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get investment minimum' });
    }
});

app.post('/api/admin/user/investment-min/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { minAmount } = req.body;
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        user.customInvestmentMin = minAmount;
        await user.save();
        res.json({ success: true, message: `Investment minimum set to $${minAmount} for ${user.fullName}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to set investment minimum' });
    }
});

app.get('/api/admin/global/investment-min', authenticateToken, isAdmin, async (req, res) => {
    try {
        const setting = await SystemSettings.findOne({ key: 'global_investment_min' });
        res.json({ minAmount: setting ? setting.value : 140 });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get global investment minimum' });
    }
});

app.post('/api/admin/global/investment-min', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { minAmount } = req.body;
        await SystemSettings.findOneAndUpdate(
            { key: 'global_investment_min' },
            { key: 'global_investment_min', value: minAmount, updatedAt: new Date() },
            { upsert: true }
        );
        res.json({ success: true, message: `Global investment minimum set to $${minAmount}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to set global investment minimum' });
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
        res.json({ success: true, passkey: newPasskey });
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
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete passkey' });
    }
});

app.post('/api/ai/save-passkey', authenticateToken, async (req, res) => {
    try {
        const { passkey } = req.body;
        if (!passkey) return res.status(400).json({ error: 'Passkey cannot be empty' });
        await User.findByIdAndUpdate(req.user.id, { aiApiKey: passkey });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save passkey' });
    }
});

app.delete('/api/ai/delete-passkey', authenticateToken, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.id, { aiApiKey: '' });
        res.json({ success: true });
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

// ============= TRADING FUNCTIONS =============
function analyzeMarket(symbol, currentPrice, change24h, volume, volatility) {
    const analysis = { decision: null, confidence: 0, reasons: [] };
    const rsi = 30 + Math.random() * 70;
    const macd = (Math.random() - 0.5) * 2;
    analysis.reasons.push(`📊 RSI: ${rsi.toFixed(2)}`);
    analysis.reasons.push(`📈 MACD: ${macd > 0 ? 'Bullish' : 'Bearish'}`);
    let buyScore = 0, sellScore = 0;
    if (rsi < 40) buyScore += 30;
    if (rsi > 60) sellScore += 30;
    if (macd > 0) buyScore += 25;
    if (macd < 0) sellScore += 25;
    if (buyScore > sellScore) {
        analysis.decision = 'buy';
        analysis.confidence = Math.min(95, 55 + (buyScore - sellScore));
    } else {
        analysis.decision = 'sell';
        analysis.confidence = Math.min(95, 55 + (sellScore - buyScore));
    }
    return analysis;
}

async function updateActiveTrades() {
    const activeTrades = await Trade.find({ status: 'active' });
    const now = Date.now();
    for (const trade of activeTrades) {
        const startedAt = new Date(trade.startedAt).getTime();
        const elapsed = now - startedAt;
        if (elapsed >= trade.durationMs) {
            const multiplier = calculateProfitMultiplier(trade.amount, trade.durationMs);
            const profit = trade.amount * multiplier;
            trade.profit = profit;
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
                user.totalProfit = (user.totalProfit || 0) + profit;
                user.totalTrades = (user.totalTrades || 0) + 1;
                await user.save();
            }
        }
        await trade.save();
    }
}
setInterval(updateActiveTrades, 5000);

app.post('/api/ai/start-trade', authenticateToken, async (req, res) => {
    try {
        const { symbol, symbolName, category, amount, leverage, duration, durationMs, passkey, isDemo, entryPrice } = req.body;
        const user = await User.findById(req.user.id);
        if (user.aiApiKey !== passkey) return res.status(400).json({ error: 'Invalid AI Passkey' });
        
        // Minimum amount logic
        let minAmount;
        if (isDemo) {
            minAmount = 50; // Demo fixed at 50
        } else {
            // Get real account minimum (global or per-user)
            const globalSetting = await SystemSettings.findOne({ key: 'global_investment_min' });
            const globalMin = globalSetting ? globalSetting.value : 140;
            minAmount = user.customInvestmentMin || globalMin;
        }
        
        if (amount < minAmount) return res.status(400).json({ error: `Minimum trade amount is $${minAmount} USD` });
        
        const currentBalance = isDemo ? user.demoBalance : user.balance;
        if (amount > currentBalance) return res.status(400).json({ error: 'Insufficient funds' });
        
        let currentPrice = entryPrice || 50000;
        try {
            if (category === 'crypto') {
                const response = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
                currentPrice = parseFloat(response.data.lastPrice);
            }
        } catch (e) {}
        
        const analysis = analyzeMarket(symbol, currentPrice, 0, 0, 0);
        const side = analysis.decision;
        if (isDemo) {
            user.demoBalance = user.demoBalance - amount;
        } else {
            user.balance = user.balance - amount;
        }
        await user.save();
        const trade = new Trade({
            userId: user._id, isDemo: isDemo || false, symbol, symbolName, category, side,
            amount, leverage, duration, durationMs, entryPrice: currentPrice,
            analysis: analysis.reasons.join(' | '), aiPasskey: passkey, status: 'active'
        });
        await trade.save();
        res.json({ success: true, trade, analysis: { decision: side, confidence: analysis.confidence, reasons: analysis.reasons, entryPrice: currentPrice, expectedProfit: amount * 0.88 } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to start AI trade' });
    }
});

app.post('/api/ai/stop-trade/:tradeId', authenticateToken, async (req, res) => {
    try {
        const trade = await Trade.findOne({ _id: req.params.tradeId, userId: req.user.id, status: 'active' });
        if (!trade) return res.status(404).json({ error: 'Active trade not found' });
        trade.status = 'stopped';
        trade.endedAt = new Date();
        const profit = trade.amount * 0.44;
        trade.profit = profit;
        const user = await User.findById(req.user.id);
        if (user) {
            const amountToReturn = trade.amount + profit;
            if (trade.isDemo) {
                user.demoBalance = user.demoBalance + amountToReturn;
            } else {
                user.balance = user.balance + amountToReturn;
            }
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
        const user = await User.findById(req.user.id);
        if (user.kycStatus !== 'verified') {
            return res.status(403).json({ error: 'Identity verification required. Please complete KYC verification in your profile before making a deposit.' });
        }
        const { amount, network, crypto, walletAddress } = req.body;
        if (amount < 50) return res.status(400).json({ error: 'Minimum deposit is $50 USD' });
        const txId = 'DEP_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const depositRequest = new DepositRequest({
            userId: user._id, userName: user.fullName, userEmail: user.email,
            amount, crypto: crypto || '', network: network || '', walletAddress: walletAddress || '',
            transactionId: txId, status: 'pending'
        });
        await depositRequest.save();
        res.json({ success: true, depositId: depositRequest._id });
    } catch (error) {
        if (error.code === 11000) {
            const txId = 'DEP_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
            const depositRequest = new DepositRequest({
                userId: user._id, userName: user.fullName, userEmail: user.email,
                amount, crypto: crypto || '', network: network || '', walletAddress: walletAddress || '',
                transactionId: txId, status: 'pending'
            });
            await depositRequest.save();
            res.json({ success: true, depositId: depositRequest._id });
        } else {
            res.status(500).json({ error: 'Failed to create deposit request' });
        }
    }
});

app.get('/api/deposit/status/:depositId', authenticateToken, async (req, res) => {
    try {
        const deposit = await DepositRequest.findOne({ _id: req.params.depositId, userId: req.user.id });
        if (!deposit) return res.status(404).json({ error: 'Deposit request not found' });
        res.json({ status: deposit.status, amount: deposit.amount });
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
        if (!deposit) return res.status(404).json({ error: 'Deposit not found' });
        if (deposit.status !== 'pending') return res.status(400).json({ error: 'Deposit already processed' });
        const user = await User.findById(deposit.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        user.balance = (user.balance || 0) + deposit.amount;
        user.totalDeposits = (user.totalDeposits || 0) + deposit.amount;
        await user.save();
        deposit.status = 'completed';
        deposit.processedAt = new Date();
        await deposit.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to approve deposit' });
    }
});

app.post('/api/admin/deposit-requests/:depositId/reject', authenticateToken, isAdmin, async (req, res) => {
    try {
        const deposit = await DepositRequest.findById(req.params.depositId);
        if (!deposit) return res.status(404).json({ error: 'Deposit not found' });
        deposit.status = 'rejected';
        deposit.processedAt = new Date();
        await deposit.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reject deposit' });
    }
});

// ============= WITHDRAWAL ROUTES =============
app.post('/api/withdrawal/request', authenticateToken, async (req, res) => {
    try {
        const { amount, network, address } = req.body;
        const user = await User.findById(req.user.id);
        const userMin = user.customWithdrawalMin || 50;
        if (amount < userMin) return res.status(400).json({ error: `Minimum withdrawal is $${userMin} USD` });
        const feeAmount = amount * 0.07;
        if (amount > user.balance) return res.status(400).json({ error: 'Insufficient balance' });
        user.balance = user.balance - amount;
        await user.save();
        const withdrawal = new Withdrawal({ userId: user._id, userName: user.fullName, amount, feeAmount, network, walletAddress: address, status: 'pending' });
        await withdrawal.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process withdrawal' });
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

// ============= ADMIN USERS ROUTES =============
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
        const kyc = await KYC.findOne({ userId: req.params.userId });
        res.json({ user, transactions, kyc });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
});

app.delete('/api/admin/users/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        if (userId === req.user.id) return res.status(400).json({ error: 'You cannot delete your own admin account' });
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.isAdmin) return res.status(400).json({ error: 'Cannot delete other admin accounts' });
        await Trade.deleteMany({ userId: userId });
        await Transaction.deleteMany({ userId: userId });
        await Withdrawal.deleteMany({ userId: userId });
        await DepositRequest.deleteMany({ userId: userId });
        await ChatMessage.deleteMany({ userId: userId });
        await KYC.findOneAndDelete({ userId: userId });
        await User.findByIdAndDelete(userId);
        res.json({ success: true, message: `User ${user.fullName} (${user.email}) has been permanently deleted` });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
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
        const transaction = new Transaction({ userId: user._id, userName: user.fullName, type: 'admin_deposit', amount, transactionId: 'ADMIN_DEP_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6), description: description || 'Admin deposit', adminName: admin.fullName });
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
        const transaction = new Transaction({ userId: user._id, userName: user.fullName, type: 'admin_deduct', amount, transactionId: 'ADMIN_WD_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6), description: description || 'Admin deduction', adminName: admin.fullName });
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
        const pendingKYC = await KYC.countDocuments({ status: 'pending' });
        res.json({ totalUsers, activeUsers, totalBalance: totalBalance[0]?.total || 0, totalProfit: totalProfit[0]?.total || 0, pendingKYC });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ============= KYC ROUTES =============
app.get('/api/kyc/status', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('kycStatus');
        const kyc = await KYC.findOne({ userId: req.user.id });
        res.json({ success: true, kycStatus: user.kycStatus, kycData: kyc });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get KYC status' });
    }
});

app.post('/api/kyc/submit', authenticateToken, async (req, res) => {
    try {
        const { idType, dateOfBirth, fileName, fileType } = req.body;
        if (!idType || !dateOfBirth || !fileName) return res.status(400).json({ error: 'All fields are required' });
        const existingKYC = await KYC.findOne({ userId: req.user.id });
        if (existingKYC && existingKYC.status === 'verified') return res.status(400).json({ error: 'Your identity is already verified' });
        await KYC.findOneAndUpdate(
            { userId: req.user.id },
            { idType, dateOfBirth: new Date(dateOfBirth), fileName, fileType, status: 'pending', submittedAt: new Date(), rejectionReason: '' },
            { upsert: true }
        );
        await User.findByIdAndUpdate(req.user.id, { kycStatus: 'pending' });
        res.json({ success: true, message: 'KYC submitted successfully! Awaiting admin verification.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to submit KYC' });
    }
});

app.get('/api/admin/kyc/pending', authenticateToken, isAdmin, async (req, res) => {
    try {
        const pendingKYC = await KYC.find({ status: 'pending' }).populate('userId', 'fullName email');
        res.json({ success: true, pendingKYC });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pending KYC' });
    }
});

app.get('/api/admin/kyc/all', authenticateToken, isAdmin, async (req, res) => {
    try {
        const allKYC = await KYC.find().populate('userId', 'fullName email').sort({ submittedAt: -1 });
        res.json({ success: true, allKYC });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch KYC submissions' });
    }
});

app.post('/api/admin/kyc/verify/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { action, rejectionReason } = req.body;
        const kyc = await KYC.findOne({ userId });
        if (!kyc) return res.status(404).json({ error: 'KYC submission not found' });
        const admin = await User.findById(req.user.id);
        if (action === 'approve') {
            kyc.status = 'verified';
            kyc.verifiedAt = new Date();
            kyc.verifiedBy = admin.email;
            await User.findByIdAndUpdate(userId, { kycStatus: 'verified' });
            res.json({ success: true, message: 'User verified successfully' });
        } else if (action === 'reject') {
            kyc.status = 'rejected';
            kyc.rejectionReason = rejectionReason || 'No reason provided';
            kyc.verifiedAt = new Date();
            kyc.verifiedBy = admin.email;
            await User.findByIdAndUpdate(userId, { kycStatus: 'rejected' });
            res.json({ success: true, message: 'KYC rejected' });
        } else {
            res.status(400).json({ error: 'Invalid action' });
        }
        await kyc.save();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to process KYC' });
    }
});

app.delete('/api/admin/kyc/delete/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        await KYC.findOneAndDelete({ userId });
        await User.findByIdAndUpdate(userId, { kycStatus: 'not_submitted' });
        res.json({ success: true, message: 'KYC record deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete KYC' });
    }
});

// ============= CHAT ROUTES =============
app.get('/api/chat/messages', authenticateToken, async (req, res) => {
    try {
        const messages = await ChatMessage.find({ userId: req.user.id }).sort({ createdAt: 1 });
        const unreadCount = await ChatMessage.countDocuments({ userId: req.user.id, sender: 'admin', isRead: false });
        await ChatMessage.updateMany({ userId: req.user.id, sender: 'admin', isRead: false }, { $set: { isRead: true } });
        res.json({ success: true, messages, unreadCount });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

app.post('/api/chat/send', authenticateToken, async (req, res) => {
    try {
        const { message } = req.body;
        const user = await User.findById(req.user.id);
        if (!message) return res.status(400).json({ error: 'Message cannot be empty' });
        const chatMessage = new ChatMessage({ userId: user._id, userName: user.fullName, userEmail: user.email, message: message.trim(), sender: 'user', isRead: false });
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

app.get('/api/admin/chat/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const users = await ChatMessage.aggregate([
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$userId',
                    userName: { $first: '$userName' },
                    userEmail: { $first: '$userEmail' },
                    lastMessage: { $first: '$message' },
                    lastMessageTime: { $first: '$createdAt' },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ['$sender', 'user'] }, { $eq: ['$isRead', false] }] },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            { $sort: { lastMessageTime: -1 } }
        ]);
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch chat users' });
    }
});

app.get('/api/admin/chat/messages/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const messages = await ChatMessage.find({ userId: req.params.userId }).sort({ createdAt: 1 });
        const unreadCount = await ChatMessage.countDocuments({ userId: req.params.userId, sender: 'user', isRead: false });
        await ChatMessage.updateMany({ userId: req.params.userId, sender: 'user', isRead: false }, { $set: { isRead: true } });
        res.json({ success: true, messages, unreadCount });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

app.post('/api/admin/chat/send', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId, message } = req.body;
        const user = await User.findById(userId);
        if (!message) return res.status(400).json({ error: 'Message cannot be empty' });
        if (!user) return res.status(404).json({ error: 'User not found' });
        const chatMessage = new ChatMessage({ userId: user._id, userName: user.fullName, userEmail: user.email, message: message.trim(), sender: 'admin', isRead: false });
        await chatMessage.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send reply' });
    }
});

// ============= SAMPLE DATA GENERATOR (safe, no duplicates) =============
async function createSampleData() {
    try {
        await DepositRequest.deleteMany({ transactionId: null });
        
        const sampleUser = await User.findOne({ email: 'sample@example.com' });
        if (!sampleUser) {
            const hashed = await bcrypt.hash('Sample123!', 10);
            const user = new User({
                email: 'sample@example.com', password: hashed, fullName: 'Sample User',
                age: 30, country: 'Kenya', countryCode: '+254', phoneNumber: '700000000',
                employmentStatus: 'Employed', tradingExperience: 'Intermediate', fundsSource: 'Personal Savings',
                termsAccepted: true, balance: 1000, kycStatus: 'pending'
            });
            await user.save();

            await Withdrawal.create({
                userId: user._id, userName: user.fullName, amount: 100, feeAmount: 7,
                network: 'TRC20', walletAddress: 'TXxx...xxx', status: 'pending', createdAt: new Date()
            });
            await DepositRequest.create({
                userId: user._id, userName: user.fullName, userEmail: user.email,
                amount: 200, crypto: 'USDT', network: 'TRC20', walletAddress: 'TRpMxesumMB...',
                status: 'pending', createdAt: new Date(),
                transactionId: 'DEP_SAMPLE_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)
            });
            await Transaction.create({
                userId: user._id, userName: user.fullName, type: 'deposit', amount: 200,
                status: 'completed', transactionId: 'TXN_SAMPLE_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6), createdAt: new Date()
            });
            await KYC.create({
                userId: user._id, idType: 'passport', dateOfBirth: new Date('1990-01-01'),
                fileName: 'passport_scan.pdf', status: 'pending', submittedAt: new Date()
            });
            console.log('✅ Sample test data created (email: sample@example.com, password: Sample123!)');
        }
    } catch (err) {
        console.log('Sample data already exists or duplicate key ignored:', err.message);
    }
}

// ============= INITIALIZATION =============
async function createDefaultAdmin() {
    try {
        const adminExists = await User.findOne({ email: 'admin@lucidalgorithms.com' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('Admin123!', 10);
            const admin = new User({
                email: 'admin@lucidalgorithms.com', password: hashedPassword, fullName: 'System Administrator',
                age: 30, country: 'United States', countryCode: '+1', phoneNumber: '1234567890',
                employmentStatus: 'Employed', tradingExperience: 'Expert', fundsSource: 'Business Revenue',
                termsAccepted: true, isAdmin: true, isActive: true, balance: 10000, demoBalance: 5000, aiApiKey: 'ADMIN2024KEY',
                kycStatus: 'verified'
            });
            await admin.save();
            console.log('✅ Default admin created');
        }
    } catch (error) {
        console.error('Error creating admin:', error);
    }
}

async function initDefaultWalletAddresses() {
    const count = await WalletAddress.countDocuments();
    if (count === 0) {
        console.log('No wallet addresses found. Creating defaults...');
        const defaultAddresses = [
            { network: 'trc20', crypto: 'USDT', address: 'TRpMxesumMB6H7v4CZhKcnJZzjfnsXMSC3' },
            { network: 'bep20', crypto: 'USDT', address: '0x61f683a9a884c72a6f69f28201fb717254a7459c' }
        ];
        for (const addr of defaultAddresses) {
            await WalletAddress.create(addr);
        }
        console.log('✅ Default wallet addresses created');
    } else {
        console.log(`✅ ${count} wallet addresses already exist, skipping defaults`);
    }
}

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
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/deposit', (req, res) => res.sendFile(path.join(__dirname, 'deposit.html')));
app.get('/withdraw', (req, res) => res.sendFile(path.join(__dirname, 'withdraw.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));

app.listen(PORT, async () => {
    await createDefaultAdmin();
    await initDefaultWalletAddresses();
    await createSampleData();
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔐 Admin: admin@lucidalgorithms.com / Admin123!`);
    console.log(`✅ KYC System Active - Users must verify identity before depositing`);
    console.log(`📊 Sample user: sample@example.com / Sample123! (for testing withdrawals, deposits, KYC)`);
});