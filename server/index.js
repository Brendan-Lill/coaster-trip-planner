require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
const { auth } = require("express-oauth2-jwt-bearer");
const PORT = process.env.PORT || 3000;

const checkJwt = auth({
    audience: process.env.AUTH0_AUDIENCE,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
});

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

app.get("/api/data/:name", async (req, res) => {
  try {
    const filePath = path.join(
      __dirname,
      "data",
      `${req.params.name}.json`
    );

    const fileContents = await fs.readFile(filePath, "utf8");

    res.json(JSON.parse(fileContents));
  } catch (error) {
    res.status(404).json({
      error: "File not found",
    });
  }
});

app.post("/api/trips", checkJwt, async (req, res) => {
    const userId = req.auth.payload.sub;
    const tripHTML = req.body.tripHTML;

    try {
        const query = 'INSERT INTO trips(user_id, trip_data) VALUES($1, $2)';
        await pool.query(query, [userId, tripHTML]);
        
        res.status(201).json({ message: "Trip saved successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save to database" });
    }
});

app.get("/api/trips", checkJwt, async (req, res) => {
    const userId = req.auth.payload.sub;

    try {
        const query = 'SELECT trip_data, created_at FROM trips WHERE user_id = $1 ORDER BY created_at ASC';
        const { rows } = await pool.query(query, [userId]);
        
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch trips" });
    }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});