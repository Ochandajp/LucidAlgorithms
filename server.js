const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const MONGODB_URI = 'mongodb+srv://LucidAlgorithm:Lucid@cluster0.kcqdr6j.mongodb.net/?retryWrites=true&w=majority';
mongoose.connect(MONGODB_URI, { dbName: 'lucidalgorithms' })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// ========== SCHEMAS ==========
const userSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    age: Number,
    country: String,
    countryCode: String,
    phoneNumber: String,
    employmentStatus: String,
    tradingExperience: String,
    fundsSource: String,
    balance: { type: Number, default: 0 },
    demoBalance: { type: Number, default: 5000 },
    totalDeposits: { type: Number, default: 0 },
    totalProfit: { type: Number, default: 0 },
    totalLoss: { type: Number, default: 0 },
    totalTrades: { type: Number, default: 0 },
    customWithdrawalMin: Number,
    createdAt: { type: Date, default: Date.now },
    lastLogin: Date,
    isAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    aiApiKey: String,
    kycStatus: { type: String, default: 'not_submitted' }
});

const tradeSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    symbolName: String,
    amount: Number,
    profit: Number,
    status: String,
    createdAt: { type: Date, default: Date.now }
});

const transactionSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    type: String,
    amount: Number,
    status: String,
    transactionId: String,
    createdAt: { type: Date, default: Date.now }
});

const withdrawalSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    amount: Number,
    feeAmount: Number,
    network: String,
    walletAddress: String,
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const depositRequestSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    userEmail: String,
    amount: Number,
    crypto: String,
    network: String,
    walletAddress: String,
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const chatMessageSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    userEmail: String,
    message: String,
    sender: { type: String, enum: ['user', 'admin'] },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const walletAddressSchema = new mongoose.Schema({
    network: { type: String, unique: true },
    crypto: String,
    address: String,
    isActive: { type: Boolean, default: true },
    updatedAt: Date
});

const kycSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, unique: true, ref: 'User' },
    idType: String,
    dateOfBirth: Date,
    fileName: String,
    status: { type: String, default: 'pending' },
    rejectionReason: String,
    submittedAt: Date,
    verifiedAt: Date,
    verifiedBy: String
});

const User = mongoose.model('User', userSchema);
const Trade = mongoose.model('Trade', tradeSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
const DepositRequest = mongoose.model('DepositRequest', depositRequestSchema);
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
const WalletAddress = mongoose.model('WalletAddress', walletAddressSchema);
const KYC = mongoose.model('KYC', kycSchema);

// ========== MIDDLEWARE ==========
const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'lucid_algorithms_jwt_secret');
        next();
    } catch { res.status(400).json({ error: 'Invalid token' }); }
};

const isAdmin = async (req, res, next) => {
    const user = await User.findById(req.user.id);
    if (!user || !user.isAdmin) return res.status(403).json({ error: 'Admin only' });
    next();
};

// ========== AUTH ROUTES ==========
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, fullName, age, country, countryCode, phoneNumber, employmentStatus, tradingExperience, fundsSource, termsAccepted } = req.body;
        if (await User.findOne({ email })) return res.status(400).json({ error: 'Email already registered' });
        const hashed = await bcrypt.hash(password, 10);
        const user = new User({
            email, password: hashed, fullName, age, country, countryCode, phoneNumber,
            employmentStatus, tradingExperience, fundsSource, termsAccepted,
            isAdmin: email === 'admin@lucidalgorithms.com'
        });
        await user.save();
        const token = jwt.sign({ id: user._id, email: user.email, isAdmin: user.isAdmin }, 'lucid_algorithms_jwt_secret');
        res.json({ success: true, token, user: { id: user._id, email: user.email, fullName: user.fullName, balance: user.balance, isAdmin: user.isAdmin } });
    } catch (error) { res.status(500).json({ error: 'Registration failed' }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: 'Invalid email or password' });
        if (!user.isActive) return res.status(400).json({ error: 'Account deactivated' });
        user.lastLogin = new Date();
        await user.save();
        const token = jwt.sign({ id: user._id, email: user.email, isAdmin: user.isAdmin }, 'lucid_algorithms_jwt_secret');
        res.json({ success: true, token, user: { id: user._id, email: user.email, fullName: user.fullName, balance: user.balance, isAdmin: user.isAdmin } });
    } catch (error) { res.status(500).json({ error: 'Login failed' }); }
});

