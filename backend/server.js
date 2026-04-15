const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const csv = require("csv-parser");
const multer = require("multer");
const client = require("prom-client");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

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

// Security Middleware
app.set("trust proxy", "loopback"); // Strictly trust loopback for local k3s setup

// Configure Helmet for local development
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      "img-src": ["'self'", "data:", "blob:"],
      "style-src": ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      "font-src": ["'self'", "fonts.gstatic.com"],
      "connect-src": ["'self'"],
      "upgrade-insecure-requests": null, // Disable forced HTTPS upgrade
    },
  },
  hsts: false, // Disabling HSTS to prevent forced HTTPS on local IPs
}));
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." }
});
app.use(limiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// File upload setup - more permissive
const upload = multer({ 
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }, // Reduced to 5MB for security
  fileFilter: (req, file, cb) => {
    // Strictly allow only CSV files
    if (path.extname(file.originalname).toLowerCase() === ".csv") {
      cb(null, true);
    } else {
      cb(new Error("Only .csv files are allowed"));
    }
  }
});

// In-memory database with persistence
const DATA_PATH = path.join(__dirname, "data", "students.json");
let students = [];

// Load data from file if exists
function loadData() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const data = fs.readFileSync(DATA_PATH, "utf8");
      students = JSON.parse(data);
      console.log(`LOADED: ${students.length} students from persistence.`);
    }
  } catch (err) {
    console.error("Error loading data:", err);
    students = [];
  }
}

// Save data to file
function saveData() {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(students, null, 2), "utf8");
    console.log(`SAVED: ${students.length} students to persistence.`);
  } catch (err) {
    console.error("Error saving data:", err);
  }
}

// Initialize data
loadData();

// ➤ Add student manually
app.post("/add-student", (req, res) => {
  try {
    const { name, ...otherDetails } = req.body;
    
    // Improved validation
    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Valid student name required" });
    }
    
    // Sanitize name (remove potential HTML/script tags)
    const sanitizedName = name.replace(/<[^>]*>?/gm, "").trim();
    
    const student = {
      name: sanitizedName,
      student_id: otherDetails.student_id ? String(otherDetails.student_id) : `S-${Date.now()}`,
      email: otherDetails.email || undefined,
      department: otherDetails.department || undefined,
      gpa: otherDetails.gpa || undefined,
      major: otherDetails.major || undefined,
      phone: otherDetails.phone || undefined,
      year: otherDetails.year || undefined,
      timestamp: new Date().toISOString()
    };
    
    students.push(student);
    saveData();
    res.json({ message: "Student Added", total: students.length });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ➤ Get all students
app.get("/students", (req, res) => {
  res.json(students);
});

// ➤ Upload CSV
app.post("/upload-csv", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const newStudents = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => {
      // Basic cleaning
      if (row.name) {
        newStudents.push(row);
      }
    })
    .on("end", () => {
      // Choose whether to append or replace. Let's merge for better UX.
      students = [...students, ...newStudents];
      saveData();
      
      // Cleanup
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Cleanup error:', err);
      });
      res.json({ message: "CSV Data Synchronized", count: students.length });
    })
    .on("error", (err) => {
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

