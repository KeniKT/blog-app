const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db');
const path = require('path');

const app = express();

// Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', async (req, res) => {
  try {
    const posts = await db.getRecentPostsWithComments();
    res.render('landing', { posts });
  } catch (error) {
    console.error('Root route error:', error);
    res.status(500).render('error', { message: 'Failed to load posts' });
  }
});

app.get('/blog', async (req, res) => {
  try {
    const posts = await db.getAllPosts();
    res.render('index', { posts });
  } catch (error) {
    console.error('Blog route error:', error);
    res.status(500).render('error', { message: 'Failed to load articles' });
  }
});

app.get('/new', (req, res) => {
  res.render('new');
});

app.post('/posts', async (req, res) => {
  try {
    const { title, content } = req.body;
    await db.createPost(title, content);
    res.redirect('/#posts-top');
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).render('error', { message: 'Failed to create post' });
  }
});

app.get('/edit/:id', async (req, res) => {
  try {
    const post = await db.getPostById(req.params.id);
    res.render('edit', { post });
  } catch (error) {
    console.error('Edit post error:', error);
    res.status(500).render('error', { message: 'Post not found' });
  }
});

app.post('/edit/:id', async (req, res) => {
  try {
    const { title, content } = req.body;
    await db.updatePost(req.params.id, title, content);
    res.redirect(`/#post-${req.params.id}`);
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).render('error', { message: 'Failed to update post' });
  }
});

app.post('/delete/:id', async (req, res) => {
  try {
    await db.deletePost(req.params.id);
    res.redirect('/#posts-top');
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).render('error', { message: 'Failed to delete post' });
  }
});

app.post('/comments/:postId', async (req, res) => {
  try {
    const { content } = req.body;
    const { postId } = req.params;
    await db.createComment(postId, content);
    res.redirect(`/#post-${postId}`);
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).render('error', { message: 'Failed to add comment' });
  }
});

app.post('/comment/edit/:id', async (req, res) => {
  try {
    const comment = await db.getCommentById(req.params.id);
    await db.updateComment(req.params.id, req.body.content);
    res.redirect(`/#post-${comment.post_id}`);
  } catch (error) {
    console.error('Edit comment error:', error);
    res.status(500).render('error', { message: 'Failed to update comment' });
  }
});

app.post('/comment/delete/:id', async (req, res) => {
  try {
    const comment = await db.getCommentById(req.params.id);
    await db.deleteComment(req.params.id);
    res.redirect(`/#post-${comment.post_id}`);
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).render('error', { message: 'Failed to delete comment' });
  }
});

app.get('/about', (req, res) => {
  res.render('about');
});

app.get('/contact', (req, res) => {
  res.render('contact');
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