const express = require("express");
const path = require("path");
const fs = require("fs");
const csv = require("csv-parser");
const multer = require("multer");
const client = require("prom-client");

// Setup default prometheus metrics (e.g. CPU, memory)
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

// Custom metrics
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const app = express();

// Middleware to count requests
app.use((req, res, next) => {
  res.on('finish', () => {
    // We only count API routes or we can count all
    if (req.path !== '/metrics') {
      httpRequestCounter.labels(req.method, req.path, res.statusCode).inc();
    }
  });
  next();
});

console.log("SERVER RUNNING 🚀");

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.set("trust proxy", 1);

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// File upload setup - more permissive
const upload = multer({ 
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
  // Removed strict fileFilter to debug
});

// In-memory database
let students = [];

// ➤ Add student manually
app.post("/add-student", (req, res) => {
  try {
    const student = req.body;
    if (!student.name || student.name.trim() === "") {
      return res.status(400).json({ error: "Student name required" });
    }
    students.push(student);
    res.json({ message: "Student Added", total: students.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ➤ Get all students
app.get("/students", (req, res) => {
  console.log('GET /students - count:', students.length);
  res.json(students);
});

// ➤ Upload CSV - SIMPLIFIED for debugging
app.post("/upload-csv", upload.single("file"), (req, res) => {
  console.log('Upload received:', req.file ? req.file.filename : 'NO FILE');
  
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  students = []; // reset

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => {
      console.log('Parsed row:', row);
      students.push(row);
    })
    .on("end", () => {
      console.log('CSV parse complete, students:', students.length);
      // Cleanup
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Cleanup error:', err);
      });
      res.json({ message: "CSV Uploaded Successfully", count: students.length });
    })
    .on("error", (err) => {
      console.error('CSV parse error:', err);
      res.status(500).json({ error: "CSV parse error: " + err.message });
    });
});

// ➤ Search student
app.get("/search", (req, res) => {
  try {
    const query = (req.query.name || "").toString().toLowerCase();
    const result = students.filter(s =>
      (s.name || "").toString().toLowerCase().includes(query)
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ➤ Force homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ➤ Prometheus Metrics
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.send(await client.register.metrics());
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

// Start server
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Students initial count: ${students.length}`);
});