// ========== USER PROFILE & KYC ==========
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        const activeTrades = await Trade.find({ userId: req.user.id, status: 'active' });
        const tradeHistory = await Trade.find({ userId: req.user.id, status: 'completed' }).limit(50);
        const withdrawalHistory = await Withdrawal.find({ userId: req.user.id }).limit(20);
        const kyc = await KYC.findOne({ userId: req.user.id });
        res.json({ user, activeTrades, tradeHistory, withdrawalHistory, kyc });
    } catch (error) { res.status(500).json({ error: 'Failed to fetch profile' }); }
});

app.get('/api/kyc/status', authenticateToken, async (req, res) => {
    const user = await User.findById(req.user.id).select('kycStatus');
    const kyc = await KYC.findOne({ userId: req.user.id });
    res.json({ success: true, kycStatus: user.kycStatus, kycData: kyc });
});

app.post('/api/kyc/submit', authenticateToken, async (req, res) => {
    const { idType, dateOfBirth, fileName, fileType } = req.body;
    if (!idType || !dateOfBirth || !fileName) return res.status(400).json({ error: 'All fields required' });
    await KYC.findOneAndUpdate(
        { userId: req.user.id },
        { idType, dateOfBirth: new Date(dateOfBirth), fileName, fileType, status: 'pending', submittedAt: new Date() },
        { upsert: true }
    );
    await User.findByIdAndUpdate(req.user.id, { kycStatus: 'pending' });
    res.json({ success: true, message: 'KYC submitted' });
});

// ========== WALLET ADDRESSES (user) ==========
app.get('/api/wallet-addresses', authenticateToken, async (req, res) => {
    const addresses = await WalletAddress.find({ isActive: true });
    res.json({ success: true, addresses });
});

// ========== DEPOSIT REQUEST (user) ==========
app.post('/api/deposit/request', authenticateToken, async (req, res) => {
    const user = await User.findById(req.user.id);
    if (user.kycStatus !== 'verified') return res.status(403).json({ error: 'KYC verification required' });
    const { amount, network, crypto, walletAddress } = req.body;
    if (amount < 60) return res.status(400).json({ error: 'Minimum deposit $60' });
    const deposit = new DepositRequest({
        userId: user._id, userName: user.fullName, userEmail: user.email,
        amount, crypto, network, walletAddress, status: 'pending'
    });
    await deposit.save();
    res.json({ success: true, depositId: deposit._id });
});

// ========== WITHDRAWAL REQUEST (user) ==========
app.post('/api/withdrawal/request', authenticateToken, async (req, res) => {
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
});

// ========== ADMIN: USERS ==========
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json(users);
});

app.get('/api/admin/users/:userId', authenticateToken, isAdmin, async (req, res) => {
    const user = await User.findById(req.params.userId).select('-password');
    const transactions = await Transaction.find({ userId: req.params.userId }).limit(20);
    const kyc = await KYC.findOne({ userId: req.params.userId });
    res.json({ user, transactions, kyc });
});

app.put('/api/admin/users/:userId/toggle-status', authenticateToken, isAdmin, async (req, res) => {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true });
});

app.delete('/api/admin/users/:userId', authenticateToken, isAdmin, async (req, res) => {
    if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isAdmin) return res.status(400).json({ error: 'Cannot delete admin' });
    await Trade.deleteMany({ userId: req.params.userId });
    await Transaction.deleteMany({ userId: req.params.userId });
    await Withdrawal.deleteMany({ userId: req.params.userId });
    await DepositRequest.deleteMany({ userId: req.params.userId });
    await ChatMessage.deleteMany({ userId: req.params.userId });
    await KYC.deleteOne({ userId: req.params.userId });
    await User.findByIdAndDelete(req.params.userId);
    res.json({ success: true });
});

