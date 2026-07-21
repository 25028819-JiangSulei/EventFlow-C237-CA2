const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: 'eventflow_secret_key_2026',
  resave: false,
  saveUninitialized: true
}));

app.use(flash());

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

const db = mysql.createConnection({
  host: 'c237-eaint-mysql.mysql.database.azure.com',
  user: 'c237_013',
  password: 'c237013@2026!',
  database: 'c237_013_teamniubi',
  ssl: {
    rejectUnauthorized: true
  }
});

db.connect((err) => {
  if (err) {
    console.log('Database connection failed:', err);
  } else {
    console.log('Connected to Azure MySQL');
  }
});

function isLoggedIn(req, res, next) {
  if (req.session.user) {
    return next();
  }
  req.flash('error', 'Please login first');
  res.redirect('/login');
}

function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  req.flash('error', 'Access denied. Admins only.');
  res.redirect('/events');
}

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const { full_name, email, password, confirm_password } = req.body;

  if (password !== confirm_password) {
    req.flash('error', 'Passwords do not match');
    return res.redirect('/register');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = 'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)';
    db.query(sql, [full_name, email, hashedPassword, 'user'], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          req.flash('error', 'Email already registered');
        } else {
          req.flash('error', 'Registration failed');
        }
        return res.redirect('/register');
      }
      req.flash('success', 'Registration successful! Please login.');
      res.redirect('/login');
    });
  } catch (error) {
    req.flash('error', 'Something went wrong');
    res.redirect('/register');
  }
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const sql = 'SELECT * FROM users WHERE email = ?';
  db.query(sql, [email], async (err, results) => {
    if (err) throw err;

    if (results.length === 0) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/login');
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);

    if (match) {
      req.session.user = {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      };
      req.flash('success', 'Welcome back, ' + user.full_name);
      res.redirect('/events');
    } else {
      req.flash('error', 'Invalid email or password');
      res.redirect('/login');
    }
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/', (req, res) => {
  res.redirect('/events');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


//part b: event + dashboard

// Dashboard
app.get('/events', isLoggedIn, (req, res) => {
    res.render('dashboard');
});

// Create Event page
app.get('/events/create', isLoggedIn, (req, res) => {
    res.render('createEvent');
});

// Save new event into database
app.post('/events/create', isLoggedIn, (req, res) => {
  const {
    event_name,
    description,
    event_date,
    event_time,
    location,
    category
  } = req.body;

  if (!event_name || !event_date || !event_time || !location || !category) {
    req.flash('error', 'Please fill in all required fields');
    return res.redirect('/events/create');
  }

  const created_by = req.session.user.user_id;

  const sql = `
    INSERT INTO events
    (
      event_name,
      description,
      event_date,
      event_time,
      location,
      category,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    event_name,
    description,
    event_date,
    event_time,
    location,
    category,
    created_by
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.log('Error creating event:', err);
      req.flash('error', 'Unable to create event');
      return res.redirect('/events/create');
    }

    req.flash('success', 'Event created successfully!');
    res.redirect('/events');
  });
});