
const express = require('express');
const router = express.Router();
const db = require('../connection').pool;

const DEFAULT_TIMES = Array.from(
    { length: 24 },
    (_, hour) => `${String(hour).padStart(2, '0')}:00`
);

function defaultTimings() {
    return DEFAULT_TIMES.map(time => ({
        time,
        status: "NA"
    }));
}

// Fetch Turf Information
router.post('/buttonpress', async (req, res) => {
    try {
        const adminId = req.body.tokenid;

        if (!adminId) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Admin ID is required"
            });
        }

        const [turfs] = await db.execute(
            `SELECT id, admin_id, turfname, location,
                    pricewithlight, pricewithoutlight,
                    starttimewithoutlight, endtimewithoutlight
             FROM turfs
             WHERE admin_id = ?
             LIMIT 1`,
            [adminId]
        );

        if (turfs.length === 0) {
            const info = {
                adminid: adminId,
                turfname: "",
                location: "",
                pricewithlight: "",
                pricewithoutlight: "",
                starttimewithoutlight: "",
                endtimewithoutlight: "",
                turftiming: defaultTimings()
            };

            return res.status(200).json({
                Status: "Save",
                Message: "Information Does Not Exists",
                info
            });
        }

        const turf = turfs[0];

        const [slots] = await db.execute(
            `SELECT time, status
             FROM turf_default_slots
             WHERE turf_id = ?
             ORDER BY time ASC`,
            [turf.id]
        );

        const info = {
            _id: turf.id,
            adminid: turf.admin_id,
            turfname: turf.turfname,
            location: turf.location,
            pricewithlight: turf.pricewithlight,
            pricewithoutlight: turf.pricewithoutlight,
            starttimewithoutlight: turf.starttimewithoutlight,
            endtimewithoutlight: turf.endtimewithoutlight,
            turftiming: slots
        };

        return res.status(200).json({
            Status: "Edit",
            Message: "Information Exists",
            info
        });

    } catch (error) {
        console.error('Turf information fetch error:', error.message);

        return res.status(500).json({
            Status: "Failed",
            Message: "Error in fetching Turf Information"
        });
    }
});

// Save New Turf Information
router.post('/save', async (req, res) => {
    let connection;

    try {
        const adminId = req.body.tokenid;
        const info = req.body.info;

        if (!adminId || !info || !Array.isArray(info.turftiming)) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Invalid Turf Information"
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [existing] = await connection.execute(
            'SELECT id FROM turfs WHERE admin_id = ? LIMIT 1',
            [adminId]
        );

        if (existing.length > 0) {
            await connection.rollback();

            return res.status(200).json({
                Status: "Failed",
                Message: "Information Already Exists. Please Edit."
            });
        }

        const [result] = await connection.execute(
            `INSERT INTO turfs
             (admin_id, turfname, location, pricewithlight,
              pricewithoutlight, starttimewithoutlight,
              endtimewithoutlight)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                adminId,
                info.turfname,
                info.location,
                info.pricewithlight,
                info.pricewithoutlight,
                info.starttimewithoutlight,
                info.endtimewithoutlight
            ]
        );

        const turfId = result.insertId;

        for (const slot of info.turftiming) {
            await connection.execute(
                `INSERT INTO turf_default_slots (turf_id, time, status)
                 VALUES (?, ?, ?)`,
                [turfId, slot.time, slot.status]
            );
        }

        await connection.commit();

        return res.status(200).json({
            Status: "Success",
            Message: "Information Saved Successfully"
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error('Turf information save error:', error.message);

        return res.status(500).json({
            Status: "Failed",
            Message: "Error in saving Turf Information"
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Edit Existing Turf Information
router.post('/edit', async (req, res) => {
    let connection;

    try {
        const adminId = req.body.tokenid;
        const info = req.body.info;

        if (!adminId || !info || !Array.isArray(info.turftiming)) {
            return res.status(200).json({
                Status: "Failed",
                Message: "Invalid Turf Information"
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [turfs] = await connection.execute(
            'SELECT id FROM turfs WHERE admin_id = ? LIMIT 1',
            [adminId]
        );

        if (turfs.length !== 1) {
            await connection.rollback();

            return res.status(200).json({
                Status: "Failed",
                Message: "Information Does Not Exist. Cannot Edit"
            });
        }

        const turfId = turfs[0].id;

        await connection.execute(
            `UPDATE turfs
             SET turfname = ?,
                 location = ?,
                 pricewithlight = ?,
                 pricewithoutlight = ?,
                 starttimewithoutlight = ?,
                 endtimewithoutlight = ?
             WHERE id = ?`,
            [
                info.turfname,
                info.location,
                info.pricewithlight,
                info.pricewithoutlight,
                info.starttimewithoutlight,
                info.endtimewithoutlight,
                turfId
            ]
        );

        // Replace the existing default slots
        await connection.execute(
            'DELETE FROM turf_default_slots WHERE turf_id = ?',
            [turfId]
        );

        for (const slot of info.turftiming) {
            await connection.execute(
                `INSERT INTO turf_default_slots (turf_id, time, status)
                 VALUES (?, ?, ?)`,
                [turfId, slot.time, slot.status]
            );
        }

        await connection.commit();

        return res.status(200).json({
            Status: "Success",
            Message: "Information Edited Successfully"
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error('Turf information edit error:', error.message);

        return res.status(500).json({
            Status: "Failed",
            Message: "Error in editing Turf Information"
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;