// ========== ADMIN: WITHDRAWALS ==========
app.get('/api/admin/withdrawals', authenticateToken, isAdmin, async (req, res) => {
    const withdrawals = await Withdrawal.find().sort({ createdAt: -1 });
    res.json(withdrawals);
});

app.post('/api/admin/withdrawals/:id/process', authenticateToken, isAdmin, async (req, res) => {
    const { status } = req.body;
    const w = await Withdrawal.findById(req.params.id);
    if (!w) return res.status(404).json({ error: 'Not found' });
    w.status = status;
    if (status === 'rejected') {
        await User.findByIdAndUpdate(w.userId, { $inc: { balance: w.amount } });
    }
    await w.save();
    res.json({ success: true });
});

// ========== ADMIN: TRANSACTIONS ==========
app.get('/api/admin/transactions', authenticateToken, isAdmin, async (req, res) => {
    const transactions = await Transaction.find().sort({ createdAt: -1 }).limit(100);
    res.json(transactions);
});

// ========== ADMIN: DEPOSIT REQUESTS ==========
app.get('/api/admin/deposit-requests', authenticateToken, isAdmin, async (req, res) => {
    const deposits = await DepositRequest.find().sort({ createdAt: -1 });
    res.json(deposits);
});

app.post('/api/admin/deposit-requests/:id/approve', authenticateToken, isAdmin, async (req, res) => {
    const deposit = await DepositRequest.findById(req.params.id);
    if (!deposit) return res.status(404).json({ error: 'Not found' });
    await User.findByIdAndUpdate(deposit.userId, { $inc: { balance: deposit.amount, totalDeposits: deposit.amount } });
    deposit.status = 'completed';
    await deposit.save();
    res.json({ success: true });
});

app.post('/api/admin/deposit-requests/:id/reject', authenticateToken, isAdmin, async (req, res) => {
    const deposit = await DepositRequest.findById(req.params.id);
    if (!deposit) return res.status(404).json({ error: 'Not found' });
    deposit.status = 'rejected';
    await deposit.save();
    res.json({ success: true });
});

// ========== ADMIN: KYC ==========
app.get('/api/admin/kyc/pending', authenticateToken, isAdmin, async (req, res) => {
    const pending = await KYC.find({ status: 'pending' }).populate('userId', 'fullName email');
    res.json({ success: true, pendingKYC: pending });
});

app.get('/api/admin/kyc/all', authenticateToken, isAdmin, async (req, res) => {
    const all = await KYC.find().populate('userId', 'fullName email').sort({ submittedAt: -1 });
    res.json({ success: true, allKYC: all });
});

app.post('/api/admin/kyc/verify/:userId', authenticateToken, isAdmin, async (req, res) => {
    const { action, rejectionReason } = req.body;
    const kyc = await KYC.findOne({ userId: req.params.userId });
    if (!kyc) return res.status(404).json({ error: 'KYC not found' });
    const admin = await User.findById(req.user.id);
    if (action === 'approve') {
        kyc.status = 'verified';
        await User.findByIdAndUpdate(req.params.userId, { kycStatus: 'verified' });
    } else {
        kyc.status = 'rejected';
        kyc.rejectionReason = rejectionReason || 'No reason';
        await User.findByIdAndUpdate(req.params.userId, { kycStatus: 'rejected' });
    }
    kyc.verifiedAt = new Date();
    kyc.verifiedBy = admin.email;
    await kyc.save();
    res.json({ success: true });
});

app.delete('/api/admin/kyc/delete/:userId', authenticateToken, isAdmin, async (req, res) => {
    await KYC.findOneAndDelete({ userId: req.params.userId });
    await User.findByIdAndUpdate(req.params.userId, { kycStatus: 'not_submitted' });
    res.json({ success: true });
});

// ========== ADMIN: WALLET ADDRESSES ==========
app.get('/api/admin/wallet-addresses', authenticateToken, isAdmin, async (req, res) => {
    const wallets = await WalletAddress.find();
    res.json({ success: true, addresses: wallets });
});

app.post('/api/admin/wallet-addresses', authenticateToken, isAdmin, async (req, res) => {
    const { network, crypto, address } = req.body;
    await WalletAddress.findOneAndUpdate({ network }, { network, crypto, address, isActive: true, updatedAt: new Date() }, { upsert: true });
    res.json({ success: true });
});

