const express = require('express');
const bodyParser = require('body-parser');
const pool = require('./db');
const path = require('path');

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM posts ORDER BY created_at DESC');
  res.render('index', { posts: result.rows });
});

app.get('/new', (req, res) => {
  res.render('new');
});

app.post('/posts', async (req, res) => {
  const { title, content } = req.body;
  await pool.query('INSERT INTO posts (title, content) VALUES ($1, $2)', [title, content]);
  res.redirect('/');
});

app.get('/edit/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
  res.render('edit', { post: result.rows[0] });
});

app.post('/edit/:id', async (req, res) => {
  const { title, content } = req.body;
  await pool.query('UPDATE posts SET title = $1, content = $2 WHERE id = $3', [title, content, req.params.id]);
  res.redirect('/');
});

app.post('/delete/:id', async (req, res) => {
  await pool.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
  res.redirect('/');
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
