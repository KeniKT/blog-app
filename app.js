const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./db');
const path = require('path');

const app = express();

// Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Middleware to make user available in all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user ? {
    id: req.session.user.id,
    name: req.session.user.name,
    email: req.session.user.email
  } : null;
  next();
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Database error handler wrapper
const handleDbError = (res, error, message = 'Database error occurred') => {
  console.error('Database error:', error);
  
  // Check if it's a database connection error
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return res.status(500).render('error', { 
      message: 'Database connection failed. Please make sure PostgreSQL is running.' 
    });
  }
  
  // Check if it's a table doesn't exist error
  if (error.message && error.message.includes('does not exist')) {
    return res.status(500).render('error', { 
      message: 'Database tables not found. Please run the database setup commands.' 
    });
  }
  
  return res.status(500).render('error', { message });
};

// Routes
app.get('/', async (req, res) => {
  try {
    const posts = await db.getRecentPostsWithComments();
    res.render('landing', { posts });
  } catch (error) {
    handleDbError(res, error, 'Failed to load posts');
  }
});

app.get('/blog', async (req, res) => {
  try {
    const posts = await db.getAllPosts();
    res.render('index', { posts });
  } catch (error) {
    handleDbError(res, error, 'Failed to load articles');
  }
});

// Authentication Routes
app.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});

app.post('/signup', async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    
    // Validation
    if (!name || !email || !password || !confirmPassword) {
      return res.render('signup', { error: 'All fields are required' });
    }
    
    if (password !== confirmPassword) {
      return res.render('signup', { error: 'Passwords do not match' });
    }
    
    if (password.length < 6) {
      return res.render('signup', { error: 'Password must be at least 6 characters long' });
    }
    
    // Check if user already exists by email
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.render('signup', { error: 'Email already registered' });
    }
    
    // Check if username already exists by name
    const existingName = await db.getUserByName(name);
    if (existingName) {
      return res.render('signup', { error: 'Username already taken' });
    }
    
    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.createUser(name, email, hashedPassword);
    
    res.redirect('/login?message=Account created successfully');
  } catch (error) {
    console.error('Signup error:', error);
    if (error.message && error.message.includes('does not exist')) {
      return res.render('signup', { 
        error: 'Database not properly set up. Please contact administrator.' 
      });
    }
    res.render('signup', { error: 'Failed to create account' });
  }
});

app.get('/login', (req, res) => {
  const message = req.query.message || null;
  res.render('login', { error: null, message });
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.render('login', { error: 'Email and password are required', message: null });
    }
    
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.render('login', { error: 'Invalid email or password', message: null });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.render('login', { error: 'Invalid email or password', message: null });
    }
    
    // Store user in session
    req.session.user = {
      id: user.id,
      name: user.name,  
      email: user.email
    }
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    if (error.message && error.message.includes('does not exist')) {
      return res.render('login', { 
        error: 'Database not properly set up. Please contact administrator.', 
        message: null 
      });
    }
    res.render('login', { error: 'Login failed', message: null });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const userPosts = await db.getPostsByUserId(req.session.user.id);
    res.render('dashboard', { posts: userPosts });
  } catch (error) {
    handleDbError(res, error, 'Failed to load dashboard');
  }
});

// Protected routes (require authentication)
app.get('/new', requireAuth, (req, res) => {
  res.render('new');
});

app.post('/posts', requireAuth, async (req, res) => {
  try {
    const { title, content } = req.body;
    await db.createPost(title, content, req.session.user.id);
    res.redirect('/dashboard');
  } catch (error) {
    handleDbError(res, error, 'Failed to create post');
  }
});

app.get('/edit/:id', requireAuth, async (req, res) => {
  try {
    const post = await db.getPostById(req.params.id);
    
    if (!post) {
      return res.status(404).render('error', { message: 'Post not found' });
    }
    
    // Check if user owns the post
    if (post.user_id !== req.session.user.id) {
      return res.status(403).render('error', { message: 'You can only edit your own posts' });
    }
    
    res.render('edit', { post });
  } catch (error) {
    handleDbError(res, error, 'Post not found');
  }
});

app.post('/edit/:id', requireAuth, async (req, res) => {
  try {
    const post = await db.getPostById(req.params.id);
    
    if (!post) {
      return res.status(404).render('error', { message: 'Post not found' });
    }
    
    // Check if user owns the post
    if (post.user_id !== req.session.user.id) {
      return res.status(403).render('error', { message: 'You can only edit your own posts' });
    }
    
    const { title, content } = req.body;
    await db.updatePost(req.params.id, title, content);
    res.redirect('/dashboard');
  } catch (error) {
    handleDbError(res, error, 'Failed to update post');
  }
});

app.post('/delete/:id', requireAuth, async (req, res) => {
  try {
    const post = await db.getPostById(req.params.id);
    
    if (!post) {
      return res.status(404).render('error', { message: 'Post not found' });
    }
    
    // Check if user owns the post
    if (post.user_id !== req.session.user.id) {
      return res.status(403).render('error', { message: 'You can only delete your own posts' });
    }
    
    await db.deletePost(req.params.id);
    res.redirect('/dashboard');
  } catch (error) {
    handleDbError(res, error, 'Failed to delete post');
  }
});

app.post('/comments/:postId', requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    const { postId } = req.params;
    await db.createComment(postId, content, req.session.user.id);
    res.redirect(`/#post-${postId}`);
  } catch (error) {
    handleDbError(res, error, 'Failed to add comment');
  }
});

app.post('/comment/edit/:id', requireAuth, async (req, res) => {
  try {
    const comment = await db.getCommentById(req.params.id);
    
    if (!comment) {
      return res.status(404).render('error', { message: 'Comment not found' });
    }
    
    // Check if user owns the comment
    if (comment.user_id !== req.session.user.id) {
      return res.status(403).render('error', { message: 'You can only edit your own comments' });
    }
    
    await db.updateComment(req.params.id, req.body.content);
    res.redirect(`/#post-${comment.post_id}`);
  } catch (error) {
    handleDbError(res, error, 'Failed to update comment');
  }
});

app.post('/comment/delete/:id', requireAuth, async (req, res) => {
  try {
    const comment = await db.getCommentById(req.params.id);
    
    if (!comment) {
      return res.status(404).render('error', { message: 'Comment not found' });
    }
    
    // Check if user owns the comment
    if (comment.user_id !== req.session.user.id) {
      return res.status(403).render('error', { message: 'You can only delete your own comments' });
    }
    
    await db.deleteComment(req.params.id);
    res.redirect(`/#post-${comment.post_id}`);
  } catch (error) {
    handleDbError(res, error, 'Failed to delete comment');
  }
});

app.get('/about', (req, res) => {
  res.render('about');
});

app.get('/contact', (req, res) => {
  res.render('contact');
});

// 404 handler - must be before error handler
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).render('error', { message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});