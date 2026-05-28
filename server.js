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
    amount: { type: Number, required: true, min: 60 },
    crypto: { type: String, default: '' },
    network: { type: String, default: '' },
    walletAddress: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'completed', 'rejected'], default: 'pending' },
    transactionId: { type: String, unique: true },
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
        if (!user.isActive) return res.status(400).json({ error: 'Account deactivated' });
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
        const existing = await KYC.findOne({ userId: req.user.id });
        if (existing && existing.status === 'verified') return res.status(400).json({ error: 'Already verified' });
        await KYC.findOneAndUpdate(
            { userId: req.user.id },
            { idType, dateOfBirth: new Date(dateOfBirth), fileName, fileType, status: 'pending', submittedAt: new Date(), rejectionReason: '' },
            { upsert: true }
        );
        await User.findByIdAndUpdate(req.user.id, { kycStatus: 'pending' });
        res.json({ success: true, message: 'KYC submitted! Awaiting admin verification.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit KYC' });
    }
});

app.get('/api/admin/kyc/pending', authenticateToken, isAdmin, async (req, res) => {
    try {
        const pending = await KYC.find({ status: 'pending' }).populate('userId', 'fullName email');
        res.json({ success: true, pendingKYC: pending });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pending KYC' });
    }
});

app.get('/api/admin/kyc/all', authenticateToken, isAdmin, async (req, res) => {
    try {
        const all = await KYC.find().populate('userId', 'fullName email').sort({ submittedAt: -1 });
        res.json({ success: true, allKYC: all });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch KYC submissions' });
    }
});

app.post('/api/admin/kyc/verify/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { action, rejectionReason } = req.body;
        const kyc = await KYC.findOne({ userId });
        if (!kyc) return res.status(404).json({ error: 'KYC not found' });
        const admin = await User.findById(req.user.id);
        if (action === 'approve') {
            kyc.status = 'verified';
            kyc.verifiedAt = new Date();
            kyc.verifiedBy = admin.email;
            await User.findByIdAndUpdate(userId, { kycStatus: 'verified' });
        } else if (action === 'reject') {
            kyc.status = 'rejected';
            kyc.rejectionReason = rejectionReason || 'No reason provided';
            kyc.verifiedAt = new Date();
            kyc.verifiedBy = admin.email;
            await User.findByIdAndUpdate(userId, { kycStatus: 'rejected' });
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }
        await kyc.save();
        res.json({ success: true, message: action === 'approve' ? 'User verified' : 'KYC rejected' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process KYC' });
    }
});

app.delete('/api/admin/kyc/delete/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        await KYC.findOneAndDelete({ userId: req.params.userId });
        await User.findByIdAndUpdate(req.params.userId, { kycStatus: 'not_submitted' });
        res.json({ success: true, message: 'KYC record deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete KYC' });
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
        if (!network || !crypto || !address) return res.status(400).json({ error: 'All fields required' });
        await WalletAddress.findOneAndUpdate(
            { network },
            { network, crypto, address, isActive: true, updatedAt: new Date() },
            { upsert: true }
        );
        res.json({ success: true, message: `Wallet for ${network} saved` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save wallet address' });
    }
});

app.delete('/api/admin/wallet-addresses/:network', authenticateToken, isAdmin, async (req, res) => {
    try {
        await WalletAddress.findOneAndDelete({ network: req.params.network });
        res.json({ success: true, message: 'Wallet deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete wallet' });
    }
});

