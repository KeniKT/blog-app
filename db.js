require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'blog_app',
  password: process.env.DB_PASSWORD || '12345',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

// Custom error class for database constraint violations
class DatabaseError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
  }
}

// Helper function to handle database constraint errors
const handleDatabaseError = (error) => {
  if (error.code === '23505') { // Unique constraint violation
    if (error.constraint === 'users_email_key') {
      throw new DatabaseError('Email already exists', 'DUPLICATE_EMAIL');
    }
    if (error.constraint === 'users_name_key') {
      throw new DatabaseError('Username already exists', 'DUPLICATE_USERNAME');
    }
  }
  throw error;
};

// --- User Logic ---
const createUser = async (name, email, hashedPassword) => {
  try {
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, hashedPassword]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating user:', error);
    handleDatabaseError(error);
  }
};

const getUserByEmail = async (email) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  }
};

const getUserByName = async (name) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE name = $1', [name]);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting user by name:', error);
    throw error;
  }
};

const getUserById = async (id) => {
  try {
    const result = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [id]);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting user by id:', error);
    throw error;
  }
};

const updateUserProfile = async (id, name, email) => {
  try {
    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, name, email, updated_at',
      [name, email, id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating user profile:', error);
    handleDatabaseError(error);
  }
};

const updateUserPassword = async (id, hashedPassword) => {
  try {
    await pool.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, id]
    );
  } catch (error) {
    console.error('Error updating user password:', error);
    throw error;
  }
};

// --- Post Logic ---
const getAllPosts = async (limit = null, offset = 0) => {
  try {
    let query = `
      SELECT p.id, p.title, p.content, p.created_at, p.updated_at, p.user_id,
             u.name AS username 
      FROM posts p 
      LEFT JOIN users u ON p.user_id = u.id 
      ORDER BY p.created_at DESC
    `;
    
    const params = [];
    if (limit) {
      query += ' LIMIT $1 OFFSET $2';
      params.push(limit, offset);
    }
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error getting all posts:', error);
    throw error;
  }
};

const getPostById = async (id) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.title, p.content, p.created_at, p.updated_at, p.user_id,
             u.name AS username 
      FROM posts p 
      LEFT JOIN users u ON p.user_id = u.id 
      WHERE p.id = $1
    `, [id]);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting post by id:', error);
    throw error;
  }
};

const getPostsByUserId = async (userId, limit = null, offset = 0) => {
  try {
    let query = `
      SELECT p.id, p.title, p.content, p.created_at, p.updated_at, p.user_id,
             u.name AS username 
      FROM posts p 
      LEFT JOIN users u ON p.user_id = u.id 
      WHERE p.user_id = $1 
      ORDER BY p.created_at DESC
    `;
    
    const params = [userId];
    if (limit) {
      query += ' LIMIT $2 OFFSET $3';
      params.push(limit, offset);
    }
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error getting posts by user id:', error);
    throw error;
  }
};

const createPost = async (title, content, userId) => {
  try {
    const result = await pool.query(
      'INSERT INTO posts (title, content, user_id) VALUES ($1, $2, $3) RETURNING id, title, created_at',
      [title, content, userId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

const updatePost = async (id, title, content) => {
  try {
    const result = await pool.query(
      'UPDATE posts SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, title, updated_at',
      [title, content, id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating post:', error);
    throw error;
  }
};

const deletePost = async (id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Delete comments first (foreign key constraint)
    await client.query('DELETE FROM comments WHERE post_id = $1', [id]);
    const result = await client.query('DELETE FROM posts WHERE id = $1 RETURNING id', [id]);
    
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting post:', error);
    throw error;
  } finally {
    client.release();
  }
};

const getPostsCount = async (userId = null) => {
  try {
    let query = 'SELECT COUNT(*) FROM posts';
    const params = [];
    
    if (userId) {
      query += ' WHERE user_id = $1';
      params.push(userId);
    }
    
    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error getting posts count:', error);
    throw error;
  }
};

// --- Comment Logic ---
const getAllComments = async () => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.content, c.created_at, c.updated_at, c.post_id, c.user_id,
             u.name AS username 
      FROM comments c 
      LEFT JOIN users u ON c.user_id = u.id 
      ORDER BY c.created_at ASC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error getting all comments:', error);
    throw error;
  }
};

const getCommentById = async (id) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.content, c.created_at, c.updated_at, c.post_id, c.user_id,
             u.name AS username 
      FROM comments c 
      LEFT JOIN users u ON c.user_id = u.id 
      WHERE c.id = $1
    `, [id]);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting comment by id:', error);
    throw error;
  }
};

