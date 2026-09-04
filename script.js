// ============================================================
// Hoxiee — answer math questions, earn ₱0.025 per correct answer,
// up to 20,000 questions per day. Users log in / sign up with
// Supabase Auth; profiles and points live in Supabase.
// ============================================================

const DAILY_LIMIT = 20000;
const RATE_PER_QUESTION = 0.025; // ₱ per correct answer
const MIN_WITHDRAWAL = 100;     // ₱ minimum balance needed to withdraw
const REFERRAL_RATE_BONUS = 0.01; // ₱ added per question per referred friend
const REFERRAL_PESO = 20;         // ₱ instantly earned per referral
const COMMENT_RATE_BONUS = 0.005; // ₱ added per question per approved comment

const CONFIG_OK =
  SUPABASE_CONFIG.url.startsWith("http") && SUPABASE_CONFIG.anonKey.length > 20;

let supabaseClient = null;
if (CONFIG_OK) {
  supabaseClient = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey
  );
}

// ------------------------------------------------------------
// Question bank lives server-side now (get_question RPC). The client
// never sees an answer — it only renders the text returned by the
// server and submits the user's value for verification.
// ------------------------------------------------------------

// ------------------------------------------------------------
// App state
// ------------------------------------------------------------
let currentUser = null;      // { id, email }
let profile = null;          // profile row from Supabase
let state = null;            // today's server tally { answered, correct }
let currentQuestion = null;  // { id, question } issued by get_question RPC
let busy = false;
let withdrawals = [];        // withdrawal history from Supabase
let withdrawBusy = false;
let commentLinks = [];       // comment link submissions from Supabase
let bountyBusy = false;
let loginRewards = null;     // daily login reward state from get_login_rewards
let helpTranscript = [];     // help chat history sent to the assistant
let midnightTimer = null;    // real-time daily reset at 12:00 AM PHT

// ------------------------------------------------------------
// DOM refs
// ------------------------------------------------------------
const authView = document.getElementById("authView");
const quizView = document.getElementById("quizView");
const tabLoginBtn = document.getElementById("tabLoginBtn");
const tabSignupBtn = document.getElementById("tabSignupBtn");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const signupEmail = document.getElementById("signupEmail");
const signupPassword = document.getElementById("signupPassword");
const signupConfirm = document.getElementById("signupConfirm");
const googleBtn = document.getElementById("googleBtn");
const authMsg = document.getElementById("authMsg");
const userEmailEl = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");
const questionEl = document.getElementById("question");
const answerInput = document.getElementById("answerInput");
const answerForm = document.getElementById("answerForm");
const submitBtn = document.getElementById("submitBtn");
const feedbackEl = document.getElementById("feedback");
const totalPointsEl = document.getElementById("totalPoints");
const currentPointsEl = document.getElementById("currentPoints");
const pointsTodayEl = document.getElementById("pointsToday");
const rateStat = document.getElementById("rateStat");
const countEl = document.getElementById("questionCount");
const progressFill = document.getElementById("progressFill");
const progressNote = document.getElementById("progressNote");
const profileBtn = document.getElementById("profileBtn");
const profileView = document.getElementById("profileView");
const profileBackBtn = document.getElementById("profileBackBtn");
const profileForm = document.getElementById("profileForm");
const profileNameInput = document.getElementById("profileNameInput");
const profileBirthdayInput = document.getElementById("profileBirthdayInput");
const profileNameDisplay = document.getElementById("profileNameDisplay");
const profileEmailDisplay = document.getElementById("profileEmailDisplay");
const statusBadge = document.getElementById("statusBadge");
const profileJoined = document.getElementById("profileJoined");
const profilePointsEl = document.getElementById("profilePointsEl");
const profileCurrentEl = document.getElementById("profileCurrentEl");
const profileMsg = document.getElementById("profileMsg");
const profileRank = document.getElementById("profileRank");
const profileReferredBy = document.getElementById("profileReferredBy");
const profileWithdrawal = document.getElementById("profileWithdrawal");
const profileRedeemBtn = document.getElementById("profileRedeemBtn");
const profileWithdrawSetupBtn = document.getElementById("profileWithdrawSetupBtn");
const withdrawBtn = document.getElementById("withdrawBtn");
const withdrawView = document.getElementById("withdrawView");
const withdrawBackBtn = document.getElementById("withdrawBackBtn");
const withdrawForm = document.getElementById("withdrawForm");
const withdrawMethod = document.getElementById("withdrawMethod");
const withdrawNumber = document.getElementById("withdrawNumber");
const withdrawMsg = document.getElementById("withdrawMsg");
const withdrawBalance = document.getElementById("withdrawBalance");
const withdrawSetup = document.getElementById("withdrawSetup");
const withdrawLocked = document.getElementById("withdrawLocked");
const lockedMethod = document.getElementById("lockedMethod");
const lockedNumber = document.getElementById("lockedNumber");
const requestWithdrawBtn = document.getElementById("requestWithdrawBtn");
const withdrawMinNote = document.getElementById("withdrawMinNote");
const withdrawHistory = document.getElementById("withdrawHistory");
const leaderboardBtn = document.getElementById("leaderboardBtn");
const leaderboardView = document.getElementById("leaderboardView");
const leaderboardBackBtn = document.getElementById("leaderboardBackBtn");
const leaderboardList = document.getElementById("leaderboardList");
const leaderboardSummary = document.getElementById("leaderboardSummary");
const bountyBtn = document.getElementById("bountyBtn");
const bountyView = document.getElementById("bountyView");
const subscribeView = document.getElementById("subscribeView");
const bountyBackBtn = document.getElementById("bountyBackBtn");
const bountyBaseRate = document.getElementById("bountyBaseRate");
const bountyRate = document.getElementById("bountyRate");
const bountyCode = document.getElementById("bountyCode");
const bountyCopyBtn = document.getElementById("bountyCopyBtn");
const bountyReferralCount = document.getElementById("bountyReferralCount");
const bountyRedeemBox = document.getElementById("bountyRedeemBox");
const bountyRedeemForm = document.getElementById("bountyRedeemForm");
const bountyRedeemInput = document.getElementById("bountyRedeemInput");
const bountyRedeemBtn = document.getElementById("bountyRedeemBtn");
const bountyRedeemedNote = document.getElementById("bountyRedeemedNote");
const bountyCommentForm = document.getElementById("bountyCommentForm");
const bountyCommentLink = document.getElementById("bountyCommentLink");
const bountyCommentBtn = document.getElementById("bountyCommentBtn");
const bountyCommentHistory = document.getElementById("bountyCommentHistory");
const bountyMsg = document.getElementById("bountyMsg");
const bountyDot = document.getElementById("bountyDot");
const rewardClaimBtn = document.getElementById("rewardClaimBtn");
const rewardTrack = document.getElementById("rewardTrack");
const rewardStatus = document.getElementById("rewardStatus");
const helpBtn = document.getElementById("helpBtn");
const helpView = document.getElementById("helpView");
const helpBackBtn = document.getElementById("helpBackBtn");
const helpMessages = document.getElementById("helpMessages");
const helpForm = document.getElementById("helpForm");
const helpInput = document.getElementById("helpInput");
const helpSendBtn = document.getElementById("helpSendBtn");
const notificationsBtn = document.getElementById("notificationsBtn");
const noticeDot = document.getElementById("noticeDot");
const noticeModal = document.getElementById("noticeModal");
const noticeCloseBtn = document.getElementById("noticeCloseBtn");
const noticeDismissBtn = document.getElementById("noticeDismissBtn");
const noticeTimeline = document.getElementById("noticeTimeline");
const redeemModal = document.getElementById("redeemModal");
const redeemModalClose = document.getElementById("redeemModalClose");
const footnoteEl = document.getElementById("footnote");

