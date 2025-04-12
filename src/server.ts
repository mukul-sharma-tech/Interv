import express, { Request, Response, NextFunction } from 'express';
import mongoose, { ConnectOptions, Schema, Document } from 'mongoose';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import { v2 as cloudinary } from 'cloudinary';

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
} as ConnectOptions)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// Interfaces for TypeScript
interface IQAPair {
    hrQuestion: string;
    candidateAnswer: string;
}

interface IInterview extends Document {
    interviewField: 'SDE' | 'Business' | 'Manager' | 'HR';
    qaPairs: IQAPair[];
    timestamp: Date;
}

interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    fileName: string;
    public_id: string;
    imgurl: string;
}

// Interview Schema
const interviewSchema = new Schema<IInterview>({
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

const Interview = mongoose.model<IInterview>('Interview', interviewSchema);

// File Upload Configuration
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb: FileFilterCallback) => {
        if (file.mimetype !== 'application/pdf') {
            return cb(new Error('Only PDF files are allowed'));
        }
        cb(null, true);
    }
});

// API Routes
app.post('/api/upload-pdf', upload.single('pdf'), (req: Request, res: Response, next: NextFunction) => {
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
        } catch (error: any) {
            console.error('PDF processing error:', error);
            res.status(500).json({
                error: 'Failed to process PDF file',
                details: error.message
            });
        }
    })().catch(next);
});

app.post('/api/save-interview', (req: Request, res: Response, next: NextFunction) => {
    (async () => {
        try {
            const { interviewField, qaPairs }: { interviewField: string; qaPairs: IQAPair[] } = req.body;

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

        } catch (error: any) {
            console.error('Save error:', error);
            res.status(500).json({
                error: 'Failed to save interview data',
                details: error.message
            });
        }
    })().catch(next);
});

// Error Handling Middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
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