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

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://LucidAlgorithm:Lucid@cluster0.kcqdr6j.mongodb.net/?retryWrites=true&w=majority';
mongoose.connect(MONGODB_URI, { dbName: 'lucidalgorithms' })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// ========== SCHEMAS ==========
const userSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    age: Number, country: String, countryCode: String, phoneNumber: String,
    employmentStatus: String, tradingExperience: String, fundsSource: String,
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
        req.user = jwt.verify(token, 'lucid_algorithms_jwt_secret');
        next();
    } catch { res.status(400).json({ error: 'Invalid token' }); }
};

const isAdmin = async (req, res, next) => {
    const user = await User.findById(req.user.id);
    if (!user || !user.isAdmin) return res.status(403).json({ error: 'Admin only' });
    next();
};

// ========== AUTH ==========
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, fullName, age, country, countryCode, phoneNumber, employmentStatus, tradingExperience, fundsSource, termsAccepted } = req.body;
        if (await User.findOne({ email })) return res.status(400).json({ error: 'Email already exists' });
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
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: 'Invalid credentials' });
        if (!user.isActive) return res.status(400).json({ error: 'Account disabled' });
        user.lastLogin = new Date();
        await user.save();
        const token = jwt.sign({ id: user._id, email: user.email, isAdmin: user.isAdmin }, 'lucid_algorithms_jwt_secret');
        res.json({ success: true, token, user: { id: user._id, email: user.email, fullName: user.fullName, balance: user.balance, isAdmin: user.isAdmin } });
    } catch (error) { res.status(500).json({ error: 'Login failed' }); }
});

// ========== ADMIN: USERS ==========
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json(users);
});

app.put('/api/admin/users/:userId/toggle-status', authenticateToken, isAdmin, async (req, res) => {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}` });
});

app.delete('/api/admin/users/:userId', authenticateToken, isAdmin, async (req, res) => {
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
    res.json({ success: true, message: `User ${user.fullName} deleted` });
});

// ========== ADMIN: WITHDRAWALS ==========
app.get('/api/admin/withdrawals', authenticateToken, isAdmin, async (req, res) => {
    const withdrawals = await Withdrawal.find().sort({ createdAt: -1 });
    res.json(withdrawals);
});

app.post('/api/admin/withdrawals/:id/process', authenticateToken, isAdmin, async (req, res) => {
    const { status } = req.body;
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return res.status(404).json({ error: 'Not found' });
    withdrawal.status = status;
    if (status === 'rejected') {
        await User.findByIdAndUpdate(withdrawal.userId, { $inc: { balance: withdrawal.amount } });
    }
    await withdrawal.save();
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
    if (action === 'approve') {
        kyc.status = 'verified';
        await User.findByIdAndUpdate(req.params.userId, { kycStatus: 'verified' });
    } else {
        kyc.status = 'rejected';
        kyc.rejectionReason = rejectionReason || 'No reason provided';
        await User.findByIdAndUpdate(req.params.userId, { kycStatus: 'rejected' });
    }
    kyc.verifiedAt = new Date();
    kyc.verifiedBy = req.user.email;
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
    await WalletAddress.findOneAndUpdate(
        { network },
        { network, crypto, address, isActive: true, updatedAt: new Date() },
        { upsert: true }
    );
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
    const chat = new ChatMessage({
        userId, userName: user.fullName, userEmail: user.email,
        message, sender: 'admin', isRead: false
    });
    await chat.save();
    res.json({ success: true });
});

app.post('/api/admin/chat/mark-read/:userId', authenticateToken, isAdmin, async (req, res) => {
    await ChatMessage.updateMany({ userId: req.params.userId, sender: 'user', isRead: false }, { $set: { isRead: true } });
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

// ========== PUBLIC ENDPOINTS (for deposit page) ==========
app.get('/api/wallet-addresses', authenticateToken, async (req, res) => {
    const addresses = await WalletAddress.find({ isActive: true });
    res.json({ success: true, addresses });
});

// ========== USER PROFILE ==========
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    const user = await User.findById(req.user.id).select('-password');
    const kyc = await KYC.findOne({ userId: req.user.id });
    res.json({ user, kyc, tradeHistory: [], activeTrades: [], withdrawalHistory: [] });
});

// ========== KYC SUBMISSION ==========
app.post('/api/kyc/submit', authenticateToken, async (req, res) => {
    const { idType, dateOfBirth, fileName, fileType } = req.body;
    if (!idType || !dateOfBirth || !fileName) return res.status(400).json({ error: 'All fields required' });
    await KYC.findOneAndUpdate(
        { userId: req.user.id },
        { idType, dateOfBirth: new Date(dateOfBirth), fileName, fileType, status: 'pending', submittedAt: new Date(), rejectionReason: '' },
        { upsert: true }
    );
    await User.findByIdAndUpdate(req.user.id, { kycStatus: 'pending' });
    res.json({ success: true, message: 'KYC submitted. Pending admin review.' });
});

app.get('/api/kyc/status', authenticateToken, async (req, res) => {
    const user = await User.findById(req.user.id).select('kycStatus');
    const kyc = await KYC.findOne({ userId: req.user.id });
    res.json({ success: true, kycStatus: user.kycStatus, kycData: kyc });
});

// ========== DEPOSIT REQUEST (for user) ==========
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

// ========== INITIALIZE DEFAULT ADMIN AND WALLETS ==========
async function init() {
    // Create default admin if not exists
    const adminExists = await User.findOne({ email: 'admin@lucidalgorithms.com' });
    if (!adminExists) {
        const hashed = await bcrypt.hash('Admin123!', 10);
        const admin = new User({
            email: 'admin@lucidalgorithms.com',
            password: hashed,
            fullName: 'System Admin',
            age: 30,
            country: 'US',
            countryCode: '+1',
            phoneNumber: '1234567890',
            employmentStatus: 'Employed',
            tradingExperience: 'Expert',
            fundsSource: 'Business Revenue',
            termsAccepted: true,
            isAdmin: true,
            balance: 10000,
            kycStatus: 'verified'
        });
        await admin.save();
        console.log('✅ Admin created: admin@lucidalgorithms.com / Admin123!');
    }
    // Create default wallet addresses if none
    const walletCount = await WalletAddress.countDocuments();
    if (walletCount === 0) {
        await WalletAddress.create([
            { network: 'trc20', crypto: 'USDT', address: 'TRpMxesumMB6H7v4CZhKcnJZzjfnsXMSC3', isActive: true },
            { network: 'bep20', crypto: 'USDT', address: '0x61f683a9a884c72a6f69f28201fb717254a7459c', isActive: true }
        ]);
        console.log('✅ Default wallet addresses created');
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