// ------------------------------------------------------------
// View switching
// ------------------------------------------------------------
function fadeIn(el) {
  el.classList.remove("fade-in");
  void el.offsetWidth; // restart the CSS animation
  el.classList.add("fade-in");
}

function hideViews() {
  authView.hidden = true;
  quizView.hidden = true;
  profileView.hidden = true;
  withdrawView.hidden = true;
  leaderboardView.hidden = true;
  bountyView.hidden = true;
  subscribeView.hidden = true;
  helpView.hidden = true;
}

// Account must be 'active' to use the app. Inactive accounts (new
// signups) are redirected to the subscribe view until an admin flips
// account_status to 'active' in the dashboard.
function isActive() {
  return !!(profile && profile.account_status === "active");
}

function showAuth() {
  hideViews();
  authView.hidden = false;
  fadeIn(authView);
}

function showQuiz() {
  hideViews();
  quizView.hidden = false;
  fadeIn(quizView);
}

function showProfile() {
  hideViews();
  profileView.hidden = false;
  fadeIn(profileView);
}

function showWithdraw() {
  hideViews();
  withdrawView.hidden = false;
  fadeIn(withdrawView);
}

function showLeaderboard() {
  hideViews();
  leaderboardView.hidden = false;
  fadeIn(leaderboardView);
}

function showBounty() {
  hideViews();
  bountyView.hidden = false;
  fadeIn(bountyView);
}

function showSubscribe() {
  hideViews();
  subscribeView.hidden = false;
  fadeIn(subscribeView);
}

function showHelp() {
  hideViews();
  helpView.hidden = false;
  fadeIn(helpView);
  helpInput.focus();
}

function setAuthMsg(message, kind) {
  authMsg.textContent = message;
  authMsg.className = "auth-msg" + (kind ? " " + kind : "");
}

function switchTab(which) {
  const login = which === "login";
  tabLoginBtn.classList.toggle("active", login);
  tabSignupBtn.classList.toggle("active", !login);
  loginForm.hidden = !login;
  signupForm.hidden = login;
  setAuthMsg("", "");
  fadeIn(login ? loginForm : signupForm);
  (login ? loginEmail : signupEmail).focus();
}

tabLoginBtn.addEventListener("click", () => switchTab("login"));
tabSignupBtn.addEventListener("click", () => switchTab("signup"));

function friendlyAuthError(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("email logins are disabled"))
    return "Email login is disabled in your Supabase project. Enable it: Authentication → Providers → Email.";
  if (m.includes("email signups are disabled"))
    return "Email signup is disabled in your Supabase project. Enable it: Authentication → Providers → Email.";
  if (m.includes("invalid login credentials")) return "Wrong email or password.";
  if (m.includes("already registered")) return "That email is already registered. Try logging in.";
  if (m.includes("email not confirmed")) return "Please confirm your email first (check your inbox).";
  if (m.includes("rate limit")) return "Too many attempts. Wait a moment and try again.";
  return message;
}

// ------------------------------------------------------------
// Daily state (per user, persisted in localStorage, resets at
// 12:00 AM Philippine time — Asia/Manila, UTC+8, no DST)
// ------------------------------------------------------------
function manilaDateParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

function todayKey() {
  const { year, month, day } = manilaDateParts();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Milliseconds until the next 12:00 AM in Manila, so the daily tally
// can roll over in real time even if the page stays open overnight.
function msUntilManilaMidnight() {
  const { year, month, day } = manilaDateParts();
  const nextMidnightUtc =
    Date.UTC(year, month - 1, day + 1) - 8 * 3600 * 1000; // Manila = UTC+8
  return nextMidnightUtc - Date.now();
}

// If the page was left open across midnight (or the tab was throttled),
// roll the tally over to the new day and re-enable the quiz.
function ensureFreshDay() {
  if (!state || state.date === todayKey()) return;
  state = loadState();
  saveState();
  busy = false;
  answerInput.disabled = false;
  submitBtn.disabled = false;
}

// Real-time daily reset: fire exactly at 12:00 AM PHT, then re-arm.
function scheduleMidnightRefresh() {
  if (midnightTimer) clearTimeout(midnightTimer);
  midnightTimer = setTimeout(() => {
    const rolledOver = state && state.date !== todayKey();
    ensureFreshDay();
    render();
    if (rolledOver) {
      syncDailyTally();
      nextQuestion();
      feedbackEl.className = "feedback";
      showFeedback(`🌅 New day! Your ${DAILY_LIMIT.toLocaleString()}-question limit has reset.`, "");
    }
    // Refresh today's login-reward state so the Bounty red dot (and an
    // open reward card) flip over exactly at midnight, not on next load.
    loadLoginRewards().then(() => {
      updateBountyDot();
      if (!bountyView.hidden) renderLoginRewards();
    });
    updateNoticeDot();
    scheduleMidnightRefresh();
  }, msUntilManilaMidnight());
}

function storageKey() {
  return `mathpoints_daily_${currentUser.id}`;
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey()));
    if (raw && raw.date === todayKey()) {
      return { date: raw.date, answered: raw.answered || 0, correct: raw.correct || 0 };
    }
  } catch (e) {
    /* corrupted storage — start fresh */
  }
  return { date: todayKey(), answered: 0, correct: 0 };
}

function saveState() {
  if (state) localStorage.setItem(storageKey(), JSON.stringify(state));
}

function pointsToday() {
  return state ? state.correct * effectiveRate() : 0;
}

function formatPeso(amount) {
  return "₱" + Number(amount || 0).toFixed(3);
}

// Rates carry 3 decimals (₱0.025, ₱0.035, …)
function formatRate(rate) {
  return "₱" + Number(rate || 0).toFixed(3);
}

// The user's effective rate = base rate + permanent bounty bonus.
function effectiveRate() {
  return RATE_PER_QUESTION + Number(profile && profile.rate_bonus ? profile.rate_bonus : 0);
}

// ------------------------------------------------------------
// Auth
// ------------------------------------------------------------
async function enterQuiz(user) {
  if (currentUser && currentUser.id === user.id && !quizView.hidden) return;

  currentUser = user;
  userEmailEl.textContent = user.email || "";
  state = loadState();
  showQuiz();
  scheduleMidnightRefresh();

  await loadProfile();
  if (!isActive()) {
    // New signups start inactive — send them to the subscribe view.
    showSubscribe();
    return;
  }
  await loadLoginRewards(); // drives the red dot on the Bounty icon
  updateBountyDot();
  updateNoticeDot(); // red dot on the bell while notices are unread
  render();
  await syncDailyTally(); // server-authoritative daily count
  nextQuestion();
  answerInput.focus();
}

