cat > Backend/routes/fetchturfdtlsrouting.js <<'EOF'
const express = require('express');
const router = express.Router();
const moment = require('moment');
const db = require('../connection').pool;

router.post('/fetchdtls', async (req, res) => {
    try {
        const { tokenid, schdate } = req.body;

        if (!tokenid || !schdate || !moment(schdate).isValid()) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Invalid turf information"
            });
        }

        const schdate1 = moment(schdate).format("YYYY-MM-DD");

        // Find the admin's turf
        const [turfs] = await db.execute(
            `SELECT id
             FROM turfs
             WHERE admin_id = ?
             LIMIT 1`,
            [tokenid]
        );

        if (turfs.length === 0) {
            return res.status(200).json({
                Status: "Failed",
                Message: "No turf scheduled on : ".concat(schdate1)
            });
        }

        // Find the schedule for the selected date
        const [schedules] = await db.execute(
            `SELECT id
             FROM turf_schedules
             WHERE turf_id = ? AND schdate = ?
             LIMIT 1`,
            [turfs[0].id, schdate1]
        );

        if (schedules.length === 0) {
            return res.status(200).json({
                Status: "Failed",
                Message: "No turf scheduled on : ".concat(schdate1)
            });
        }

        // Fetch slot details and customer information
        const [slots] = await db.execute(
            `SELECT
                ss.time,
                ss.price,
                ss.status,
                up.username,
                up.phoneno
             FROM schedule_slots ss
             LEFT JOIN user_profiles up
                ON up.id = ss.customer_profile_id
             WHERE ss.schedule_id = ?
             ORDER BY ss.time`,
            [schedules[0].id]
        );

        const listdtls = slots.map(slot => {
            let status = "Not Scheduled";

            if (slot.status === "B") {
                status = "Booked";
            } else if (slot.status === "A") {
                status = "Available";
            } else if (slot.status === "NB") {
                status = "Not Booked";
            }

            return {
                time: slot.time,
                price: slot.price,
                mobile: slot.status === "B" ? (slot.phoneno || "-") : "-",
                name: slot.status === "B" ? (slot.username || "-") : "-",
                status
            };
        });

        return res.status(200).json({
            Status: "Success",
            Message: "Fetched Succesfully",
            Data: listdtls
        });

    } catch (error) {
        console.error('Turf details fetch error:', error.message);

        return res.status(500).json({
            Status: "Failed",
            Message: "Error in fetching Turf History"
        });
    }
});

module.exports = router;
EOF