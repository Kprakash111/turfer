const bcrypt = require('bcryptjs');
const express = require('express');
const router = express.Router();
const db = require('../connection').pool;

// Admin Registration
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
            'SELECT id FROM admins WHERE userid = ? LIMIT 1',
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
            'INSERT INTO admins (userid, password_hash) VALUES (?, ?)',
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

        console.error('Admin registration error:', error.message);

        return res.status(500).json({
            Status: "Failed",
            Message: "Error in Registration"
        });
    }
});

// Admin Login
router.post('/login', async (req, res) => {
    try {
        const { userid, password } = req.body.credentials || {};

        if (!userid || !password) {
            return res.status(200).json({
                Status: "Failed",
                Message: "User ID and Password are required"
            });
        }

        const [admins] = await db.execute(
            'SELECT id, password_hash FROM admins WHERE userid = ? LIMIT 1',
            [userid]
        );

        if (admins.length !== 1) {
            return res.status(200).json({
                Status: "Failed",
                Message: "User ID Does Not Exist"
            });
        }

        const isPasswordCorrect = await bcrypt.compare(
            password,
            admins[0].password_hash
        );

        if (!isPasswordCorrect) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Incorrect Password"
            });
        }

        return res.status(200).json({
            Status: "Success",
            tokenid: admins[0].id
        });

    } catch (error) {
        console.error('Admin login error:', error.message);

        return res.status(500).json({
            Status: "Failed",
            Message: "Error in login"
        });
    }
});

module.exports = router;