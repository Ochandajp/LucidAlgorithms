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

// ============= SCHEMAS (original + KYC) =============
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

// ... (all other schemas: trade, transaction, withdrawal, depositRequest, chatMessage, walletAddress, systemSettings)

// KYC Schema
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

// ============= MIDDLEWARE (unchanged) =============
const authenticateToken = (req, res, next) => { /* ... your original ... */ };
const isAdmin = async (req, res, next) => { /* ... your original ... */ };
function generatePasskey() { /* ... your original ... */ }
function calculateProfitMultiplier(amount, durationMs) { /* ... your original ... */ }

// ============= AUTH ROUTES (unchanged) =============
// ... your original register, login, etc. (keep them exactly as they are)

// ============= KYC ROUTES (NEW) =============
app.get('/api/kyc/status', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('kycStatus');
        const kyc = await KYC.findOne({ userId: req.user.id });
        res.json({ success: true, kycStatus: user.kycStatus, kycData: kyc });
    } catch (error) { res.status(500).json({ error: 'Failed to get KYC status' }); }
});

app.post('/api/kyc/submit', authenticateToken, async (req, res) => {
    try {
        const { idType, dateOfBirth, fileName, fileType } = req.body;
        if (!idType || !dateOfBirth || !fileName) return res.status(400).json({ error: 'All fields required' });
        const existing = await KYC.findOne({ userId: req.user.id });
        if (existing && existing.status === 'verified') return res.status(400).json({ error: 'Already verified' });
        await KYC.findOneAndUpdate(
            { userId: req.user.id },
            { idType, dateOfBirth: new Date(dateOfBirth), fileName, fileType, status: 'pending', submittedAt: new Date(), rejectionReason: '' },
            { upsert: true }
        );
        await User.findByIdAndUpdate(req.user.id, { kycStatus: 'pending' });
        res.json({ success: true, message: 'KYC submitted! Awaiting admin verification.' });
    } catch (error) { res.status(500).json({ error: 'Failed to submit KYC' }); }
});

app.get('/api/admin/kyc/pending', authenticateToken, isAdmin, async (req, res) => {
    try {
        const pending = await KYC.find({ status: 'pending' }).populate('userId', 'fullName email');
        res.json({ success: true, pendingKYC: pending });
    } catch (error) { res.status(500).json({ error: 'Failed to fetch pending KYC' }); }
});

app.get('/api/admin/kyc/all', authenticateToken, isAdmin, async (req, res) => {
    try {
        const all = await KYC.find().populate('userId', 'fullName email').sort({ submittedAt: -1 });
        res.json({ success: true, allKYC: all });
    } catch (error) { res.status(500).json({ error: 'Failed to fetch KYC submissions' }); }
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
    } catch (error) { res.status(500).json({ error: 'Failed to process KYC' }); }
});

app.delete('/api/admin/kyc/delete/:userId', authenticateToken, isAdmin, async (req, res) => {
    try {
        await KYC.findOneAndDelete({ userId: req.params.userId });
        await User.findByIdAndUpdate(req.params.userId, { kycStatus: 'not_submitted' });
        res.json({ success: true, message: 'KYC record deleted' });
    } catch (error) { res.status(500).json({ error: 'Failed to delete KYC' }); }
});

// ============= SAMPLE DATA GENERATOR (so tables show something) =============
async function createSampleData() {
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
        console.log('✅ Sample test data created (email: sample@example.com, password: Sample123!)');
    }
}

// ========== INITIALIZATION ==========
async function createDefaultAdmin() { /* ... your original ... */ }
async function initDefaultWalletAddresses() { /* ... your original ... */ }

// Run after DB connection
setTimeout(async () => {
    await createDefaultAdmin();
    await initDefaultWalletAddresses();
    await createSampleData();
}, 2000);

// ========== SERVE HTML ==========
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/deposit', (req, res) => res.sendFile(path.join(__dirname, 'deposit.html')));
app.get('/withdraw', (req, res) => res.sendFile(path.join(__dirname, 'withdraw.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));