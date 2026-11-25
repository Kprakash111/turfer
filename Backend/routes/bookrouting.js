
const express = require('express');
const router = express.Router();
const moment = require('moment');
const db = require('../connection').pool;

// Fetch Available Turfs
router.post('/fetchavailableturfs', async (req, res) => {
    try {
        const { bookingdate, bookingtime } = req.body;

        if (!bookingdate || !bookingtime) {
            return res.status(200).json({
                Status: "NA",
                Message: "No Turf Available For Booking"
            });
        }

        const date = moment(bookingdate);

        if (!date.isValid()) {
            return res.status(200).json({
                Status: "NA",
                Message: "No Turf Available For Booking"
            });
        }

        const formattedDate = date.format('YYYY-MM-DD');

        const [rows] = await db.execute(
            `SELECT
                t.id AS turfid,
                t.turfname,
                DATE_FORMAT(ts.schdate, '%Y-%m-%d') AS schdate,
                ss.time,
                ss.status,
                ss.price
             FROM turf_schedules ts
             INNER JOIN turfs t ON t.id = ts.turf_id
             INNER JOIN schedule_slots ss ON ss.schedule_id = ts.id
             WHERE ts.schdate = ?
               AND ss.status = 'A'
               AND ss.time >= ?
             ORDER BY t.id, ss.time`,
            [formattedDate, bookingtime]
        );

        if (rows.length === 0) {
            return res.status(200).json({
                Status: "NA",
                Message: "No Turf Available For Booking"
            });
        }

        const turfMap = new Map();

        for (const row of rows) {
            if (!turfMap.has(row.turfid)) {
                turfMap.set(row.turfid, {
                    turfname: row.turfname,
                    turfid: row.turfid,
                    schdate: row.schdate,
                    turftiming: []
                });
            }

            turfMap.get(row.turfid).turftiming.push({
                time: row.time,
                status: row.status,
                price: row.price
            });
        }

        const turflis = Array.from(turfMap.values());

        return res.status(200).json({
            Status: "A",
            Message: "Turf Available",
            turflis
        });

    } catch (error) {
        console.error('Available turf fetch error:', error.message);

        return res.status(500).json({
            Status: "Failed",
            Message: "Error in fetching Available Turves"
        });
    }
});

// Save Turf Booking
router.post('/savebooking', async (req, res) => {
    let connection;

    try {
        const { tokenid, bookingdtls } = req.body;

        if (!tokenid || !bookingdtls ||
            !bookingdtls.schdate || !bookingdtls.turfid ||
            !Array.isArray(bookingdtls.selectedtiming) ||
            bookingdtls.selectedtiming.length === 0) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Invalid booking information"
            });
        }

        const bookingDate = moment(bookingdtls.schdate);

        if (!bookingDate.isValid()) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Invalid booking date"
            });
        }

        const schdate = bookingDate.format('YYYY-MM-DD');

        // Remove duplicate selected times
        const selectedTimes = [
            ...new Set(bookingdtls.selectedtiming)
        ];

        if (selectedTimes.some(time =>
            typeof time !== 'string' ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
        )) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Invalid selected booking time"
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Find the customer's profile
        const [profiles] = await connection.execute(
            `SELECT id
             FROM user_profiles
             WHERE user_id = ?
             LIMIT 1`,
            [tokenid]
        );

        if (profiles.length === 0) {
            await connection.rollback();

            return res.status(200).json({
                Status: "Failed",
                Message: "Booking Failed. Please Update Profile First."
            });
        }

        const customerProfileId = profiles[0].id;

        // Lock the schedule row to serialize bookings for this schedule
        const [schedules] = await connection.execute(
            `SELECT id
             FROM turf_schedules
             WHERE turf_id = ? AND schdate = ?
             LIMIT 1
             FOR UPDATE`,
            [bookingdtls.turfid, schdate]
        );

        if (schedules.length === 0) {
            await connection.rollback();

            return res.status(200).json({
                Status: "Failed",
                Message: "Booking Failed. Turf Schedule Does Not Exist."
            });
        }

        const scheduleId = schedules[0].id;

        // Lock all requested slots before checking their availability
        const placeholders = selectedTimes.map(() => '?').join(',');

        const [slots] = await connection.execute(
            `SELECT id, time, status
             FROM schedule_slots
             WHERE schedule_id = ?
               AND time IN (${placeholders})
             ORDER BY time
             FOR UPDATE`,
            [scheduleId, ...selectedTimes]
        );

        const slotMap = new Map(
            slots.map(slot => [slot.time, slot])
        );

        // Check every requested slot before booking any of them
        for (const time of selectedTimes) {
            const slot = slotMap.get(time);

            if (!slot || slot.status !== 'A') {
                await connection.rollback();

                return res.status(200).json({
                    Status: "Failed",
                    Message: "Booking Failed. Turf Slot For "
                        .concat(time)
                        .concat(" Already Booked")
                });
            }
        }

        // Book all selected slots
        for (const time of selectedTimes) {
            const slot = slotMap.get(time);

            const [result] = await connection.execute(
                `UPDATE schedule_slots
                 SET status = 'B',
                     customer_profile_id = ?
                 WHERE id = ? AND status = 'A'`,
                [customerProfileId, slot.id]
            );

            if (result.affectedRows !== 1) {
                throw new Error('Slot booking update failed');
            }
        }

        await connection.commit();

        return res.status(200).json({
            Status: "Success",
            Message: "Turf Booked Succesfully"
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error('Turf booking error:', error.message);

        return res.status(500).json({
            Status: "Failed",
            Message: "Error in booking turf"
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;
