const express = require('express');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const axios = require('axios');

const app = express();
const JWT_SECRET = "gebeyamed_super_secret_key_2026"; 

// --- EMAIL CONFIGURATION ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Setup Uploads
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir); }
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename: (req, file, cb) => { cb(null, Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage: storage });

// Middleware
app.use('/uploads', express.static('uploads'));
app.use(express.json()); 
app.use(cookieParser());

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.redirect('/login');
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.redirect('/login');
        req.user = user;
        next();
    });
};

// --- PAGE ROUTES ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/vendor', authenticateToken, (req, res) => res.sendFile(path.join(__dirname, 'vendor.html')));
app.get('/sales', authenticateToken, (req, res) => res.sendFile(path.join(__dirname, 'sales.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'checkout.html')));

// --- 1. THE FIXED INQUIRY ROUTE ---
app.post('/api/inquiry/:id', async (req, res) => {
    try {
        const { hospital_name, email, phone, quantity } = req.body;
        const productId = req.params.id;
        const qty = parseInt(quantity) || 1;

        await pool.query(
            `INSERT INTO product_inquiries (product_id, hospital_name, contact_email, contact_phone, requested_quantity, status) 
             VALUES ($1, $2, $3, $4, $5, 'New')`,
            [productId, hospital_name, email, phone, qty]
        );
        res.json({ message: "Inquiry sent successfully!" });
    } catch (err) {
        console.error("Inquiry Error:", err);
        res.status(500).send('Error saving inquiry');
    }
});

// --- 2. NOTIFICATION COUNT ---
app.get('/api/vendor/inquiries/count', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query("SELECT COUNT(*) FROM product_inquiries WHERE status = 'New'");
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (err) { res.status(500).send("Error"); }
});

// --- 3. SALES DATA LIST ---
app.get('/api/sales/leads', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                pi.id, 
                pi.hospital_name, 
                pi.contact_email, 
                pi.contact_phone, 
                pi.requested_quantity, 
                pi.status, 
                i.product_name, 
                i.sku,
                i.unit_price
            FROM product_inquiries pi
            JOIN inventory i ON pi.product_id = i.product_id
            ORDER BY pi.id DESC`);
        res.json(result.rows);
    } catch (err) { 
        console.error("Fetch leads error:", err);
        res.status(500).send("Error fetching leads"); 
    }
});

// --- DELETE SALES INQUIRY ---
app.delete('/api/inquiry/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query("DELETE FROM product_inquiries WHERE id = $1", [req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send('Error deleting request');
    }
});

// --- THE SMART SUCCESS ROUTE ---
app.get('/success', async (req, res) => {
    const tx_ref = req.query.trx_ref || req.query.tx_ref;
    if (!tx_ref) return res.status(400).send("No transaction reference found.");

    try {
        const parts = tx_ref.split('-');
        const inquiryId = parts[1]; 

        const orderData = await pool.query(`
            SELECT pi.*, i.product_name, i.unit_price, i.product_id
            FROM product_inquiries pi 
            JOIN inventory i ON pi.product_id = i.product_id 
            WHERE pi.id = $1`, [inquiryId]);

        if (orderData.rows.length === 0) return res.status(404).send("Order not found.");

        const order = orderData.rows[0];
        const totalPrice = order.unit_price * order.requested_quantity;

        await pool.query("UPDATE product_inquiries SET status = 'Payment Completed' WHERE id = $1", [inquiryId]);
        await pool.query("UPDATE inventory SET stock_quantity = stock_quantity - $1 WHERE product_id = $2", [order.requested_quantity, order.product_id]);

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Payment Successful</title>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; display: flex; justify-content: center; padding: 40px; }
                    .invoice-card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); max-width: 500px; width: 100%; border-top: 10px solid #2ecc71; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .details { border: 1px dashed #ddd; padding: 15px; border-radius: 8px; margin: 20px 0; background: #fafafa; }
                    .row { display: flex; justify-content: space-between; margin: 10px 0; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                    .btn { display: inline-block; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; cursor: pointer; border: none; }
                    .btn-print { background: #2c3e50; color: white; }
                    .btn-home { background: #3498db; color: white; margin-left: 10px; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="invoice-card">
                    <div class="header">
                        <div style="font-size: 50px;">✅</div>
                        <h1 style="color: #2c3e50; margin: 5px 0;">Payment Received!</h1>
                    </div>
                    <div class="details">
                        <div class="row"><span>Customer:</span> <strong>${order.hospital_name}</strong></div>
                        <div class="row"><span>Product:</span> <strong>${order.product_name}</strong></div>
                        <div class="row"><span>Qty:</span> <strong>${order.requested_quantity}</strong></div>
                        <div class="row"><span>Total Paid:</span> <strong>${totalPrice.toLocaleString()} ETB</strong></div>
                        <div class="row"><span>Status:</span> <strong style="color:#2ecc71;">PAID</strong></div>
                    </div>
                    <div style="text-align: center;" class="no-print">
                        <button onclick="window.print()" class="btn btn-print">🖨️ Print Receipt</button>
                        <a href="/" class="btn btn-home">Return to Store</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error("Payment Success Error:", err);
        res.status(500).send("Database Error.");
    }
});

// --- 4. MARK AS CONTACTED ---
app.post('/api/inquiry/contact/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query("UPDATE product_inquiries SET status = 'Contacted' WHERE id = $1", [req.params.id]);
        res.sendStatus(200);
    } catch (err) { res.status(500).send('Error'); }
});

// --- 5. GENERATE PAYMENT ---
app.post('/api/generate-payment/:inquiryId', authenticateToken, async (req, res) => {
    try {
        const { inquiryId } = req.params;
        const secretToken = crypto.randomBytes(32).toString('hex');
        const customRef = `tx-${inquiryId}-${Date.now()}`; 

        const details = await pool.query(`
            SELECT pi.id, pi.contact_email, pi.contact_phone, pi.hospital_name, pi.requested_quantity, i.product_name, i.unit_price 
            FROM product_inquiries pi 
            JOIN inventory i ON pi.product_id = i.product_id 
            WHERE pi.id = $1`, [inquiryId]);

        if (details.rows.length === 0) return res.status(404).json({ message: "Inquiry not found" });
        
        const order = details.rows[0];
        const price = parseFloat(order.unit_price) || 0;
        const qty = parseInt(order.requested_quantity) || 1;
        const totalAmount = price * qty;

        let formattedPhone = String(order.contact_phone || '').trim().replace(/\s+/g, '');
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '+251' + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('+') && formattedPhone !== '') {
            formattedPhone = '+251' + formattedPhone;
        }

        const chapaResponse = await axios.post('https://api.chapa.co/v1/transaction/initialize', {
            amount: totalAmount,
            currency: 'ETB',
            email: order.contact_email,
            phone_number: formattedPhone, 
            first_name: order.hospital_name,
            last_name: 'Customer',
            tx_ref: customRef,
            callback_url: `https://webhook.site/placeholder`, 
            return_url: `http://localhost:3000/success?trx_ref=${customRef}`,
            "customization[title]": `Invoice for ${qty} x ${order.product_name}`,
        }, {
            headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}` }
        });

        if (chapaResponse.data.status === 'success') {
            const checkoutUrl = chapaResponse.data.data.checkout_url;
            await pool.query("UPDATE product_inquiries SET payment_token = $1, status = 'Invoice Sent' WHERE id = $2", [secretToken, inquiryId]);
            
            const invitationLink = `http://localhost:3000/checkout?token=${secretToken}&pay_url=${encodeURIComponent(checkoutUrl)}`;
            
            await transporter.sendMail({
                from: `"GebeyaMed Sales" <${process.env.EMAIL_USER}>`,
                to: order.contact_email,
                subject: `Invoice for ${qty} units of ${order.product_name}`,
                html: `<h3>Order Summary</h3>
                       <p>Product: ${order.product_name}</p>
                       <p>Quantity: ${qty}</p>
                       <p>Total Amount: <strong>${totalAmount.toLocaleString()} ETB</strong></p>
                       <p>Please complete your payment here: <a href="${invitationLink}">${invitationLink}</a></p>`
            });
            
            res.json({ message: "Invoice sent!" });
        } else {
            res.status(400).json({ message: "Chapa Error: " + chapaResponse.data.message });
        }
    } catch (err) { 
        console.error("CHAPA SAYS:", err.response ? err.response.data : err.message);
        const errorMessage = err.response ? err.response.data.message : "Network Error";
        res.status(500).json({ message: "Failed: " + errorMessage }); 
    }
});

