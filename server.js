require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const pool = require("./db");

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
});

app.use(limiter);

/* =========================
   AUTHENTICATION
========================= */

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.json({
    message: "News Feed API is running!",
  });
});

/* =========================
   REGISTER
========================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      username,
      email,
      password,
    } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message:
          "Username, email and password are required",
      });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.toLowerCase().trim();

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        message:
          "Username must contain at least 3 characters",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message:
          "Password must contain at least 6 characters",
      });
    }

    const existing = await pool.query(
      `
      SELECT id
      FROM users
      WHERE email = $1
      OR username = $2
      `,
      [cleanEmail, cleanUsername]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        message:
          "Username or email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(
      password,
      10
    );

    const result = await pool.query(
      `
      INSERT INTO users
      (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, username, email
      `,
      [
        cleanUsername,
        cleanEmail,
        passwordHash,
      ]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.status(201).json({
      message: "Registration successful",
      token,
      user,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

/* =========================
   LOGIN
========================= */

app.post("/api/auth/login", async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Email and password are required",
      });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM users
      WHERE email = $1
      `,
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message:
          "Invalid email or password",
      });
    }

    const user = result.rows[0];

    const validPassword =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!validPassword) {
      return res.status(401).json({
        message:
          "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

/* =========================
   GLOBAL FEED
========================= */

app.get("/api/posts", async (req, res) => {
  try {
    const currentUserId =
      Number(req.query.userId) || 0;

    const result = await pool.query(
      `
      SELECT
        posts.id,
        posts.content,
        posts.created_at,

        users.id AS user_id,
        users.username,

        COUNT(DISTINCT likes.user_id)::int
          AS likes,

        COUNT(DISTINCT comments.id)::int
          AS comments,

        EXISTS (
          SELECT 1
          FROM likes my_like
          WHERE my_like.post_id = posts.id
          AND my_like.user_id = $1
        ) AS liked

      FROM posts

      JOIN users
        ON users.id = posts.user_id

      LEFT JOIN likes
        ON likes.post_id = posts.id

      LEFT JOIN comments
        ON comments.post_id = posts.id

      GROUP BY
        posts.id,
        users.id,
        users.username

      ORDER BY posts.created_at DESC

      LIMIT 50
      `,
      [currentUserId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not load posts",
    });
  }
});

/* =========================
   FOLLOWING FEED
========================= */

app.get(
  "/api/feed/following",
  authenticate,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          posts.id,
          posts.content,
          posts.created_at,

          users.id AS user_id,
          users.username,

          COUNT(DISTINCT likes.user_id)::int
            AS likes,

          COUNT(DISTINCT comments.id)::int
            AS comments,

          EXISTS (
            SELECT 1
            FROM likes my_like
            WHERE my_like.post_id = posts.id
            AND my_like.user_id = $1
          ) AS liked

        FROM posts

        JOIN users
          ON users.id = posts.user_id

        JOIN follows
          ON follows.following_id = posts.user_id
          AND follows.follower_id = $1

        LEFT JOIN likes
          ON likes.post_id = posts.id

        LEFT JOIN comments
          ON comments.post_id = posts.id

        GROUP BY
          posts.id,
          users.id,
          users.username

        ORDER BY posts.created_at DESC

        LIMIT 50
        `,
        [req.user.id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not load following feed",
      });
    }
  }
);

/* =========================
   CREATE POST
========================= */

