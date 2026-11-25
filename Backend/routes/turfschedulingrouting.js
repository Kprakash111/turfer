
const express = require('express');
const router = express.Router();
const moment = require('moment');
const db = require('../connection').pool;

router.post('/schedule', async (req, res) => {
    let connection;

    try {
        const { tokenid, startdate, enddate, turftiming } = req.body;

        if (!tokenid || !startdate || !enddate ||
            !Array.isArray(turftiming) || turftiming.length === 0) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Invalid scheduling information"
            });
        }

        const start = moment(startdate);
        const end = moment(enddate);

        if (!start.isValid() || !end.isValid() ||
            start.format('YYYY-MM-DD') !== String(startdate).substring(0, 10) ||
            end.format('YYYY-MM-DD') !== String(enddate).substring(0, 10) ||
            start.isAfter(end, 'day')) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Invalid scheduling date range"
            });
        }

        const startDateFormatted = start.format('YYYY-MM-DD');
        const endDateFormatted = end.format('YYYY-MM-DD');

        // Find the turf belonging to this admin
        const [turfs] = await db.execute(
            'SELECT id FROM turfs WHERE admin_id = ? LIMIT 1',
            [tokenid]
        );

        if (turfs.length !== 1) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Failed to schedule. Unable to fetch Turf Information"
            });
        }

        const turfId = turfs[0].id;

        // Prepare all dates, inclusive of start and end dates
        const dates = [];
        const currentDate = start.clone();

        while (currentDate.isSameOrBefore(end, 'day')) {
            dates.push(currentDate.format('YYYY-MM-DD'));
            currentDate.add(1, 'day');
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Check whether any date is already scheduled
        const [existingSchedules] = await connection.execute(
            `SELECT DATE_FORMAT(schdate, '%Y-%m-%d') AS schdate
             FROM turf_schedules
             WHERE turf_id = ?
               AND schdate BETWEEN ? AND ?
             ORDER BY schdate ASC
             LIMIT 1`,
            [turfId, startDateFormatted, endDateFormatted]
        );

        if (existingSchedules.length > 0) {
            await connection.rollback();

            return res.status(200).json({
                Status: "Failed",
                Message: "Failed to schedule. Already Scheduled for "
                    .concat(existingSchedules[0].schdate)
            });
        }

        // Create one schedule and its slots for each date
        for (const date of dates) {
            const [scheduleResult] = await connection.execute(
                `INSERT INTO turf_schedules (turf_id, schdate)
                 VALUES (?, ?)`,
                [turfId, date]
            );

            const scheduleId = scheduleResult.insertId;

            for (const slot of turftiming) {
                if (!slot.time || !slot.status) {
                    throw new Error('Invalid hourly slot information');
                }

                await connection.execute(
                    `INSERT INTO schedule_slots
                     (schedule_id, time, status, price, customer_profile_id)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        scheduleId,
                        slot.time,
                        slot.status,
                        slot.price ?? 0,
                        slot.cstmrid ?? null
                    ]
                );
            }
        }

        await connection.commit();

        return res.status(200).json({
            Status: "Success",
            Message: "Turf Scheduled Successfully"
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error('Turf scheduling error:', error.message);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(200).json({
                Status: "Failed",
                Message: "Failed to schedule. One or more dates are already scheduled."
            });
        }

        return res.status(500).json({
            Status: "Failed",
            Message: "Error in scheduling Turf"
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;
