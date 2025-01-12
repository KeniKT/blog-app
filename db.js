const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'blog_app',
  password: '12345',
  port: 5432,
});

// --- Post Logic ---
const getAllPosts = async () => {
  const result = await pool.query('SELECT * FROM posts ORDER BY created_at DESC');
  return result.rows;
};

const getPostById = async (id) => {
  const result = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
  return result.rows[0];
};

const createPost = async (title, content) => {
  await pool.query('INSERT INTO posts (title, content) VALUES ($1, $2)', [title, content]);
};

const updatePost = async (id, title, content) => {
  await pool.query('UPDATE posts SET title = $1, content = $2 WHERE id = $3', [title, content, id]);
};

const deletePost = async (id) => {
  await pool.query('DELETE FROM posts WHERE id = $1', [id]);
};

// --- Comment Logic ---
const getAllComments = async () => {
  const result = await pool.query('SELECT * FROM comments ORDER BY created_at ASC');
  return result.rows;
};

// ADDED MISSING FUNCTION
const getCommentById = async (id) => {
  const result = await pool.query('SELECT * FROM comments WHERE id = $1', [id]);
  return result.rows[0];
};

const createComment = async (postId, content) => {
  await pool.query('INSERT INTO comments (post_id, content) VALUES ($1, $2)', [postId, content]);
};

const updateComment = async (id, content) => {
  await pool.query('UPDATE comments SET content = $1 WHERE id = $2', [content, id]);
};

const deleteComment = async (id) => {
  await pool.query('DELETE FROM comments WHERE id = $1', [id]);
};

// --- Recent Posts Logic ---
const getRecentPostsWithComments = async () => {
  const posts = await pool.query(
    'SELECT * FROM posts ORDER BY created_at DESC LIMIT 10'
  );
  const comments = await pool.query(
    'SELECT * FROM comments ORDER BY created_at ASC'
  );
  
  return posts.rows.map(post => ({
    ...post,
    comments: comments.rows.filter(c => c.post_id === post.id)
  }));
};

// --- Export Functions ---
module.exports = {
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  getAllComments,
  getCommentById, // ADDED TO EXPORTS
  createComment,
  updateComment,
  deleteComment,
  getRecentPostsWithComments
};