const getCommentsByPostId = async (postId) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.content, c.created_at, c.updated_at, c.post_id, c.user_id,
             u.name AS username 
      FROM comments c 
      LEFT JOIN users u ON c.user_id = u.id 
      WHERE c.post_id = $1 
      ORDER BY c.created_at ASC
    `, [postId]);
    return result.rows;
  } catch (error) {
    console.error('Error getting comments by post id:', error);
    throw error;
  }
};

const createComment = async (postId, content, userId) => {
  try {
    const result = await pool.query(
      'INSERT INTO comments (post_id, content, user_id) VALUES ($1, $2, $3) RETURNING id, created_at',
      [postId, content, userId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
};

const updateComment = async (id, content) => {
  try {
    const result = await pool.query(
      'UPDATE comments SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, updated_at',
      [content, id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
};

const deleteComment = async (id) => {
  try {
    const result = await pool.query('DELETE FROM comments WHERE id = $1 RETURNING id', [id]);
    return result.rows[0];
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};

// --- Optimized Recent Posts Logic ---
const getRecentPostsWithComments = async (limit = 10) => {
  try {
    // Get recent posts with their comments in a single optimized query
    const result = await pool.query(`
      SELECT 
        p.id as post_id,
        p.title,
        p.content,
        p.created_at as post_created_at,
        p.updated_at as post_updated_at,
        p.user_id as post_user_id,
        pu.name as post_username,
        c.id as comment_id,
        c.content as comment_content,
        c.created_at as comment_created_at,
        c.updated_at as comment_updated_at,
        c.user_id as comment_user_id,
        cu.name as comment_username
      FROM (
        SELECT * FROM posts 
        ORDER BY created_at DESC 
        LIMIT $1
      ) p
      LEFT JOIN users pu ON p.user_id = pu.id
      LEFT JOIN comments c ON p.id = c.post_id
      LEFT JOIN users cu ON c.user_id = cu.id
      ORDER BY p.created_at DESC, c.created_at ASC
    `, [limit]);

    // Transform the flat result into nested structure
    const postsMap = new Map();
    
    result.rows.forEach(row => {
      const postId = row.post_id;
      
      if (!postsMap.has(postId)) {
        postsMap.set(postId, {
          id: row.post_id,
          title: row.title,
          content: row.content,
          created_at: row.post_created_at,
          updated_at: row.post_updated_at,
          user_id: row.post_user_id,
          username: row.post_username,
          comments: []
        });
      }
      
      if (row.comment_id) {
        postsMap.get(postId).comments.push({
          id: row.comment_id,
          content: row.comment_content,
          created_at: row.comment_created_at,
          updated_at: row.comment_updated_at,
          user_id: row.comment_user_id,
          username: row.comment_username,
          post_id: postId
        });
      }
    });
    
    return Array.from(postsMap.values());
  } catch (error) {
    console.error('Error getting recent posts with comments:', error);
    throw error;
  }
};

// --- Search functionality ---
const searchPosts = async (searchTerm, limit = 20, offset = 0) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.title, p.content, p.created_at, p.updated_at, p.user_id,
             u.name AS username 
      FROM posts p 
      LEFT JOIN users u ON p.user_id = u.id 
      WHERE p.title ILIKE $1 OR p.content ILIKE $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `, [`%${searchTerm}%`, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error searching posts:', error);
    throw error;
  }
};

// --- Graceful shutdown ---
const closePool = async () => {
  try {
    await pool.end();
    console.log('Database pool closed successfully');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing database connection...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing database connection...');
  await closePool();
  process.exit(0);
});

// --- Export Functions ---
module.exports = {
  // User functions
  createUser,
  getUserByEmail,
  getUserByName,
  getUserById,
  updateUserProfile,
  updateUserPassword,
  
  // Post functions
  getAllPosts,
  getPostById,
  getPostsByUserId,
  createPost,
  updatePost,
  deletePost,
  getPostsCount,
  searchPosts,
  
  // Comment functions
  getAllComments,
  getCommentById,
  getCommentsByPostId,
  createComment,
  updateComment,
  deleteComment,
  
  // Combined functions
  getRecentPostsWithComments,
  
  // Utility functions
  closePool,
  
  // Error classes
  DatabaseError
};