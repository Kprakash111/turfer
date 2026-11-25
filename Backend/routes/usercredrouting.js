
const bcrypt = require('bcryptjs');
const express = require('express');
const router = express.Router();
const db = require('../connection').pool;

// User Registration
router.post('/register', async (req, res) => {
    try {
        const { userid, password } = req.body.credentials || {};

        if (!userid || !password) {
            return res.status(200).json({
                Status: "Failed",
                Message: "User ID and Password are required"
            });
        }

        const [existing] = await db.execute(
            'SELECT id FROM users WHERE userid = ? LIMIT 1',
            [userid]
        );

        if (existing.length > 0) {
            return res.status(200).json({
                Status: "Failed",
                Message: "User ID Already Exists"
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await db.execute(
            'INSERT INTO users (userid, password_hash) VALUES (?, ?)',
            [userid, passwordHash]
        );

        return res.status(200).json({
            Status: "Success",
            Message: "Registered Successfully"
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(200).json({
                Status: "Failed",
                Message: "User ID Already Exists"
            });
        }

        console.error('User registration error:', error.message);

        return res.status(500).json({
            Status: "Failed",
            Message: "Error in registration"
        });
    }
});

// User Login
router.post('/login', async (req, res) => {
    try {
        const { userid, password } = req.body.credentials || {};

        if (!userid || !password) {
            return res.status(200).json({
                Status: "Failed",
                Message: "User ID and Password are required"
            });
        }

        const [users] = await db.execute(
            'SELECT id, password_hash FROM users WHERE userid = ? LIMIT 1',
            [userid]
        );

        if (users.length !== 1) {
            return res.status(200).json({
                Status: "Failed",
                Message: "User ID Does Not Exist"
            });
        }

        const isPasswordCorrect = await bcrypt.compare(
            password,
            users[0].password_hash
        );

        if (!isPasswordCorrect) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Incorrect Password"
            });
        }

        return res.status(200).json({
            Status: "Success",
            tokenid: users[0].id
        });

    } catch (error) {
        console.error('User login error:', error.message);

        return res.status(500).json({
            Status: "Failed",
            Message: "Error in login"
        });
    }
});

module.exports = router;