app.post(
  "/api/posts",
  authenticate,
  async (req, res) => {
    try {
      const { content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({
          message:
            "Post content is required",
        });
      }

      if (content.trim().length > 1000) {
        return res.status(400).json({
          message:
            "Post cannot exceed 1000 characters",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO posts
        (user_id, content)
        VALUES ($1, $2)

        RETURNING
          id,
          content,
          created_at
        `,
        [
          req.user.id,
          content.trim(),
        ]
      );

      res.status(201).json(
        result.rows[0]
      );
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not create post",
      });
    }
  }
);

/* =========================
   DELETE OWN POST
========================= */

app.delete(
  "/api/posts/:id",
  authenticate,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        DELETE FROM posts
        WHERE id = $1
        AND user_id = $2

        RETURNING id
        `,
        [
          req.params.id,
          req.user.id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message:
            "Post not found or you cannot delete it",
        });
      }

      res.json({
        message: "Post deleted",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not delete post",
      });
    }
  }
);

/* =========================
   SEARCH USERS
========================= */

app.get(
  "/api/users/search",
  async (req, res) => {
    try {
      const { q } = req.query;

      if (!q || !q.trim()) {
        return res.json([]);
      }

      const result = await pool.query(
        `
        SELECT
          id,
          username
        FROM users
        WHERE username ILIKE $1
        ORDER BY username
        LIMIT 20
        `,
        [`%${q.trim()}%`]
      );

      res.json(result.rows);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not search users",
      });
    }
  }
);

/* =========================
   FOLLOW USER
========================= */

app.post(
  "/api/users/:id/follow",
  authenticate,
  async (req, res) => {
    try {
      const targetUserId =
        Number(req.params.id);

      if (
        !Number.isInteger(targetUserId)
      ) {
        return res.status(400).json({
          message: "Invalid user id",
        });
      }

      if (
        targetUserId === req.user.id
      ) {
        return res.status(400).json({
          message:
            "You cannot follow yourself",
        });
      }

      const userExists =
        await pool.query(
          `
          SELECT id
          FROM users
          WHERE id = $1
          `,
          [targetUserId]
        );

      if (userExists.rows.length === 0) {
        return res.status(404).json({
          message:
            "User not found",
        });
      }

      await pool.query(
        `
        INSERT INTO follows
        (follower_id, following_id)
        VALUES ($1, $2)

        ON CONFLICT DO NOTHING
        `,
        [
          req.user.id,
          targetUserId,
        ]
      );

      res.json({
        message: "User followed",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not follow user",
      });
    }
  }
);

/* =========================
   UNFOLLOW USER
========================= */

app.delete(
  "/api/users/:id/follow",
  authenticate,
  async (req, res) => {
    try {
      await pool.query(
        `
        DELETE FROM follows

        WHERE follower_id = $1
        AND following_id = $2
        `,
        [
          req.user.id,
          req.params.id,
        ]
      );

      res.json({
        message:
          "User unfollowed",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not unfollow user",
      });
    }
  }
);

/* =========================
   FOLLOW STATUS
========================= */

app.get(
  "/api/users/:id/follow-status",
  authenticate,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT 1
        FROM follows
        WHERE follower_id = $1
        AND following_id = $2
        `,
        [
          req.user.id,
          req.params.id,
        ]
      );

      res.json({
        following:
          result.rows.length > 0,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not check follow status",
      });
    }
  }
);

/* =========================
   FOLLOWERS
========================= */

app.get(
  "/api/users/:id/followers",
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          users.id,
          users.username
        FROM follows

        JOIN users
          ON users.id =
             follows.follower_id

        WHERE follows.following_id = $1

        ORDER BY users.username
        `,
        [req.params.id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not load followers",
      });
    }
  }
);

/* =========================
   FOLLOWING
========================= */

app.get(
  "/api/users/:id/following",
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          users.id,
          users.username
        FROM follows

        JOIN users
          ON users.id =
             follows.following_id

        WHERE follows.follower_id = $1

        ORDER BY users.username
        `,
        [req.params.id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not load following",
      });
    }
  }
);

/* =========================
   USER PROFILE
========================= */

app.get(
  "/api/users/:id",
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          users.id,
          users.username,
          users.email,

          COUNT(DISTINCT posts.id)::int
            AS post_count,

          (
            SELECT COUNT(*)
            FROM follows
            WHERE following_id =
                  users.id
          )::int AS follower_count,

          (
            SELECT COUNT(*)
            FROM follows
            WHERE follower_id =
                  users.id
          )::int AS following_count

        FROM users

        LEFT JOIN posts
          ON posts.user_id =
             users.id

        WHERE users.id = $1

        GROUP BY users.id
        `,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message:
            "User not found",
        });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not load profile",
      });
    }
  }
);

