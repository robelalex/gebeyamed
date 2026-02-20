GebeyaMed: B2B Medical Supply Chain Platform
GebeyaMed is a full-stack digital marketplace designed to bridge the gap between medical equipment importers and healthcare institutions in Ethiopia. It automates the procurement lifecycle—from real-time inventory tracking to secure payment processing.

🚀 Key Features
1, Vendor Inventory Management: Real-time stock tracking with automated "Low Stock" indicators and CRUD operations for medical assets.

2, Automated Inquiry System: Seamless lead generation allowing hospitals to request specific quantities of medical supplies.

3, Fintech Integration: Full integration with the Chapa Payment Gateway, supporting local ETB transactions and Telebirr.

4, Smart Invoicing: Automated generation of unique payment tokens and printable digital receipts upon successful transaction verification.

5, Secure Authentication: Role-Based Access Control (RBAC) implemented via JWT (JSON Web Tokens) and Bcrypt password hashing.

🛠️ Tech Stack
1, Frontend: HTML5, CSS3, JavaScript (ES6+), Axios.

2, Backend: Node.js, Express.js.

3, Database: PostgreSQL (Relational Database with ACID compliance).

4, Communication: Nodemailer (SMTP) for automated invoice delivery.

5, APIs: Chapa Payment API.

🏗️ System Architecture
The project follows a Three-Tier Architecture:

1, Presentation Layer: Responsive web interface for vendors and buyers.

2, Logic Layer: Node.js/Express RESTful API handling business logic and payment webhooks.

3, Data Layer: PostgreSQL ensuring data integrity for financial transactions and inventory counts.

⚙️ Installation & Setup
Clone the repository:

Bash
git clone https://github.com/robelalex/gebeyamed.git
cd gebeyamed
Install dependencies:

Bash
npm install
Environment Variables:
Create a .env file and add the following:

Code snippet
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=gebeyamed
CHAPA_SECRET_KEY=your_chapa_key
EMAIL_USER=your_email
EMAIL_PASS=your_app_password
Run the application:

Bash
npm start

🛡️ Security Measures
Password Security: All user passwords are encrypted using Bcrypt salt-hashing.

Authentication: Protected routes are secured using JWT-based middleware.

Transaction Safety: Implemented server-side validation to prevent stock-count manipulation during the checkout process.

👨‍💻 Author
Robel Alemayehu 4th Year Software Engineering Student at Jimma University https://www.linkedin.com/public-profile/settings/?trk=d_flagship3_profile_self_view_public_profile&lipi=urn%3Ali%3Apage%3Ad_flagship3_profile_view_base%3B1DaUme0ESu2zpjg%2FF%2F521w%3D%3D | https://personal-portfolio-x11z.vercel.app/