// Pull today's server-side tally so the progress bar reflects reality
// (e.g. answered on another device) on load. daily_answers is locked
// down (RLS + revoked), so this goes through the get_today_tally RPC.
async function syncDailyTally() {
  if (!supabaseClient || !currentUser) return;
  const { data, error } = await supabaseClient.rpc("get_today_tally");
  if (error) {
    console.warn("Today's tally fetch failed:", error.message);
    return;
  }
  state.answered = Number((data && data.answered) || 0);
  state.correct = Number((data && data.correct) || 0);
  saveState();
  render();
}

function leaveQuiz() {
  currentUser = null;
  profile = null;
  state = null;
  loginRewards = null;
  bountyDot.hidden = true;
  noticeDot.hidden = true;
  noticeModal.hidden = true;
  document.body.style.overflow = "";
  helpTranscript = [];
  helpMessages.textContent = "";
  busy = false;
  withdrawals = [];
  withdrawBusy = false;
  if (midnightTimer) {
    clearTimeout(midnightTimer);
    midnightTimer = null;
  }
  answerInput.disabled = false;
  submitBtn.disabled = false;
  showAuth();
}

async function loadProfile() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, email, current_points, total_points, name, account_status, birthday, created_at, withdrawal_method, gcash_number, referral_code, rate_bonus, referred_by, referral_count")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.warn("Profile fetch failed:", error.message);
    profile = {
      id: currentUser.id,
      email: currentUser.email,
      current_points: 0,
      total_points: 0,
      name: null,
      account_status: "inactive",
      birthday: null,
      created_at: null,
      withdrawal_method: "gcash",
      gcash_number: null,
      referral_code: null,
      rate_bonus: 0,
      referred_by: null,
      referral_count: 0,
    };
    return;
  }

  if (data) {
    profile = data;
    return;
  }

  // No profile row yet (trigger not installed?) — create one.
  // current_points / total_points fall back to their column defaults (0).
  const { error: insErr } = await supabaseClient
    .from("profiles")
    .upsert(
      { id: currentUser.id, email: currentUser.email },
      { onConflict: "id", ignoreDuplicates: true }
    );
  if (insErr) console.warn("Profile create failed:", insErr.message);
  profile = {
    id: currentUser.id,
    email: currentUser.email,
    current_points: 0,
    total_points: 0,
    name: null,
    account_status: "inactive",
    birthday: null,
    created_at: null,
    withdrawal_method: "gcash",
    gcash_number: null,
    referral_code: null,
    rate_bonus: 0,
    referred_by: null,
    referral_count: 0,
  };
}

function initAuth() {
  supabaseClient.auth
    .getSession()
    .then(({ data }) => {
      if (data.session) enterQuiz(data.session.user);
      else showAuth();
    })
    .catch((e) => {
      console.warn("getSession failed:", e);
      showAuth();
    });

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      leaveQuiz();
    } else if (session) {
      enterQuiz(session.user);
    }
  });
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) {
    setAuthMsg("Please fill in both fields.", "error");
    return;
  }

  setAuthMsg("Logging in…", "");
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    setAuthMsg(friendlyAuthError(error.message), "error");
    return;
  }
  // Success: onAuthStateChange switches to the quiz view.
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = signupEmail.value.trim();
  const password = signupPassword.value;
  const confirm = signupConfirm.value;

  if (!email || !password || !confirm) {
    setAuthMsg("Please fill in all fields.", "error");
    return;
  }
  if (password.length < 6) {
    setAuthMsg("Password must be at least 6 characters.", "error");
    return;
  }
  if (password !== confirm) {
    setAuthMsg("Passwords do not match.", "error");
    return;
  }

  setAuthMsg("Creating account…", "");
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    setAuthMsg(friendlyAuthError(error.message), "error");
    return;
  }

  if (!data.session) {
    // Email confirmation is enabled — the user must confirm first.
    setAuthMsg(
      "Account created! Check your email to confirm, then log in.",
      "success"
    );
    loginEmail.value = email;
    switchTab("login");
  }
  // If a session was returned (email confirmation off), onAuthStateChange
  // switches to the quiz view automatically.
});

googleBtn.addEventListener("click", async () => {
  const isHttp =
    window.location.protocol === "http:" || window.location.protocol === "https:";

  if (!isHttp) {
    // OAuth cannot redirect back to a file:// page — the app must be
    // served over http(s) for Google sign-in to work.
    setAuthMsg(
      "Google sign-in needs the app served over http(s). Run a local server (e.g. `npx serve`) and whitelist its URL in Supabase → Auth → URL Configuration → Redirect URLs.",
      "error"
    );
    return;
  }

  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) {
    setAuthMsg(friendlyAuthError(error.message), "error");
  }
});

// Both views carry a logout button (quiz + profile).
document.querySelectorAll(".logout-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    supabaseClient.auth.signOut();
  });
});

