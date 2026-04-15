const request = require('supertest');
const { expect } = require('chai');
const app = require('../server');
const fs = require('node:fs');
const path = require('node:path');

describe('Campus Compass Backend API', () => {
    
    // Cleanup/Setup before each test if needed
    before((done) => {
        // Ensure data directory exists
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        done();
    });

    describe('GET /', () => {
        it('should return the index.html page', async () => {
            const res = await request(app).get('/');
            expect(res.status).to.equal(200);
            expect(res.type).to.equal('text/html');
        });
    });

    describe('GET /students', () => {
        it('should return an array of students', async () => {
            const res = await request(app).get('/students');
            expect(res.status).to.equal(200);
            expect(res.body).to.be.an('array');
        });
    });

    describe('POST /add-student', () => {
        it('should successfully add a student with valid data', async () => {
            const student = {
                name: 'Test Student',
                student_id: 'TEST001',
                email: 'test@university.edu',
                department: 'Computer Science',
                major: 'Security',
                gpa: '3.9',
                phone: '555-9999',
                year: 'Senior'
            };

            const res = await request(app)
                .post('/add-student')
                .send(student);
            
            expect(res.status).to.equal(201);
            expect(res.body.message).to.equal('Student Added');
            expect(res.body.total).to.be.a('number');
        });

        it('should reject a student with missing name', async () => {
            const res = await request(app)
                .post('/add-student')
                .send({ student_id: 'FAIL001' });
            
            expect(res.status).to.equal(400);
            expect(res.body.error).to.include('Full Name (min 2 chars) required');
        });

        it('should sanitize HTML from name', async () => {
            const res = await request(app)
                .post('/add-student')
                .send({ name: '<b>Hacker</b>', student_id: 'HACK001' });
            
            expect(res.status).to.equal(201);
            // Search to verify sanitization
            const searchRes = await request(app).get('/search?name=Hacker');
            const hacker = searchRes.body.find(s => s.student_id === 'HACK001');
            expect(hacker.name).to.equal('Hacker');
        });
    });

    describe('GET /search', () => {
        it('should return filtered students by name', async () => {
            const res = await request(app).get('/search?name=John');
            expect(res.status).to.equal(200);
            expect(res.body).to.be.an('array');
        });

        it('should handle empty search query', async () => {
            const res = await request(app).get('/search?name=');
            expect(res.status).to.equal(200);
            expect(res.body).to.be.an('array');
        });
    });

    describe('GET /metrics', () => {
        it('should return Prometheus metrics', async () => {
            const res = await request(app).get('/metrics');
            expect(res.status).to.equal(200);
            expect(res.text).to.include('http_requests_total');
        });
    });

    describe('404 Handler', () => {
        it('should return 404 for non-existent routes', async () => {
            const res = await request(app).get('/non-existent-route');
            expect(res.status).to.equal(404);
            expect(res.body.error).to.equal('Route not found');
        });
    });
});
