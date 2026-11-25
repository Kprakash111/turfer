require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const connect = require('./connection');

const credadminroute = require('./routes/admincredrouting');
const creduserroute = require('./routes/usercredrouting');
const turfinforoute = require('./routes/turfinforouting');
const turfschroute = require('./routes/turfschedulingrouting');
const userprofileroute = require('./routes/userprofilerouting');
const bookturfroute = require('./routes/bookrouting');
const fetchdtlsroute = require('./routes/fetchturfdtlsrouting');
const userhistoryrouting = require('./routes/userhistoryrouting');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/adminlogin', credadminroute);
app.use('/userlogin', creduserroute);
app.use('/turfinfo', turfinforoute);
app.use('/turfschedule', turfschroute);
app.use('/userprofile', userprofileroute);
app.use('/bookturf', bookturfroute);
app.use('/turfhistory', fetchdtlsroute);
app.use('/userhistory', userhistoryrouting);

const frontendPath = path.join(__dirname, '../Frontend/build');

app.use(express.static(frontendPath));

app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

async function startServer() {
    try {
        await connect();

        // Start the automatic turf status scheduler after DB connection
        require('./scheduler/turfstatusupdate');

        app.listen(port, () => {
            console.log(`Turfer running on port ${port}`);
        });
    } catch (error) {
        console.error('Application startup failed:', error);
        process.exit(1);
    }
}

startServer();
