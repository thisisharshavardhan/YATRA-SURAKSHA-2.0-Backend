import dotenv from 'dotenv';

dotenv.config();

import express from 'express';
import cors from 'cors';
import { connect } from 'mongoose';
import connectDB from './Dbs/index.db.js';


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Yatra Suraksha Backend is running!');
});


connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}).catch((error) => {
    console.error('Failed to connect to the database:', error);
});