cat > Backend/routes/userhistoryrouting.js <<'EOF'
const express = require('express');
const router = express.Router();
const moment = require('moment');
const db = require('../connection').pool;

router.post('/buttonpress', async (req, res) => {
    try {
        const { tokenid } = req.body;

        if (!tokenid) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Unable to fetch User History"
            });
        }

        const now = moment();
        const sysdateliteral = now.format("YYYY-MM-DD");
        const currentHour = now.format("HH");
        const systimeliteral1 = `${currentHour}:00`;
        const systimeliteral2 = `${currentHour}:59`;

        // Find the logged-in user's profile
        const [profiles] = await db.execute(
            `SELECT id
             FROM user_profiles
             WHERE user_id = ?
             LIMIT 1`,
            [tokenid]
        );

        if (profiles.length !== 1) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Unable to fetch User History"
            });
        }

        // Fetch the customer's bookings, newest first
        const [bookings] = await db.execute(
            `SELECT
                t.turfname,
                DATE_FORMAT(ts.schdate, '%Y-%m-%d') AS schdate,
                ss.price,
                ss.time
             FROM schedule_slots ss
             INNER JOIN turf_schedules ts
                ON ts.id = ss.schedule_id
             INNER JOIN turfs t
                ON t.id = ts.turf_id
             WHERE ss.customer_profile_id = ?
               AND ss.status = 'B'
             ORDER BY ts.schdate DESC, ss.time DESC
             LIMIT 20`,
            [profiles[0].id]
        );

        if (bookings.length === 0) {
            return res.status(200).json({
                Status: "Failed",
                Message: "No Turf Booked Till Now"
            });
        }

        const userhistorylis = bookings.map(booking => {
            let status;

            if (booking.schdate < sysdateliteral) {
                status = "Completed";
            } else if (booking.schdate > sysdateliteral) {
                status = "Scheduled";
            } else if (booking.time < systimeliteral1) {
                status = "Completed";
            } else if (booking.time < systimeliteral2) {
                status = "In-Progress";
            } else {
                status = "Scheduled";
            }

            return {
                turfname: booking.turfname,
                schdate: booking.schdate,
                price: booking.price,
                time: booking.time,
                status
            };
        });

        return res.status(200).json({
            Status: "Success",
            Message: "User history fetched successfully",
            userhistorylis
        });

    } catch (error) {
        console.error('User history fetch error:', error.message);

        return res.status(500).json({
            Status: "Failed",
            Message: "Error in fetching User History"
        });
    }
});

module.exports = router;
EOF