// ------------------------------------------------------------
// Profile: view + edit (name, birthday) saved to Supabase
// ------------------------------------------------------------
function statusLabel(status) {
  return String(status || "active")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function setProfileMsg(message, kind) {
  profileMsg.textContent = message;
  profileMsg.className = "auth-msg" + (kind ? " " + kind : "");
}

async function openProfile() {
  if (!isActive()) { showSubscribe(); return; }
  await loadProfile(); // refresh points + profile fields from Supabase
  showProfile();
  renderProfile();
  refreshProfileExtras(); // rank, referrer, withdrawal method (async)
}

// Fill the Ranked / Referred by / Withdrawal rows. Rank comes from the
// same get_leaderboard RPC the board uses; the referrer's display name
// is resolved server-side (profiles are RLS-locked).
async function refreshProfileExtras() {
  profileRank.textContent = "…";

  // Ranked #N (real position among active players).
  if (supabaseClient && currentUser) {
    const { data: lb } = await supabaseClient.rpc("get_leaderboard");
    const rank = Number((lb && lb.me && lb.me.rank) || 0);
    profileRank.textContent = rank > 0 ? `#${rank.toLocaleString()}` : "Unranked";
  }

  // Referred by — show the referrer's name, or a CTA to redeem a code.
  if (profile && profile.referred_by) {
    profileRedeemBtn.hidden = true;
    let referrer = "—";
    if (supabaseClient && currentUser) {
      const { data: name } = await supabaseClient.rpc("get_referrer_name");
      referrer = name || "—";
    }
    profileReferredBy.textContent = referrer;
  } else {
    profileReferredBy.textContent = "None yet";
    profileRedeemBtn.hidden = false;
  }

  // Withdrawal method — once a GCash number is saved it's locked.
  const hasNumber = !!(profile && profile.gcash_number);
  if (hasNumber) {
    profileWithdrawSetupBtn.hidden = true;
    profileWithdrawal.textContent = `GCash · ${profile.gcash_number}`;
  } else {
    profileWithdrawSetupBtn.hidden = false;
    profileWithdrawal.textContent = "Not set yet";
  }
}

profileRedeemBtn.addEventListener("click", () => {
  if (isActive()) openBounty();
});
profileWithdrawSetupBtn.addEventListener("click", () => {
  if (isActive()) openWithdraw();
});

// ------------------------------------------------------------
// Mobile keyboard tracking: browsers that overlay the on-screen
// keyboard instead of resizing the layout (iOS Safari, older
// Android) hide the Help composer behind the keys. The visual
// viewport shrinks by exactly the keyboard height, so we expose
// that as --kb-inset for the CSS to lift the composer above it.
// (Modern Chrome resizes the layout itself via the
// interactive-widget=resizes-content viewport meta, leaving the
// inset at 0.)
(function trackKeyboardInset() {
  const root = document.documentElement;
  const mq = window.matchMedia("(max-width: 640px)");
  const isEditable = (el) =>
    el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.isContentEditable);
  // Only measure while the keyboard can actually be open (an editable
  // field is focused). Browser chrome (URL bars) also shrinks the
  // visual viewport, but that shouldn't move the composer.
  let focused = false;
  const update = () => {
    let inset = 0;
    const vv = window.visualViewport;
    if (mq.matches && focused && vv) {
      inset = Math.max(0, Math.round(window.innerHeight - vv.height));
    }
    root.style.setProperty("--kb-inset", inset + "px");
  };
  document.addEventListener("focusin", (e) => {
    focused = isEditable(e.target);
    update();
  });
  document.addEventListener("focusout", () => {
    focused = false;
    update();
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", update);
    window.visualViewport.addEventListener("scroll", update);
  }
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", () => setTimeout(update, 250));
  update();
})();

// ------------------------------------------------------------
// Help: chat with the Gemini AI assistant via the help-ai Edge
// Function (the API key stays server-side in function secrets).
// ------------------------------------------------------------
function openHelp() {
  if (!isActive()) { showSubscribe(); return; }
  showHelp();
  if (helpMessages.children.length === 0) {
    helpTranscript = [];
    addHelpBubble(
      "Hi! I'm the Hoxiee assistant. Ask me about earning, your balance, withdrawals, referrals — or anything else.",
      "bot"
    );
  }
}

function closeHelp() {
  helpView.hidden = true;
  quizView.hidden = false;
  fadeIn(quizView);
  render();
  answerInput.focus();
}

function scrollHelpToBottom() {
  helpMessages.scrollTop = helpMessages.scrollHeight;
}

function addHelpBubble(text, kind) {
  const bubble = document.createElement("div");
  bubble.className = "help-msg " + kind;
  bubble.textContent = text;
  helpMessages.appendChild(bubble);
  scrollHelpToBottom();
  return bubble;
}

helpBtn.addEventListener("click", openHelp);
helpBackBtn.addEventListener("click", closeHelp);

helpForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (helpSendBtn.disabled) return;
  const text = helpInput.value.trim();
  if (!text) return;

  const endpoint =
    (typeof HELP_AI_CONFIG !== "undefined" && HELP_AI_CONFIG.url) || null;
  if (!endpoint) {
    addHelpBubble(
      "Help isn't configured yet. Deploy the help-ai function first.",
      "error"
    );
    return;
  }

  helpInput.value = "";
  addHelpBubble(text, "user");
  helpTranscript.push({ role: "user", content: text });

  const typing = document.createElement("div");
  typing.className = "help-typing";
  typing.innerHTML = "<i></i><i></i><i></i>";
  helpMessages.appendChild(typing);
  scrollHelpToBottom();
  helpSendBtn.disabled = true;

  try {
    // getSession() returns the stored token without refreshing it, so a
    // tab left open past token expiry would send a stale JWT and get
    // rejected. Refresh first when the token is near or past expiry.
    let token = null;
    const { data: sessionData } = await supabaseClient.auth.getSession();
    let session = sessionData && sessionData.session;
    if (!session) {
      addHelpBubble("No active session. Sign out and sign back in, then try again.", "error");
      return;
    }
    const expiresAt = (session.expires_at || 0) * 1000;
    if (!session.expires_at || expiresAt - Date.now() < 60 * 1000) {
      const { data: refreshed } = await supabaseClient.auth.refreshSession();
      if (refreshed && refreshed.session) session = refreshed.session;
    }
    token = session.access_token;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ messages: helpTranscript.slice(-12) }),
    });

    let reply = null;
    let errMsg = "The assistant is unavailable right now. Try again.";
    try {
      const body = await res.json();
      if (res.ok) reply = body.reply;
      else if (body.error) errMsg = body.error;
    } catch {
      /* non-JSON response — keep the generic error */
    }

    typing.remove();
    if (reply) {
      addHelpBubble(reply, "bot");
      helpTranscript.push({ role: "assistant", content: reply });
    } else {
      addHelpBubble(errMsg, "error");
    }
  } catch (netErr) {
    typing.remove();
    addHelpBubble("Couldn't reach the assistant. Check your connection and try again.", "error");
  } finally {
    helpSendBtn.disabled = false;
    helpInput.focus();
  }
});

function closeProfile() {
  profileView.hidden = true;
  quizView.hidden = false;
  fadeIn(quizView);
  render();
  answerInput.focus();
}

function renderProfile() {
  const email = currentUser.email || profile.email || "";
  profileNameInput.value = profile.name || "";
  profileBirthdayInput.value = profile.birthday || "";
  profileNameDisplay.textContent = profile.name || email;
  profileEmailDisplay.textContent = email;
  statusBadge.textContent = statusLabel(profile.account_status);
  statusBadge.classList.toggle(
    "status-inactive",
    profile.account_status !== "active"
  );
  profileJoined.textContent = formatDate(profile.created_at);
  profilePointsEl.textContent = formatPeso(profile.total_points);
  profileCurrentEl.textContent = formatPeso(profile.current_points);
  setProfileMsg("", "");
}

profileBtn.addEventListener("click", openProfile);
profileBackBtn.addEventListener("click", closeProfile);

// ------------------------------------------------------------
// Withdraw: pick a method (GCash for now) and save the number once.
// The number is permanent — after saving it cannot be edited.
// ------------------------------------------------------------
function normalizeGcashNumber(raw) {
  return String(raw || "").replace(/\D/g, "");
}

function formatGcashNumber(digits) {
  const d = normalizeGcashNumber(digits);
  if (d.length === 11) return d.replace(/^(\d{4})(\d{3})(\d{4})$/, "$1 $2 $3");
  return d;
}

function setWithdrawMsg(message, kind) {
  withdrawMsg.textContent = message;
  withdrawMsg.className = "auth-msg" + (kind ? " " + kind : "");
}

async function openWithdraw() {
  if (!isActive()) { showSubscribe(); return; }
  await loadProfile();  // refresh current balance
  await loadWithdrawals();
  showWithdraw();
  renderWithdraw();
}

function closeWithdraw() {
  withdrawView.hidden = true;
  quizView.hidden = false;
  fadeIn(quizView);
  render();
  answerInput.focus();
}

async function loadWithdrawals() {
  if (!supabaseClient || !currentUser) return;
  const { data, error } = await supabaseClient
    .from("withdrawals")
    .select("id, amount, method, account, status, created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("Withdrawal history fetch failed:", error.message);
    withdrawals = [];
    return;
  }
  withdrawals = data || [];
}