app.post('/api/admin/wallet-addresses/:network/toggle', authenticateToken, isAdmin, async (req, res) => {
    try {
        const wallet = await WalletAddress.findOne({ network: req.params.network });
        if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
        wallet.isActive = !wallet.isActive;
        await wallet.save();
        res.json({ success: true, message: `Wallet ${wallet.isActive ? 'activated' : 'deactivated'}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle wallet' });
    }
});

// ============= DEPOSIT REQUESTS =============
app.post('/api/deposit/request', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.kycStatus !== 'verified') return res.status(403).json({ error: 'KYC verification required' });
        const { amount, network, crypto, walletAddress } = req.body;
        if (amount < 60) return res.status(400).json({ error: 'Minimum deposit $60' });
        const deposit = new DepositRequest({
            userId: user._id, userName: user.fullName, userEmail: user.email,
            amount, crypto, network, walletAddress, transactionId: 'DEP_' + Date.now(), status: 'pending'
        });
        await deposit.save();
        res.json({ success: true, depositId: deposit._id });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create deposit request' });
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
        if (deposit.status !== 'pending') return res.status(400).json({ error: 'Already processed' });
        const user = await User.findById(deposit.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        user.balance += deposit.amount;
        user.totalDeposits += deposit.amount;
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

// ============= WITHDRAWALS =============
app.post('/api/withdrawal/request', authenticateToken, async (req, res) => {
    try {
        const { amount, network, address } = req.body;
        const user = await User.findById(req.user.id);
        const min = user.customWithdrawalMin || 50;
        if (amount < min) return res.status(400).json({ error: `Minimum withdrawal $${min}` });
        const fee = amount * 0.07;
        if (amount > user.balance) return res.status(400).json({ error: 'Insufficient balance' });
        user.balance -= amount;
        await user.save();
        const withdrawal = new Withdrawal({ userId: user._id, userName: user.fullName, amount, feeAmount: fee, network, walletAddress: address, status: 'pending' });
        await withdrawal.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Withdrawal failed' });
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
        if (!withdrawal) return res.status(404).json({ error: 'Not found' });
        withdrawal.status = status;
        withdrawal.processedAt = new Date();
        if (status === 'rejected') {
            const user = await User.findById(withdrawal.userId);
            if (user) user.balance += withdrawal.amount;
            await user.save();
        }
        await withdrawal.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process withdrawal' });
    }
});

// ============= TRANSACTIONS =============
app.get('/api/admin/transactions', authenticateToken, isAdmin, async (req, res) => {
    try {
        const transactions = await Transaction.find().sort({ createdAt: -1 }).limit(100);
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// ============= ADMIN USERS =============
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
        const transactions = await Transaction.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(20);
        const kyc = await KYC.findOne({ userId: req.params.userId });
        res.json({ user, transactions, kyc });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
});

app.delete('/api/admin/users/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.isAdmin) return res.status(400).json({ error: 'Cannot delete admin' });
        await Trade.deleteMany({ userId: req.params.userId });
        await Transaction.deleteMany({ userId: req.params.userId });
        await Withdrawal.deleteMany({ userId: req.params.userId });
        await DepositRequest.deleteMany({ userId: req.params.userId });
        await ChatMessage.deleteMany({ userId: req.params.userId });
        await KYC.findOneAndDelete({ userId: req.params.userId });
        await User.findByIdAndDelete(req.params.userId);
        res.json({ success: true, message: `User ${user.fullName} deleted` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

app.post('/api/admin/add-balance', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId, amount, description } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        user.balance += amount;
        user.totalDeposits += amount;
        await user.save();
        const transaction = new Transaction({ userId, userName: user.fullName, type: 'admin_deposit', amount, transactionId: 'ADMIN_DEP_' + Date.now(), description: description || 'Admin deposit', adminName: req.user.email });
        await transaction.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add balance' });
    }
});

app.post('/api/admin/deduct-balance', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId, amount, description } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });
        user.balance -= amount;
        await user.save();
        const transaction = new Transaction({ userId, userName: user.fullName, type: 'admin_deduct', amount, transactionId: 'ADMIN_WD_' + Date.now(), description: description || 'Admin deduction', adminName: req.user.email });
        await transaction.save();
        res.json({ success: true });
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
        res.status(500).json({ error: 'Failed to toggle status' });
    }
});

app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const totalBalance = (await User.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]))[0]?.total || 0;
        const totalProfit = (await User.aggregate([{ $group: { _id: null, total: { $sum: '$totalProfit' } } }]))[0]?.total || 0;
        const pendingKYC = await KYC.countDocuments({ status: 'pending' });
        res.json({ totalUsers, activeUsers, totalBalance, totalProfit, pendingKYC });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
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
                    unreadCount: { $sum: { $cond: [{ $and: [{ $eq: ['$sender', 'user'] }, { $eq: ['$isRead', false] }] }, 1, 0] } }
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

// ============= AI PASSKEY (simplified) =============
app.post('/api/ai/save-passkey', authenticateToken, async (req, res) => {
    try {
        const { passkey } = req.body;
        if (!passkey) return res.status(400).json({ error: 'Passkey required' });
        await User.findByIdAndUpdate(req.user.id, { aiApiKey: passkey });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save passkey' });
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

app.delete('/api/ai/delete-passkey', authenticateToken, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.id, { aiApiKey: '' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete passkey' });
    }
});

// ============= TRADING (simplified for demo) =============
app.post('/api/ai/start-trade', authenticateToken, async (req, res) => {
    try {
        const { amount, isDemo, passkey, symbolName, duration } = req.body;
        const user = await User.findById(req.user.id);
        if (user.aiApiKey !== passkey) return res.status(400).json({ error: 'Invalid passkey' });
        const min = isDemo ? 80 : 140;
        if (amount < min) return res.status(400).json({ error: `Minimum trade $${min}` });
        const balance = isDemo ? user.demoBalance : user.balance;
        if (amount > balance) return res.status(400).json({ error: 'Insufficient funds' });
        if (isDemo) user.demoBalance -= amount;
        else user.balance -= amount;
        await user.save();
        const trade = new Trade({
            userId: user._id, isDemo, symbol: 'BTCUSDT', symbolName: symbolName || 'Bitcoin',
            category: 'crypto', side: 'buy', amount, leverage: 100, duration: duration || '1h',
            durationMs: 3600000, entryPrice: 50000, status: 'active', aiPasskey: passkey
        });
        await trade.save();
        res.json({ success: true, trade });
    } catch (error) {
        res.status(500).json({ error: 'Failed to start trade' });
    }
});

// ============= INITIALIZATION =============
async function createDefaultAdmin() {
    const adminExists = await User.findOne({ email: 'admin@lucidalgorithms.com' });
    if (!adminExists) {
        const hashed = await bcrypt.hash('Admin123!', 10);
        const admin = new User({
            email: 'admin@lucidalgorithms.com', password: hashed, fullName: 'System Administrator',
            age: 30, country: 'United States', countryCode: '+1', phoneNumber: '1234567890',
            employmentStatus: 'Employed', tradingExperience: 'Expert', fundsSource: 'Business Revenue',
            termsAccepted: true, isAdmin: true, isActive: true, balance: 10000, demoBalance: 5000,
            aiApiKey: 'ADMIN2024KEY', kycStatus: 'verified'
        });
        await admin.save();
        console.log('✅ Default admin created');
    }
}

async function initDefaultWalletAddresses() {
    const count = await WalletAddress.countDocuments();
    if (count === 0) {
        const defaultAddresses = [
            { network: 'trc20', crypto: 'USDT', address: 'TRpMxesumMB6H7v4CZhKcnJZzjfnsXMSC3' },
            { network: 'bep20', crypto: 'USDT', address: '0x61f683a9a884c72a6f69f28201fb717254a7459c' }
        ];
        for (const addr of defaultAddresses) await WalletAddress.create(addr);
        console.log('✅ Default wallet addresses created');
    }
}

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
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`🔐 Admin: admin@lucidalgorithms.com / Admin123!`);
    console.log(`✅ All endpoints active`);
});