-- SALESSETTLE DATABASE DUMP (PRO SWAMI SHARNAM)

-- 1. Create Enums
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'salesperson');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'delivered', 'cancelled');
CREATE TYPE settlement_status AS ENUM ('pending', 'partial', 'settled');
CREATE TYPE activity_type AS ENUM ('login', 'logout', 'order_created', 'order_updated', 'settlement', 'invoice_uploaded', 'customer_added', 'product_added');

-- 2. Create Tables
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'salesperson',
    phone VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    gstin VARCHAR(15),
    pan VARCHAR(10),
    address TEXT,
    city VARCHAR(100),
    beat VARCHAR(255),
    credit_limit DECIMAL(12,2) DEFAULT 0,
    outstanding_balance DECIMAL(12,2) DEFAULT 0,
    assigned_salesperson_id INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    erp_id VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(20) DEFAULT 'PCS',
    mrp DECIMAL(10,2) NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    gst_rate DECIMAL(5,2) DEFAULT 18,
    hsn_code VARCHAR(20),
    stock_qty INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    salesperson_id INTEGER NOT NULL REFERENCES users(id),
    order_date TIMESTAMP DEFAULT NOW(),
    due_date TIMESTAMP,
    status order_status DEFAULT 'pending',
    subtotal DECIMAL(12,2) NOT NULL,
    total_gst DECIMAL(12,2) DEFAULT 0,
    grand_total DECIMAL(12,2) NOT NULL,
    amount_paid DECIMAL(12,2) DEFAULT 0,
    balance DECIMAL(12,2) NOT NULL,
    settlement_status settlement_status DEFAULT 'pending',
    beat VARCHAR(255),
    notes TEXT,
    credit_days INTEGER DEFAULT 0
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    short_quantity INTEGER DEFAULT 0,
    return_quantity INTEGER DEFAULT 0,
    unit_price DECIMAL(10,2) NOT NULL,
    taxable_amount DECIMAL(10,2) NOT NULL,
    gst_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL
);

CREATE TABLE settlements (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    salesperson_id INTEGER NOT NULL REFERENCES users(id),
    amount DECIMAL(12,2) NOT NULL,
    cash_amount DECIMAL(12,2) DEFAULT 0,
    online_amount DECIMAL(12,2) DEFAULT 0,
    payment_mode VARCHAR(50) NOT NULL,
    denominations JSONB,
    clearing_days INTEGER DEFAULT 0,
    reference_number VARCHAR(100),
    notes TEXT,
    settled_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    activity_type activity_type NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL
);

-- 3. Initial Demo Data
INSERT INTO users (email, password, name, role, phone) VALUES
('admin@salessettle.in', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'Super Admin', 'admin', '9000000001'),
('rohit@salessettle.in', 'f2053153549f7e59eb251e39b97b0a790f4236a267d30790e9603f9a73c333f3', 'Rohit Sharma', 'salesperson', '9000000003');

INSERT INTO products (erp_id, name, category, mrp, base_price, gst_rate, hsn_code, stock_qty) VALUES
('FE089200180756601D', 'Swami Ghee 500ml', 'Ghee', 180.00, 165.00, 5.00, '0405', 250),
('F1088700480691200D', 'Swami Desi Ghee 1L', 'Ghee', 350.00, 320.00, 5.00, '0405', 180);