app.delete('/api/admin/wallet-addresses/:network', authenticateToken, isAdmin, async (req, res) => {
    await WalletAddress.findOneAndDelete({ network: req.params.network });
    res.json({ success: true });
});

app.post('/api/admin/wallet-addresses/:network/toggle', authenticateToken, isAdmin, async (req, res) => {
    const wallet = await WalletAddress.findOne({ network: req.params.network });
    if (wallet) {
        wallet.isActive = !wallet.isActive;
        await wallet.save();
    }
    res.json({ success: true });
});

// ========== ADMIN: CHAT ==========
app.get('/api/admin/chat/users', authenticateToken, isAdmin, async (req, res) => {
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
});

app.get('/api/admin/chat/messages/:userId', authenticateToken, isAdmin, async (req, res) => {
    const messages = await ChatMessage.find({ userId: req.params.userId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
});

app.post('/api/admin/chat/send', authenticateToken, isAdmin, async (req, res) => {
    const { userId, message } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const chat = new ChatMessage({ userId, userName: user.fullName, userEmail: user.email, message, sender: 'admin', isRead: false });
    await chat.save();
    res.json({ success: true });
});

app.post('/api/admin/chat/mark-read/:userId', authenticateToken, isAdmin, async (req, res) => {
    await ChatMessage.updateMany({ userId: req.params.userId, sender: 'user', isRead: false }, { isRead: true });
    res.json({ success: true });
});

// ========== ADMIN: STATS ==========
app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const totalBalance = (await User.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]))[0]?.total || 0;
    const totalProfit = (await User.aggregate([{ $group: { _id: null, total: { $sum: '$totalProfit' } } }]))[0]?.total || 0;
    const pendingKYC = await KYC.countDocuments({ status: 'pending' });
    res.json({ totalUsers, activeUsers, totalBalance, totalProfit, pendingKYC });
});

// ========== ADMIN: ADD/DEDUCT BALANCE ==========
app.post('/api/admin/add-balance', authenticateToken, isAdmin, async (req, res) => {
    const { userId, amount, description } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.balance += amount;
    user.totalDeposits += amount;
    await user.save();
    const transaction = new Transaction({ userId, userName: user.fullName, type: 'admin_deposit', amount, transactionId: 'ADMIN_DEP_' + Date.now(), description: description || 'Admin deposit', adminName: req.user.email });
    await transaction.save();
    res.json({ success: true });
});

app.post('/api/admin/deduct-balance', authenticateToken, isAdmin, async (req, res) => {
    const { userId, amount, description } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });
    user.balance -= amount;
    await user.save();
    const transaction = new Transaction({ userId, userName: user.fullName, type: 'admin_deduct', amount, transactionId: 'ADMIN_WD_' + Date.now(), description: description || 'Admin deduction', adminName: req.user.email });
    await transaction.save();
    res.json({ success: true });
});

// ========== ADMIN: WITHDRAWAL MIN & PASSKEY ==========
app.post('/api/admin/user/withdrawal-min/:userId', authenticateToken, isAdmin, async (req, res) => {
    const { minAmount } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.customWithdrawalMin = minAmount;
    await user.save();
    res.json({ success: true });
});

app.post('/api/admin/generate-passkey/:userId', authenticateToken, isAdmin, async (req, res) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let passkey = '';
    for (let i = 0; i < 12; i++) passkey += chars.charAt(Math.floor(Math.random() * chars.length));
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.aiApiKey = passkey;
    await user.save();
    res.json({ success: true, passkey });
});

app.delete('/api/admin/delete-passkey/:userId', authenticateToken, isAdmin, async (req, res) => {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.aiApiKey = '';
    await user.save();
    res.json({ success: true });
});

// ========== USER AI PASSKEY ==========
app.post('/api/ai/save-passkey', authenticateToken, async (req, res) => {
    const { passkey } = req.body;
    if (!passkey) return res.status(400).json({ error: 'Passkey required' });
    await User.findByIdAndUpdate(req.user.id, { aiApiKey: passkey });
    res.json({ success: true });
});

