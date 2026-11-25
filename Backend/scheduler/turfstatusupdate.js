cat > Backend/scheduler/turfstatusupdate.js <<'EOF'
const cron = require('node-cron');
const moment = require('moment');
const db = require('../connection').pool;

const crontask = cron.schedule("0 * * * *", async () => {
    try {
        const sysdate = moment();
        const systimeliteral = sysdate.format("HH:00");
        const sysdateliteral = sysdate.format("YYYY-MM-DD");

        const [result] = await db.execute(
            `UPDATE schedule_slots ss
             INNER JOIN turf_schedules ts
                ON ts.id = ss.schedule_id
             SET ss.status = 'NB'
             WHERE ts.schdate = ?
               AND ss.status = 'A'
               AND ss.time <= ?`,
            [sysdateliteral, systimeliteral]
        );

        console.log(
            `Turf scheduler completed. Slots updated: ${result.affectedRows}`
        );

    } catch (error) {
        console.error('Turf scheduler error:', error.message);
    }
});

module.exports = crontask;
EOF