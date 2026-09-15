import { useEffect, useState } from "react";
import "./App.css";

const API =
  import.meta.env.VITE_API_URL ||
  "https://YOUR-RENDER-URL.onrender.com";

function App() {
  const [token, setToken] = useState(
    localStorage.getItem("token") || ""
  );

  const [currentUser, setCurrentUser] =
    useState(
      JSON.parse(
        localStorage.getItem("user") ||
          "null"
      )
    );

  const [posts, setPosts] = useState([]);

  const [feedType, setFeedType] =
    useState("global");

  const [content, setContent] =
    useState("");

  const [mode, setMode] =
    useState("login");

  const [username, setUsername] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [users, setUsers] =
    useState([]);

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [comments, setComments] =
    useState({});

  const [commentInputs, setCommentInputs] =
    useState({});

  const [expandedComments, setExpandedComments] =
    useState({});

  const [profiles, setProfiles] =
    useState({});

  const [followingStatus, setFollowingStatus] =
    useState({});

  /* =========================
     LOAD GLOBAL FEED
  ========================= */

  async function loadGlobalFeed() {
    try {
      setLoading(true);

      const userId =
        currentUser?.id || 0;

      const response = await fetch(
        `${API}/api/posts?userId=${userId}`
      );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Could not load posts"
        );
        return;
      }

      setPosts(data);
    } catch (error) {
      console.error(error);

      setMessage(
        "Could not connect to backend"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     LOAD FOLLOWING FEED
  ========================= */

  async function loadFollowingFeed() {
    if (!token) {
      setMessage("Please login first");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API}/api/feed/following`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Could not load feed"
        );
        return;
      }

      setPosts(data);
    } catch (error) {
      console.error(error);

      setMessage(
        "Could not load following feed"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     INITIAL LOAD
  ========================= */

  useEffect(() => {
    loadGlobalFeed();
  }, [token, currentUser?.id]);

  /* =========================
     FEED CHANGE
  ========================= */

  function changeFeed(type) {
    setFeedType(type);

    if (type === "global") {
      loadGlobalFeed();
    } else {
      loadFollowingFeed();
    }
  }

  /* =========================
     LOGIN / REGISTER
  ========================= */

  async function handleAuth(e) {
    e.preventDefault();

    setMessage("");

    const endpoint =
      mode === "login"
        ? `${API}/api/auth/login`
        : `${API}/api/auth/register`;

    const body =
      mode === "login"
        ? {
            email,
            password,
          }
        : {
            username,
            email,
            password,
          };

    try {
      const response =
        await fetch(endpoint, {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(body),
        });

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Authentication failed"
        );
        return;
      }

      localStorage.setItem(
        "token",
        data.token
      );

      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      setToken(data.token);

      setCurrentUser(data.user);

      setUsername("");
      setEmail("");
      setPassword("");

      setMessage(
        mode === "login"
          ? "Login successful!"
          : "Account created successfully!"
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "Could not connect to backend"
      );
    }
  }

  /* =========================
     LOGOUT
  ========================= */

  function logout() {
    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "user"
    );

    setToken("");

    setCurrentUser(null);

    setPosts([]);

    setFeedType("global");

    setMessage(
      "Logged out successfully"
    );
  }

  /* =========================
     CREATE POST
  ========================= */

  async function createPost(e) {
    e.preventDefault();

    if (!token) {
      setMessage("Please login first");
      return;
    }

    if (!content.trim()) {
      setMessage(
        "Post cannot be empty"
      );
      return;
    }

    try {
      const response =
        await fetch(
          `${API}/api/posts`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              content,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Could not create post"
        );
        return;
      }

      setContent("");

      setMessage(
        "Post created successfully!"
      );

      if (feedType === "global") {
        loadGlobalFeed();
      } else {
        loadFollowingFeed();
      }
    } catch (error) {
      console.error(error);

      setMessage(
        "Could not create post"
      );
    }
  }

  /* =========================
     DELETE POST
  ========================= */

  async function deletePost(id) {
    if (
      !window.confirm(
        "Delete this post?"
      )
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `${API}/api/posts/${id}`,
          {
            method: "DELETE",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Could not delete post"
        );
        return;
      }

      setMessage(
        "Post deleted"
      );

      if (feedType === "global") {
        loadGlobalFeed();
      } else {
        loadFollowingFeed();
      }
    } catch (error) {
      console.error(error);
    }
  }

  /* =========================
     SEARCH USERS
  ========================= */

  async function searchUsers(value) {
    setSearch(value);

    if (!value.trim()) {
      setUsers([]);
      return;
    }

    try {
      const response =
        await fetch(
          `${API}/api/users/search?q=${encodeURIComponent(
            value
          )}`
        );

      const data =
        await response.json();

      setUsers(data);

      data.forEach((user) => {
        if (
          currentUser &&
          user.id !== currentUser.id
        ) {
          checkFollowStatus(
            user.id
          );
        }
      });
    } catch (error) {
      console.error(error);
    }
  }

  /* =========================
     CHECK FOLLOW STATUS
  ========================= */

  async function checkFollowStatus(id) {
    if (!token) return;

    try {
      const response =
        await fetch(
          `${API}/api/users/${id}/follow-status`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      setFollowingStatus(
        (previous) => ({
          ...previous,
          [id]: data.following,
        })
      );
    } catch (error) {
      console.error(error);
    }
  }

  /* =========================
     FOLLOW
  ========================= */

  async function followUser(id) {
    if (!token) {
      setMessage("Please login first");
      return;
    }

    try {
      const response =
        await fetch(
          `${API}/api/users/${id}/follow`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Could not follow user"
        );
        return;
      }

      setFollowingStatus(
        (previous) => ({
          ...previous,
          [id]: true,
        })
      );

      setMessage(
        "Following user!"
      );
    } catch (error) {
      console.error(error);
    }
  }

  /* =========================
     UNFOLLOW
  ========================= */

  async function unfollowUser(id) {
    if (!token) return;

    try {
      const response =
        await fetch(
          `${API}/api/users/${id}/follow`,
          {
            method: "DELETE",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Could not unfollow user"
        );
        return;
      }

      setFollowingStatus(
        (previous) => ({
          ...previous,
          [id]: false,
        })
      );

      setMessage(
        "Unfollowed user"
      );
    } catch (error) {
      console.error(error);
    }
  }

  /* =========================
     LIKE / UNLIKE
  ========================= */

  async function toggleLike(post) {
    if (!token) {
      setMessage("Please login first");
      return;
    }

    try {
      const method =
        post.liked
          ? "DELETE"
          : "POST";

      const response =
        await fetch(
          `${API}/api/posts/${post.id}/like`,
          {
            method,

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      if (!response.ok) {
        const data =
          await response.json();

        setMessage(
          data.message ||
            "Could not update like"
        );

        return;
      }

      setPosts(
        (previousPosts) =>
          previousPosts.map(
            (item) =>
              item.id === post.id
                ? {
                    ...item,
                    liked:
                      !item.liked,
                    likes:
                      item.liked
                        ? item.likes - 1
                        : item.likes + 1,
                  }
                : item
          )
      );
    } catch (error) {
      console.error(error);
    }
  }

  /* =========================
     LOAD COMMENTS
  ========================= */

  async function loadComments(
    postId
  ) {
    try {
      const response =
        await fetch(
          `${API}/api/posts/${postId}/comments`
        );

      const data =
        await response.json();

      if (!response.ok) {
        return;
      }

      setComments(
        (previous) => ({
          ...previous,
          [postId]: data,
        })
      );
    } catch (error) {
      console.error(error);
    }
  }

  /* =========================
     TOGGLE COMMENTS
  ========================= */

  function toggleComments(postId) {
    const isOpen =
      expandedComments[postId];

    setExpandedComments(
      (previous) => ({
        ...previous,
        [postId]: !isOpen,
      })
    );

    if (!isOpen) {
      loadComments(postId);
    }
  }

  /* =========================
     COMMENT INPUT
  ========================= */

  function changeComment(
    postId,
    value
  ) {
    setCommentInputs(
      (previous) => ({
        ...previous,
        [postId]: value,
      })
    );
  }

  /* =========================
     ADD COMMENT
  ========================= */

  async function addComment(
    postId
  ) {
    if (!token) {
      setMessage("Please login first");
      return;
    }

    const comment =
      commentInputs[postId] || "";

    if (!comment.trim()) {
      return;
    }

    try {
      const response =
        await fetch(
          `${API}/api/posts/${postId}/comments`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              content: comment,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Could not add comment"
        );
        return;
      }

      setCommentInputs(
        (previous) => ({
          ...previous,
          [postId]: "",
        })
      );

      setComments(
        (previous) => ({
          ...previous,
          [postId]: [
            ...(previous[postId] || []),
            data,
          ],
        })
      );

      setPosts(
        (previousPosts) =>
          previousPosts.map(
            (post) =>
              post.id === postId
                ? {
                    ...post,
                    comments:
                      post.comments + 1,
                  }
                : post
          )
      );
    } catch (error) {
      console.error(error);
    }
  }

  /* =========================
     DELETE COMMENT
  ========================= */

  async function deleteComment(
    commentId,
    postId
  ) {
    try {
      const response =
        await fetch(
          `${API}/api/comments/${commentId}`,
          {
            method: "DELETE",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Could not delete comment"
        );
        return;
      }

      setComments(
        (previous) => ({
          ...previous,
          [postId]: (
            previous[postId] || []
          ).filter(
            (comment) =>
              comment.id !==
              commentId
          ),
        })
      );

      setPosts(
        (previousPosts) =>
          previousPosts.map(
            (post) =>
              post.id === postId
                ? {
                    ...post,
                    comments:
                      Math.max(
                        0,
                        post.comments - 1
                      ),
                  }
                : post
          )
      );
    } catch (error) {
      console.error(error);
    }
  }

  /* =========================
     LOAD PROFILE
  ========================= */

  async function loadProfile(
    userId
  ) {
    try {
      const response =
        await fetch(
          `${API}/api/users/${userId}`
        );

      const data =
        await response.json();

      if (!response.ok) {
        return;
      }

      setProfiles(
        (previous) => ({
          ...previous,
          [userId]: data,
        })
      );
    } catch (error) {
      console.error(error);
    }
  }

  /* =========================
     RENDER
  ========================= */

  return (
    <div className="app">

      {/* HEADER */}

      <header className="header">

        <div>
          <h1>
            📰 News Feed
          </h1>

          <p className="subtitle">
            Connect. Share. Discover.
          </p>
        </div>

        {token ? (
          <div className="user-area">

            <span className="current-user">
              👤 @{currentUser?.username}
            </span>

            <button
              className="logout-button"
              onClick={logout}
            >
              🚪 Logout
            </button>

          </div>
        ) : (
          <span className="logged-out">
            Not logged in
          </span>
        )}

      </header>

      {/* MESSAGE */}

      {message && (
        <div className="message">
          {message}

          <button
            className="close-message"
            onClick={() =>
              setMessage("")
            }
          >
            ×
          </button>
        </div>
      )}

      {/* AUTH */}

      {!token && (
        <section className="card auth-card">

          <div className="auth-tabs">

            <button
              className={
                mode === "login"
                  ? "auth-tab active"
                  : "auth-tab"
              }
              onClick={() =>
                setMode("login")
              }
            >
              Login
            </button>

            <button
              className={
                mode === "register"
                  ? "auth-tab active"
                  : "auth-tab"
              }
              onClick={() =>
                setMode("register")
              }
            >
              Register
            </button>

          </div>

          <h2>
            {mode === "login"
              ? "Welcome back 👋"
              : "Join the community 🚀"}
          </h2>

          <form
            onSubmit={handleAuth}
          >

            {mode === "register" && (
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value
                  )
                }
                required
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              required
            />

            <button
              className="primary-button"
              type="submit"
            >
              {mode === "login"
                ? "🔐 Login"
                : "✨ Create Account"}
            </button>

          </form>

        </section>
      )}

      {/* SEARCH */}

      {token && (
        <section className="card">

          <h2>
            🔎 Find People
          </h2>

          <input
            type="text"
            placeholder="Search username..."
            value={search}
            onChange={(e) =>
              searchUsers(
                e.target.value
              )
            }
          />

          {users.length > 0 && (
            <div className="search-results">

              {users.map((user) => (
                <div
                  className="user-result"
                  key={user.id}
                >

                  <div
                    className="user-info"
                    onClick={() =>
                      loadProfile(
                        user.id
                      )
                    }
                  >
                    <div className="avatar">
                      {user.username
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <strong>
                      @{user.username}
                    </strong>
                  </div>

                  {currentUser &&
                  user.id ===
                    currentUser.id ? (
                    <span className="you">
                      You
                    </span>
                  ) : followingStatus[
                      user.id
                    ] ? (
                    <button
                      className="secondary"
                      onClick={() =>
                        unfollowUser(
                          user.id
                        )
                      }
                    >
                      ✓ Following
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        followUser(
                          user.id
                        )
                      }
                    >
                      + Follow
                    </button>
                  )}

                  {profiles[user.id] && (
                    <div className="mini-profile">

                      <span>
                        Posts:{" "}
                        {
                          profiles[
                            user.id
                          ].post_count
                        }
                      </span>

                      <span>
                        Followers:{" "}
                        {
                          profiles[
                            user.id
                          ].follower_count
                        }
                      </span>

                      <span>
                        Following:{" "}
                        {
                          profiles[
                            user.id
                          ].following_count
                        }
                      </span>

                    </div>
                  )}

                </div>
              ))}

            </div>
          )}

        </section>
      )}

      {/* CREATE POST */}

      {token && (
        <section className="card">

          <h2>
            ✍️ Create Post
          </h2>

          <form
            onSubmit={createPost}
          >

            <textarea
              placeholder="What's happening?"
              value={content}
              maxLength={1000}
              onChange={(e) =>
                setContent(
                  e.target.value
                )
              }
            />

            <div className="composer-footer">

              <span>
                {content.length}/1000
              </span>

              <button
                className="primary-button"
                type="submit"
              >
                🚀 Post
              </button>

            </div>

          </form>

        </section>
      )}

      {/* FEED TABS */}

      <div className="feed-tabs">

        <button
          className={
            feedType === "global"
              ? "active"
              : ""
          }
          onClick={() =>
            changeFeed("global")
          }
        >
          🌎 Global Feed
        </button>

        <button
          className={
            feedType === "following"
              ? "active"
              : ""
          }
          onClick={() =>
            changeFeed(
              "following"
            )
          }
        >
          👥 Following
        </button>

      </div>

      {/* FEED */}

      <main>

        <h2 className="feed-title">
          {feedType === "global"
            ? "Latest Posts"
            : "Posts From People You Follow"}
        </h2>

        {loading && (
          <div className="loading">
            ⏳ Loading...
          </div>
        )}

        {!loading &&
          posts.length === 0 && (
            <div className="card empty">
              {feedType ===
              "following"
                ? "You are not following anyone yet, or they have not posted."
                : "No posts yet. Be the first to post!"}
            </div>
          )}

        {posts.map((post) => (
          <article
            className="post"
            key={post.id}
          >

            {/* POST HEADER */}

            <div className="post-header">

              <div className="post-user">

                <div className="avatar">
                  {post.username
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>

                  <strong>
                    @{post.username}
                  </strong>

                  <div className="date">
                    {new Date(
                      post.created_at
                    ).toLocaleString()}
                  </div>

                </div>

              </div>

              {currentUser &&
                currentUser.id ===
                  post.user_id && (
                  <button
                    className="delete-button"
                    onClick={() =>
                      deletePost(
                        post.id
                      )
                    }
                  >
                    🗑️
                  </button>
                )}

            </div>

            {/* CONTENT */}

            <p className="post-content">
              {post.content}
            </p>

            {/* ACTIONS */}

            <div className="post-actions">

              <button
                className={
                  post.liked
                    ? "action-button liked"
                    : "action-button"
                }
                onClick={() =>
                  toggleLike(post)
                }
              >
                {post.liked
                  ? "❤️"
                  : "🤍"}{" "}
                {post.likes}
              </button>

              <button
                className="action-button"
                onClick={() =>
                  toggleComments(
                    post.id
                  )
                }
              >
                💬 {post.comments}
              </button>

            </div>

            {/* COMMENTS */}

            {expandedComments[
              post.id
            ] && (
              <div className="comments">

                <div className="comment-form">

                  <input
                    type="text"
                    placeholder="Write a comment..."
                    value={
                      commentInputs[
                        post.id
                      ] || ""
                    }
                    maxLength={500}
                    onChange={(e) =>
                      changeComment(
                        post.id,
                        e.target.value
                      )
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key ===
                        "Enter"
                      ) {
                        addComment(
                          post.id
                        );
                      }
                    }}
                  />

                  <button
                    onClick={() =>
                      addComment(
                        post.id
                      )
                    }
                  >
                    Send
                  </button>

                </div>

                <div className="comment-list">

                  {(comments[
                    post.id
                  ] || []).map(
                    (comment) => (
                      <div
                        className="comment"
                        key={
                          comment.id
                        }
                      >

                        <div>

                          <strong>
                            @
                            {
                              comment.username
                            }
                          </strong>

                          <p>
                            {
                              comment.content
                            }
                          </p>

                          <small>
                            {new Date(
                              comment.created_at
                            ).toLocaleString()}
                          </small>

                        </div>

                        {currentUser &&
                          currentUser.id ===
                            comment.user_id && (
                            <button
                              className="comment-delete"
                              onClick={() =>
                                deleteComment(
                                  comment.id,
                                  post.id
                                )
                              }
                            >
                              🗑️
                            </button>
                          )}

                      </div>
                    )
                  )}

                  {comments[
                    post.id
                  ]?.length === 0 && (
                    <p className="no-comments">
                      No comments yet.
                      Be the first!
                    </p>
                  )}

                </div>

              </div>
            )}

          </article>
        ))}

      </main>

    </div>
  );
}

export default App;
