import express from 'express';
import mongoose, { Schema } from 'mongoose';
import multer from 'multer';
import dotenv from 'dotenv';
import cors from 'cors';
import pdfParse from 'pdf-parse';
// Initialize dotenv
dotenv.config();
const app = express();
// Middleware Configuration
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5000',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || '';
mongoose.connect(MONGODB_URI, {
    dbName: 'AiInterview',
})
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));
// Interview Schema
const interviewSchema = new Schema({
    interviewField: {
        type: String,
        required: true,
        enum: ['SDE', 'Business', 'Manager', 'HR']
    },
    qaPairs: [{
            hrQuestion: { type: String, required: true },
            candidateAnswer: { type: String, required: true }
        }],
    timestamp: { type: Date, default: Date.now }
});
const Interview = mongoose.model('Interview', interviewSchema);
// File Upload Configuration
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            return cb(new Error('Only PDF files are allowed'));
        }
        cb(null, true);
    }
});
// API Routes
app.post('/api/upload-pdf', upload.single('pdf'), (req, res, next) => {
    (async () => {
        try {
            if (!req.file) {
                res.status(400).json({ error: 'No PDF file uploaded' });
                return;
            }
            const pdfData = await pdfParse(req.file.buffer);
            const questions = pdfData.text
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .map((line, index) => `${index + 1}. ${line.replace(/^\d+\.\s*/, '')}`);
            res.json({
                success: true,
                questions
            });
        }
        catch (error) {
            console.error('PDF processing error:', error);
            res.status(500).json({
                error: 'Failed to process PDF file',
                details: error.message
            });
        }
    })().catch(next);
});
app.post('/api/save-interview', (req, res, next) => {
    (async () => {
        try {
            const { interviewField, qaPairs } = req.body;
            if (!interviewField || !qaPairs || !Array.isArray(qaPairs)) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    required: ['interviewField', 'qaPairs']
                });
            }
            const newInterview = new Interview({
                interviewField,
                qaPairs
            });
            const savedInterview = await newInterview.save();
            res.status(201).json(savedInterview);
        }
        catch (error) {
            console.error('Save error:', error);
            res.status(500).json({
                error: 'Failed to save interview data',
                details: error.message
            });
        }
    })().catch(next);
});
// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});
// Server Startup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Server running on http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map