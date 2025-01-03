const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db');
const path = require('path');

const app = express();

// Set view engine and static files
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes

// Home page - list posts with comments grouped
app.get('/', async (req, res) => {
  try {
    const posts = await db.getAllPosts();
    const comments = await db.getAllComments();

    // Group comments by post ID
    const commentsByPost = {};
    comments.forEach(comment => {
      if (!commentsByPost[comment.post_id]) {
        commentsByPost[comment.post_id] = [];
      }
      commentsByPost[comment.post_id].push(comment);
    });

    res.render('index', { posts, commentsByPost });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// Render new post form
app.get('/new', (req, res) => {
  res.render('new');
});

// Create a new post
app.post('/posts', async (req, res) => {
  const { title, content } = req.body;
  try {
    await db.createPost(title, content);
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Failed to create post');
  }
});

// Render edit post form
app.get('/edit/:id', async (req, res) => {
  try {
    const post = await db.getPostById(req.params.id);
    res.render('edit', { post });
  } catch (err) {
    res.status(500).send('Post not found');
  }
});

// Update a post
app.post('/edit/:id', async (req, res) => {
  const { title, content } = req.body;
  try {
    await db.updatePost(req.params.id, title, content);
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Failed to update post');
  }
});

// Delete a post
app.post('/delete/:id', async (req, res) => {
  try {
    await db.deletePost(req.params.id);
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Failed to delete post');
  }
});

// Add a comment to a post
app.post('/comments/:postId', async (req, res) => {
  const { content } = req.body;
  const { postId } = req.params;
  try {
    await db.createComment(postId, content);
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Failed to submit comment');
  }
});

// Edit a comment
app.post('/comment/edit/:id', async (req, res) => {
  try {
    await db.updateComment(req.params.id, req.body.content);
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Failed to update comment');
  }
});

// Delete a comment
app.post('/comment/delete/:id', async (req, res) => {
  try {
    await db.deleteComment(req.params.id);
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Failed to delete comment');
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