function renderWithdraw() {
  const balance = Number(profile.current_points || 0);
  withdrawBalance.textContent = formatPeso(balance);
  const saved = profile.gcash_number;
  withdrawSetup.hidden = !!saved;
  withdrawLocked.hidden = !saved;
  setWithdrawMsg("", "");
  if (saved) {
    lockedMethod.textContent =
      profile.withdrawal_method === "gcash" ? "GCash" : "Other";
    lockedNumber.textContent = formatGcashNumber(saved);
    renderWithdrawAction(balance);
  } else {
    withdrawMethod.value = "gcash";
    withdrawNumber.value = "";
  }
  renderHistory();
}

function renderWithdrawAction(balance) {
  requestWithdrawBtn.textContent = `Withdraw ${formatPeso(balance)}`;
  requestWithdrawBtn.disabled = balance < MIN_WITHDRAWAL;
  withdrawMinNote.textContent =
    balance < MIN_WITHDRAWAL
      ? `Minimum withdrawal is ${formatPeso(MIN_WITHDRAWAL)} — you need ${formatPeso(
          MIN_WITHDRAWAL - balance
        )} more to withdraw.`
      : "This withdraws your full current balance.";
}

// Withdrawal status → badge kind: pending keeps the coral accent,
// success-like statuses go green, failure-like ones go red.
function withdrawalStatusKind(status) {
  const s = String(status || "").toLowerCase();
  if (["success", "completed", "paid", "done"].includes(s)) return "success";
  if (["failed", "rejected", "cancelled", "canceled"].includes(s)) return "failed";
  return "pending";
}

function renderHistory() {
  withdrawHistory.textContent = "";
  if (!withdrawals.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "No withdrawals yet.";
    withdrawHistory.appendChild(empty);
    return;
  }
  withdrawals.forEach((w) => {
    const row = document.createElement("div");
    row.className = "history-row";

    const left = document.createElement("div");
    left.className = "history-left";

    const amount = document.createElement("span");
    amount.className = "history-amount";
    amount.textContent = formatPeso(w.amount);

    const meta = document.createElement("span");
    meta.className = "history-meta";
    meta.textContent = `GCash · ${formatDate(w.created_at)}`;

    left.append(amount, meta);

    const status = document.createElement("span");
    status.className = "history-status history-status-" + withdrawalStatusKind(w.status);
    status.textContent = statusLabel(w.status);

    row.append(left, status);
    withdrawHistory.appendChild(row);
  });
}

withdrawBtn.addEventListener("click", openWithdraw);
withdrawBackBtn.addEventListener("click", closeWithdraw);

withdrawForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const digits = normalizeGcashNumber(withdrawNumber.value);
  if (!/^09\d{9}$/.test(digits)) {
    setWithdrawMsg(
      "Enter a valid GCash number — 11 digits starting with 09.",
      "error"
    );
    return;
  }

  const { error } = await supabaseClient
    .from("profiles")
    .update({
      withdrawal_method: withdrawMethod.value,
      gcash_number: digits,
    })
    .eq("id", currentUser.id);

  if (error) {
    setWithdrawMsg("Couldn't save: " + error.message, "error");
    return;
  }

  await loadProfile();
  renderWithdraw();
  setWithdrawMsg("GCash number saved.", "success");
});

requestWithdrawBtn.addEventListener("click", async () => {
  if (withdrawBusy) return;
  const balance = Number(profile.current_points || 0);
  if (balance < MIN_WITHDRAWAL) {
    setWithdrawMsg(
      `Minimum withdrawal is ${formatPeso(MIN_WITHDRAWAL)}.`,
      "error"
    );
    return;
  }

  withdrawBusy = true;
  requestWithdrawBtn.disabled = true;
  requestWithdrawBtn.textContent = "Processing…";

  const { error } = await supabaseClient.rpc("request_withdrawal", {
    p_amount: balance,
  });

  withdrawBusy = false;
  if (error) {
    requestWithdrawBtn.disabled = balance < MIN_WITHDRAWAL;
    requestWithdrawBtn.textContent = `Withdraw ${formatPeso(balance)}`;
    const m = (error.message || "").toLowerCase();
    if (m.includes("minimum withdrawal")) {
      setWithdrawMsg(
        `Minimum withdrawal is ${formatPeso(MIN_WITHDRAWAL)}.`,
        "error"
      );
    } else if (m.includes("insufficient")) {
      setWithdrawMsg("Insufficient balance for this withdrawal.", "error");
    } else {
      setWithdrawMsg("Couldn't withdraw: " + error.message, "error");
    }
    return;
  }

  await loadProfile();
  await loadWithdrawals();
  renderWithdraw();
  setWithdrawMsg(`✅ ${formatPeso(balance)} withdrawn successfully!`, "success");
});

// ------------------------------------------------------------
// Leaderboard: real players from get_leaderboard() — top 20 active
// earners by lifetime points, plus the caller's own rank.
// ------------------------------------------------------------
async function openLeaderboard() {
  if (!isActive()) { showSubscribe(); return; }
  await loadProfile(); // fresh points for the user's row
  showLeaderboard();
  await renderLeaderboard();
}

function closeLeaderboard() {
  leaderboardView.hidden = true;
  quizView.hidden = false;
  fadeIn(quizView);
  render();
  answerInput.focus();
}

