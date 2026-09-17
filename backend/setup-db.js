require("dotenv").config();

const fs = require("fs");
const pool = require("./db");

async function setup() {
  try {
    const sql = fs.readFileSync("./database.sql", "utf8");

    await pool.query(sql);

    console.log("Database tables created successfully!");

    await pool.end();
  } catch (error) {
    console.error("Database setup failed:");
    console.error(error.message);
    process.exit(1);
  }
}

setup();