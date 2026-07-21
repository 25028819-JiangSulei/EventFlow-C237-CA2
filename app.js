const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const bcrypt = require('bcrypt');
const path = require('path');
const methodOverride = require('method-override');

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(methodOverride('_method'));

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
    res.redirect('/events/view/' + result.insertId);
    });
});

// View all events
app.get('/events/view', isLoggedIn, (req, res) => {
  const sql = 'SELECT * FROM events ORDER BY event_date ASC, event_time ASC';

  db.query(sql, (err, results) => {
    if (err) {
      console.log('Error fetching events:', err);
      req.flash('error', 'Unable to load events');
      return res.redirect('/events');
    }

    res.render('viewEvents', { events: results });
  });
});

// View single event details
app.get('/events/view/:id', isLoggedIn, (req, res) => {
  const eventId = req.params.id;
  const sql = 'SELECT * FROM events WHERE event_id = ?';

  db.query(sql, [eventId], (err, results) => {
    if (err) {
      console.log('Error fetching event:', err);
      req.flash('error', 'Unable to load event');
      return res.redirect('/events/view');
    }

    if (results.length === 0) {
      req.flash('error', 'Event not found');
      return res.redirect('/events/view');
    }

    res.render('eventDetails', { event: results[0] });
  });
});

// Show edit form for an event
app.get('/events/edit/:id', isAdmin, (req, res) => {
  const eventId = req.params.id;
  const sql = 'SELECT * FROM events WHERE event_id = ?';

  db.query(sql, [eventId], (err, results) => {
    if (err) {
      console.log('Error fetching event:', err);
      req.flash('error', 'Unable to load event');
      return res.redirect('/events/view');
    }

    if (results.length === 0) {
      req.flash('error', 'Event not found');
      return res.redirect('/events/view');
    }

    res.render('editEvent', { event: results[0] });
  });
});

// Save changes to an event
app.post('/events/edit/:id', isAdmin, (req, res) => {
  const eventId = req.params.id;
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
    return res.redirect('/events/edit/' + eventId);
  }

  const sql = `
    UPDATE events
    SET event_name = ?, description = ?, event_date = ?, event_time = ?, location = ?, category = ?
    WHERE event_id = ?
  `;

  const values = [
    event_name,
    description,
    event_date,
    event_time,
    location,
    category,
    eventId
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.log('Error updating event:', err);
      req.flash('error', 'Unable to update event');
      return res.redirect('/events/edit/' + eventId);
    }

    req.flash('success', 'Event updated successfully!');
    res.redirect('/events/view/' + eventId);
  });
});

// Show delete confirmation page for an event
app.get('/events/delete/:id', isAdmin, (req, res) => {
  const eventId = req.params.id;
  const sql = 'SELECT * FROM events WHERE event_id = ?';

  db.query(sql, [eventId], (err, results) => {
    if (err) {
      console.log('Error fetching event:', err);
      req.flash('error', 'Unable to load event');
      return res.redirect('/events/view');
    }

    if (results.length === 0) {
      req.flash('error', 'Event not found');
      return res.redirect('/events/view');
    }

    res.render('deleteEvent', { event: results[0] });
  });
});

// Delete an event
app.post('/events/delete/:id', isAdmin, (req, res) => {
  const eventId = req.params.id;
  const sql = 'DELETE FROM events WHERE event_id = ?';

  db.query(sql, [eventId], (err, result) => {
    if (err) {
      console.log('Error deleting event:', err);
      req.flash('error', 'Unable to delete event');
      return res.redirect('/events/view');
    }

    req.flash('success', 'Event deleted successfully!');
    res.redirect('/events/view');
  });
});

//Event Registration + Search & Filter
// 1. View all events 
app.get('/events/view', isLoggedIn, (req, res) => {
  const { search, category } = req.query;
  let sql = 'SELECT * FROM events WHERE 1=1';
  const params = [];
  if (search) {
    sql += ' AND (event_name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY event_date ASC, event_time ASC';

  db.query(sql, params, (err, results) => {
    if (err) {
      console.log('Error fetching events:', err);
      req.flash('error', 'Unable to load events');
      return res.redirect('/events');
    }
    res.render('viewEvents', { 
        events: results, 
        searchQuery: search || '', 
        selectedCategory: category || '' 
    });
  });
});
// 2. View single event details 
app.get('/events/view/:id', isLoggedIn, (req, res) => {
  const eventId = req.params.id;
  const userId = req.session.user.user_id;

  const sqlEvent = 'SELECT * FROM events WHERE event_id = ?';
  const sqlCheckReg = 'SELECT * FROM registrations WHERE event_id = ? AND user_id = ?';

  db.query(sqlEvent, [eventId], (err, eventResults) => {
    if (err) {
      console.log('Error fetching event:', err);
      req.flash('error', 'Unable to load event');
      return res.redirect('/events/view');
    }
    if (eventResults.length === 0) {
      req.flash('error', 'Event not found');
      return res.redirect('/events/view');
    }
    db.query(sqlCheckReg, [eventId, userId], (err, regResults) => {
      const isRegistered = regResults && regResults.length > 0;
      
      res.render('eventDetails', { 
          event: eventResults[0], 
          isRegistered: isRegistered 
      });
    });
  });
});
// 3. Register for an event 
app.post('/events/:id/register', isLoggedIn, (req, res) => {
  const eventId = req.params.id;
  const userId = req.session.user.user_id;

  const sql = 'INSERT INTO registrations (event_id, user_id) VALUES (?, ?)';
  
  db.query(sql, [eventId, userId], (err, result) => {
    if (err) {
      
      if (err.code === 'ER_DUP_ENTRY') {
        req.flash('error', 'You are already registered for this event.');
      } else {
        console.log('Registration error:', err);
        req.flash('error', 'Registration failed.');
      }
    } else {
      req.flash('success', 'Successfully registered for the event!');
    }

    res.redirect('/events/view/' + eventId);
  });
});

// 4. Cancel Registration 
app.post('/events/:id/cancel', isLoggedIn, (req, res) => {
  const eventId = req.params.id;
  const userId = req.session.user.user_id;

  const sql = 'DELETE FROM registrations WHERE event_id = ? AND user_id = ?';
  
  db.query(sql, [eventId, userId], (err, result) => {
    if (err) {
      console.log('Cancellation error:', err);
      req.flash('error', 'Cancellation failed.');
    } else {
      req.flash('success', 'Successfully cancelled your registration.');
    }
    res.redirect('/events/view/' + eventId);
  });
});