function joinedLabel(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

async function renderLeaderboard() {
  leaderboardList.textContent = "";
  leaderboardSummary.textContent = "";

  const { data, error } = await supabaseClient.rpc("get_leaderboard");
  if (error || !data) {
    const note = document.createElement("p");
    note.className = "lb-note";
    note.textContent =
      "Couldn't load the leaderboard" + (error ? ": " + error.message : ".");
    leaderboardList.appendChild(note);
    return;
  }

  const me = data.me || {};
  const myRank = Number(me.rank) || 0;
  const playerCount = Number(me.players) || 0;
  const myPoints = Number(me.points) || 0;
  const myAnsweredToday = Number(me.answered_today) || 0;

  const rows = (data.rows || []).map((r) => ({
    id: r.id,
    name: r.name || "Anonymous",
    points: Number(r.total_points) || 0,
    answeredToday: Number(r.answered_today) || 0,
    joined: r.created_at,
    rn: Number(r.rn) || 0,
    isUser: !!(currentUser && r.id === currentUser.id),
  }));

  // The caller only appears in the list when inside the top 20 —
  // otherwise append their own row (with a divider) below the board.
  const meInRows = rows.some((r) => r.isUser);
  const meUnranked = myRank === 0;
  if (!meInRows && currentUser) {
    rows.push({
      id: currentUser.id,
      name: (profile && profile.name) || currentUser.email || "You",
      points: myPoints,
      answeredToday: myAnsweredToday,
      joined: profile ? profile.created_at : null,
      rn: myRank,
      isUser: true,
      appended: true,
      unranked: meUnranked,
    });
  }

  // --- Summary chips (real data from the RPC) ---
  const chips = [
    {
      label: "Your rank",
      value: meUnranked ? "Unranked" : "#" + myRank.toLocaleString(),
      accent: !meUnranked && myRank <= 3,
    },
    { label: "Players", value: playerCount.toLocaleString() },
    { label: "Earned today", value: formatPeso(pointsToday()), accent: true },
  ];
  chips.forEach((c) => {
    const chip = document.createElement("div");
    chip.className = "lb-chip";
    const label = document.createElement("span");
    label.className = "lb-chip-label";
    label.textContent = c.label;
    const value = document.createElement("span");
    value.className = "lb-chip-value" + (c.accent ? " accent" : "");
    value.textContent = c.value;
    chip.append(label, value);
    leaderboardSummary.appendChild(chip);
  });

  // --- Rows, staggered in with a gentle fade-up ---
  rows.forEach((r, i) => {
    const rowDelay = Math.min(60 + i * 55, 550);
    const row = document.createElement("div");
    row.className = "leaderboard-row" + (r.isUser ? " lb-you-row" : "");
    row.style.animationDelay = rowDelay + "ms";

    if (r.appended) {
      // Divider before the trailing "me" row when it's outside the top 20.
      const divider = document.createElement("div");
      divider.className = "lb-more";
      divider.textContent = "•";
      divider.style.animationDelay = rowDelay + "ms";
      leaderboardList.appendChild(divider);
    }

    const rankEl = document.createElement("span");
    rankEl.className = "lb-rank";
    if (r.unranked || (r.isUser && r.rn === 0)) {
      rankEl.classList.add("lb-rank-unranked");
      rankEl.textContent = "Unranked";
    } else {
      const shown = r.rn || 0;
      if (shown <= 3) rankEl.classList.add("lb-rank-top");
      rankEl.textContent = shown.toLocaleString();
    }

    const main = document.createElement("span");
    main.className = "lb-main";

    const nameWrap = document.createElement("span");
    nameWrap.className = "lb-name";
    nameWrap.textContent = r.name;
    if (r.isUser) {
      const youTag = document.createElement("span");
      youTag.className = "lb-you-tag";
      youTag.textContent = "You";
      nameWrap.appendChild(youTag);
    }
    main.appendChild(nameWrap);

    const joined = joinedLabel(r.joined);
    const meta = document.createElement("span");
    meta.className = "lb-meta";
    meta.textContent =
      `${r.answeredToday.toLocaleString()} answers today` +
      (joined ? ` · joined ${joined}` : "");
    main.appendChild(meta);

    const right = document.createElement("span");
    right.className = "lb-right";
    const pointsEl = document.createElement("span");
    pointsEl.className = "lb-points";
    pointsEl.textContent = formatPeso(0);
    right.appendChild(pointsEl);

    row.append(rankEl, main, right);
    leaderboardList.appendChild(row);
    // Count the lifetime total up once the row has entered.
    countUp(pointsEl, r.points, rowDelay + 200);
  });
}

// Gentle count-up for leaderboard totals. Respects reduced motion.
function countUp(el, to, delayMs) {
  const reduced =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reduced ? 0 : 700;
  const set = (v) => { el.textContent = formatPeso(v); };
  setTimeout(() => {
    if (duration === 0) {
      set(to);
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      set(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    const from = 0;
    requestAnimationFrame(step);
  }, delayMs);
}

leaderboardBtn.addEventListener("click", openLeaderboard);
leaderboardBackBtn.addEventListener("click", closeLeaderboard);

// ------------------------------------------------------------
// Bounty: referral codes (₱20 + ₱0.01/rate per referral) and
// comment links (+₱0.005/rate per approved comment).
// ------------------------------------------------------------
function setBountyMsg(message, kind) {
  bountyMsg.textContent = message;
  bountyMsg.className = "auth-msg" + (kind ? " " + kind : "");
}

async function loadCommentLinks() {
  if (!supabaseClient || !currentUser) return;
  const { data, error } = await supabaseClient
    .from("comment_links")
    .select("id, url, status, created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("Comment link fetch failed:", error.message);
    commentLinks = [];
    return;
  }
  commentLinks = data || [];
}

async function openBounty() {
  if (!isActive()) { showSubscribe(); return; }
  await loadProfile(); // fresh points, rate bonus, referral fields
  await loadCommentLinks();
  await loadLoginRewards();
  showBounty();
  renderLoginRewards();
  renderBounty();
}

function closeBounty() {
  bountyView.hidden = true;
  quizView.hidden = false;
  fadeIn(quizView);
  render();
  answerInput.focus();
}

// ------------------------------------------------------------
// Daily login reward: ₱3.00 per day, +₱0.003 per-question rate on
// the 7th consecutive day. Server-side state via two RPCs.
// ------------------------------------------------------------
async function loadLoginRewards() {
  if (!supabaseClient || !currentUser) return null;
  const { data, error } = await supabaseClient.rpc("get_login_rewards");
  if (error) {
    console.warn("Login reward state failed:", error.message);
    return null;
  }
  loginRewards = data || {};
  return loginRewards;
}

// Red dot on the Bounty icon: visible whenever today's ₱3.00 is unclaimed.
function updateBountyDot() {
  const show = !!(isActive() && loginRewards && !loginRewards.claimed_today);
  bountyDot.hidden = !show;
}

function renderLoginRewards() {
  const r = loginRewards || {};
  const claimed = !!r.claimed_today;
  const progress = Math.max(0, Math.min(7, Number(r.cycle_progress) || 0));
  const nextDay = Math.max(1, Math.min(7, Number(r.next_day) || 1));

  // 7-step tracker: filled dots for claimed days, ring for the next one.
  rewardTrack.textContent = "";
  for (let i = 1; i <= 7; i++) {
    const day = document.createElement("span");
    day.className = "reward-day";
    if (i === 7) day.classList.add("reward-bonus-day");
    if (i <= progress) day.classList.add("done");
    if (!claimed && i === nextDay) day.classList.add("next");
    day.textContent = i === 7 ? "★" : i;
    rewardTrack.appendChild(day);
  }

  if (claimed) {
    rewardClaimBtn.disabled = true;
    rewardClaimBtn.textContent = "✓ Claimed";
    rewardStatus.textContent =
      progress >= 7
        ? "Week complete — come back tomorrow to start a new 7-day cycle."
        : `Day ${progress} of 7 claimed. Come back tomorrow for another ₱3.00.`;
  } else {
    rewardClaimBtn.disabled = false;
    rewardClaimBtn.textContent = "Claim ₱3.00";
    rewardStatus.textContent =
      nextDay === 7
        ? "Day 7 today — claiming unlocks +₱0.003 per question forever!"
        : `Day ${nextDay} of 7 · miss a day and the streak resets.`;
  }
  updateBountyDot();
}

rewardClaimBtn.addEventListener("click", async () => {
  if (bountyBusy) return;
  bountyBusy = true;
  rewardClaimBtn.disabled = true;
  rewardClaimBtn.textContent = "Claiming…";

  const { data, error } = await supabaseClient.rpc("claim_login_reward");
  bountyBusy = false;

  if (error) {
    rewardClaimBtn.disabled = false;
    renderLoginRewards();
    setBountyMsg("Couldn't claim: " + error.message, "error");
    return;
  }

  await loadProfile(); // fresh balance + rate (day-7 bonus may apply)
  await loadLoginRewards();
  renderBounty();
  renderLoginRewards();
  if (data && data.seventh) {
    setBountyMsg(
      "🎉 Day 7! ₱3.00 claimed and +₱0.003 added to your rate per question.",
      "success"
    );
  } else {
    setBountyMsg("✅ ₱3.00 claimed! Come back tomorrow for another.", "success");
  }
});

function renderBounty() {
  bountyCode.textContent = profile.referral_code || "—";
  bountyReferralCount.textContent = Number(profile.referral_count || 0).toLocaleString();
  bountyBaseRate.textContent = formatRate(RATE_PER_QUESTION);
  bountyRate.textContent = formatRate(effectiveRate());
  bountyRedeemBox.hidden = !!profile.referred_by;
  bountyRedeemedNote.hidden = !profile.referred_by;
  renderCommentHistory();
  setBountyMsg("", "");
}

function renderCommentHistory() {
  bountyCommentHistory.textContent = "";
  if (!commentLinks.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "No comment links submitted yet.";
    bountyCommentHistory.appendChild(empty);
    return;
  }
  commentLinks.forEach((c) => {
    const row = document.createElement("div");
    row.className = "history-row";

    const left = document.createElement("div");
    left.className = "history-left";

    const link = document.createElement("span");
    link.className = "comment-link";
    link.textContent = c.url;

    const meta = document.createElement("span");
    meta.className = "history-meta";
    meta.textContent = `Comment · ${formatDate(c.created_at)}`;

    left.append(link, meta);

    const status = document.createElement("span");
    status.className = "history-status history-status-" + withdrawalStatusKind(c.status);
    status.textContent = statusLabel(c.status);

    row.append(left, status);
    bountyCommentHistory.appendChild(row);
  });
}

bountyBtn.addEventListener("click", openBounty);
bountyBackBtn.addEventListener("click", closeBounty);

bountyCopyBtn.addEventListener("click", async () => {
  const code = profile && profile.referral_code;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    bountyCopyBtn.textContent = "Copied!";
    setTimeout(() => {
      bountyCopyBtn.textContent = "Copy";
    }, 1500);
  } catch (e) {
    setBountyMsg("Couldn't copy automatically — select the code to copy it.", "error");
  }
});

bountyRedeemForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (bountyBusy) return;
  const code = bountyRedeemInput.value.trim();
  if (!code) {
    setBountyMsg("Enter a referral code.", "error");
    return;
  }

  bountyBusy = true;
  bountyRedeemBtn.disabled = true;
  bountyRedeemBtn.textContent = "Redeeming…";

  const { error } = await supabaseClient.rpc("redeem_referral", { p_code: code });

  bountyBusy = false;
  if (error) {
    bountyRedeemBtn.disabled = false;
    bountyRedeemBtn.textContent = "Redeem code";
    const m = (error.message || "").toLowerCase();
    if (m.includes("own referral")) {
      setBountyMsg("You can't use your own referral code.", "error");
    } else if (m.includes("already used")) {
      setBountyMsg("You've already redeemed a referral code.", "error");
    } else if (m.includes("not found")) {
      setBountyMsg("That referral code wasn't found.", "error");
    } else {
      setBountyMsg("Couldn't redeem: " + error.message, "error");
    }
    return;
  }

  await loadProfile();
  renderBounty();
  setBountyMsg("✅ Referral code accepted! +₱20.00 added to your balance.", "success");
  showRedeemModal();
});

