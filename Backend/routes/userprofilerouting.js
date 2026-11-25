
const express = require('express');
const router = express.Router();
const db = require('../connection').pool;

// Fetch User Profile
router.post('/buttonpress', async (req, res) => {
    try {
        const userId = req.body.tokenid;

        if (!userId) {
            return res.status(200).json({
                Status: "Failed",
                Message: "User ID is required"
            });
        }

        const [profiles] = await db.execute(
            `SELECT id, user_id, username, phoneno, emailid
             FROM user_profiles
             WHERE user_id = ?
             LIMIT 1`,
            [userId]
        );

        if (profiles.length === 0) {
            return res.status(200).json({
                Status: "Save",
                Message: "Profile Details Does Not Exists",
                profile: {
                    username: "",
                    phoneno: "",
                    emailid: ""
                }
            });
        }

        if (profiles.length === 1) {
            return res.status(200).json({
                Status: "Edit",
                Message: "Profile Details Exists",
                profile: profiles[0]
            });
        }

        return res.status(200).json({
            Status: "Failed",
            Message: "Unable to fetch Profile Details"
        });

    } catch (error) {
        console.error('User profile fetch error:', error.message);

        return res.status(500).json({
            Status: "Failed",
            Message: "Error in fetching Profile Details"
        });
    }
});

// Save User Profile
router.post('/save', async (req, res) => {
    try {
        const userId = req.body.tokenid;
        const profile = req.body.profile;

        if (!userId || !profile ||
            !profile.username || !profile.phoneno || !profile.emailid) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Invalid Profile Details"
            });
        }

        const [existing] = await db.execute(
            'SELECT id FROM user_profiles WHERE user_id = ? LIMIT 1',
            [userId]
        );

        if (existing.length > 0) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Profile Details Already Saved. Please Edit."
            });
        }

        await db.execute(
            `INSERT INTO user_profiles
             (user_id, username, phoneno, emailid)
             VALUES (?, ?, ?, ?)`,
            [
                userId,
                profile.username,
                profile.phoneno,
                profile.emailid
            ]
        );

        return res.status(200).json({
            Status: "Success",
            Message: "Profile Details Saved Successfully"
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(200).json({
                Status: "Failed",
                Message: "Profile Details Already Saved. Please Edit."
            });
        }

        console.error('User profile save error:', error.message);

        return res.status(500).json({
            Status: "Failed",
            Message: "Error in saving Profile Details"
        });
    }
});

// Edit User Profile
router.post('/edit', async (req, res) => {
    try {
        const userId = req.body.tokenid;
        const profile = req.body.profile;

        if (!userId || !profile ||
            !profile.username || !profile.phoneno || !profile.emailid) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Invalid Profile Details"
            });
        }

        const [existing] = await db.execute(
            'SELECT id FROM user_profiles WHERE user_id = ? LIMIT 1',
            [userId]
        );

        if (existing.length === 0) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Profile Details Does Not Exists. Cannot Edit"
            });
        }

        await db.execute(
            `UPDATE user_profiles
             SET username = ?, emailid = ?, phoneno = ?
             WHERE user_id = ?`,
            [
                profile.username,
                profile.emailid,
                profile.phoneno,
                userId
            ]
        );

        return res.status(200).json({
            Status: "Success",
            Message: "Profile Details Edited Successfully"
        });

    } catch (error) {
        console.error('User profile edit error:', error.message);

        return res.status(500).json({
            Status: "Failed",
            Message: "Error in editing Profile Details"
        });
    }
});

module.exports = router;