/* =========================
   USER POSTS
========================= */

app.get(
  "/api/users/:id/posts",
  async (req, res) => {
    try {
      const currentUserId =
        Number(req.query.userId) || 0;

      const result = await pool.query(
        `
        SELECT
          posts.id,
          posts.content,
          posts.created_at,
          users.id AS user_id,
          users.username,

          COUNT(DISTINCT likes.user_id)::int
            AS likes,

          COUNT(DISTINCT comments.id)::int
            AS comments,

          EXISTS (
            SELECT 1
            FROM likes my_like
            WHERE my_like.post_id =
                  posts.id
            AND my_like.user_id =
                  $2
          ) AS liked

        FROM posts

        JOIN users
          ON users.id =
             posts.user_id

        LEFT JOIN likes
          ON likes.post_id =
             posts.id

        LEFT JOIN comments
          ON comments.post_id =
             posts.id

        WHERE posts.user_id = $1

        GROUP BY
          posts.id,
          users.id,
          users.username

        ORDER BY posts.created_at DESC
        `,
        [
          req.params.id,
          currentUserId,
        ]
      );

      res.json(result.rows);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not load user posts",
      });
    }
  }
);

/* =========================
   LIKE
========================= */

app.post(
  "/api/posts/:id/like",
  authenticate,
  async (req, res) => {
    try {
      await pool.query(
        `
        INSERT INTO likes
        (user_id, post_id)
        VALUES ($1, $2)

        ON CONFLICT DO NOTHING
        `,
        [
          req.user.id,
          req.params.id,
        ]
      );

      res.json({
        message: "Post liked",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not like post",
      });
    }
  }
);

/* =========================
   UNLIKE
========================= */

app.delete(
  "/api/posts/:id/like",
  authenticate,
  async (req, res) => {
    try {
      await pool.query(
        `
        DELETE FROM likes

        WHERE user_id = $1
        AND post_id = $2
        `,
        [
          req.user.id,
          req.params.id,
        ]
      );

      res.json({
        message:
          "Post unliked",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not unlike post",
      });
    }
  }
);

/* =========================
   GET COMMENTS
========================= */

app.get(
  "/api/posts/:id/comments",
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          comments.id,
          comments.content,
          comments.created_at,

          users.id AS user_id,
          users.username

        FROM comments

        JOIN users
          ON users.id =
             comments.user_id

        WHERE comments.post_id = $1

        ORDER BY comments.created_at ASC
        `,
        [req.params.id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not load comments",
      });
    }
  }
);

/* =========================
   CREATE COMMENT
========================= */

app.post(
  "/api/posts/:id/comments",
  authenticate,
  async (req, res) => {
    try {
      const { content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({
          message:
            "Comment cannot be empty",
        });
      }

      if (content.trim().length > 500) {
        return res.status(400).json({
          message:
            "Comment cannot exceed 500 characters",
        });
      }

      const postExists =
        await pool.query(
          `
          SELECT id
          FROM posts
          WHERE id = $1
          `,
          [req.params.id]
        );

      if (postExists.rows.length === 0) {
        return res.status(404).json({
          message:
            "Post not found",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO comments
        (user_id, post_id, content)

        VALUES ($1, $2, $3)

        RETURNING
          id,
          content,
          created_at
        `,
        [
          req.user.id,
          req.params.id,
          content.trim(),
        ]
      );

      res.status(201).json({
        ...result.rows[0],
        username:
          req.user.username,
        user_id:
          req.user.id,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not create comment",
      });
    }
  }
);

/* =========================
   DELETE OWN COMMENT
========================= */

app.delete(
  "/api/comments/:id",
  authenticate,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        DELETE FROM comments

        WHERE id = $1
        AND user_id = $2

        RETURNING id
        `,
        [
          req.params.id,
          req.user.id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message:
            "Comment not found or you cannot delete it",
        });
      }

      res.json({
        message:
          "Comment deleted",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Could not delete comment",
      });
    }
  }
);

/* =========================
   SERVER
========================= */

const PORT =
  process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on http://localhost:${PORT}`
  );
});