function showRedeemModal() {
  redeemModal.hidden = false;
  redeemModalClose.focus();
}

function closeRedeemModal() {
  redeemModal.hidden = true;
}

redeemModalClose.addEventListener("click", closeRedeemModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !redeemModal.hidden) closeRedeemModal();
});

// ------------------------------------------------------------
// Notifications: the System Notice modal. The feed is a static,
// easy-to-edit list of system announcements — to publish a new
// notice, add an entry with a higher id than the newest one. Users
// who already closed the modal will see the bell red dot again (and
// the new item highlighted as unread) because their "last seen" id
// is lower.
//   text may contain [label](url) links, styled inline.
//   ageMin = how many minutes ago the notice was "posted" (relative,
//   so it always looks fresh and feeds the time label).
// ------------------------------------------------------------
const SYSTEM_NOTICES = [
  {
    id: 3,
    emoji: "🛠️",
    title: "Scheduled maintenance this Sunday",
    text: "Hoxiee will be briefly offline on Sunday from 1:00 to 2:00 AM Philippine time while we upgrade the servers. Your balance and streak are safe. Follow [Hoxiee on Facebook](https://www.facebook.com/hoxiee) for live updates.",
    ageMin: 150,
  },
  {
    id: 2,
    emoji: "🔒",
    title: "Keep your account safe",
    text: "Hoxiee will never ask for your password or your GCash PIN, in chat or anywhere else. If someone does, report it to [support@hoxiee.ph](mailto:support@hoxiee.ph).",
    ageMin: 2900,
  },
  {
    id: 1,
    emoji: "⚙️",
    title: "Withdrawal requests are reviewed daily",
    text: "Payouts are processed in batches and sent once your request is approved. If a payout takes longer than a few days, email [support@hoxiee.ph](mailto:support@hoxiee.ph).",
    ageMin: 8700,
  },
];

function noticeLastIdKey() {
  return "hoxiee_notice_seen_" + currentUser.id;
}