// --- 6. AUTH & INVENTORY ---
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).send("User not found");
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(401).send("Invalid password");
        const token = jwt.sign({ id: user.user_id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true });
        res.json({ message: "Logged in!", role: user.role });
    } catch (err) { res.status(500).send("Login error"); }
});

app.get('/api/inventory', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM inventory ORDER BY product_id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).send('Database error'); }
});

app.post('/api/inventory/add', authenticateToken, upload.single('productImage'), async (req, res) => {
    try {
        const { product_name, sku, category, unit_price, stock_quantity } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        await pool.query(
            'INSERT INTO inventory (product_name, sku, category, unit_price, stock_quantity, image_url) VALUES ($1, $2, $3, $4, $5, $6)',
            [product_name, sku, category, unit_price, stock_quantity, imageUrl]
        );
        res.sendStatus(200);
    } catch (err) { res.status(500).send("Error adding product"); }
});

// --- NEW: UPDATE STOCK ROUTE ---
app.post('/api/inventory/update-stock/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { increment } = req.body;
        await pool.query(
            "UPDATE inventory SET stock_quantity = stock_quantity + $1 WHERE product_id = $2",
            [increment, id]
        );
        res.sendStatus(200);
    } catch (err) {
        console.error("Stock Update Error:", err);
        res.status(500).send("Error updating stock.");
    }
});

app.delete('/api/inventory/:id', authenticateToken, async (req, res) => {
    try {
        const productId = req.params.id;
        await pool.query("DELETE FROM product_inquiries WHERE product_id = $1", [productId]);
        await pool.query("DELETE FROM inventory WHERE product_id = $1", [productId]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send("Error deleting product.");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));