app.get('/api/ai/get-passkey', authenticateToken, async (req, res) => {
    const user = await User.findById(req.user.id);
    res.json({ success: true, passkey: user.aiApiKey || '' });
});

app.delete('/api/ai/delete-passkey', authenticateToken, async (req, res) => {
    await User.findByIdAndUpdate(req.user.id, { aiApiKey: '' });
    res.json({ success: true });
});

// ========== TRADING (mock) ==========
app.post('/api/ai/start-trade', authenticateToken, async (req, res) => {
    res.json({ success: true, trade: { _id: Date.now().toString(), amount: req.body.amount, status: 'active' } });
});
app.post('/api/ai/stop-trade/:tradeId', authenticateToken, async (req, res) => {
    res.json({ success: true, profit: 0 });
});

// ========== INITIALIZE DEFAULT DATA (so admin sees content) ==========
async function init() {
    const adminExists = await User.findOne({ email: 'admin@lucidalgorithms.com' });
    if (!adminExists) {
        const hashed = await bcrypt.hash('Admin123!', 10);
        const admin = new User({
            email: 'admin@lucidalgorithms.com', password: hashed, fullName: 'System Admin',
            age: 30, country: 'United States', countryCode: '+1', phoneNumber: '1234567890',
            employmentStatus: 'Employed', tradingExperience: 'Expert', fundsSource: 'Business Revenue',
            termsAccepted: true, isAdmin: true, balance: 10000, kycStatus: 'verified'
        });
        await admin.save();
        console.log('✅ Admin created: admin@lucidalgorithms.com / Admin123!');
    }

    const walletCount = await WalletAddress.countDocuments();
    if (walletCount === 0) {
        await WalletAddress.create([
            { network: 'trc20', crypto: 'USDT', address: 'TRpMxesumMB6H7v4CZhKcnJZzjfnsXMSC3', isActive: true },
            { network: 'bep20', crypto: 'USDT', address: '0x61f683a9a884c72a6f69f28201fb717254a7459c', isActive: true }
        ]);
        console.log('✅ Default wallets created');
    }

    // Create a test user with some data so admin panel shows non-empty tables
    const testUser = await User.findOne({ email: 'test@example.com' });
    if (!testUser) {
        const testPass = await bcrypt.hash('Test123!', 10);
        const user = new User({
            email: 'test@example.com', password: testPass, fullName: 'Test User',
            age: 28, country: 'Kenya', countryCode: '+254', phoneNumber: '712345678',
            employmentStatus: 'Employed', tradingExperience: 'Intermediate', fundsSource: 'Personal Savings',
            termsAccepted: true, balance: 500, kycStatus: 'pending'
        });
        await user.save();

        // Sample withdrawal
        await Withdrawal.create({
            userId: user._id, userName: user.fullName, amount: 100, feeAmount: 7,
            network: 'TRC20', walletAddress: 'TXxx...xxx', status: 'pending', createdAt: new Date()
        });

        // Sample deposit request
        await DepositRequest.create({
            userId: user._id, userName: user.fullName, userEmail: user.email,
            amount: 200, crypto: 'USDT', network: 'TRC20', walletAddress: 'TRpMxesumMB...',
            status: 'pending', createdAt: new Date()
        });

        // Sample transaction
        await Transaction.create({
            userId: user._id, userName: user.fullName, type: 'deposit', amount: 200,
            status: 'completed', transactionId: 'TXN_' + Date.now(), createdAt: new Date()
        });

        // Sample KYC
        await KYC.create({
            userId: user._id, idType: 'passport', dateOfBirth: new Date('1990-01-01'),
            fileName: 'passport_scan.pdf', status: 'pending', submittedAt: new Date()
        });

        console.log('✅ Sample test user created (email: test@example.com, password: Test123!)');
        console.log('   Withdrawals, Deposits, Transactions, KYC now have sample data');
    }
}
init();

// ========== SERVE HTML ==========
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/deposit', (req, res) => res.sendFile(path.join(__dirname, 'deposit.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/withdraw', (req, res) => res.sendFile(path.join(__dirname, 'withdraw.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));