function readNoticeLastId() {
  const n = Number(localStorage.getItem(noticeLastIdKey()));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function writeNoticeLastId(n) {
  try {
    localStorage.setItem(noticeLastIdKey(), String(n));
  } catch (e) {
    /* private mode etc — dot just stays on */
  }
}

function noticeNewestId() {
  return SYSTEM_NOTICES.reduce((max, n) => Math.max(max, n.id), 0);
}

function hasUnreadNotices() {
  if (!isActive()) return false;
  return noticeNewestId() > readNoticeLastId();
}

function updateNoticeDot() {
  if (!noticeDot) return;
  noticeDot.hidden = !hasUnreadNotices();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

// [label](url) becomes a styled, safe-to-open link.
function linkifyNotice(text) {
  return escapeHtml(text).replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}

function timeAgoLabel(at) {
  const s = Math.max(0, Math.floor((Date.now() - at.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + " min ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + " hr ago";
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return d + " d ago";
  return at.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Alternate the entries across the spine: first on the right, second
// on the left, and so on. New items (id above the user's last seen)
// get a coral node.
function renderNoticeTimeline() {
  const unseen = readNoticeLastId();
  const items = SYSTEM_NOTICES; // every entry is a system notice now
  noticeTimeline.textContent = "";

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "notice-empty";
    empty.textContent = "No notices in this category yet.";
    noticeTimeline.appendChild(empty);
    return;
  }

  items.forEach((n, i) => {
    const at = new Date(Date.now() - n.ageMin * 60000);

    const row = document.createElement("div");
    row.className = "notice-item " + (i % 2 === 0 ? "on-right" : "on-left");
    if (n.id > unseen) row.classList.add("is-new");
    row.style.animationDelay = Math.min(i * 55, 330) + "ms";

    const card = document.createElement("article");
    card.className = "notice-card";
    card.setAttribute("aria-label", n.title);

    const head = document.createElement("div");
    head.className = "notice-card-head";
    const emoji = document.createElement("span");
    emoji.className = "notice-emoji";
    emoji.setAttribute("aria-hidden", "true");
    emoji.textContent = n.emoji;
    const title = document.createElement("h3");
    title.className = "notice-item-title";
    title.textContent = n.title;
    head.append(emoji, title);

    const text = document.createElement("p");
    text.className = "notice-text";
    text.innerHTML = linkifyNotice(n.text);

    const time = document.createElement("time");
    time.className = "notice-time";
    time.dateTime = at.toISOString();
    time.textContent = timeAgoLabel(at);

    card.append(head, text, time);

    const dot = document.createElement("span");
    dot.className = "notice-dot";
    dot.setAttribute("aria-hidden", "true");

    row.append(card, dot);
    noticeTimeline.appendChild(row);
  });
  noticeTimeline.scrollTop = 0;
}

function openNotifications() {
  if (!isActive()) { showSubscribe(); return; }
  renderNoticeTimeline();
  noticeModal.hidden = false;
  document.body.style.overflow = "hidden"; // lock page scroll behind the modal
  noticeDismissBtn.focus();
}

// The single close path: closing always marks everything read, so the
// bell dot stays off until a newer notice is published.
function closeNotices() {
  writeNoticeLastId(noticeNewestId());
  noticeModal.hidden = true;
  document.body.style.overflow = "";
  updateNoticeDot();
}

notificationsBtn.addEventListener("click", openNotifications);

noticeDismissBtn.addEventListener("click", closeNotices);
noticeCloseBtn.addEventListener("click", closeNotices);

// Clicking the dimmed backdrop closes like the ✕ does.
noticeModal.addEventListener("click", (e) => {
  if (e.target === noticeModal) closeNotices();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !noticeModal.hidden) closeNotices();
});

bountyCommentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (bountyBusy) return;
  const url = bountyCommentLink.value.trim();
  if (!/^https?:\/\//i.test(url)) {
    setBountyMsg("Enter a valid link starting with http:// or https://.", "error");
    return;
  }

  bountyBusy = true;
  bountyCommentBtn.disabled = true;
  bountyCommentBtn.textContent = "Submitting…";

  const { error } = await supabaseClient
    .from("comment_links")
    .insert({ user_id: currentUser.id, url });

  bountyBusy = false;
  bountyCommentBtn.disabled = false;
  bountyCommentBtn.textContent = "Submit link";
  if (error) {
    setBountyMsg("Couldn't submit: " + error.message, "error");
    return;
  }

  await loadCommentLinks();
  renderCommentHistory();
  setBountyMsg("✅ Link submitted! Once approved, your rate goes up +₱0.005.", "success");
});

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isActive()) { showSubscribe(); return; }
  const name = profileNameInput.value.trim();
  const birthday = profileBirthdayInput.value || null;

  const { error } = await supabaseClient
    .from("profiles")
    .update({ name: name || null, birthday })
    .eq("id", currentUser.id);

  if (error) {
    setProfileMsg("Couldn't save: " + error.message, "error");
    return;
  }

  profile.name = name || null;
  profile.birthday = birthday;
  renderProfile();
  setProfileMsg("Profile saved.", "success");
});

// ------------------------------------------------------------
// Quiz rendering
// ------------------------------------------------------------
function render() {
  ensureFreshDay();
  if (!state) return;
  const total = formatPeso(profile ? profile.total_points : 0);
  if (totalPointsEl.textContent !== total) {
    totalPointsEl.classList.remove("pulse");
    void totalPointsEl.offsetWidth;
    totalPointsEl.classList.add("pulse");
  }
  totalPointsEl.textContent = total;
  currentPointsEl.textContent = formatPeso(profile ? profile.current_points : 0);
  pointsTodayEl.textContent = formatPeso(pointsToday());
  rateStat.textContent = `${formatRate(effectiveRate())} / answer`;
  countEl.textContent = `${state.answered.toLocaleString()} / ${DAILY_LIMIT.toLocaleString()}`;
  const pct = Math.min(100, (state.answered / DAILY_LIMIT) * 100);
  progressFill.style.transform = "scaleX(" + (pct / 100).toFixed(5) + ")";
  progressNote.textContent = pct.toFixed(3) + "% of today's daily limit";
  footnoteEl.textContent = `${formatRate(effectiveRate())} per correct answer · up to ${DAILY_LIMIT.toLocaleString()} questions per day`;
}

function showFeedback(message, kind) {
  feedbackEl.textContent = message;
  feedbackEl.className = "feedback" + (kind ? " " + kind : "");
}

// ------------------------------------------------------------
// Questions come from the server: get_question issues one, signs it
// (HMAC), and returns the question text + token. The client only
// renders the text and sends the token back with the answer.
// ------------------------------------------------------------
async function nextQuestion() {
  questionEl.textContent = "…";
  const { data, error } = await supabaseClient.rpc("get_question");
  if (error || !data) {
    showFeedback("Couldn't load the next question: " + (error ? error.message : "empty response"), "wrong");
    console.warn("get_question failed:", error && error.message);
    return;
  }
  currentQuestion = { token: data.token, payload: data.payload, text: data.question };
  questionEl.textContent = currentQuestion.text;
  answerInput.value = "";
  // Turn the question in gently when a new problem appears.
  questionEl.classList.remove("q-enter");
  void questionEl.offsetWidth;
  questionEl.classList.add("q-enter");
}

function limitReached() {
  return state.answered >= DAILY_LIMIT;
}

// ------------------------------------------------------------
// Submit an answer to the server. submit_answer verifies the signed
// token, recomputes the answer server-side, and credits points only
// when correct — the client can no longer mint points by calling an
// RPC blind.
// ------------------------------------------------------------
answerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy || !state || !isActive() || limitReached()) return;

  const value = answerInput.value.trim();
  if (value === "" || Number.isNaN(Number(value))) return;
  if (!currentQuestion) return;

  busy = true;
  submitBtn.disabled = true;

  const { data, error } = await supabaseClient.rpc("submit_answer", {
    p_token: currentQuestion.token,
    p_payload: currentQuestion.payload,
    p_answer: Number(value),
  });

  if (error || !data) {
    showFeedback("Couldn't submit: " + (error ? error.message : "empty response"), "wrong");
    console.warn("submit_answer failed:", error && error.message);
    busy = false;
    submitBtn.disabled = false;
    return;
  }

  // Server-authoritative daily tally (also defeats clearing localStorage).
  state.answered = Number(data.answered);
  state.correct = Number(data.correct_count);
  saveState();

  const correct = !!data.correct;
  if (correct) {
    showFeedback(`✅ Correct! +${formatRate(effectiveRate())}`, "correct");
  } else {
    showFeedback(`❌ Wrong. The answer was ${data.answer}.`, "wrong");
  }

  if (profile && correct) {
    profile.current_points = Number(data.current_points);
    profile.total_points = Number(data.total_points);
  }

  render();

  if (limitReached()) {
    showFeedback(
      `🎉 You've reached today's limit of ${DAILY_LIMIT.toLocaleString()} questions. Come back tomorrow!`,
      "limit"
    );
    answerInput.disabled = true;
    submitBtn.disabled = true;
    busy = false;
    return;
  }

  setTimeout(() => {
    nextQuestion();
    feedbackEl.className = "feedback";
    busy = false;
    submitBtn.disabled = false;
  }, 900);
});

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
if (!supabaseClient) {
  setAuthMsg(
    "⚠️ Supabase not configured. Open config.js and paste your Project URL and anon key.",
    "error"
  );
  showAuth();
} else {
  initAuth();
}